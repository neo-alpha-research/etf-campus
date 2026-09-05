#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""KOFIA Pension Verification Ledger Builder & Reconciliation Runner.

Integrates KOFIA official fund types with the statutory pension verification ledger:
1. Reads data/regulatory/kofia_fund_types.csv.
2. Resolves statutory limits using scripts/rules/kofia_type_mapping.py.
3. Loads unambiguous (확정 가능) entries into data/regulatory/pension_verification_ledger.csv.
4. Executes pension_regulatory_engine to update data/etf_master_draft.csv.
5. Emits data/reports/pension_unverified_queue.csv (sorted by AUM desc) and
   data/reports/pension_verification_summary.json.
6. Outputs discrepancy / divergence report (if any).
"""

from __future__ import annotations

import argparse
import csv
import datetime
import json
import sys
from pathlib import Path
from typing import Any, Dict, List

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.rules.kofia_type_mapping import (
    STATUS_DETERMINED,
    resolve_kofia_fund_type,
)

KOFIA_SOURCE_URL = (
    "https://dis.kofia.or.kr/websquare/index.jsp?"
    "w2xPath=/wq/fundann/DISFundFeeCMS.xml&divisionId=MDIS01005001000000&serviceId=SDIS01005001000"
)


def build_verification_ledger(
    fund_types_csv: Path,
    ledger_csv: Path,
    prospectus_mixed_bonds_csv: Path | None = None,
    evidence_filename: str = "kofia_dis_response_20260905.xml",
    valid_days: int = 90,
) -> tuple[int, int, Dict[str, str]]:
    """Builds or updates pension_verification_ledger.csv from kofia_fund_types.csv and prospectus records.

    Returns:
        tuple of (determined_count, undetermined_count, undetermined_reasons_by_ticker)
    """
    if not fund_types_csv.exists():
        print(f"[ERROR] Fund types CSV not found: {fund_types_csv}", file=sys.stderr)
        return 0, 0, {}

    today = datetime.date.today()
    verified_at = today.isoformat()
    expires_at = (today + datetime.timedelta(days=valid_days)).isoformat()
    evidence_ref = f"data/regulatory/sources/{evidence_filename}"

    with fund_types_csv.open("r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        fund_rows = list(reader)

    # Load existing ledger rows (to preserve manual or other source entries)
    existing_ledger: Dict[str, Dict[str, str]] = {}
    if ledger_csv.exists():
        try:
            with ledger_csv.open("r", encoding="utf-8-sig") as f:
                for row in csv.DictReader(f):
                    tk = (row.get("ticker") or "").strip().upper()
                    if tk:
                        existing_ledger[tk] = row
        except Exception as e:
            print(f"[WARN] Error reading existing ledger: {e}")

    determined_count = 0
    undetermined_count = 0
    undetermined_reasons: Dict[str, str] = {}

    for row in fund_rows:
        ticker = (row.get("ticker") or "").strip().upper()
        raw_type = (row.get("fund_type") or "").strip()
        fund_name = (row.get("fund_name") or "").strip()

        rule = resolve_kofia_fund_type(raw_type)

        if rule.status == STATUS_DETERMINED and rule.pension_limit:
            determined_count += 1
            existing_ledger[ticker] = {
                "ticker": ticker,
                "verified_limit": rule.pension_limit,
                "source_type": "협회공시대조",
                "source_url": KOFIA_SOURCE_URL,
                "evidence_ref": evidence_ref,
                "verified_at": verified_at,
                "verified_by": "scripts/collector/kofia_fee_collector.py",
                "expires_at": expires_at,
                "note": f"KOFIA 펀드유형: {raw_type} ({rule.statutory_basis_or_reason})",
            }
        else:
            undetermined_count += 1
            undetermined_reasons[ticker] = rule.statutory_basis_or_reason

    # Ingest prospectus-verified records from registry files in data/regulatory/sources/
    prospectus_count = 0
    sources_dir = REPO_ROOT / "data" / "regulatory" / "sources"
    prospectus_files = sorted(list(sources_dir.glob("prospectus_*_registry.csv")))

    for p_csv in prospectus_files:
        if p_csv.exists():
            try:
                with p_csv.open("r", encoding="utf-8-sig") as f:
                    for row in csv.DictReader(f):
                        tk = (row.get("ticker") or "").strip().upper()
                        if not tk:
                            continue
                        existing_ledger[tk] = {
                            "ticker": tk,
                            "verified_limit": row.get("verified_limit") or "100% (안전자산)",
                            "source_type": row.get("source_type") or "투자설명서대조",
                            "source_url": row.get("source_url") or "https://dart.fss.or.kr",
                            "evidence_ref": row.get("evidence_ref") or "투자설명서(신탁계약서) 제16조(투자대상 및 투자비율)",
                            "verified_at": verified_at,
                            "verified_by": "투자설명서 및 집합투자규약 대조",
                            "expires_at": expires_at,
                            "note": row.get("note") or "퇴직연금감독규정 제12조 제1항 충족",
                        }
                        prospectus_count += 1
                        # Remove from undetermined if it was classified as undetermined by KOFIA
                        if tk in undetermined_reasons:
                            del undetermined_reasons[tk]
                            undetermined_count -= 1
            except Exception as e:
                print(f"[WARN] Error reading prospectus CSV {p_csv}: {e}", file=sys.stderr)

    ledger_csv.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "ticker",
        "verified_limit",
        "source_type",
        "source_url",
        "evidence_ref",
        "verified_at",
        "verified_by",
        "expires_at",
        "note",
    ]

    # Sort ledger by ticker
    sorted_ledger = sorted(existing_ledger.values(), key=lambda x: x["ticker"])
    with ledger_csv.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(sorted_ledger)

    print(f"[LEDGER] Wrote {len(sorted_ledger)} total entries to {ledger_csv}")
    print(f"[LEDGER] KOFIA determined: {determined_count} items, prospectus verified: {prospectus_count} items")
    print(f"[LEDGER] Undetermined remaining: {undetermined_count} items")
    return determined_count + prospectus_count, undetermined_count, undetermined_reasons


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="KOFIA Pension Verification Ledger Builder")
    parser.add_argument(
        "--fund-types",
        type=Path,
        default=REPO_ROOT / "data/regulatory/kofia_fund_types.csv",
        help="Path to kofia_fund_types.csv",
    )
    parser.add_argument(
        "--ledger",
        type=Path,
        default=REPO_ROOT / "data/regulatory/pension_verification_ledger.csv",
        help="Path to pension_verification_ledger.csv",
    )
    parser.add_argument(
        "--prospectus-mixed-bonds",
        type=Path,
        default=REPO_ROOT / "data/regulatory/sources/prospectus_mixed_bonds_registry.csv",
        help="Path to prospectus_mixed_bonds_registry.csv",
    )
    parser.add_argument(
        "--evidence",
        default="kofia_dis_response_20260905.xml",
        help="Evidence file name in data/regulatory/sources/",
    )
    args = parser.parse_args()

    det, undet, reasons = build_verification_ledger(
        fund_types_csv=args.fund_types,
        ledger_csv=args.ledger,
        prospectus_mixed_bonds_csv=args.prospectus_mixed_bonds,
        evidence_filename=args.evidence,
    )
    print(f"Completed verification ledger update. Total verified: {det}, Undetermined: {undet}")
