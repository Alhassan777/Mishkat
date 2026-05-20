#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from google import genai
from openai import OpenAI

from pipeline.mutashabihat.config import (
    BOOK_PROFILES_DIR,
    DEFAULT_SOURCE_DIR,
    OUTPUT_DIR,
    deepseek_settings,
    gemini_settings,
    llm_provider,
    load_env,
)
from pipeline.mutashabihat.models import BookProfile, SimpleExtractionResponse
from pipeline.mutashabihat.pipeline import ExtractionState, append_jsonl, assemble_record, chunk_book, generate_json
from pipeline.mutashabihat.pipeline.prompts import (
    FIDELITY_SYSTEM_PROMPT,
    build_fidelity_user_prompt,
    build_system_prompt,
    build_user_prompt,
)
from pipeline.mutashabihat.registry import get_book_by_slug
from pipeline.mutashabihat.models.verse_ref import AutoFilledVerseData
from pipeline.mutashabihat.verifier import (
    connect_dictionary,
    get_verse,
    infer_reference_from_snippet,
    load_from_hf_dataset,
    verify_extracted_verse,
)


def _find_source(slug: str, source_dir: Path) -> Path:
    item = get_book_by_slug(slug)
    if item is None:
        raise ValueError(f"Unknown slug: {slug}")
    for md in sorted(source_dir.glob("*.md")):
        text = md.read_text(encoding="utf-8", errors="replace")
        m = re.search(r"\*\*رقم الكتاب:\*\*\s*(\d+)", text) or re.search(r"^-\s*\*\*رقم الكتاب:\*\*\s*(\d+)", text, re.MULTILINE)
        if m and int(m.group(1)) == item.shamela_id:
            return md
    raise FileNotFoundError(f"No source markdown for slug={slug}")


def _coerce_float(value: Any) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.strip())
        except ValueError:
            return None
    return None


def _run_fidelity_pass(
    client: genai.Client | OpenAI,
    model_name: str,
    records: list[dict[str, Any]],
    source_chunk: str,
    book_title: str,
    temperature: float,
    max_output_tokens: int,
) -> tuple[dict[str, Any], dict[str, int]]:
    fidelity_user_prompt = build_fidelity_user_prompt(
        records_json=json.dumps({"records": records}, ensure_ascii=False),
        source_chunk=source_chunk,
        book_title=book_title,
    )
    return generate_json(
        client=client,
        model_name=model_name,
        system_prompt=FIDELITY_SYSTEM_PROMPT,
        user_prompt=fidelity_user_prompt,
        temperature=temperature,
        max_output_tokens=max_output_tokens,
    )


