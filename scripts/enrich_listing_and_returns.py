"""상장일·단기·장기 수익률 배치 확장.

환경변수 DATA_GO_KR_SERVICE_KEY가 필요하다. 비밀값은 인자나 파일에 기록하지 않는다.
기존 마스터 기준일을 사용하며, 최근 100일의 ETF 시세 스냅샷으로 상장 후 90일
여부와 최초 거래일을 판별한다. ITD는 첫 거래일 종가 대비 가격수익률이다.
"""

from __future__ import annotations

import argparse
import calendar
import csv
import json
import os
import time
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Iterable


BASE_URL = "https://apis.data.go.kr/1160100/service/GetSecuritiesProductInfoService/getETFPriceInfo"
PAGE_SIZE = 1000
LOOKBACK_DAYS = 100
NEW_LISTING_DAYS = 90


def parse_day(value: str) -> date:
    return datetime.strptime(value, "%Y%m%d").date()


def format_day(value: date) -> str:
    return value.strftime("%Y%m%d")


def subtract_months(value: date, months: int) -> date:
    month_index = value.year * 12 + value.month - 1 - months
    year, month_zero = divmod(month_index, 12)
    month = month_zero + 1
    day = min(value.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def request_page(service_key: str, bas_dt: str, page: int) -> tuple[list[dict], int]:
    params = urllib.parse.urlencode(
        {
            "serviceKey": service_key,
            "resultType": "json",
            "basDt": bas_dt,
            "numOfRows": PAGE_SIZE,
            "pageNo": page,
        }
    )
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(f"{BASE_URL}?{params}", timeout=30) as response:
                payload = json.loads(response.read().decode("utf-8"))
            body = payload["response"]["body"]
            items = (body.get("items") or {}).get("item") or []
            if isinstance(items, dict):
                items = [items]
            return items, int(body.get("totalCount", 0))
        except Exception as error:  # 네트워크·공공 API 일시 오류 재시도
            last_error = error
            if attempt < 2:
                time.sleep(2**attempt)
    raise RuntimeError(f"ETF 시세 API 조회 실패: 기준일 {bas_dt}, 페이지 {page}") from last_error


def fetch_snapshot(service_key: str, bas_dt: str) -> dict[str, dict]:
    rows: list[dict] = []
    page = 1
    while True:
        items, total = request_page(service_key, bas_dt, page)
        rows.extend(items)
        if not items or len(rows) >= total:
            break
        page += 1
    return {str(row.get("srtnCd", "")): row for row in rows if row.get("srtnCd")}


def close_map(snapshot: dict[str, dict]) -> dict[str, float]:
    output: dict[str, float] = {}
    for ticker, row in snapshot.items():
        raw = row.get("clpr")
        if raw not in (None, ""):
            output[ticker] = float(raw)
    return output


def calculate_return(current: float | None, anchor: float | None) -> float | None:
    if current is None or anchor in (None, 0):
        return None
    return round((current / anchor - 1) * 100, 2)


def read_csv(path: Path) -> tuple[list[dict[str, str]], list[str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        return list(reader), list(reader.fieldnames or [])


def write_csv(path: Path, rows: Iterable[dict[str, object]], fields: list[str]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def add_fields(fields: list[str], additions: Iterable[str]) -> list[str]:
    output = list(fields)
    for field in additions:
        if field not in output:
            output.append(field)
    return output


def snapshot_on_or_before(
    service_key: str,
    target: date,
    cache: dict[str, dict[str, dict]],
    maximum_backtrack: int = 10,
) -> tuple[str, dict[str, dict]]:
    candidate = target
    for _ in range(maximum_backtrack + 1):
        key = format_day(candidate)
        if key not in cache:
            cache[key] = fetch_snapshot(service_key, key)
        if cache[key]:
            return key, cache[key]
        candidate -= timedelta(days=1)
    raise RuntimeError(f"{format_day(target)} 이전 거래일 스냅샷을 찾지 못했습니다.")


def enrich(data_directory: Path, service_key: str, as_of_override: str | None = None) -> None:
    master_path = data_directory / "etf_master_draft.csv"
    returns_path = data_directory / "etf_returns_draft.csv"
    master_rows, master_fields = read_csv(master_path)
    return_rows, return_fields = read_csv(returns_path)
    if not master_rows or not return_rows:
        raise RuntimeError("마스터 또는 수익률 CSV가 비어 있습니다.")

    as_of_values = {row.get("bas_dt", "") for row in master_rows}
    if as_of_override:
        as_of_text = as_of_override
    elif len(as_of_values) == 1:
        as_of_text = as_of_values.pop()
    else:
        raise RuntimeError("마스터의 bas_dt가 하나로 일치하지 않습니다.")
    as_of = parse_day(as_of_text)
    cache: dict[str, dict[str, dict]] = {}

    print(f"최근 {LOOKBACK_DAYS}일 상장 이력 확인: 기준일 {as_of_text}")
    daily_snapshots: list[tuple[str, dict[str, dict]]] = []
    for offset in range(LOOKBACK_DAYS, -1, -1):
        day_text = format_day(as_of - timedelta(days=offset))
        snapshot = fetch_snapshot(service_key, day_text)
        cache[day_text] = snapshot
        if snapshot:
            daily_snapshots.append((day_text, snapshot))
    if not daily_snapshots:
        raise RuntimeError("최근 100일 사이에 ETF 시세 스냅샷이 없습니다.")

    earliest_snapshot_date = daily_snapshots[0][0]
    first_seen: dict[str, tuple[str, float]] = {}
    for day_text, snapshot in daily_snapshots:
        for ticker, close in close_map(snapshot).items():
            first_seen.setdefault(ticker, (day_text, close))

    _, current_snapshot = snapshot_on_or_before(service_key, as_of, cache)
    current_closes = close_map(current_snapshot)
    anchor_targets = {
        "r_1d": as_of - timedelta(days=1),
        "r_1w": as_of - timedelta(days=7),
        "r_2w": as_of - timedelta(days=14),
        "r_1m": subtract_months(as_of, 1),
        "r_2m": subtract_months(as_of, 2),
        "r_3m": subtract_months(as_of, 3),
        "r_6m": subtract_months(as_of, 6),
        "r_12m": subtract_months(as_of, 12),
    }
    anchor_closes: dict[str, dict[str, float]] = {}
    for field, target in anchor_targets.items():
        anchor_date, snapshot = snapshot_on_or_before(service_key, target, cache)
        anchor_closes[field] = close_map(snapshot)
        print(f"{field} 앵커: {anchor_date}")

    master_by_ticker = {row["ticker"]: row for row in master_rows}
    return_by_ticker = {row["ticker"]: row for row in return_rows}
    if set(master_by_ticker) != set(return_by_ticker):
        raise RuntimeError("마스터와 수익률 CSV의 ticker 구성이 다릅니다.")

    for ticker, master in master_by_ticker.items():
        first = first_seen.get(ticker)
        existing_listing = (master.get("listing_date") or "").strip()
        listing_date = existing_listing
        listing_source = (master.get("listing_date_source") or "").strip()
        if not listing_date and first and first[0] != earliest_snapshot_date:
            listing_date = first[0]
            listing_source = "price_api_first_seen"
        master["listing_date"] = listing_date
        master["listing_date_source"] = listing_source

        returns = return_by_ticker[ticker]
        current_close = current_closes.get(ticker)
        for field, anchors in anchor_closes.items():
            returns[field] = calculate_return(current_close, anchors.get(ticker))

        listing_age = (as_of - parse_day(listing_date)).days if listing_date else None
        returns["new_90d"] = "Y" if listing_age is not None and 0 <= listing_age <= NEW_LISTING_DAYS else "N"
        first_close = first[1] if first and listing_date == first[0] else None
        returns["r_itd"] = calculate_return(current_close, first_close) if returns["new_90d"] == "Y" else None

    master_fields = add_fields(master_fields, ["listing_date", "listing_date_source"])
    return_fields = add_fields(return_fields, ["r_1d", "r_1w", "r_2w", "r_1m", "r_2m", "r_3m", "r_6m", "r_12m", "r_itd", "new_90d"])
    write_csv(master_path, master_rows, master_fields)
    write_csv(returns_path, return_rows, return_fields)
    new_count = sum(row.get("new_90d") == "Y" for row in return_rows)
    print(f"완료: 신규 90일 이내 {new_count}종목, 마스터·수익률 CSV 갱신")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", default="data")
    parser.add_argument("--as-of", help="YYYYMMDD, 생략 시 마스터 bas_dt 사용")
    args = parser.parse_args()
    service_key = os.environ.get("DATA_GO_KR_SERVICE_KEY")
    if not service_key:
        raise SystemExit("DATA_GO_KR_SERVICE_KEY 환경변수가 필요합니다.")
    enrich(Path(args.data_dir), service_key, args.as_of)


if __name__ == "__main__":
    main()
