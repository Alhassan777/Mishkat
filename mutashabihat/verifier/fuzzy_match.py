from __future__ import annotations

from difflib import SequenceMatcher
from typing import Any

from .dictionary import get_all_verses
from .normalizer import normalize_arabic

try:
    from rapidfuzz.fuzz import ratio as rf_ratio
except Exception:
    rf_ratio = None


def similarity_score(a: str, b: str) -> float:
    na = normalize_arabic(a)
    nb = normalize_arabic(b)
    if not na or not nb:
        return 0.0
    if rf_ratio is not None:
        return float(rf_ratio(na, nb)) / 100.0
    return SequenceMatcher(None, na, nb).ratio()


def verify_extracted_verse(extracted: dict[str, Any], dictionary_row: dict[str, Any] | None) -> dict[str, Any]:
    if dictionary_row is None:
        return {"status": "missing_reference", "score": 0.0, "auto_filled": None}
    score = similarity_score(extracted.get("text_snippet", ""), dictionary_row.get("ayah_ar", ""))
    auto = {
        "surah_name_ar": dictionary_row.get("surah_name_ar"),
        "surah_name_en": dictionary_row.get("surah_name_en"),
        "text_uthmani_full": dictionary_row.get("ayah_ar"),
        "juz": dictionary_row.get("juz_no"),
        "hizb_quarter": dictionary_row.get("hizb_quarter"),
        "ayah_no_quran": dictionary_row.get("ayah_no_quran"),
        "verification_score": score,
    }
    status = "accept" if score >= 0.85 else ("reject" if score < 0.5 else "review")
    return {"status": status, "score": score, "auto_filled": auto}


def infer_reference_from_snippet(conn: Any, snippet: str, min_score: float = 0.9) -> dict[str, Any] | None:
    best = None
    best_score = 0.0
    for row in get_all_verses(conn):
        score = similarity_score(snippet, row.get("ayah_ar", ""))
        if score > best_score:
            best_score = score
            best = row
    if best is None or best_score < min_score:
        return None
    return {"row": best, "score": best_score}

