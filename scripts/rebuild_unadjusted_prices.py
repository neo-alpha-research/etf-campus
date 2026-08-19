import csv
import time
import datetime
import urllib.request
import xml.etree.ElementTree as ET

MASTER_CSV_PATH = "data/etf_master_draft.csv"
OUTPUT_SQL_PATH = "d1_unadjusted_prices.sql"
BATCH_SIZE = 500

def get_naver_history(ticker):
    url = f"https://fchart.stock.naver.com/sise.nhn?symbol={ticker}&timeframe=day&count=6000&requestType=0"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    res = urllib.request.urlopen(req, timeout=10).read().decode('euc-kr')
    root = ET.fromstring(res)
    history = []
    for item in root.findall('.//item'):
        data = item.get('data')
        if not data: continue
        parts = data.split('|')
        if len(parts) >= 5:
            date_str = parts[0]
            close = int(parts[4])
            formatted_date = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
            history.append((formatted_date, close))
    return history

def main():
    tickers = []
    with open(MASTER_CSV_PATH, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("ticker"):
                tickers.append(row["ticker"].strip())
    
    print(f"Fetching history for {len(tickers)} ETFs via Naver...")
    
    with open(OUTPUT_SQL_PATH, "w", encoding="utf-8") as sql_file:
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
                hist = get_naver_history(ticker)
                for date_str, close in hist:
                    values_buffer.append(f"('{ticker}', '{date_str}', {close})")
                    if len(values_buffer) >= BATCH_SIZE: flush_buffer()
            except Exception as e:
                print(f"Error fetching {ticker}: {e}")
            time.sleep(0.05)
            
        flush_buffer()
    print(f"Finished writing {OUTPUT_SQL_PATH}")

if __name__ == "__main__":
    main()
