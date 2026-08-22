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

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import csv

def get_target_date() -> str:
    try:
        with open("data/etf_master_draft.csv", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            return next(reader)["bas_dt"]
    except Exception as e:
        logging.warning(f"Could not read bas_dt, defaulting to today: {e}")
        return datetime.now(ZoneInfo("Asia/Seoul")).strftime("%Y%m%d")

def fetch_index_data(ticker_symbol: str, target_date_str: str) -> dict | None:
    # Parse target date
    target_date = datetime.strptime(target_date_str, "%Y%m%d")
    
    # We fetch a 10-day range ending slightly after the target date to ensure we have the target day and the previous day
    end_date = target_date + timedelta(days=2)
    start_date = target_date - timedelta(days=10)
    
    period1 = int(start_date.timestamp())
    period2 = int(end_date.timestamp())
    
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker_symbol}?period1={period1}&period2={period2}&interval=1d"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        result = data.get("chart", {}).get("result")
        if not result:
            logging.error(f"No result found for {ticker_symbol}")
            return None
            
        timestamps = result[0].get("timestamp", [])
        indicators = result[0].get("indicators", {}).get("quote", [{}])[0]
        closes = indicators.get("close", [])
        
        if not timestamps or not closes:
            logging.error(f"Missing chart data for {ticker_symbol}")
            return None
            
        # Find the index of the target date or the closest available trading day BEFORE or ON the target date
        target_timestamp = int(target_date.replace(tzinfo=ZoneInfo("UTC")).timestamp())
        
        # Match closest date
        target_idx = -1
        for i, ts in enumerate(timestamps):
            # Convert timestamp to YYYYMMDD in the local exchange timezone (simplified to UTC/KST offset logic)
            # Actually, Yahoo timestamps for 1d interval usually represent the start of the trading day in UTC
            ts_date = datetime.fromtimestamp(ts, tz=ZoneInfo("UTC")).strftime("%Y%m%d")
            if ts_date <= target_date_str and closes[i] is not None:
                target_idx = i
                
        if target_idx <= 0:
            logging.error(f"Could not find sufficient historical data for {ticker_symbol} around {target_date_str}")
            return None
            
        price = closes[target_idx]
        prev_close = closes[target_idx - 1]
        
        if price is None or prev_close is None:
            logging.error(f"Missing price data in historical array for {ticker_symbol}")
            return None
            
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
    
    target_date_str = get_target_date()
    logging.info(f"Using ETF base date: {target_date_str}")
    
    for label, symbol in TICKERS.items():
        logging.info(f"Fetching data for {label} ({symbol}) on {target_date_str}...")
        data = fetch_index_data(symbol, target_date_str)
        
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
        output_data = {'base_date': target_date_str, 'indices': results}
        json.dump(output_data, f, ensure_ascii=False, indent=2)
        
    logging.info(f"Successfully wrote {len(results)} records to {out_path}")

if __name__ == "__main__":
    main()
