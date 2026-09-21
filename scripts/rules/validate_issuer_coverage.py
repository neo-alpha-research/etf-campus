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
UNEXPLAINED_THRESHOLD = 15
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


def audit_shinhan(screener: dict[str, dict[str, Any]]) -> dict[str, Any]:
    file_path = SOURCES_DIR / "shinhan" / "sol_product_universe_20260906.json"
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    items = data.get("data", [])
    evidence_tickers = {x["ETF_CD6"]: x for x in items}
    screener_items = {k: v for k, v in screener.items() if v.get("issuer", {}).get("brand") == "SOL"}

    missing_tickers = set(screener_items.keys()) - set(evidence_tickers.keys())
    missing_derivs = {t for t in missing_tickers if screener_items[t].get("riskType") in ("leverage", "inverse")}
    unexplained = missing_tickers - missing_derivs

    personal_count = sum(1 for x in items if any("개인" in t for t in x.get("pensionNameList", []) or []))
    retirement_count = sum(1 for x in items if any("퇴직" in t for t in x.get("pensionNameList", []) or []))
    personal_only = [
        t for t, x in evidence_tickers.items()
        if any("개인" in p for p in x.get("pensionNameList", []) or [])
        and not any("퇴직" in p for p in x.get("pensionNameList", []) or [])
        and t in screener_items
    ]
    deriv_personal = [
        t for t, x in evidence_tickers.items()
        if any("개인" in p for p in x.get("pensionNameList", []) or [])
        and screener.get(t, {}).get("riskType") in ("leverage", "inverse")
    ]

    return {
        "issuer": "신한 (SOL)",
        "file": str(file_path.relative_to(REPO_ROOT)),
        "file_count": len(items),
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


def audit_nhamundi(screener: dict[str, dict[str, Any]]) -> dict[str, Any]:
    file_path = SOURCES_DIR / "nhamundi" / "hanaro_product_universe_20260906.json"
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    items = data.get("data", [])
    screener_items = {k: v for k, v in screener.items() if v.get("issuer", {}).get("brand") == "HANARO"}

    norm = lambda s: re.sub(r"\s+", "", s).lower()
    screener_norm = {norm(v.get("name", "")): k for k, v in screener_items.items()}
    evidence_tickers = {}
    for x in items:
        tk = screener_norm.get(norm(x.get("fundName", "")))
        if tk:
            evidence_tickers[tk] = x

    missing_tickers = set(screener_items.keys()) - set(evidence_tickers.keys())
    missing_derivs = {t for t in missing_tickers if screener_items[t].get("riskType") in ("leverage", "inverse")}
    unexplained = missing_tickers - missing_derivs

    personal_count = sum(1 for x in items if x.get("iPension") == "Y")
    retirement_count = sum(1 for x in items if x.get("rPension") == "Y")
    personal_only = [
        t for t, x in evidence_tickers.items()
        if x.get("iPension") == "Y" and x.get("rPension") != "Y"
        and t in screener_items
    ]
    deriv_personal = [
        t for t, x in evidence_tickers.items()
        if x.get("iPension") == "Y"
        and screener.get(t, {}).get("riskType") in ("leverage", "inverse")
    ]

    return {
        "issuer": "NH-Amundi (HANARO)",
        "file": str(file_path.relative_to(REPO_ROOT)),
        "file_count": len(items),
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


def audit_samsungactive(screener: dict[str, dict[str, Any]]) -> dict[str, Any]:
    file_path = SOURCES_DIR / "samsungactive" / "koact_product_universe_20260906.json"
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    items = data.get("data", [])
    evidence_tickers = {x["stkTicker"]: x for x in items}
    screener_items = {k: v for k, v in screener.items() if v.get("issuer", {}).get("brand") == "KoAct"}

    missing_tickers = set(screener_items.keys()) - set(evidence_tickers.keys())
    missing_derivs = {t for t in missing_tickers if screener_items[t].get("riskType") in ("leverage", "inverse")}
    unexplained = missing_tickers - missing_derivs

    personal_count = sum(1 for x in items if x.get("dcYn") == "개인연금")
    retirement_count = sum(1 for x in items if x.get("irpYn") == "퇴직연금")
    personal_only = [
        t for t, x in evidence_tickers.items()
        if x.get("dcYn") == "개인연금" and x.get("irpYn") != "퇴직연금"
        and t in screener_items
    ]
    deriv_personal = [
        t for t, x in evidence_tickers.items()
        if x.get("dcYn") == "개인연금"
        and screener.get(t, {}).get("riskType") in ("leverage", "inverse")
    ]

    return {
        "issuer": "삼성액티브 (KoAct)",
        "file": str(file_path.relative_to(REPO_ROOT)),
        "file_count": len(items),
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


def audit_hana(screener: dict[str, dict[str, Any]]) -> dict[str, Any]:
    file_path = SOURCES_DIR / "hana" / "oneq_product_universe_20260906.json"
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    items = data.get("data", [])
    evidence_tickers = {x["ticker"]: x for x in items}
    screener_items = {k: v for k, v in screener.items() if v.get("issuer", {}).get("brand") == "1Q"}

    missing_tickers = set(screener_items.keys()) - set(evidence_tickers.keys())
    missing_derivs = {t for t in missing_tickers if screener_items[t].get("riskType") in ("leverage", "inverse")}
    unexplained = missing_tickers - missing_derivs

    return {
        "issuer": "하나 (1Q)",
        "file": str(file_path.relative_to(REPO_ROOT)),
        "file_count": len(items),
        "screener_total": len(screener_items),
        "missing_count": len(missing_tickers),
        "missing_derivatives": len(missing_derivs),
        "unexplained_tickers": sorted(list(unexplained)),
        "is_closed": len(unexplained) == 0,
        "personal_pension_count": 0,
        "retirement_pension_count": len(items),
        "personal_only_count": 0,
        "personal_only_tickers": [],
        "note": "개인연금 구분필드 부재(판정 불가/보류 처리)",
    }


def audit_timefolio(screener: dict[str, dict[str, Any]]) -> dict[str, Any]:
    file_path = SOURCES_DIR / "timefolio" / "time_product_universe_20260906.json"
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    items = data.get("data", [])
    evidence_tickers = {x["ticker"]: x for x in items}
    screener_items = {k: v for k, v in screener.items() if v.get("issuer", {}).get("brand") == "TIME"}

    missing_tickers = set(screener_items.keys()) - set(evidence_tickers.keys())
    missing_derivs = {t for t in missing_tickers if screener_items[t].get("riskType") in ("leverage", "inverse")}
    unexplained = missing_tickers - missing_derivs

    personal_count = sum(1 for x in items if x.get("has_personal") and x["ticker"] in screener_items)
    retirement_count = sum(1 for x in items if x.get("has_retirement") and x["ticker"] in screener_items)
    personal_only = [
        t for t, x in evidence_tickers.items()
        if x.get("has_personal") and not x.get("has_retirement")
        and t in screener_items
    ]
    deriv_personal = [
        t for t, x in evidence_tickers.items()
        if x.get("has_personal")
        and screener.get(t, {}).get("riskType") in ("leverage", "inverse")
    ]

    return {
        "issuer": "타임폴리오 (TIME)",
        "file": str(file_path.relative_to(REPO_ROOT)),
        "file_count": len(items),
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


def audit_woori(screener: dict[str, dict[str, Any]]) -> dict[str, Any]:
    file_path = SOURCES_DIR / "woori" / "won_product_universe_20260906.json"
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    items = data.get("data", [])
    evidence_tickers = {x["ticker"]: x for x in items}
    screener_items = {k: v for k, v in screener.items() if v.get("issuer", {}).get("brand") == "WON"}

    missing_tickers = set(screener_items.keys()) - set(evidence_tickers.keys())
    missing_derivs = {t for t in missing_tickers if screener_items[t].get("riskType") in ("leverage", "inverse")}
    unexplained = missing_tickers - missing_derivs

    retirement_count = sum(1 for x in items if x.get("has_retirement") and x["ticker"] in screener_items)

    pers_file = SOURCES_DIR / "woori" / "won_personal_pension_verification_20260906.json"
    personal_count = 0
    if pers_file.exists():
        with open(pers_file, "r", encoding="utf-8") as pf:
            p_data = json.load(pf)
        personal_count = len([x for x in p_data.get("data", []) if x.get("personal_pension_status") == "가능" and x["ticker"] in screener_items])

    return {
        "issuer": "우리 (WON)",
        "file": str(file_path.relative_to(REPO_ROOT)),
        "file_count": len(items),
        "screener_total": len(screener_items),
        "missing_count": len(missing_tickers),
        "missing_derivatives": len(missing_derivs),
        "unexplained_tickers": sorted(list(unexplained)),
        "is_closed": len(unexplained) == 0,
        "personal_pension_count": personal_count,
        "retirement_pension_count": retirement_count,
        "personal_only_count": 0,
        "personal_only_tickers": [],
    }


ISSUER_COVERAGE_MIN = 0.90


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(description="Validate issuer coverage closure and personal pension scope")
    parser.add_argument("--json", action="store_true", help="Output raw JSON results")
    parser.add_argument("--record-only", action="store_true", help="Only record/update tracking file; always exit 0")
    parser.add_argument("--check-only", action="store_true", help="Only validate thresholds and timeouts; do not write files")
    args = parser.parse_args()

    screener = load_screener_data()

    audits = [
        audit_samsung(screener),
        audit_miraeasset(screener),
        audit_ace(screener),
        audit_kb(screener),
        audit_hanwha(screener),
        audit_kiwoom(screener),
        audit_shinhan(screener),
        audit_nhamundi(screener),
        audit_samsungactive(screener),
        audit_hana(screener),
        audit_timefolio(screener),
        audit_woori(screener),
    ]

    total_personal_only = sum(a["personal_only_count"] for a in audits)
    all_unexplained = {t: a["issuer"] for a in audits for t in a["unexplained_tickers"]}

    # Derivative personal pension guardrail
    full_universe_results = [a for a in audits if "derivative_personal_count" in a]
    deriv_personal_counts = {a["issuer"]: a.get("derivative_personal_count", 0) for a in full_universe_results}
    total_deriv_personal = sum(deriv_personal_counts.values())

    covered = sum(r["screener_total"] for r in audits)
    total_screener = len(screener)
    coverage_ratio = covered / total_screener if total_screener > 0 else 0.0

    if args.json:
        print(json.dumps({
            "audits": audits,
            "total_personal_only": total_personal_only,
            "unexplained_gaps": all_unexplained,
            "derivative_personal_guardrail": {
                "counts": deriv_personal_counts,
                "violation": total_deriv_personal > 0
            },
            "coverage": {
                "covered": covered,
                "total": total_screener,
                "ratio": coverage_ratio,
                "min_target": ISSUER_COVERAGE_MIN,
            }
        }, indent=2, ensure_ascii=False))
        return 0

    print("=" * 80)
    print("🔍 운용사 증거 파일 모수 폐쇄성 검사 (Issuer Evidence Closure Check)")
    print("=" * 80)
    print(f"{'운용사':<16} | {'파일행수':<6} | {'스크리너':<6} | {'누락파생':<6} | {'미설명누락':<8} | {'폐쇄여부':<6} | {'개인전용':<6}")
    print("-" * 80)

    for a in audits:
        closed_str = "✓ 닫힘" if a["is_closed"] else "✗ 미폐쇄"
        unexplained_str = f"{len(a['unexplained_tickers'])}건" if a["unexplained_tickers"] else "0건"
        print(f"{a['issuer']:<16} | {a['file_count']:>6} | {a['screener_total']:>6} | {a['missing_derivatives']:>6} | {unexplained_str:>8} | {closed_str:<6} | {a['personal_only_count']:>6}종")

    print("-" * 80)
    print(f"📊 증거파일 커버리지: {covered}/{total_screener} ({coverage_ratio:.1%}) [10대 운용사 전수 감사]")
    if coverage_ratio < ISSUER_COVERAGE_MIN:
        print(f"[WARN] 커버리지 {coverage_ratio:.1%} < 목표 {ISSUER_COVERAGE_MIN:.0%}", file=sys.stderr)
    else:
        print(f"  -> 목표 커버리지({ISSUER_COVERAGE_MIN:.0%}) 달성 확인 완료 (현재 {coverage_ratio:.1%})")

    print(f"📌 10대 운용사 합산 개인연금(연금저축) 전용 종목수: {total_personal_only}종목 (퇴직연금 불가이나 개인연금 가능)")
    print()

    # Guardrail check
    print("🛡️ [레버리지·인버스 개인연금 실측 가드레일]")
    universe_desc = "·".join(f"{r['issuer']} {r['file_count']}" for r in full_universe_results)
    print(f"전수 유니버스 {len(full_universe_results)}개사({universe_desc}) 레버리지·인버스 개인연금 표기: {total_deriv_personal}건")
    if total_deriv_personal == 0:
        print(f"  -> 실측 통과: 전수 유니버스 {len(full_universe_results)}개사 전 종목에서 레버리지·인버스 개인연금 표기 0건 확인.")
    else:
        print(f"  -> [CRITICAL VIOLATION] 레버리지 개인연금 표기 발견: {deriv_personal_counts}", file=sys.stderr)
        if not args.record_only:
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

    # Unverified count tracking & 30-day moving increase monitor
    unverified_count = sum(1 for x in screener.values() if x.get("personalPension") == "확인 필요")
    unverified_history = tracker_data.setdefault("unverified_history", [])
    
    found_today = False
    for entry in unverified_history:
        if entry.get("date") == today_str:
            entry["count"] = unverified_count
            found_today = True
            break
    if not found_today:
        unverified_history.append({"date": today_str, "count": unverified_count})
    unverified_history.sort(key=lambda x: str(x.get("date", "")))

    # Evaluate 30-day moving window growth
    today_date = date.today()
    history_30d = []
    for entry in unverified_history:
        try:
            ed = date.fromisoformat(entry["date"])
            days_ago = (today_date - ed).days
            if 0 < days_ago <= 30:
                history_30d.append((ed, int(entry["count"])))
        except Exception:
            pass

    if history_30d:
        history_30d.sort(key=lambda x: x[0])
        base_date, base_count = history_30d[0]
        if base_count > 0:
            growth_rate = (unverified_count - base_count) / base_count
            if growth_rate > 0.20:
                print(f"       [WARN] 신규 상장 유입 급증: '확인 필요' 30일 이동 증가폭 +{unverified_count - base_count}종 ({growth_rate:.1%}) > 20% 초과 (기준: {base_date.isoformat()} {base_count}종)", file=sys.stderr)

    # Persist clean payload if not in --check-only mode
    if not args.check_only:
        persist_items = {
            t: {k: v for k, v in item.items() if k not in ("days_unresolved", "last_checked")}
            for t, item in sorted(unexplained_items.items())
        }
        persist_payload = {
            "version": "1.1",
            "unverified_history": unverified_history,
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

    # If record-only, always exit 0 to protect daily data ingestion
    if args.record_only:
        return 0

    # Gate failure checks (evaluated during --check-only or default run)
    has_failure = False

    if total_deriv_personal > 0:
        print(f"[FAIL] 레버리지 개인연금 표기 발견 ({total_deriv_personal}건)", file=sys.stderr)
        has_failure = True

    if coverage_ratio < ISSUER_COVERAGE_MIN:
        print(f"[FAIL] 증거파일 커버리지 {coverage_ratio:.1%} < 목표 {ISSUER_COVERAGE_MIN:.0%}", file=sys.stderr)
        has_failure = True

    if len(all_unexplained) > UNEXPLAINED_THRESHOLD:
        print(f"[FAIL] 미설명 잔여 {len(all_unexplained)}건 (임계치 {UNEXPLAINED_THRESHOLD}건 초과)", file=sys.stderr)
        has_failure = True

    if expired_tickers:
        for ticker, days in expired_tickers:
            print(f"[FAIL] 미설명 잔여 종목 30일 초과 방치: {ticker} ({days}일 경과)", file=sys.stderr)
        has_failure = True

    return 1 if has_failure else 0


if __name__ == "__main__":
    sys.exit(main())
