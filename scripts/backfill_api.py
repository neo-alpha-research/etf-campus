import argparse
import datetime
import json
import math
import os
import sys
import time
import tomllib
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

# Import existing logic. The fallback preserves direct execution via
# `python scripts/backfill_api.py`, while the package import supports unit tests.
try:
    from scripts.update_daily_data import fetch_krx_snapshot, fetch_snapshot
except ModuleNotFoundError:
    from update_daily_data import fetch_krx_snapshot, fetch_snapshot

D1_API_BASE = "https://api.cloudflare.com/client/v4"
D1_BATCH_SIZE = 500


def get_market_holidays() -> set[str]:
    path = Path("data/market_holidays.txt")
    if not path.exists():
        return set()
    holidays = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.split("#")[0].strip()
        if line:
            holidays.add(line)
    return holidays


def is_trading_day(dt: datetime.date, holidays: set[str]) -> bool:
    if dt.weekday() >= 5:  # 5=Sat, 6=Sun
        return False
    if dt.strftime("%Y%m%d") in holidays:
        return False
    return True


def get_d1_database_id() -> str:
    """Return the configured D1 database ID without using it as a credential."""
    database_id = os.environ.get("CLOUDFLARE_D1_ID") or os.environ.get(
        "CLOUDFLARE_D1_DATABASE_ID"
    )
    if database_id:
        return database_id

    wrangler_path = Path("wrangler.toml")
    try:
        config = tomllib.loads(wrangler_path.read_text(encoding="utf-8"))
        databases = config.get("d1_databases", [])
        for database in databases:
            if database.get("binding") == "ETF_PRICES" and database.get("database_id"):
                return database["database_id"]
    except (OSError, tomllib.TOMLDecodeError) as error:
        raise RuntimeError(f"Could not read D1 configuration from {wrangler_path}: {error}") from error

    raise RuntimeError(
        "D1 database ID is not configured. Set CLOUDFLARE_D1_ID or add ETF_PRICES to wrangler.toml."
    )


def required_environment(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(
            f"{name} is required. Configure it as a GitHub Actions secret; do not store it in source code."
        )
    return value


def d1_query(
    sql: str,
    params: list[str | float] | None,
    *,
    account_id: str,
    database_id: str,
    api_token: str,
) -> list[dict[str, Any]]:
    """Execute one fixed, parameterized D1 query from a trusted CI runner."""
    url = f"{D1_API_BASE}/accounts/{account_id}/d1/database/{database_id}/query"
    payload: dict[str, Any] = {"sql": sql}
    if params:
        payload["params"] = params

    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_token}",
            "User-Agent": "etf-campus-d1-backfill/1.0",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            response_payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        raise RuntimeError(f"Cloudflare D1 query failed with HTTP {error.code}.") from error
    except urllib.error.URLError as error:
        raise RuntimeError("Cloudflare D1 query could not reach the API.") from error
    except json.JSONDecodeError as error:
        raise RuntimeError("Cloudflare D1 query returned an invalid JSON response.") from error

    if not response_payload.get("success"):
        raise RuntimeError("Cloudflare D1 query was rejected.")

    results = response_payload.get("result")
    if not isinstance(results, list) or not results or not results[0].get("success"):
        raise RuntimeError("Cloudflare D1 did not report a successful query result.")
    return results


def get_max_date(
    *, account_id: str, database_id: str, api_token: str
) -> datetime.date | None:
    results = d1_query(
        "SELECT MAX(date) AS max_date FROM etf_prices",
        None,
        account_id=account_id,
        database_id=database_id,
        api_token=api_token,
    )
    rows = results[0].get("results", [])
    max_date_str = rows[0].get("max_date") if rows else None
    if max_date_str:
        return datetime.datetime.strptime(max_date_str, "%Y-%m-%d").date()
    return None


def ensure_price_table(*, account_id: str, database_id: str, api_token: str) -> None:
    d1_query(
        "CREATE TABLE IF NOT EXISTS etf_prices "
        "(ticker TEXT, date TEXT, close REAL, PRIMARY KEY(ticker, date))",
        None,
        account_id=account_id,
        database_id=database_id,
        api_token=api_token,
    )


