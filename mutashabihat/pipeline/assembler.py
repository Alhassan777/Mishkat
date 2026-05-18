from __future__ import annotations

from datetime import date
import re
from typing import Any

from pydantic import BaseModel

from ..models import BaseRecord
from ..models.base_record import resolve_discipline
from ..models.verse_ref import validate_verse_ref
from ..models.payloads import (
    CrossSurahRefrainPayload,
    DoctrinalPayload,
    LexicalPayload,
    NarrativePayload,
    SemanticPayload,
    StructuralPayload,
    ThematicPayload,
)

PAYLOAD_MODELS: dict[str, type[BaseModel]] = {
    "lexical": LexicalPayload,
    "semantic": SemanticPayload,
    "thematic": ThematicPayload,
    "narrative": NarrativePayload,
    "structural": StructuralPayload,
    "cross_surah_refrain": CrossSurahRefrainPayload,
    "doctrinal": DoctrinalPayload,
}


def _normalize_confidence(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        s = value.strip().lower()
        mapping = {"high": 0.9, "medium": 0.7, "low": 0.4}
        if s in mapping:
            return mapping[s]
        try:
            return float(s)
        except ValueError:
            return None
    return None


def _normalize_extraction_date(value: Any) -> str:
    if value is None:
        return date.today().isoformat()
    if isinstance(value, str):
        # Accept full datetime strings like 2024-07-29T12:00:00.000Z
        if "T" in value:
            return value.split("T", 1)[0]
        return value
    return date.today().isoformat()


def _normalize_cross_surah_payload(payload: dict[str, Any]) -> dict[str, Any]:
    occurrences = payload.get("occurrences")
    if not isinstance(occurrences, list):
        return payload
    fixed: list[dict[str, Any]] = []
    for item in occurrences:
        if not isinstance(item, dict):
            continue
        obj = dict(item)
        if "ref" not in obj:
            surah = obj.get("surah")
            ayah = obj.get("ayah")
            ayahs = obj.get("ayahs")
            if surah is not None and ayah is not None:
                obj["ref"] = f"{surah}:{ayah}"
            elif surah is not None and isinstance(ayahs, list) and ayahs:
                obj["ref"] = f"{surah}:{ayahs[0]}"
            else:
                obj["ref"] = "unknown"
        if "ending" not in obj:
            obj["ending"] = obj.get("text") or obj.get("text_snippet") or obj.get("context_ar") or "unknown"
        # LLM sometimes returns ending as a list — join it
        if isinstance(obj.get("ending"), list):
            obj["ending"] = " | ".join(str(x) for x in obj["ending"]) or "unknown"
        fixed.append(obj)
    payload["occurrences"] = fixed
    return payload


VALID_CATEGORIES = set(PAYLOAD_MODELS.keys())
VALID_ROLES = {"mutashabih", "clarifying", "supporting", "contextual"}
VALID_DIRECTIONS = {"bidirectional", "directed", "group"}


def _coerce_strings(data: dict[str, Any]) -> dict[str, Any]:
    """Force fields that must be strings/valid literals; fix LLM type mistakes."""
    if "id" in data and not isinstance(data["id"], str):
        data["id"] = str(data["id"])
    src = data.get("source")
    if isinstance(src, dict) and "book_id" in src and not isinstance(src["book_id"], str):
        src["book_id"] = str(src["book_id"])
    verses = data.get("verses")
    if isinstance(verses, dict):
        # LLM sometimes wraps primary in a single-element list
        primary = verses.get("primary")
        if isinstance(primary, list) and primary:
            verses["primary"] = primary[0]
        # Coerce invalid role/relationship_direction in related verses
        for rv in verses.get("related") or []:
            if isinstance(rv, dict):
                original_role = rv.get("role")
                if original_role not in VALID_ROLES:
                    rv["role"] = "contextual"
                # role_inferred=False only when LLM actively chose a non-default role
                if rv.get("role_inferred") is None:
                    rv["role_inferred"] = rv.get("role", "mutashabih") == "mutashabih"
                if rv.get("relationship_direction") not in VALID_DIRECTIONS:
                    rv["relationship_direction"] = "bidirectional"
    # Drop invalid secondary_categories (LLM invents names like "repetition")
    sec = data.get("secondary_categories")
    if isinstance(sec, list):
        data["secondary_categories"] = [c for c in sec if c in VALID_CATEGORIES]
    return data


def _coerce_payload(category: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Add missing required fields the LLM sometimes omits."""
    if category == "lexical":
        payload.setdefault("similarity_type", "partial_verbal_match")
        if payload.get("mnemonic_hint") and payload.get("mnemonic_hint_source") is None:
            payload["mnemonic_hint_source"] = "llm_generated"
    if category == "thematic":
        theme = payload.get("theme")
        if isinstance(theme, dict) and theme.get("ontology_path") and theme.get("ontology_path_source") is None:
            theme["ontology_path_source"] = "llm_generated"
    if category == "narrative":
        story = payload.get("story")
        if isinstance(story, dict) and story.get("story_id") and story.get("story_id_source") is None:
            story["story_id_source"] = "llm_generated"
    if category == "structural":
        note_ar = payload.pop("balaghah_note_ar", None)
        note_en = payload.pop("balaghah_note_en", None)
        if (note_ar or note_en) and not isinstance(payload.get("balaghah"), dict):
            payload["balaghah"] = {
                "device_type": None,
                "classical_term_ar": None,
                "direction": None,
                "rhetorical_purpose_ar": note_ar,
                "rhetorical_purpose_en": note_en,
                "affects_meaning": False,
            }
    return payload


def compute_pair_key(
    primary_surah: int, primary_ayah: int, related_surah: int, related_ayah: int,
    category: str = "",
    relationship_direction: str = "bidirectional",
) -> str:
    a = f"{primary_surah}:{primary_ayah}"
    b = f"{related_surah}:{related_ayah}"
    if relationship_direction == "directed":
        verses_part = f"{a}>{b}"
    else:
        verses_part = "|".join(sorted([a, b]))
    if category:
        return f"{category}::{verses_part}"
    return verses_part


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip())


def _token_overlap_ratio(snippet: str, source_window: str) -> float:
    snippet_tokens = [t for t in re.split(r"\s+", snippet) if t]
    source_tokens = set(t for t in re.split(r"\s+", source_window) if t)
    if not snippet_tokens:
        return 0.0
    hits = sum(1 for token in snippet_tokens if token in source_tokens)
    return hits / len(snippet_tokens)


def _verify_raw_snippet_overlap(data: dict[str, Any], source_window: str | None) -> None:
    if not source_window:
        return
    source = data.get("source")
    if not isinstance(source, dict):
        return
    raw_snippet = source.get("raw_text_snippet")
    if not isinstance(raw_snippet, str) or not raw_snippet.strip():
        return
    normalized_window = _normalize_text(source_window)
    normalized_snippet = _normalize_text(raw_snippet)
    if normalized_snippet in normalized_window:
        return
    overlap = _token_overlap_ratio(normalized_snippet, normalized_window)
    if overlap < 0.3:
        raise ValueError(
            "raw_text_snippet does not sufficiently overlap with source chunk "
            f"(overlap={overlap:.2f})"
        )


def assemble_record(
    raw: dict[str, Any], *, fallback_category: str, fallback_id: str, model_name: str, source_window: str | None = None
) -> BaseRecord:
    data = _coerce_strings(dict(raw))
    data["id"] = fallback_id  # always use chunk-based ID so the checkpoint can find it
    data.setdefault("category", fallback_category)

    src = data.get("source")
    if not isinstance(src, dict):
        data["source"] = {"book_id": "", "book_title_ar": "", "author_ar": "", "raw_text_snippet": ""}
    else:
        src.setdefault("raw_text_snippet", "")
        src.setdefault("book_id", "")
        src.setdefault("book_title_ar", "")
        src.setdefault("author_ar", "")

    verses = data.get("verses")
    if not isinstance(verses, dict):
        data["verses"] = {"primary": {"surah": None, "ayah": None, "text_snippet": ""}, "related": []}
    else:
        if not isinstance(verses.get("primary"), dict):
            verses["primary"] = {"surah": None, "ayah": None, "text_snippet": ""}
        verses.setdefault("related", [])

    data.setdefault("secondary_categories", [])
    data.setdefault("subcategory", None)
    data.setdefault("summary_ar", None)
    data.setdefault("summary_en", None)
    data.setdefault("summary_en_source", None)
    data.setdefault("confidence", None)
    data.setdefault("theological_notes", [])
    data.setdefault("verse_pair_id", None)
    data.setdefault("human_verified", False)
    data["extraction_model"] = model_name  # always overwrite — LLM output must not dictate this
    data.setdefault("extraction_date", date.today().isoformat())
    data["confidence"] = _normalize_confidence(data.get("confidence"))
    if data.get("summary_en") and data.get("summary_en_source") is None:
        data["summary_en_source"] = "llm_generated"
    data["extraction_date"] = _normalize_extraction_date(data.get("extraction_date"))
    payload = data.get("category_payload", {})
    if not isinstance(payload, dict):
        payload = {}
    payload_type = payload.get("type")
    if isinstance(payload_type, str) and payload_type in PAYLOAD_MODELS:
        data["category"] = payload_type

    if data.get("category") == "cross_surah_refrain":
        payload = _normalize_cross_surah_payload(payload)

    payload = _coerce_payload(data.get("category", ""), payload)
    payload["type"] = data["category"]
    model_cls = PAYLOAD_MODELS.get(data["category"])
    if model_cls is not None:
        data["category_payload"] = model_cls.model_validate(payload).model_dump()
    else:
        data["category_payload"] = payload

    data["parent_discipline"] = resolve_discipline(data["category"], data["category_payload"])

    pair_keys: list[str] = []
    verse_pair_id: str | None = None
    record_category = data.get("category", "")
    verses = data.get("verses")
    if isinstance(verses, dict):
        related_list = verses.get("related") or []
        if isinstance(related_list, list):
            verses["related"] = [
                rv for rv in related_list
                if isinstance(rv, dict)
                and rv.get("surah") is not None
                and rv.get("ayah") is not None
                and validate_verse_ref(rv.get("surah"), rv.get("ayah"))
            ]
        primary = verses.get("primary", {})
        p_surah = primary.get("surah")
        p_ayah = primary.get("ayah")
        if p_surah is not None and p_ayah is not None:
            for rv in verses.get("related") or []:
                if isinstance(rv, dict):
                    r_surah = rv.get("surah")
                    r_ayah = rv.get("ayah")
                    if r_surah is not None and r_ayah is not None:
                        relationship_direction = str(rv.get("relationship_direction") or "bidirectional")
                        if verse_pair_id is None:
                            verse_pair_id = compute_pair_key(
                                p_surah, p_ayah, r_surah, r_ayah, relationship_direction=relationship_direction
                            )
                        pair_keys.append(compute_pair_key(
                            p_surah, p_ayah, r_surah, r_ayah,
                            category=record_category,
                            relationship_direction=relationship_direction,
                        ))
    data["pair_keys"] = pair_keys
    data["verse_pair_id"] = verse_pair_id
    _verify_raw_snippet_overlap(data, source_window)

    return BaseRecord.model_validate(data)

