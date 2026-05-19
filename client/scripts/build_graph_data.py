"""Slim the full ayah_graph.json into a web-friendly format.

Outputs:
  public/data/graph.json — nodes + edges with deduped book/author lookup tables.

Run:
  python3 scripts/build_graph_data.py
"""
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "ayah_graph.json"
OUT = ROOT / "public" / "data" / "graph.json"


def short_author(au_full: str) -> str:
    """Extract a short author label from a long Arabic bio string."""
    if not au_full:
        return ""
    # Strip parenthetical death-year tail like "(ت 437 هـ)"
    txt = au_full.split("(")[0].strip()
    parts = txt.split()
    return " ".join(parts[:4]) if len(parts) > 4 else txt


def main() -> None:
    with SRC.open(encoding="utf-8") as f:
        data = json.load(f)

    raw_nodes = data["nodes"]

    # Build dedup tables for books and authors.
    book_ids: dict[str, int] = {}
    books: list[dict] = []

    def book_idx(title: str, author: str) -> int:
        key = f"{title}||{author}"
        if key not in book_ids:
            book_ids[key] = len(books)
            books.append({"t": title or "", "a": short_author(author or "")})
        return book_ids[key]

    # Slim nodes — keep references only; full text deduped.
    slim_nodes: dict[str, dict] = {}
    for nid, n in raw_nodes.items():
        slim_nodes[nid] = {
            "s": n["surah"],
            "a": n["ayah"],
            "sn": n.get("surah_name_en", ""),
            "sna": n.get("surah_name_ar", ""),
            "t": n.get("text_uthmani", ""),
            "j": n.get("juz", 0),
            "hq": n.get("hizb_quarter", 0),
            "n": n.get("ayah_no_quran", 0),
        }

    # Edges — undirected; dedupe by sorted pair.
    # Source data lists each connection from both endpoints with the same
    # record_id, so we must dedupe opinions per edge by record_id. Self-loops
    # (an āyah listed as connected to itself) are dropped entirely.
    edges: list[dict] = []
    seen: dict[str, int] = {}
    edge_record_ids: list[set[str]] = []
    self_loops_dropped = 0
    duplicate_opinions_dropped = 0

    for src, n in raw_nodes.items():
        for tgt, conn in n.get("connections", {}).items():
            if src == tgt:
                self_loops_dropped += 1
                continue
            key = "|".join(sorted([src, tgt]))
            if key in seen:
                idx = seen[key]
            else:
                idx = len(edges)
                seen[key] = idx
                edges.append({
                    "a": key.split("|")[0],
                    "b": key.split("|")[1],
                    "ops": [],
                })
                edge_record_ids.append(set())
            for op in conn.get("opinions", []):
                rid = op.get("record_id")
                if rid and rid in edge_record_ids[idx]:
                    duplicate_opinions_dropped += 1
                    continue
                if rid:
                    edge_record_ids[idx].add(rid)
                slim_op = {
                    "bk": book_idx(op.get("book_title_ar"), op.get("author_ar")),
                    "c": op.get("category") or "",
                }
                if op.get("subcategory"):
                    slim_op["sc"] = op["subcategory"]
                if op.get("role"):
                    slim_op["r"] = op["role"]
                if op.get("wajh_label"):
                    slim_op["w"] = op["wajh_label"]
                if op.get("summary_ar"):
                    slim_op["sa"] = op["summary_ar"]
                if op.get("summary_en"):
                    slim_op["se"] = op["summary_en"]
                if op.get("confidence") is not None:
                    slim_op["cf"] = round(float(op["confidence"]), 2)
                if op.get("source_page"):
                    slim_op["p"] = op["source_page"]
                edges[idx]["ops"].append(slim_op)

    # Compact per-node edge-index lists for fast lookup.
    node_edges: dict[str, list[int]] = {nid: [] for nid in slim_nodes}
    for i, e in enumerate(edges):
        node_edges[e["a"]].append(i)
        if e["b"] != e["a"]:
            node_edges[e["b"]].append(i)
    for nid, idxs in node_edges.items():
        slim_nodes[nid]["e"] = idxs

    # Dominant category per edge — used for color/filter in the graph layer.
    for e in edges:
        cats: dict[str, int] = {}
        for op in e["ops"]:
            cats[op["c"]] = cats.get(op["c"], 0) + 1
        e["pc"] = max(cats.items(), key=lambda kv: kv[1])[0] if cats else ""
        e["w"] = len(e["ops"])  # weight = opinion count

    out = {
        "meta": {
            "nodes": len(slim_nodes),
            "edges": len(edges),
            "books": len(books),
        },
        "books": books,
        "nodes": slim_nodes,
        "edges": edges,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

    size_mb = OUT.stat().st_size / (1024 * 1024)
    print(f"Wrote {OUT}")
    print(f"  nodes={len(slim_nodes)} edges={len(edges)} books={len(books)}")
    print(f"  dropped: {self_loops_dropped} self-loops, {duplicate_opinions_dropped} duplicate opinions")
    print(f"  size={size_mb:.2f} MB")


if __name__ == "__main__":
    main()
