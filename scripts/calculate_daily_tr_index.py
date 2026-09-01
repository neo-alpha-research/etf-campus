import csv
import logging
from collections import defaultdict
from pathlib import Path
from datetime import datetime

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

def parse_date(date_str):
    for fmt in ("%Y-%m-%d", "%Y%m%d", "%Y/%m/%d"):
        try:
            return datetime.strptime(date_str, fmt).date()
        except ValueError:
            pass
    return None

def main():
    root_dir = Path(__file__).resolve().parents[1]
    prices_path = root_dir / "data" / "returns" / "etf_price_history.csv"
    dists_path = root_dir / "data" / "distributions" / "etf_distribution_events.csv"
    out_path = root_dir / "data" / "returns" / "etf_daily_tr_index.csv"

    if not prices_path.exists():
        logging.error(f"Price file not found: {prices_path}")
        return

    # 1. Load distributions
    distributions = defaultdict(dict)
    if dists_path.exists():
        with open(dists_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                ticker = row.get("ticker", "").strip()
                ex_date_str = row.get("ex_date", "").strip()
                amt_str = row.get("distribution_per_share_krw", "").strip()
                
                d = parse_date(ex_date_str)
                if ticker and d and amt_str:
                    try:
                        amt = float(amt_str.replace(",", ""))
                        distributions[ticker][d] = amt
                    except ValueError:
                        pass
    
    logging.info(f"Loaded distribution events for {len(distributions)} tickers.")

    # 2. Load prices
    prices = defaultdict(list)
    with open(prices_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            ticker = row.get("ticker", "").strip()
            date_str = row.get("date", "").strip()
            close_str = row.get("close", "").strip()
            
            d = parse_date(date_str)
            if ticker and d and close_str:
                try:
                    close_price = float(close_str)
                    prices[ticker].append((d, close_price))
                except ValueError:
                    pass

    # Sort prices by date
    for ticker in prices:
        prices[ticker].sort(key=lambda x: x[0])

    logging.info(f"Loaded price history for {len(prices)} tickers.")

    # 3. Calculate Daily TR Index
    all_rows = []
    
    for ticker, date_prices in prices.items():
        if not date_prices:
            continue
            
        # Initialize TR Index to the first available price
        prev_close = date_prices[0][1]
        current_tr = prev_close
        
        all_rows.append({
            "ticker": ticker,
            "date": date_prices[0][0].isoformat(),
            "pr_close": prev_close,
            "tr_index": round(current_tr, 2)
        })
        
        for i in range(1, len(date_prices)):
            curr_date, curr_close = date_prices[i]
            
            cash = distributions[ticker].get(curr_date, 0.0)
            
            if prev_close > 0:
                factor = (curr_close + cash) / prev_close
                current_tr *= factor
            
            all_rows.append({
                "ticker": ticker,
                "date": curr_date.isoformat(),
                "pr_close": curr_close,
                "tr_index": round(current_tr, 2)
            })
            
            prev_close = curr_close

    # Sort output by ticker and date
    all_rows.sort(key=lambda x: (x["ticker"], x["date"]))

    # 4. Write to CSV
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["ticker", "date", "pr_close", "tr_index"])
        writer.writeheader()
        writer.writerows(all_rows)

    logging.info(f"Successfully wrote {len(all_rows)} TR index records to {out_path.name}")

if __name__ == "__main__":
    main()
