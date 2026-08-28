CREATE TABLE market_index_daily_new (
  as_of_date TEXT NOT NULL CHECK (as_of_date GLOB '????-??-??'),
  index_code TEXT NOT NULL,
  index_name TEXT NOT NULL,
  close_value REAL NOT NULL,
  change_points REAL,
  change_pct REAL NOT NULL,
  volume_value REAL,
  source_org TEXT NOT NULL,
  source_service TEXT NOT NULL,
  source_hash TEXT,
  source_run_id TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  PRIMARY KEY (as_of_date, index_code),
  FOREIGN KEY (source_run_id) REFERENCES briefing_runs(run_id)
);
INSERT INTO market_index_daily_new SELECT * FROM market_index_daily;
DROP TABLE market_index_daily;
ALTER TABLE market_index_daily_new RENAME TO market_index_daily;
