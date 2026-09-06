#!/usr/bin/env python3
"""Issuer Evidence Coverage and Closure Validator (Closure Check).

Verifies the mathematical closure and completeness of issuer evidence files:
1. Closure Check:
   evidence_count + excluded_count == screener_count
   where excluded_count must consist entirely of explainable categories (leverage, inverse).
2. Unexplained Gap Detection:
   Any missing product that is NOT leverage or inverse is flagged as an unexplained gap.
   Such items are strictly isolated and marked as '개인연금 판정 불가 (unverified / 표시 보류)'.
3. Empirical Leverage Personal Pension Guardrail:
   Verifies that across the 4 full-universe issuers (TIGER 231, KB 143, PLUS 84, KIWOOM 70),
   the official disclosure of personal pension for leverage/inverse is strictly 0.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Set

from datetime import date, datetime

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SOURCES_DIR = REPO_ROOT / "data" / "regulatory" / "sources" / "issuers"
SCREENER_JSON = REPO_ROOT / "public" / "data" / "screener.json"
UNEXPLAINED_TRACKER_PATH = REPO_ROOT / "data" / "regulatory" / "unexplained_coverage.json"
UNEXPLAINED_THRESHOLD = 5
UNEXPLAINED_MAX_DAYS = 30


def load_screener_data() -> dict[str, dict[str, Any]]:
    if not SCREENER_JSON.exists():
        print(f"[ERROR] Screener JSON not found: {SCREENER_JSON}", file=sys.stderr)
        sys.exit(1)
    with open(SCREENER_JSON, "r", encoding="utf-8") as f:
        items = json.load(f)
    return {x["ticker"]: x for x in items}


def audit_samsung(screener: dict[str, dict[str, Any]]) -> dict[str, Any]:
    file_path = SOURCES_DIR / "samsung" / "kodex_pension_search_20260906.json"
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    evidence_tickers = {x["stkTicker"]: x for x in data}
    screener_items = {k: v for k, v in screener.items() if v.get("issuer", {}).get("brand") == "KODEX"}

    missing_tickers = set(screener_items.keys()) - set(evidence_tickers.keys())
    missing_derivs = {t for t in missing_tickers if screener_items[t].get("riskType") in ("leverage", "inverse")}
    unexplained = missing_tickers - missing_derivs

    personal_count = sum(1 for x in data if x.get("ivPsbIndv") == "100%")
    retirement_count = sum(1 for x in data if x.get("ivPsbReti") in ("70%", "100%"))
    personal_only = [t for t, x in evidence_tickers.items() if x.get("ivPsbIndv") == "100%" and x.get("ivPsbReti") == "0%"]

    return {
        "issuer": "삼성 (KODEX)",
        "file": str(file_path.relative_to(REPO_ROOT)),
        "file_count": len(data),
        "screener_total": len(screener_items),
        "missing_count": len(missing_tickers),
        "missing_derivatives": len(missing_derivs),
        "unexplained_tickers": sorted(list(unexplained)),
        "is_closed": len(unexplained) == 0,
        "personal_pension_count": personal_count,
        "retirement_pension_count": retirement_count,
        "personal_only_count": len(personal_only),
        "personal_only_tickers": sorted(personal_only),
    }


def audit_miraeasset(screener: dict[str, dict[str, Any]]) -> dict[str, Any]:
    file_path = SOURCES_DIR / "miraeasset" / "tiger_pension_search_20260906.html"
    with open(file_path, "r", encoding="utf-8") as f:
        html = f.read()

    rows = html.split('class="c-data-row"')
    evidence_items = {}
    for r in rows[1:]:
        m = re.search(r'data-ksd-fund="KR7([0-9A-Z]{6})', r)
        if m:
            code = m.group(1)
            evidence_items[code] = {
                "personal": "개인연금" in r,
                "retirement": "퇴직연금" in r,
            }

    screener_items = {k: v for k, v in screener.items() if v.get("issuer", {}).get("brand") == "TIGER"}
    missing_tickers = set(screener_items.keys()) - set(evidence_items.keys())
    missing_derivs = {t for t in missing_tickers if screener_items[t].get("riskType") in ("leverage", "inverse")}
    unexplained = missing_tickers - missing_derivs

    personal_count = sum(1 for x in evidence_items.values() if x["personal"])
    retirement_count = sum(1 for x in evidence_items.values() if x["retirement"])
    personal_only = [t for t, x in evidence_items.items() if x["personal"] and not x["retirement"]]
    deriv_personal = [t for t, x in evidence_items.items() if x["personal"] and screener.get(t, {}).get("riskType") in ("leverage", "inverse")]

    return {
        "issuer": "미래에셋 (TIGER)",
        "file": str(file_path.relative_to(REPO_ROOT)),
        "file_count": len(evidence_items),
        "screener_total": len(screener_items),
        "missing_count": len(missing_tickers),
        "missing_derivatives": len(missing_derivs),
        "unexplained_tickers": sorted(list(unexplained)),
        "is_closed": len(unexplained) == 0,
        "personal_pension_count": personal_count,
        "retirement_pension_count": retirement_count,
        "personal_only_count": len(personal_only),
        "personal_only_tickers": sorted(personal_only),
        "derivative_personal_count": len(deriv_personal),
    }


def audit_ace(screener: dict[str, dict[str, Any]]) -> dict[str, Any]:
    file_path = SOURCES_DIR / "ace" / "ace_pension_search_20260906.json"
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    evidence_tickers = {x["badge"]["stockCode"]: x for x in data["data"]}
    screener_items = {k: v for k, v in screener.items() if v.get("issuer", {}).get("brand") == "ACE"}

    missing_tickers = set(screener_items.keys()) - set(evidence_tickers.keys())
    missing_derivs = {t for t in missing_tickers if screener_items[t].get("riskType") in ("leverage", "inverse")}
    unexplained = missing_tickers - missing_derivs

    personal_count = sum(1 for x in data["data"] if "개인연금" in x.get("pensionType", ""))
    retirement_count = sum(1 for x in data["data"] if "퇴직연금" in x.get("pensionType", ""))
    personal_only = [t for t, x in evidence_tickers.items() if "개인연금" in x.get("pensionType", "") and "퇴직연금" not in x.get("pensionType", "")]

    return {
        "issuer": "한국투자 (ACE)",
        "file": str(file_path.relative_to(REPO_ROOT)),
        "file_count": len(data["data"]),
        "screener_total": len(screener_items),
        "missing_count": len(missing_tickers),
        "missing_derivatives": len(missing_derivs),
        "unexplained_tickers": sorted(list(unexplained)),
        "is_closed": len(unexplained) == 0,
        "personal_pension_count": personal_count,
        "retirement_pension_count": retirement_count,
        "personal_only_count": len(personal_only),
        "personal_only_tickers": sorted(personal_only),
    }


def audit_kb(screener: dict[str, dict[str, Any]]) -> dict[str, Any]:
    file_path = SOURCES_DIR / "kb" / "rise_product_universe_20260906.json"
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    evidence_tickers = {x["ticker"]: x for x in data["data"]}
    screener_items = {k: v for k, v in screener.items() if v.get("issuer", {}).get("brand") == "RISE"}

    missing_tickers = set(screener_items.keys()) - set(evidence_tickers.keys())
    missing_derivs = {t for t in missing_tickers if screener_items[t].get("riskType") in ("leverage", "inverse")}
    unexplained = missing_tickers - missing_derivs

    personal_count = sum(1 for x in data["data"] if x.get("personal_pension_badge"))
    retirement_count = sum(1 for x in data["data"] if x.get("retirement_pension_badge"))
    personal_only = [t for t, x in evidence_tickers.items() if x.get("personal_pension_badge") and not x.get("retirement_pension_badge")]
    deriv_personal = [t for t, x in evidence_tickers.items() if x.get("personal_pension_badge") and screener.get(t, {}).get("riskType") in ("leverage", "inverse")]

    return {
        "issuer": "KB (RISE)",
        "file": str(file_path.relative_to(REPO_ROOT)),
        "file_count": len(data["data"]),
        "screener_total": len(screener_items),
        "missing_count": len(missing_tickers),
        "missing_derivatives": len(missing_derivs),
        "unexplained_tickers": sorted(list(unexplained)),
        "is_closed": len(unexplained) == 0,
        "personal_pension_count": personal_count,
        "retirement_pension_count": retirement_count,
        "personal_only_count": len(personal_only),
        "personal_only_tickers": sorted(personal_only),
        "derivative_personal_count": len(deriv_personal),
    }


def audit_hanwha(screener: dict[str, dict[str, Any]]) -> dict[str, Any]:
    file_path = SOURCES_DIR / "hanwha" / "plus_product_universe_20260906.json"
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    evidence_tickers = {x["nameCode"]: x for x in data["data"]}
    screener_items = {k: v for k, v in screener.items() if v.get("issuer", {}).get("brand") == "PLUS"}

    missing_tickers = set(screener_items.keys()) - set(evidence_tickers.keys())
    missing_derivs = {t for t in missing_tickers if screener_items[t].get("riskType") in ("leverage", "inverse")}
    unexplained = missing_tickers - missing_derivs

    personal_count = sum(1 for x in data["data"] if "개인연금" in x.get("optionList", []))
    retirement_count = sum(1 for x in data["data"] if "퇴직연금" in x.get("optionList", []))
    personal_only = [t for t, x in evidence_tickers.items() if "개인연금" in x.get("optionList", []) and "퇴직연금" not in x.get("optionList", [])]
    deriv_personal = [t for t, x in evidence_tickers.items() if "개인연금" in x.get("optionList", []) and screener.get(t, {}).get("riskType") in ("leverage", "inverse")]

    return {
        "issuer": "한화 (PLUS)",
        "file": str(file_path.relative_to(REPO_ROOT)),
        "file_count": len(data["data"]),
        "screener_total": len(screener_items),
        "missing_count": len(missing_tickers),
        "missing_derivatives": len(missing_derivs),
        "unexplained_tickers": sorted(list(unexplained)),
        "is_closed": len(unexplained) == 0,
        "personal_pension_count": personal_count,
        "retirement_pension_count": retirement_count,
        "personal_only_count": len(personal_only),
        "personal_only_tickers": sorted(personal_only),
        "derivative_personal_count": len(deriv_personal),
    }


def audit_kiwoom(screener: dict[str, dict[str, Any]]) -> dict[str, Any]:
    file_path = SOURCES_DIR / "kiwoom" / "kiwoom_product_universe_20260906.json"
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    evidence_tickers = {x["gcode"]: x for x in data["data"]}
    screener_items = {k: v for k, v in screener.items() if v.get("issuer", {}).get("brand") in ("KIWOOM", "KOSEF", "HERO")}

    missing_tickers = set(screener_items.keys()) - set(evidence_tickers.keys())
    missing_derivs = {t for t in missing_tickers if screener_items[t].get("riskType") in ("leverage", "inverse")}
    unexplained = missing_tickers - missing_derivs

    personal_count = sum(1 for x in data["data"] if "개인연금" in x.get("pensionFlags", []))
    retirement_count = sum(1 for x in data["data"] if "퇴직연금" in x.get("pensionFlags", []))
    personal_only = [t for t, x in evidence_tickers.items() if "개인연금" in x.get("pensionFlags", []) and "퇴직연금" not in x.get("pensionFlags", [])]
    deriv_personal = [t for t, x in evidence_tickers.items() if "개인연금" in x.get("pensionFlags", []) and screener.get(t, {}).get("riskType") in ("leverage", "inverse")]

    return {
        "issuer": "키움 (KIWOOM)",
        "file": str(file_path.relative_to(REPO_ROOT)),
        "file_count": len(data["data"]),
        "screener_total": len(screener_items),
        "missing_count": len(missing_tickers),
        "missing_derivatives": len(missing_derivs),
        "unexplained_tickers": sorted(list(unexplained)),
        "is_closed": len(unexplained) == 0,
        "personal_pension_count": personal_count,
        "retirement_pension_count": retirement_count,
        "personal_only_count": len(personal_only),
        "personal_only_tickers": sorted(personal_only),
        "derivative_personal_count": len(deriv_personal),
    }


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(description="Validate issuer coverage closure and personal pension scope")
    parser.add_argument("--json", action="store_true", help="Output raw JSON results")
    args = parser.parse_args()

    screener = load_screener_data()

    audits = [
        audit_samsung(screener),
        audit_miraeasset(screener),
        audit_ace(screener),
        audit_kb(screener),
        audit_hanwha(screener),
        audit_kiwoom(screener),
    ]

    total_personal_only = sum(a["personal_only_count"] for a in audits)
    all_unexplained = {t: a["issuer"] for a in audits for t in a["unexplained_tickers"]}

    # Derivative personal pension guardrail
    full_universe_results = [a for a in audits if "derivative_personal_count" in a]
    deriv_personal_counts = {a["issuer"]: a.get("derivative_personal_count", 0) for a in full_universe_results}
    total_deriv_personal = sum(deriv_personal_counts.values())

    if args.json:
        print(json.dumps({
            "audits": audits,
            "total_personal_only": total_personal_only,
            "unexplained_gaps": all_unexplained,
            "derivative_personal_guardrail": {
                "counts": deriv_personal_counts,
                "violation": total_deriv_personal > 0
            }
        }, indent=2, ensure_ascii=False))
        return 0

    print("=" * 80)
    print("🔍 운용사 증거 파일 모수 폐쇄성 검사 (Issuer Evidence Closure Check)")
    print("=" * 80)
    print(f"{'운용사':<14} | {'파일행수':<6} | {'스크리너':<6} | {'누락파생':<6} | {'미설명누락':<8} | {'폐쇄여부':<6} | {'개인전용':<6}")
    print("-" * 80)

    for a in audits:
        closed_str = "✓ 닫힘" if a["is_closed"] else "✗ 미폐쇄"
        unexplained_str = f"{len(a['unexplained_tickers'])}건" if a["unexplained_tickers"] else "0건"
        print(f"{a['issuer']:<14} | {a['file_count']:>6} | {a['screener_total']:>6} | {a['missing_derivatives']:>6} | {unexplained_str:>8} | {closed_str:<6} | {a['personal_only_count']:>6}종")

    print("-" * 80)
    print(f"📌 6대 운용사 합산 개인연금(연금저축) 전용 종목수: {total_personal_only}종목 (퇴직연금 불가이나 개인연금 가능)")
    print()

    # Guardrail check
    print("🛡️ [레버리지·인버스 개인연금 실측 가드레일]")
    universe_desc = "·".join(f"{r['issuer']} {r['file_count']}" for r in full_universe_results)
    print(f"전수 유니버스 {len(full_universe_results)}개사({universe_desc}) 레버리지·인버스 개인연금 표기: {total_deriv_personal}건")
    if total_deriv_personal == 0:
        print(f"  -> 실측 통과: 전수 유니버스 {len(full_universe_results)}개사 전 종목에서 레버리지·인버스 개인연금 표기 0건 확인.")
    else:
        print(f"  -> [CRITICAL VIOLATION] 레버리지 개인연금 표기 발견: {deriv_personal_counts}", file=sys.stderr)
        return 1

    # Unexplained tracking and 30-day timeout enforcement
    today_str = date.today().isoformat()
    tracker_data: dict[str, Any] = {"version": "1.0", "unexplained_items": {}}
    if UNEXPLAINED_TRACKER_PATH.exists():
        try:
            with open(UNEXPLAINED_TRACKER_PATH, "r", encoding="utf-8") as f:
                tracker_data = json.load(f)
        except Exception:
            pass

    unexplained_items = tracker_data.setdefault("unexplained_items", {})
    expired_tickers: list[tuple[str, int]] = []
    runtime_days_unresolved: dict[str, int] = {}

    for ticker, issuer in all_unexplained.items():
        etf = screener.get(ticker, {})
        if ticker in unexplained_items:
            first_detected_str = unexplained_items[ticker].get("first_detected", today_str)
            try:
                first_detected = date.fromisoformat(first_detected_str)
                days = (date.today() - first_detected).days
            except Exception:
                days = 0
            runtime_days_unresolved[ticker] = days
            if days > UNEXPLAINED_MAX_DAYS:
                expired_tickers.append((ticker, days))
        else:
            runtime_days_unresolved[ticker] = 0
            unexplained_items[ticker] = {
                "name": etf.get("name", "Unknown"),
                "issuer": issuer,
                "first_detected": today_str,
                "risk_type": etf.get("riskType", "unknown"),
                "pension_limit": etf.get("pensionLimit", "unknown"),
                "pension_verified": etf.get("pensionVerified", "N"),
                "reason": "운용사 공식 전체 상품 유니버스에 해당 종목 누락. 개인연금 한도 판정 불가로 UI 노출 보류 및 격리 조치",
                "action": "isolate_personal_pension_unverified",
            }

    # Purge resolved tickers
    for t in list(unexplained_items.keys()):
        if t not in all_unexplained:
            unexplained_items.pop(t, None)

    # Persist clean payload (excluding transient fields: days_unresolved, last_checked)
    persist_items = {
        t: {k: v for k, v in item.items() if k not in ("days_unresolved", "last_checked")}
        for t, item in sorted(unexplained_items.items())
    }
    persist_payload = {
        "version": "1.0",
        "unexplained_items": persist_items,
    }
    new_content = json.dumps(persist_payload, indent=2, ensure_ascii=False, sort_keys=True) + "\n"
    old_content = UNEXPLAINED_TRACKER_PATH.read_text(encoding="utf-8") if UNEXPLAINED_TRACKER_PATH.exists() else ""

    if new_content.strip() != old_content.strip():
        try:
            UNEXPLAINED_TRACKER_PATH.write_text(new_content, encoding="utf-8")
        except Exception as e:
            print(f"[WARN] Failed to update {UNEXPLAINED_TRACKER_PATH}: {e}", file=sys.stderr)

    print()
    if all_unexplained:
        print("⚠️ [미설명 잔여 종목 격리 조치 (P3 규칙 대상)]")
        for ticker, issuer in all_unexplained.items():
            etf = screener.get(ticker, {})
            name = etf.get("name", "Unknown")
            risk = etf.get("riskType", "unknown")
            pension_limit = etf.get("pensionLimit", "unknown")
            days = runtime_days_unresolved.get(ticker, 0)
            print(f"  • {ticker} {name} ({issuer}) - 방치 일수: {days}일 / 허용 최대: {UNEXPLAINED_MAX_DAYS}일")
            print(f"    - riskType: {risk} | 퇴직연금 한도: {pension_limit}")
            print(f"    - 조치: 운용사 공시 누락으로 개인연금 '판정 불가(표시 보류)'로 강제 마킹")
    else:
        print("✅ 모든 운용사 증거 파일이 100% 폐쇄성을 만족합니다.")

    print("=" * 80)

    # Gate failure checks
    if len(all_unexplained) > UNEXPLAINED_THRESHOLD:
        print(f"[FAIL] 미설명 잔여 {len(all_unexplained)}건 (임계치 {UNEXPLAINED_THRESHOLD}건 초과)", file=sys.stderr)
        return 1

    if expired_tickers:
        for ticker, days in expired_tickers:
            print(f"[FAIL] 미설명 잔여 종목 30일 초과 방치: {ticker} ({days}일 경과)", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
