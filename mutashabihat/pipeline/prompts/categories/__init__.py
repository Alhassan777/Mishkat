from .cross_surah import PROMPT as CROSS_SURAH_PROMPT
from .doctrinal import PROMPT as DOCTRINAL_PROMPT
from .lexical import PROMPT as LEXICAL_PROMPT
from .narrative import PROMPT as NARRATIVE_PROMPT
from .semantic import PROMPT as SEMANTIC_PROMPT
from .structural import PROMPT as STRUCTURAL_PROMPT
from .thematic import PROMPT as THEMATIC_PROMPT

CATEGORY_PROMPTS = {
    "lexical": LEXICAL_PROMPT,
    "semantic": SEMANTIC_PROMPT,
    "thematic": THEMATIC_PROMPT,
    "narrative": NARRATIVE_PROMPT,
    "structural": STRUCTURAL_PROMPT,
    "cross_surah_refrain": CROSS_SURAH_PROMPT,
    "doctrinal": DOCTRINAL_PROMPT,
}

PRIMARY_CATEGORY_ID_MAP = {
    1: "lexical",
    2: "semantic",
    3: "thematic",
    4: "narrative",
    5: "structural",
    6: "cross_surah_refrain",
    7: "doctrinal",
}

ORDERED_CATEGORY_NAMES = [
    "lexical",
    "semantic",
    "thematic",
    "narrative",
    "structural",
    "cross_surah_refrain",
    "doctrinal",
]


def get_category_prompt(category: str) -> str:
    return CATEGORY_PROMPTS[category]


def categories_from_profile_ids(primary_category_ids: list[int] | None) -> list[str]:
    if not primary_category_ids:
        return ORDERED_CATEGORY_NAMES
    selected: list[str] = []
    for category_id in primary_category_ids:
        category_name = PRIMARY_CATEGORY_ID_MAP.get(category_id)
        if category_name is not None and category_name not in selected:
            selected.append(category_name)
    return selected or ORDERED_CATEGORY_NAMES


def build_category_reference(selected_categories: list[str] | None = None) -> str:
    if not selected_categories:
        selected_categories = ORDERED_CATEGORY_NAMES
    ordered = [CATEGORY_PROMPTS[name] for name in ORDERED_CATEGORY_NAMES if name in selected_categories]
    return "\n\n".join(ordered)

