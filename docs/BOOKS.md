# Source Book Selection — Rationale and Tiers

This document explains which books were selected as extraction sources for the Mishkāt dataset, how they were prioritized, and why.

---

## Selection Criteria

A book qualifies as a source if it meets all of the following:

1. **Direct domain fit** — the book explicitly studies verse-to-verse relationships, not general tafsir
2. **Structured entries** — the book has repeatable, machine-extractable entry patterns (not free-flowing prose commentary)
3. **Verse citation** — the author cites specific surah and/or ayah references (or quotes enough text to fuzzy-match against the Quran dictionary)
4. **Scholarly authority** — the book is cited by later scholars and is considered a recognized work in its field
5. **Availability** — a digitized version exists (Shamela markdown export or Quranpedia PDF)

Books that failed criterion 2 (no repeatable entry structure) or criterion 3 (no verse citations) were excluded even if they were thematically relevant.

---

## Category Coverage Strategy

Every book maps to one or more of the six categories present in the graph. The goal was to ensure that every category had at least **two independent scholarly sources** so that no single book dominates a category's edges:

| Category | Target coverage |
|---|---|
| `structural` | 2+ books — grammatical analysis books |
| `semantic` | 2+ books — *wujuh wa nazair* tradition |
| `doctrinal` | 2+ books — apparent contradiction tradition |
| `lexical` | 2+ books — mutashabihat alfaz tradition |
| `cross_surah_refrain` | 2+ books — repeated-phrase tradition |
| `thematic` | 1 book — looser category, lower priority |

---

## Tier 1 — Foundational (Highest Extraction Priority)

These are the non-negotiable books. Together they cover every category and represent the core classical tradition. Extraction was prioritized to near-complete coverage.

---

### الكرماني — البرهان في توجيه متشابه القرآن
**Slug:** `book_79_karmani_burhan` | **Quranpedia:** 79 | **Author:** برهان الدين الكرماني (ت 505 هـ)

**Primary categories:** `lexical`, `cross_surah_refrain`

**Why essential:**
The foundational book of the mutashabihat field. Every later author in this tradition (الإسكافي, ابن جماعة, ابن الزبير) references or explicitly builds on it. Covers the entire Quran systematically — for every repeated or similar verse, the author explains precisely what differs and why. The single largest source of lexical connections in the dataset.

**What it contributes:** The core "why does Surah X say كذا but Surah Y says كذا" layer. Without this book, the lexical category would have no authoritative foundation.

**Extraction status:** 98% coverage (199/203 chunks), 431 merged records.

---

### الشنقيطي — دفع إيهام الاضطراب عن آيات الكتاب
**Slug:** `book_276_shinqiti_daf_iham` | **Quranpedia:** 276 | **Author:** محمد الأمين الشنقيطي (ت 1393 هـ)

**Primary categories:** `doctrinal`

**Why essential:**
The most systematic modern treatment of apparently contradictory verses. Written in clear modern Arabic, organized surah by surah, with a consistent *problem → resolution* format that maps cleanly to the extraction schema. The gold standard for the doctrinal category. Every "this verse seems to contradict that verse" entry in the dataset traces to either this book or ابن قتيبة.

**What it contributes:** The entire doctrinal reconciliation layer. Without this, the dataset would have no reliable source for theological apparent-contradiction edges.

**Extraction status:** 100% coverage (181/181 chunks), 208 merged records.

---

### العسكري — الوجوه والنظائر لأبي هلال العسكري
**Slug:** `book_404_askari_wujuh_nazair` | **Quranpedia:** 404 | **Author:** أبو هلال العسكري (ت نحو 395 هـ)

**Primary categories:** `semantic`

**Why essential:**
The classical source for the *wujuh wa nazair* tradition — one word with multiple meanings across different verses. No semantic layer is complete without it. The author systematically lists every significant Quranic word with its range of meanings, citing the specific verses where each meaning occurs. This is the earliest and most cited work in this tradition.

**What it contributes:** The semantic "word meaning map." When an edge has a `wajh_label` field filled, it almost always traces to this book.

**Extraction status:** 84% coverage (139/166 chunks), 184 merged records.

---

### الإسكافي — درة التنزيل وغرة التأويل
**Slug:** `book_22_iskafi_durra_tanzil` | **Quranpedia:** 22 | **Author:** الخطيب الإسكافي (ت 420 هـ)

**Primary categories:** `structural`, `lexical`

**Why essential:**
One of the oldest major works on mutashabihat. While الكرماني tells you *what* differs between verses, الإسكافي tells you *why* — the rhetorical (بلاغة), theological, and grammatical reasons behind each word choice. His entries are longer and more analytical. He is the author الكرماني and ابن جماعة built on.

