import argparse
import datetime
import json
import os
import subprocess
import time
import urllib.request
import urllib.parse
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

def generate_sql_values(snapshot: dict, date_str: str) -> list[str]:
    """date_str is YYYY-MM-DD"""
    values = []
    for ticker, data in snapshot.items():
        close_price = data.get("TDD_CLSPRC") or data.get("close")
        if close_price is not None:
            # Handle string commas if present
            if isinstance(close_price, str):
                close_price = close_price.replace(",", "")
            values.append(f"('{ticker}', '{date_str}', {close_price})")
    return values

def main():
    parser = argparse.ArgumentParser(description="Backfill ETF prices to D1 SQL file")
    parser.add_argument("--days", type=int, default=750, help="Number of past days to fetch (approx 3 years of trading days)")
    parser.add_argument("--out", type=str, default="backfill.sql", help="Output SQL file")
    args = parser.parse_args()

    auth_key = os.environ.get("KRX_OPEN_API_KEY")
    if not auth_key:
        print("Error: KRX_OPEN_API_KEY environment variable is required.")
        return

    holidays = get_market_holidays()
    
    current_date = datetime.date.today()
    trading_days = []
    
    # Collect past trading days
    days_collected = 0
    while days_collected < args.days:
        if is_trading_day(current_date, holidays):
            trading_days.append(current_date)
            days_collected += 1
        current_date -= datetime.timedelta(days=1)
        
    print(f"Collected {len(trading_days)} trading days from {trading_days[-1]} to {trading_days[0]}")
    
    out_path = Path(args.out)
    with out_path.open("w", encoding="utf-8") as f:
        f.write("-- Backfill ETF prices\n")
    
    batch_size = 50 # Number of days per transaction
    total_inserted = 0
    
    for i in range(0, len(trading_days), batch_size):
        batch_days = trading_days[i:i+batch_size]
        print(f"\nProcessing batch {i//batch_size + 1}/{(len(trading_days)+batch_size-1)//batch_size}...")
        
        sql_statements = []
        sql_statements.append("BEGIN TRANSACTION;")
        
        for dt in batch_days:
            day_text = dt.strftime("%Y%m%d")
            sql_date = dt.strftime("%Y-%m-%d")
            print(f"Fetching {sql_date}...")
            
            try:
                snapshot = fetch_krx_snapshot(auth_key, day_text)
                values = generate_sql_values(snapshot, sql_date)
                if values:
                    # SQLite bulk insert with UPSERT
                    chunk_size = 500
                    for j in range(0, len(values), chunk_size):
                        val_chunk = values[j:j+chunk_size]
                        sql = f"INSERT INTO etf_prices (ticker, date, close) VALUES {','.join(val_chunk)} ON CONFLICT(ticker, date) DO UPDATE SET close=excluded.close;"
                        sql_statements.append(sql)
                    total_inserted += len(values)
            except Exception as e:
                print(f"Failed to fetch {sql_date}: {e}")
            
            # Rate limiting delay
            time.sleep(0.5)
            
        sql_statements.append("COMMIT;\n")
        
        with out_path.open("a", encoding="utf-8") as f:
            f.write("\n".join(sql_statements) + "\n")
            
    print(f"\nDone! Generated {out_path} with ~{total_inserted} rows.")
    print("Run the following command to execute it against local D1:")
    print(f"  wrangler d1 execute etf-prices --local --file={args.out}")
    print("Run against remote D1:")
    print(f"  wrangler d1 execute etf-prices --remote --file={args.out}")

if __name__ == "__main__":
    main()
