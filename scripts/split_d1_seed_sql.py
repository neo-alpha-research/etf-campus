#!/usr/bin/env python3
"""Split a D1 SQL seed into small transaction files for reliable remote execution."""
from __future__ import annotations

import argparse
from pathlib import Path


def statements(sql: str) -> list[str]:
    output: list[str] = []
    buffer: list[str] = []
    in_quote = False
    for char in sql:
        if char == "'":
            in_quote = not in_quote
        buffer.append(char)
        if char == ";" and not in_quote:
            statement = "".join(buffer).strip()
            if statement:
                output.append(statement)
            buffer = []
    trailing = "".join(buffer).strip()
    if trailing:
        output.append(trailing)
    return output


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--statements-per-file", type=int, default=50)
    args = parser.parse_args()
    if args.statements_per_file < 1:
        raise ValueError("--statements-per-file must be positive")

    sql = args.input.read_text(encoding="utf-8")
    items = [item for item in statements(sql) if item.upper().startswith("INSERT")]
    if not items:
        raise ValueError("No INSERT statements found in seed SQL")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    for old_file in args.output_dir.glob("listing_dates_*.sql"):
        old_file.unlink()
    for index in range(0, len(items), args.statements_per_file):
        chunk = items[index : index + args.statements_per_file]
        path = args.output_dir / f"listing_dates_{index // args.statements_per_file + 1:03d}.sql"
        path.write_text("BEGIN TRANSACTION;\n" + "\n".join(chunk) + "\nCOMMIT;\n", encoding="utf-8")
    print(f"Statements: {len(items)}")
    print(f"Chunks: {(len(items) + args.statements_per_file - 1) // args.statements_per_file}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
