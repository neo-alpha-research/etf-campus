"""공식 ETF 시세 API로 프론트의 일일 CSV 3종을 원자적으로 갱신한다.

비밀키는 DATA_GO_KR_SERVICE_KEY 환경변수로만 읽는다. 목표일 데이터가 없으면
그 이전 최근 거래일을 사용하고, 원본 3종은 data/backups 아래에 먼저 복사한다.
"""

from __future__ import annotations

import argparse
import calendar
import csv
import os
import shutil
import sys
import tempfile
import time
import urllib.parse
import urllib.request
import json
from datetime import date, datetime, timedelta
from pathlib import Path

try:
    from .phase0_collect_and_tag import classify, pension_rule
except ImportError:
    from phase0_collect_and_tag import classify, pension_rule


BASE_URL = "https://apis.data.go.kr/1160100/service/GetSecuritiesProductInfoService/getETFPriceInfo"
FILES = ("etf_master_draft.csv", "etf_returns_draft.csv", "pension_verify_sheet.csv")
PERIODS = {
    "r_1d": ("days", 1),
    "r_1w": ("days", 7),
    "r_2w": ("days", 14),
    "r_1m": ("months", 1),
    "r_2m": ("months", 2),
    "r_3m": ("months", 3),
    "r_6m": ("months", 6),
    "r_12m": ("months", 12),
}
AVAILABLE_HISTORY_PERIODS = {
    "r_1d", "r_1w", "r_2w", "r_1m", "r_2m", "r_3m", "r_6m", "r_12m"
}
REQUEST_TIMEOUT_SECONDS = 15
MAX_REQUEST_ATTEMPTS = 2


