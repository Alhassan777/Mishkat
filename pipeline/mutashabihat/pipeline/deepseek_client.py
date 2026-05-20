from __future__ import annotations

import json
from typing import Any

from json_repair import repair_json
from openai import OpenAI


def generate_json(
    client: OpenAI,
    model_name: str,
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.1,
    max_output_tokens: int = 65536,
    response_schema: Any | None = None,
) -> tuple[dict[str, Any], dict[str, int]]:
    # DeepSeek uses the OpenAI-compatible chat completion API.
    # response_schema is kept for call-site compatibility but not enforced.
    _ = response_schema
    response = client.chat.completions.create(
        model=model_name,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=temperature,
        max_tokens=max_output_tokens,
        response_format={"type": "json_object"},
    )

    raw_text = (response.choices[0].message.content or "{}") if response.choices else "{}"
    usage = {
        "tokens_in": (response.usage.prompt_tokens if response.usage else 0) or 0,
        "tokens_out": (response.usage.completion_tokens if response.usage else 0) or 0,
    }
    try:
        parsed = json.loads(raw_text)
    except json.JSONDecodeError:
        repaired = repair_json(raw_text, return_objects=False)
        parsed = json.loads(repaired)
    return parsed, usage
