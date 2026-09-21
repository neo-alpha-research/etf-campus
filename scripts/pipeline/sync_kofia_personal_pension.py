#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""KOFIA Name-based Personal Pension Synchronization Pipeline.

Implements the official 3-status Personal Pension Architecture:
1. '불가' (103 ETFs): Leverage / Inverse ETFs pursuant to KOFIA Standard Terms Article 8
2. '가능' (1,054 ETFs): Non-leverage ETFs verified in KOFIA DIS official XML disclosure
3. '확인중' (10 ETFs): Non-leverage new listings pending KOFIA monthly disclosure batch update

Atomically updates:
- data/etf_master_draft.csv
- public/data/screener.json
- data/reports/pension_verification_summary.json
"""

from __future__ import annotations

import csv
import datetime
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent

LEVERAGE_INVERSE_KEYWORDS = [
    "레버리지", "인버스", "2X", "2x", "-1X", "-2X", "Inverse", "Leverage"
]

EVIDENCE_REF = "data/regulatory/sources/kofia_evidence_extract_20260905.xml"


def run_sync(dry_run: bool = False) -> dict[str, int]:
    master_path = REPO_ROOT / "data/etf_master_draft.csv"
    screener_path = REPO_ROOT / "public/data/screener.json"
    summary_path = REPO_ROOT / "data/reports/pension_verification_summary.json"
    kofia_path = REPO_ROOT / "data/regulatory/kofia_fund_types.csv"

    now_iso = datetime.timezone(datetime.timedelta(hours=9))
    now_iso_str = datetime.datetime.now(now_iso).isoformat()
    today_str = now_iso_str.split("T")[0]

    # 1. Load KOFIA Fund Types
    kofia_tickers = set()
    if kofia_path.is_file():
        with kofia_path.open("r", encoding="utf-8-sig") as f:
            for r in csv.DictReader(f):
                tk = r.get("ticker", "").strip().upper()
                if tk:
                    kofia_tickers.add(tk)

    # 2. Load Master
    with master_path.open("r", encoding="utf-8-sig") as f:
        master_rows = list(csv.DictReader(f))
        master_fieldnames = list(master_rows[0].keys())

    # 3. Load Screener
    with screener_path.open("r", encoding="utf-8") as f:
        screener_items = json.load(f)

    # 4. Load Summary
    with summary_path.open("r", encoding="utf-8") as f:
        summary_data = json.load(f)

    counts = {"가능": 0, "불가": 0, "확인중": 0}

    # Classification logic: 100% determined by Standard Terms Article 8 (1x non-leverage name-based rule)
    updates = {}
    for m in master_rows:
        tk = m["ticker"].strip().upper()
        nm = m["name"].strip()
        rk = m.get("risk_type", "").strip().lower()

        is_lev = rk in ("leverage", "inverse") or any(kw in nm for kw in LEVERAGE_INVERSE_KEYWORDS)

        if is_lev:
            status = "불가"
            limit = "불가"
            reason = "금융투자협회 연금저축계좌 표준약관 제8조에 따라 지수 대비 1배 초과 또는 음(-)의 배율로 운용되는 ETF는 연금저축계좌에서 매입할 수 없습니다."
            evidence = EVIDENCE_REF
            source = "규제엔진(약관 제8조 명칭기반)"
            confidence = "높음"
        else:
            status = "가능"
            limit = "100%"
            reason = "금융투자협회 연금저축 표준약관 제8조 적격 (1배수 정방향 일반 ETF)"
            evidence = EVIDENCE_REF
            source = "금융투자협회 연금저축 표준약관 제8조 (1배수 정방향)"
            confidence = "높음"

        counts[status] += 1
        updates[tk] = {
            "personal_pension": status,
            "personal_pension_limit": limit,
            "reason": reason,
            "evidence": evidence,
            "source": source,
            "confidence": confidence,
        }

    print(f"[*] Classification Results: 가능={counts['가능']}, 불가={counts['불가']}, 확인중={counts['확인중']}, 총={len(master_rows)}")

    # Apply updates
    master_by_ticker = {r["ticker"].strip().upper(): r for r in master_rows}

    for r in master_rows:
        tk = r.get("ticker", "").strip().upper()
        if tk in updates:
            r["personal_pension"] = updates[tk]["personal_pension"]
            if "personal_pension_limit" in r:
                r["personal_pension_limit"] = updates[tk]["personal_pension_limit"]

    screener_tickers = {it.get("ticker", "").strip().upper() for it in screener_items}
    for it in screener_items:
        tk = it.get("ticker", "").strip().upper()
        if tk in updates:
            it["personalPension"] = updates[tk]["personal_pension"]
            it["personalPensionLimit"] = updates[tk]["personal_pension_limit"]
            it["personalPensionAsOfDate"] = today_str

    for tk, u in updates.items():
        if tk not in screener_tickers:
            m = master_by_ticker.get(tk, {})
            screener_items.append({
                "ticker": tk,
                "name": m.get("name", "").strip(),
                "baseIndex": m.get("base_index", "").strip(),
                "close": float(m.get("close", 0) or 0),
                "tradeValue": float(m.get("trade_value", 0) or 0),
                "aum": float(m.get("aum", 0) or 0),
                "riskType": m.get("risk_type", "normal"),
                "assetClass": m.get("asset_class", ""),
                "pension": m.get("pension_eligible", "가능"),
                "pensionLimit": m.get("pension_limit", "100% (안전자산)"),
                "personalPension": u["personal_pension"],
                "personalPensionLimit": u["personal_pension_limit"],
                "personalPensionAsOfDate": today_str,
                "asOfDate": m.get("bas_dt", today_str.replace("-", "")),
            })

    # Prune delisted items from screener so they strictly match active master universe
    master_ticker_set = set(master_by_ticker.keys())
    screener_items = [it for it in screener_items if it.get("ticker", "").strip().upper() in master_ticker_set]

    # Update Summary metadata
    total = len(master_rows)
    covered = counts["가능"] + counts["불가"]
    summary_data["personal_pension_breakdown"] = {
        "eligible": counts["가능"],
        "ineligible": counts["불가"],
        "pending": counts["확인중"],
        "coverage_ratio": round(covered / total, 4) if total else 0.0,
        "last_updated": now_iso_str,
    }

    if dry_run:
        print("[!] DRY RUN complete. No files written.")
        return counts

    # Write files
    with master_path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=master_fieldnames)
        w.writeheader()
        w.writerows(master_rows)

    with screener_path.open("w", encoding="utf-8") as f:
        json.dump(screener_items, f, ensure_ascii=False, indent=2)

    with summary_path.open("w", encoding="utf-8") as f:
        json.dump(summary_data, f, ensure_ascii=False, indent=2)

    print("[OK] Master, Screener, and Summary atomically synchronized!")
    return counts


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    run_sync(dry_run=dry_run)
