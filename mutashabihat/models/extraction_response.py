from __future__ import annotations

from pydantic import BaseModel, Field

from .base_record import BaseRecord


class ExtractionResponse(BaseModel):
    records: list[BaseRecord] = Field(default_factory=list)

