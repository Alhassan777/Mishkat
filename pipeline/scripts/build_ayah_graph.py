from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
MERGED_DIR = ROOT / "output" / "merged"
OUTPUT_PATH = ROOT / "output" / "ayah_graph.json"


def verse_key(surah: int, ayah: int) -> str:
    return f"{surah}:{ayah}"


def is_valid_verse_ref(obj: dict[str, Any] | None) -> bool:
    if not isinstance(obj, dict):
        return False
    return isinstance(obj.get("surah"), int) and isinstance(obj.get("ayah"), int)


def ensure_node(nodes: dict[str, Any], verse_obj: dict[str, Any]) -> str:
    surah = int(verse_obj["surah"])
    ayah = int(verse_obj["ayah"])
    key = verse_key(surah, ayah)
    node = nodes.setdefault(
        key,
        {
            "surah": surah,
            "ayah": ayah,
            "surah_name_ar": None,
            "surah_name_en": None,
            "text_uthmani": None,
            "text_snippet": None,
            "juz": None,
            "hizb_quarter": None,
            "ayah_no_quran": None,
            "connections": {},
        },
    )

    auto = verse_obj.get("_auto_filled") or {}
    if not node["surah_name_ar"] and auto.get("surah_name_ar"):
        node["surah_name_ar"] = auto["surah_name_ar"]
    if not node["surah_name_en"] and auto.get("surah_name_en"):
        node["surah_name_en"] = auto["surah_name_en"]
    if not node["text_uthmani"] and auto.get("text_uthmani_full"):
        node["text_uthmani"] = auto["text_uthmani_full"]
    if not node["text_snippet"] and verse_obj.get("text_snippet"):
        node["text_snippet"] = verse_obj["text_snippet"]
    if node["juz"] is None and auto.get("juz") is not None:
        node["juz"] = auto["juz"]
    if node["hizb_quarter"] is None and auto.get("hizb_quarter") is not None:
        node["hizb_quarter"] = auto["hizb_quarter"]
    if node["ayah_no_quran"] is None and auto.get("ayah_no_quran") is not None:
        node["ayah_no_quran"] = auto["ayah_no_quran"]

    return key


def add_edge(
    *,
    nodes: dict[str, Any],
    record: dict[str, Any],
    source_verse: dict[str, Any],
    target_verse: dict[str, Any],
    distributed_from_null_primary: bool,
    source_books: set[str],
) -> None:
    source_key = ensure_node(nodes, source_verse)
    target_key = ensure_node(nodes, target_verse)

    source_node = nodes[source_key]
    target_auto = (target_verse.get("_auto_filled") or {})
    conn = source_node["connections"].setdefault(
        target_key,
        {
            "target_surah": int(target_verse["surah"]),
            "target_ayah": int(target_verse["ayah"]),
            "target_text_uthmani": target_auto.get("text_uthmani_full"),
            "target_text_snippet": target_verse.get("text_snippet"),
            "opinions": [],
            "_opinion_ids": set(),
        },
    )

    record_id = str(record.get("id") or "")
    if not record_id or record_id in conn["_opinion_ids"]:
        return

    source = record.get("source") or {}
    book_title = source.get("book_title_ar")
    if isinstance(book_title, str) and book_title.strip():
        source_books.add(book_title.strip())

    opinion = {
        "record_id": record_id,
        "book_id": source.get("book_id"),
        "book_title_ar": source.get("book_title_ar"),
        "author_ar": source.get("author_ar"),
        "category": record.get("category"),
        "secondary_categories": record.get("secondary_categories") or [],
        "subcategory": record.get("subcategory"),
        "role": target_verse.get("role"),
        "relationship_direction": target_verse.get("relationship_direction"),
        "wajh_label": target_verse.get("wajh_label"),
        "summary_ar": record.get("summary_ar"),
        "summary_en": record.get("summary_en"),
        "confidence": record.get("confidence"),
        "source_page": source.get("page_or_section"),
        "distributed_from_null_primary": distributed_from_null_primary,
    }

    conn["opinions"].append(opinion)
    conn["_opinion_ids"].add(record_id)


def process_record(
    *,
    nodes: dict[str, Any],
    record: dict[str, Any],
    source_books: set[str],
) -> None:
    verses = record.get("verses") or {}
    primary = verses.get("primary")
    related = verses.get("related") or []

    valid_related = [r for r in related if is_valid_verse_ref(r)]

    if is_valid_verse_ref(primary):
        # Normal mode: primary -> each related
        for rel in valid_related:
            add_edge(
                nodes=nodes,
                record=record,
                source_verse=primary,
                target_verse=rel,
                distributed_from_null_primary=False,
                source_books=source_books,
            )

            if rel.get("relationship_direction") == "bidirectional":
                add_edge(
                    nodes=nodes,
                    record=record,
                    source_verse=rel,
                    target_verse=primary,
                    distributed_from_null_primary=False,
                    source_books=source_books,
                )
        return

    # Null-primary strategy: distribute over related verses using first related as hub.
    if len(valid_related) < 2:
        return

    hub = valid_related[0]
    for rel in valid_related[1:]:
        add_edge(
            nodes=nodes,
            record=record,
            source_verse=hub,
            target_verse=rel,
            distributed_from_null_primary=True,
            source_books=source_books,
        )

        if rel.get("relationship_direction") == "bidirectional":
            add_edge(
                nodes=nodes,
                record=record,
                source_verse=rel,
                target_verse=hub,
                distributed_from_null_primary=True,
                source_books=source_books,
            )


def build_graph() -> dict[str, Any]:
    if not MERGED_DIR.exists():
        raise FileNotFoundError(f"Merged directory not found: {MERGED_DIR}")

    nodes: dict[str, Any] = {}
    source_books: set[str] = set()
    total_records = 0

    for path in sorted(MERGED_DIR.glob("*.jsonl")):
        with path.open("r", encoding="utf-8") as fh:
            for raw_line in fh:
                line = raw_line.strip()
                if not line:
                    continue
                total_records += 1
                record = json.loads(line)
                process_record(nodes=nodes, record=record, source_books=source_books)

    total_edges = 0
    total_opinions = 0
    for node in nodes.values():
        total_edges += len(node["connections"])
        for conn in node["connections"].values():
            total_opinions += len(conn["opinions"])
            conn.pop("_opinion_ids", None)

    return {
        "meta": {
            "generated": datetime.now(timezone.utc).isoformat(),
            "total_records_processed": total_records,
            "total_nodes": len(nodes),
            "total_edges": total_edges,
            "total_opinions": total_opinions,
            "source_books": len(source_books),
        },
        "nodes": nodes,
    }


def main() -> None:
    graph = build_graph()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", encoding="utf-8") as fh:
        json.dump(graph, fh, ensure_ascii=False, indent=2)
    print(f"Wrote {OUTPUT_PATH}")
    print(
        "meta:",
        json.dumps(graph["meta"], ensure_ascii=False),
    )


if __name__ == "__main__":
    main()
