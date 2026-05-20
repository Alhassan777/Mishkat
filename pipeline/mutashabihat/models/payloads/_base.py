from __future__ import annotations

from typing import get_type_hints

from pydantic import BaseModel, model_validator


class NullSafePayload(BaseModel):
    """Base for all payload models. Coerces None → [] for list fields
    so LLM-returned nulls don't cause Pydantic validation errors."""

    @model_validator(mode="before")
    @classmethod
    def _coerce_null_lists(cls, data: dict) -> dict:
        if not isinstance(data, dict):
            return data
        hints = get_type_hints(cls)
        for field_name, type_hint in hints.items():
            origin = getattr(type_hint, "__origin__", None)
            if origin is list and data.get(field_name) is None:
                data[field_name] = []
        return data
