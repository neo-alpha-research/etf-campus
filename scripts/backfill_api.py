import argparse
import datetime
import json
import os
import sys
import time
import urllib.request
from pathlib import Path

# Import existing logic
from update_daily_data import fetch_krx_snapshot, fetch_snapshot

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
        close_price = data.get("TDD_CLSPRC") or data.get("close") or data.get("clpr")
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

def get_max_date(cf_db_id: str) -> datetime.date | None:
    query = "SELECT MAX(date) as max_date FROM etf_prices"
    try:
        res = execute_via_api(query, cf_db_id)
        max_date_str = res.get("result", [{}])[0].get("results", [{}])[0].get("max_date")
        if max_date_str:
            return datetime.datetime.strptime(max_date_str, "%Y-%m-%d").date()
    except Exception as e:
        print(f"Warning: Could not get max_date from DB: {e}")
    return None

def main():
    parser = argparse.ArgumentParser(description="Backfill KRX ETF prices to D1 incrementally")
    parser.add_argument("--days", type=int, default=85, help="Number of trading days to backfill if DB is empty.")
    args = parser.parse_args()

    krx_key = os.environ.get("KRX_OPEN_API_KEY")
    go_kr_key = os.environ.get("DATA_GO_KR_SERVICE_KEY")
    cf_db_id = "11c4e874-fba2-4e34-91d0-808892284c86"

    # Ensure table exists
    create_sql = "CREATE TABLE IF NOT EXISTS etf_prices (ticker TEXT, date TEXT, close REAL, PRIMARY KEY(ticker, date))"
    try:
        execute_via_api(create_sql, cf_db_id)
    except Exception as e:
        print(f"Failed to create table: {e}")
        sys.exit(1)

    holidays = get_market_holidays()
    
    max_date = get_max_date(cf_db_id)
    print(f"Current max date in DB: {max_date}")

    trading_days = []
    current_date = datetime.date.today()
    
    if max_date:
        # Incremental mode: find trading days from max_date+1 up to today
        temp_date = max_date + datetime.timedelta(days=1)
        while temp_date <= current_date:
            if is_trading_day(temp_date, holidays):
                trading_days.append(temp_date)
            temp_date += datetime.timedelta(days=1)
    else:
        # Full backfill mode based on args.days
        days_collected = 0
        temp_date = current_date
        while days_collected < args.days:
            if is_trading_day(temp_date, holidays):
                trading_days.insert(0, temp_date) # oldest first
                days_collected += 1
            temp_date -= datetime.timedelta(days=1)

    if not trading_days:
        print("Database is already up to date. No missing dates to fetch.")
        return

    print(f"Collected {len(trading_days)} missing trading days to fetch. Starting backfill via internal API...")

    for i, dt in enumerate(trading_days):
        day_text = dt.strftime("%Y%m%d")
        sql_date = dt.strftime("%Y-%m-%d")
        print(f"[{i+1}/{len(trading_days)}] Fetching and saving {sql_date}...")

        snapshot = None
        # Try KRX API first
        if krx_key:
            try:
                snapshot = fetch_krx_snapshot(krx_key, day_text)
            except Exception as e:
                print(f"  KRX API failed for {sql_date}: {e}")

        # Fallback to data.go.kr API
        if not snapshot and go_kr_key:
            try:
                print(f"  Attempting fallback to data.go.kr for {sql_date}...")
                snapshot = fetch_snapshot(go_kr_key, day_text)
            except Exception as e:
                print(f"  Fallback data.go.kr API failed for {sql_date}: {e}")

        if not snapshot:
            print(f"  Failed to get data for {sql_date} from any API. Skipping.")
            continue

        try:
            sql_statements = generate_sql_statements(snapshot, sql_date)
            if not sql_statements:
                print(f"  No valid prices found in snapshot for {sql_date}.")
                continue
            
            for sql in sql_statements:
                execute_via_api(sql, cf_db_id)
                time.sleep(0.5)
            print(f"  Saved {sql_date} successfully.")
        except Exception as e:
            print(f"  Failed to save {sql_date} to DB: {e}")

    print("Backfill execution completed.")

if __name__ == "__main__":
    main()
