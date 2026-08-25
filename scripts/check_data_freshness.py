"""Fail loudly when the ETF snapshot has fallen behind the market.

The daily refresh can go wrong quietly: if the official feed has not published
a close yet, the collector falls back to the previous trading day, reports no
change, and the workflow ends green. Nothing is broken from the job's point of
view, but the site silently serves stale prices for days.

This check runs at the end of the daily retry ladder and compares the snapshot's
bas_dt against the most recent trading day. One missed trading day is enough to
fail the run so the operator gets a notification the same day.

Market holidays are read from data/market_holidays.txt. That file starts empty,
so the first holiday after deployment will fail this check once; add the date to
the file and the alarm becomes accurate again.
"""

from __future__ import annotations

import argparse
import csv
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from trading_days import load_holidays, latest_trading_day

KST = timezone(timedelta(hours=9))
DEFAULT_MASTER = Path("data/etf_master_draft.csv")
DEFAULT_HOLIDAYS = Path("data/market_holidays.txt")


def read_bas_dt(path: Path) -> str:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        row = next(csv.DictReader(handle), None)
    if row is None:
        raise RuntimeError(f"{path}: 데이터 행이 없습니다.")
    bas_dt = (row.get("bas_dt") or "").strip()
    if len(bas_dt) != 8 or not bas_dt.isdigit():
        raise RuntimeError(f"{path}: bas_dt 값이 올바르지 않습니다: {bas_dt!r}")
    return bas_dt


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--master", type=Path, default=DEFAULT_MASTER)
    parser.add_argument("--holidays", type=Path, default=DEFAULT_HOLIDAYS)
    parser.add_argument("--today", help="YYYYMMDD, 테스트용 기준일 고정")
    args = parser.parse_args()

    today = (
        datetime.strptime(args.today, "%Y%m%d").date()
        if args.today
        else datetime.now(KST).date()
    )
    holidays = load_holidays(args.holidays)
    bas_dt = read_bas_dt(args.master)
    expected = latest_trading_day(today, holidays)
    expected_text = expected.strftime("%Y%m%d")

    print(f"기준일(bas_dt): {bas_dt}")
    print(f"기대 최신 거래일: {expected_text} (오늘 {today:%Y%m%d} KST)")

    if bas_dt >= expected_text:
        print("데이터가 최신입니다.")
        return 0

    lag = (expected - datetime.strptime(bas_dt, "%Y%m%d").date()).days
    print(
        f"\n::error::ETF 데이터가 {lag}일 뒤처져 있습니다 "
        f"(보유 {bas_dt} < 기대 {expected_text}).",
        file=sys.stderr,
    )
    print(
        "확인 순서: ① 오늘 실행 로그에서 수집 단계 오류 여부 "
        "② 공식 API 키 만료·쿼터 ③ 오늘이 휴장일이면 "
        f"{args.holidays}에 {expected_text}을 추가하십시오.",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
