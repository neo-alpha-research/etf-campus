import json
import logging
from pathlib import Path

import requests

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

# Yahoo Finance mapping
TICKERS = {
    "코스피": "^KS11",
    "코스닥": "^KQ11",
    "S&P 500": "^GSPC",
    "나스닥": "^IXIC",
    "니케이225": "^N225",
    "원/달러": "KRW=X",
}

def fetch_index_data(ticker_symbol: str) -> dict | None:
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker_symbol}?range=1d&interval=1d"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        result = data.get("chart", {}).get("result")
        if not result:
            logging.error(f"No result found for {ticker_symbol}")
            return None
            
        meta = result[0].get("meta", {})
        price = meta.get("regularMarketPrice")
        prev_close = meta.get("chartPreviousClose")
        
        if price is None or prev_close is None:
            logging.error(f"Missing price data for {ticker_symbol}")
            return None
            
        # Calculate percentage change
        change_pct = ((price - prev_close) / prev_close) * 100
        
        return {
            "value": round(price, 2),
            "change": round(change_pct, 2)
        }
        
    except Exception as e:
        logging.error(f"Failed to fetch {ticker_symbol}: {e}")
        return None

def main():
    results = []
    
    for label, symbol in TICKERS.items():
        logging.info(f"Fetching data for {label} ({symbol})...")
        data = fetch_index_data(symbol)
        
        if data:
            results.append({
                "label": label,
                "value": data["value"],
                "change": data["change"]
            })
        else:
            # Fallback structure if fetch fails
            results.append({
                "label": label,
                "value": 0,
                "change": 0
            })
            
    # Write to JSON
    out_path = Path("data/market_indices.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    
    with out_path.open("w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
        
    logging.info(f"Successfully wrote {len(results)} records to {out_path}")

if __name__ == "__main__":
    main()
