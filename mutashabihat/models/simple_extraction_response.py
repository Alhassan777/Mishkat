from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class SimpleVerseRef(BaseModel):
    surah: int | None = None
    ayah: int | None = None
    text_snippet: str | None = None
    role: str | None = None
    relationship_direction: str | None = None
    wajh_label: str | None = None


class SimpleVerses(BaseModel):
    primary: SimpleVerseRef = Field(default_factory=SimpleVerseRef)
    related: list[SimpleVerseRef] = Field(default_factory=list)


class SimpleSource(BaseModel):
    book_id: str | None = None
    book_title_ar: str | None = None
    author_ar: str | None = None
    page_or_section: str | None = None
    raw_text_snippet: str | None = None


class SimpleRecord(BaseModel):
    id: str = "PIPELINE_ASSIGNED"
    category: str
    secondary_categories: list[str] = Field(default_factory=list)
    subcategory: str | None = None
    title_ar: str | None = None
    explanation_ar: str | None = None
    verses: SimpleVerses
    source: SimpleSource
    summary_ar: str | None = None
    summary_en: str | None = None
    summary_en_source: str | None = None
    confidence: float | None = None
    category_payload: dict[str, Any] = Field(default_factory=dict)


class SimpleExtractionResponse(BaseModel):
    records: list[SimpleRecord] = Field(default_factory=list)
