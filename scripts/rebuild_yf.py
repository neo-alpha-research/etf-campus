import csv
import yfinance as yf
from datetime import datetime
import time

MASTER_CSV_PATH = "data/etf_master_draft.csv"
OUTPUT_SQL_PATH = "d1_unadjusted_prices.sql"

def main():
    tickers = []
    with open(MASTER_CSV_PATH, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("ticker"):
                tickers.append(row["ticker"].strip())
    
    print(f"Fetching history for {len(tickers)} ETFs via Yahoo Finance...")
    
    # We add .KS to all tickers
    yf_tickers = [t + '.KS' for t in tickers]
    
    # Download all data (takes ~30-60 seconds)
    # auto_adjust=False is crucial to get PURE CLOSE prices
    df = yf.download(yf_tickers, start='2014-01-01', end='2026-08-20', auto_adjust=False, threads=True)
    
    closes = df['Close']
    
    with open(OUTPUT_SQL_PATH, "w", encoding="utf-8") as sql_file:
        values_buffer = []
        def flush_buffer():
            if not values_buffer: return
            sql = "INSERT INTO etf_prices (ticker, date, close) VALUES\n"
            sql += ",\n".join(values_buffer)
            sql += "\nON CONFLICT(ticker, date) DO UPDATE SET close = excluded.close;\n"
            sql_file.write(sql)
            values_buffer.clear()
            
        for ticker in tickers:
            yf_ticker = ticker + '.KS'
            if yf_ticker not in closes.columns:
                continue
                
            ticker_data = closes[yf_ticker].dropna()
            for date, close_val in ticker_data.items():
                if close_val <= 0: continue
                date_str = date.strftime("%Y-%m-%d")
                values_buffer.append(f"('{ticker}', '{date_str}', {int(close_val)})")
                
                if len(values_buffer) >= 500:
                    flush_buffer()
                    
        flush_buffer()
        
    print(f"Finished writing {OUTPUT_SQL_PATH}")

if __name__ == "__main__":
    main()
