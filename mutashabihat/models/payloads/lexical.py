from __future__ import annotations

from typing import Literal

from pydantic import Field

from ._base import NullSafePayload


class SharedSegment(NullSafePayload):
    text: str = ""
    word_count: int | None = None


class LexicalDifference(NullSafePayload):
    position: str | None = None
    in_primary: str = ""
    in_related: str = ""
    difference_type: Literal["substitution", "addition", "deletion", "reordering", "vowel_change", "particle_change"] = "substitution"
    roots_primary: list[str] = Field(default_factory=list)
    roots_related: list[str] = Field(default_factory=list)
    same_root: bool | None = None
    morphological_note: str | None = None


class LexicalPayload(NullSafePayload):
    type: Literal["lexical"] = "lexical"
    similarity_type: str = ""
    shared_segment: SharedSegment | None = None
    differences: list[LexicalDifference] = Field(default_factory=list)
    confusion_level: Literal["high", "medium", "low"] | None = None
    confusion_note_ar: str | None = None
    confusion_note_en: str | None = None
    scholarly_explanation_ar: str | None = None
    scholarly_explanation_en: str | None = None
    mnemonic_hint: str | None = None
    mnemonic_hint_source: Literal["extracted", "llm_generated"] | None = None

