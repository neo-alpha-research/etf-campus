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
    if dt.weekday() >= 5: # 5=Sat, 6=Sun
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

def main():
    parser = argparse.ArgumentParser(description="Backfill D1 database via HTTP API")
    parser.add_argument("--days", type=int, default=750, help="Number of past days to fetch")
    args = parser.parse_args()

    krx_key = os.environ.get("KRX_OPEN_API_KEY")
    
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
        
    print(f"Collected {len(trading_days)} trading days. Starting backfill file generation...")
    
    out_file = "backfill.sql"
    with open(out_file, "w", encoding="utf-8") as f:
        # Ensure table exists
        f.write("CREATE TABLE IF NOT EXISTS etf_prices (ticker TEXT, date TEXT, close REAL, PRIMARY KEY(ticker, date));\n")
        
        for i, dt in enumerate(trading_days):
            day_text = dt.strftime("%Y%m%d")
            sql_date = dt.strftime("%Y-%m-%d")
            print(f"[{i+1}/{len(trading_days)}] Fetching {sql_date}...")
            
            try:
                snapshot = fetch_krx_snapshot(krx_key, day_text)
                if not snapshot:
                    continue
                    
                sql_statements = generate_sql_statements(snapshot, sql_date)
                for sql in sql_statements:
                    f.write(sql + "\n")
                    
            except Exception as e:
                print(f"Failed on {sql_date}: {e}")
                
    print(f"SQL file generated at {out_file}")

if __name__ == "__main__":
    main()
