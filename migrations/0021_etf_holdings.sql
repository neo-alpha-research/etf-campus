-- Scope: Creates etf_holdings table for storing daily ETF portfolio constituent data
CREATE TABLE IF NOT EXISTS etf_holdings (
  ticker TEXT PRIMARY KEY,
  as_of_date TEXT NOT NULL,
  holdings_json TEXT NOT NULL,
  holding_count INTEGER NOT NULL,
  top1_weight REAL,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_etf_holdings_date ON etf_holdings(as_of_date);
