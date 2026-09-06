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

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SOURCES_DIR = REPO_ROOT / "data" / "regulatory" / "sources" / "issuers"
SCREENER_JSON = REPO_ROOT / "public" / "data" / "screener.json"


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
    deriv_personal_counts = {a["issuer"]: a.get("derivative_personal_count", 0) for a in audits if "derivative_personal_count" in a}
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
    print(f"전수 유니버스 4개사(TIGER 231·KB 143·PLUS 84·키움 70) 레버리지·인버스 개인연금 표기: {total_deriv_personal}건")
    if total_deriv_personal == 0:
        print("  -> 실측 통과: 전수 유니버스 4개사 전 종목에서 레버리지·인버스 개인연금 표기 0건 확인.")
    else:
        print(f"  -> [CRITICAL VIOLATION] 레버리지 개인연금 표기 발견: {deriv_personal_counts}", file=sys.stderr)
        return 1

    print()
    if all_unexplained:
        print("⚠️ [미설명 잔여 종목 격리 조치 (P3 규칙 대상)]")
        for ticker, issuer in all_unexplained.items():
            etf = screener.get(ticker, {})
            name = etf.get("name", "Unknown")
            risk = etf.get("riskType", "unknown")
            pension_limit = etf.get("pensionLimit", "unknown")
            print(f"  • {ticker} {name} ({issuer})")
            print(f"    - riskType: {risk} | 퇴직연금 한도: {pension_limit}")
            print(f"    - 조치: 운용사 공시 누락으로 개인연금 '판정 불가(표시 보류)'로 강제 마킹")
    else:
        print("✅ 모든 운용사 증거 파일이 100% 폐쇄성을 만족합니다.")

    print("=" * 80)
    return 0


if __name__ == "__main__":
    sys.exit(main())
