import argparse
import datetime
import json
import os
import sys
import time
import urllib.request
from pathlib import Path

# Import existing logic
from update_daily_data import fetch_krx_snapshot

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

def generate_sql_statements(snapshot: dict, date_str: str) -> list[str]:
    values = []
    for ticker, data in snapshot.items():
        close_price = data.get("TDD_CLSPRC") or data.get("close")
        if close_price is not None:
            if isinstance(close_price, str):
                close_price = close_price.replace(",", "")
            values.append(f"('{ticker}', '{date_str}', {close_price})")

    sql_statements = []
    if values:
        chunk_size = 500
        for i in range(0, len(values), chunk_size):
            val_chunk = values[i:i+chunk_size]
            sql = f"INSERT INTO etf_prices (ticker, date, close) VALUES {','.join(val_chunk)} ON CONFLICT(ticker, date) DO UPDATE SET close=excluded.close;"
            sql_statements.append(sql)
    return sql_statements

def execute_via_api(sql: str, db_id: str) -> dict:
    url = "https://etf-campus.pages.dev/api/admin/execute"
    headers = {
        "Content-Type": "application/json",
        "X-Admin-Key": db_id,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    }
    data = json.dumps({"sql": sql}).encode("utf-8")

    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        print(f"API Error ({e.code}): {body}")
        raise

def main():
    parser = argparse.ArgumentParser(description="Backfill KRX ETF prices to D1 via internal API")
    parser.add_argument("--days", type=int, default=85, help="Number of trading days to backfill.")
    args = parser.parse_args()

    krx_key = os.environ.get("KRX_OPEN_API_KEY")
    cf_db_id = "11c4e874-fba2-4e34-91d0-808892284c86"

    if not krx_key:
        print("Error: Missing KRX_OPEN_API_KEY environment variable.")
        sys.exit(1)

    holidays = get_market_holidays()
    current_date = datetime.date.today()
    trading_days = []

    days_collected = 0
    while days_collected < args.days:
        if is_trading_day(current_date, holidays):
            trading_days.append(current_date)
            days_collected += 1
        current_date -= datetime.timedelta(days=1)

    print(f"Collected {len(trading_days)} trading days. Starting backfill via internal API...")

    # Ensure table exists
    create_sql = "CREATE TABLE IF NOT EXISTS etf_prices (ticker TEXT, date TEXT, close REAL, PRIMARY KEY(ticker, date))"
    try:
        execute_via_api(create_sql, cf_db_id)
        print("Ensured etf_prices table exists.")
    except Exception as e:
        print(f"Failed to create table: {e}")
        sys.exit(1)

    for i, dt in enumerate(trading_days):
        day_text = dt.strftime("%Y%m%d")
        sql_date = dt.strftime("%Y-%m-%d")
        print(f"[{i+1}/{len(trading_days)}] Fetching and saving {sql_date}...")

        try:
            snapshot = fetch_krx_snapshot(krx_key, day_text)
            if not snapshot:
                continue

            sql_statements = generate_sql_statements(snapshot, sql_date)
            for sql in sql_statements:
                execute_via_api(sql, cf_db_id)
                time.sleep(0.5)

        except Exception as e:
            print(f"Failed on {sql_date}: {e}")

    print("Backfill completed successfully.")

if __name__ == "__main__":
    main()
