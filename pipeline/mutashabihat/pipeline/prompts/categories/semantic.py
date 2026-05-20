PROMPT = """\
[semantic]
Use when one lexical item carries multiple meanings (wujuh / nazair style) and
the passage disambiguates based on context.

Valid hints for `semantic_direction`:
- word_to_multiple_meanings
- context_specific_meaning
- semantic_specialization

Arabic guidance:
- `target_word.text` must be the lemma (dictionary form), not an inflected verse form.
- Put inflected/contextual surface forms in `context_clue`.
- `meanings` should list distinct senses, each tied to verse refs.
- For each meaning, populate `attributed_to` with scholars who explicitly assign that wajh.

When `is_wujuh=true`: for EACH verse in `verses.related`, set `wajh_label` to the
specific wajh (meaning label) that verse exemplifies, exactly as the scholar names it
(e.g. "الدين"، "البيان"، "الرسول"). This creates a direct bridge from the verse edge
to the meaning it demonstrates. If the scholar does not name the wajh explicitly,
leave `wajh_label` null.

Example `category_payload`:
{
  "type": "semantic",
  "semantic_direction": "word_to_multiple_meanings",
  "is_wujuh": true,
  "target_word": {
    "text": "الروح",
    "root": "روح",
    "meanings": [
      {"meaning_ar": "جبريل", "meaning_en": "Gabriel", "verse_refs": ["16:102"], "context_clue": "نزل به الروح الأمين"},
      {"meaning_ar": "الوحي", "meaning_en": "revelation", "verse_refs": ["42:52"], "context_clue": "أوحينا إليك روحا من أمرنا"}
    ]
  },
  "nazair_terms": ["الوحي", "جبريل"],
  "nazair_explanation_ar": "تأتي ألفاظ أخرى في سياقات متقاربة دلاليا مع اختلاف اللفظ",
  "nazair_explanation_en": "Other terms appear with close semantic function despite lexical variation",
  "disambiguation_method": "contextual",
  "disambiguation_explanation_ar": "يحدد السياق المقصود من اللفظ في كل موضع",
  "disambiguation_explanation_en": "Context disambiguates the intended sense per verse",
  "wujuh_count": 2,
  "wujuh_count_by_scholar": [{"Yahya_ibn_Sallam": 2}, {"Ibn_al_Jawzi": 4}],
  "source_classification": "wujuh_wa_nazair"
}

Corresponding `verses.related` for the above (note wajh_label on each):
[
  {"surah": 16, "ayah": 102, "text_snippet": "نَزَلَ بِهِ الرُّوحُ الْأَمِينُ", "role": "supporting", "wajh_label": "جبريل"},
  {"surah": 42, "ayah": 52, "text_snippet": "أَوْحَيْنَا إِلَيْكَ رُوحًا مِّنْ أَمْرِنَا", "role": "supporting", "wajh_label": "الوحي"}
]

Boundary rules:
- Use `is_wujuh=true` only when one lemma has multiple meanings across contexts.
- Use `nazair_terms` to capture multiple different terms that converge on a shared meaning.
- Only fill `wajh_label` when `is_wujuh=true`; leave null otherwise.

Category confidence anchors (semantic):
- 0.90: explicit source disambiguation of senses and verse-level mapping (wujuh labels grounded).
- 0.60: senses are mostly grounded but one mapping or attribution is inferred.
- 0.35: weak evidence for distinct senses or ambiguity between semantic and thematic categories.
"""

