PROMPT = """\
[thematic]
Use when the compared verses share a topic/idea while wording differs.

Arabic guidance:
- `theme.label_ar` should be concise and content-based (e.g. "الإنفاق", "التوكل").
- `verse_cluster` should include the compared refs and each verse's thematic angle.

Example `category_payload`:
{
  "type": "thematic",
  "theme": {
    "label_ar": "أثر التقوى",
    "label_en": "Effects of taqwa",
    "domain": "ethics",
    "ontology_path": ["إيمان", "تقوى", "ثمرات التقوى"],
    "ontology_path_source": "llm_generated"
  },
  "verse_cluster": [
    {"ref": "65:2", "angle": "relief", "angle_ar": "المخرج", "emphasis": "prominent"},
    {"ref": "65:3", "angle": "provision", "angle_ar": "الرزق", "emphasis": "prominent"}
  ],
  "synthesis_ar": "الآيتان تعرضان آثار التقوى في التفريج والرزق مع اختلاف زاوية البيان",
  "synthesis_en": "Both verses present outcomes of taqwa with different thematic emphasis",
  "related_themes": ["التوكل", "الابتلاء"]
}

Source attribution rule:
- If ontology_path is inferred by the model (taxonomy synthesis), set
  `ontology_path_source` to "llm_generated".
- Use "extracted" only when the hierarchy is explicitly stated in the source text.

Category confidence anchors (thematic):
- 0.90: explicit source comparison of same topic with clearly distinct thematic angles.
- 0.60: thematic linkage is grounded but synthesis depends on moderate inference.
- 0.35: generic topical overlap with weak evidence of true mutashabih relation.
"""

