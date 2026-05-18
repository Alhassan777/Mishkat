from __future__ import annotations

from typing import Literal

from pydantic import Field

from ._base import NullSafePayload


class StoryInfo(NullSafePayload):
    label_ar: str = ""
    label_en: str | None = None
    prophet: str | None = None
    story_id: str | None = None
    story_id_source: Literal["extracted", "llm_generated"] | None = None


class NarrativeEpisode(NullSafePayload):
    surah: int | None = None
    verse_range: str | None = None
    surah_name: str | None = None
    episode_focus: str | None = None
    unique_details: list[str] = Field(default_factory=list)
    unique_details_en: list[str] = Field(default_factory=list)
    narrative_purpose_ar: str | None = None
    narrative_purpose_en: str | None = None
    rhetorical_context: str | None = None


class CrossEpisodeAnalysis(NullSafePayload):
    shared_elements: list[str] = Field(default_factory=list)
    varying_elements: list[str] = Field(default_factory=list)
    scholarly_note_ar: str | None = None
    scholarly_note_en: str | None = None


class NarrativePayload(NullSafePayload):
    type: Literal["narrative"] = "narrative"
    story: StoryInfo = Field(default_factory=StoryInfo)
    episodes: list[NarrativeEpisode] = Field(default_factory=list)
    cross_episode_analysis: CrossEpisodeAnalysis | None = None