**What it contributes:** The "why" layer on top of lexical edges. Also the primary source for structural connections involving grammatical ambiguity and multiple parsings.

**Extraction status:** 99% coverage (386/388 chunks), 328 merged records. The most fully extracted book in the corpus.

---

## Tier 2 — Strong Enhancement (Second Priority)

These books fill important gaps or deepen coverage in key categories. They were extracted after Tier 1 but before expansion books.

---

### ابن قتيبة — تأويل مشكل القرآن
**Slug:** `book_326_ibn_qutayba_tawil_mushkil` | **Quranpedia:** 326 | **Author:** ابن قتيبة الدينوري (ت 276 هـ)

**Primary categories:** `doctrinal`, `semantic`

**Why included:**
One of the earliest works addressing theologically problematic verses — written in response to critics (including non-Muslims) who used difficult verses as objections. Complements الشنقيطي by adding a 3rd-century AH perspective on the same doctrinal questions. Also covers semantic difficulties and apparent grammatical problems, giving it dual-category value.

**What it contributes:** Historical depth to the doctrinal category; bridges with semantic category; represents the earliest stratum of this scholarly tradition.

**Extraction status:** 24% coverage (40/42 extracted chunks of a 170-chunk book), 41 merged records. Partial but sufficient for initial representation.

---

### ابن جماعة — كشف المعاني في المتشابه من المثاني
**Slug:** `book_30_ibn_jamaah_kashf_maani` | **Quranpedia:** 30 | **Author:** بدر الدين ابن جماعة (ت 733 هـ)

**Primary categories:** `cross_surah_refrain`, `lexical`

**Why included:**
Directly builds on الكرماني with deeper *masala*-style analysis. Focused specifically on cross-surah patterns — verses that repeat across surahs with subtle variations. Adds scholarly commentary on *why* the refrain varies where الكرماني only notes *that* it varies. Also provides a medieval scholar's synthesis of the tradition.

**What it contributes:** Depth to cross-surah refrain edges; provides alternative scholarly opinions for edges already sourced from الكرماني, showing where classical scholars agreed or differed.

**Extraction status:** 25% coverage (16/16 extracted chunks of a 65-chunk book), 16 merged records.

---

### الأنصاري — فتح الرحمن بكشف ما يلتبس في القرآن
**Slug:** `book_166_ansari_fath_rahman` | **Quranpedia:** 166 | **Author:** زكريا الأنصاري (ت 926 هـ)

**Primary categories:** `lexical`, `semantic`

**Why included:**
Bridges the lexical and semantic traditions. Focuses on verses that "cause confusion" (*يلتبس*) due to similarity — both in wording and in meaning. Written in a later era (10th century AH), it represents how the mutashabihat tradition was still actively synthesized in the late classical period and adds coverage of verses the earlier books missed.

**What it contributes:** Cross-category coverage; fills gaps where neither الكرماني nor العسكري discussed a particular verse pair.

**Extraction status:** 21% coverage (37/37 extracted chunks of a 177-chunk book), 40 merged records.

---

## Tier 3 — Specialist and Expansion Books

These books target specific categories or represent very early/very deep coverage. They were included to add breadth but were not required for initial launch.

---

### مكي بن أبي طالب — مشكل إعراب القرآن
**Slug:** `book_100_makki_mushkil_irab` | **Quranpedia:** 100 | **Author:** مكي بن أبي طالب القيسي (ت 437 هـ)

**Primary categories:** `structural`

**Why included:**
A specialist *irab* (grammatical parsing) book focused specifically on verses where the grammar is *problematic* (*مشكل*) — i.e., where multiple parsings are possible and the meaning changes accordingly. Narrower than العكبري's comprehensive إعراب but more directly relevant to structural mutashabihat.

**What it contributes:** Structural edges where grammatical ambiguity is the *reason* for the connection, not just an incidental property.

**Extraction status:** 8% coverage (55/56 extracted chunks of a 711-chunk book), 56 merged records. Major expansion target.

---

### الدرويش — إعراب القرآن وبيانه
**Slug:** `book_1392_darwish_irab_quran` | **Quranpedia:** 1392 | **Author:** محيي الدين الدرويش (contemporary)

**Primary categories:** `structural`

**Why included:**
The most comprehensive modern إعراب of the Quran. Verse-by-verse coverage of all 6,236 ayat with detailed grammatical analysis. When a verse has multiple possible parsings, the author consistently presents all options. Its modern Arabic and comprehensive coverage make it the most extractable structural source.

