-- Cloudflare D1 schema for ETF daily prices
-- Apply with: wrangler d1 execute etf-prices --file=scripts/d1_schema.sql

CREATE TABLE IF NOT EXISTS etf_prices (
  ticker TEXT    NOT NULL,   -- 종목코드 (6자리, 예: 069500)
  date   TEXT    NOT NULL,   -- YYYY-MM-DD
  close  REAL    NOT NULL,   -- 종가 (원)
  PRIMARY KEY (ticker, date)
);

-- Fast range queries per ticker
CREATE INDEX IF NOT EXISTS idx_ticker_date ON etf_prices (ticker, date);

-- Fast date-only queries (for bulk daily inserts)
CREATE INDEX IF NOT EXISTS idx_date ON etf_prices (date);
