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
AUDIT_PUB_PATH = REPO_ROOT / "public/data/regulatory/pension_audit_ledger.csv"
AUDIT_DATA_PATH = REPO_ROOT / "data/regulatory/pension_audit_ledger.csv"
MASTER_PATH = REPO_ROOT / "data/etf_master_draft.csv"


def calculate_sha256(file_path: Path) -> str:
    """Calculate SHA-256 hash of a file."""
    h = hashlib.sha256()
    with file_path.open("rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def validate_excel_structure(ws: Any) -> None:
    """Step 1: Strictly validate KIS Excel structure and exclusion policy text.
    
    Raises ValueError immediately on any discrepancy to prevent silent corruption.
    """
    # 1. Row 2 exclusion text assertion
    row2_cells = [str(cell.value or "") for cell in ws[2]]
    row2_text = " ".join(row2_cells)
    required_keywords = ["매매불가", "레버리지", "인버스", "파생형", "해외상장"]
    missing_kws = [kw for kw in required_keywords if kw not in row2_text]
    if missing_kws:
        raise ValueError(
            f"Excel integrity error: Row 2 is missing mandatory exclusion keywords: {missing_kws}. "
            f"Full row 2 content: '{row2_text[:120]}...'"
        )

    # 2. Row 3 column header assertions
    row3_cells = [str(cell.value or "").strip() for cell in ws[3]]
    if len(row3_cells) < 7:
        raise ValueError(f"Excel integrity error: Row 3 has only {len(row3_cells)} columns (expected >= 7)")
    
    col5_header = row3_cells[4]
    col7_header = row3_cells[6]
    if "종목코드" not in col5_header:
        raise ValueError(f"Excel integrity error: Column 5 header must be '종목코드', got '{col5_header}'")
    if "퇴직연금" not in col7_header or "투자한도" not in col7_header:
        raise ValueError(
            f"Excel integrity error: Column 7 header must contain '퇴직연금' and '투자한도', got '{col7_header}'"
        )


def extract_ticker_universe_from_excel(xlsx_path: Path, output_txt_path: Path) -> list[tuple[str, str, float]]:
    """Extract (ticker, name, limit) from KIS pension table and save universe."""
    import openpyxl

    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    if "ETF" not in wb.sheetnames:
        raise ValueError(f"Excel integrity error: 'ETF' sheet not found in {xlsx_path.name}")
    ws = wb["ETF"]

    # Step 1: Structural verification
    validate_excel_structure(ws)

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

    if len(universe) < 900:
        raise ValueError(
            f"Excel extraction error: Extracted {len(universe)} tickers, which is below minimum threshold 900."
        )

    content_str = "\n".join(lines) + "\n"
    content_bytes = content_str.encode("utf-8")
    content_sha256 = hashlib.sha256(content_bytes).hexdigest()

    # Rule R-e: Manifest immutability check
    if MANIFEST_PATH.exists():
        with MANIFEST_PATH.open("r", encoding="utf-8") as f:
            manifest = json.load(f)
        manifest_key = f"brokers/koreainvestment/{output_txt_path.name}"
        if manifest_key in manifest:
            registered_sha = manifest[manifest_key].get("sha256")
            if registered_sha and content_sha256 != registered_sha:
                raise ValueError(
                    f"Rule R-e violation: Attempting to overwrite registered immutable evidence file '{manifest_key}' with differing content/hash. "
                    f"Manifest SHA: {registered_sha}, New SHA: {content_sha256}"
                )

    if output_txt_path.exists():
        existing_bytes = output_txt_path.read_bytes()
        if existing_bytes != content_bytes:
            existing_sha = hashlib.sha256(existing_bytes).hexdigest()
            raise ValueError(
                f"Rule R-e violation: Attempting to overwrite existing evidence file '{output_txt_path.name}' with differing content. "
                f"Existing SHA: {existing_sha}, New SHA: {content_sha256}"
            )
        print(f"[Rule R-e] Evidence file '{output_txt_path.name}' already registered and verified identical. Skipping write.")
    else:
        with output_txt_path.open("w", encoding="utf-8", newline="\n") as f:
            f.write(content_str)

    return universe


def generate_diff_report(
    current_universe: list[tuple[str, str, float]],
    previous_universe_path: Path | None,
    ledger_path: Path,
) -> dict[str, Any]:
    """Step 4: Re-matching and diff categorization report.
    
    1. Newly included tickers (in current, not in previous)
    2. Newly excluded tickers (in previous, not in current)
    3. Limit changes (broker limit vs verified ledger limit)
    """
    curr_map = {tk: (name, lim) for tk, name, lim in current_universe}
    prev_map: dict[str, str] = {}

    if previous_universe_path and previous_universe_path.is_file():
        with previous_universe_path.open("r", encoding="utf-8") as f:
            for line in f:
                parts = line.strip().split("\t")
                if parts and parts[0]:
                    prev_map[parts[0].strip().upper()] = parts[1].strip() if len(parts) > 1 else ""

    newly_included = [tk for tk in curr_map if tk not in prev_map] if prev_map else []
    newly_excluded = [tk for tk in prev_map if tk not in curr_map]

    # Check for limit changes against current ledger
    ledger_limits: dict[str, float] = {}
    if ledger_path.is_file():
        with ledger_path.open("r", encoding="utf-8-sig") as f:
            for r in csv.DictReader(f):
                tk = r["ticker"].strip().upper()
                vlim = r.get("verified_limit", "")
                if "100%" in vlim:
                    ledger_limits[tk] = 1.0
                elif "70%" in vlim:
                    ledger_limits[tk] = 0.7
                elif "불가" in vlim:
                    ledger_limits[tk] = 0.0

    limit_changes = []
    for tk, (name, curr_lim) in curr_map.items():
        if tk in ledger_limits:
            ledg_lim = ledger_limits[tk]
            if ledg_lim > 0.0 and curr_lim != ledg_lim:
                limit_changes.append({
                    "ticker": tk,
                    "name": name,
                    "previous_ledger_limit": ledg_lim,
                    "new_broker_limit": curr_lim,
                })

    return {
        "previous_file": previous_universe_path.name if previous_universe_path else None,
        "newly_included_count": len(newly_included),
        "newly_included": newly_included[:10],
        "newly_excluded_count": len(newly_excluded),
        "newly_excluded": newly_excluded[:10],
        "limit_changes_count": len(limit_changes),
        "limit_changes": limit_changes,
    }


def update_ledger_expiration_dates(as_of_date: datetime.date) -> int:
    """Step 5: Update expires_at for 2way ledger entries to as_of_date + 90 days."""
    import shutil

    new_expires_at = (as_of_date + datetime.timedelta(days=90)).isoformat()
    updated_count = 0

    if not AUDIT_DATA_PATH.is_file():
        return 0

    rows = []
    with AUDIT_DATA_PATH.open("r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        for r in reader:
            if r.get("evidence_tier") == "2way":
                r["expires_at"] = new_expires_at
                updated_count += 1
            rows.append(r)

    with AUDIT_DATA_PATH.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    if AUDIT_PUB_PATH.parent.is_dir():
        shutil.copy2(AUDIT_DATA_PATH, AUDIT_PUB_PATH)

    return updated_count


def refresh_monthly_universe(excel_filename: str | None = None) -> dict[str, Any]:
    """Run complete 5-step monthly universe refresh pipeline."""
    if excel_filename:
        excel_path = BROKER_DIR / excel_filename
    else:
        excels = sorted(BROKER_DIR.glob("ETF_REITs_LIST_RP_*.xlsx"))
        if not excels:
            raise FileNotFoundError(f"No pension Excel files found in {BROKER_DIR}")
        excel_path = excels[-1]

    print(f"[1/5] Step 1: Validating broker Excel structural integrity: {excel_path.name}")
    date_match = re.search(r"(\d{6})", excel_path.name)
    if date_match:
        yymmdd = date_match.group(1)
        as_of_date = datetime.date(int("20" + yymmdd[:2]), int(yymmdd[2:4]), int(yymmdd[4:6]))
        as_of_suffix = f"20{yymmdd}"
    else:
        as_of_date = datetime.date.today()
        as_of_suffix = datetime.date.today().strftime("%Y%m%d")

    universe_txt_path = BROKER_DIR / f"kis_etf_ticker_universe_{as_of_suffix}.txt"

    # Step 2: SHA-256
    sha256_hash = calculate_sha256(excel_path)
    file_size = excel_path.stat().st_size
    print(f"[2/5] Step 2: Excel SHA-256: {sha256_hash} ({file_size} bytes)")

    # Locate previous universe file before writing new one
    prev_txts = sorted(
        [p for p in BROKER_DIR.glob("kis_etf_ticker_universe_*.txt") if p.name != universe_txt_path.name]
    )
    previous_universe_path = prev_txts[-1] if prev_txts else None

    # Step 3: Extract ticker universe (and run Step 1 structure validation)
    universe = extract_ticker_universe_from_excel(excel_path, universe_txt_path)
    txt_sha256 = calculate_sha256(universe_txt_path)
    print(
        f"[3/5] Step 3: Extracted {len(universe)} items to {universe_txt_path.name} "
        f"(SHA-256: {txt_sha256[:12]}...)"
    )

    # Step 4: Re-matching and diff categorization report
    diff_report = generate_diff_report(universe, previous_universe_path, LEDGER_PATH)
    print(f"[4/5] Step 4: Universe diff report against {diff_report['previous_file'] or 'None'}:")
    print(f"      - Newly included tickers: {diff_report['newly_included_count']} 건 {diff_report['newly_included']}")
    print(f"      - Newly excluded tickers: {diff_report['newly_excluded_count']} 건 {diff_report['newly_excluded']}")
    print(f"      - Limit change candidates: {diff_report['limit_changes_count']} 건")
    if diff_report["limit_changes"]:
        for chg in diff_report["limit_changes"]:
            print(
                f"        [WARNING: REQUIRES HUMAN REVIEW] {chg['ticker']} ({chg['name']}): "
                f"Ledger={chg['previous_ledger_limit']} -> Excel={chg['new_broker_limit']}"
            )

    # Update manifest
    if MANIFEST_PATH.exists():
        with MANIFEST_PATH.open("r", encoding="utf-8") as f:
            manifest = json.load(f)

        excel_key = f"brokers/koreainvestment/{excel_path.name}"
        txt_key = f"brokers/koreainvestment/{universe_txt_path.name}"

        # Rule R-e: Manifest entry hash mismatch prevention
        if excel_key in manifest and manifest[excel_key].get("sha256") != sha256_hash:
            raise ValueError(
                f"Rule R-e violation: Attempting to update registered Excel manifest entry '{excel_key}' with differing SHA-256."
            )
        if txt_key in manifest and manifest[txt_key].get("sha256") != txt_sha256:
            raise ValueError(
                f"Rule R-e violation: Attempting to update registered universe manifest entry '{txt_key}' with differing SHA-256."
            )

        manifest[excel_key] = {
            "source_type": "증권사목록대조",
            "description": f"한국투자증권 퇴직연금 ETF 상품 현황 ({as_of_suffix} 기준)",
            "sha256": sha256_hash,
            "bytes": file_size,
            "collected_at": datetime.date.today().isoformat(),
        }
        manifest[txt_key] = {
            "source_type": "증권사유니버스추출",
            "description": f"한국투자증권 퇴직연금 매매가능 ETF {len(universe)}종목 코드 유니버스",
            "sha256": txt_sha256,
            "bytes": universe_txt_path.stat().st_size,
            "collected_at": datetime.date.today().isoformat(),
        }
        with MANIFEST_PATH.open("w", encoding="utf-8", newline="\n") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)
            f.write("\n")

    # Step 5: Update expiration dates
    updated_exp_count = update_ledger_expiration_dates(as_of_date)
    new_expires_at = (as_of_date + datetime.timedelta(days=90)).isoformat()
    print(
        f"[5/5] Step 5: Updated expires_at to {new_expires_at} for {updated_exp_count} 2way entries in ledger."
    )

    print(f"==> Monthly refresh pipeline completed successfully.")
    return {
        "excel_path": str(excel_path),
        "excel_sha256": sha256_hash,
        "universe_count": len(universe),
        "universe_txt_path": str(universe_txt_path),
        "diff_report": diff_report,
        "expires_at_updated_count": updated_exp_count,
        "new_expires_at": new_expires_at,
    }


def main():
    parser = argparse.ArgumentParser(description="Refresh monthly retirement pension ETF universe")
    parser.add_argument("--excel", type=str, help="Filename of newly downloaded KIS Excel")
    args = parser.parse_args()
    res = refresh_monthly_universe(args.excel)
    print("\n--- Pipeline Execution Summary ---")
    print(json.dumps(res, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()

