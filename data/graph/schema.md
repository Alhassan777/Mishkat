# Ayah Adjacency Graph — Schema Reference

This file documents the graph generated at `pipeline/output/ayah_graph.json` and committed at `data/graph/ayah_graph.json`.

---

## What this graph is

A verse-level adjacency list keyed by `surah:ayah` (e.g. `"2:124"`).

Each **node** is one Quranic verse with its metadata.
Each **connection** (`source → target`) represents a scholarly-attested relationship between two verses.
Each connection holds an **opinions** array — one entry per scholar/book that attests the relationship.

---

## Top-level structure

```json
{
  "meta": { ... },
  "nodes": { "2:124": { ... }, ... }
}
```

### `meta`

| Field | Type | Description |
|---|---|---|
| `generated` | ISO 8601 string | UTC timestamp of when the graph was built by the pipeline |
| `total_records_processed` | integer | Number of raw JSONL extraction records consumed to build this graph |
| `total_nodes` | integer | Number of distinct Quranic verse nodes in the graph |
| `total_edges` | integer | Number of directional verse→verse edges (a bidirectional relationship counts as 2) |
| `total_opinions` | integer | Total number of opinion entries across all edges (can exceed edges because multiple books may attest the same edge) |
| `source_books` | integer | Number of unique scholarly books that contributed at least one opinion |

---

## Node structure

Each node is keyed by `"surah:ayah"` (e.g. `"2:69"`, `"28:27"`).

| Field | Type | Description |
|---|---|---|
| `surah` | integer | Surah number (1–114) |
| `ayah` | integer | Ayah number within the surah |
| `surah_name_ar` | string | Full Arabic name of the surah (e.g. `"سُورَةُ البَقَرَةِ"`) |
| `surah_name_en` | string | English transliteration of the surah name (e.g. `"Al-Baqara"`) |
| `text_uthmani` | string | Full Uthmani-script Arabic text of the verse, with full diacritical marks |
| `text_snippet` | string | A short Arabic phrase (typically 2–5 words) identifying the most relevant part of the verse for this graph entry — used as a compact display label |
| `juz` | integer | Juz' number (1–30) the verse belongs to |
| `hizb_quarter` | integer | Hizb quarter (1–240) — finer-grained division used in traditional recitation scheduling |
| `ayah_no_quran` | integer | Absolute verse number counting sequentially from the start of the Quran (1–6236) |
| `connections` | object | Map of outgoing edges keyed by target `"surah:ayah"` |

---

## Connection structure

Each connection is keyed by the target verse's `"surah:ayah"`.

| Field | Type | Description |
|---|---|---|
| `target_surah` | integer | Surah number of the target verse |
| `target_ayah` | integer | Ayah number of the target verse within its surah |
| `target_text_uthmani` | string | Full Uthmani-script Arabic text of the target verse |
| `target_text_snippet` | string | Short identifying phrase from the target verse |
| `opinions` | array | List of scholarly opinions attesting this verse relationship (see below) |

---

## Opinion structure

Each opinion represents one scholarly source that attests the relationship between two verses.

