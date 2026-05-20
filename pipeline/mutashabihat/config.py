from __future__ import annotations

import os
from pathlib import Path
from typing import Any

PIPELINE_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_ENV_PATH = PROJECT_ROOT / ".env"
DEFAULT_SOURCE_DIR = PROJECT_ROOT / "data" / "sources"
BOOK_PROFILES_DIR = PIPELINE_ROOT / "book_profiles"
_output_dir_override = os.environ.get("PIPELINE_OUTPUT_DIR")
OUTPUT_DIR = Path(_output_dir_override) if _output_dir_override else (PIPELINE_ROOT / "output")


def load_env(path: Path = DEFAULT_ENV_PATH) -> None:
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        if key and key not in os.environ:
            os.environ[key.strip()] = value.strip()


def get_required_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def get_int_env(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, str(default)))
    except ValueError:
        return default


def get_float_env(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, str(default)))
    except ValueError:
        return default


def gemini_settings() -> dict[str, Any]:
    return {
        "model": os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"),
        "max_output_tokens": get_int_env("GEMINI_MAX_OUTPUT_TOKENS", 65536),
        "temperature": get_float_env("GEMINI_TEMPERATURE", 0.1),
        "delay_seconds": get_float_env("PIPELINE_GEMINI_DELAY_SECONDS", 0.3),
    }


def deepseek_settings() -> dict[str, Any]:
    return {
        "model": os.environ.get("DEEPSEEK_MODEL", "deepseek-v4-flash"),
        "max_output_tokens": get_int_env("DEEPSEEK_MAX_OUTPUT_TOKENS", 65536),
        "temperature": get_float_env("DEEPSEEK_TEMPERATURE", 0.1),
        "delay_seconds": get_float_env("PIPELINE_DEEPSEEK_DELAY_SECONDS", 0.3),
    }


def llm_provider() -> str:
    provider = os.environ.get("LLM_PROVIDER", "gemini").strip().lower()
    if provider not in {"gemini", "deepseek"}:
        return "gemini"
    return provider

