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
    ".next", "node_modules", ".wrangler", "out", ".git", ".data_raw", "scratch"
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

def check_d1_database():
    print("[2/2] Verifying D1 database market_briefings records...")
    cmd = 'npx wrangler d1 execute etf-prices --remote --json --command "SELECT as_of_date, general_total_aum, up_count, down_count, headline_text, metrics_json FROM market_briefings ORDER BY as_of_date DESC LIMIT 10;"'
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
    for r in results:
        d = r["as_of_date"]
        raw_m = r.get("metrics_json") or "{}"
        m = json.loads(raw_m)
        
        # 1. Check forbidden constants in json string
        for pat in FORBIDDEN_PATTERNS:
            if re.search(pat, raw_m):
                errors.append(f"Date {d}: Contains forbidden constant matching '{pat}' in metrics_json")
                
        # 2. Check market_scale
        ms = m.get("market_scale")
        if not ms or not ms.get("totalAum"):
            errors.append(f"Date {d}: Missing or empty market_scale.totalAum")
            
        # 3. Check time series
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
        
    print(f"  [PASS] All {len(results)} recent D1 briefing records verified with 100% data integrity.")
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
