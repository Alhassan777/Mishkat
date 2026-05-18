from __future__ import annotations

from typing import Literal

from pydantic import Field

from ._base import NullSafePayload


class RefrainOccurrence(NullSafePayload):
    ref: str = ""
    ending: str = ""
    attributes: list[str] | str = Field(default_factory=list)
    attributes_en: list[str] | str = Field(default_factory=list)
    context_ar: str | None = None
    context_en: str | None = None
    why_these_attributes_ar: str | None = None
    why_these_attributes_en: str | None = None


class CrossSurahRefrainPayload(NullSafePayload):
    type: Literal["cross_surah_refrain"] = "cross_surah_refrain"
    refrain_template: str = ""
    refrain_template_en: str | None = None
    occurrences: list[RefrainOccurrence] = Field(default_factory=list)
    pattern_analysis_ar: str | None = None
    pattern_analysis_en: str | None = None
    total_occurrences_in_quran: int | None = None
    detection_method: str | None = None

