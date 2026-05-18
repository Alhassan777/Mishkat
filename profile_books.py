#!/usr/bin/env python3
"""
Book Profiler — Mutashabihat Pipeline

Sends structured profiling questions to an LLM about each Shamela .md book export.
Produces book_profiles/{slug}.json with the structural metadata needed
before the extraction pass runs.

Usage:
    python profile_books.py list                             # show all books and status
    python profile_books.py profile --book SLUG              # profile one book by slug
    python profile_books.py profile --all                    # profile all available books
    python profile_books.py profile --all --tier TIER        # profile one tier only

Source dir:
    By default the script looks for .md source files in a sibling directory
    (../Ayat_visualizer_hackathon). Override with --source PATH.

Output:
    book_profiles/{slug}.json   — one JSON profile per book

Environment:
    GEMINI_API_KEY / DEEPSEEK_API_KEY  — required for 'profile' command
"""

import os
import sys
import re
import json
import time
import argparse
from pathlib import Path
from datetime import datetime, timezone

try:
    from google import genai
    from google.genai import types as gtypes
except ImportError:
    print("ERROR: Install the Gemini SDK:  pip install google-genai")
    sys.exit(1)

try:
    from openai import OpenAI
except ImportError:
    print("ERROR: Install OpenAI SDK: pip install openai")
    sys.exit(1)

from mutashabihat.config import deepseek_settings, gemini_settings, llm_provider, load_env

# ── Paths ─────────────────────────────────────────────────────────────────────

PROJECT_ROOT = Path(__file__).parent
PROFILES_DIR = PROJECT_ROOT / "book_profiles"

# Default location for the downloaded .md files
DEFAULT_SOURCE_DIR = (
    Path.home()
    / "Downloads"
    / "Ayat_visualizer_hackathon-20260513T072712Z-3-001"
    / "Ayat_visualizer_hackathon"
)

# ── Book registry ─────────────────────────────────────────────────────────────
# Maps Shamela numeric ID → (pipeline_slug, tier)
BOOK_REGISTRY: dict[int, tuple[str, str]] = {
    1340:  ("book_22_iskafi_durra_tanzil",       "tier1_poc_core"),
    3580:  ("book_79_karmani_burhan",             "tier1_poc_core"),
    18007: ("book_276_shinqiti_daf_iham",         "tier1_poc_core"),
    37586: ("book_404_askari_wujuh_nazair",       "tier1_poc_core"),
    1403:  ("book_30_ibn_jamaah_kashf_maani",     "tier2_enhancement"),
    23596: ("book_326_ibn_qutayba_tawil_mushkil", "tier2_enhancement"),
    5538:  ("book_100_makki_mushkil_irab",        "future_expansion"),
    9086:  ("book_166_ansari_fath_rahman",        "future_expansion"),
    9220:  ("book_172_ibn_taymiyya_iklil",        "future_expansion"),
    9831:  ("book_185_sakhawi_hidayat_murtab",    "future_expansion"),
    11783: ("book_248_yahya_ibn_sallam_tasarif",  "future_expansion"),
    2163:  ("book_1392_darwish_irab_quran",       "future_expansion"),
    6334:  ("book_1508_ibn_jawzi_nuzhat_ayn",     "future_expansion"),
    1419:  ("book_26752_ibn_zubayr_malak_tawil",  "future_expansion"),
}

# ── Profiling prompt ──────────────────────────────────────────────────────────

SYSTEM_PROMPT = """\
You are analyzing a classical Arabic Islamic scholarship book to help build an
automated extraction pipeline for a Quranic verse-comparison research dataset.

The pipeline needs to:
1. Split the book into individual discussion entries
2. Identify which Quranic verses each entry discusses
3. Classify each entry into one of 7 scholarly categories:
   1 = Lexical similarity (same word, different context)
   2 = Semantic / polysemy (one word, multiple meanings)
   3 = Thematic parallels (different wording, same topic)
   4 = Narrative variation (same story told differently)
   5 = Structural / syntactic (grammatical or rhetorical contrast)
   6 = Cross-surah refrains (repeated phrases across surahs)
   7 = Doctrinal / theological contrast

Your task: Analyze the TEXT SAMPLE provided and answer the structural questions
below. Return ONLY a JSON object — no markdown fences, no commentary.\
"""

