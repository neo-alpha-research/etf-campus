import csv
import logging
import argparse
from pathlib import Path
from datetime import datetime

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

def format_date(date_str: str) -> str:
    cleaned = date_str.replace("-", "").strip()
    if len(cleaned) == 8 and cleaned.isdigit():
        return f"{cleaned[:4]}-{cleaned[4:6]}-{cleaned[6:]}"
    return date_str.strip()

def normalize_close(close_str: str) -> str | None:
    if not close_str:
        return None
    try:
        val = float(str(close_str).replace(",", "").strip())
        if val <= 0:
            return None
        # If integer equivalent, format as int string, else keep precision
        if val.is_integer():
            return str(int(val))
        return str(val)
    except (ValueError, TypeError):
        return None

def append_daily_prices(master_path: Path, history_path: Path, target_date: str | None = None) -> int:
    if not master_path.exists():
        logging.error(f"Master file not found: {master_path}")
        return 0

    # 1. Load existing price history into memory
    history = {}
    if history_path.exists():
        with open(history_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                ticker = row.get("ticker", "").strip()
                date_val = row.get("date", "").strip()
                close_val = row.get("close", "").strip()
                if ticker and date_val and close_val:
                    history[(ticker, date_val)] = close_val
        logging.info(f"Loaded {len(history)} existing price history records.")
    else:
        logging.info("No existing price history found. A new one will be created.")

    # 2. Read new daily snapshot
    new_records = 0
    updated_records = 0

    with open(master_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            ticker = row.get("ticker", "").strip()
            bas_dt = row.get("bas_dt", "").strip()
            close_raw = row.get("close", "").strip()

            if not ticker or not bas_dt or not close_raw:
                continue

            formatted_date = format_date(bas_dt)
            if target_date and formatted_date != format_date(target_date):
                continue

            normalized_price = normalize_close(close_raw)
            if not normalized_price:
                continue

            key = (ticker, formatted_date)
            if key not in history:
                new_records += 1
                history[key] = normalized_price
            elif history[key] != normalized_price:
                updated_records += 1
                history[key] = normalized_price

    # 3. Sort records canonically by ticker and date
    sorted_rows = [
        {"ticker": k[0], "date": k[1], "close": v}
        for k, v in sorted(history.items(), key=lambda x: (x[0][0], x[0][1]))
    ]

    # 4. Write back to CSV
    history_path.parent.mkdir(parents=True, exist_ok=True)
    with open(history_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["ticker", "date", "close"])
        writer.writeheader()
        writer.writerows(sorted_rows)

    logging.info(
        f"Incremental price update complete: {new_records} added, {updated_records} updated. "
        f"Total records in {history_path}: {len(sorted_rows)}"
    )
    return new_records + updated_records

def main():
    parser = argparse.ArgumentParser(description="Incrementally append daily ETF closing prices to history.")
    parser.add_argument("--master", default="data/etf_master_draft.csv", help="Path to daily master draft CSV")
    parser.add_argument("--history", default="data/returns/etf_price_history.csv", help="Path to historical price CSV")
    parser.add_argument("--target-date", default=None, help="Optional target date filter (YYYYMMDD or YYYY-MM-DD)")
    args = parser.parse_args()

    append_daily_prices(
        master_path=Path(args.master),
        history_path=Path(args.history),
        target_date=args.target_date
    )

if __name__ == "__main__":
    main()
