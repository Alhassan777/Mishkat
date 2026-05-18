from __future__ import annotations

import json
from typing import Any

from google import genai
from google.genai import types as gtypes
from json_repair import repair_json
from openai import OpenAI
from pydantic import BaseModel

from .deepseek_client import generate_json as deepseek_generate_json


def _strip_additional_properties(schema: dict[str, Any]) -> dict[str, Any]:
    """Recursively remove ``additionalProperties`` from a JSON schema.

    The Gemini Developer API rejects schemas that contain this keyword;
    stripping it allows Pydantic models with ``dict[str, Any]`` fields to
    be used as ``response_schema`` without falling back to schema-less mode.
    """
    cleaned: dict[str, Any] = {}
    for key, value in schema.items():
        if key == "additionalProperties":
            continue
        if isinstance(value, dict):
            cleaned[key] = _strip_additional_properties(value)
        elif isinstance(value, list):
            cleaned[key] = [
                _strip_additional_properties(item) if isinstance(item, dict) else item
                for item in value
            ]
        else:
            cleaned[key] = value
    return cleaned


def _prepare_schema(response_schema: Any) -> dict[str, Any]:
    """Convert a Pydantic model class to a Gemini-compatible JSON schema."""
    if isinstance(response_schema, type) and issubclass(response_schema, BaseModel):
        raw = response_schema.model_json_schema()
    elif isinstance(response_schema, dict):
        raw = response_schema
    else:
        return response_schema
    return _strip_additional_properties(raw)


def gemini_generate_json(
    client: genai.Client,
    model_name: str,
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.1,
    max_output_tokens: int = 65536,
    response_schema: Any | None = None,
) -> tuple[dict[str, Any], dict[str, int]]:
    config_kwargs: dict[str, Any] = {
        "system_instruction": system_prompt,
        "temperature": temperature,
        "max_output_tokens": max_output_tokens,
        "response_mime_type": "application/json",
    }
    if response_schema is not None:
        config_kwargs["response_schema"] = _prepare_schema(response_schema)

    response = client.models.generate_content(
        model=model_name,
        contents=[user_prompt],
        config=gtypes.GenerateContentConfig(**config_kwargs),
    )
    raw_text = response.text or "{}"
    usage = {
        "tokens_in": getattr(response.usage_metadata, "prompt_token_count", 0) or 0,
        "tokens_out": getattr(response.usage_metadata, "candidates_token_count", 0) or 0,
    }
    try:
        parsed = json.loads(raw_text)
    except json.JSONDecodeError:
        repaired = repair_json(raw_text, return_objects=False)
        parsed = json.loads(repaired)
    return parsed, usage


def generate_json(
    client: genai.Client | OpenAI,
    model_name: str,
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.1,
    max_output_tokens: int = 65536,
    response_schema: Any | None = None,
) -> tuple[dict[str, Any], dict[str, int]]:
    if isinstance(client, OpenAI):
        return deepseek_generate_json(
            client=client,
            model_name=model_name,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
            response_schema=response_schema,
        )
    return gemini_generate_json(
        client=client,
        model_name=model_name,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        temperature=temperature,
        max_output_tokens=max_output_tokens,
        response_schema=response_schema,
    )

