"""Generate JSON Schema from Pydantic models for TypeScript validation.

Run: python -m mutashabihat.generate_schema
Outputs: frontend/src/data/schema.json

This provides a single source of truth that the TypeScript frontend can
validate against, preventing model drift between Python and TypeScript.
"""
from __future__ import annotations

import json
from pathlib import Path

from .models.base_record import BaseRecord


FRONTEND_SCHEMA_PATH = Path(__file__).resolve().parent.parent / "frontend" / "src" / "data" / "schema.json"


def generate() -> dict:
    """Generate JSON Schema from BaseRecord Pydantic model."""
    schema = BaseRecord.model_json_schema()
    schema["$schema"] = "https://json-schema.org/draft/2020-12/schema"
    schema["title"] = "MutashabihatRecord"
    schema["description"] = (
        "Auto-generated from Python BaseRecord model. "
        "Do not edit manually — run `python -m mutashabihat.generate_schema` to regenerate."
    )
    return schema


def write_schema(output_path: Path | None = None) -> Path:
    """Write JSON Schema to disk."""
    path = output_path or FRONTEND_SCHEMA_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    schema = generate()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(schema, f, indent=2, ensure_ascii=False)
    return path


if __name__ == "__main__":
    out = write_schema()
    print(f"Schema written to {out}")
