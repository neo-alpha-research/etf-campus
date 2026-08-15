#!/usr/bin/env python3
"""ETF Price Backfill Tool for D1

This script fetches daily ETF prices from KRX Open API or Public Data API,
stores them as monthly compressed CSV files, and generates batched SQLite UPSERT
statements for Cloudflare D1.

Usage:
  python scripts/backfill_d1_prices.py --start-date 2021-01-01 --end-date 2023-12-31
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import json
import os
import subprocess
import time
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path

# Import existing logic if available
try:
    from update_daily_data import fetch_krx_snapshot, fetch_snapshot
except ImportError:
    import sys
    sys.path.append(str(Path(__file__).parent))
    from update_daily_data import fetch_krx_snapshot, fetch_snapshot

def parse_date(date_str: str) -> date:
    return datetime.strptime(date_str, "%Y-%m-%d").date()

def get_market_holidays(data_dir: Path) -> set[str]:
    path = data_dir / "market_holidays.txt"
    if not path.exists():
        return set()
    holidays = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.split("#")[0].strip()
        if line:
            holidays.add(line)
    return holidays

def is_trading_day(dt: date, holidays: set[str]) -> bool:
    if dt.weekday() >= 5:  # 5=Sat, 6=Sun
        return False
    if dt.strftime("%Y%m%d") in holidays:
        return False
    return True

def save_monthly_raw_data(data_dir: Path, year: int, month: int, data: list[dict]) -> Path:
    """Save raw data to a gzip compressed CSV file grouped by month."""
    out_dir = data_dir / "raw" / "etf_prices" / str(year)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / f"etf_prices_{year:04d}-{month:02d}.csv.gz"
    
    # Sort data by date then ticker
    data.sort(key=lambda x: (x['date'], x['ticker']))
    
    # Check if file exists to read existing data and merge
    existing_data = {}
    if out_file.exists():
        with gzip.open(out_file, 'rt', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                existing_data[(row['date'], row['ticker'])] = row
                
    for row in data:
        existing_data[(row['date'], row['ticker'])] = row
        
    merged_data = [existing_data[k] for k in sorted(existing_data.keys())]
    
    if not merged_data:
        return out_file
        
    with gzip.open(out_file, 'wt', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['date', 'ticker', 'close', 'hash'])
        writer.writeheader()
        writer.writerows(merged_data)
        
    return out_file

def hash_row(ticker: str, dt: str, close: float) -> str:
    content = f"{ticker}|{dt}|{close}"
    return hashlib.sha256(content.encode('utf-8')).hexdigest()[:16]

def generate_sql_chunks(data_dir: Path, all_data: list[dict], chunk_size: int = 500) -> list[Path]:
    out_dir = data_dir / "backups" / "sql_chunks"
    out_dir.mkdir(parents=True, exist_ok=True)
    
    # Clear old chunks
    for p in out_dir.glob("chunk_*.sql"):
        p.unlink()
        
    if not all_data:
        return []
        
    chunk_files = []
    for i in range(0, len(all_data), chunk_size):
        chunk = all_data[i:i+chunk_size]
        chunk_idx = i // chunk_size
        file_path = out_dir / f"chunk_{chunk_idx:04d}.sql"
        
        with file_path.open("w", encoding="utf-8") as f:
            f.write("BEGIN TRANSACTION;\n")
            values = []
            for row in chunk:
                values.append(f"('{row['ticker']}', '{row['date']}', {row['close']})")
                
            sql = f"INSERT INTO etf_prices (ticker, date, close) VALUES {','.join(values)} ON CONFLICT(ticker, date) DO UPDATE SET close=excluded.close;"
            f.write(sql + "\n")
            f.write("COMMIT;\n")
            
        chunk_files.append(file_path)
        
    return chunk_files

def main():
    parser = argparse.ArgumentParser(description="Backfill ETF prices to D1.")
    parser.add_argument("--start-date", type=str, required=True, help="Start date (YYYY-MM-DD)")
    parser.add_argument("--end-date", type=str, required=True, help="End date (YYYY-MM-DD)")
    parser.add_argument("--data-dir", type=str, default="data", help="Data directory")
    args = parser.parse_args()

    auth_key = os.environ.get("KRX_OPEN_API_KEY")
    service_key = os.environ.get("DATA_GO_KR_SERVICE_KEY")
    
    if not auth_key and not service_key:
        print("Error: KRX_OPEN_API_KEY or DATA_GO_KR_SERVICE_KEY environment variable is required.")
        return

    data_dir = Path(args.data_dir)
    holidays = get_market_holidays(data_dir)
    
    start_date = parse_date(args.start_date)
    end_date = parse_date(args.end_date)
    
    current_date = start_date
    trading_days = []
    while current_date <= end_date:
        if is_trading_day(current_date, holidays):
            trading_days.append(current_date)
        current_date += timedelta(days=1)
        
    print(f"Collected {len(trading_days)} trading days from {start_date} to {end_date}.")
    
    all_data = []
    monthly_data = defaultdict(list)
    failed_days = []
    empty_days = []
    
    for dt in trading_days:
        day_text = dt.strftime("%Y%m%d")
        sql_date = dt.strftime("%Y-%m-%d")
        print(f"Fetching {sql_date}...")
        
        try:
            if auth_key:
                snapshot = fetch_krx_snapshot(auth_key, day_text)
            else:
                snapshot = fetch_snapshot(service_key, day_text)
                
            count = 0
            for ticker, data in snapshot.items():
                close_price = data.get("TDD_CLSPRC") or data.get("clpr") or data.get("close")
                if close_price is not None:
                    if isinstance(close_price, str):
                        close_price = float(close_price.replace(",", ""))
                    else:
                        close_price = float(close_price)
                        
                    row = {
                        'date': sql_date,
                        'ticker': ticker,
                        'close': close_price,
                        'hash': hash_row(ticker, sql_date, close_price)
                    }
                    monthly_data[(dt.year, dt.month)].append(row)
                    all_data.append(row)
                    count += 1
            print(f" -> {count} ETFs fetched.")
            if count == 0:
                empty_days.append(sql_date)
            time.sleep(0.5)  # Rate limiting
        except Exception as e:
            print(f" -> Failed to fetch {sql_date}: {e}")
            failed_days.append(sql_date)
            time.sleep(2)
            
    # Save raw data
    for (year, month), data in monthly_data.items():
        out_file = save_monthly_raw_data(data_dir, year, month, data)
        print(f"Saved {len(data)} rows to {out_file}")
        
    # Generate SQL
    chunk_files = generate_sql_chunks(data_dir, all_data)
    print(f"Generated {len(chunk_files)} SQL chunk files in {data_dir}/backups/sql_chunks/")
    
    if failed_days:
        with open(data_dir / "backups" / "failed_backfill_days.txt", "w") as f:
            f.write("\n".join(failed_days))
        print(f"Warning: {len(failed_days)} days failed. See failed_backfill_days.txt")
    if empty_days:
        empty_path = data_dir / "backups" / "empty_backfill_days.txt"
        empty_path.write_text("\n".join(empty_days) + "\n", encoding="utf-8")
        print(f"Warning: {len(empty_days)} days returned no ETFs. See {empty_path}")
        
    print("\nTo apply to D1, run a script that executes these chunks sequentially, for example:")
    print(f"  for f in {data_dir}/backups/sql_chunks/*.sql; do npx wrangler d1 execute etf-prices --remote --file=\"$f\"; done")

if __name__ == "__main__":
    main()
