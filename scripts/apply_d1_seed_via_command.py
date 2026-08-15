#!/usr/bin/env python3
"""Apply a D1 seed through Wrangler --command in bounded SQL batches.

This avoids the Windows-specific failure observed with Wrangler's --file upload
path while preserving the original idempotent INSERT ... ON CONFLICT statements.
"""
from __future__ import annotations

import argparse
import subprocess
from pathlib import Path


def seed_inserts(path: Path) -> list[str]:
    inserts = [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.lstrip().upper().startswith("INSERT")]
    if not inserts:
        raise ValueError("No INSERT statements found")
    return inserts


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", type=Path, required=True)
    parser.add_argument("--batch-size", type=int, default=10)
    parser.add_argument("--start-batch", type=int, default=1)
    parser.add_argument("--end-batch", type=int)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if args.batch_size < 1:
        raise ValueError("--batch-size must be positive")

    inserts = seed_inserts(args.seed)
    batches = [inserts[index : index + args.batch_size] for index in range(0, len(inserts), args.batch_size)]
    end_batch = args.end_batch or len(batches)
    if not (1 <= args.start_batch <= end_batch <= len(batches)):
        raise ValueError(f"Batch range must be within 1..{len(batches)}")

    for number in range(args.start_batch, end_batch + 1):
        sql = "BEGIN TRANSACTION;\n" + "\n".join(batches[number - 1]) + "\nCOMMIT;"
        print(f"Applying batch {number}/{len(batches)} ({len(batches[number - 1])} rows)", flush=True)
        if args.dry_run:
            continue
        command = [
            "npx.cmd", "wrangler", "d1", "execute", "etf-prices", "--remote",
            "--command", sql, "--yes",
        ]
        completed = subprocess.run(command, check=False, capture_output=True)
        print(completed.stdout.decode("utf-8", errors="replace"), end="", flush=True)
        if completed.returncode != 0:
            print(completed.stderr.decode("utf-8", errors="replace"), end="", flush=True)
            raise SystemExit(completed.returncode)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
