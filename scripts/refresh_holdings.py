import json
import csv
import os
import requests
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor

MASTER_CSV_PATH = "data/etf_master_draft.csv"
OUTPUT_DIR = "public/data/holdings"

def get_holdings_from_krx(ticker: str):
    # TODO: Implement KRX/Naver scraping logic here.
    # KRX Information Data System recently blocks anonymous API requests.
    # We will need to integrate a proper session handler or use Naver Finance.
    # Placeholder mock data
    return {
        "ticker": ticker,
        "as_of_date": "2026-08-27",
        "holdings": [
            { "name": "삼성전자", "weight_pct": 20.0, "shares": 1000 },
            { "name": "SK하이닉스", "weight_pct": 10.0, "shares": 500 }
        ]
    }

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    tickers = set()
    try:
        with open(MASTER_CSV_PATH, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get("ticker"):
                    tickers.add(row["ticker"].strip())
    except FileNotFoundError:
        print("Master CSV not found.")
        return

    print(f"Total ETFs to process: {len(tickers)}")
    
    success_count = 0
    
    def process_ticker(ticker):
        data = get_holdings_from_krx(ticker)
        return ticker, data

    with ThreadPoolExecutor(max_workers=10) as executor:
        results = executor.map(process_ticker, tickers)
        for ticker, data in results:
            if data and data.get("holdings"):
                success_count += 1
                out_path = os.path.join(OUTPUT_DIR, f"{ticker}.json")
                with open(out_path, "w", encoding="utf-8") as out_f:
                    json.dump(data, out_f, ensure_ascii=False, indent=2)

    print(f"Successfully generated {success_count} holdings JSON files.")

if __name__ == '__main__':
    main()
