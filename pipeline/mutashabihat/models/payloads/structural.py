from __future__ import annotations

from typing import Literal

from pydantic import Field

from ._base import NullSafePayload


class ParsingOption(NullSafePayload):
    option: str = ""
    option_en: str | None = None
    meaning_impact: str | None = None
    grammatical_position: str | None = None
    governing_element: str | None = None
    case_ending: str | None = None
    proponents: list[str] = Field(default_factory=list)


class StructuralVerseAnalysis(NullSafePayload):
    ref: str | None = None
    text_segment: str = ""
    grammatical_issue_ar: str | None = None
    grammatical_issue_en: str | None = None
    parsing_options: list[ParsingOption] = Field(default_factory=list)
    preferred_parsing: str | None = None
    preferred_by: str | None = None


class ParallelStructure(NullSafePayload):
    pattern: str = ""
    other_examples: list[str] = Field(default_factory=list)


class BalaghahInfo(NullSafePayload):
    device_type: str | None = None
    classical_term_ar: str | None = None
    direction: str | None = None
    rhetorical_purpose_ar: str | None = None
    rhetorical_purpose_en: str | None = None
    affects_meaning: bool = False


class StructuralPayload(NullSafePayload):
    type: Literal["structural"] = "structural"
    structural_phenomenon: str | None = None
    verse_analyses: list[StructuralVerseAnalysis] = Field(default_factory=list)
    parallel_structures: list[ParallelStructure] = Field(default_factory=list)
    source_grammar_book: str | None = None
    balaghah: BalaghahInfo | None = None

