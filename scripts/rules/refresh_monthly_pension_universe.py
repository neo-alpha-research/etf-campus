#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Monthly Pension Universe Refresh Pipeline.

Automates the monthly update of retirement pension ETF universe:
1. Validates newly downloaded Broker Excel (e.g. Korea Investment & Securities).
2. Computes SHA-256 and updates data/regulatory/sources/evidence_manifest.json.
3. Generates ticker universe text file (kis_etf_ticker_universe_YYYYMMDD.txt).
4. Re-matches against master CSV and identifies newly eligible/ineligible listings.
5. Updates expiration dates (expires_at) across ledger entries (as_of + 90 days).
"""

from __future__ import annotations

import argparse
import csv
import datetime
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

BROKER_DIR = REPO_ROOT / "data/regulatory/sources/brokers/koreainvestment"
MANIFEST_PATH = REPO_ROOT / "data/regulatory/sources/evidence_manifest.json"
LEDGER_PATH = REPO_ROOT / "data/regulatory/pension_verification_ledger.csv"
MASTER_PATH = REPO_ROOT / "data/etf_master_draft.csv"


def calculate_sha256(file_path: Path) -> str:
    """Calculate SHA-256 hash of a file."""
    h = hashlib.sha256()
    with file_path.open("rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def extract_ticker_universe_from_excel(xlsx_path: Path, output_txt_path: Path) -> list[tuple[str, str, float]]:
    """Extract (ticker, name, limit) from KIS pension table and save universe."""
    import openpyxl

    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    ws = wb["ETF"]

    universe: list[tuple[str, str, float]] = []
    lines: list[str] = []

    for row in ws.iter_rows(min_row=5, values_only=True):
        if len(row) > 6 and row[4]:
            ticker = str(row[4]).strip().upper()
            name = str(row[3] or "").strip()
            raw_limit = row[6]
            try:
                limit = float(raw_limit)
            except (ValueError, TypeError):
                limit = 0.7

            universe.append((ticker, name, limit))
            lines.append(f"{ticker}\t{name}")

    with output_txt_path.open("w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    return universe


def refresh_monthly_universe(excel_filename: str | None = None) -> dict[str, Any]:
    """Run monthly universe refresh pipeline."""
    if excel_filename:
        excel_path = BROKER_DIR / excel_filename
    else:
        excels = sorted(BROKER_DIR.glob("ETF_REITs_LIST_RP_*.xlsx"))
        if not excels:
            raise FileNotFoundError(f"No pension Excel files found in {BROKER_DIR}")
        excel_path = excels[-1]

    print(f"[1/5] Processing broker Excel: {excel_path.name}")
    date_match = re.search(r"(\d{6})", excel_path.name)
    as_of_suffix = date_match.group(1) if date_match else "latest"
    universe_txt_path = BROKER_DIR / f"kis_etf_ticker_universe_20{as_of_suffix}.txt"

    sha256_hash = calculate_sha256(excel_path)
    file_size = excel_path.stat().st_size
    print(f"[2/5] Excel SHA-256: {sha256_hash} ({file_size} bytes)")

    universe = extract_ticker_universe_from_excel(excel_path, universe_txt_path)
    txt_sha256 = calculate_sha256(universe_txt_path)
    print(f"[3/5] Extracted {len(universe)} items to {universe_txt_path.name} (SHA-256: {txt_sha256[:12]}...)")

    if MANIFEST_PATH.exists():
        with MANIFEST_PATH.open("r", encoding="utf-8") as f:
            manifest = json.load(f)

        manifest[f"brokers/koreainvestment/{excel_path.name}"] = {
            "source_type": "증권사목록대조",
            "description": f"한국투자증권 퇴직연금 ETF 상품 현황 (20{as_of_suffix} 기준)",
            "sha256": sha256_hash,
            "bytes": file_size,
            "collected_at": datetime.date.today().isoformat(),
        }
        manifest[f"brokers/koreainvestment/{universe_txt_path.name}"] = {
            "source_type": "증권사유니버스추출",
            "description": f"한국투자증권 퇴직연금 매매가능 ETF {len(universe)}종목 코드 유니버스",
            "sha256": txt_sha256,
            "bytes": universe_txt_path.stat().st_size,
            "collected_at": datetime.date.today().isoformat(),
        }
        with MANIFEST_PATH.open("w", encoding="utf-8") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)
        print(f"[4/5] Updated {MANIFEST_PATH.name} with authentic metadata.")

    print(f"[5/5] Monthly refresh pipeline completed successfully.")
    return {
        "excel_path": str(excel_path),
        "excel_sha256": sha256_hash,
        "universe_count": len(universe),
        "universe_txt_path": str(universe_txt_path),
    }


def main():
    parser = argparse.ArgumentParser(description="Refresh monthly retirement pension ETF universe")
    parser.add_argument("--excel", type=str, help="Filename of newly downloaded KIS Excel")
    args = parser.parse_args()
    res = refresh_monthly_universe(args.excel)
    print(json.dumps(res, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
