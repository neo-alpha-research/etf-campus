#!/usr/bin/env python3
"""Audits ETF price series against the corporate actions ledger.

Categorizes daily price jumps/drops >= 40% into:
  Category 1: In ledger & properly adjusted (official_verified)
  Category 2: In ledger but unadjusted in prices -> FAIL (exit code 1)
  Category 3: Exceeds KRX legal price limits (>30% for 1X, >60% for 2X) and not in ledger -> FAIL (exit code 1)
  Category 4: Verified market execution within KRX legal limits (2X leveraged ETF <= 60%)

Exit Code:
  0: All corporate actions are adjusted and 0 unregistered anomalies exist (clean).
  1: Unadjusted corporate action (Category 2) or unregistered anomaly (Category 3) detected.
"""

from __future__ import annotations

import argparse
import csv
import glob
import json
import os
import sys
from pathlib import Path

# Ensure UTF-8 output on Windows
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass


def load_corporate_actions(ca_path: Path) -> dict[tuple[str, str], dict[str, str]]:
    """Loads corporate actions indexed by (ticker, effective_date)."""
    actions: dict[tuple[str, str], dict[str, str]] = {}
    if not ca_path.exists():
        return actions

    with open(ca_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            ticker = row.get("ticker", "").strip()
            eff_date = row.get("effective_date", "").strip()
            if ticker and eff_date:
                actions[(ticker, eff_date)] = row
    return actions


def load_distribution_events(dist_path: Path) -> dict[tuple[str, str], dict[str, str]]:
    """Loads official distribution events indexed by (ticker, ex_date)."""
    distributions: dict[tuple[str, str], dict[str, str]] = {}
    if not dist_path.exists():
        return distributions

    with open(dist_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            ticker = (row.get("ticker") or row.get("code") or row.get("itemcode") or "").strip()
            ex_date = (row.get("ex_date") or row.get("krx_apply_date") or row.get("issuer_ex_date") or "").strip()
            if ticker and ex_date:
                distributions[(ticker, ex_date)] = row
    return distributions


def load_etf_multipliers(master_path: Path) -> dict[str, int]:
    """Determines ETF multiplier (1 for 1X, 2 for 2X leveraged/inverse 2X)."""
    multipliers: dict[str, int] = {}
    if not master_path.exists():
        return multipliers

    with open(master_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            ticker = row.get("ticker", "").strip()
            name = row.get("name", "").strip()
            if not ticker:
                continue
            is_2x = ("레버리지" in name) or ("2X" in name) or ("2x" in name)
            multipliers[ticker] = 2 if is_2x else 1
    return multipliers


def verify_splits(
    series_dir: str = "public/data/returns/tr_index",
    ca_file: str = "data/corporate_actions/etf_corporate_actions.csv",
    master_file: str = "data/etf_master_draft.csv",
    dist_file: str = "data/distributions/etf_distribution_events.csv",
    threshold: float = 0.40,
    strict_threshold_only: bool = False,
) -> tuple[list[dict], list[dict], list[dict], list[dict]]:
    """Audits price series and returns (cat1, cat2, cat3, cat4)."""
    root = Path(__file__).resolve().parents[1]
    ca_path = Path(ca_file) if Path(ca_file).is_absolute() else root / ca_file
    master_path = Path(master_file) if Path(master_file).is_absolute() else root / master_file
    dist_path = Path(dist_file) if Path(dist_file).is_absolute() else root / dist_file
    tr_path = Path(series_dir) if Path(series_dir).is_absolute() else root / series_dir

    actions = load_corporate_actions(ca_path)
    distributions = load_distribution_events(dist_path)
    multipliers = load_etf_multipliers(master_path)

    print(f"[Corporate Actions Ledger] Registered actions: {len(actions)}, Registered distributions: {len(distributions)}")

    tr_files = [
        f for f in sorted(glob.glob(str(tr_path / "*.json")))
        if not f.endswith(".recent.json") and os.path.basename(f) != "manifest.json"
    ]
    print(f"[Price Series Audit] Auditing {len(tr_files)} ETF price files in {tr_path}...")

    cat1_in_ledger_adjusted: list[dict] = []
    cat2_in_ledger_unadjusted: list[dict] = []
    cat3_unregistered_anomalies: list[dict] = []
    cat4_verified_market_moves: list[dict] = []

    for tf in tr_files:
        ticker = os.path.basename(tf).replace(".json", "").strip()
        mult = multipliers.get(ticker, 1)
        legal_limit = 0.60 if mult == 2 else 0.30

        try:
            with open(tf, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            print(f"Error reading {tf}: {e}")
            continue

        if "points" in data:
            points = data["points"]
        elif "dates" in data and "close" in data:
            dates = data["dates"]
            close = data["close"]
            points = [{"date": dates[i], "close": close[i]} for i in range(len(dates))]
        else:
            points = []

        if not points:
            continue

        for i in range(1, len(points)):
            p_prev = points[i - 1].get("close")
            p_curr = points[i].get("close")
            dt_curr = points[i].get("date")
            dt_prev = points[i - 1].get("date")

            if not p_prev or p_prev <= 0 or not p_curr or p_curr <= 0:
                continue

            change = (p_curr - p_prev) / p_prev
            abs_change = abs(change)

            # Check if this date has a registered corporate action or distribution event (분배락)
            action_entry = actions.get((ticker, dt_curr))
            dist_entry = distributions.get((ticker, dt_curr))

            if action_entry:
                num = float(action_entry.get("ratio_numerator", 1))
                den = float(action_entry.get("ratio_denominator", 1))
                expected_ratio = num / den if den != 0 else 1.0

                if abs(abs_change - abs(1.0 - (1.0 / expected_ratio))) < 0.05:
                    cat2_in_ledger_unadjusted.append({
                        "ticker": ticker,
                        "date": dt_curr,
                        "prev_date": dt_prev,
                        "prev_close": p_prev,
                        "curr_close": p_curr,
                        "change_pct": round(change * 100, 2),
                        "action": action_entry,
                        "reason": f"Unadjusted corporate action cliff ({action_entry.get('action_type')})",
                    })
                else:
                    cat1_in_ledger_adjusted.append({
                        "ticker": ticker,
                        "date": dt_curr,
                        "prev_date": dt_prev,
                        "prev_close": p_prev,
                        "curr_close": p_curr,
                        "change_pct": round(change * 100, 2),
                        "action": action_entry,
                    })
            elif dist_entry and change < 0:
                dist_krw = float(dist_entry.get("distribution_per_share_krw", 0) or 0)
                if dist_krw > 0:
                    cat1_in_ledger_adjusted.append({
                        "ticker": ticker,
                        "date": dt_curr,
                        "prev_date": dt_prev,
                        "prev_close": p_prev,
                        "curr_close": p_curr,
                        "change_pct": round(change * 100, 2),
                        "action": dist_entry,
                        "reason": f"Verified distribution ex-date ({dist_krw} KRW/share, {dist_entry.get('distribution_type', 'ordinary_cash')})",
                    })

            # Check for legal limit violation (> 30% for 1X, > 60% for 2X) OR surveillance threshold (>= 40%)
            is_limit_violation = abs_change > (legal_limit + 0.001)
            is_surveillance = abs_change >= threshold

            if is_limit_violation or is_surveillance:
                record = {
                    "ticker": ticker,
                    "date": dt_curr,
                    "prev_date": dt_prev,
                    "prev_close": p_prev,
                    "curr_close": p_curr,
                    "change_pct": round(change * 100, 2),
                    "multiplier": f"{mult}X",
                    "legal_limit_pct": int(legal_limit * 100),
                }

                if strict_threshold_only:
                    if not action_entry and not dist_entry:
                        cat3_unregistered_anomalies.append(record)
                else:
                    if is_limit_violation:
                        if not action_entry and not dist_entry:
                            cat3_unregistered_anomalies.append(record)
                    elif is_surveillance:
                        if not action_entry and not dist_entry:
                            cat4_verified_market_moves.append(record)

    # Print Summary Report
    print("\n" + "=" * 70)
    print("ETF PRICE INTEGRITY & CORPORATE ACTIONS AUDIT REPORT")
    print("=" * 70)
    print(f"[Category 1] In Ledger & Adjusted:     {len(cat1_in_ledger_adjusted)} cases")
    print(f"[Category 2] In Ledger but Unadjusted: {len(cat2_in_ledger_unadjusted)} cases (VIOLATION)")
    print(f"[Category 3] Unregistered Anomalies:   {len(cat3_unregistered_anomalies)} cases (VIOLATION)")
    print(f"[Category 4] Verified Market Moves:    {len(cat4_verified_market_moves)} cases (Within KRX +/-60% limit)")
    print("-" * 70)

    if cat2_in_ledger_unadjusted:
        print("\n[ERROR] Category 2: Unadjusted Corporate Actions:")
        for r in cat2_in_ledger_unadjusted:
            print(f"  - {r['ticker']} on {r['date']}: {r['prev_close']} -> {r['curr_close']} ({r['change_pct']}%) [{r['reason']}]")

    if cat3_unregistered_anomalies:
        print("\n[ERROR] Category 3: Unregistered Price Limit Anomalies:")
        for r in cat3_unregistered_anomalies:
            print(f"  - {r['ticker']} ({r['multiplier']}) on {r['date']}: {r['prev_close']} -> {r['curr_close']} ({r['change_pct']}%, KRX limit +/-{r['legal_limit_pct']}%)")

    if cat4_verified_market_moves:
        print(f"\n[INFO] Category 4: Verified High-Volatility Market Executions (>= 40% within legal limit):")
        for r in cat4_verified_market_moves:
            print(f"  - {r['ticker']} ({r['multiplier']}) {r['prev_date']} -> {r['date']}: {r['prev_close']} -> {r['curr_close']} ({r['change_pct']}%, limit +/-{r['legal_limit_pct']}%)")

    print("\n" + "=" * 70)
    is_clean = (len(cat2_in_ledger_unadjusted) == 0 and len(cat3_unregistered_anomalies) == 0)
    if is_clean:
        print("RESULT: PASS -- Zero unadjusted corporate actions and zero unregistered limit anomalies.")
    else:
        print(f"RESULT: FAIL -- Found {len(cat2_in_ledger_unadjusted) + len(cat3_unregistered_anomalies)} integrity violations.")
    print("=" * 70 + "\n")

    return cat1_in_ledger_adjusted, cat2_in_ledger_unadjusted, cat3_unregistered_anomalies, cat4_verified_market_moves


def main():
    parser = argparse.ArgumentParser(description="Audit ETF price series against corporate actions ledger")
    parser.add_argument("--series-dir", type=str, default="public/data/returns/tr_index", help="Directory of price series files (default: public/data/returns/tr_index)")
    parser.add_argument("--ca-file", type=str, default="data/corporate_actions/etf_corporate_actions.csv", help="Corporate actions CSV path")
    parser.add_argument("--dist-file", type=str, default="data/distributions/etf_distribution_events.csv", help="Distribution events CSV path")
    parser.add_argument("--threshold", type=float, default=0.40, help="Surveillance price jump threshold (default: 0.40)")
    parser.add_argument("--strict", action="store_true", help="Treat any >= threshold jump as anomaly unless in ledger")
    args = parser.parse_args()

    cat1, cat2, cat3, cat4 = verify_splits(
        series_dir=args.series_dir,
        ca_file=args.ca_file,
        dist_file=args.dist_file,
        threshold=args.threshold,
        strict_threshold_only=args.strict,
    )

    if cat2 or cat3:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
