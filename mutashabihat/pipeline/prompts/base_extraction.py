BASE_EXTRACTION_SCHEMA = """\
Return EXACTLY this JSON structure. Types matter — strings must be strings, numbers must be numbers.
Extract ALL distinct mutashabihat entries from the window and return them in `records`.
If none are present, return `"records": []`.

{
  "records": [
    {
      "id": "PIPELINE_ASSIGNED",
      "category": "structural",
      "secondary_categories": [],
      "subcategory": "addition_omission",
      "title_ar": "زيادة 'لك' في خطاب الخضر لموسى",
      "explanation_ar": "زاد لفظ 'لك' في الموضع الثاني لتأكيد الخطاب وتخصيصه بعد تكرار الاعتراض من موسى عليه السلام.",
      "verses": {
        "primary": {
          "surah": 18,
          "ayah": 72,
          "text_snippet": "أَلَمْ أَقُلْ إِنَّكَ لَن تَسْتَطِيعَ مَعِيَ صَبْرًا"
        },
        "related": [
          {
            "surah": 18,
            "ayah": 75,
            "text_snippet": "أَلَمْ أَقُل لَّكَ إِنَّكَ لَن تَسْتَطِيعَ مَعِيَ صَبْرًا",
            "role": "mutashabih",
            "relationship_direction": "bidirectional"
          }
        ]
      },
      "source": {
        "book_id": "1340",
        "book_title_ar": "الدرة التنزيل",
        "author_ar": "الإسكافي",
        "page_or_section": null,
        "raw_text_snippet": "قوله تعالى في الكهف: ألم أقل إنك لن تستطيع معي صبرا، وفي الموضع الثاني: ألم أقل لك إنك لن تستطيع معي صبرا — فزاد 'لك' في الثاني لأن موسى كرر الاعتراض"
      },
      "summary_ar": "الفرق بين الموضعين هو زيادة 'لك' في الثاني، لأن موسى عليه السلام كرر الاعتراض فاحتاج الخطاب إلى تأكيد أشد",
      "summary_en": "The second occurrence adds 'lak' (to you) because Moses repeated his objection, requiring stronger emphasis in the address",
      "summary_en_source": "llm_generated",
      "confidence": 0.9,
      "human_verified": false,
      "category_payload": {
        "type": "structural",
        "structural_phenomenon": "addition of particle لَكَ in second occurrence for rhetorical emphasis",
        "verse_analyses": [
          {
            "ref": "18:72",
            "text_segment": "ألم أقل",
            "grammatical_issue_ar": "جاءت دون 'لك' للتقرير العام والتذكير بالشرط الأول",
            "grammatical_issue_en": "without 'lak' — general reminder of the initial condition",
            "parsing_options": [],
            "preferred_parsing": "استفهام تقريري",
            "preferred_by": "جمهور"
          },
          {
            "ref": "18:75",
            "text_segment": "ألم أقل لك",
            "grammatical_issue_ar": "جاءت مع 'لك' لتأكيد الخطاب وتخصيصه بعد تكرار المخالفة",
            "grammatical_issue_en": "with 'lak' — direct address emphasised after repeated objection",
            "parsing_options": [],
            "preferred_parsing": "استفهام تقريري",
            "preferred_by": "جمهور"
          }
        ],
        "parallel_structures": [{"pattern": "ألم أقل", "other_examples": ["18:72", "18:75"]}],
        "source_grammar_book": null,
        "balaghah": {
          "device_type": "ta'kid",
          "classical_term_ar": "التأكيد بزيادة الحرف",
          "direction": "addition",
          "rhetorical_purpose_ar": "زيادة الحرف لتأكيد الخطاب عند تكرار الاعتراض من المخاطَب",
          "rhetorical_purpose_en": "particle addition intensifies the address when the interlocutor repeats an objection",
          "affects_meaning": true
        }
      }
    }
  ]
}

CATEGORY MINI EXAMPLES (for coverage across weak classes):

1) semantic / wujuh:
{
  "category": "semantic",
  "summary_ar": "جاء لفظ 'الروح' في القرآن على وجهين: الأول بمعنى جبريل كما في قوله نزل به الروح الأمين، والثاني بمعنى الوحي كما في قوله أوحينا إليك روحاً من أمرنا",
  "summary_en": "The word 'al-ruh' appears with two meanings: Gabriel (16:102) and divine revelation (42:52)",
  "summary_en_source": "llm_generated",
  "verses": {
    "primary": {"surah": 16, "ayah": 102, "text_snippet": "نَزَلَ بِهِ الرُّوحُ الْأَمِينُ"},
    "related": [
      {"surah": 42, "ayah": 52, "text_snippet": "أَوْحَيْنَا إِلَيْكَ رُوحًا مِّنْ أَمْرِنَا", "role": "supporting", "wajh_label": "الوحي"}
    ]
  },
  "category_payload": {
    "type": "semantic",
    "semantic_direction": "word_to_multiple_meanings",
    "is_wujuh": true,
    "target_word": {
      "text": "الروح",
      "root": "روح",
      "meanings": [
        {"meaning_ar": "جبريل", "meaning_en": "Gabriel", "verse_refs": ["16:102"], "context_clue": "نزل به الروح الأمين"},
        {"meaning_ar": "الوحي", "meaning_en": "divine revelation", "verse_refs": ["42:52"], "context_clue": "أوحينا إليك روحا من أمرنا"}
      ]
    },
    "nazair_terms": ["الوحي", "جبريل"],
    "wujuh_count": 2,
    "source_classification": "wujuh_wa_nazair"
  }
}

2) narrative:
{
  "category": "narrative",
  "category_payload": {
    "type": "narrative",
    "story": {
      "label_ar": "قصة موسى",
      "story_id": "musa_story",
      "story_id_source": "llm_generated"
    },
    "episodes": [],
    "cross_episode_analysis": null
  }
}

3) doctrinal:
{
  "category": "doctrinal",
  "category_payload": {
    "type": "doctrinal",
    "theological_domain_ar": "الهداية والإضلال",
    "apparent_contradiction": {
      "claim_a": {"ref": "2:272", "text_segment": "ليس عليك هداهم"},
      "claim_b": {"ref": "28:56", "text_segment": "إنك لا تهدي من أحببت"}
    },
    "reconciliation": {
      "method": "تمييز نوعي الهداية",
      "explanation_ar": "يثبت للرسول هداية البيان وينفى عنه التوفيق"
    }
  }
}

STRICT TYPE RULES:
- "records"      → ARRAY of independent records (may be empty)
- "id"           → leave as "PIPELINE_ASSIGNED" — pipeline will overwrite per record
- "book_id"      → STRING like "3580", never an integer
- "confidence"   → FLOAT 0.0–1.0, never a string like "high"
- "extraction_date" → omit this field entirely
- "extraction_model" → omit this field entirely
- "summary_en_source" → "extracted" if directly translated from explicit source text, otherwise "llm_generated"
- "title_ar"     → SHORT Arabic title for the mutashabihat entry (max 15 words), naming the phenomenon
- "explanation_ar" → Detailed Arabic reasoning from the source text. NOT a short summary.
- "verses.primary" → SINGLE OBJECT, never an array
- "related"      → ARRAY of objects (may be empty [])
- "secondary_categories" → ARRAY of strings (may be empty [])
- "category_payload" → fill ALL fields with real content, never leave as {}
- If you generate helper fields not explicitly present in source text (mnemonic_hint, ontology_path, story_id), set their paired *_source field to "llm_generated"

ARABIC TEXT RULES:
- "summary_ar"   → MUST be written in Arabic. Summarise the scholar's reasoning in his own
                   conceptual vocabulary. Never translate from English or paraphrase vaguely.
                   For wujuh records: enumerate the wujuh the scholar identifies
                   (e.g. "جاء لفظ X على وجهين: الأول ... والثاني ...").
                   For structural/lexical: state the difference and its grammatical/rhetorical reason.
- "raw_text_snippet" → Copy verbatim the Arabic passage from the source window that supports
                   this record. NEVER use a placeholder like "..." or "original Arabic chunk".
                   Must be actual Arabic text from the chunk being processed.
- "text_snippet" → Copy the Arabic verse text exactly as quoted by the scholar (may have
                   slight differences from the canonical Uthmani text — preserve them).
- "wajh_label"   → Arabic only, using the scholar's exact term for that wajh.
                   Only fill when is_wujuh=true on the parent record.
"""