STRUCTURAL_PROFILING_QUESTIONS = """\
Analyze the sample text from this Arabic Quranic scholarship book and return
a JSON object with EXACTLY these keys:

{
  "organization_type": one of:
    "surah_sequential_numbered"    — entries numbered within each surah section
    "surah_sequential_prose"       — surah sections but no numbered entries
    "alphabetical_by_term"         — organized A-Z by Quranic term/word
    "thematic_chapters"            — chapters by topic or rhetorical problem
    "treatise_freeform"            — flowing scholarly treatise, no fixed unit
    "verse_by_verse_irab"          — verse-by-verse grammatical analysis,

  "entry_delimiter": the exact Arabic string (or Markdown pattern) that
    signals the START of a new entry or discussion unit. Examples:
    "١-" or "1-"     for numbered entries
    "قوله تعالى:"    for verse-citation openers
    "مسألة:"         for question-answer format
    "### سورة"       for surah headers only (no sub-entries)
    "باب"            for alphabetical chapter headings,

  "verse_citation_format": how Quranic verses are cited. One of:
    "text_in_braces"          — {verse text} or (verse text)
    "text_in_braces_named"    — {verse} with explicit surah name
    "text_inline_no_delimiter" — verse text quoted inline without brackets
    "number_reference_only"   — refers to surah/ayah by number only
    "mixed"                   — varies within the book,

  "resolution_markers": array of Arabic phrases that introduce the
    EXPLANATION/ANSWER in entries. Include ALL common variants in this
    book, ordered by frequency. Use [] if not applicable. Examples:
    ["فالجواب:", "والجواب:", "قلت:", "والفرق:"],

  "entry_count_estimate": your best integer estimate of the TOTAL number
    of discussion entries in the entire book (not pages),

  "primary_categories": list of integers (1-7) for the categories this
    book primarily addresses, most relevant first. Maximum 3,

  "extraction_difficulty": one of "easy" "medium" "hard",
    reflecting how cleanly automatable the entry boundaries are,
}

TEXT SAMPLE FOLLOWS:
---
"""

CONTEXTUAL_PROFILING_QUESTIONS = """\
Analyze the sample text from this Arabic Quranic scholarship book and return
a JSON object with EXACTLY these keys:

{
  "muqaddimah_summary": a comprehensive Arabic paragraph summarising the
    book's purpose, methodology, organization style, and types of analysis.
    Do not use length limits. Null if no introduction is visible,

  "methodology_note": concise 1-2 sentence note describing HOW the author
    approaches mutashabihat extraction units (e.g., lexical contrast reasoning,
    wujuh enumeration, contradiction reconciliation). This will be injected into
    the extraction system prompt,

  "numbering_convention": one of:
    "kufi"     — standard Kufi ayah numbering
    "madani"   — Madani-style ayah numbering in citations
    "mixed"    — both appear in the same book
    "unknown"  — cannot be confidently determined from the sample,

  "has_mnemonic_content": boolean indicating whether the source explicitly
    includes memorization cues/mnemonic hints (not model-generated aids),

  "example_entries": list of 2-3 VERBATIM consecutive lines from the
    sample that illustrate a complete or near-complete entry. Choose
    entries that best show the delimiter + content + resolution pattern,

  "question_markers": list of Arabic phrases that introduce the
    question/problem side of an entry (for example: "فإن قيل:", "للسائل أن يسأل").
    Use [] if not applicable,

  "multi_entry_window": boolean indicating whether one contiguous passage
    can contain multiple independent mutashabihat comparisons,

  "profiler_notes": 1-2 sentences on any unusual structural feature,
    ambiguity in entry boundaries, or risk the extractor should know about
}

TEXT SAMPLE FOLLOWS:
---
"""

