#!/usr/bin/env python3
"""Add listing-date provenance to the ETF Campus detail header."""

from __future__ import annotations

import argparse
from pathlib import Path

OLD = '                <span>상장일: {formatDate(etf.listingDate) || "-"}</span>'
NEW = '''                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span>상장일: {formatDate(etf.listingDate) || "-"}</span>
                  {etf.listingDateSource && (
                    <span className="text-[11px] font-semibold text-brand-700">
                      {etf.listingDateSource}
                    </span>
                  )}
                </div>'''


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--file", type=Path, required=True)
    args = parser.parse_args()

    content = args.file.read_text(encoding="utf-8")
    if NEW in content:
        print("Listing-date provenance display is already applied.")
        return 0
    if OLD not in content:
        raise ValueError("Expected listing-date JSX was not found; no change applied.")
    args.file.write_text(content.replace(OLD, NEW, 1), encoding="utf-8")
    print(f"Updated: {args.file}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
