from __future__ import annotations

from typing import Literal

from pydantic import Field

from ._base import NullSafePayload


class MeaningSense(NullSafePayload):
    meaning_ar: str = ""
    meaning_en: str | None = None
    verse_refs: list[str] = Field(default_factory=list)
    context_clue: str | None = None
    attributed_to: list[str] = Field(default_factory=list)


class TargetWord(NullSafePayload):
    text: str = ""
    root: str | None = None
    meanings: list[MeaningSense] = Field(default_factory=list)


class SemanticPayload(NullSafePayload):
    type: Literal["semantic"] = "semantic"
    semantic_direction: str = ""
    is_wujuh: bool = False
    target_word: TargetWord | None = None
    nazair_terms: list[str] = Field(default_factory=list)
    nazair_explanation_ar: str | None = None
    nazair_explanation_en: str | None = None
    disambiguation_method: str | None = None
    disambiguation_explanation_ar: str | None = None
    disambiguation_explanation_en: str | None = None
    wujuh_count: int | None = None
    wujuh_count_by_scholar: list[dict[str, int]] = Field(default_factory=list)
    source_classification: str | None = None

