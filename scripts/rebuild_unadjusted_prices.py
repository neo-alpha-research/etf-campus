import csv
import time
import datetime
import math
from pykrx import stock

MASTER_CSV_PATH = "data/etf_master_draft.csv"
OUTPUT_SQL_PATH = "d1_unadjusted_prices.sql"
BATCH_SIZE = 500

def main():
    tickers = []
    with open(MASTER_CSV_PATH, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("ticker"):
                tickers.append(row["ticker"].strip())
    
    start_date = "20021014"
    end_date = datetime.datetime.now().strftime("%Y%m%d")
    print(f"Fetching history for {len(tickers)} ETFs...")
    
    with open(OUTPUT_SQL_PATH, "w", encoding="utf-8") as sql_file:
        sql_file.write("BEGIN TRANSACTION;\n")
        values_buffer = []
        
        def flush_buffer():
            if not values_buffer: return
            sql = "INSERT INTO etf_prices (ticker, date, close) VALUES\n"
            sql += ",\n".join(values_buffer)
            sql += "\nON CONFLICT(ticker, date) DO UPDATE SET close = excluded.close;\n"
            sql_file.write(sql)
            values_buffer.clear()
            
        for idx, ticker in enumerate(tickers):
            print(f"[{idx+1}/{len(tickers)}] Fetching {ticker}...")
            try:
                df = stock.get_etf_ohlcv_by_date(start_date, end_date, ticker)
                if df.empty: continue
                for date, row in df.iterrows():
                    close = row["종가"]
                    if math.isnan(close) or close <= 0: continue
                    date_str = date.strftime("%Y-%m-%d")
                    values_buffer.append(f"('{ticker}', '{date_str}', {int(close)})")
                    if len(values_buffer) >= BATCH_SIZE: flush_buffer()
            except Exception as e:
                print(f"Error fetching {ticker}: {e}")
            time.sleep(0.1)
            
        flush_buffer()
        sql_file.write("COMMIT;\n")
    print(f"Finished writing {OUTPUT_SQL_PATH}")

if __name__ == "__main__":
    main()
