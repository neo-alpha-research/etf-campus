import csv
import json
import sys
from datetime import date, timedelta
from pathlib import Path

as_of_date = date.fromisoformat(sys.argv[1])
cutoff = as_of_date - timedelta(days=90)
data_dir = Path("data")
with (data_dir / "etf_master_draft.csv").open(encoding="utf-8-sig", newline="") as handle:
    master_rows = list(csv.DictReader(handle))
listing_dates = {}
for row in master_rows:
    ticker = (row.get("ticker") or "").strip().upper()
    try:
        listing_dates[ticker] = date.fromisoformat((row.get("listing_date") or "").strip())
    except ValueError:
        listing_dates[ticker] = None
checkpoint_path = data_dir / "quality" / "krx_listing_reference_price_checkpoint.json"
checkpoint = json.loads(checkpoint_path.read_text(encoding="utf-8")) if checkpoint_path.exists() else {}
results = checkpoint.get("results", {})
cache_path = data_dir / "listing_prices.json"
cache = json.loads(cache_path.read_text(encoding="utf-8")) if cache_path.exists() else {}
recent_tickers = {ticker for ticker, listing_date in listing_dates.items() if listing_date is not None and listing_date >= cutoff}
pending = [ticker for ticker in recent_tickers if not str((results.get(ticker) or {}).get("status", "")).startswith("official_verified")]
stale_cache = [ticker for ticker in cache if listing_dates.get(ticker) is None or listing_dates.get(ticker) < cutoff]
print(f"required={str(bool(pending or stale_cache)).lower()}")
print(f"pending_count={len(pending)}")
print(f"stale_cache_count={len(stale_cache)}")