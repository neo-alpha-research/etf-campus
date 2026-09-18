#!/usr/bin/env python3
"""Broker Pension Universe Verification & Regulatory Sync Script.

Cross-references broker-disclosed pension eligible ETF lists with the ETF Campus
universe, updates verified audit records, and recalculates pension confidence tiers.

Compliance & Zero-Hallucination Mandates:
1. Broker eligibility never overrides statutory bans (Leverage/Inverse remains INELIGIBLE).
2. Broker verified flag requires valid ticker matching the official universe.
3. Every verification change must be traceable via effective_date and source_url.
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.rules.pension_regulatory_engine import (
    LIMIT_INELIGIBLE,
    LIMIT_RISK_ASSET,
    LIMIT_SAFE_ASSET,
    PENSION_CONFIDENCE_HIGH,
    PENSION_CONFIDENCE_MODERATE,
    PENSION_INELIGIBLE,
    PENSION_VERIFIED_NO,
    PENSION_VERIFIED_YES,
    classify_pension_and_isa,
    load_verified_broker_tickers,
    process_csv,
)

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DEFAULT_BROKER_CSV = REPO_ROOT / "data" / "regulatory" / "broker_pension_universe.csv"
DEFAULT_MASTER_CSV = REPO_ROOT / "data" / "etf_master_draft.csv"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("verify_broker_pension")


def load_broker_universe(csv_path: Path) -> dict[str, dict[str, Any]]:
    """Load and validate broker pension universe records."""
    if not csv_path.exists():
        logger.warning(f"Broker universe file not found: {csv_path}")
        return {}

    records: dict[str, dict[str, Any]] = {}
    with csv_path.open("r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            ticker = str(row.get("ticker") or "").strip().upper()
            if not ticker:
                continue
            # Keep the latest or consolidate
            records[ticker] = {
                "ticker": ticker,
                "broker_name": str(row.get("broker_name") or "").strip(),
                "pension_eligible_limit": str(row.get("pension_eligible_limit") or "").strip(),
                "effective_date": str(row.get("effective_date") or "").strip(),
                "source_url": str(row.get("source_url") or "").strip(),
            }
    return records


def audit_and_sync(
    broker_csv: Path = DEFAULT_BROKER_CSV,
    master_csv: Path = DEFAULT_MASTER_CSV,
    verify_sheet: Path = DEFAULT_VERIFY_SHEET,
    dry_run: bool = False,
) -> dict[str, Any]:
    """Audit broker universe against regulatory engine and sync verify sheet."""
    broker_records = load_broker_universe(broker_csv)
    verified_tickers = set(broker_records.keys())
    logger.info(f"Loaded {len(verified_tickers):,} broker verified tickers from {broker_csv.name}")

    if not master_csv.exists():
        raise FileNotFoundError(f"Master CSV not found: {master_csv}")

    with master_csv.open("r", encoding="utf-8-sig") as f:
        master_rows = list(csv.DictReader(f))

    universe_tickers = {r["ticker"].strip().upper() for r in master_rows if "ticker" in r}

    matched_tickers = verified_tickers.intersection(universe_tickers)
    unmatched_broker = verified_tickers - universe_tickers
    logger.info(f"Universe Match: {len(matched_tickers):,} / Broker Unmatched: {len(unmatched_broker):,}")

    upgrades: list[dict[str, Any]] = []
    compliance_vetoes: list[dict[str, Any]] = []

    for row in master_rows:
        ticker = row.get("ticker", "").strip().upper()
        name = row.get("name", "").strip()

        # Engine classification with current broker verified set
        res = classify_pension_and_isa(row, verified_tickers=verified_tickers)

        # Statutory Veto Check: If broker marked eligible, but engine is strictly INELIGIBLE (e.g. leverage/futures)
        if ticker in broker_records and res["pension_eligible"] == PENSION_INELIGIBLE:
            compliance_vetoes.append({
                "ticker": ticker,
                "name": name,
                "broker_claim": broker_records[ticker]["pension_eligible_limit"],
                "statutory_reason": res["pension_reason"],
            })

        # Track upgrades (moderate -> high)
        if ticker in broker_records and res["pension_confidence"] == PENSION_CONFIDENCE_HIGH:
            # Check if it was previously moderate (e.g., covered calls)
            if "커버드콜" in name:
                upgrades.append({
                    "ticker": ticker,
                    "name": name,
                    "limit": res["pension_limit"],
                    "confidence": res["pension_confidence"],
                    "reason": res["pension_reason"],
                })

    report = {
        "broker_tickers_count": len(verified_tickers),
        "universe_matched_count": len(matched_tickers),
        "unmatched_broker_count": len(unmatched_broker),
        "compliance_veto_count": len(compliance_vetoes),
        "covered_call_upgrades": len(upgrades),
        "vetoes": compliance_vetoes,
        "sample_upgrades": upgrades[:5],
    }

    if not dry_run:
        logger.info(f"Executing regulatory engine sync onto {verify_sheet}...")
        stats = process_csv(master_csv, verify_sheet)
        report["engine_stats"] = stats
        logger.info(
            f"Sync Complete: High Conf: {stats['conf_high']:,} | "
            f"Moderate Conf: {stats['conf_moderate']:,} | "
            f"Verified: {stats['verified_y']:,}"
        )
    else:
        logger.info("[DRY RUN] No files modified.")

    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit and sync broker pension universe.")
    parser.add_argument("--broker-csv", type=Path, default=DEFAULT_BROKER_CSV)
    parser.add_argument("--master-csv", type=Path, default=DEFAULT_MASTER_CSV)
    parser.add_argument("--verify-sheet", type=Path, default=DEFAULT_MASTER_CSV)
    parser.add_argument("--dry-run", action="store_true", help="Simulate without writing files")
    args = parser.parse_args()

    report = audit_and_sync(
        broker_csv=args.broker_csv,
        master_csv=args.master_csv,
        verify_sheet=args.verify_sheet,
        dry_run=args.dry_run,
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
