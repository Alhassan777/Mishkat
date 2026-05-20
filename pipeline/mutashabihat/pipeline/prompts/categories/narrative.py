PROMPT = """\
[narrative]
Use when the same Quranic story appears across surahs with variant detail,
sequence, or rhetorical focus.

Arabic guidance:
- `episodes` should map each occurrence to its local narrative role.
- `cross_episode_analysis` should explicitly compare shared vs varying elements.

Example `category_payload`:
{
  "type": "narrative",
  "story": {"label_ar": "قصة موسى مع الخضر", "label_en": "Moses and al-Khidr", "prophet": "موسى", "story_id": "musa_khidr", "story_id_source": "llm_generated"},
  "episodes": [
    {
      "surah": 18,
      "verse_range": "60-82",
      "surah_name": "الكهف",
      "episode_focus": "التعليم بالصبر",
      "unique_details": ["اشتراط عدم السؤال"],
      "unique_details_en": ["Condition not to ask questions"],
      "narrative_purpose_ar": "تربية النبي على تلقي العلم",
      "narrative_purpose_en": "Discipline in receiving knowledge",
      "rhetorical_context": "سياق الصبر على الفتنة"
    }
  ],
  "cross_episode_analysis": {
    "shared_elements": ["لقاء العبد الصالح", "الاعتراض المتكرر"],
    "varying_elements": ["درجة التفصيل", "مستوى التعليل"],
    "scholarly_note_ar": "التغاير لخدمة أغراض السورة",
    "scholarly_note_en": "Variation serves each surah's rhetorical goal"
  }
}

Source attribution rule:
- If story_id is synthesized for indexing (not explicitly written in source text),
  set `story_id_source` to "llm_generated".
- Use "extracted" only when the identifier or equivalent label appears in source.

Hallucination guard:
- `unique_details_en` must only translate Arabic details explicitly present in source.
- Do not invent narrative details to complete episode templates.

Category confidence anchors (narrative):
- 0.90: explicit source comparison between parallel story episodes with concrete differing details.
- 0.60: shared story and one or more differences are grounded, but synthesis is partly inferred.
- 0.35: only broad story overlap without explicit comparative treatment.
"""

