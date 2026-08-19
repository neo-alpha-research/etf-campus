-- ETF Campus: canonical market-source snapshots and event-hub outbox
-- Cloudflare D1 applies each migration atomically. Do not add BEGIN/COMMIT.
-- These tables are written only after the existing daily source collection has
-- completed its API reconciliation and quality checks.

CREATE TABLE IF NOT EXISTS market_source_etf_daily (
  as_of_date TEXT NOT NULL CHECK (as_of_date GLOB '????-??-??'),
  source_version TEXT NOT NULL,
  ticker TEXT NOT NULL CHECK (length(ticker) = 6),
  etf_name TEXT NOT NULL,
  close_value REAL NOT NULL CHECK (close_value >= 0),
  change_pct REAL NOT NULL,
  trade_value REAL NOT NULL CHECK (trade_value >= 0),
  aum_value REAL,
  risk_type TEXT NOT NULL CHECK (risk_type IN ('normal', 'leveraged', 'inverse', 'unknown')),
  asset_class TEXT,
  is_general_etf INTEGER NOT NULL CHECK (is_general_etf IN (0, 1)),
  source_hash TEXT NOT NULL,
  ingested_at TEXT NOT NULL,
  PRIMARY KEY (as_of_date, source_version, ticker)
);

CREATE INDEX IF NOT EXISTS idx_market_source_etf_daily_general
  ON market_source_etf_daily (as_of_date, source_version, is_general_etf, aum_value DESC);
CREATE INDEX IF NOT EXISTS idx_market_source_etf_daily_asset
  ON market_source_etf_daily (as_of_date, source_version, asset_class, is_general_etf);

CREATE TABLE IF NOT EXISTS market_source_index_daily (
  as_of_date TEXT NOT NULL CHECK (as_of_date GLOB '????-??-??'),
  source_version TEXT NOT NULL,
  index_code TEXT NOT NULL CHECK (index_code IN ('KOSPI', 'KOSDAQ')),
  index_name TEXT NOT NULL,
  close_value REAL NOT NULL CHECK (close_value > 0),
  change_points REAL,
  change_pct REAL NOT NULL,
  volume_value REAL,
  source_hash TEXT NOT NULL,
  ingested_at TEXT NOT NULL,
  PRIMARY KEY (as_of_date, source_version, index_code)
);

-- One immutable ready contract per source version. Revisions deliberately use a
-- new source_version so downstream consumers can replay an exact snapshot.
CREATE TABLE IF NOT EXISTS market_source_snapshot_manifest (
  as_of_date TEXT NOT NULL CHECK (as_of_date GLOB '????-??-??'),
  source_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('collecting', 'ready', 'suppressed', 'failed')),
  etf_as_of_date TEXT NOT NULL CHECK (etf_as_of_date GLOB '????-??-??'),
  kospi_as_of_date TEXT NOT NULL CHECK (kospi_as_of_date GLOB '????-??-??'),
  kosdaq_as_of_date TEXT NOT NULL CHECK (kosdaq_as_of_date GLOB '????-??-??'),
  etf_row_count INTEGER NOT NULL CHECK (etf_row_count > 0),
  general_etf_count INTEGER NOT NULL CHECK (general_etf_count > 0),
  aum_coverage_pct REAL NOT NULL CHECK (aum_coverage_pct >= 0 AND aum_coverage_pct <= 100),
  etf_source_hash TEXT NOT NULL,
  index_source_hash TEXT NOT NULL,
  validation_json TEXT NOT NULL,
  git_commit_sha TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ready_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (as_of_date, source_version),
  CHECK (
    status != 'ready'
    OR (etf_as_of_date = as_of_date AND kospi_as_of_date = as_of_date AND kosdaq_as_of_date = as_of_date)
  )
);

CREATE INDEX IF NOT EXISTS idx_market_source_manifest_ready
  ON market_source_snapshot_manifest (status, as_of_date DESC, ready_at DESC);

-- Transactional outbox closes the D1-to-Queue delivery gap. The snapshot ingest
-- writes a ready manifest and this outbox row in one D1 batch. A dispatcher can
-- retry queue publication without recollecting market data.
CREATE TABLE IF NOT EXISTS market_source_event_outbox (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type = 'market_snapshot_ready'),
  target_name TEXT NOT NULL CHECK (target_name IN ('market_briefing')),
  as_of_date TEXT NOT NULL CHECK (as_of_date GLOB '????-??-??'),
  source_version TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'failed', 'discarded')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (event_type, target_name, as_of_date, source_version),
  FOREIGN KEY (as_of_date, source_version)
    REFERENCES market_source_snapshot_manifest (as_of_date, source_version)
);

CREATE INDEX IF NOT EXISTS idx_market_source_event_outbox_pending
  ON market_source_event_outbox (delivery_status, next_attempt_at, created_at);

-- Downstream functions write their own status here. A consumer may receive an
-- event more than once; the unique event/consumer key makes all processing
-- idempotent and auditable without coupling consumers to each other.
CREATE TABLE IF NOT EXISTS market_source_consumer_runs (
  consumer_name TEXT NOT NULL,
  event_id TEXT NOT NULL,
  as_of_date TEXT NOT NULL CHECK (as_of_date GLOB '????-??-??'),
  source_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('processing', 'ready', 'failed', 'skipped_duplicate')),
  error_detail TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (consumer_name, event_id),
  FOREIGN KEY (event_id) REFERENCES market_source_event_outbox(event_id)
);

CREATE INDEX IF NOT EXISTS idx_market_source_consumer_runs_status
  ON market_source_consumer_runs (consumer_name, status, updated_at DESC);
