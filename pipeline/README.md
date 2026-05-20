# Pipeline README

This folder contains the full extraction and graph construction backend for Mishkāt.

## Structure

- `mutashabihat/` — core package (models, chunking, verifier, prompts)
- `cli/` — extraction CLI entrypoint
- `scripts/` — orchestration scripts
- `output/` — runtime artifacts (gitignored)
- `book_profiles/` — generated profiling metadata (gitignored)

## Requirements

- Python 3.12
- Dependencies from root `requirements.txt`
- `.env` at repository root with required API keys

## Common Commands

```powershell
$py = "C:\Users\ElhassanElboraey\AppData\Local\Programs\Python\Python312\python.exe"
```

### Show source/profile status

```powershell
& $py -m pipeline.scripts.profile_books --source data/sources list
```

### Profile all books

```powershell
& $py -m pipeline.scripts.profile_books --source data/sources profile --all
```

### Extract one book

```powershell
& $py -m pipeline.cli.extract --book book_22_iskafi_durra_tanzil --source data/sources
```

### Run orchestrated pipeline

```powershell
& $py pipeline/scripts/run_all.py
```

### Merge and build graph

```powershell
& $py pipeline/scripts/merge_records.py
& $py pipeline/scripts/build_ayah_graph.py
```

## Notes

- Runs are resumable.
- Chunk-level failures are tracked in state and logs.
- Output graph is later slimmed by the client build script.