def run(slug: str, source_dir: Path, model: str | None, limit: int | None, force: bool, delay: float, run_id: str | None = None) -> None:
    load_env()
    provider = llm_provider()
    if provider == "deepseek":
        api_key = os.environ.get("DEEPSEEK_API_KEY")
        if not api_key:
            raise RuntimeError("DEEPSEEK_API_KEY missing in environment/.env")
        client = OpenAI(api_key=api_key.strip(), base_url="https://api.deepseek.com")
    else:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY missing in environment/.env")
        client = genai.Client(api_key=api_key.strip())

    profile = BookProfile.model_validate_json((BOOK_PROFILES_DIR / f"{slug}.json").read_text(encoding="utf-8"))
    canonical_book_id = str(profile.meta.shamela_id)
    canonical_book_title = profile.meta.book_title
    canonical_author = profile.meta.author
    source_md = _find_source(slug, source_dir)
    provider_settings = deepseek_settings() if provider == "deepseek" else gemini_settings()
    selected_model = model or provider_settings["model"]
    difficulty = (profile.extraction_difficulty or "").strip().lower()
    if provider == "gemini":
        if difficulty == "hard":
            selected_model = "gemini-2.5-pro"
        elif difficulty == "easy":
            selected_model = "gemini-2.5-flash"

    system_prompt = build_system_prompt(profile)
    chunks = chunk_book(source_md, profile)
    if limit:
        chunks = chunks[:limit]

    run_folder = run_id.strip() if isinstance(run_id, str) and run_id.strip() else datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_dir = OUTPUT_DIR / slug / run_folder
    out_dir.mkdir(parents=True, exist_ok=True)
    records_path = out_dir / "records.jsonl"
    state = ExtractionState.load(
        slug=slug,
        model=selected_model,
        out_dir=out_dir,
        total_chunks=len(chunks),
        force=force,
    )

    dict_conn = connect_dictionary(OUTPUT_DIR / "quran_dictionary.db")
    try:
        load_from_hf_dataset(dict_conn)
    except Exception:
        pass

    settings = provider_settings
    done_record_ids: set[str] = set()
    seen_pair_keys: set[str] = set()
    if not force and records_path.exists():
        for line in records_path.read_text(encoding="utf-8", errors="ignore").splitlines():
            try:
                payload = json.loads(line)
            except Exception:
                continue
            record_id = payload.get("id")
            if isinstance(record_id, str):
                done_record_ids.add(record_id)
            pair_keys = payload.get("pair_keys")
            if isinstance(pair_keys, list):
                for pair_key in pair_keys:
                    if isinstance(pair_key, str) and pair_key:
                        seen_pair_keys.add(pair_key)

    def _suffix_for_index(idx: int) -> str:
        alphabet = "abcdefghijklmnopqrstuvwxyz"
        if idx < len(alphabet):
            return alphabet[idx]
        # Continue deterministically beyond 26 entries.
        return f"z{idx - len(alphabet) + 1}"

    for idx, chunk in enumerate(chunks, start=1):
        chunk_id = f"{slug}_{idx:04d}"
        print(f"[chunk {idx}/{len(chunks)}] {chunk_id}")
        if not force and state.is_chunk_done(chunk_id):
            state.mark_chunk_skipped()
            continue

        chunk_had_error = False
        try:
            user_prompt = build_user_prompt(chunk["text"], profile.primary_categories)
            MAX_RETRIES = 3
            raw = None
            usage = {"tokens_in": 0, "tokens_out": 0}
            last_err = None
            for attempt in range(1, MAX_RETRIES + 1):
                try:
                    use_schema = (attempt == 1)
                    raw, usage = generate_json(
                        client,
                        selected_model,
                        system_prompt,
                        user_prompt,
                        settings["temperature"],
                        settings["max_output_tokens"],
                        response_schema=SimpleExtractionResponse if use_schema else None,
                    )
                    last_err = None
                    break
                except Exception as attempt_exc:
                    last_err = attempt_exc
                    label = "schema-constrained" if attempt == 1 else f"attempt {attempt}"
                    print(f"  [warn] {chunk_id} {label} failed: {attempt_exc}")
                    state.add_warning(
                        f"{label} extraction failed for {chunk_id}: {attempt_exc}"
                    )
                    if attempt < MAX_RETRIES:
                        time.sleep(1)
            if last_err is not None:
                raise last_err
            state.add_usage(usage)

            records = raw.get("records", [])
            if not isinstance(records, list):
                raise ValueError("LLM response missing 'records' array")
            if len(records) == 0:
                print(f"  [info] chunk {chunk_id}: LLM returned 0 records (likely non-content chunk)")
                state.add_warning(f"Empty records array for {chunk_id}")
            staged_records: list[dict[str, Any]] = []
            for record_idx, raw_record in enumerate(records):
                rec_id = f"{chunk_id}_{_suffix_for_index(record_idx)}"
                if not isinstance(raw_record, dict):
                    continue
                staged = dict(raw_record)
                staged["id"] = rec_id
                staged_records.append(staged)

            fidelity_verdicts_by_id: dict[str, dict[str, Any]] = {}
            if staged_records:
                try:
                    fidelity_raw, fidelity_usage = _run_fidelity_pass(
                        client=client,
                        model_name=selected_model,
                        records=staged_records,
                        source_chunk=chunk["text"],
                        book_title=profile.meta.book_title,
                        temperature=settings["temperature"],
                        max_output_tokens=settings["max_output_tokens"],
                    )
                    state.add_usage(fidelity_usage)
                    raw_verdicts = fidelity_raw.get("verdicts", [])
                    if isinstance(raw_verdicts, list):
                        for verdict in raw_verdicts:
                            if isinstance(verdict, dict):
                                record_id = verdict.get("record_id")
                                if isinstance(record_id, str):
                                    fidelity_verdicts_by_id[record_id] = verdict
                except Exception as fidelity_exc:
                    state.add_warning(f"Fidelity pass failed for {chunk_id}: {fidelity_exc}")

            def _as_auto_filled(row: dict | None, verse_data: dict) -> AutoFilledVerseData | None:
                if row is None:
                    return None
                result = verify_extracted_verse(verse_data, row).get("auto_filled")
                if result is None:
                    return None
                return AutoFilledVerseData.model_validate(result)

            for raw_record in staged_records:
                rec_id = str(raw_record.get("id", ""))
                if not rec_id:
                    continue
                if not force and rec_id in done_record_ids:
                    state.skipped += 1
                    continue
                try:
                    verdict = fidelity_verdicts_by_id.get(rec_id, {})
                    overall = verdict.get("overall")
                    if overall == "fail":
                        raw_record.setdefault("fidelity_flags", []).append("fidelity_verdict=fail")
                        raw_record["confidence"] = min(raw_record.get("confidence") or 0.5, 0.3)
                        state.add_warning(f"{rec_id}: fidelity_verdict=fail (kept with low confidence)")
                    threshold_block = verdict.get("mutashabih_threshold")
                    if isinstance(threshold_block, dict) and threshold_block.get("meets_threshold") is False:
                        raw_record.setdefault("fidelity_flags", []).append("mutashabih_threshold=fail")
                        raw_record["confidence"] = min(raw_record.get("confidence") or 0.5, 0.3)
                        state.add_warning(f"{rec_id}: mutashabih_threshold=fail (kept with low confidence)")
                    if isinstance(verdict.get("confidence"), dict):
                        suggested_confidence = _coerce_float(verdict["confidence"].get("suggested"))
                        if suggested_confidence is not None:
                            raw_record["confidence"] = suggested_confidence
                    if isinstance(verdict.get("category"), dict):
                        category_block = verdict["category"]
                        supported = category_block.get("assignment_supported")
                        suggested_category = category_block.get("suggested_category")
                        if supported is False and isinstance(suggested_category, str):
                            raw_record["category"] = suggested_category
                    neutrality = verdict.get("theological_neutrality")
                    if isinstance(neutrality, dict) and neutrality.get("neutral") is False:
                        note = neutrality.get("note")
                        if isinstance(note, str) and note.strip():
                            existing = raw_record.get("theological_notes")
                            if not isinstance(existing, list):
                                existing = []
                            existing.append(note.strip())
                            raw_record["theological_notes"] = existing
                    source = raw_record.get("source")
                    if not isinstance(source, dict):
                        source = {}
                        raw_record["source"] = source
                    source["book_id"] = canonical_book_id
                    source["book_title_ar"] = canonical_book_title
                    source["author_ar"] = canonical_author
                    source.setdefault("raw_text_snippet", "")
                    rec = assemble_record(
                        raw_record,
                        fallback_category=str(raw_record.get("category", "lexical")),
                        fallback_id=rec_id,
                        model_name=selected_model,
                        source_window=chunk["text"],
                    )
                    if rec.pair_keys and any(pair_key in seen_pair_keys for pair_key in rec.pair_keys):
                        state.skipped += 1
                        continue
                    pv = rec.verses.primary
                    if pv.surah and pv.ayah:
                        row = get_verse(dict_conn, pv.surah, pv.ayah)
                        pv.auto_filled = _as_auto_filled(row, pv.model_dump(by_alias=True))
                    else:
                        inferred = infer_reference_from_snippet(dict_conn, pv.text_snippet, min_score=0.9)
                        if inferred:
                            row = inferred["row"]
                            pv.surah = row.get("surah_no")
                            pv.ayah = row.get("ayah_no_surah")
                            pv.auto_filled = _as_auto_filled(row, pv.model_dump(by_alias=True))
                    for rv in rec.verses.related:
                        if rv.surah and rv.ayah:
                            row = get_verse(dict_conn, rv.surah, rv.ayah)
                            rv.auto_filled = _as_auto_filled(row, rv.model_dump(by_alias=True))
                        else:
                            inferred = infer_reference_from_snippet(dict_conn, rv.text_snippet, min_score=0.9)
                            if inferred:
                                row = inferred["row"]
                                rv.surah = row.get("surah_no")
                                rv.ayah = row.get("ayah_no_surah")
                                rv.auto_filled = _as_auto_filled(row, rv.model_dump(by_alias=True))
                    rec.extraction_date = date.today()
                    append_jsonl(records_path, rec.model_dump(mode="json", by_alias=True))
                    done_record_ids.add(rec_id)
                    for pair_key in rec.pair_keys:
                        seen_pair_keys.add(pair_key)
                    state.ok += 1
                except Exception as rec_exc:
                    chunk_had_error = True
                    print(f"  [error] record {rec_id}: {rec_exc}")
                    state.mark_error(rec_id or chunk_id, str(rec_exc))

            if not chunk_had_error:
                state.mark_chunk_done(chunk_id, idx)
            else:
                state.mark_chunk_failed(chunk_id, "chunk had one or more record-level errors")
        except Exception as exc:
            chunk_had_error = True
            print(f"  [ERROR] chunk {chunk_id} failed: {exc}")
            state.mark_chunk_failed(chunk_id, str(exc))
        time.sleep(delay)

    total_records = 0
    confidence_values: list[float] = []
    if records_path.exists():
        for line in records_path.read_text(encoding="utf-8", errors="ignore").splitlines():
            if '"id"' in line:
                total_records += 1
            try:
                parsed = json.loads(line)
            except Exception:
                continue
            confidence = parsed.get("confidence")
            if isinstance(confidence, (int, float)):
                confidence_values.append(float(confidence))
    estimate = profile.entry_count_estimate or 0
    if estimate > 0:
        ratio = total_records / estimate
        if ratio < 0.3 or ratio > 3.0:
            warning = (
                f"Record count ratio out of expected range: produced={total_records}, "
                f"estimate={estimate}, ratio={ratio:.2f}"
            )
            state.add_warning(warning)
            print(f"WARNING: {warning}")
    if confidence_values:
        mean_confidence = sum(confidence_values) / len(confidence_values)
        if mean_confidence > 0.75:
            warning = (
                f"Mean confidence unusually high: mean={mean_confidence:.2f}, "
                f"records_with_confidence={len(confidence_values)}. "
                "Possible confidence inflation."
            )
            state.add_warning(warning)
            print(f"WARNING: {warning}")

    if state.failed_chunk_ids:
        state.mark_failed()
    else:
        state.mark_completed()

    print(
        f"Done. ok={state.ok} errors={state.errors} skipped={state.skipped} "
        f"chunks_processed={state.chunks_processed} failed_chunks={len(state.failed_chunk_ids)}"
    )
    latest_path = OUTPUT_DIR / slug / "latest.txt"
    latest_path.write_text(run_folder, encoding="utf-8")
    print(f"Run output directory: {out_dir}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--book", required=True)
    parser.add_argument("--source", default=str(DEFAULT_SOURCE_DIR))
    parser.add_argument("--model", default=None)
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--delay", type=float, default=gemini_settings()["delay_seconds"])
    parser.add_argument("--run-id", default=None, help="Custom output subfolder name for this run")
    args = parser.parse_args()
    run(args.book, Path(args.source), args.model, args.limit, args.force, args.delay, args.run_id)


if __name__ == "__main__":
    main()

