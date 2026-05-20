from __future__ import annotations

from ...models import BookProfile

CATEGORY_MAP = {
    1: "lexical",
    2: "semantic",
    3: "thematic",
    4: "narrative",
    5: "structural",
    6: "cross_surah_refrain",
    7: "doctrinal",
}

PAYLOAD_REQUIREMENTS = {
    "lexical": [
        "similarity_type",
        "shared_segment",
        "differences (with roots and difference_type when applicable)",
        "scholarly_explanation_ar and scholarly_explanation_en when the source provides rationale",
    ],
    "semantic": [
        "semantic_direction",
        "disambiguation_method",
        "disambiguation_explanation_ar and disambiguation_explanation_en",
        "target_word and meanings when the source explicitly analyzes a term",
    ],
    "thematic": [
        "theme (label_ar, label_en, domain)",
        "verse_cluster",
        "synthesis_ar and synthesis_en",
    ],
    "narrative": [
        "story",
        "episodes",
        "cross_episode_analysis when explicitly discussed in source",
    ],
    "structural": [
        "structural_phenomenon",
        "verse_analyses with ref, text_segment, grammatical_issue_ar, grammatical_issue_en",
        "parallel_structures when present",
        "balaghah (device_type, classical_term_ar, rhetorical_purpose_ar, rhetorical_purpose_en, affects_meaning) when source supports it",
    ],
    "cross_surah_refrain": [
        "refrain_template",
        "occurrences with ref and ending",
        "pattern_analysis_ar and pattern_analysis_en",
    ],
    "doctrinal": [
        "theological_domain_ar",
        "apparent_contradiction (claim_a and claim_b)",
        "reconciliation with explanation_ar and explanation_en",
    ],
}


def build_system_prompt(profile: BookProfile) -> str:
    cats = [CATEGORY_MAP.get(c, str(c)) for c in profile.primary_categories]
    selected_payload_requirements: list[str] = []
    for category in cats:
        fields = PAYLOAD_REQUIREMENTS.get(category)
        if not fields:
            continue
        selected_payload_requirements.append(
            f"- {category}: " + "; ".join(fields)
        )
    payload_requirements = (
        "\n".join(selected_payload_requirements)
        if selected_payload_requirements
        else "- Use category-specific payload fields; do not leave payload substructures empty."
    )
    examples = "\n\n".join(f"- Example {i + 1}:\n{e}" for i, e in enumerate(profile.example_entries[:2])) or "- None"
    resolution_markers = ", ".join(profile.resolution_markers) if profile.resolution_markers else "None"
    question_markers = ", ".join(profile.question_markers) if profile.question_markers else "None"
    notes = profile.profiler_notes or "None"
    muqaddimah = profile.muqaddimah_summary or "None"
    methodology_note = profile.methodology_note or "None"
    numbering_convention = profile.numbering_convention
    mnemonic_policy = (
        "This book includes explicit memorization aids in source text. "
        "Populate mnemonic_hint only when the source clearly provides one."
        if profile.has_mnemonic_content
        else "This book does NOT include explicit memorization aids. Leave mnemonic_hint as null."
    )

    return f"""\
You are extracting structured mutashabihat data from an Arabic text window.

IMPORTANT: one window may contain multiple independent entries. Extract ALL entries.

Book: {profile.meta.book_title}
Author: {profile.meta.author}
Organization: {profile.organization_type}
Entry delimiter: {profile.entry_delimiter}
Verse citation format: {profile.verse_citation_format}
Resolution markers: {resolution_markers}
Question/problem markers: {question_markers}
Primary categories: {", ".join(cats)}
Extraction difficulty: {profile.extraction_difficulty}
Multi-entry window expected: {profile.multi_entry_window}

Book purpose and method (muqaddimah):
{muqaddimah}

Methodology note for extraction:
{methodology_note}

Verse numbering convention:
{numbering_convention}

Profiler notes:
{notes}

Representative entry samples:
{examples}

Output requirements:
- Return strict JSON only.
- Return an object with key `records` as an array.
- Each element in `records` is one independent mutashabihat record.
- Classify each record into one category from:
  {", ".join(cats) if cats else "lexical, semantic, thematic, narrative, structural, cross_surah_refrain, doctrinal"}.
- Preserve Arabic snippets exactly when possible.
- Do not hallucinate verse references. Use null for unknown surah/ayah.
- If entry delimiters are unclear or absent, use verse-reference transitions and
  question/answer marker shifts as fallback entry boundaries.
- Extract a record only when there is genuine mutashabih confusion potential (ishtibah),
  not merely topical similarity. If two verses are merely related in theme but not
  confusable in wording/meaning/reasoning, do not extract a record.
- {mnemonic_policy}
- For balaghah fields: fill only when the source explicitly mentions rhetorical devices.
- For unique_details_en: only provide translation of explicitly stated Arabic details.
- Do not invent scholarly claims, theological framing, or mnemonics absent from source text.

CATEGORY_PAYLOAD REQUIREMENTS:
{payload_requirements}
- Do NOT leave category_payload as empty object {{}}.
- Do NOT leave required payload substructures as empty arrays/null unless the source truly provides no corresponding detail.
- For structural records specifically, avoid empty verse_analyses when verse-level reasoning exists in the source.

Confidence calibration anchors:
- 0.30 (low): weak grounding, inferred verse references, or ambiguous category fit.
- 0.60 (medium): mostly grounded with one notable ambiguity.
- 0.90 (high): explicit verse references, clear source-grounded rationale, and strong category fit.
- Never default to high confidence. If evidence is partial, prefer 0.40-0.70.

Do not include markdown fences or extra commentary.
"""

