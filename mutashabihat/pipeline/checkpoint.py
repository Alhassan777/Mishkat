from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def append_jsonl(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(payload, ensure_ascii=False) + "\n")


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _atomic_write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


class ExtractionState:
    def __init__(
        self,
        *,
        slug: str,
        model: str,
        out_dir: Path,
        total_chunks: int = 0,
        started_at: str | None = None,
    ) -> None:
        self.slug = slug
        self.model = model
        self.out_dir = out_dir
        self.state_path = out_dir / "extraction_state.json"
        self.run_log_path = out_dir / "run_log.json"
        self.legacy_chunks_done_path = out_dir / "chunks_done.jsonl"

        self.status = "in_progress"
        self.total_chunks = total_chunks
        self.last_completed_chunk_idx = 0
        self.done_chunks: set[str] = set()
        self.failed_chunk_ids: set[str] = set()
        self.chunk_retry_count: dict[str, int] = {}

        # Runtime stats
        self.ok = 0
        self.errors = 0
        self.skipped = 0
        self.chunks_processed = 0
        self.chunks_failed = 0
        self.chunks_skipped = 0
        self.tokens_in = 0
        self.tokens_out = 0
        self.error_list: list[dict[str, Any]] = []
        self.warning_list: list[str] = []

        self.started_at = started_at or _utc_now_iso()
        self.updated_at = _utc_now_iso()
        self.finished_at: str | None = None

    @classmethod
    def load(
        cls,
        *,
        slug: str,
        model: str,
        out_dir: Path,
        total_chunks: int,
        force: bool = False,
    ) -> "ExtractionState":
        out_dir.mkdir(parents=True, exist_ok=True)
        if force:
            return cls(slug=slug, model=model, out_dir=out_dir, total_chunks=total_chunks)

        if (out_dir / "extraction_state.json").exists():
            raw = json.loads((out_dir / "extraction_state.json").read_text(encoding="utf-8"))
            state = cls(
                slug=raw.get("slug") or slug,
                model=raw.get("model") or model,
                out_dir=out_dir,
                total_chunks=int(raw.get("total_chunks") or total_chunks),
                started_at=raw.get("started_at"),
            )
            state._hydrate(raw)
            # Keep latest runtime choices
            state.slug = slug
            state.model = model
            state.total_chunks = total_chunks
            state.status = "in_progress"
            state.finished_at = None
            state.updated_at = _utc_now_iso()
            state.save()
            return state

        # Backward compatibility: import old chunks_done.jsonl if present.
        state = cls(slug=slug, model=model, out_dir=out_dir, total_chunks=total_chunks)
        if state.legacy_chunks_done_path.exists():
            for line in state.legacy_chunks_done_path.read_text(encoding="utf-8", errors="ignore").splitlines():
                try:
                    payload = json.loads(line)
                except Exception:
                    continue
                chunk_id = payload.get("chunk_id")
                if isinstance(chunk_id, str) and chunk_id:
                    state.done_chunks.add(chunk_id)
            state.chunks_processed = len(state.done_chunks)
            state.last_completed_chunk_idx = state._max_completed_chunk_index()
        state.save()
        return state

    def _hydrate(self, payload: dict[str, Any]) -> None:
        self.status = str(payload.get("status") or "in_progress")
        self.total_chunks = int(payload.get("total_chunks") or self.total_chunks)
        self.last_completed_chunk_idx = int(payload.get("last_completed_chunk_idx") or 0)
        self.done_chunks = {
            c for c in payload.get("done_chunk_ids", [])
            if isinstance(c, str) and c
        }
        self.failed_chunk_ids = {
            c for c in payload.get("failed_chunk_ids", [])
            if isinstance(c, str) and c
        }
        retry_payload = payload.get("chunk_retry_count", {})
        if isinstance(retry_payload, dict):
            self.chunk_retry_count = {
                str(k): int(v)
                for k, v in retry_payload.items()
                if isinstance(k, str) and isinstance(v, int)
            }
        self.ok = int(payload.get("ok") or 0)
        self.errors = int(payload.get("errors") or 0)
        self.skipped = int(payload.get("skipped") or 0)
        self.chunks_processed = int(payload.get("chunks_processed") or len(self.done_chunks))
        self.chunks_failed = int(payload.get("chunks_failed") or len(self.failed_chunk_ids))
        self.chunks_skipped = int(payload.get("chunks_skipped") or 0)
        self.tokens_in = int(payload.get("tokens_in") or 0)
        self.tokens_out = int(payload.get("tokens_out") or 0)
        self.error_list = [
            item for item in payload.get("error_list", [])
            if isinstance(item, dict)
        ]
        self.warning_list = [
            item for item in payload.get("warning_list", [])
            if isinstance(item, str)
        ]
        self.updated_at = str(payload.get("updated_at") or _utc_now_iso())
        self.finished_at = payload.get("finished_at")

    def _max_completed_chunk_index(self) -> int:
        highest = 0
        for chunk_id in self.done_chunks:
            suffix = chunk_id.rsplit("_", 1)[-1]
            if suffix.isdigit():
                highest = max(highest, int(suffix))
        return highest

    def add_usage(self, usage: dict[str, int]) -> None:
        self.tokens_in += usage.get("tokens_in", 0)
        self.tokens_out += usage.get("tokens_out", 0)
        self.save()

    def add_warning(self, warning: str) -> None:
        self.warning_list.append(warning)
        self.save()

    def mark_error(self, entry: str, err: str) -> None:
        self.errors += 1
        self.error_list.append({"entry": entry, "error": err})
        self.save()

    def is_chunk_done(self, chunk_id: str) -> bool:
        return chunk_id in self.done_chunks

    def mark_chunk_skipped(self) -> None:
        self.skipped += 1
        self.chunks_skipped += 1
        self.save()

    def mark_chunk_done(self, chunk_id: str, chunk_idx: int) -> None:
        self.done_chunks.add(chunk_id)
        self.failed_chunk_ids.discard(chunk_id)
        self.chunks_processed = len(self.done_chunks)
        self.last_completed_chunk_idx = max(self.last_completed_chunk_idx, chunk_idx)
        self.status = "in_progress"
        self.save()

    def mark_chunk_failed(self, chunk_id: str, reason: str) -> None:
        self.failed_chunk_ids.add(chunk_id)
        self.chunk_retry_count[chunk_id] = self.chunk_retry_count.get(chunk_id, 0) + 1
        self.chunks_failed = len(self.failed_chunk_ids)
        self.mark_error(chunk_id, reason)
        self.status = "in_progress"
        self.save()

    def mark_completed(self) -> None:
        self.status = "completed"
        self.finished_at = _utc_now_iso()
        self.save()

    def mark_failed(self) -> None:
        self.status = "failed"
        self.finished_at = _utc_now_iso()
        self.save()

    @property
    def progress_pct(self) -> float:
        if self.total_chunks <= 0:
            return 0.0
        return round((len(self.done_chunks) / self.total_chunks) * 100, 2)

    def to_dict(self) -> dict[str, Any]:
        cost = (self.tokens_in * 0.30 + self.tokens_out * 2.50) / 1_000_000
        return {
            "slug": self.slug,
            "model": self.model,
            "status": self.status,
            "total_chunks": self.total_chunks,
            "chunks_completed": len(self.done_chunks),
            "chunks_processed": self.chunks_processed,
            "chunks_failed": len(self.failed_chunk_ids),
            "chunks_skipped": self.chunks_skipped,
            "records_written": self.ok,
            "ok": self.ok,
            "errors": self.errors,
            "skipped": self.skipped,
            "last_completed_chunk_idx": self.last_completed_chunk_idx,
            "done_chunk_ids": sorted(self.done_chunks),
            "failed_chunk_ids": sorted(self.failed_chunk_ids),
            "chunk_retry_count": self.chunk_retry_count,
            "tokens_in": self.tokens_in,
            "tokens_out": self.tokens_out,
            "est_cost_usd": round(cost, 6),
            "progress_pct": self.progress_pct,
            "started_at": self.started_at,
            "updated_at": self.updated_at,
            "finished_at": self.finished_at,
            "error_list": self.error_list,
            "warning_list": self.warning_list,
        }

    def save(self) -> None:
        self.updated_at = _utc_now_iso()
        payload = self.to_dict()
        _atomic_write_json(self.state_path, payload)
        # Keep run_log for compatibility with existing tooling.
        _atomic_write_json(self.run_log_path, payload)

