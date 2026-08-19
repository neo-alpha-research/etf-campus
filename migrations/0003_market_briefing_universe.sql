-- Prerequisite for market-briefing worker
-- Seed this table from ETF Campus's existing etf_master_draft.csv or its master-data source.
-- The Worker snapshots these fields into briefing_etf_daily at each successful collection.

CREATE TABLE IF NOT EXISTS etf_universe_current (
  ticker TEXT PRIMARY KEY,
  etf_name TEXT NOT NULL,
  risk_type TEXT NOT NULL CHECK (risk_type IN ('normal', 'leveraged', 'inverse', 'unknown')),
  asset_class TEXT,
  aum_value REAL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  source_version TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_etf_universe_current_active
  ON etf_universe_current (is_active, risk_type, asset_class);

-- Important:
-- The existing master file uses fields equivalent to ticker, name, aum, risk_type,
-- and asset_class. Convert the classification values to the four worker values
-- above before inserting. Do not infer an ETF's risk_type in the cron Worker.
