import json
import csv
import os
import time
import requests
from concurrent.futures import ThreadPoolExecutor

MASTER_CSV_PATH = "data/etf_master_draft.csv"
OUTPUT_DIR = "public/data/holdings"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://stock.naver.com/"
}

def fetch_holdings_for_ticker(ticker: str):
    url = f"https://stock.naver.com/api/domestic/detail/{ticker}/ETFComponent"
    try:
        r = requests.get(url, headers=HEADERS, timeout=8)
        if r.status_code != 200:
            return ticker, None
        
        items = r.json()
        if not items or not isinstance(items, list):
            return ticker, None

        holdings = []
        as_of_date = None

        for item in items:
            name = item.get("componentName")
            if not name:
                continue

            if not as_of_date and item.get("referenceDate"):
                as_of_date = item.get("referenceDate")

            weight_raw = item.get("weight")
            try:
                weight_pct = float(weight_raw) if weight_raw is not None else 0.0
            except (ValueError, TypeError):
                weight_pct = 0.0

            shares_raw = item.get("cuUnitQuantity")
            try:
                shares = int(float(shares_raw)) if shares_raw is not None else None
            except (ValueError, TypeError):
                shares = None

            item_code = item.get("componentItemCode") or item.get("componentReutersCode")

            holdings.append({
                "name": name.strip(),
                "weight_pct": round(weight_pct, 2),
                "shares": shares,
                "item_code": item_code
            })

        # Sort by weight_pct descending
        holdings.sort(key=lambda x: x["weight_pct"], reverse=True)

        if not holdings:
            return ticker, None

        payload = {
            "ticker": ticker,
            "as_of_date": as_of_date or time.strftime("%Y-%m-%d"),
            "holdings": holdings
        }
        return ticker, payload
    except Exception as e:
        return ticker, None

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    tickers = []
    try:
        with open(MASTER_CSV_PATH, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                t = row.get("ticker")
                if t:
                    tickers.append(t.strip())
    except FileNotFoundError:
        print(f"Master CSV not found at {MASTER_CSV_PATH}")
        return

    # Deduplicate while preserving order
    tickers = list(dict.fromkeys(tickers))
    total = len(tickers)
    print(f"Starting holdings collection for {total} ETFs...")

    start_time = time.time()
    success_count = 0
    saved_count = 0

    with ThreadPoolExecutor(max_workers=25) as executor:
        results = executor.map(fetch_holdings_for_ticker, tickers)
        for ticker, data in results:
            if data and data.get("holdings"):
                success_count += 1
                out_path = os.path.join(OUTPUT_DIR, f"{ticker}.json")
                with open(out_path, "w", encoding="utf-8") as out_f:
                    json.dump(data, out_f, ensure_ascii=False, indent=2)
                saved_count += 1

    elapsed = time.time() - start_time
    print(f"Done in {elapsed:.2f}s! Successfully fetched and saved {saved_count}/{total} ETF holdings ({saved_count/total*100:.1f}%).")

if __name__ == "__main__":
    main()
