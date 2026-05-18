from .base_extraction import BASE_EXTRACTION_SCHEMA
from .categories import build_category_reference, categories_from_profile_ids
from .fidelity_check import FIDELITY_SYSTEM_PROMPT, build_fidelity_user_prompt
from .system import build_system_prompt


def build_user_prompt(raw_chunk: str, primary_category_ids: list[int] | None = None) -> str:
    selected_categories = categories_from_profile_ids(primary_category_ids)
    return f"{BASE_EXTRACTION_SCHEMA}\n\n{build_category_reference(selected_categories)}\n\nENTRY TEXT WINDOW:\n---\n{raw_chunk}"

