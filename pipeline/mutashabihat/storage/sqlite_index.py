from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS records (
    id TEXT PRIMARY KEY,
    book_id TEXT,
    category TEXT,
    subcategory TEXT,
    parent_discipline TEXT,
    primary_surah INTEGER,
    primary_ayah INTEGER,
    confidence REAL,
    human_verified INTEGER DEFAULT 0,
    extraction_model TEXT,
    extraction_date TEXT,
    payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS record_related_verses (
    record_id TEXT NOT NULL,
    related_surah INTEGER NOT NULL,
    related_ayah INTEGER NOT NULL,
    role TEXT,
    relationship_direction TEXT,
    FOREIGN KEY (record_id) REFERENCES records(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS record_secondary_categories (
    record_id TEXT NOT NULL,
    category TEXT NOT NULL,
    FOREIGN KEY (record_id) REFERENCES records(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS record_pair_keys (
    record_id TEXT NOT NULL,
    pair_key TEXT NOT NULL,
    FOREIGN KEY (record_id) REFERENCES records(id) ON DELETE CASCADE
);
"""

INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_records_book ON records(book_id);
CREATE INDEX IF NOT EXISTS idx_records_category ON records(category);
CREATE INDEX IF NOT EXISTS idx_records_discipline ON records(parent_discipline);
CREATE INDEX IF NOT EXISTS idx_records_surah ON records(primary_surah);
CREATE INDEX IF NOT EXISTS idx_records_ayah ON records(primary_surah, primary_ayah);
CREATE INDEX IF NOT EXISTS idx_records_confidence ON records(confidence);
CREATE INDEX IF NOT EXISTS idx_records_verified ON records(human_verified);
CREATE INDEX IF NOT EXISTS idx_records_model ON records(extraction_model);
CREATE INDEX IF NOT EXISTS idx_related_record ON record_related_verses(record_id);
CREATE INDEX IF NOT EXISTS idx_related_surah ON record_related_verses(related_surah);
CREATE INDEX IF NOT EXISTS idx_related_ayah ON record_related_verses(related_surah, related_ayah);
CREATE INDEX IF NOT EXISTS idx_sec_cat_record ON record_secondary_categories(record_id);
CREATE INDEX IF NOT EXISTS idx_sec_cat_category ON record_secondary_categories(category);
CREATE INDEX IF NOT EXISTS idx_pair_key ON record_pair_keys(pair_key);
CREATE INDEX IF NOT EXISTS idx_pair_record ON record_pair_keys(record_id);
"""


def connect(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.executescript(SCHEMA_SQL)
    conn.executescript(INDEX_SQL)
    conn.commit()
    return conn


def upsert_record(conn: sqlite3.Connection, record: dict[str, Any]) -> None:
    src = record.get("source", {})
    primary = record.get("verses", {}).get("primary", {})
    record_id = record.get("id")

    conn.execute(
        """INSERT OR REPLACE INTO records
        (id, book_id, category, subcategory, parent_discipline,
         primary_surah, primary_ayah, confidence, human_verified,
         extraction_model, extraction_date, payload_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            record_id,
            src.get("book_id"),
            record.get("category"),
            record.get("subcategory"),
            record.get("parent_discipline"),
            primary.get("surah"),
            primary.get("ayah"),
            record.get("confidence"),
            1 if record.get("human_verified") else 0,
            record.get("extraction_model"),
            record.get("extraction_date"),
            json.dumps(record, ensure_ascii=False),
        ),
    )

    conn.execute("DELETE FROM record_related_verses WHERE record_id = ?", (record_id,))
    for rv in record.get("verses", {}).get("related", []):
        if isinstance(rv, dict) and rv.get("surah") is not None:
            conn.execute(
                "INSERT INTO record_related_verses (record_id, related_surah, related_ayah, role, relationship_direction) VALUES (?, ?, ?, ?, ?)",
                (record_id, rv.get("surah"), rv.get("ayah"), rv.get("role"), rv.get("relationship_direction")),
            )

    conn.execute("DELETE FROM record_secondary_categories WHERE record_id = ?", (record_id,))
    for cat in record.get("secondary_categories", []):
        conn.execute(
            "INSERT INTO record_secondary_categories (record_id, category) VALUES (?, ?)",
            (record_id, cat),
        )

    conn.execute("DELETE FROM record_pair_keys WHERE record_id = ?", (record_id,))
    for pk in record.get("pair_keys", []):
        conn.execute(
            "INSERT INTO record_pair_keys (record_id, pair_key) VALUES (?, ?)",
            (record_id, pk),
        )

    conn.commit()
