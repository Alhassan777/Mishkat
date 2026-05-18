# Ayat Visualization Frontend

Interactive "Infinite Ink" visualization of Mutashabihat connections.

## Data Model Sync (Updated)

The frontend has been aligned with recent backend model upgrades:

- Typed top-level categories and parent disciplines.
- `pair_keys` support for cross-book verse-pair grouping.
- Relationship edge metadata:
  - `direction`: `bidirectional | directed | group`
  - `role`: `mutashabih | clarifying | supporting | contextual`
- `confidence` is nullable (`number | null`) to match backend records.
- Runtime validation in dev mode warns when loaded records drift from expected shape.

### Keep Frontend/Backend Schemas In Sync

From the repository root, regenerate the schema from Python models:

```bash
python -m mutashabihat.generate_schema
```

This writes:

- `frontend/src/data/schema.json`

The loader performs dev-time validation via:

- `frontend/src/data/validate.ts`

## Run

```bash
npm install
npm run dev
```

## Build And Preview

```bash
npm run build
npm run preview
```

## Notes

- `npm run build` now emits `dist/data/records.json` from JSONL source files.
- URL state is shareable via query params (`focus`, `category`, `q`, `sf`, `st`, `mc`).
- Touch devices default to 2D graph mode for smoother interaction.
- Directed edges render with arrows; group relations are expanded as clique edges for dense clusters.
