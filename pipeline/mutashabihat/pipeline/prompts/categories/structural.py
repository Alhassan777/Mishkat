PROMPT = """\
[structural]
Use when the difference is grammatical/rhetorical structure (taqdim/ta'khir,
addition/omission, case-ending implications, parallel syntactic forms).

Arabic guidance:
- `structural_phenomenon` should be a concrete phenomenon, not a generic theme.
- `verse_analyses` should include per-verse grammatical analysis.
- Use `parsing_options` as an array when the source presents competing i'rab analyses;
  use one entry when only one parsing is discussed.
- If the issue is primarily word substitution without syntactic implications, classify as lexical.

Valid `balaghah.device_type` vocabulary:
- iltifat
- tashbih
- istiara
- kinaya
- majaz_mursal
- ta'kid
- hadhf
- taqdim_takhir
- ijaz
- itnab
- tibaq
- muqabala

Example `category_payload`:
{
  "type": "structural",
  "structural_phenomenon": "زيادة حرف في الموضع الثاني للتأكيد",
  "verse_analyses": [
    {
      "ref": "18:72",
      "text_segment": "ألم أقل",
      "grammatical_issue_ar": "صيغة التقرير الأولى",
      "grammatical_issue_en": "Initial declarative form",
      "parsing_options": [
        {
          "option": "استفهام تقريري",
          "option_en": "rhetorical confirmation question",
          "meaning_impact": "يثبت المعنى ويقرره دون طلب جواب",
          "grammatical_position": "جملة استفهامية",
          "governing_element": "همزة الاستفهام",
          "case_ending": "لا أثر إعرابي مباشر",
          "proponents": ["جمهور"]
        }
      ],
      "preferred_parsing": "استفهام تقريري",
      "preferred_by": "جمهور المفسرين"
    }
  ],
  "parallel_structures": [
    {"pattern": "ألم أقل", "other_examples": ["18:75"]}
  ],
  "source_grammar_book": null,
  "balaghah": {
    "device_type": "ta'kid",
    "classical_term_ar": "التأكيد بالزيادة",
    "direction": "addition",
    "rhetorical_purpose_ar": "التغاير التركيبي يخدم تقوية المقام",
    "rhetorical_purpose_en": "Structural variation intensifies rhetorical force",
    "affects_meaning": true
  }
}

Hallucination guard:
- Fill `balaghah` only when the source explicitly indicates a rhetorical device.
- If balaghah is not explicit, keep `balaghah` null and avoid speculative rhetoric labels.

Category confidence anchors (structural):
- 0.90: explicit grammatical/rhetorical analysis in source with clear structural contrast.
- 0.60: structure difference is clear but parsing preference or rationale is partly inferred.
- 0.35: weak structural evidence or likely lexical/thematic misclassification.
"""

