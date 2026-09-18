#!/usr/bin/env python3
"""
lib/calendar.py

한국(KRX) 및 미국(NYSE/NASDAQ) 거래소의 거래일 판정 및 직전/익일 거래일 역산을 전담하는 SSOT 모듈입니다.
data/calendar/trading_days.json 에 명시된 공식 휴장일 데이터를 기반으로 동작합니다.
"""

from __future__ import annotations

import json
import logging
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
CALENDAR_PATH = REPO_ROOT / "data" / "calendar" / "trading_days.json"

logger = logging.getLogger(__name__)

_CALENDAR_CACHE: dict[str, Any] | None = None


def load_calendar(force_reload: bool = False) -> dict[str, Any]:
    global _CALENDAR_CACHE
    if _CALENDAR_CACHE is not None and not force_reload:
        return _CALENDAR_CACHE

    if not CALENDAR_PATH.exists():
        raise FileNotFoundError(f"Trading calendar file not found: {CALENDAR_PATH}")

    with CALENDAR_PATH.open("r", encoding="utf-8") as f:
        data = json.load(f)

    _CALENDAR_CACHE = data
    return data


def normalize_market(market: str) -> str:
    m = market.strip().upper()
    if m in ("KR", "KRX", "KOREA", "KOSPI", "KOSDAQ"):
        return "KRX"
    if m in ("US", "USA", "NYSE", "NASDAQ", "SPX", "NDX"):
        return "US"
    raise ValueError(f"Unsupported market: {market}. Supported markets: KRX, US")


def parse_date(date_val: str | date | datetime) -> date:
    if isinstance(date_val, (date, datetime)):
        return date_val if isinstance(date_val, date) and not isinstance(date_val, datetime) else date_val.date()
    cleaned = str(date_val).replace("-", "").strip()
    if len(cleaned) == 8 and cleaned.isdigit():
        return date(int(cleaned[:4]), int(cleaned[4:6]), int(cleaned[6:]))
    return datetime.fromisoformat(str(date_val).split("T")[0]).date()


def is_trading_day(market: str, date_val: str | date | datetime) -> bool:
    """
    주어진 시장(KRX, US)과 날짜가 정상 거래일인지 판정합니다.
    - 주말(토, 일)은 False
    - 공식 휴장일 목록(trading_days.json)에 등재된 날은 False
    - 그 외 평일은 True
    """
    d = parse_date(date_val)
    # 주말 검사 (월=0 ... 금=4, 토=5, 일=6)
    if d.weekday() >= 5:
        return False

    canon_market = normalize_market(market)
    cal = load_calendar()
    holidays = set(cal.get("markets", {}).get(canon_market, {}).get("holidays", []))
    iso_str = d.isoformat()
    return iso_str not in holidays


def prev_trading_day(market: str, date_val: str | date | datetime) -> str:
    """
    주어진 기준일 이전의 가장 최근 정상 거래일(YYYY-MM-DD)을 반환합니다.
    """
    curr = parse_date(date_val) - timedelta(days=1)
    canon_market = normalize_market(market)
    # 최대 30일 역산 (연휴 등 대비)
    for _ in range(30):
        if is_trading_day(canon_market, curr):
            return curr.isoformat()
        curr -= timedelta(days=1)
    raise RuntimeError(f"Could not find previous trading day for {market} before {date_val}")


def next_trading_day(market: str, date_val: str | date | datetime) -> str:
    """
    주어진 기준일 이후의 가장 가까운 정상 거래일(YYYY-MM-DD)을 반환합니다.
    """
    curr = parse_date(date_val) + timedelta(days=1)
    canon_market = normalize_market(market)
    for _ in range(30):
        if is_trading_day(canon_market, curr):
            return curr.isoformat()
        curr += timedelta(days=1)
    raise RuntimeError(f"Could not find next trading day for {market} after {date_val}")


def check_calendar_expiry(warning_months: int = 3, as_of: date | None = None) -> bool:
    """
    캘린더 유효기간(valid_until)이 현재(또는 as_of)로부터 warning_months(약 90일) 이내에
    도래하는지 검사하고, 임박 시 경고를 로깅합니다.
    유효하면 True, 만료 임박/초과 시 False를 반환합니다.
    """
    cal = load_calendar()
    valid_until_str = cal.get("valid_until", "")
    if not valid_until_str:
        logger.warning("⚠️ Trading calendar has no valid_until field.")
        return False

    valid_until = parse_date(valid_until_str)
    today = as_of or date.today()
    days_left = (valid_until - today).days
    threshold_days = warning_months * 30

    if days_left < 0:
        logger.error(f"❌ Trading calendar EXPIRED on {valid_until_str} ({days_left} days ago)!")
        return False
    elif days_left <= threshold_days:
        logger.warning(
            f"⚠️ Trading calendar expires soon ({valid_until_str}, {days_left} days left). "
            f"Please update data/calendar/trading_days.json for the next year."
        )
        return False
    return True
