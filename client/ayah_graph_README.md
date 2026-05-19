# Ayah Adjacency Graph

This file documents the graph generated at `output/ayah_graph.json`.

## What this graph is

- A verse-level adjacency list keyed by `surah:ayah` (for example `2:124`).
- Each node contains verse metadata.
- Each connection (`source -> target`) contains an `opinions` array.
- Every opinion is attributed to its source book and extraction record.

## File structure

Top-level structure:

- `meta.generated`: UTC timestamp of graph generation.
- `meta.total_records_processed`: number of JSONL records read.
- `meta.total_nodes`: number of ayah nodes.
- `meta.total_edges`: number of directional edges.
- `meta.total_opinions`: number of opinion entries on edges.
- `meta.source_books`: number of unique source books.
- `nodes`: object keyed by `surah:ayah`.

Node structure:

- `surah`, `ayah`
- `surah_name_ar`, `surah_name_en`
- `text_uthmani`, `text_snippet`
- `juz`, `hizb_quarter`, `ayah_no_quran`
- `connections`: object keyed by target `surah:ayah`

Connection structure:

- `target_surah`, `target_ayah`
- `target_text_uthmani`, `target_text_snippet`
- `opinions`: list of attributed scholarly opinions

Opinion structure:

- `record_id` (unique extraction record id)
- `book_id`, `book_title_ar`, `author_ar`, `source_page`
- `category`, `secondary_categories`, `subcategory`
- `role` (`mutashabih`, `contextual`, `supporting`)
- `relationship_direction` (usually `bidirectional`)
- `wajh_label` (when available)
- `summary_ar`, `summary_en`, `confidence`
- `distributed_from_null_primary` (boolean)

## Null-primary records (`primary.surah = null`)

Some records do not have a concrete primary verse (common in semantic/wujuh-nazair style entries).

Distribution strategy used:

1. Keep related verses that contain concrete `surah` and `ayah`.
2. Use the first related verse as a hub.
3. Create edges from hub to each remaining related verse.
4. If the relation is `bidirectional`, also add reverse edges.
5. Mark these opinions with `distributed_from_null_primary: true`.

This keeps semantic opinions discoverable in a verse graph without inventing fake primary ayah nodes.

## Categories and how to treat them in frontend

Typical `category` values:

- `structural`
- `semantic`
- `lexical`
- `cross_surah_refrain`

Recommended frontend behavior:

- Use category as a filter and color encoding for edges/opinions.
- For null-primary distributed opinions (`distributed_from_null_primary=true`), show a badge such as `Distributed (No Primary Ayah)` and optionally a softer edge style.
- Use `role` to style edge semantics:
  - `mutashabih`: strong similarity edge
  - `supporting`: supporting evidence edge
  - `contextual`: context-only edge
- Group duplicate source-target edges by target node and display all book opinions in a side panel.
- When multiple books discuss the same edge, show an "opinions count" chip and expand into per-book cards.

## Deduplication rule

Per edge, opinions are deduplicated by `record_id`.

Meaning:

- For the same directional edge, the same record appears only once.
- This avoids inflated opinion counts caused by repeated insertion paths.
