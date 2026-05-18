from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from .base_record import CategoryName

OrganizationType = Literal[
    "surah_sequential_numbered",
    "surah_sequential_prose",
    "alphabetical_by_term",
    "thematic_chapters",
    "treatise_freeform",
    "verse_by_verse_irab",
]

CitationFormat = Literal[
    "text_in_braces",
    "text_in_braces_named",
    "text_inline_no_delimiter",
    "number_reference_only",
    "mixed",
]

NumberingConvention = Literal["kufi", "madani", "mixed", "unknown"]


class BookProfileMeta(BaseModel):
    slug: str
    tier: str
    shamela_id: int
    book_title: str
    author: str
    page_count: str | None = None
    source_md: str
    profiled_at: datetime
    model: str
    tokens_in: int | None = None
    tokens_out: int | None = None


class BookProfile(BaseModel):
    organization_type: OrganizationType
    entry_delimiter: str
    verse_citation_format: CitationFormat
    # Canonical field: list of all resolution/opening markers used by the book.
    resolution_markers: list[str] = Field(default_factory=list)
    # Backward compatibility with older profile files.
    resolution_marker: str | None = None
    # Legacy field retained for backward compatibility.
    entry_size_estimate: str | None = None
    entry_count_estimate: int = 0
    primary_categories: list[int] = Field(default_factory=list)
    muqaddimah_summary: str | None = None
    methodology_note: str | None = None
    numbering_convention: NumberingConvention = "unknown"
    has_mnemonic_content: bool = False
    example_entries: list[str] = Field(default_factory=list)
    extraction_difficulty: str = "medium"
    question_markers: list[str] = Field(default_factory=list)
    multi_entry_window: bool = False
    profiler_notes: str | None = None
    meta: BookProfileMeta = Field(alias="_meta")

    model_config = {"populate_by_name": True}

    @field_validator("resolution_markers", "question_markers", mode="before")
    @classmethod
    def _coerce_marker_list(cls, value: object) -> list[str]:
        if value is None:
            return []
        if isinstance(value, str):
            cleaned = value.strip()
            return [cleaned] if cleaned else []
        if isinstance(value, list):
            return [str(v).strip() for v in value if str(v).strip()]
        return []

    @field_validator("numbering_convention", mode="before")
    @classmethod
    def _coerce_numbering_convention(cls, value: object) -> NumberingConvention:
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"kufi", "madani", "mixed", "unknown"}:
                return normalized  # type: ignore[return-value]
        return "unknown"

    @field_validator("has_mnemonic_content", mode="before")
    @classmethod
    def _coerce_has_mnemonic_content(cls, value: object) -> bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.strip().lower() in {"true", "1", "yes", "y"}
        if isinstance(value, (int, float)):
            return bool(value)
        return False

    def primary_category_name(self) -> CategoryName | None:
        mapping: dict[int, CategoryName] = {
            1: "lexical",
            2: "semantic",
            3: "thematic",
            4: "narrative",
            5: "structural",
            6: "cross_surah_refrain",
            7: "doctrinal",
        }
        if not self.primary_categories:
            return None
        return mapping.get(self.primary_categories[0])

    def model_post_init(self, __context: object) -> None:
        # Normalize legacy/new variants for markers.
        if isinstance(self.resolution_marker, str) and self.resolution_marker.strip():
            if self.resolution_marker not in self.resolution_markers:
                self.resolution_markers.append(self.resolution_marker)