PROFILE_DEFAULTS: dict[str, object] = {
    "organization_type": "treatise_freeform",
    "entry_delimiter": "قوله تعالى:",
    "verse_citation_format": "mixed",
    "resolution_markers": [],
    "entry_count_estimate": 0,
    "primary_categories": [],
    "extraction_difficulty": "medium",
    "muqaddimah_summary": None,
    "methodology_note": None,
    "numbering_convention": "unknown",
    "has_mnemonic_content": False,
    "example_entries": [],
    "question_markers": [],
    "multi_entry_window": False,
    "profiler_notes": None,
}

# ── Source file helpers ───────────────────────────────────────────────────────


def parse_shamela_id(md_path: Path) -> int | None:
    """Extract 'رقم الكتاب' from the markdown header."""
    try:
        text = md_path.read_text(encoding="utf-8", errors="replace")
        m = re.search(r"\*\*رقم الكتاب:\*\*\s*(\d+)", text)
        if m:
            return int(m.group(1))
        # Fallback: bare line format
        m = re.search(r"^-\s*\*\*رقم الكتاب:\*\*\s*(\d+)", text, re.MULTILINE)
        if m:
            return int(m.group(1))
    except Exception:
        pass
    return None


def parse_metadata(md_path: Path) -> dict:
    """Return dict of header fields from the markdown file."""
    meta: dict[str, str] = {}
    text = md_path.read_text(encoding="utf-8", errors="replace")
    for line in text.splitlines()[:30]:
        m = re.match(r"^-\s*\*\*(.+?):\*\*\s*(.+)$", line)
        if m:
            meta[m.group(1).strip()] = m.group(2).strip()
    # Also grab the H1 title
    for line in text.splitlines()[:5]:
        if line.startswith("# "):
            meta["_title"] = line[2:].strip()
            break
    return meta


