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
import urllib.error
import json
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

try:
    from .phase0_collect_and_tag import classify, pension_rule
except ImportError:
    from phase0_collect_and_tag import classify, pension_rule


BASE_URL = "https://apis.data.go.kr/1160100/service/GetSecuritiesProductInfoService/getETFPriceInfo"
KRX_ETF_DAILY_URL = "https://data-dbg.krx.co.kr/svc/apis/etp/etf_bydd_trd"
FILES = ("etf_master_draft.csv", "etf_returns_draft.csv", "pension_verify_sheet.csv")
PERIODS = {
    "r_1d": ("days", 1),
    "r_1w": ("days", 7),
    "r_2w": ("days", 14),
    "r_1m": ("months", 1),
    "r_2m": ("months", 2),
    "r_3m": ("months", 3),
    "r_6m": ("months", 6),
    "r_ytd": ("ytd", 0),
    "r_12m": ("months", 12),
    "r_24m": ("months", 24),
    "r_36m": ("months", 36),
}
AVAILABLE_HISTORY_PERIODS = {
    "r_1d", "r_1w", "r_2w", "r_1m", "r_2m", "r_3m", "r_6m", "r_ytd", "r_12m", "r_24m", "r_36m"
}
REQUEST_TIMEOUT_SECONDS = 15
MAX_REQUEST_ATTEMPTS = 2
KST = timezone(timedelta(hours=9))


def default_target_date(now: datetime | None = None) -> date:
    """Return yesterday in Korea, independent of the GitHub runner's UTC clock."""
    current = now.astimezone(KST) if now else datetime.now(KST)
    return current.date() - timedelta(days=1)


def compact_number(value: object) -> str:
    return str(value or "").replace(",", "").strip()


def normalize_krx_snapshot(payload: dict) -> dict[str, dict]:
    rows = payload.get("OutBlock_1") or []
    if isinstance(rows, dict):
        rows = [rows]
    snapshot: dict[str, dict] = {}
    for row in rows:
        ticker = str(row.get("ISU_SRT_CD") or row.get("ISU_CD") or "").strip()
        if not ticker:
            continue
        snapshot[ticker] = {
            "srtnCd": ticker,
            "itmsNm": str(row.get("ISU_NM") or "").strip(),
            "clpr": compact_number(row.get("TDD_CLSPRC")),
            "fltRt": compact_number(row.get("FLUC_RT")),
            "trPrc": compact_number(row.get("ACC_TRDVAL")),
            "nPptTotAmt": compact_number(row.get("INVSTASST_NETASST_TOTAMT")),
            "nav": compact_number(row.get("NAV")),
            "disparity": compact_number(row.get("PRC_DEV_RT")),
            "tracking_error": compact_number(row.get("TRACK_ERR_RT")),
            "bssIdxIdxNm": str(row.get("IDX_IND_NM") or "").strip(),
            "basDt": str(row.get("BAS_DD") or "").strip(),
        }
    return snapshot


def snapshot_is_complete(snapshot: dict[str, dict], expected_count: int) -> bool:
    valid_closes = sum(as_float(row.get("clpr")) is not None for row in snapshot.values())
    return (
        bool(snapshot)
        and len(snapshot) >= max(1, int(expected_count * 0.9))
        and valid_closes >= max(1, int(expected_count * 0.9))
    )


def historical_snapshot_is_complete(snapshot: dict[str, dict], expected_count: int) -> bool:
    """Reject weekend/error placeholders while allowing for a smaller past ETF universe."""
    valid_closes = sum(as_float(row.get("clpr")) is not None for row in snapshot.values())
    return (
        bool(snapshot)
        and len(snapshot) >= 200
        and valid_closes >= int(len(snapshot) * 0.8)
    )


