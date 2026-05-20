# Mishkāt Dataset Card

## Dataset Name

Mishkāt Mutashābihāt Graph Dataset (v0.1)

## Contents

- `sources/` — source markdown books (14 classical works)
- `graph/ayah_graph.json` — canonical verse adjacency graph
- `graph/schema.md` — graph field documentation
- `extracted/sample_records.jsonl` — representative extraction sample
- `extracted/record_schema.json` — record schema exported from Pydantic

## Source Provenance

Source corpus consists of Shamela-format markdown exports.  
Book IDs are mapped through `pipeline/mutashabihat/registry.py`.

## Data Schema Summary

### Record-level (JSONL)

- Verse references (`primary`, `related`)
- Category and subcategory
- Source attribution (book + author + page/section)
- Arabic and English summaries
- Category payloads for structural/semantic/lexical/etc.

### Graph-level (JSON)

- `meta`
- `nodes` keyed by `surah:ayah`
- adjacency `connections` with `opinions` (scholarly records per edge)

## Snapshot Metrics

Current shipped graph:

- ~1900 nodes
- ~1600 edges
- 14 source books represented in graph metadata

## Known Constraints

- Extraction quality varies by source structure.
- Coverage is incomplete for two future-expansion books.
- Some records require manual expert review for strict scholarly categorization.

## Citation

If you reuse this dataset, cite:

`Mishkāt — Mutashābihāt Visualizer, Threadwork Team, 2026, open hackathon dataset release.`
