CREATE TABLE market_source_index_daily_new (
  as_of_date TEXT NOT NULL CHECK (as_of_date GLOB '????-??-??'),
  source_version TEXT NOT NULL,
  index_code TEXT NOT NULL,
  index_name TEXT NOT NULL,
  close_value REAL NOT NULL,
  change_points REAL,
  change_pct REAL NOT NULL,
  volume_value REAL,
  source_hash TEXT NOT NULL,
  ingested_at TEXT NOT NULL,
  PRIMARY KEY (as_of_date, source_version, index_code)
);
INSERT INTO market_source_index_daily_new SELECT * FROM market_source_index_daily;
DROP TABLE market_source_index_daily;
ALTER TABLE market_source_index_daily_new RENAME TO market_source_index_daily;
