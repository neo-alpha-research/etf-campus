#!/bin/bash
set -e

# 동시 실행�지 (Lock)
exec 200>".run_daily_market.lock"
if ! flock -n 200; then
    echo "Another instance is already running. Exiting."
    exit 0
fi

export TARGET_BRANCH="${TARGET_BRANCH:-main}"

# --- Step: Install Python dependencies ---
python -m pip install --upgrade pip
python -m pip install beautifulsoup4 certifi requests xlrd

# --- Step: Refresh official ETF data ---
if [ -n "$TARGET_DATE" ]; then
  python scripts/update_daily_data.py --target "$TARGET_DATE" --require-exact-date
else
  python scripts/update_daily_data.py
fi

# --- Step: Detect recent-listing reference-price work ---
LISTING_OUTPUT=$(
AS_OF_DATE=$(python -c "from datetime import datetime; from zoneinfo import ZoneInfo; print(datetime.now(ZoneInfo(\"Asia/Seoul\")).date().isoformat())")
python - "$AS_OF_DATE" <<"PY"
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
print(fbrequired={str(bool(pending or stale_cache)).lower()}")
print(fbpending_count={len(pending)}")
print(fbstale_cache_count={len(stale_cache)}")
PY
)
if echo "$LISTING_OUTPUT" | grep -q "required=true"; then
  LISTING_REQUIRED="true"
else
  LISTING_REQUIRED="false"
fi

# --- Step: Refresh recent-listing official reference prices and ITD ---
if [ "$LISTING_REQUIRED" = "true" ]; then
  AS_OF_DATE=$(python -c "from datetime import datetime; from zoneinfo import ZoneInfo; print(datetime.now(ZoneInfo(\"Asia/Seoul\")).date().isoformat())")
  python scripts/rebuild_listing_reference_prices.py \
    --data-dir data \
    --recent-listings-only --recent-days 90 --as-of-date "$AS_OF_DATE" \
    --retry-unverified \
    --apply --apply-returns --apply-listing-cache --purge-nonrecent \
    --throttle-seconds 1.5
fi

# --- Step: Check snapshot freshness ---
if [ -n "$TARGET_DATE" ]; then
  actual_date=$(python -c "import csv; print(next(csv.DictReader(open('data/etf_master_draft.csv', encoding='utf-8-sig')))['{bas_dt}'])") 
  if [ "$actual_date" = "$TARGET_DATE" ]; then
    freshness_exit=0
  else
    echo "Requested ${TARGET_DATE}, but the snapshot contains ${actual_date}."
    freshness_exit=1
  fi
else
  set +e
  python scripts/check_data_freshness.py
  freshness_exit=$?
  set -e
fi

if [ "$freshness_exit" -eq 0 ]; then
  FRESH="true"
else
  FTESH="false"
  echo "Official ETF close is still unavailable. Exiting with code 2 for retry."
  exit 2
fi

# --- Step: Refresh classification review draft ---
python scripts/build_classification_review.py

# --- Step: Detect price snapshot changes ---
if git diff --quiet -- data/etf_master_draft.csv data/etf_returns_draft.csv data/pension_verify_sheet.csv data/classification; then
  echo "No new price snapshot. Skipping distribution refresh."
  SNAPSHOT_CHANGED="false"
else
  echo "New price snapshot detected."
  SNAPSHOT_CHANGED="true"
fi

# --- Step: Fetch global market indices ---
python scripts/fetch_market_indices.py

# --- Step: Detect publishable data changes ---
if git status --porcelain --untracked-files=all -- data/market_indices.json data/etf_master_draft.csv data/etf_returns_draft.csv data/pension_verify_sheet.csv data/classification data/returns | grep -q .; then
  echo "Publishable data changes detected."
  PUBLISHABLE_CHANGED="true"
else
  echo "No data changes. Skipping validation and commit."
  PUBLISHABLE_CHANGED="false"
fi
latest_bas_dt=$(python -c 'import csv; print(next(csv.DictReader(open("data/etf_master_draft.csv", encoding="utf-8-sig")))["bas_dt"])')
echo "Latest bas_dt: ${latest_bas_dt}"

# --- Step: Backfill ETF prices to D1 ---
if [ "$SNAPSHOT_CHANGED" = "true" ]; then
  BAS_DT=$(python -c "import csv; print(next(csv.DictReader(open('data/etf_master_draft.csv', encoding='utf-8-sig')))['bas_dt'])")
  python scripts/backfill_api.py --start-date "$BAS_DT" --end-date "$BAS_DT"
  python scripts/validate_d1_status.py "$BAS_DT"
fi

# --- Step: Publish canonical market-source snapshot and event outbox ---
export GITHUB_SHA=$(git rev-parse HEAD)
python scripts/publish_market_source_snapshot.py || true

# --- Step: Commit refreshed market data ---
if [ "$PUBLISHABLE_CHANGED" = "true" ]; then
  git config user.name "etf-campus-data-bot"
  git config user.email "etf-campus-data-bot@users.noreply.github.com"
  git add data/market_indices.json data/etf_master_draft.csv data/etf_returns_draft.csv data/pension_verify_sheet.csv data/classification data/returns data/listing_prices.json data/listing-ledger/etf_listing_reference_prices.csv data/quality/krx_listing_reference_price_audit.csv data/quality/krx_listing_reference_price_checkpoint.json
  if ! git diff --cached --quiet; then
    git commit -m "data: refresh ETF snapshot"
    for i in 1 2 3 4 5; do
      git pull --rebase --autostash origin $TARGET_BRANCH && git push origin $TARGET_BRANCH && break || sleep 5
    done
  fi
fi