def read_csv(path: Path) -> tuple[list[dict[str, str]], list[str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        return list(reader), list(reader.fieldnames or [])


def write_csv(path: Path, rows: list[dict[str, object]], fields: list[str]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def fetch_snapshot(service_key: str, day_text: str) -> dict[str, dict]:
    rows: list[dict] = []
    page = 1
    while True:
        query = urllib.parse.urlencode({
            "serviceKey": service_key,
            "resultType": "json",
            "basDt": day_text,
            "numOfRows": 1000,
            "pageNo": page,
        })
        last_error: Exception | None = None
        for attempt in range(MAX_REQUEST_ATTEMPTS):
            try:
                with urllib.request.urlopen(f"{BASE_URL}?{query}", timeout=REQUEST_TIMEOUT_SECONDS) as response:
                    payload = json.loads(response.read().decode("utf-8"))
                body = payload["response"]["body"]
                items = (body.get("items") or {}).get("item") or []
                if isinstance(items, dict):
                    items = [items]
                total = int(body.get("totalCount", 0))
                rows.extend(items)
                break
            except Exception as error:
                last_error = error
                if attempt < MAX_REQUEST_ATTEMPTS - 1:
                    time.sleep(1)
        else:
            raise RuntimeError(f"API 조회 실패: {day_text}, page {page}") from last_error
        if not items or len(rows) >= total:
            break
        page += 1
    return {str(row.get("srtnCd", "")): row for row in rows if row.get("srtnCd")}


def fetch_ticker_history(
    service_key: str,
    ticker: str,
    begin: date,
    end: date,
) -> list[tuple[date, float]]:
    rows: list[dict] = []
    page = 1
    while True:
        query = urllib.parse.urlencode({
            "serviceKey": service_key,
            "resultType": "json",
            "srtnCd": ticker,
            "beginBasDt": begin.strftime("%Y%m%d"),
            "endBasDt": end.strftime("%Y%m%d"),
            "numOfRows": 1000,
            "pageNo": page,
        })
        last_error: Exception | None = None
        for attempt in range(MAX_REQUEST_ATTEMPTS):
            try:
                with urllib.request.urlopen(f"{BASE_URL}?{query}", timeout=REQUEST_TIMEOUT_SECONDS) as response:
                    payload = json.loads(response.read().decode("utf-8"))
                body = payload["response"]["body"]
                items = (body.get("items") or {}).get("item") or []
                if isinstance(items, dict):
                    items = [items]
                total = int(body.get("totalCount", 0))
                rows.extend(items)
                break
            except Exception as error:
                last_error = error
                if attempt < MAX_REQUEST_ATTEMPTS - 1:
                    time.sleep(1)
        else:
            raise RuntimeError(f"ETF 가격 이력 조회 실패: {ticker}, page {page}") from last_error
        if not items or len(rows) >= total:
            break
        page += 1

    history: list[tuple[date, float]] = []
    for row in rows:
        day_text = str(row.get("basDt") or "")
        close = as_float(row.get("clpr"))
        if len(day_text) == 8 and close is not None:
            history.append((datetime.strptime(day_text, "%Y%m%d").date(), close))
    return sorted(history)


def select_period_anchor(history: list[tuple[date, float]], target: date) -> float | None:
    """기간 시작일 종가를 고르되 상장 전이면 최초 거래일 종가를 사용한다."""
    on_or_before = [item for item in history if item[0] <= target]
    if on_or_before:
        return on_or_before[-1][1]
    after = [item for item in history if item[0] > target]
    return after[0][1] if after else None


def on_or_before(service_key: str, target: date, cache: dict[str, dict[str, dict]], backtrack: int = 10) -> tuple[str, dict[str, dict]]:
    for offset in range(backtrack + 1):
        day_text = (target - timedelta(days=offset)).strftime("%Y%m%d")
        if day_text not in cache:
            cache[day_text] = fetch_snapshot(service_key, day_text)
        if cache[day_text]:
            return day_text, cache[day_text]
    raise RuntimeError(f"{target:%Y%m%d} 이전 거래일 데이터를 찾지 못했습니다.")


def resolve_snapshot(
    service_key: str,
    target: date,
    cache: dict[str, dict[str, dict]],
    require_exact_date: bool,
) -> tuple[str, dict[str, dict]] | None:
    if not require_exact_date:
        return on_or_before(service_key, target, cache)

    day_text = target.strftime("%Y%m%d")
    if day_text not in cache:
        cache[day_text] = fetch_snapshot(service_key, day_text)
    if not cache[day_text]:
        return None
    return day_text, cache[day_text]


def subtract_months(value: date, months: int) -> date:
    month_index = value.year * 12 + value.month - 1 - months
    year, month_zero = divmod(month_index, 12)
    month = month_zero + 1
    return date(year, month, min(value.day, calendar.monthrange(year, month)[1]))


def as_float(value: object) -> float | None:
    if value in (None, ""):
        return None
    return float(str(value))


def api_listing_date(value: object) -> str:
    """Return an API listing date only when it is an unambiguous YYYYMMDD value."""
    text = str(value or "").strip()
    return text if len(text) == 8 and text.isdigit() else ""


def pct(current: float | None, anchor: float | None) -> str:
    if current is None or anchor in (None, 0):
        return ""
    return f"{((current / anchor) - 1) * 100:.2f}".rstrip("0").rstrip(".")


def snapshot_value(row: dict, key: str, default: object = "") -> object:
    value = row.get(key)
    return default if value in (None, "") else value


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", default="data")
    parser.add_argument(
        "--require-exact-date",
        action="store_true",
        help="Do not fall back to a prior trading day when the requested date is unavailable.",
    )
    parser.add_argument("--target", help="YYYYMMDD, 기본값은 어제")
    args = parser.parse_args()
    service_key = os.environ.get("DATA_GO_KR_SERVICE_KEY")
    if not service_key:
        raise SystemExit("DATA_GO_KR_SERVICE_KEY 환경변수가 필요합니다.")

    data_dir = Path(args.data_dir)
    target = datetime.strptime(args.target, "%Y%m%d").date() if args.target else date.today() - timedelta(days=1)
    cache: dict[str, dict[str, dict]] = {}
    resolved = resolve_snapshot(service_key, target, cache, args.require_exact_date)
    if resolved is None:
        print(f"No data for requested date {target:%Y%m%d}; exiting without changes.")
        return
    as_of_text, current = resolved
    as_of = datetime.strptime(as_of_text, "%Y%m%d").date()
    print(f"공식 API 기준일 {as_of_text} · {len(current)}종목")

    old_master, master_fields = read_csv(data_dir / FILES[0])
    old_returns, return_fields = read_csv(data_dir / FILES[1])
    old_pension, pension_fields = read_csv(data_dir / FILES[2])
    master_by_ticker = {row["ticker"]: row for row in old_master}
    returns_by_ticker = {row["ticker"]: row for row in old_returns}
    pension_by_ticker = {row["ticker"]: row for row in old_pension}

    anchors: dict[str, dict[str, dict]] = {}
    anchor_dates: dict[str, date] = {}
    for field, (unit, amount) in PERIODS.items():
        target_day = as_of - timedelta(days=amount) if unit == "days" else subtract_months(as_of, amount)
        anchor_dates[field] = target_day
        anchor_text, anchor = on_or_before(service_key, target_day, cache)
        anchors[field] = anchor
        print(f"{field}: {anchor_text}")

    new_master: list[dict[str, object]] = []
    new_returns: list[dict[str, object]] = []
    new_pension: list[dict[str, object]] = []
    close_field = f"close_{as_of_text}"
    return_fields = [field for field in return_fields if not field.startswith("close_")]
    return_fields = ["ticker", "name", close_field] + [field for field in return_fields if field not in ("ticker", "name")]
    for addition in list(PERIODS) + ["r_itd", "itd_anchor_close", "new_90d", "new_3m"]:
        if addition not in return_fields:
            return_fields.append(addition)
    for addition in ("listing_date", "listing_date_source"):
        if addition not in master_fields:
            master_fields.append(addition)

    for ticker in sorted(current):
        api = current[ticker]
        existing = dict(master_by_ticker.get(ticker, {}))
        name = str(snapshot_value(api, "itmsNm"))
        base_index = str(snapshot_value(api, "bssIdxIdxNm"))
        risk, asset = classify(name, base_index)
        if asset == "기타":
            asset = "주식-국내"
        existing.update({
            "isin_cd": snapshot_value(api, "isinCd"), "ticker": ticker, "name": name,
            "base_index": base_index, "close": snapshot_value(api, "clpr", 0),
            "change_pct": snapshot_value(api, "fltRt", 0), "trade_value": snapshot_value(api, "trPrc", 0),
            "aum": snapshot_value(api, "nPptTotAmt", 0), "risk_type": existing.get("risk_type") or risk,
            "asset_class": existing.get("asset_class") or asset,
            "pension_eligible": existing.get("pension_eligible") or pension_rule(risk, name, base_index),
            "liquidity": "pass" if float(snapshot_value(api, "nPptTotAmt", 0)) >= 10_000_000_000 else "fail",
            "bas_dt": as_of_text,
        })
        current_close = as_float(api.get("clpr"))
        old_return = dict(returns_by_ticker.get(ticker, {}))
        old_return.update({"ticker": ticker, "name": name, close_field: snapshot_value(api, "clpr", "")})
        missing_fields = [
            field
            for field in AVAILABLE_HISTORY_PERIODS
            if as_float((anchors[field].get(ticker) or {}).get("clpr")) is None
        ]
        ticker_history: list[tuple[date, float]] = []
        api_listing = api_listing_date(api.get("lstgDt"))
        # A full history request for every ticker absent from an older snapshot
        # makes the daily job exceed the Actions budget. Existing ETFs already
        # retain their returns; only confirmed recent listings need a first close
        # to calculate ITD and their short-period returns.
        needs_recent_history = old_return.get("new_90d") == "Y" or bool(api_listing)
        if missing_fields and needs_recent_history:
            oldest_target = min(anchor_dates[field] for field in missing_fields)
            ticker_history = fetch_ticker_history(
                service_key,
                ticker,
                oldest_target - timedelta(days=10),
                as_of,
            )
        first = ticker_history[0] if ticker_history else None
        if not existing.get("listing_date"):
            if api_listing:
                existing["listing_date"] = api_listing
                existing["listing_date_source"] = "price_api_listing_date"
            elif first:
                existing["listing_date"] = first[0].strftime("%Y%m%d")
                existing["listing_date_source"] = "price_api_first_seen"
        new_master.append(existing)
        for field, snapshot in anchors.items():
            anchor_close = as_float((snapshot.get(ticker) or {}).get("clpr"))
            if anchor_close is None and field in AVAILABLE_HISTORY_PERIODS:
                anchor_close = select_period_anchor(ticker_history, anchor_dates[field])
            old_return[field] = pct(current_close, anchor_close)
        listing_date = str(existing.get("listing_date") or "")
        is_new = bool(listing_date and 0 <= (as_of - datetime.strptime(listing_date, "%Y%m%d").date()).days <= 90)
        old_return["new_90d"] = "Y" if is_new else "N"
        old_return["new_3m"] = "Y" if is_new else "N"
        itd_anchor = as_float(old_return.get("itd_anchor_close"))
        if is_new and itd_anchor is None and first:
            itd_anchor = first[1]
            old_return["itd_anchor_close"] = first[1]
        old_return["r_itd"] = pct(current_close, itd_anchor) if is_new else ""
        new_returns.append(old_return)

        pension = dict(pension_by_ticker.get(ticker, {}))
        if not pension:
            pension = {"official_src": "", "issuer_official": "", "verify_status": "신규 확인 필요", "final_pension": "확인중", "final_src": "pending"}
        pension.update({key: existing.get(key, "") for key in master_fields if key in pension_fields})
        new_pension.append(pension)

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = data_dir / "backups" / stamp
    backup.mkdir(parents=True, exist_ok=False)
    for filename in FILES:
        shutil.copy2(data_dir / filename, backup / filename)

    with tempfile.TemporaryDirectory(dir=data_dir) as temp_name:
        temp = Path(temp_name)
        write_csv(temp / FILES[0], new_master, master_fields)
        write_csv(temp / FILES[1], new_returns, return_fields)
        write_csv(temp / FILES[2], new_pension, pension_fields)
        for filename in FILES:
            os.replace(temp / filename, data_dir / filename)

    added = len(set(current) - set(master_by_ticker))
    removed = len(set(master_by_ticker) - set(current))
    new_count = sum(row["new_90d"] == "Y" for row in new_returns)
    print(f"갱신 완료 · 추가 {added} · 제외 {removed} · 신규 90일 {new_count} · 백업 {backup}")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"갱신 실패: {error}", file=sys.stderr)
        raise