def fetch_krx_snapshot(auth_key: str, day_text: str) -> dict[str, dict]:
    query = urllib.parse.urlencode({"basDd": day_text})
    request = urllib.request.Request(
        f"{KRX_ETF_DAILY_URL}?{query}",
        headers={"AUTH_KEY": auth_key},
    )
    last_error: Exception | None = None
    for attempt in range(MAX_REQUEST_ATTEMPTS):
        try:
            with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
                payload = json.loads(response.read().decode("utf-8"))
            return normalize_krx_snapshot(payload)
        except Exception as error:
            last_error = error
            if attempt < MAX_REQUEST_ATTEMPTS - 1:
                time.sleep(1)
    if isinstance(last_error, urllib.error.HTTPError):
        detail = f"HTTP {last_error.code}"
    elif isinstance(last_error, urllib.error.URLError):
        detail = f"network error ({type(last_error.reason).__name__})"
    else:
        detail = type(last_error).__name__ if last_error else "unknown error"
    raise RuntimeError(f"KRX ETF API lookup failed: {day_text} / {detail}") from last_error


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


def krx_on_or_before(
    auth_key: str,
    target: date,
    cache: dict[str, dict[str, dict]],
    backtrack: int = 10,
    expected_count: int = 0,
) -> tuple[str, dict[str, dict]]:
    for offset in range(backtrack + 1):
        day_text = (target - timedelta(days=offset)).strftime("%Y%m%d")
        if day_text not in cache:
            cache[day_text] = fetch_krx_snapshot(auth_key, day_text)
        if cache[day_text] and (
            expected_count <= 0
            or historical_snapshot_is_complete(cache[day_text], expected_count)
        ):
            return day_text, cache[day_text]
    raise RuntimeError(f"No KRX ETF data on or before {target:%Y%m%d}.")


def on_or_after(
    service_key: str,
    target: date,
    cache: dict[str, dict[str, dict]],
    forward: int = 10,
) -> tuple[str, dict[str, dict]]:
    for offset in range(forward + 1):
        day_text = (target + timedelta(days=offset)).strftime("%Y%m%d")
        if day_text not in cache:
            cache[day_text] = fetch_snapshot(service_key, day_text)
        if cache[day_text]:
            return day_text, cache[day_text]
    raise RuntimeError(f"No official ETF data on or after {target:%Y%m%d}.")


def krx_on_or_after(
    auth_key: str,
    target: date,
    cache: dict[str, dict[str, dict]],
    forward: int = 10,
) -> tuple[str, dict[str, dict]]:
    for offset in range(forward + 1):
        day_text = (target + timedelta(days=offset)).strftime("%Y%m%d")
        if day_text not in cache:
            cache[day_text] = fetch_krx_snapshot(auth_key, day_text)
        if cache[day_text]:
            return day_text, cache[day_text]
    raise RuntimeError(f"No KRX ETF data on or after {target:%Y%m%d}.")


def resolve_listing_closes(
    listing_dates: dict[str, date],
    source: str,
    krx_auth_key: str,
    service_key: str,
    krx_cache: dict[str, dict[str, dict]],
    public_cache: dict[str, dict[str, dict]],
) -> dict[str, float]:
    """Resolve first closes with one market snapshot per unique listing date."""
    tickers_by_date: dict[date, list[str]] = {}
    for ticker, listing_day in listing_dates.items():
        tickers_by_date.setdefault(listing_day, []).append(ticker)

    closes: dict[str, float] = {}
    for listing_day, tickers in sorted(tickers_by_date.items()):
        snapshot: dict[str, dict] = {}
        try:
            if source == "KRX Open API" and krx_auth_key:
                _, snapshot = krx_on_or_after(krx_auth_key, listing_day, krx_cache)
            elif service_key:
                _, snapshot = on_or_after(service_key, listing_day, public_cache)
        except Exception as error:
            print(f"Listing close lookup unavailable for {listing_day:%Y%m%d}: {error}")
            if source == "KRX Open API" and service_key:
                try:
                    _, snapshot = on_or_after(service_key, listing_day, public_cache)
                except Exception as fallback_error:
                    print(
                        f"Listing close fallback unavailable for {listing_day:%Y%m%d}: "
                        f"{fallback_error}"
                    )

        for ticker in tickers:
            close = as_float((snapshot.get(ticker) or {}).get("clpr"))
            if close is not None:
                closes[ticker] = close
    return closes


def resolve_krx_snapshot(
    auth_key: str,
    target: date,
    cache: dict[str, dict[str, dict]],
    require_exact_date: bool,
) -> tuple[str, dict[str, dict]] | None:
    if not require_exact_date:
        return krx_on_or_before(auth_key, target, cache)

    day_text = target.strftime("%Y%m%d")
    if day_text not in cache:
        cache[day_text] = fetch_krx_snapshot(auth_key, day_text)
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
    return float(compact_number(value))



