-- 0024_single_version_market_source_index_daily.sql
-- 1. Create audit table to record historical versions
CREATE TABLE IF NOT EXISTS market_source_index_daily_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  as_of_date TEXT NOT NULL,
  source_version TEXT NOT NULL,
  index_code TEXT NOT NULL,
  index_name TEXT NOT NULL,
  close_value REAL NOT NULL,
  change_points REAL,
  change_pct REAL NOT NULL,
  volume_value REAL,
  source_hash TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);

-- Archive all historical rows into audit table
INSERT INTO market_source_index_daily_audit (
  as_of_date, source_version, index_code, index_name,
  close_value, change_points, change_pct, volume_value,
  source_hash, ingested_at
)
SELECT as_of_date, source_version, index_code, index_name,
       close_value, change_points, change_pct, volume_value,
       source_hash, ingested_at
FROM market_source_index_daily;

-- 2. Recreate market_source_index_daily with PRIMARY KEY (as_of_date, index_code)
-- so re-publishing / re-issuing on the same date upserts cleanly and preserves strictly 12 rows
CREATE TABLE market_source_index_daily_single_version (
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
  PRIMARY KEY (as_of_date, index_code)
);

-- Copy the latest ingested row for each (as_of_date, index_code)
INSERT INTO market_source_index_daily_single_version (
  as_of_date, source_version, index_code, index_name,
  close_value, change_points, change_pct, volume_value,
  source_hash, ingested_at
)
SELECT m.as_of_date, m.source_version, m.index_code, m.index_name,
       m.close_value, m.change_points, m.change_pct, m.volume_value,
       m.source_hash, m.ingested_at
FROM market_source_index_daily m
INNER JOIN (
  SELECT as_of_date, index_code, MAX(ingested_at) AS max_ingested_at
  FROM market_source_index_daily
  GROUP BY as_of_date, index_code
) latest ON m.as_of_date = latest.as_of_date
        AND m.index_code = latest.index_code
        AND m.ingested_at = latest.max_ingested_at;

DROP TABLE market_source_index_daily;
ALTER TABLE market_source_index_daily_single_version RENAME TO market_source_index_daily;
