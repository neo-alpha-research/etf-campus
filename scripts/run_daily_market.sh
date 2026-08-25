#!/bin/bash
set -e

# 동시 실행 방지 (Lock)
exec 200>".run_daily_market.lock"
if ! flock -n 200; then
    echo "Another instance is already running. Exiting."
    exit 0
fi

export TARGET_BRANCH="${TARGET_BRANCH:-main}"
# Note: 서버 작업 복사본은 main을 기준으로 두는 것을 권장합니다.

run_py() {
    if [ "$DRY_RUN" = "1" ]; then
        echo "[DRY_RUN] python $@"
    else
        python "$@"
    fi
}

run_git() {
    if [ "$DRY_RUN" = "1" ]; then
        echo "[DRY_RUN] git $@"
    else
        git "$@"
    fi
}

# --- Step: Install Python dependencies ---
run_py -m pip install --upgrade pip
run_py -m pip install beautifulsoup4 certifi requests xlrd

# --- Step: Refresh official ETF data ---
if [ -n "$TARGET_DATE" ]; then
  run_py scripts/update_daily_data.py --target "$TARGET_DATE" --require-exact-date
else
  run_py scripts/update_daily_data.py
fi

# --- Step: Detect recent-listing reference-price work ---
if [ "$DRY_RUN" = "1" ]; then
  LISTING_REQUIRED="true"
  echo "[DRY_RUN] Evaluated LISTING_REQUIRED=$LISTING_REQUIRED"
else
  LISTING_OUTPUT=$(
    AS_OF_DATE=$(python -c "from datetime import datetime; from zoneinfo import ZoneInfo; print(datetime.now(ZoneInfo(\"Asia/Seoul\")).date().isoformat())")
    python scripts/detect_listing_reference_work.py "$AS_OF_DATE"
  )
  if echo "$LISTING_OUTPUT" | grep -q "required=true"; then
    LISTING_REQUIRED="true"
  else
    LISTING_REQUIRED="false"
  fi
fi

# --- Step: Refresh recent-listing official reference prices and ITD ---
if [ "$LISTING_REQUIRED" = "true" ]; then
  AS_OF_DATE=$(python -c "from datetime import datetime; from zoneinfo import ZoneInfo; print(datetime.now(ZoneInfo(\"Asia/Seoul\")).date().isoformat())")
  run_py scripts/rebuild_listing_reference_prices.py \
    --data-dir data \
    --recent-listings-only --recent-days 90 --as-of-date "$AS_OF_DATE" \
    --retry-unverified \
    --apply --apply-returns --apply-listing-cache --purge-nonrecent \
    --throttle-seconds 1.5
fi

# --- Step: Check snapshot freshness ---
if [ "$DRY_RUN" = "1" ]; then
  FRESH="true"
  echo "[DRY_RUN] Evaluated FRESH=$FRESH"
else
  if [ -n "$TARGET_DATE" ]; then
    actual_date=$(python -c "import csv; print(next(csv.DictReader(open('data/etf_master_draft.csv', encoding='utf-8-sig')))['bas_dt'])")
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
    FRESH="false"
    echo "Official ETF close is still unavailable. Exiting with code 2 for retry."
    exit 2
  fi
fi

# --- Step: Refresh classification review draft ---
if [ "$FRESH" = "true" ]; then
  run_py scripts/build_classification_review.py
fi

# --- Step: Detect price snapshot changes ---
if [ "$DRY_RUN" = "1" ]; then
  SNAPSHOT_CHANGED="true"
  echo "[DRY_RUN] Evaluated SNAPSHOT_CHANGED=$SNAPSHOT_CHANGED"
else
  if git diff --quiet -- data/etf_master_draft.csv data/etf_returns_draft.csv data/pension_verify_sheet.csv data/classification; then
    echo "No new price snapshot. Skipping distribution refresh."
    SNAPSHOT_CHANGED="false"
  else
    echo "New price snapshot detected."
    SNAPSHOT_CHANGED="true"
  fi
fi

# --- Step: Fetch global market indices ---
run_py scripts/fetch_market_indices.py

# --- Step: Detect publishable data changes ---
if [ "$DRY_RUN" = "1" ]; then
  PUBLISHABLE_CHANGED="true"
  echo "[DRY_RUN] Evaluated PUBLISHABLE_CHANGED=$PUBLISHABLE_CHANGED"
else
  if git status --porcelain --untracked-files=all -- data/market_indices.json data/etf_master_draft.csv data/etf_returns_draft.csv data/pension_verify_sheet.csv data/classification data/returns | grep -q .; then
    echo "Publishable data changes detected."
    PUBLISHABLE_CHANGED="true"
  else
    echo "No data changes. Skipping validation and commit."
    PUBLISHABLE_CHANGED="false"
  fi
  latest_bas_dt=$(python -c 'import csv; print(next(csv.DictReader(open("data/etf_master_draft.csv", encoding="utf-8-sig")))["bas_dt"])')
  echo "Latest bas_dt: ${latest_bas_dt}"
fi

# --- Step: Backfill ETF prices to D1 ---
if [ "$SNAPSHOT_CHANGED" = "true" ]; then
  if [ "$DRY_RUN" = "1" ]; then
    BAS_DT="20260825"
  else
    BAS_DT=$(python -c "import csv; print(next(csv.DictReader(open('data/etf_master_draft.csv', encoding='utf-8-sig')))['bas_dt'])")
  fi
  run_py scripts/backfill_api.py --start-date "$BAS_DT" --end-date "$BAS_DT"
  run_py scripts/validate_d1_status.py "$BAS_DT"
fi

# --- Step: Publish canonical market-source snapshot and event outbox ---
if [ "$FRESH" = "true" ]; then
  export GITHUB_SHA=$(git rev-parse HEAD)
  run_py scripts/publish_market_source_snapshot.py
fi

# --- Step: Commit refreshed market data ---
if [ "$PUBLISHABLE_CHANGED" = "true" ]; then
  run_git config user.name "etf-campus-data-bot"
  run_git config user.email "etf-campus-data-bot@users.noreply.github.com"
  run_git add data/market_indices.json data/etf_master_draft.csv data/etf_returns_draft.csv data/pension_verify_sheet.csv data/classification data/returns data/listing_prices.json data/listing-ledger/etf_listing_reference_prices.csv data/quality/krx_listing_reference_price_audit.csv data/quality/krx_listing_reference_price_checkpoint.json
  if [ "$DRY_RUN" = "1" ]; then
    echo "[DRY_RUN] git commit -m 'data: refresh ETF snapshot'"
    echo "[DRY_RUN] git pull --rebase --autostash origin $TARGET_BRANCH"
    echo "[DRY_RUN] git push origin HEAD:$TARGET_BRANCH"
  else
    if ! git diff --cached --quiet; then
      git commit -m "data: refresh ETF snapshot"
      for i in 1 2 3 4 5; do
        git pull --rebase --autostash origin "$TARGET_BRANCH" && git push origin "HEAD:$TARGET_BRANCH" && break || sleep 5
      done
    fi
  fi
fi
