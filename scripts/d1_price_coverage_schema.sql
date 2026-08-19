-- ETF Campus: ETF price coverage metadata
-- Apply with: wrangler d1 execute etf-prices --file=scripts/d1_price_coverage_schema.sql

CREATE TABLE IF NOT EXISTS etf_price_coverage (
  ticker TEXT PRIMARY KEY,
  first_available_price_date TEXT,
  price_coverage_start TEXT,
  price_coverage_end TEXT,
  price_coverage_status TEXT CHECK (
    price_coverage_status IN (
      'complete',
      'partial',
      'gap_detected',
      'corporate_action_pending',
      'source_conflict'
    )
  ),
  missing_trading_day_count INTEGER DEFAULT 0,
  corporate_action_status TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_etf_price_coverage_status
  ON etf_price_coverage (price_coverage_status);
