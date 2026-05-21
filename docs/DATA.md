# Data Documentation

## Source Corpus

Mishkāt uses 14 classical Arabic books (Shamela markdown exports) stored under `data/sources/`.
Each source file includes `رقم الكتاب`, which maps to a normalized pipeline slug in `pipeline/mutashabihat/registry.py`.

For book selection rationale, tier assignments, and per-book justifications, see `docs/BOOKS.md`.

## Data Model

The extraction record schema is defined by the Pydantic `BaseRecord` model in `pipeline/mutashabihat/models/base_record.py`.

Core record sections:

- `id`, `category`, `subcategory`, `confidence`
- `verses.primary` and `verses.related[]`
- `source` metadata (`book_id`, `book_title_ar`, `author_ar`, `page_or_section`)
- language summaries (`summary_ar`, `summary_en`)
- category-specific payloads (lexical, semantic, thematic, narrative, structural, cross-surah refrain, doctrinal)

Generated schema artifact:

- `data/extracted/record_schema.json`

## Extraction Process

1. **Profile source books** with `pipeline/scripts/profile_books.py` to infer structure and delimiters.
2. **Chunk content** with overlap (~600 tokens, 80-token overlap) using `chunker.py`.
3. **Run LLM extraction** per chunk through `pipeline/cli/extract.py`.
4. **Run fidelity pass** on extracted records.
5. **Verify verse references** against a local Qur'an dictionary.
6. **Write resumable outputs** per run in `pipeline/output/<book>/<run_id>/`.
7. **Merge records** into `pipeline/output/merged/*.jsonl`.
8. **Build graph** in `pipeline/output/ayah_graph.json`.
9. **Slim graph for web** to `client/public/data/graph.json`.

## Extraction Iterations and Coverage

12 of 14 books were extracted.  
2 books (`book_1508_ibn_jawzi_nuzhat_ayn`, `book_26752_ibn_zubayr_malak_tawil`) are profiled but not yet extracted (future expansion).

22 extraction runs were executed across Gemini 2.5 Flash, Gemini 2.5 Pro, and DeepSeek V4 Flash.

Chunk counts below come from running `pipeline/scripts/count_chunks.py` with the current book profiles and chunking logic. Some extraction runs used different chunking parameters, so their internal `total_chunks` may differ from the canonical number — the "Chunks Extracted" column shows the best run's actual completion.

| Book (slug) | Canonical Chunks | Chunks Extracted (best run) | Coverage | Runs | Model(s) | Merged Records |
|---|---:|---:|---:|---:|---|---:|
| `book_22_iskafi_durra_tanzil` | 388 | 386 / 388 | 99% | 4 | DeepSeek + Gemini 2.5 Flash | 328 |
| `book_79_karmani_burhan` | 203 | 199 / 203 | 98% | 1 | Gemini 2.5 Flash | 431 |
| `book_276_shinqiti_daf_iham` | 181 | 181 / 181 | 100% | 4 | Gemini 2.5 Flash | 208 |
| `book_404_askari_wujuh_nazair` | 166 | 139 / 166 | 84% | 4 | DeepSeek + Gemini 2.5 Flash | 184 |
| `book_1392_darwish_irab_quran` | 2966 | 232 / 600 | 8% | 3 | Gemini 2.5 Flash | 392 |
| `book_100_makki_mushkil_irab` | 711 | 55 / 56 | 8% | 1 | Gemini 2.5 Flash | 56 |
| `book_326_ibn_qutayba_tawil_mushkil` | 170 | 40 / 42 | 24% | 1 | Gemini 2.5 Flash | 41 |
| `book_166_ansari_fath_rahman` | 177 | 37 / 37 | 21% | 1 | Gemini 2.5 Flash | 40 |
| `book_248_yahya_ibn_sallam_tasarif` | 405 | 19 / 25 | 5% | 1 | Gemini 2.5 Flash | 16 |
| `book_30_ibn_jamaah_kashf_maani` | 65 | 16 / 16 | 25% | 1 | Gemini 2.5 Flash | 16 |
| `book_172_ibn_taymiyya_iklil` | 16 | 4 / 4 | 25% | 1 | Gemini 2.5 Pro | 6 |
| `book_185_sakhawi_hidayat_murtab` | 84 | 4 / 4 | 5% | 1 | Gemini 2.5 Flash | 4 |

**Total corpus:** 6,272 canonical chunks across 14 books. ~1,312 chunks extracted so far (21% of the full corpus), yielding **1,722 merged records**.

Iteration notes:

- Multiple runs were used to recover failed chunks and improve coverage.
- Some extraction runs used a different chunk-window or entry-grouping than the current profile — their internal `total_chunks` will differ from the canonical column above.
- Some runs ended with `failed` status while still producing valid records.
- Fidelity filtering lowers confidence for weak matches instead of silently dropping records.
- The two largest books (`book_1392_darwish_irab_quran` at 2,966 chunks, `book_100_makki_mushkil_irab` at 711 chunks) represent major expansion targets.

## Limitations

- LLM extraction quality varies by source style and entry boundary clarity.
- Coverage is uneven across books with complex organization.
- Some records require manual scholarly review for category precision.
- Two books remain unprocessed in current release.

## Possible Applications

- Quran study exploration tools for students and teachers.
- Comparative tafsir workflows.
- Memorization support via cross-verse pattern discovery.
- Research datasets for Arabic NLP and digital humanities.
