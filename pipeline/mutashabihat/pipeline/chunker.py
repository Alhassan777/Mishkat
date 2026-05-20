from __future__ import annotations

from pathlib import Path
import re

from ..models import BookProfile


def get_content_body(md_path: Path) -> str:
    lines = md_path.read_text(encoding="utf-8", errors="replace").splitlines()
    sep_positions = [i for i, l in enumerate(lines[:250]) if l.strip() == "---"]
    toc_end = (sep_positions[-1] + 1) if sep_positions else 0
    return "\n".join(lines[toc_end:])


def _chunk_by_window(body: str, window_tokens: int = 600, overlap_tokens: int = 80) -> list[dict]:
    # Approximate tokenization by whitespace; this is stable and fast across Arabic sources.
    words = body.split()
    if not words:
        return [{"index": 0, "number": "0", "text": ""}]

    chunks: list[dict] = []
    step = max(window_tokens - overlap_tokens, 1)
    start = 0
    chunk_index = 0
    total = len(words)

    while start < total:
        end = min(start + window_tokens, total)
        text = " ".join(words[start:end]).strip()
        chunks.append(
            {
                "index": chunk_index,
                "number": str(chunk_index),
                "text": text,
                "start_token": start,
                "end_token": end,
            }
        )
        if end >= total:
            break
        start += step
        chunk_index += 1

    return chunks


def _split_by_delimiter(body: str, delimiter: str) -> list[str]:
    text = body.strip()
    if not text:
        return []

    delim = delimiter.strip()
    if not delim:
        return [text]

    # Keep delimiters in the split output so each entry starts with its marker.
    try:
        pattern = re.compile(f"((?:{delim}))", flags=re.MULTILINE)
    except re.error:
        pattern = re.compile(f"((?:{re.escape(delim)}))", flags=re.MULTILINE)

    parts = pattern.split(text)
    if len(parts) == 1:
        return [text]

    entries: list[str] = []
    first = parts[0].strip()
    if first:
        entries.append(first)

    for i in range(1, len(parts), 2):
        marker = parts[i]
        content = parts[i + 1] if i + 1 < len(parts) else ""
        entry = f"{marker}{content}".strip()
        if entry:
            entries.append(entry)

    return entries


def _group_entries(entries: list[str], group_size: int = 3, max_tokens: int = 600) -> list[dict]:
    if not entries:
        return [{"index": 0, "number": "0", "text": ""}]

    chunks: list[dict] = []

    for start in range(0, len(entries), max(group_size, 1)):
        group = entries[start : start + max(group_size, 1)]
        if not group:
            continue
        joined = "\n\n".join(group).strip()
        if not joined:
            continue

        entry_indices = list(range(start, start + len(group)))
        token_count = len(joined.split())

        if token_count <= max_tokens:
            chunk_index = len(chunks)
            chunks.append(
                {
                    "index": chunk_index,
                    "number": str(chunk_index),
                    "text": joined,
                    "entry_indices": entry_indices,
                }
            )
            continue

        subchunks = _chunk_by_window(joined, window_tokens=max_tokens, overlap_tokens=80)
        for sub in subchunks:
            chunk_index = len(chunks)
            chunks.append(
                {
                    "index": chunk_index,
                    "number": str(chunk_index),
                    "text": sub["text"],
                    "entry_indices": entry_indices,
                    "start_token": sub.get("start_token"),
                    "end_token": sub.get("end_token"),
                }
            )

    return chunks


def chunk_book(md_path: Path, profile: BookProfile) -> list[dict]:
    body = get_content_body(md_path)
    entries = _split_by_delimiter(body, profile.entry_delimiter)
    if len(entries) < 3:
        return _chunk_by_window(body, window_tokens=600, overlap_tokens=80)
    return _group_entries(entries, group_size=3, max_tokens=600)

