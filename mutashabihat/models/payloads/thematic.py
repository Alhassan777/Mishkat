from __future__ import annotations

from typing import Literal

from pydantic import Field

from ._base import NullSafePayload


class ThemeInfo(NullSafePayload):
    label_ar: str = ""
    label_en: str | None = None
    domain: str | None = None
    ontology_path: list[str] = Field(default_factory=list)
    ontology_path_source: Literal["extracted", "llm_generated"] | None = None


class ThematicVerseItem(NullSafePayload):
    ref: str = ""
    angle: str | None = None
    angle_ar: str | None = None
    emphasis: str | None = None


class ThematicPayload(NullSafePayload):
    type: Literal["thematic"] = "thematic"
    theme: ThemeInfo = Field(default_factory=ThemeInfo)
    verse_cluster: list[ThematicVerseItem] = Field(default_factory=list)
    synthesis_ar: str | None = None
    synthesis_en: str | None = None
    related_themes: list[str] = Field(default_factory=list)

