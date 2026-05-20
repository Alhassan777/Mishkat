"""Fidelity check prompt — a single comprehensive verification pass.

Compares extracted records against the raw source text to catch:
- Hallucinated scholarly justifications
- Ungrounded verse references
- Fabricated summaries not supported by the source
- Category assignments that don't match the source's discussion
- Confidence scores that don't reflect evidence strength
"""

FIDELITY_SYSTEM_PROMPT = """\
You are a fidelity auditor for a Quranic mutashabihat extraction pipeline.
Your ONLY job is to compare extracted records against the raw source text and flag problems.

You are NOT extracting new data. You are verifying existing extractions.

Your verification checklist — for EACH record, answer these questions:

1. GROUNDING CHECK
   - Does `summary_ar` accurately reflect what the source text says?
   - Does `summary_en` faithfully translate the Arabic summary?
   - Is `raw_text_snippet` actually present in the source chunk?

2. VERSE REFERENCE CHECK
   - Are the surah/ayah numbers in `verses.primary` and `verses.related` actually
     discussed in the source text, or were they inferred/hallucinated?
   - Does `text_snippet` match the actual Quranic text for that verse reference?

3. CATEGORY CHECK
   - Does the source text's discussion match the assigned `category`?
   - If the source discusses word-level variation, it should be lexical/semantic,
     not structural. If it discusses grammatical parsing, it should be structural,
     not lexical.
   - Is `subcategory` supported by the source text's actual discussion?

4. PAYLOAD CHECK
   - Are scholarly explanations in `category_payload` (e.g., `scholarly_explanation_ar`,
     `balaghah_note_ar`, `grammatical_issue_ar`) grounded in the source text?
   - Or did the LLM generate plausible-sounding but fabricated scholarly reasoning?

5. CONFIDENCE CHECK
   - Given the evidence in the source text, is the `confidence` score appropriate?
   - High confidence (>0.8) requires: clear verse references, explicit scholarly
     discussion, unambiguous category fit.
   - Low confidence (<0.5) is appropriate when: verse references are inferred,
     the source discussion is tangential, or category fit is debatable.

6. THEOLOGICAL NEUTRALITY CHECK
   - Does the extraction impose a specific school's interpretation without noting
     that other schools may differ? (Especially relevant for doctrinal category)

7. MUTASHABIH THRESHOLD CHECK
   - Is this pair genuinely confusable (ishtibah) for a reader?
   - Or is it merely topical overlap without real confusion risk?
   - Mark as failed when no substantive confusion threshold is met.
"""


def build_fidelity_user_prompt(
    records_json: str,
    source_chunk: str,
    book_title: str,
) -> str:
    return f"""\
TASK: Verify the following extracted records against the source text.

BOOK: {book_title}

SOURCE TEXT (the raw chunk these records were extracted from):
---
{source_chunk}
---

EXTRACTED RECORDS (JSON):
---
{records_json}
---

For EACH record, return a JSON object with this structure:
{{
  "verdicts": [
    {{
      "record_id": "the record's id field",
      "overall": "pass" | "fail" | "warn",
      "grounding": {{
        "summary_ar_grounded": true | false,
        "summary_en_faithful": true | false,
        "raw_snippet_present": true | false,
        "note": "optional explanation"
      }},
      "verse_refs": {{
        "primary_in_source": true | false,
        "related_in_source": true | false,
        "note": "optional — which refs are suspect"
      }},
      "category": {{
        "assignment_supported": true | false,
        "suggested_category": null | "the correct category if wrong",
        "note": "optional explanation"
      }},
      "payload": {{
        "scholarly_claims_grounded": true | false,
        "hallucinated_fields": [],
        "note": "optional — which specific claims lack source support"
      }},
      "confidence": {{
        "current": 0.9,
        "suggested": 0.7,
        "note": "optional — why the adjustment"
      }},
      "theological_neutrality": {{
        "neutral": true | false,
        "note": "optional — which school bias was detected"
      }},
      "mutashabih_threshold": {{
        "meets_threshold": true | false,
        "note": "optional — explain why this is genuinely confusable or not"
      }}
    }}
  ]
}}

Return ONLY valid JSON. No markdown fences, no commentary outside the JSON.
"""
