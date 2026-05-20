from __future__ import annotations

from typing import Literal

from pydantic import Field

from ._base import NullSafePayload


class ClaimSurface(NullSafePayload):
    ref: str = ""
    text_segment: str = ""
    surface_reading_ar: str | None = None
    surface_reading_en: str | None = None


class ApparentContradiction(NullSafePayload):
    claim_a: ClaimSurface = Field(default_factory=ClaimSurface)
    claim_b: ClaimSurface = Field(default_factory=ClaimSurface)
    tension_ar: str | None = None
    tension_en: str | None = None


class SupportingEvidence(NullSafePayload):
    type: Literal["hadith", "verse", "athar", "other"] = "other"
    text: str | None = None
    source: str | None = None
    ref: str | None = None
    note: str | None = None


class ScholarlyPosition(NullSafePayload):
    position: str = ""
    stance: str = ""
    key_scholars: list[str] = Field(default_factory=list)


class Reconciliation(NullSafePayload):
    method: str = ""
    method_ar: str | None = None
    explanation_ar: str = ""
    explanation_en: str | None = None
    supporting_evidence: list[SupportingEvidence] = Field(default_factory=list)
    scholarly_positions: list[ScholarlyPosition] = Field(default_factory=list)


class DoctrinalPayload(NullSafePayload):
    type: Literal["doctrinal"] = "doctrinal"
    theological_domain: str | None = None
    theological_domain_ar: str | None = None
    apparent_contradiction: ApparentContradiction = Field(default_factory=ApparentContradiction)
    reconciliation: Reconciliation = Field(default_factory=Reconciliation)
    reconciliation_method_type: str | None = None
    creedal_stakes: Literal["high", "medium", "low"] | None = None

