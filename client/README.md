# Client README

Mishkāt frontend application (Next.js 16).

## Features

- 3D verse-connection graph explorer
- Category filters and search
- Detail drawer with per-edge scholarly opinions
- Arabic/English UI support
- Quran Foundation API enrichment (verse content, tafsir, recitation)
- Optional sign-in and bookmarks

## Setup

```powershell
cd client
npm install
```

Create `client/.env.local` from `client/.env.example` and add credentials.

## Development

```powershell
npm run dev
```

## Production Build

```powershell
npm run build
npm run start
```

## Data Dependency

Frontend reads:

- `public/data/graph.json`

To regenerate this file from the canonical graph:

```powershell
$py = "python" # or ".\.venv\Scripts\python.exe"
& $py scripts/build_graph_data.py
```

The source graph for that script is:

- `../data/graph/ayah_graph.json`
