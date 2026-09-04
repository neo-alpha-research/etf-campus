#!/usr/bin/env python3
"""Holdings Asset Classifier.

Measures the empirical asset composition of ETFs based on individual constituents
fetched from the ETF Campus Holdings API (Cloudflare D1 / Pages Function).

Zero-Hallucination Mandates:
1. STRICT EVALUATION ORDER:
   1) bond (국고채, 통안채, 회사채, 특수채, 은행채, 카드채, Treasury, Bond, 국채선물 등)
   2) cash (원화현금, 외화현금, 예금, MMF, RP 등)
   3) commodity (Gold, Silver, 금현물, 은현물, 원유, 천연가스, 탄소배출권 등)
   4) reit (리츠, 인프라, REIT, 맥쿼리인프라 등)
   5) derivative (지수/개별주식 선물, 옵션 - 국채선물 제외)
   6) equity (국내외 상장 주식 및 주식형 인덱스 펀드)
   7) unknown (판정 불가)
2. NO DEFAULT TO EQUITY:
   If a constituent cannot be definitively identified, it MUST be categorized as 'unknown'.
   Defaulting to equity was the root cause of the 789 misclassifications and is strictly forbidden.
3. DOMESTIC ETF CIRCULARITY GUARD:
   Domestic ETFs in holdings are identified; if their asset character is not explicit in the name,
   they are marked 'unknown' and tracked to prevent circular reference to unverified master tags.
"""

from __future__ import annotations

import json
import logging
import re
import urllib.request
from typing import Any, Mapping

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("holdings_asset_classifier")

# ---------------------------------------------------------------------------
# 1. Regex Patterns by Asset Class
# ---------------------------------------------------------------------------

# 1) BOND: 국채선물 is explicitly classified as bond per directive Section 2-2
BOND_PATTERNS = [
    r"국고채권", r"국고\d{3,5}", r"국고채", r"국고", r"국채", r"통안", r"단기통안", r"통화안정",
    r"회사채", r"특수채", r"은행채", r"카드채", r"산금채", r"산은채", r"중진채", r"수은채", r"기금채",
    r"금융채", r"지방채", r"전단채", r"한전채", r"주택채", r"외평채", r"중장기채", r"단기채", r"종합채", r"채권",
    r"Treasury", r"Bond", r"Gilt", r"Bund", r"T-Note", r"\bNOTE\b", r"Debenture", r"머니마켓", r"국공채",
    r"^T \d+.*?\d{2}/\d{2}/\d{2}", r"^B \d{2}/\d{2}/\d{2}",
    r"은행(?:\([^)]*\))?\d+", r"증권\d+", r"한국전력\d+", r"공사\d+", r"공항공사", r"산금\d+", r"수출입금융",
    r"농금채", r"진흥공단", r"공단\s*\d+", r"개발공사", r"도시공사", r"카드\d+", r"캐피탈\d+",
    r"커머셜\d+", r"금융지주\d+", r"렌탈\d+", r"\bCP\b", r"^CP\(", r"단기사채", r"전자단기사채", r"발전\d+",
    r"(?:현대건설|현대제철|롯데웰푸드|현대트랜시스|현대차|기아|포스코|한화|LG|SK|롯데|두산|효성|CJ|GS|에쓰오일|S-Oil|KT|대한항공)\d{2,4}(?:-\d+)?"
]

# 2) CASH
CASH_PATTERNS = [
    r"원화현금", r"외화현금", r"현금", r"예금", r"정기예금", r"MMF", r"RP", r"단기금융", r"Call",
    r"\bREPO\b", r"\bCD\b", r"양도성예금", r"자금부\s*\d+"
]

# 3) DERIVATIVE (Non-bond futures and options - note that 국채선물 is classified as bond in Priority 1)
DERIVATIVE_PATTERNS = [
    r"선물", r"옵션", r"Futures", r"Option", r"코스피위클리", r"위클리",
    r"\bFUT\b", r"\bFUTR\b", r"E-?mini", r"\sF\s+\d{6}",
    r"\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\d{2}\b",
    r"\b20\d{2}\s+(?:0[1-9]|1[0-2])\b",
    r"\b20\d{2}-(?:0[1-9]|1[0-2])\b",
    r"\b20\d{2}(?:0[1-9]|1[0-2])\b",
    r"EMISSION\b"
]

# 4) COMMODITY (Physical commodities and physical commodity ETFs)
COMMODITY_PATTERNS = [
    r"Gold", r"Silver", r"금\s*현물", r"은\s*현물", r"^금\s*\d+", r"Crude Oil", r"WTI", r"원유",
    r"Copper", r"구리", r"Natural Gas", r"천연가스", r"탄소배출권", r"배출권", r"Carbon",
    r"농산물", r"대두", r"콩선물", r"Soybean", r"Corn", r"Wheat", r"URANIUM"
]

