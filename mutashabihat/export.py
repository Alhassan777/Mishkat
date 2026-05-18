"""Export pipeline for CSV and JSON-LD formats.

Reads assembled JSONL records and produces:
  - CSV (flat tabular format suitable for ML/NLP datasets)
  - JSON-LD (semantic web / linked data format with Quranic ontology context)
"""
from __future__ import annotations

import csv
import json
from io import StringIO
from pathlib import Path
from typing import Any

from ..models.verse_ref import NUMBERING_CONVENTION, TOTAL_VERSES

JSONLD_CONTEXT = {
    "@context": {
        "@vocab": "https://schema.org/",
        "quran": "https://quran.com/",
        "qac": "http://www.textminingthequran.com/wiki/",
        "dc": "http://purl.org/dc/elements/1.1/",
        "surah": "quran:surah",
        "ayah": "quran:ayah",
        "category": "dc:subject",
        "confidence": "schema:confidence",
        "author": "dc:creator",
        "bookTitle": "dc:source",
        "summary_ar": {"@id": "dc:description", "@language": "ar"},
        "summary_en": {"@id": "dc:description", "@language": "en"},
        "numbering_convention": "qac:numberingConvention",
    }
}


def _flatten_record(record: dict[str, Any]) -> dict[str, Any]:
    """Flatten a nested record dict into a single-level dict for CSV."""
    flat: dict[str, Any] = {
        "id": record.get("id"),
        "category": record.get("category"),
        "subcategory": record.get("subcategory"),
        "parent_discipline": record.get("parent_discipline"),
        "confidence": record.get("confidence"),
        "human_verified": record.get("human_verified", False),
        "extraction_model": record.get("extraction_model"),
        "extraction_date": record.get("extraction_date"),
        "summary_ar": record.get("summary_ar"),
        "summary_en": record.get("summary_en"),
    }

    source = record.get("source", {})
    flat["book_id"] = source.get("book_id")
    flat["book_title_ar"] = source.get("book_title_ar")
    flat["author_ar"] = source.get("author_ar")
    flat["page_or_section"] = source.get("page_or_section")

    verses = record.get("verses", {})
    primary = verses.get("primary", {})
    flat["primary_surah"] = primary.get("surah")
    flat["primary_ayah"] = primary.get("ayah")
    flat["primary_text_snippet"] = primary.get("text_snippet")

    related_list = verses.get("related", [])
    related_refs = []
    for rv in related_list:
        s, a = rv.get("surah"), rv.get("ayah")
        if s is not None and a is not None:
            related_refs.append(f"{s}:{a}")
    flat["related_verses"] = "|".join(related_refs)

    sec_cats = record.get("secondary_categories", [])
    flat["secondary_categories"] = "|".join(sec_cats) if sec_cats else ""

    pair_keys = record.get("pair_keys", [])
    flat["pair_keys"] = "|".join(pair_keys) if pair_keys else ""

    return flat


CSV_COLUMNS = [
    "id", "category", "subcategory", "parent_discipline",
    "primary_surah", "primary_ayah", "primary_text_snippet",
    "related_verses", "secondary_categories", "pair_keys",
    "confidence", "human_verified",
    "book_id", "book_title_ar", "author_ar", "page_or_section",
    "summary_ar", "summary_en",
    "extraction_model", "extraction_date",
]


def export_csv(records: list[dict[str, Any]], output_path: Path) -> Path:
    """Export records to CSV format."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS, extrasaction="ignore")
        writer.writeheader()
        for record in records:
            writer.writerow(_flatten_record(record))
    return output_path


def export_csv_string(records: list[dict[str, Any]]) -> str:
    """Export records to CSV as a string."""
    buf = StringIO()
    writer = csv.DictWriter(buf, fieldnames=CSV_COLUMNS, extrasaction="ignore")
    writer.writeheader()
    for record in records:
        writer.writerow(_flatten_record(record))
    return buf.getvalue()


def _record_to_jsonld(record: dict[str, Any]) -> dict[str, Any]:
    """Convert a single record to JSON-LD format."""
    source = record.get("source", {})
    verses = record.get("verses", {})
    primary = verses.get("primary", {})

    node: dict[str, Any] = {
        "@type": "CreativeWork",
        "@id": f"urn:mutashabihat:{record.get('id', '')}",
        "identifier": record.get("id"),
        "category": record.get("category"),
        "subcategory": record.get("subcategory"),
        "parent_discipline": record.get("parent_discipline"),
        "surah": primary.get("surah"),
        "ayah": primary.get("ayah"),
        "confidence": record.get("confidence"),
        "author": source.get("author_ar"),
        "bookTitle": source.get("book_title_ar"),
        "summary_ar": record.get("summary_ar"),
        "summary_en": record.get("summary_en"),
        "numbering_convention": NUMBERING_CONVENTION,
    }

    related = []
    for rv in verses.get("related", []):
        s, a = rv.get("surah"), rv.get("ayah")
        if s is not None and a is not None:
            related.append({
                "@type": "Thing",
                "surah": s,
                "ayah": a,
                "role": rv.get("role", "mutashabih"),
                "relationship_direction": rv.get("relationship_direction", "bidirectional"),
            })
    if related:
        node["relatedVerses"] = related

    return node


def export_jsonld(records: list[dict[str, Any]], output_path: Path) -> Path:
    """Export records to JSON-LD format."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    doc = {
        **JSONLD_CONTEXT,
        "@type": "Dataset",
        "name": "Mutashabihat al-Quran",
        "description": "Cross-referenced Quranic verse similarity records from classical Islamic scholarship",
        "numbering_convention": NUMBERING_CONVENTION,
        "total_verses": TOTAL_VERSES,
        "@graph": [_record_to_jsonld(r) for r in records],
    }
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
    return output_path


def export_jsonld_string(records: list[dict[str, Any]]) -> str:
    """Export records to JSON-LD as a string."""
    doc = {
        **JSONLD_CONTEXT,
        "@type": "Dataset",
        "name": "Mutashabihat al-Quran",
        "description": "Cross-referenced Quranic verse similarity records from classical Islamic scholarship",
        "numbering_convention": NUMBERING_CONVENTION,
        "total_verses": TOTAL_VERSES,
        "@graph": [_record_to_jsonld(r) for r in records],
    }
    return json.dumps(doc, ensure_ascii=False, indent=2)
