from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "output"
MERGED_DIR = OUTPUT_DIR / "merged"
TIMESTAMP_FMT = "%Y%m%dT%H%M%SZ"


@dataclass(frozen=True)
class JsonlFile:
    path: Path
    is_timestamp_run: bool
    timestamp: datetime
    modified_at: float


def parse_run_timestamp(path: Path, book_dir: Path) -> tuple[bool, datetime]:
    if path.parent == book_dir:
        return False, datetime.min
    try:
        return True, datetime.strptime(path.parent.name, TIMESTAMP_FMT)
    except ValueError:
        return False, datetime.min


def discover_jsonl_files(book_dir: Path) -> list[JsonlFile]:
    jsonl_files: list[JsonlFile] = []
    for path in book_dir.rglob("records.jsonl"):
        is_ts, ts = parse_run_timestamp(path, book_dir)
        jsonl_files.append(
            JsonlFile(
                path=path,
                is_timestamp_run=is_ts,
                timestamp=ts,
                modified_at=path.stat().st_mtime,
            )
        )

    jsonl_files.sort(
        key=lambda item: (
            0 if not item.is_timestamp_run else 1,
            item.timestamp,
            item.modified_at,
            str(item.path),
        )
    )
    return jsonl_files


def iter_book_dirs(base_output: Path) -> Iterable[Path]:
    for entry in sorted(base_output.iterdir(), key=lambda p: p.name):
        if entry.is_dir() and entry.name.startswith("book_"):
            yield entry


def merge_book_records(book_dir: Path) -> dict[str, int]:
    input_files = discover_jsonl_files(book_dir)
    merged_records: dict[str, dict] = {}
    total_input_records = 0
    invalid_json_lines = 0
    missing_id_records = 0

    for jsonl_file in input_files:
        with jsonl_file.path.open("r", encoding="utf-8") as handle:
            for line_number, line in enumerate(handle, start=1):
                raw = line.strip()
                if not raw:
                    continue
                total_input_records += 1
                try:
                    record = json.loads(raw)
                except json.JSONDecodeError:
                    invalid_json_lines += 1
                    print(
                        f"[warn] invalid JSON skipped: {jsonl_file.path} line {line_number}"
                    )
                    continue

                record_id = record.get("id")
                if not isinstance(record_id, str) or not record_id:
                    missing_id_records += 1
                    print(
                        f"[warn] missing/invalid id skipped: {jsonl_file.path} line {line_number}"
                    )
                    continue

                # Oldest-first processing means later runs override earlier duplicates.
                merged_records[record_id] = record

    MERGED_DIR.mkdir(parents=True, exist_ok=True)
    output_path = MERGED_DIR / f"{book_dir.name}.jsonl"
    with output_path.open("w", encoding="utf-8") as handle:
        for record_id in sorted(merged_records):
            handle.write(json.dumps(merged_records[record_id], ensure_ascii=False))
            handle.write("\n")

    unique_records = len(merged_records)
    duplicates_removed = max(
        0,
        total_input_records - unique_records - invalid_json_lines - missing_id_records,
    )

    return {
        "files": len(input_files),
        "total_input_records": total_input_records,
        "unique_records": unique_records,
        "duplicates_removed": duplicates_removed,
        "invalid_json_lines": invalid_json_lines,
        "missing_id_records": missing_id_records,
    }


def main() -> None:
    if not OUTPUT_DIR.exists():
        raise FileNotFoundError(f"Output directory not found: {OUTPUT_DIR}")

    print(f"Merging records from: {OUTPUT_DIR}")
    print(f"Writing merged files to: {MERGED_DIR}")
    print("")

    total_books = 0
    grand_total_input = 0
    grand_total_unique = 0
    grand_total_duplicates = 0

    for book_dir in iter_book_dirs(OUTPUT_DIR):
        stats = merge_book_records(book_dir)
        total_books += 1
        grand_total_input += stats["total_input_records"]
        grand_total_unique += stats["unique_records"]
        grand_total_duplicates += stats["duplicates_removed"]
        print(
            f"{book_dir.name}: "
            f"files={stats['files']} "
            f"input={stats['total_input_records']} "
            f"unique={stats['unique_records']} "
            f"duplicates_removed={stats['duplicates_removed']} "
            f"invalid_json={stats['invalid_json_lines']} "
            f"missing_id={stats['missing_id_records']}"
        )

    print("")
    print(
        f"Done. books={total_books} input={grand_total_input} "
        f"unique={grand_total_unique} duplicates_removed={grand_total_duplicates}"
    )


if __name__ == "__main__":
    main()
