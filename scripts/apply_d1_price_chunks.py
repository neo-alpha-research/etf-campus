#!/usr/bin/env python3
"""Apply generated ETF-price SQL chunks to remote D1 safely.

The backfill generator writes one UPSERT statement per chunk.  This tool
combines a bounded number of those statements into a temporary SQL file,
uploads it with Wrangler, and records a restart checkpoint only after D1
acknowledges the batch.  Existing price rows are never deleted.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path


def insert_statement(path: Path) -> str:
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.lstrip().upper().startswith("INSERT INTO ETF_PRICES"):
            return line.strip()
    raise ValueError(f"No etf_prices INSERT statement found: {path}")


def load_checkpoint(path: Path) -> int:
    if not path.exists():
        return 0
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        return max(0, int(payload.get("next_chunk_index", 0)))
    except (ValueError, json.JSONDecodeError):
        return 0


def save_checkpoint(path: Path, next_chunk_index: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps({"next_chunk_index": next_chunk_index}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def print_process_output(value: str) -> None:
    encoding = sys.stdout.encoding or "utf-8"
    print(value.encode(encoding, errors="replace").decode(encoding), end="")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--chunk-dir", type=Path, default=Path("data/backups/sql_chunks"))
    parser.add_argument("--checkpoint", type=Path, default=Path("data/backups/d1_price_upload_checkpoint.json"))
    parser.add_argument("--chunks-per-batch", type=int, default=10)
    parser.add_argument("--max-batches", type=int, help="Apply at most this many batches in one invocation")
    parser.add_argument("--reset-checkpoint", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if args.chunks_per_batch < 1:
        parser.error("--chunks-per-batch must be positive")
    chunks = sorted(args.chunk_dir.glob("chunk_*.sql"))
    if not chunks:
        parser.error(f"No chunks found in {args.chunk_dir}")

    start = 0 if args.reset_checkpoint else load_checkpoint(args.checkpoint)
    if start >= len(chunks):
        print(f"Already complete: {len(chunks)} chunks.")
        return 0

    completed_batches = 0
    for batch_start in range(start, len(chunks), args.chunks_per_batch):
        batch = chunks[batch_start : batch_start + args.chunks_per_batch]
        # Wrangler's remote D1 file executor rejects explicit BEGIN/COMMIT.
        # Every statement is an idempotent UPSERT, so retrying a failed batch is safe.
        sql = "\n".join(insert_statement(path) for path in batch) + "\n"
        print(f"Applying chunks {batch_start + 1}-{batch_start + len(batch)}/{len(chunks)}", flush=True)
        if args.dry_run:
            continue
        with tempfile.NamedTemporaryFile("w", suffix=".sql", encoding="utf-8", delete=False) as handle:
            temporary_path = Path(handle.name)
            handle.write(sql)
        try:
            completed = subprocess.run(
                ["npx", "wrangler", "d1", "execute", "etf-prices", "--remote", "--file", str(temporary_path), "--yes"],
                check=False,
                text=True,
                capture_output=True,
                encoding="utf-8",
                errors="replace",
            )
            if completed.returncode:
                print_process_output(completed.stdout)
                print_process_output(completed.stderr)
                return completed.returncode
        finally:
            temporary_path.unlink(missing_ok=True)
        save_checkpoint(args.checkpoint, batch_start + len(batch))
        completed_batches += 1
        if args.max_batches and completed_batches >= args.max_batches:
            print("Stopped at requested batch limit.")
            return 0

    print(f"Completed {len(chunks)} chunks.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