| Field | Type | Nullable | Description |
|---|---|---|---|
| `record_id` | string | no | Unique identifier for the extraction record. Format: `{book_slug}_{chunk_number}_{record_letter}` — see below for full breakdown. |
| `book_id` | string | no | Numeric ID of the source book in the source database (e.g. `"37586"`) |
| `book_title_ar` | string | no | Full Arabic title of the source book |
| `author_ar` | string | no | Full Arabic name of the author, typically including death year (e.g. `"ت 395هـ"`) |
| `category` | string | no | Primary relational category. See [Categories](#categories) below |
| `secondary_categories` | array of strings | no | Additional categories that also apply. Often empty `[]` |
| `subcategory` | string | yes | Finer-grained classification within the category (e.g. `"grammatical_function"`, `"wujuh_nazair"`) |
| `role` | string | no | The structural role of this verse in the relationship. One of `mutashabih`, `supporting`, `contextual` — see [Roles](#roles) |
| `relationship_direction` | string | no | Directionality of the relationship. Usually `"bidirectional"` — meaning both edges (A→B and B→A) were created |
| `wajh_label` | string | yes | For *wujuh wa nazair* (polysemy/homonymy) entries: the specific semantic facet or meaning being discussed (e.g. `"الجماعة"` meaning "community"). Null for non-semantic categories |
| `summary_ar` | string | yes | Arabic summary of the scholarly opinion explaining *why* these verses are related. May be null if the source was too terse for summarization |
| `summary_en` | string | yes | English translation of the summary. Null when `summary_ar` is null |
| `confidence` | float | no | Pipeline confidence score (0.0–1.0) in the extraction quality. Higher = cleaner extraction from source text |
| `source_page` | string | yes | Page number in the source book where this opinion appears. Null if not determinable from the source |
| `distributed_from_null_primary` | boolean | no | `true` if this opinion originated from a record with no concrete primary verse (common in wujuh/nazair-style entries). Such edges are synthesized using a hub-and-spoke strategy — see [Null-primary records](#null-primary-records) |

---

## Record ID format

A `record_id` looks like: `book_404_askari_wujuh_nazair_0001_b`

It is built in two steps inside the extraction pipeline (`pipeline/cli/extract.py`):

**Step 1 — chunk ID:**
```
chunk_id = f"{book_slug}_{chunk_number:04d}"
```
- `book_slug` — the book's registered slug from the book registry (e.g. `book_404_askari_wujuh_nazair`). It is fixed per book and used as a stable namespace.
- `chunk_number` — a 1-based counter, zero-padded to 4 digits, representing which text chunk of the book this record was extracted from (e.g. `0001`, `0012`). A book is split into chunks before being sent to the LLM.

**Step 2 — record suffix:**
```
rec_id = f"{chunk_id}_{suffix_for_index(record_idx)}"
```
- `record_idx` — the 0-based position of this record within the LLM's response for that chunk.
- The suffix maps the index to a letter: `0→a`, `1→b`, ..., `25→z`, then `26→z1`, `27→z2`, etc.

**Full breakdown of `book_404_askari_wujuh_nazair_0001_b`:**

| Segment | Value | Meaning |
|---|---|---|
| `book_404` | `book_404` | Part of the book slug — internal sequential book number |
| `askari_wujuh_nazair` | `askari_wujuh_nazair` | Slug suffix — abbreviated book/author name |
| `0001` | chunk 1 | First text chunk of this book sent to the LLM |
| `b` | index 1 | Second record returned by the LLM for that chunk |

This scheme guarantees uniqueness across all books and all extraction runs, and makes it easy to trace any opinion back to the exact book, text chunk, and LLM response position it came from.

---

## Categories

The `category` field classifies the *type* of relationship between verses. There are **6 categories** in the current graph:

| Value | Opinion count | Description |
|---|---|---|
| `structural` | 1441 | Verses share a grammatical, syntactic, or rhetorical structure — e.g. parallel sentence patterns, addition/omission of a word, particle variation, word order differences. The most common category. |
| `semantic` | 993 | Verses share a word, root, or concept with overlapping or contrasting meanings. Includes *wujuh wa nazair* (polysemy/homonymy) entries where a term carries different meanings in different verses. |
| `doctrinal` | 764 | Verses are linked through theological or legal (fiqh) reasoning — e.g. apparent contradiction reconciliation, abrogation (naskh), rulings, divine attributes, or clarification of creedal positions. |
| `lexical` | 631 | Verses share a rare word, unusual morphological form, or a specific lexical item whose meaning or parsing grammarians discuss. Focused on the word-level rather than the sentence or theme level. |
| `cross_surah_refrain` | 126 | Verses are part of a repeated refrain or motif that recurs verbatim or near-verbatim across different surahs (e.g. repeated closing phrases like *"فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ"* in Surah Al-Rahman). |
| `thematic` | 69 | Verses share a common topic, narrative, or concept without necessarily sharing wording — a looser thematic grouping used when the relationship is meaningful but not structural or lexical. |

**Frontend recommendation:** Use `category` as an edge color encoding and primary filter control.

---

## Roles

The `role` field describes the structural function of the *source* verse in the relationship.

| Value | Description | Suggested style |
|---|---|---|
| `mutashabih` | The source verse is itself a *mutashabih* (ambiguous/similar) verse — the relationship is one of strong similarity or parallel | Bold / primary edge |
| `supporting` | The source verse provides supporting evidence or context for the relationship | Standard edge |
| `contextual` | The source verse is contextually relevant but is not the primary focus of the scholar's observation | Dashed / muted edge |

---

## Null-primary records

Some extraction records do not identify a single primary verse (common in semantic/wujuh-nazair style entries where a scholar lists many verses together under one theme without singling one out).

**Distribution strategy:**

1. Collect all related verses with concrete `surah` and `ayah` values.
2. Designate the first related verse as a **hub**.
3. Create edges from the hub to every remaining related verse.
4. If `relationship_direction` is `"bidirectional"`, also add reverse edges.
5. Mark all resulting opinions with `distributed_from_null_primary: true`.

**Frontend recommendation:** Show a badge such as `"Distributed (No Primary Ayah)"` and optionally render these edges with a softer/dashed style to distinguish them from directly attested edges.

---

## Deduplication rule

Per directional edge, opinions are deduplicated by `record_id`.

The same extraction record will appear **at most once** per edge, even if the graph-builder encountered it through multiple insertion paths. This prevents inflated opinion counts.

---

## Frontend usage guide

- **Node label:** Use `text_snippet` for compact display; show `text_uthmani` on hover/expand.
- **Edge filtering:** Filter by `category` and `role`; let users toggle each on/off.
- **Opinion count chip:** When a connection has multiple opinions, show a count badge and expand into per-book cards in a side panel.
- **Book attribution:** Display `book_title_ar` and `author_ar` in each opinion card.
- **Summaries:** Show `summary_en` (falling back to `summary_ar`) as the human-readable explanation of the relationship.
- **Wujuh entries:** When `wajh_label` is present, display it prominently — it is the semantic facet being discussed.
- **Confidence:** Optionally surface `confidence` as a visual indicator (e.g. opacity or line weight) to signal extraction reliability.
