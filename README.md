# Ayat Visualization

Pipeline + visualization tooling for extracting Mutashabihat relations from classical books, merging records, and building an ayah-level adjacency graph for frontend exploration.

## What This Repo Contains

- Python extraction pipeline (`cli`, `mutashabihat`).
- Book/run outputs under `output/`.
- Merge utility: `merge_records.py`.
- Ayah graph builder: `build_ayah_graph.py`.
- Frontend app in `frontend/` for interactive graph exploration.

## Prerequisites

- Windows + PowerShell.
- Python 3.12 installed at:
  - `C:\Users\ElhassanElboraey\AppData\Local\Programs\Python\Python312\python.exe`
- Node.js + npm (for `frontend/`).

## Environment Setup

1. Copy `.env.example` to `.env`.
2. Set at least:
   - `GEMINI_API_KEY`
   - optionally `GEMINI_MODEL`, delay/retry values.

## Python Install

Use this command pattern in PowerShell:

```powershell
$py = "C:\Users\ElhassanElboraey\AppData\Local\Programs\Python\Python312\python.exe"
& $py -m pip install -r requirements.txt
```

## Core Workflows

### 1) Extract a single book

```powershell
$py = "C:\Users\ElhassanElboraey\AppData\Local\Programs\Python\Python312\python.exe"
& $py -u -m cli.extract --book book_22_iskafi_durra_tanzil --force --delay 2.0
```

Important flags (`cli/extract.py`):

- `--book` (required)
- `--source` (default source dir)
- `--model`
- `--limit`
- `--force`
- `--delay`
- `--run-id`

### 2) Run all configured books sequentially

```powershell
$py = "C:\Users\ElhassanElboraey\AppData\Local\Programs\Python\Python312\python.exe"
& $py -u run_all_books.py
```

### 3) Merge per-book records (dedupe by `id`)

```powershell
$py = "C:\Users\ElhassanElboraey\AppData\Local\Programs\Python\Python312\python.exe"
& $py merge_records.py
```

Output:

- `output/merged/book_<slug>.jsonl`

### 4) Build ayah adjacency graph

```powershell
$py = "C:\Users\ElhassanElboraey\AppData\Local\Programs\Python\Python312\python.exe"
& $py build_ayah_graph.py
```

Output:

- `output/ayah_graph.json`
- `output/ayah_graph_README.md` (schema + frontend mapping details)

## Output Structure

- `output/book_<slug>/<run_id>/records.jsonl` - per-run extraction records.
- `output/book_<slug>/<run_id>/run_log.json` - run progress/logging.
- `output/book_<slug>/<run_id>/extraction_state.json` - resumable state.
- `output/merged/*.jsonl` - latest deduplicated records per book.
- `output/ayah_graph.json` - combined adjacency graph.

## Frontend

From `frontend/`:

```powershell
npm install
npm run dev
```

Build and preview:

```powershell
npm run build
npm run preview
```

For frontend schema/runtime notes, see `frontend/README.md`.

## Notes

- Main extraction provider is configured through environment variables.
- The merge step is intended after multiple runs/books complete.
- The graph builder consumes `output/merged/*.jsonl`, not raw per-run files.
