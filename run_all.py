#!/usr/bin/env python3
"""
Batch runner — profile all books then extract all books.

Safety guarantees:
  - Records are written one-by-one (append_jsonl); a crash loses at most 1 entry.
  - Already-profiled books are skipped (profile JSON exists).
  - Already-extracted entries are skipped (rec_id found in records.jsonl).
  - Each book's errors are logged to output/<slug>/run_log.json without crashing others.

Usage:
    python run_all.py                    # profile + extract all books
    python run_all.py --skip-profiling   # skip profiling, extract only
    python run_all.py --delay 2          # seconds between Gemini calls
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

PYTHON = sys.executable
PROJECT = Path(__file__).parent
PROFILES_DIR = PROJECT / "book_profiles"

from mutashabihat.registry import BOOK_REGISTRY
from mutashabihat.config import OUTPUT_DIR, DEFAULT_SOURCE_DIR


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _atomic_write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


def _count_records(records_path: Path) -> int:
    if not records_path.exists():
        return 0
    return sum(1 for _ in records_path.open(encoding="utf-8"))


class PipelineCheckpoint:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.data: dict = {"updated_at": _utc_now_iso(), "books": {}}

    @classmethod
    def load(cls, path: Path) -> "PipelineCheckpoint":
        checkpoint = cls(path)
        if not path.exists():
            checkpoint.save()
            return checkpoint
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            checkpoint.save()
            return checkpoint
        if isinstance(payload, dict):
            checkpoint.data["updated_at"] = payload.get("updated_at") or _utc_now_iso()
            checkpoint.data["books"] = payload.get("books") if isinstance(payload.get("books"), dict) else {}
        return checkpoint

    def save(self) -> None:
        self.data["updated_at"] = _utc_now_iso()
        _atomic_write_json(self.path, self.data)

    def _book_entry(self, slug: str) -> dict:
        books = self.data.setdefault("books", {})
        entry = books.get(slug)
        if not isinstance(entry, dict):
            entry = {
                "profiled": False,
                "extraction_status": "pending",
                "records_count": 0,
                "progress_pct": 0.0,
                "updated_at": _utc_now_iso(),
            }
            books[slug] = entry
        return entry

    def mark_profiled(self, slug: str, profiled: bool) -> None:
        entry = self._book_entry(slug)
        entry["profiled"] = bool(profiled)
        entry["updated_at"] = _utc_now_iso()
        self.save()

    def refresh_book_from_files(self, slug: str) -> None:
        entry = self._book_entry(slug)
        out_dir = OUTPUT_DIR / slug
        state_path = out_dir / "extraction_state.json"
        records_path = out_dir / "records.jsonl"

        if state_path.exists():
            try:
                state = json.loads(state_path.read_text(encoding="utf-8"))
            except Exception:
                state = {}
            entry["extraction_status"] = state.get("status", entry.get("extraction_status", "pending"))
            entry["records_count"] = int(state.get("records_written") or _count_records(records_path))
            entry["progress_pct"] = float(state.get("progress_pct") or 0.0)
            if state.get("finished_at"):
                entry["completed_at"] = state["finished_at"]
            elif entry.get("extraction_status") != "completed":
                entry.pop("completed_at", None)
            entry["updated_at"] = _utc_now_iso()
        else:
            # Backward compatibility for old runs with only records.jsonl/run_log.json.
            records = _count_records(records_path)
            entry["records_count"] = records
            if records > 0 and entry.get("extraction_status") == "pending":
                entry["extraction_status"] = "unknown"
            entry["progress_pct"] = 0.0
            entry["updated_at"] = _utc_now_iso()

    def should_skip_extraction(self, slug: str, retry_failed: bool) -> bool:
        self.refresh_book_from_files(slug)
        entry = self._book_entry(slug)
        status = str(entry.get("extraction_status", "pending"))
        if status == "completed":
            return True
        if retry_failed:
            return False
        return status in {"in_progress", "failed"}

    def mark_extraction_result(self, slug: str, return_code: int) -> None:
        self.refresh_book_from_files(slug)
        entry = self._book_entry(slug)
        if return_code != 0 and entry.get("extraction_status") == "completed":
            entry["extraction_status"] = "failed"
        elif return_code != 0 and entry.get("extraction_status") not in {"failed", "in_progress"}:
            entry["extraction_status"] = "failed"
        entry["updated_at"] = _utc_now_iso()
        self.save()


def _load_api_key() -> str:
    env_text = (PROJECT / ".env").read_text(encoding="utf-8", errors="ignore")
    m = re.search(r"^GEMINI_API_KEY=(.+)$", env_text, re.MULTILINE)
    if not m:
        raise RuntimeError("GEMINI_API_KEY not found in .env")
    return m.group(1).strip()


def run_cmd(args: list[str], api_key: str) -> int:
    """Run a subprocess command with the API key injected into the environment."""
    # Load model from .env directly so it always overrides the parent environment
    env_text = (PROJECT / ".env").read_text(encoding="utf-8", errors="ignore")
    model_match = re.search(r"^GEMINI_MODEL=(.+)$", env_text, re.MULTILINE)
    model = model_match.group(1).strip() if model_match else "gemini-2.5-flash"
    env = {**os.environ, "GEMINI_API_KEY": api_key, "GEMINI_MODEL": model, "PYTHONIOENCODING": "utf-8"}
    proc = subprocess.run(args, cwd=str(PROJECT), env=env)
    return proc.returncode


def profile_missing(source_dir: Path, delay: float, api_key: str, checkpoint: PipelineCheckpoint) -> None:
    slugs_missing = [
        slug for _sid, (slug, _tier) in BOOK_REGISTRY.items()
        if not (PROFILES_DIR / f"{slug}.json").exists()
    ]
    if not slugs_missing:
        print("\n[profiler] All books already profiled. Skipping.\n")
        return

    print(f"\n[profiler] Need to profile {len(slugs_missing)} books: {slugs_missing}\n")
    for slug in slugs_missing:
        print(f"\n{'='*60}\n[profiler] Profiling: {slug}\n{'='*60}")
        ret = run_cmd([
            PYTHON, "profile_books.py",
            "--source", str(source_dir),
            "profile",
            "--book", slug,
        ], api_key)
        checkpoint.mark_profiled(slug, ret == 0 and (PROFILES_DIR / f"{slug}.json").exists())
        time.sleep(delay)


def extract_all(source_dir: Path, delay: float, api_key: str, checkpoint: PipelineCheckpoint, retry_failed: bool) -> None:
    slugs = [slug for _sid, (slug, _tier) in BOOK_REGISTRY.items()]
    print(f"\n[extractor] Will extract {len(slugs)} books.\n")

    for i, slug in enumerate(slugs, 1):
        profile_path = PROFILES_DIR / f"{slug}.json"
        if not profile_path.exists():
            print(f"[extractor] SKIP {slug} — no profile found")
            continue

        out_dir = OUTPUT_DIR / slug
        records_path = out_dir / "records.jsonl"
        checkpoint.mark_profiled(slug, profile_path.exists())
        if checkpoint.should_skip_extraction(slug, retry_failed=retry_failed):
            print(f"[extractor] SKIP {slug} — checkpoint status blocks run (use --retry-failed)")
            continue

        # Count already-done entries for resume display
        done = _count_records(records_path)

        print(f"\n{'='*60}")
        print(f"[extractor] {i}/{len(slugs)}: {slug} (already done: {done})")
        print(f"{'='*60}")

        ret = run_cmd([
            PYTHON, "-m", "cli.extract",
            "--book", slug,
            "--source", str(source_dir),
            "--delay", str(delay),
            # No --force: skips already-extracted entries automatically
        ], api_key)
        checkpoint.mark_extraction_result(slug, ret)


def print_status(checkpoint: PipelineCheckpoint) -> None:
    print(f"\nCheckpoint: {checkpoint.path}")
    print(f"Updated at: {checkpoint.data.get('updated_at')}\n")
    print(f"{'Slug':<40} {'Profiled':<10} {'Status':<14} {'Records':<8} {'Progress':<10}")
    print("-" * 90)
    for _sid, (slug, _tier) in BOOK_REGISTRY.items():
        checkpoint.refresh_book_from_files(slug)
        entry = checkpoint.data.get("books", {}).get(slug, {})
        profiled = "yes" if entry.get("profiled") else "no"
        status = str(entry.get("extraction_status", "pending"))
        records = int(entry.get("records_count") or 0)
        progress = f"{float(entry.get('progress_pct') or 0.0):.2f}%"
        print(f"{slug:<40} {profiled:<10} {status:<14} {records:<8} {progress:<10}")
    print()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-profiling", action="store_true",
                        help="Skip profiling step, go straight to extraction")
    parser.add_argument("--retry-failed", action="store_true",
                        help="Retry books marked in-progress/failed by checkpoint")
    parser.add_argument("--status", action="store_true",
                        help="Show checkpoint status and exit")
    parser.add_argument("--source", default=str(DEFAULT_SOURCE_DIR),
                        help="Path to folder with .md source files")
    parser.add_argument("--delay", type=float, default=1.5,
                        help="Seconds between Gemini API calls (default 1.5)")
    args = parser.parse_args()

    source_dir = Path(args.source)
    if not source_dir.exists():
        print(f"ERROR: Source dir not found: {source_dir}")
        sys.exit(1)

    env_file = PROJECT / ".env"
    if not env_file.exists() or "GEMINI_API_KEY" not in env_file.read_text(encoding="utf-8", errors="ignore"):
        print("ERROR: GEMINI_API_KEY not set in .env")
        sys.exit(1)

    print(f"\nSource: {source_dir}")
    print(f"Delay: {args.delay}s between calls")
    print(f"Books in registry: {len(BOOK_REGISTRY)}")

    api_key = _load_api_key()
    print(f"API key loaded (ends with ...{api_key[-4:]})")
    checkpoint = PipelineCheckpoint.load(OUTPUT_DIR / "pipeline_checkpoint.json")

    if args.status:
        print_status(checkpoint)
        return

    if not args.skip_profiling:
        profile_missing(source_dir, args.delay, api_key, checkpoint)

    extract_all(source_dir, args.delay, api_key, checkpoint, retry_failed=args.retry_failed)

    print("\n\nAll done!")


if __name__ == "__main__":
    main()
