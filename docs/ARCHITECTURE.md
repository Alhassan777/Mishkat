# Architecture

## System Overview

```mermaid
flowchart LR
  subgraph sources [Source Layer]
    mdBooks["Shamela Markdown Books"]
  end

  subgraph backend [Pipeline Layer]
    profiler["Book Profiling"]
    extractor["Chunked LLM Extraction"]
    verifier["Verse Verification"]
    merger["Record Merge"]
    graphBuilder["Graph Builder"]
  end

  subgraph frontend [Application Layer]
    slimmer["Graph Slimming Script"]
    webClient["Next.js Client"]
    qfApi["Quran Foundation APIs"]
  end

  mdBooks --> profiler
  mdBooks --> extractor
  profiler --> extractor
  extractor --> verifier
  verifier --> merger
  merger --> graphBuilder
  graphBuilder --> slimmer
  slimmer --> webClient
  qfApi --> webClient
```

## Key Boundaries

- `pipeline/` handles extraction, validation, and graph construction.
- `data/` stores source corpus and open dataset artifacts.
- `client/` handles user-facing exploration and API-driven enrichment.

## Further Reading

- [Pipeline Iterations & Lessons Learned](LESSONS_LEARNED.md): A detailed history of the engineering challenges and solutions encountered while building the data extraction pipeline.