def generate_upsert_batches(
    snapshot: dict[str, dict[str, Any]], date_str: str
) -> list[tuple[str, list[str | float]]]:
    """Build fixed-shape, parameterized UPSERT batches from an ETF snapshot."""
    records: list[tuple[str, str, float]] = []
    for ticker, data in snapshot.items():
        close_price = data.get("TDD_CLSPRC") or data.get("close") or data.get("clpr")
        if close_price is None:
            continue
        try:
            normalized_price = float(str(close_price).replace(",", ""))
        except (TypeError, ValueError):
            continue
        if not math.isfinite(normalized_price) or normalized_price < 0:
            continue
        records.append((ticker, date_str, normalized_price))

    batches: list[tuple[str, list[str | float]]] = []
    for start in range(0, len(records), D1_BATCH_SIZE):
        chunk = records[start : start + D1_BATCH_SIZE]
        placeholders = ",".join(["(?, ?, ?)"] * len(chunk))
        params: list[str | float] = []
        for ticker, snapshot_date, close_price in chunk:
            params.extend([ticker, snapshot_date, close_price])
        sql = (
            "INSERT INTO etf_prices (ticker, date, close) VALUES "
            f"{placeholders} "
            "ON CONFLICT(ticker, date) DO UPDATE SET close=excluded.close"
        )
        batches.append((sql, params))
    return batches


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill KRX ETF prices to D1 incrementally")
    parser.add_argument(
        "--days", type=int, default=85, help="Number of trading days to backfill if DB is empty."
    )
    args = parser.parse_args()

    krx_key = os.environ.get("KRX_OPEN_API_KEY")
    go_kr_key = os.environ.get("DATA_GO_KR_SERVICE_KEY")
    account_id = required_environment("CLOUDFLARE_ACCOUNT_ID")
    api_token = required_environment("CLOUDFLARE_D1_TOKEN")
    database_id = get_d1_database_id()

    try:
        ensure_price_table(
            account_id=account_id, database_id=database_id, api_token=api_token
        )
        max_date = get_max_date(
            account_id=account_id, database_id=database_id, api_token=api_token
        )
    except Exception as error:
        print(f"Failed to initialize or query D1: {error}")
        sys.exit(1)

    holidays = get_market_holidays()
    print(f"Current max date in D1: {max_date}")

    trading_days = []
    current_date = datetime.date.today()

    if max_date:
        # Incremental mode: find trading days from max_date+1 up to today.
        temp_date = max_date + datetime.timedelta(days=1)
        while temp_date <= current_date:
            if is_trading_day(temp_date, holidays):
                trading_days.append(temp_date)
            temp_date += datetime.timedelta(days=1)
    else:
        # Full backfill mode based on args.days.
        days_collected = 0
        temp_date = current_date
        while days_collected < args.days:
            if is_trading_day(temp_date, holidays):
                trading_days.insert(0, temp_date)  # oldest first
                days_collected += 1
            temp_date -= datetime.timedelta(days=1)

    if not trading_days:
        print("D1 is already up to date. No missing dates to fetch.")
        return

    print(f"Collected {len(trading_days)} missing trading days. Starting direct D1 backfill...")

    for index, trading_date in enumerate(trading_days):
        day_text = trading_date.strftime("%Y%m%d")
        sql_date = trading_date.strftime("%Y-%m-%d")
        print(f"[{index + 1}/{len(trading_days)}] Fetching and saving {sql_date}...")

        snapshot = None
        if krx_key:
            try:
                snapshot = fetch_krx_snapshot(krx_key, day_text)
            except Exception as error:
                print(f"  KRX API failed for {sql_date}: {error}")

        if not snapshot and go_kr_key:
            try:
                print(f"  Attempting fallback to data.go.kr for {sql_date}...")
                snapshot = fetch_snapshot(go_kr_key, day_text)
            except Exception as error:
                print(f"  Fallback data.go.kr API failed for {sql_date}: {error}")

        if not snapshot:
            print(f"  Failed to get data for {sql_date} from any API. Skipping.")
            continue

        batches = generate_upsert_batches(snapshot, sql_date)
        if not batches:
            print(f"  No valid prices found in snapshot for {sql_date}.")
            continue

        try:
            for sql, params in batches:
                d1_query(
                    sql,
                    params,
                    account_id=account_id,
                    database_id=database_id,
                    api_token=api_token,
                )
                time.sleep(0.1)
            print(f"  Saved {sql_date} successfully.")
        except Exception as error:
            print(f"  Failed to save {sql_date} to D1: {error}")

    print("Direct D1 backfill completed.")


if __name__ == "__main__":
    main()
