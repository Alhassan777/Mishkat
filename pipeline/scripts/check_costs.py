import json
from pathlib import Path

PIPELINE_ROOT = Path(__file__).resolve().parents[1]
output = PIPELINE_ROOT / "output"
profiles = PIPELINE_ROOT / "book_profiles"

total = 0.0
print("=== EXTRACTION COSTS (from run_log.json) ===")
for d in sorted(output.iterdir()):
    if not d.is_dir():
        continue
    rlog = d / "run_log.json"
    if rlog.exists():
        log = json.loads(rlog.read_text(encoding="utf-8"))
        cost = log.get("est_cost_usd", 0)
        tok_in = log.get("tokens_in", 0)
        tok_out = log.get("tokens_out", 0)
        ok = log.get("ok", 0)
        model = log.get("model", "?")
        total += cost
        print(f"  {d.name}")
        print(f"    model={model}  ok={ok}  in={tok_in:,}  out={tok_out:,}  cost=${cost:.4f}")

print(f"\nExtraction subtotal: ${total:.4f}")

# Also check book_79 which ran multiple times
print("\n=== ACTIVE EXTRACTION (current records count) ===")
for d in sorted(output.iterdir()):
    if not d.is_dir():
        continue
    recs = d / "records.jsonl"
    if recs.exists():
        n = sum(1 for _ in recs.open(encoding="utf-8"))
        print(f"  {d.name}: {n} records")
