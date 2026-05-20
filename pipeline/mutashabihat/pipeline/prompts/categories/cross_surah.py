PROMPT = """\
[cross_surah_refrain]
Use when a repeated phrase/pattern appears across surahs with meaningful
variation in endings, attributes, or context.

Set `category_payload` to:
{
  "type": "cross_surah_refrain",
  "refrain_template": "الصِّرَاطَ الْمُسْتَقِيمَ",
  "refrain_template_en": "the straight path",
  "occurrences": [
    {
      "ref": "1:6",
      "ending": "الصِّرَاطَ الْمُسْتَقِيمَ",
      "context_ar": "اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ",
      "attributes": ["مُعَرَّف بالألف واللام"]
    },
    {
      "ref": "42:53",
      "ending": "صِرَاطِ اللَّهِ",
      "context_ar": "إِلَىٰ صِرَاطِ اللَّهِ الْعَزِيزِ",
      "attributes": ["مُضَاف إلى لفظ الجلالة"]
    }
  ],
  "pattern_analysis_ar": "تحليل النمط بالعربية",
  "pattern_analysis_en": "pattern analysis in English",
  "total_occurrences_in_quran": 2,
  "detection_method": "textual_comparison"
}

STRICT TYPE RULES FOR occurrences ITEMS:
- "ref"     → STRING "surah:ayah" e.g. "1:6", never an object
- "ending"  → STRING with the Arabic text variant, never an array
- "attributes" → ARRAY of strings

Category confidence anchors (cross_surah_refrain):
- 0.90: repeated template and meaningful variation are explicit and textually clear.
- 0.60: repetition is clear but interpretive significance of variation is partly inferred.
- 0.35: repetition is superficial or not clearly a refrain pattern.
"""