# 5) REIT & INFRASTRUCTURE
REIT_PATTERNS = [
    r"리츠", r"인프라", r"REIT", r"맥쿼리인프라", r"맵스리얼티", r"발해인프라", r"\bTRUST\b"
]

# Common domestic ETF brand prefixes
DOMESTIC_ETF_BRANDS = re.compile(
    r"^(KODEX|TIGER|RISE|ACE|PLUS|SOL|KBSTAR|HANARO|KOSEF|TIMEFOLIO|WOORI|WON)\b"
)

# Known domestic equity themes in ETF names
EQUITY_ETF_KEYWORDS = re.compile(
    r"200|코스피|나스닥|S&P|다우|퀄리티|배당|반도체|테크|빅테크|가치|성장|바이오|헬스케어|모빌리티|AI|2차전지|혁신|밸류업"
)


def classify_holding(name: str, code: str | None) -> tuple[str, str]:
    """Classify a constituent holding into one of 7 mutually exclusive categories.

    STRICT EVALUATION ORDER:
    1. bond
    2. cash
    3. derivative (선물 만기 표기, 옵션 등 - 국채선물은 1단계 bond로 먼저 분류됨)
    4. commodity (원자재 실물 및 실물 ETF)
    5. reit
    6. equity
    7. unknown
    """
    n = str(name or "").strip()
    c = str(code or "").strip()

    # 1. BOND (국고채, 통안채, 회사채, 특수채, 은행채, 카드채, Treasury, Bond, 국채선물 등)
    for pat in BOND_PATTERNS:
        if re.search(pat, n, re.IGNORECASE):
            return "bond", f"bond:{pat}"

    # 2. CASH (원화현금, 외화현금, 예금, MMF, RP 등)
    for pat in CASH_PATTERNS:
        if re.search(pat, n, re.IGNORECASE):
            return "cash", f"cash:{pat}"

    # 3. DERIVATIVE (옵션, 개별주식선물, 지수/원자재/탄소배출권 선물 - 국채선물은 1단계에서 이미 bond로 분류됨)
    for pat in DERIVATIVE_PATTERNS:
        if re.search(pat, n, re.IGNORECASE):
            return "derivative", f"derivative:{pat}"

    # 4. COMMODITY (Gold, Silver, 금현물, 은현물, 원유 등 실물 자산)
    for pat in COMMODITY_PATTERNS:
        if re.search(pat, n, re.IGNORECASE):
            return "commodity", f"commodity:{pat}"

    # 5. REIT & INFRA (리츠, 인프라, REIT 등)
    for pat in REIT_PATTERNS:
        if re.search(pat, n, re.IGNORECASE):
            return "reit", f"reit:{pat}"

    # 6. EQUITY
    # A) Foreign stock ticker pattern: e.g. AAPL, AAPL.O, BRKb, 1810.HK, 300750.SZ, 6857.T
    if re.match(r"^[A-Za-z0-9]{1,6}(\.[A-Za-z0-9]{1,3})?$", c) and not re.match(r"^\d{6}$", c):
        return "equity", f"foreign_stock:{c}"

    # B) Foreign equity index fund / ETF
    if re.search(r"Vanguard.*Index|SPDR.*Index|iShares.*Index|Invesco.*QQQ", n, re.IGNORECASE):
        return "equity", "foreign_equity_index_fund"

    # C) Domestic listed stock code (6 alphanumeric characters, e.g. 005930, 0126Z0, 000660)
    if re.match(r"^\d{6}$", c) or re.match(r"^\d{4,5}[0-9A-Z]{1,2}$", c):
        # Check if it is a domestic ETF
        if DOMESTIC_ETF_BRANDS.match(n):
            # If the ETF name explicitly indicates equity index/theme
            if EQUITY_ETF_KEYWORDS.search(n):
                return "equity", f"domestic_equity_etf:{n}"
            else:
                # Ambiguous domestic ETF: mark as unknown to avoid circular master reference
                return "unknown", f"domestic_etf_unresolved:{n}"
        return "equity", f"domestic_stock:{n}"

    # D) Known major domestic individual stocks without item_code
    if n in ["삼성전자", "SK하이닉스", "LG에너지솔루션", "현대차", "기아", "셀트리온", "NAVER", "카카오"]:
        return "equity", f"known_stock:{n}"

    # E) Foreign corporate stocks identified by statutory suffix or known company name
    if (
        re.search(r"\b(?:Inc|Corp|Corporation|Ltd|LLC|PLC|SE|AG|SA|NV|ASA)\b", n, re.IGNORECASE)
        or re.search(r"LVMH|HERMES|RICHEMONT|LEONARDO|SAAB|ASUSTEK|RELIANCE\s+INDUSTRIES", n, re.IGNORECASE)
        or re.search(r"JPMorgan.*?(?:Equity|Income)", n, re.IGNORECASE)
        or "TAIWAN SEMICONDUCTOR" in n.upper()
        or "MEDIATEK" in n.upper()
    ):
        return "equity", f"foreign_corp:{n}"

    # 7. UNKNOWN: Absolutely NO default to equity!
    return "unknown", "unmatched_default"


