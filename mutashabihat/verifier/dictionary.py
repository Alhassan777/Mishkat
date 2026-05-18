from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any
import requests

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS quran_verses (
    surah_no INTEGER NOT NULL,
    ayah_no_surah INTEGER NOT NULL,
    ayah_no_quran INTEGER,
    surah_name_ar TEXT,
    surah_name_en TEXT,
    ayah_ar TEXT,
    ayah_en TEXT,
    juz_no INTEGER,
    hizb_quarter INTEGER,
    PRIMARY KEY (surah_no, ayah_no_surah)
);
"""


def connect(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.execute(SCHEMA_SQL)
    conn.commit()
    return conn


def get_verse(conn: sqlite3.Connection, surah: int, ayah: int) -> dict[str, Any] | None:
    row = conn.execute(
        """SELECT surah_no, ayah_no_surah, ayah_no_quran, surah_name_ar, surah_name_en, ayah_ar, ayah_en, juz_no, hizb_quarter
        FROM quran_verses WHERE surah_no = ? AND ayah_no_surah = ?""",
        (surah, ayah),
    ).fetchone()
    if not row:
        return None
    return {
        "surah_no": row[0],
        "ayah_no_surah": row[1],
        "ayah_no_quran": row[2],
        "surah_name_ar": row[3],
        "surah_name_en": row[4],
        "ayah_ar": row[5],
        "ayah_en": row[6],
        "juz_no": row[7],
        "hizb_quarter": row[8],
    }


def get_all_verses(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = conn.execute(
        """SELECT surah_no, ayah_no_surah, ayah_no_quran, surah_name_ar, surah_name_en, ayah_ar, ayah_en, juz_no, hizb_quarter
        FROM quran_verses"""
    ).fetchall()
    return [
        {
            "surah_no": r[0],
            "ayah_no_surah": r[1],
            "ayah_no_quran": r[2],
            "surah_name_ar": r[3],
            "surah_name_en": r[4],
            "ayah_ar": r[5],
            "ayah_en": r[6],
            "juz_no": r[7],
            "hizb_quarter": r[8],
        }
        for r in rows
    ]


def load_from_hf_dataset(conn: sqlite3.Connection, dataset_name: str = "malekverse/quran-dataset") -> int:
    count = conn.execute("SELECT COUNT(*) FROM quran_verses").fetchone()[0]
    if count >= 6236:
        return count

    from datasets import load_dataset

    ds = load_dataset(dataset_name, split="train")
    rows = [
        (
            rec.get("surah_no"),
            rec.get("ayah_no_surah"),
            rec.get("ayah_no_quran"),
            rec.get("surah_name_ar"),
            rec.get("surah_name_en"),
            rec.get("ayah_ar"),
            rec.get("ayah_en"),
            rec.get("juz_no"),
            rec.get("hizb_quarter"),
        )
        for rec in ds
    ]
    conn.executemany(
        """INSERT OR REPLACE INTO quran_verses
        (surah_no, ayah_no_surah, ayah_no_quran, surah_name_ar, surah_name_en, ayah_ar, ayah_en, juz_no, hizb_quarter)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        rows,
    )
    conn.commit()
    return len(rows)


def load_from_alquran_cloud_api(conn: sqlite3.Connection) -> int:
    """
    Fallback loader using the free public API:
      https://api.alquran.cloud/v1/quran/quran-uthmani
    """
    url = "https://api.alquran.cloud/v1/quran/quran-uthmani"
    res = requests.get(url, timeout=60)
    res.raise_for_status()
    payload = res.json()
    surahs = payload.get("data", {}).get("surahs", [])
    rows = []
    for surah in surahs:
        surah_no = surah.get("number")
        surah_name_ar = surah.get("name")
        surah_name_en = surah.get("englishName")
        for ayah in surah.get("ayahs", []):
            rows.append(
                (
                    surah_no,
                    ayah.get("numberInSurah"),
                    ayah.get("number"),
                    surah_name_ar,
                    surah_name_en,
                    ayah.get("text"),
                    None,
                    ayah.get("juz"),
                    ayah.get("hizbQuarter"),
                )
            )

    conn.executemany(
        """INSERT OR REPLACE INTO quran_verses
        (surah_no, ayah_no_surah, ayah_no_quran, surah_name_ar, surah_name_en, ayah_ar, ayah_en, juz_no, hizb_quarter)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        rows,
    )
    conn.commit()
    return len(rows)