**What it contributes:** Near-complete structural coverage of the Quran; the intended backbone of the structural category at full extraction.

**Extraction status:** 8% coverage (232/600 partial extraction of a 2,966-chunk book), 392 merged records. The largest expansion target in the corpus by far.

---

### يحيى بن سلام — التصاريف لتفسير القرآن
**Slug:** `book_248_yahya_ibn_sallam_tasarif` | **Quranpedia:** 248 | **Author:** يحيى بن سلام البصري (ت 200 هـ)

**Primary categories:** `semantic`

**Why included:**
One of the earliest works (2nd century AH) on *wujuh wa nazair* — written nearly two centuries before العسكري. Provides the deepest historical stratum of semantic analysis in the dataset and covers some word meanings not addressed by later authors. Its extreme age also means it preserves linguistic observations from the generation closest to the Quranic revelation.

**What it contributes:** Historical depth to the semantic category; captures meanings attested only in early sources.

**Extraction status:** 5% coverage (19/25 extracted chunks of a 405-chunk book), 16 merged records.

---

### ابن تيمية — الإكليل في المتشابه والتأويل
**Slug:** `book_172_ibn_taymiyya_iklil` | **Quranpedia:** 172 | **Author:** ابن تيمية (ت 728 هـ)

**Primary categories:** `doctrinal`

**Why included:**
A short but authoritative work by the most influential medieval Islamic jurist. Provides ابن تيمية's specific positions on theologically difficult and mutashabih verses. His opinions are widely cited and often represent a distinct scholarly position compared to الشنقيطي.

**What it contributes:** Influential scholarly voice for doctrinal edges; introduces `opinions` diversity — users can see where ابن تيمية and الشنقيطي agree or diverge on the same verse.

**Extraction status:** 25% coverage (4/4 extracted chunks of a 16-chunk book), 6 merged records. Small book, nearly complete.

---

### السخاوي — هداية المرتاب وغاية الحفاظ والطلاب
**Slug:** `book_185_sakhawi_hidayat_murtab` | **Quranpedia:** 185 | **Author:** علم الدين السخاوي (ت 643 هـ)

**Primary categories:** `cross_surah_refrain`

**Why included:**
A book specifically addressing cross-surah verse confusion for *huffaz* (memorizers), written in verse form (*nazm*). Directly targets the use case of a memorizer who confuses similar phrases across surahs. Complements الكرماني and ابن جماعة from a pedagogical angle.

**What it contributes:** Cross-surah refrain edges with a memorization-oriented framing; the poetic format also means entries are highly concise and extractable.

**Extraction status:** 5% coverage (4/4 extracted chunks of a 84-chunk book), 4 merged records.

---

## Books Profiled but Not Yet Extracted

These two books are registered in the pipeline and profiled, but extraction has not been run:

| Slug | Title | Author | Category | Why deferred |
|---|---|---|---|---|
| `book_1508_ibn_jawzi_nuzhat_ayn` | نزهة الأعين النواظر في علم الوجوه والنظائر | ابن الجوزي (ت 597 هـ) | `semantic` | Large book; العسكري already covers the category well |
| `book_26752_ibn_zubayr_malak_tawil` | ملاك التأويل | ابن الزبير الغرناطي (ت 708 هـ) | `lexical`, `doctrinal` | Complex structure; الكرماني and الإسكافي cover the lexical layer sufficiently |

---

## Books Considered but Not Selected

| Title | Reason not selected |
|---|---|
| العباد — آيات متشابهات الألفاظ (Book 215) | Overlaps heavily with الكرماني; adds limited new edges; lower scholarly authority |
| العكبري — التبيان في إعراب القرآن (Book 309) | Comprehensive but covers every verse including those with no ambiguity; الدرويش is a more focused modern alternative |
| الخالدي — القصص القرآني (Book 23301) | Narrative tafsir, not a verse-comparison book; does not meet criterion 2 (structured entries) |
| المعجم المفهرس للتراكيب — خضر (Book 1035) | An index, not an analytical source; no scholarly opinions to extract |
| هشام أبو شام — خالص الجمان | Could not confirm Quranpedia availability and structured entry format |

---

## Extraction Coverage

For per-book extraction metrics (chunk counts, coverage percentages, run counts, models used, and merged record totals), see the extraction table in `docs/DATA.md`.

The two Tier 1 books with the highest coverage (الكرماني at 98% and الشنقيطي at 100%) account for 639 records — 37% of the total corpus — reflecting the deliberate prioritization of foundational works.
