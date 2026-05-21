# Mishkāt — Mutashābihāt Visualizer

Mishkāt is a research-to-product pipeline that transforms classical mutashābihāt scholarship into an interactive 3D Qur'ānic verse graph.  
It extracts structured relations from 14 source books, validates references, merges records, builds an adjacency graph, and serves it in a modern web experience.

## Why This Matters

Students and readers often struggle to navigate distributed mutashābihāt discussions across many classical books.  
Mishkāt centralizes those discussions into searchable, explorable verse-to-verse links.

## What You Get

- **Impact on Quran Engagement:** discover verse parallels through visual exploration and scholarly summaries.
- **Product Quality:** responsive Next.js client with filtering, search, Arabic-first display, and Qur'an API enrichment.
- **Technical Execution:** resumable extraction pipeline, typed record schema, merge logic, and graph build stage.
- **Innovation:** open, structured mutashābihāt dataset assembled from multiple classical sources.
- **Effective API Use:** integrated Quran Foundation APIs for verse content, tafsir, recitation, and auth features.

## Repository Layout

- `pipeline/` — extraction and graph-building backend.
- `client/` — web application.
- `data/sources/` — source markdown books.
- `data/graph/` — canonical graph artifact and schema notes.
- `data/extracted/` — sample extracted records + schema.
- `docs/` — architecture, data, pipeline, and API documentation.

## Quick Start

### 1) Install Python dependencies

```powershell
python -m pip install -r requirements.txt
```

> On Windows, if `python` is not in your PATH, use the full path to your Python executable, e.g.:
> `& "C:\Path\To\python.exe" -m pip install -r requirements.txt`

### 2) Configure environment

1. Copy `.env.example` to `.env`.
2. Set at least `GEMINI_API_KEY`.

### 3) Run extraction for one book

```powershell
python -m pipeline.cli.extract --book book_22_iskafi_durra_tanzil --source data/sources --delay 2.0
```

### 4) Merge and build graph

```powershell
python pipeline/scripts/merge_records.py
python pipeline/scripts/build_ayah_graph.py
python client/scripts/build_graph_data.py
```

### 5) Run frontend

```powershell
cd client
npm install
npm run dev
```

## Documentation

- `docs/DATA.md` — sources, schema, extraction iterations, limitations, applications.
- `docs/PIPELINE.md` — pipeline flow and operational details.
- `docs/API_INTEGRATION.md` — Quran Foundation API usage.
- `data/README.md` — dataset card.
- `pipeline/README.md` — backend operator guide.
- `client/README.md` — frontend guide.

## Team

- Team: Threadwork
- Product: Mishkāt — Mutashābihāt Visualizer