def calculate_net_inflow(today_aum: float, yesterday_aum: float, daily_return_pct: float) -> float:
    """
    Quant Expert Logic: Calculate Daily Net Inflow handling split/merges implicitly.
    Net Inflow = Today AUM - [ Yesterday AUM * (1 + Daily Return) ]
    """
    if yesterday_aum <= 0:
        return 0.0
    natural_growth = yesterday_aum * (1 + (daily_return_pct / 100.0))
    return today_aum - natural_growth

def resolve_aum_value(api: dict, existing: dict) -> str:
    """Use a positive current net-asset value, otherwise retain the last verified value."""
    for candidate in (api.get("nPptTotAmt"), existing.get("aum")):
        text = compact_number(candidate)
        try:
            if text and float(text) > 0:
                return text
        except ValueError:
            continue
    return "0"


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
    service_key = (os.environ.get("DATA_GO_KR_SERVICE_KEY") or "").strip()
    krx_auth_key = (os.environ.get("KRX_OPEN_API_KEY") or "").strip()
    if not service_key and not krx_auth_key:
        raise SystemExit("DATA_GO_KR_SERVICE_KEY 또는 KRX_OPEN_API_KEY 환경변수가 필요합니다.")

    data_dir = Path(args.data_dir)
    old_master, master_fields = read_csv(data_dir / FILES[0])
    old_returns, return_fields = read_csv(data_dir / FILES[1])
    old_pension, pension_fields = read_csv(data_dir / FILES[2])
    master_by_ticker = {row["ticker"]: row for row in old_master}
    returns_by_ticker = {row["ticker"]: row for row in old_returns}
    pension_by_ticker = {row["ticker"]: row for row in old_pension}

    target = (
        datetime.strptime(args.target, "%Y%m%d").date()
        if args.target
        else default_target_date()
    )
    public_cache: dict[str, dict[str, dict]] = {}
    krx_cache: dict[str, dict[str, dict]] = {}
    resolved: tuple[str, dict[str, dict]] | None = None
    source = ""
    
    if service_key:
        try:
            fsc_resolved = resolve_snapshot(service_key, target, public_cache, args.require_exact_date)
            if fsc_resolved and snapshot_is_complete(fsc_resolved[1], len(old_master)):
                resolved = fsc_resolved
                source = "Financial Services Commission public API"
            elif fsc_resolved:
                print(
                    f"FSC snapshot incomplete: {len(fsc_resolved[1])}/{len(old_master)}; "
                    "trying the KRX fallback."
                )
        except Exception as error:
            print(f"FSC API lookup unavailable: {error}; trying the KRX fallback.")
            
    if resolved is None and krx_auth_key:
        try:
            print("[WARNING] Falling back to KRX Open API...")
            krx_resolved = resolve_krx_snapshot(
                krx_auth_key,
                target,
                krx_cache,
                args.require_exact_date,
            )
            if krx_resolved:
                resolved = krx_resolved
                source = "KRX Open API"
        except Exception as error:
            print(f"KRX fallback unavailable: {error}")
    if resolved is None:
        message = f"No official ETF data for requested date {target:%Y%m%d}."
        if args.require_exact_date:
            raise RuntimeError(message)
        print(f"{message} Exiting without changes.")
        return
    as_of_text, current = resolved
    as_of = datetime.strptime(as_of_text, "%Y%m%d").date()
    print(f"Official source: {source} / {as_of_text} / {len(current)} ETFs")

    listing_metadata = current if source == "Financial Services Commission public API" else {}
    if service_key and source == "KRX Open API":
        try:
            listing_metadata_text, listing_metadata = on_or_before(
                service_key,
                as_of,
                public_cache,
            )
            print(
                f"Listing metadata: {listing_metadata_text} / "
                f"{len(listing_metadata)} ETFs"
            )
        except Exception as error:
            print(f"Listing metadata unavailable: {error}")
    print(f"공식 API 기준일 {as_of_text} · {len(current)}종목")

    anchors: dict[str, dict[str, dict]] = {}
    anchor_dates: dict[str, date] = {}
    for field, (unit, amount) in PERIODS.items():
        if unit == "days":
            target_day = as_of - timedelta(days=amount)
        elif unit == "months":
            target_day = subtract_months(as_of, amount)
        elif unit == "ytd":
            target_day = date(as_of.year - 1, 12, 31)
        else:
            raise ValueError(f"Unknown unit: {unit}")
        
        anchor_dates[field] = target_day
        if source == "KRX Open API" and krx_auth_key:
            anchor_text, anchor = krx_on_or_before(
                krx_auth_key,
                target_day,
                krx_cache,
                expected_count=len(old_master),
            )
        elif service_key:
            anchor_text, anchor = on_or_before(service_key, target_day, public_cache)
        else:
            raise RuntimeError(f"No historical source available for {field}.")
        anchors[field] = anchor
        print(f"{field}: {anchor_text}")

    period_listing_dates: dict[str, date] = {}
    oldest_anchor_date = min(anchor_dates.values())
    for ticker, api in current.items():
        existing = master_by_ticker.get(ticker, {})
        metadata = listing_metadata.get(ticker) or {}
        listing_text = str(
            existing.get("listing_date")
            or api.get("lstgDt")
            or metadata.get("lstgDt")
            or ""
        )
        if len(listing_text) != 8 or not listing_text.isdigit():
            continue
        listing_day = datetime.strptime(listing_text, "%Y%m%d").date()
        missing_period_anchor = any(
            as_float((snapshot.get(ticker) or {}).get("clpr")) is None
            for snapshot in anchors.values()
        )
        if oldest_anchor_date < listing_day <= as_of and missing_period_anchor:
            period_listing_dates[ticker] = listing_day
    listing_closes = resolve_listing_closes(
        period_listing_dates,
        source,
        krx_auth_key,
        service_key,
        krx_cache,
        public_cache,
    )
    print(
        f"Listing closes: {len(listing_closes)}/{len(period_listing_dates)} ETFs "
        f"across {len(set(period_listing_dates.values()))} listing dates"
    )

    new_master: list[dict[str, object]] = []
    new_returns: list[dict[str, object]] = []
    new_pension: list[dict[str, object]] = []
    close_field = f"close_{as_of_text}"
    return_fields = [field for field in return_fields if not field.startswith("close_")]
    return_fields = ["ticker", "name", close_field] + [field for field in return_fields if field not in ("ticker", "name")]
    for addition in list(PERIODS) + ["r_itd", "itd_anchor_close", "new_90d", "new_3m"]:
        if addition not in return_fields:
            return_fields.append(addition)
    for addition in ("listing_date", "listing_date_source", "nav", "disparity", "tracking_error"):
        if addition not in master_fields:
            master_fields.append(addition)

    for ticker in sorted(current):
        api = current[ticker]
        existing = dict(master_by_ticker.get(ticker, {}))
        name = str(snapshot_value(api, "itmsNm"))
        base_index = str(snapshot_value(api, "bssIdxIdxNm"))
        aum_value = resolve_aum_value(api, existing)
        risk, asset = classify(name, base_index)
        if asset == "기타":
            asset = "주식-국내"
            
        current_close = as_float(api.get("clpr"))
        api_nav = as_float(snapshot_value(api, "nav"))
        api_disparity = as_float(snapshot_value(api, "disparity"))
        api_tracking_error = as_float(snapshot_value(api, "tracking_error"))
        
        # Calculate disparity if API doesn't provide it but provides NAV
        if api_disparity is None and current_close is not None and api_nav:
            api_disparity = round(((current_close - api_nav) / api_nav) * 100, 2)
            
        existing.update({
            "isin_cd": snapshot_value(api, "isinCd", existing.get("isin_cd", "")), "ticker": ticker, "name": name,
            "base_index": base_index, "close": snapshot_value(api, "clpr", 0),
            "change_pct": snapshot_value(api, "fltRt", 0), "trade_value": snapshot_value(api, "trPrc", 0),
            "aum": aum_value, "risk_type": existing.get("risk_type") or risk,
            "asset_class": existing.get("asset_class") or asset,
            "pension_eligible": existing.get("pension_eligible") or pension_rule(risk, name, base_index),
            "liquidity": "pass" if (as_float(aum_value) or 0) >= 10_000_000_000 else "fail",
            "bas_dt": as_of_text,
            "nav": api_nav if api_nav is not None else existing.get("nav", ""),
            "disparity": api_disparity if api_disparity is not None else existing.get("disparity", ""),
            "tracking_error": api_tracking_error if api_tracking_error is not None else existing.get("tracking_error", ""),
        })
        if not str(existing.get("isin_cd") or "").strip():
            print(
                f"Skipping {ticker} ({name}): isin_cd missing from both today's API "
                "response and prior data (likely a very recent listing). Will retry "
                "on the next run once the source publishes it."
            )
            continue
        current_close = as_float(api.get("clpr"))
        old_return = dict(returns_by_ticker.get(ticker, {}))
        old_return.update({"ticker": ticker, "name": name, close_field: snapshot_value(api, "clpr", "")})
        metadata = listing_metadata.get(ticker) or {}
        api_listing = api_listing_date(api.get("lstgDt") or metadata.get("lstgDt"))
        if not existing.get("listing_date"):
            if api_listing:
                existing["listing_date"] = api_listing
                existing["listing_date_source"] = "price_api_listing_date"
        new_master.append(existing)
        listing_text = str(existing.get("listing_date") or "")
        listing_day = (
            datetime.strptime(listing_text, "%Y%m%d").date()
            if len(listing_text) == 8 and listing_text.isdigit()
            else None
        )
        listing_close = listing_closes.get(ticker)
        for field, snapshot in anchors.items():
            anchor_close = as_float((snapshot.get(ticker) or {}).get("clpr"))
            if (
                anchor_close is None
                and listing_close is not None
                and listing_day is not None
                and anchor_dates[field] < listing_day
            ):
                anchor_close = listing_close
            old_return[field] = pct(current_close, anchor_close)
        is_new = bool(listing_day and 0 <= (as_of - listing_day).days <= 90)
        old_return["new_90d"] = "Y" if is_new else "N"
        old_return["new_3m"] = "Y" if is_new else "N"
        # Preserve an existing verified ITD anchor. 
        # KRX KIND 기준가격 공시가 없는 경우 첫 종가로 임의 대체하지 않고 미제공 상태를 유지합니다.
        itd_anchor = as_float(old_return.get("itd_anchor_close"))
        old_return["r_itd"] = pct(current_close, itd_anchor)
        old_return["itd_latest_date"] = as_of.isoformat()
        old_return["itd_latest_close"] = current_close if current_close is not None else ""
        old_return["itd_return_type"] = "price_return"
        new_returns.append(old_return)

        pension = dict(pension_by_ticker.get(ticker, {}))
        if not pension:
            pension = {"official_src": "", "issuer_official": "", "verify_status": "신규 확인 필요", "final_pension": "확인중", "final_src": "pending"}
        structural_pension = pension_rule(risk, name, base_index)
        if (
            str(pension.get("final_pension") or "") == "확인중"
            and str(structural_pension).startswith("불가")
        ):
            pension.update({
                "verify_status": "구조 규칙 자동 판정",
                "final_pension": "불가",
                "final_src": "구조규칙",
            })
        pension.update({key: existing.get(key, "") for key in master_fields if key in pension_fields})
        new_pension.append(pension)

    for field in PERIODS:
        populated = sum(str(row.get(field) or "").strip() != "" for row in new_returns)
        coverage = populated / len(new_returns) if new_returns else 0
        print(f"Return coverage {field}: {populated}/{len(new_returns)} ({coverage:.1%})")
        if field in {"r_2w", "r_2m", "r_6m"} and coverage < 0.6:
            raise RuntimeError(
                f"Data quality check failed: {field} return coverage is only {coverage:.1%}."
            )

    default_count = sum((as_float(row.get("aum")) or 0) >= 100_000_000_000 for row in new_master)
    if default_count == 0:
        raise RuntimeError("Data quality check failed: no ETFs have at least KRW 100bn in net assets.")
    print(f"AUM quality check: {default_count} ETFs at or above KRW 100bn")

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