def measure_holdings_composition(holdings: list[Mapping[str, Any]]) -> dict[str, Any]:
    """Aggregate weights of constituents by asset class and return measured metrics."""
    sums = {
        "equity": 0.0,
        "bond": 0.0,
        "reit": 0.0,
        "commodity": 0.0,
        "cash": 0.0,
        "derivative": 0.0,
        "unknown": 0.0,
    }
    unknown_items: list[dict[str, Any]] = []

    for h in holdings:
        name = str(h.get("name") or "").strip()
        code = str(h.get("item_code") or "").strip()
        weight = float(h.get("weight_pct") or 0.0)

        category, reason = classify_holding(name, code)
        sums[category] += weight

        if category == "unknown":
            unknown_items.append({
                "name": name,
                "code": code,
                "weight_pct": weight,
                "reason": reason,
            })

    total_accounted = sum(sums.values())
    unknown_pct = round(sums["unknown"], 2)
    coverage_pct = round(100.0 - unknown_pct, 2)

    return {
        "measured_equity_pct": round(sums["equity"], 2),
        "measured_bond_pct": round(sums["bond"], 2),
        "measured_reit_pct": round(sums["reit"], 2),
        "measured_commodity_pct": round(sums["commodity"], 2),
        "measured_cash_pct": round(sums["cash"], 2),
        "measured_derivative_pct": round(sums["derivative"], 2),
        "measured_unknown_pct": unknown_pct,
        "measured_coverage_pct": coverage_pct,
        "measured_risk_basket_pct": round(sums["equity"] + sums["reit"] + sums["commodity"], 2),
        "measured_safe_basket_pct": round(sums["bond"] + sums["cash"], 2),
        "holdings_count": len(holdings),
        "total_weight_sum": round(total_accounted, 2),
        "unknown_items": unknown_items,
    }


# ---------------------------------------------------------------------------
# 2. Decision Thresholds (Rationale documented per Directive Step 79 §2)
# ---------------------------------------------------------------------------

# General ETFs use derivatives < 10% for liquidity. >= 20% indicates derivative structure vehicle (inverse/leverage).
DERIVATIVE_EXCLUSION_THRESHOLD_PCT: float = 20.0

# Dominant asset class must exceed a majority (> 50%). Below or equal to 50% is treated as mixed ('혼합').
DOMINANT_ASSET_THRESHOLD_PCT: float = 50.0


def evaluate_asset_dominance_and_applicability(
    measured: dict[str, Any],
    is_synthetic: bool = False,
) -> tuple[str, str, str, float]:
    """Evaluate measurement applicability and dominant asset class.

    Returns:
        (measured_applicable, measured_skip_reason, dominant_measured_asset, dominant_pct)
    """
    if is_synthetic:
        return "N", "합성구조", "", 0.0

    deriv_pct = measured.get("measured_derivative_pct", 0.0)
    if abs(deriv_pct) >= DERIVATIVE_EXCLUSION_THRESHOLD_PCT:
        return "N", "파생구조", "", 0.0

    cash_pct = measured.get("measured_cash_pct", 0.0)
    holdings_cnt = measured.get("holdings_count", 0)
    # Cash margin structure: cash >= 90% and holdings <= 5 indicates futures collateral structure
    if cash_pct >= 90.0 and holdings_cnt <= 5:
        return "N", "파생구조(증거금)", "", 0.0

    unk_pct = measured.get("measured_unknown_pct", 0.0)
    if unk_pct > 10.0:
        return "N", "unknown초과", "", 0.0

    # Find dominant asset among 6 valid categories
    asset_weights = {
        "equity": measured.get("measured_equity_pct", 0.0),
        "bond": measured.get("measured_bond_pct", 0.0),
        "reit": measured.get("measured_reit_pct", 0.0),
        "commodity": measured.get("measured_commodity_pct", 0.0),
        "cash": measured.get("measured_cash_pct", 0.0),
        "derivative": measured.get("measured_derivative_pct", 0.0),
    }
    max_asset, max_pct = max(asset_weights.items(), key=lambda x: x[1])

    if max_pct > DOMINANT_ASSET_THRESHOLD_PCT:
        return "Y", "", max_asset, max_pct
    else:
        return "Y", "", "혼합", max_pct


def fetch_etf_holdings(ticker: str, timeout: int = 10) -> list[dict[str, Any]] | None:
    """Fetch holdings for a given ETF from production D1 API."""
    url = f"https://etf-campus.pages.dev/api/holdings/{ticker}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (ETF-Campus-Classifier)"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            data = json.loads(res.read().decode("utf-8"))
            return data.get("holdings", [])
    except Exception as e:
        logger.debug(f"Failed to fetch holdings for {ticker}: {e}")
        return None
