"""
lib/indices.py

Single Source of Truth (SSOT) for market index codes, names, ticker-to-canonical mapping,
and CANONICAL_MACRO_CODES validation across ETF Campus data pipelines and D1 storage.
"""

from __future__ import annotations

from typing import Any, Iterable

# 12대 정규 거시 지표 표준 집합 (Canonical Codes)
CANONICAL_MACRO_CODES: frozenset[str] = frozenset({
    "KOSPI",
    "KOSDAQ",
    "VKOSPI",
    "SPX",
    "NDX",
    "VIX",
    "USDKRW",
    "KR10Y",
    "DGS10",
    "CLF",
    "GC",
    "SI",
})

# 수집 소스(Yahoo, ECOS, KRX 등) 원시 티커/별칭 -> 정규 코드 매핑
RAW_SOURCE_TO_CANONICAL: dict[str, str] = {
    # US / Global (Yahoo Finance tickers)
    "^GSPC": "SPX",
    "SPX": "SPX",
    "^IXIC": "NDX",
    "NDX": "NDX",
    "^VIX": "VIX",
    "VIX": "VIX",
    "^TNX": "DGS10",
    "DGS10": "DGS10",
    "CL=F": "CLF",
    "CLF": "CLF",
    "GC=F": "GC",
    "GC": "GC",
    "SI=F": "SI",
    "SI": "SI",
    # FX
    "KRW=X": "USDKRW",
    "USDKRW": "USDKRW",
    # Domestic (KRX / ECOS)
    "KOSPI": "KOSPI",
    "KOSDAQ": "KOSDAQ",
    "VKOSPI": "VKOSPI",
    "KR10Y": "KR10Y",
}

# 정규 코드 -> 한글 공식 레이블 매핑
CANONICAL_TO_LABEL: dict[str, str] = {
    "KOSPI": "코스피",
    "KOSDAQ": "코스닥",
    "VKOSPI": "코스피 변동성지수",
    "KR10Y": "국채 10년",
    "USDKRW": "원/달러",
    "SPX": "S&P 500",
    "NDX": "나스닥",
    "DGS10": "미 국채 10년물",
    "VIX": "VIX",
    "CLF": "WTI 원유",
    "GC": "금 선물",
    "SI": "은 선물",
}

# 한글 레이블 -> 정규 코드 역매핑
LABEL_TO_CANONICAL: dict[str, str] = {
    label: code for code, label in CANONICAL_TO_LABEL.items()
}


def normalize_index_code(code_or_label: str) -> str:
    """원시 심볼 또는 한글 레이블을 12대 정규 코드로 변환합니다."""
    raw = str(code_or_label or "").strip()
    if raw in RAW_SOURCE_TO_CANONICAL:
        return RAW_SOURCE_TO_CANONICAL[raw]
    if raw in LABEL_TO_CANONICAL:
        return LABEL_TO_CANONICAL[raw]
    raw_upper = raw.upper()
    if raw_upper in RAW_SOURCE_TO_CANONICAL:
        return RAW_SOURCE_TO_CANONICAL[raw_upper]
    return raw


def get_index_label(code_or_label: str) -> str:
    """정규 코드 또는 심볼에 해당하는 공식 한글 레이블을 반환합니다."""
    canon = normalize_index_code(code_or_label)
    return CANONICAL_TO_LABEL.get(canon, str(code_or_label))


def validate_canonical_macro_codes(codes_or_items: Iterable[Any]) -> tuple[bool, set[str]]:
    """12대 정규 지표가 모두 포함되어 있는지 엄격히 검증합니다.
    
    Returns:
        (is_valid, missing_codes)
    """
    found_codes: set[str] = set()
    for item in codes_or_items:
        if isinstance(item, dict):
            raw = item.get("code") or item.get("label") or ""
        elif isinstance(item, str):
            raw = item
        else:
            raw = getattr(item, "code", getattr(item, "label", ""))
        canon = normalize_index_code(str(raw))
        if canon in CANONICAL_MACRO_CODES:
            found_codes.add(canon)

    missing = CANONICAL_MACRO_CODES - found_codes
    return len(missing) == 0, missing
