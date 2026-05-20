"""Count chunks per book using the current chunking strategy and book profiles."""
import sys
import json
import re
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from pipeline.mutashabihat.pipeline.chunker import chunk_book
from pipeline.mutashabihat.models import BookProfile
from pipeline.mutashabihat.config import DEFAULT_SOURCE_DIR, BOOK_PROFILES_DIR
from pipeline.mutashabihat.registry import BOOK_REGISTRY


def find_source(slug: str, source_dir: Path):
    for md in sorted(source_dir.glob("*.md")):
        text = md.read_text(encoding="utf-8", errors="replace")
        m = re.search(r"\*\*رقم الكتاب:\*\*\s*(\d+)", text)
        if not m:
            m = re.search(r"^-\s*\*\*رقم الكتاب:\*\*\s*(\d+)", text, re.MULTILINE)
        if m:
            sid = int(m.group(1))
            if sid in BOOK_REGISTRY:
                s, _ = BOOK_REGISTRY[sid]
                if s == slug:
                    return md
    return None


def main():
    header = f"{'Slug':<50} {'Chunks':>8}"
    print(header)
    print("-" * 60)
    total_books = 0
    total_chunks = 0
    for sid, (slug, tier) in sorted(BOOK_REGISTRY.items(), key=lambda x: x[1][0]):
        profile_path = BOOK_PROFILES_DIR / f"{slug}.json"
        if not profile_path.exists():
            print(f"{slug:<50} {'NO PROFILE':>8}")
            continue
        profile = BookProfile.model_validate_json(profile_path.read_text(encoding="utf-8"))
        md = find_source(slug, DEFAULT_SOURCE_DIR)
        if not md:
            print(f"{slug:<50} {'NO SOURCE':>8}")
            continue
        chunks = chunk_book(md, profile)
        n = len(chunks)
        total_books += 1
        total_chunks += n
        print(f"{slug:<50} {n:>8}")

    print("-" * 60)
    print(f"{'TOTAL':<50} {total_chunks:>8} chunks across {total_books} books")


if __name__ == "__main__":
    main()
