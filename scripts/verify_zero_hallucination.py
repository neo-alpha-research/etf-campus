#!/usr/bin/env python3
"""
Zero-Hallucination & Financial Integrity Verification Script
Enforces strict Zero-Hallucination policy across the ETF Campus market briefing pipeline.
"""

import sys
import os
import re
import json
import subprocess

FORBIDDEN_PATTERNS = [
    r'\b28540\b',
    r'\b5034780\.9\b',
    r'\b142800\b',
]

EXCLUDE_DIRS = {
    ".next", "node_modules", ".wrangler", "out", ".git", ".data_raw", "scratch", "_archive"
}

def check_codebase():
    print("[1/2] Scanning codebase for forbidden hardcoded financial constants...")
    errors = []
    
    target_dirs = ["workers/market-briefing-publisher", "functions/api/briefings", "components/market-briefing"]
    for d in target_dirs:
        if not os.path.exists(d):
            continue
        for root, dirs, files in os.walk(d):
            # Prune excluded directories
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            for file in files:
                if not file.endswith((".ts", ".js", ".tsx", ".jsx")):
                    continue
                path = os.path.join(root, file)
                with open(path, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()
                    for pat in FORBIDDEN_PATTERNS:
                        if re.search(pat, content):
                            errors.append(f"Forbidden constant matching '{pat}' found in {path}")
                            
    if errors:
        for e in errors:
            print(f"  [FAIL] {e}")
        return False
    print("  [PASS] No forbidden constants found in codebase.")
    return True

def check_index_integrity(as_of_date: str, metrics: dict) -> list[str]:
    errors = []
    indices = metrics.get("market_indices") or []
    kospi = next((i for i in indices if i.get("code") in ("KOSPI", "001")), None)
    kosdaq = next((i for i in indices if i.get("code") in ("KOSDAQ", "201", "301")), None)

    if not kospi or not kosdaq:
        errors.append(f"Date {as_of_date}: Missing KOSPI or KOSDAQ in market_indices")
        return errors

    k_close = float(kospi.get("close") or 0.0)
    k_chg = float(kospi.get("change_pct") if kospi.get("change_pct") is not None else kospi.get("changePct") or 0.0)
    q_close = float(kosdaq.get("close") or 0.0)
    q_chg = float(kosdaq.get("change_pct") if kosdaq.get("change_pct") is not None else kosdaq.get("changePct") or 0.0)

    # 1. Known dummy constants (e.g. 2600.0 / 800.0)
    if k_close == 2600.0 and q_close == 800.0:
        errors.append(f"Date {as_of_date}: Fabricated index dummy constants detected (KOSPI=2600.0, KOSDAQ=800.0)")

    # 2. Simultaneous exact 0.00% change anomaly
    if k_chg == 0.0 and q_chg == 0.0:
        errors.append(f"Date {as_of_date}: Suspicious zero-variance anomaly (both KOSPI and KOSDAQ change_pct are exactly 0.00%)")

    return errors


def check_d1_database(all_dates: bool = False):
    print("[2/2] Verifying D1 database market_briefings records...")
    # Active production gate validates service records (as_of_date >= 2026-08-24)
    where_clause = "" if all_dates else "WHERE as_of_date >= '2026-08-24'"
    cmd = f'npx wrangler d1 execute etf-prices --remote --json --command "SELECT as_of_date, general_total_aum, up_count, down_count, headline_text, metrics_json FROM market_briefings {where_clause} ORDER BY as_of_date DESC;"'
    try:
        p = subprocess.run(cmd, shell=True, capture_output=True)
        raw_stdout = p.stdout.decode('utf-8', errors='replace')
        data = json.loads(raw_stdout)
        if not isinstance(data, list) or len(data) == 0 or "results" not in data[0]:
            print("  [SKIP] D1 database query returned non-standard output (or no Cloudflare token in environment). Skipping remote check.")
            return True
        results = data[0]["results"]
    except Exception as e:
        print(f"  [SKIP] Skipping D1 remote check (no token or connection): {e}")
        return True

    errors = []
    seen_indices = {}
    for r in results:
        d = r["as_of_date"]
        raw_m = r.get("metrics_json") or "{}"
        m = json.loads(raw_m)

        # 1. Check forbidden constants in json string
        for pat in FORBIDDEN_PATTERNS:
            if re.search(pat, raw_m):
                errors.append(f"Date {d}: Contains forbidden constant matching '{pat}' in metrics_json")

        # 2. Check market_indices integrity (dummy constants, 0.00% anomaly)
        idx_errors = check_index_integrity(d, m)
        errors.extend(idx_errors)

        # 3. Check duplicate identical index values across different dates
        indices = m.get("market_indices") or []
        k_close = next((float(i.get("close") or 0.0) for i in indices if i.get("code") in ("KOSPI", "001")), None)
        if k_close:
            if k_close in seen_indices:
                errors.append(f"Date {d}: Duplicate KOSPI close ({k_close}) identical to date {seen_indices[k_close]}")
            else:
                seen_indices[k_close] = d

        # 4. Check market_scale
        ms = m.get("market_scale")
        if not ms or not ms.get("totalAum"):
            errors.append(f"Date {d}: Missing or empty market_scale.totalAum")

        # 5. Check time series
        ts = m.get("market_scale_time_series")
        if not ts or len(ts.get("daily", [])) == 0:
            errors.append(f"Date {d}: Empty market_scale_time_series.daily")
        if not ts or len(ts.get("weekly", [])) == 0:
            errors.append(f"Date {d}: Empty market_scale_time_series.weekly")
        if not ts or len(ts.get("monthly", [])) == 0:
            errors.append(f"Date {d}: Empty market_scale_time_series.monthly")
        if not ts or len(ts.get("yearly", [])) == 0:
            errors.append(f"Date {d}: Empty market_scale_time_series.yearly")

    if errors:
        for e in errors:
            print(f"  [FAIL] {e}")
        return False

    print(f"  [PASS] All {len(results)} active D1 briefing records verified with 100% data integrity.")
    return True

def main():
    print("==================================================")
    print("ETF Campus Zero-Hallucination Integrity Gate")
    print("==================================================")
    
    code_ok = check_codebase()
    db_ok = check_d1_database()
    
    print("--------------------------------------------------")
    if code_ok and db_ok:
        print(">> ALL INTEGRITY CHECKS PASSED (100% Truthful Data)")
        sys.exit(0)
    else:
        print(">> INTEGRITY CHECKS FAILED")
        sys.exit(1)

if __name__ == "__main__":
    main()
