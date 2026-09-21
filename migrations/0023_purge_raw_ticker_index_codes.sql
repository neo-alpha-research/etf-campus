-- 0023_purge_raw_ticker_index_codes.sql
-- 1. Purge non-canonical raw Yahoo/source tickers (^GSPC, CL=F, KRW=X etc.)
DELETE FROM market_source_index_daily
WHERE index_code NOT IN (
  'KOSPI', 'KOSDAQ', 'VKOSPI', 'SPX', 'NDX', 'VIX',
  'USDKRW', 'KR10Y', 'DGS10', 'CLF', 'GC', 'SI'
);

DELETE FROM market_index_daily
WHERE index_code NOT IN (
  'KOSPI', 'KOSDAQ', 'VKOSPI', 'SPX', 'NDX', 'VIX',
  'USDKRW', 'KR10Y', 'DGS10', 'CLF', 'GC', 'SI'
);

-- 2. Recreate market_source_index_daily with strict 12 canonical codes CHECK constraint
CREATE TABLE market_source_index_daily_canonical (
  as_of_date TEXT NOT NULL CHECK (as_of_date GLOB '????-??-??'),
  source_version TEXT NOT NULL,
  index_code TEXT NOT NULL CHECK (index_code IN ('KOSPI','KOSDAQ','VKOSPI','SPX','NDX','VIX','USDKRW','KR10Y','DGS10','CLF','GC','SI')),
  index_name TEXT NOT NULL,
  close_value REAL NOT NULL,
  change_points REAL,
  change_pct REAL NOT NULL,
  volume_value REAL,
  source_hash TEXT NOT NULL,
  ingested_at TEXT NOT NULL,
  PRIMARY KEY (as_of_date, source_version, index_code)
);

INSERT INTO market_source_index_daily_canonical SELECT * FROM market_source_index_daily;
DROP TABLE market_source_index_daily;
ALTER TABLE market_source_index_daily_canonical RENAME TO market_source_index_daily;
