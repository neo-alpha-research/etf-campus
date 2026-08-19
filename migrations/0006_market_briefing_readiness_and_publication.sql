-- ETF Campus: market data readiness and separated publication execution
-- Target: Cloudflare D1 (SQLite)
-- Scope: Adds new tables only. Existing ETF price and market-briefing tables remain unchanged.
-- Apply first to preview D1, verify, then apply to production D1.

-- Durable hand-off from market-data-collector to market-briefing-publisher.
-- One row represents the freshest evaluated source snapshot for one actual market date.
CREATE TABLE IF NOT EXISTS market_data_readiness (
  as_of_date TEXT PRIMARY KEY CHECK (as_of_date GLOB '????-??-??'),
  status TEXT NOT NULL CHECK (status IN ('collecting', 'ready', 'delayed', 'failed', 'suppressed')),
  source_run_id TEXT NOT NULL,
  etf_as_of_date TEXT CHECK (etf_as_of_date IS NULL OR etf_as_of_date GLOB '????-??-??'),
  kospi_as_of_date TEXT CHECK (kospi_as_of_date IS NULL OR kospi_as_of_date GLOB '????-??-??'),
  kosdaq_as_of_date TEXT CHECK (kosdaq_as_of_date IS NULL OR kosdaq_as_of_date GLOB '????-??-??'),
  etf_row_count INTEGER CHECK (etf_row_count IS NULL OR etf_row_count >= 0),
  general_etf_count INTEGER CHECK (general_etf_count IS NULL OR general_etf_count >= 0),
  aum_coverage_pct REAL CHECK (aum_coverage_pct IS NULL OR (aum_coverage_pct >= 0 AND aum_coverage_pct <= 100)),
  etf_source_hash TEXT,
  index_source_hash TEXT,
  validation_json TEXT NOT NULL DEFAULT '{}',
  error_code TEXT,
  error_detail TEXT,
  collected_at TEXT NOT NULL,
  ready_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_run_id) REFERENCES briefing_runs(run_id)
);

CREATE INDEX IF NOT EXISTS idx_market_data_readiness_status_date
  ON market_data_readiness (status, as_of_date DESC);
CREATE INDEX IF NOT EXISTS idx_market_data_readiness_source_run
  ON market_data_readiness (source_run_id);

-- The publisher owns its own immutable execution history. Collection retries remain
-- in briefing_runs, so the two Worker responsibilities can be audited independently.
CREATE TABLE IF NOT EXISTS briefing_publication_runs (
  publication_run_id TEXT PRIMARY KEY,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('scheduled', 'manual', 'replay')),
  schedule_slot TEXT NOT NULL CHECK (schedule_slot IN ('first', 'retry_1', 'retry_2', 'final', 'manual')),
  target_date TEXT NOT NULL CHECK (target_date GLOB '????-??-??'),
  source_as_of_date TEXT CHECK (source_as_of_date IS NULL OR source_as_of_date GLOB '????-??-??'),
  source_run_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued', 'publishing', 'ready', 'failed', 'skipped_locked', 'skipped_no_new_data')),
  error_code TEXT,
  error_detail TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_run_id) REFERENCES briefing_runs(run_id)
);

CREATE INDEX IF NOT EXISTS idx_briefing_publication_runs_status_started
  ON briefing_publication_runs (status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_briefing_publication_runs_source_date
  ON briefing_publication_runs (source_as_of_date DESC, status, started_at DESC);

-- A separate lock prevents duplicate publishing without coupling the publisher to
-- the collector's source API lock.
CREATE TABLE IF NOT EXISTS briefing_publication_locks (
  lock_name TEXT PRIMARY KEY CHECK (lock_name = 'market_briefing_publish'),
  owner_run_id TEXT NOT NULL,
  acquired_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

-- Cloudflare D1 applies each migration atomically; do not add BEGIN/COMMIT here.

-- Separated Worker write order:
-- Collector: briefing_runs -> briefing_run_locks -> source snapshots -> market_data_readiness.
-- Publisher: briefing_publication_runs -> briefing_publication_locks -> validated snapshots
--            -> market_briefings/detail rows -> KV warm-up.
-- The publisher only selects market_data_readiness.status = 'ready' rows that do
-- not already exist in market_briefings, so a market date is automatically published once.