def extract_content_sample(md_path: Path, max_start_lines: int = 300, max_mid_lines: int = 150) -> str:
    """
    Return a representative text sample from the book:
    - Full header metadata (first ~15 lines)
    - First max_start_lines lines of actual content (after the TOC separator)
    - max_mid_lines lines from the middle of the file

    Structural pattern in Shamela .md files:
        [metadata lines]
        ---            ← first separator: ends metadata
        ## فهرس المحتويات
        [TOC entries]
        ---            ← second separator: ends TOC → content follows here
        ## [first content section]
    Some books have no TOC and only one separator.
    """
    lines = md_path.read_text(encoding="utf-8", errors="replace").splitlines()
    total = len(lines)

    # Collect positions of all '---' separators in the first 250 lines
    sep_positions = [
        i for i, line in enumerate(lines[:250]) if line.strip() == "---"
    ]

    if len(sep_positions) >= 2:
        # Content starts after the LAST separator in the preamble region
        toc_end = sep_positions[-1] + 1
    elif len(sep_positions) == 1:
        toc_end = sep_positions[0] + 1
    else:
        toc_end = 0

    header_sample = "\n".join(lines[:15])
    content_start = lines[toc_end: toc_end + max_start_lines]

    # Middle sample
    mid = total // 2
    mid_sample = lines[max(toc_end, mid - max_mid_lines // 2): mid + max_mid_lines // 2]

    parts = [
        "=== BOOK HEADER ===",
        header_sample,
        "\n=== CONTENT START (first section after table of contents) ===",
        "\n".join(content_start),
        "\n=== CONTENT MIDDLE (midpoint sample) ===",
        "\n".join(mid_sample),
    ]
    return "\n".join(parts)


# ── Source directory scanning ─────────────────────────────────────────────────


def find_md_files(source_dir: Path) -> dict[int, Path]:
    """Scan source_dir for .md files, return {shamela_id: path}."""
    result: dict[int, Path] = {}
    if not source_dir.exists():
        return result
    for md_file in sorted(source_dir.glob("*.md")):
        sid = parse_shamela_id(md_file)
        if sid and sid in BOOK_REGISTRY:
            result[sid] = md_file
    return result


# ── Profile I/O ───────────────────────────────────────────────────────────────


def profile_path(slug: str) -> Path:
    return PROFILES_DIR / f"{slug}.json"


def profile_done(slug: str) -> bool:
    return profile_path(slug).exists()


def load_profile(slug: str) -> dict | None:
    p = profile_path(slug)
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    return None


# ── Gemini call ───────────────────────────────────────────────────────────────


def extract_json(text: str) -> dict:
    """Parse JSON from Gemini response, handling markdown fences and embedded newlines."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\n?", "", text)
        text = re.sub(r"\n?```$", "", text.strip())
    # Gemini sometimes puts literal newlines inside JSON string values, which is
    # invalid JSON. Replace any \n that appears inside a string (between quotes)
    # with the escaped form \\n so json.loads accepts it.
    def _escape_newlines_in_strings(s: str) -> str:
        result = []
        in_string = False
        escape_next = False
        for ch in s:
            if escape_next:
                result.append(ch)
                escape_next = False
            elif ch == '\\' and in_string:
                result.append(ch)
                escape_next = True
            elif ch == '"':
                result.append(ch)
                in_string = not in_string
            elif ch == '\n' and in_string:
                result.append('\\n')
            elif ch == '\r' and in_string:
                result.append('\\r')
            else:
                result.append(ch)
        return ''.join(result)
    text = _escape_newlines_in_strings(text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Gemini sometimes truncates mid-string. Try to repair by:
        # 1. Truncating at the last complete key-value pair (before the bad field)
        # 2. Closing open braces/brackets
        repaired = _repair_truncated_json(text)
        return json.loads(repaired)


def _repair_truncated_json(text: str) -> str:
    """Best-effort repair of JSON truncated mid-string by closing open structures."""
    # Find the last complete comma-terminated field: ...",\n  "next_key":...
    # and truncate just before the incomplete field
    lines = text.split('\n')
    good_lines = []
    for line in lines:
        good_lines.append(line)
        # If the line ends a value cleanly (comma, or closing bracket), it's safe
        stripped = line.rstrip()
        if stripped.endswith((',', '{', '[', 'null,', 'true,', 'false,')):
            pass  # keep accumulating
    # Walk backwards to find last clean complete line
    result_lines = list(good_lines)
    while result_lines:
        last = result_lines[-1].rstrip()
        # A line ending in a complete value
        if (last.endswith((',')) or
                last.endswith((']', '}')) or
                (last.endswith('"') and last.count('"') % 2 == 0)):
            break
        result_lines.pop()
    # Remove trailing comma from last field if present
    if result_lines:
        result_lines[-1] = result_lines[-1].rstrip().rstrip(',')
    # Count open braces/brackets to close
    joined = '\n'.join(result_lines)
    open_braces = joined.count('{') - joined.count('}')
    open_brackets = joined.count('[') - joined.count(']')
    closing = ']' * max(open_brackets, 0) + '}' * max(open_braces, 0)
    return joined + '\n' + closing


def _call_profile_prompt(
    *,
    client: genai.Client | OpenAI,
    model_name: str,
    questions: str,
    sample: str,
) -> tuple[dict, int, int]:
    prompt = questions + sample
    if isinstance(client, OpenAI):
        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,
            max_tokens=65536,
            response_format={"type": "json_object"},
        )
        raw_json = (response.choices[0].message.content or "{}") if response.choices else "{}"
        try:
            payload = json.loads(raw_json)
        except json.JSONDecodeError:
            payload = extract_json(raw_json)
        tokens_in = (response.usage.prompt_tokens if response.usage else 0) or 0
        tokens_out = (response.usage.completion_tokens if response.usage else 0) or 0
        return payload, int(tokens_in), int(tokens_out)

    response = client.models.generate_content(
        model=model_name,
        contents=[prompt],
        config=gtypes.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            temperature=0.1,
            max_output_tokens=65536,
            response_mime_type="application/json",
        ),
    )
    raw_json = response.text or "{}"
    try:
        payload = json.loads(raw_json)
    except json.JSONDecodeError:
        payload = extract_json(raw_json)
    tokens_in = getattr(response.usage_metadata, "prompt_token_count", None) or 0
    tokens_out = getattr(response.usage_metadata, "candidates_token_count", None) or 0
    return payload, int(tokens_in), int(tokens_out)


def profile_book(md_path: Path, shamela_id: int, model_name: str, client: genai.Client | OpenAI) -> dict:
    """Call the configured LLM to profile a book. Returns a result dict."""
    slug, tier = BOOK_REGISTRY[shamela_id]
    meta = parse_metadata(md_path)
    sample = extract_content_sample(md_path)

    print(f"  Sending to LLM ({model_name}) [structural]…")
    structural_data, structural_tokens_in, structural_tokens_out = _call_profile_prompt(
        client=client,
        model_name=model_name,
        questions=STRUCTURAL_PROFILING_QUESTIONS,
        sample=sample,
    )

    print(f"  Sending to LLM ({model_name}) [contextual]…")
    contextual_data, contextual_tokens_in, contextual_tokens_out = _call_profile_prompt(
        client=client,
        model_name=model_name,
        questions=CONTEXTUAL_PROFILING_QUESTIONS,
        sample=sample,
    )

    profile_data = dict(PROFILE_DEFAULTS)
    if isinstance(structural_data, dict):
        profile_data.update(structural_data)
    if isinstance(contextual_data, dict):
        profile_data.update(contextual_data)

    # Merge with metadata we know statically
    profile_data["_meta"] = {
        "slug": slug,
        "tier": tier,
        "shamela_id": shamela_id,
        "book_title": meta.get("_title", ""),
        "author": meta.get("المؤلف (تفصيلًا)", meta.get("المؤلف", "")),
        "page_count": meta.get("عدد الصفحات", ""),
        "source_md": md_path.name,
        "profiled_at": datetime.now(timezone.utc).isoformat(),
        "model": model_name,
        "tokens_in": structural_tokens_in + contextual_tokens_in,
        "tokens_out": structural_tokens_out + contextual_tokens_out,
    }

    return profile_data


def save_profile(slug: str, data: dict) -> None:
    PROFILES_DIR.mkdir(exist_ok=True)
    profile_path(slug).write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    meta = data.get("_meta", {})
    tok_in = meta.get("tokens_in") or 0
    tok_out = meta.get("tokens_out") or 0
    print(
        f"  Saved: book_profiles/{slug}.json"
        f"  (tokens: {tok_in:,} in / {tok_out:,} out,"
        f"  est. cost: ${(tok_in * 0.30 + tok_out * 2.50) / 1_000_000:.4f})"
    )


# ── CLI commands ──────────────────────────────────────────────────────────────


def cmd_list(source_dir: Path) -> None:
    md_files = find_md_files(source_dir)
    print(f"\nSource: {source_dir}")
    print(f"Profiles dir: {PROFILES_DIR}\n")
    print(f"{'Status':<18} {'Tier':<22} {'Slug'}")
    print("-" * 80)
    for sid, (slug, tier) in sorted(BOOK_REGISTRY.items(), key=lambda x: x[1][1]):
        has_md = sid in md_files
        done = profile_done(slug)
        if done:
            status = "[done]    profiled"
        elif has_md:
            status = "[ready]   MD ready"
        else:
            status = "[missing] no MD file"
        print(f"  {status:<16} [{tier:<20}] {slug}")
    print()
    print(f"MD files found: {len(md_files)} / {len(BOOK_REGISTRY)}")
    done_count = sum(1 for _, (slug, _) in BOOK_REGISTRY.items() if profile_done(slug))
    print(f"Profiles done:  {done_count} / {len(BOOK_REGISTRY)}\n")


def cmd_profile_one(
    slug: str,
    model: str,
    client: genai.Client | OpenAI,
    force: bool,
    source_dir: Path,
) -> bool:
    # Resolve slug → shamela_id
    match = {sid: (s, t) for sid, (s, t) in BOOK_REGISTRY.items() if s == slug}
    if not match:
        print(f"ERROR: Unknown slug '{slug}'. Run 'python profile_books.py list' to see valid slugs.")
        sys.exit(1)
    sid = next(iter(match))

    if profile_done(slug) and not force:
        print(f"  Already profiled — skipping. (--force to re-run)")
        return False

    md_files = find_md_files(source_dir)
    if sid not in md_files:
        print(f"  No .md source file found for shamela ID {sid} in {source_dir}")
        return False

    md_path = md_files[sid]
    print(f"  Source: {md_path.name}")

    try:
        data = profile_book(md_path, sid, model, client)
        save_profile(slug, data)
        return True
    except Exception as exc:
        print(f"  ERROR: {exc}")
        return False


def cmd_profile_all(
    model: str,
    client: genai.Client | OpenAI,
    force: bool,
    tier: str | None,
    source_dir: Path,
) -> None:
    md_files = find_md_files(source_dir)
    candidates = [
        (sid, slug, t)
        for sid, (slug, t) in BOOK_REGISTRY.items()
        if sid in md_files and (tier is None or t == tier)
    ]

    if not candidates:
        msg = f"No books with .md files found"
        msg += f" (tier filter: {tier})" if tier else ""
        msg += f" in {source_dir}"
        print(msg)
        return

    ok = fail = skip = 0
    for sid, slug, t in candidates:
        print(f"\n{'─' * 60}")
        print(f"Book: {slug}  [{t}]")
        if profile_done(slug) and not force:
            skip += 1
            print("  Already profiled — skipping.")
            continue
        if cmd_profile_one(slug, model, client, force, source_dir):
            ok += 1
        else:
            fail += 1
        time.sleep(3)  # polite gap between API calls

    print(f"\n{'=' * 60}")
    print(f"Done:  {ok} profiled  |  {fail} failed  |  {skip} skipped\n")


# ── Main ──────────────────────────────────────────────────────────────────────


def main() -> None:
    load_env()
    provider = llm_provider()
    default_model = deepseek_settings()["model"] if provider == "deepseek" else gemini_settings()["model"]

    parser = argparse.ArgumentParser(
        description="Profile Shamela book .md files using LLM",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--source",
        metavar="DIR",
        default=str(DEFAULT_SOURCE_DIR),
        help="Directory containing the .md book files (default: %(default)s)",
    )
    sub = parser.add_subparsers(dest="cmd")

    # list
    sub.add_parser("list", help="Show all books and their profiling status")

    # profile
    prof = sub.add_parser("profile", help="Profile one or all books")
    grp = prof.add_mutually_exclusive_group(required=True)
    grp.add_argument("--book", metavar="SLUG", help="Profile a specific book by pipeline slug")
    grp.add_argument("--all", action="store_true", help="Profile all books that have a .md file")
    prof.add_argument("--tier", help="Limit --all to one tier (e.g. tier1_poc_core)")
    prof.add_argument(
        "--model",
        default=default_model,
        help=f"Model to use (default: {default_model})",
    )
    prof.add_argument("--force", action="store_true", help="Re-profile even if output already exists")

    args = parser.parse_args()

    if args.cmd is None:
        parser.print_help()
        return

    source_dir = Path(args.source)

    if args.cmd == "list":
        cmd_list(source_dir)
        return

    # profile command — needs provider-specific API key
    if provider == "deepseek":
        api_key = os.environ.get("DEEPSEEK_API_KEY")
        if not api_key:
            print("ERROR: Set DEEPSEEK_API_KEY in environment or .env before running.")
            sys.exit(1)
        client = OpenAI(api_key=api_key.strip(), base_url="https://api.deepseek.com")
    else:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            print("ERROR: Set GEMINI_API_KEY in environment or .env before running.")
            sys.exit(1)
        client = genai.Client(api_key=api_key.strip())

    if args.book:
        print(f"\nProfiling: {args.book}")
        cmd_profile_one(args.book, args.model, client, args.force, source_dir)
    else:
        cmd_profile_all(args.model, client, args.force, getattr(args, "tier", None), source_dir)


if __name__ == "__main__":
    main()
