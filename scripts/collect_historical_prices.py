import urllib.request
import ast
import csv
import logging
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

def fetch_prices(ticker, start_date, end_date):
    url = f"https://api.finance.naver.com/siseJson.naver?symbol={ticker}&requestType=1&startTime={start_date}&endTime={end_date}&timeframe=day"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            text = response.read().decode('utf-8').strip()
            
            if not text:
                return ticker, []
                
            try:
                data = ast.literal_eval(text)
            except Exception as e:
                logging.error(f"Failed to parse {ticker}: {e}")
                return ticker, []
            
            if len(data) <= 1:
                return ticker, []
            
            rows = []
            for row in data[1:]:
                if len(row) >= 5:
                    date_str = str(row[0]) # YYYYMMDD
                    close_price = row[4]
                    
                    if len(date_str) == 8 and date_str.isdigit():
                        formatted_date = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:]}"
                    else:
                        formatted_date = date_str
                        
                    rows.append({"ticker": ticker, "date": formatted_date, "close": close_price})
            return ticker, rows
    except Exception as e:
        logging.error(f"Error fetching {ticker}: {e}")
        return ticker, []

def main():
    master_path = Path("data/etf_master_draft.csv")
    if not master_path.exists():
        logging.error("Master file not found.")
        return
        
    tickers = []
    with open(master_path, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("ticker"):
                tickers.append(row["ticker"])
                
    logging.info(f"Loaded {len(tickers)} tickers.")
    
    start_date = "20230101"
    end_date = "20261231"
    
    all_rows = []
    
    with ThreadPoolExecutor(max_workers=20) as executor:
        futures = {executor.submit(fetch_prices, ticker, start_date, end_date): ticker for ticker in tickers}
        for future in as_completed(futures):
            ticker, rows = future.result()
            all_rows.extend(rows)
            
    # Sort by ticker and date
    all_rows.sort(key=lambda x: (x["ticker"], x["date"]))
    
    out_path = Path("data/returns/etf_price_history.csv")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["ticker", "date", "close"])
        writer.writeheader()
        writer.writerows(all_rows)
        
    logging.info(f"Saved {len(all_rows)} price records to {out_path}.")

if __name__ == "__main__":
    main()
