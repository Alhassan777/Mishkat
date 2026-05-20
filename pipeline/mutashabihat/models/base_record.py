from __future__ import annotations

from datetime import date
from typing import Annotated, Any, Literal, Union

from pydantic import BaseModel, Discriminator, Field, Tag

from .verse_ref import VerseBundle
from .payloads import (
    CrossSurahRefrainPayload,
    DoctrinalPayload,
    LexicalPayload,
    NarrativePayload,
    SemanticPayload,
    StructuralPayload,
    ThematicPayload,
)

CategoryName = Literal[
    "lexical",
    "semantic",
    "thematic",
    "narrative",
    "structural",
    "cross_surah_refrain",
    "doctrinal",
]

GeneratedFieldSource = Literal["extracted", "llm_generated"]

ParentDiscipline = Literal[
    "mutashabih_alfaz",
    "mutashabih_maani",
    "wujuh_nazair",
    "mushkil_quran",
    "modern_analysis",
]

CATEGORY_TO_DISCIPLINE: dict[str, ParentDiscipline] = {
    "lexical": "mutashabih_alfaz",
    "structural": "mutashabih_alfaz",
    "semantic": "mutashabih_maani",
    "thematic": "mutashabih_maani",
    "narrative": "mutashabih_maani",
    "doctrinal": "mushkil_quran",
    "cross_surah_refrain": "mutashabih_alfaz",
}

DISCIPLINE_LABELS: dict[str, dict[str, str]] = {
    "mutashabih_alfaz": {"ar": "متشابه الألفاظ", "en": "Similar Wording"},
    "mutashabih_maani": {"ar": "متشابه المعاني", "en": "Similar Meanings"},
    "wujuh_nazair": {"ar": "الوجوه والنظائر", "en": "Polysemy (Wujuh wa Nazair)"},
    "mushkil_quran": {"ar": "مشكل القرآن", "en": "Apparent Contradictions (Mushkil)"},
    "modern_analysis": {"ar": "تحليل حديث", "en": "Modern Analysis"},
}


def resolve_discipline(category: str, payload: dict[str, Any] | None = None) -> ParentDiscipline:
    if category == "semantic" and isinstance(payload, dict) and payload.get("is_wujuh") is True:
        return "wujuh_nazair"
    return CATEGORY_TO_DISCIPLINE.get(category, "modern_analysis")


CategoryPayloadType = Annotated[
    Union[
        Annotated[LexicalPayload, Tag("lexical")],
        Annotated[SemanticPayload, Tag("semantic")],
        Annotated[ThematicPayload, Tag("thematic")],
        Annotated[NarrativePayload, Tag("narrative")],
        Annotated[StructuralPayload, Tag("structural")],
        Annotated[CrossSurahRefrainPayload, Tag("cross_surah_refrain")],
        Annotated[DoctrinalPayload, Tag("doctrinal")],
    ],
    Discriminator("type"),
]


class SourceInfo(BaseModel):
    book_id: str = ""
    book_title_ar: str = ""
    author_ar: str = ""
    page_or_section: str | None = None
    raw_text_snippet: str = ""


class BaseRecord(BaseModel):
    id: str
    category: CategoryName
    secondary_categories: list[CategoryName] = Field(default_factory=list)
    subcategory: str | None = None
    title_ar: str | None = None
    explanation_ar: str | None = None
    parent_discipline: ParentDiscipline | None = None
    pair_keys: list[str] = Field(default_factory=list)
    verse_pair_id: str | None = None
    verses: VerseBundle
    source: SourceInfo
    summary_ar: str | None = None
    summary_en: str | None = None
    summary_en_source: GeneratedFieldSource | None = None
    confidence: float | None = None
    theological_notes: list[str] = Field(default_factory=list)
    extraction_model: str | None = None
    extraction_date: date | None = None
    human_verified: bool = False
    fidelity_flags: list[str] = Field(default_factory=list)
    category_payload: CategoryPayloadType

