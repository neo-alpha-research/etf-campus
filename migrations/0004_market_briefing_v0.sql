-- ETF Campus: Market Briefing V0
-- Target: Cloudflare D1 (SQLite)
-- Scope: Adds market-briefing tables only. It does NOT alter etf_prices.
-- Apply first to preview D1, verify, then apply to production D1.
--
-- Naming convention:
--   * briefing_*: execution, data quality, and public briefing entities
--   * market_index_*: KOSPI/KOSDAQ source snapshots
--   * etf_market_index_*: ETF Campus proprietary general-ETF market index
--
-- Canonical public data rule:
--   Front-end routes must return only rows in market_briefings with status = 'ready'.
--   Failed, delayed, and suppressed work is retained in briefing_runs.

-- One execution record for every scheduled or protected manual collection attempt.
CREATE TABLE IF NOT EXISTS briefing_runs (
  run_id TEXT PRIMARY KEY,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('scheduled', 'manual', 'replay')),
  schedule_slot TEXT NOT NULL CHECK (schedule_slot IN ('first', 'retry_1', 'retry_2', 'final', 'manual')),
  target_date TEXT NOT NULL CHECK (target_date GLOB '????-??-??'),
  status TEXT NOT NULL CHECK (status IN (
    'queued',
    'collecting',
    'validating',
    'ready',
    'delayed',
    'suppressed',
    'failed',
    'skipped_locked',
    'skipped_no_new_data'
  )),
  etf_as_of_date TEXT CHECK (etf_as_of_date IS NULL OR etf_as_of_date GLOB '????-??-??'),
  kospi_as_of_date TEXT CHECK (kospi_as_of_date IS NULL OR kospi_as_of_date GLOB '????-??-??'),
  kosdaq_as_of_date TEXT CHECK (kosdaq_as_of_date IS NULL OR kosdaq_as_of_date GLOB '????-??-??'),
  published_as_of_date TEXT CHECK (published_as_of_date IS NULL OR published_as_of_date GLOB '????-??-??'),
  source_summary_json TEXT NOT NULL DEFAULT '{}',
  validation_json TEXT NOT NULL DEFAULT '{}',
  error_code TEXT,
  error_detail TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_briefing_runs_target_status
  ON briefing_runs (target_date DESC, status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_briefing_runs_status_started
  ON briefing_runs (status, started_at DESC);

-- Distributed lock for the scheduled Worker. A TTL is evaluated by the Worker;
-- D1 does not autonomously delete expired rows.
CREATE TABLE IF NOT EXISTS briefing_run_locks (
  lock_name TEXT PRIMARY KEY,
  owner_run_id TEXT NOT NULL,
  acquired_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  CHECK (lock_name = 'market_briefing_collect')
);

-- Immutable, normalized daily snapshot used to reproduce all V0 ETF calculations.
-- It deliberately snapshots risk_type and asset_class because classifications can change later.
CREATE TABLE IF NOT EXISTS briefing_etf_daily (
  as_of_date TEXT NOT NULL CHECK (as_of_date GLOB '????-??-??'),
  ticker TEXT NOT NULL,
  etf_name TEXT NOT NULL,
  close_value REAL NOT NULL CHECK (close_value >= 0),
  change_pct REAL NOT NULL,
  trade_value REAL NOT NULL CHECK (trade_value >= 0),
  aum_value REAL,
  risk_type TEXT NOT NULL CHECK (risk_type IN ('normal', 'leveraged', 'inverse', 'unknown')),
  asset_class TEXT,
  is_general_etf INTEGER NOT NULL CHECK (is_general_etf IN (0, 1)),
  source_run_id TEXT NOT NULL,
  source_hash TEXT,
  inserted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (as_of_date, ticker),
  FOREIGN KEY (source_run_id) REFERENCES briefing_runs(run_id)
);

CREATE INDEX IF NOT EXISTS idx_briefing_etf_daily_general
  ON briefing_etf_daily (as_of_date, is_general_etf, change_pct);
CREATE INDEX IF NOT EXISTS idx_briefing_etf_daily_general_trade
  ON briefing_etf_daily (as_of_date, is_general_etf, trade_value DESC);
CREATE INDEX IF NOT EXISTS idx_briefing_etf_daily_asset_class
  ON briefing_etf_daily (as_of_date, asset_class, is_general_etf);

-- The official KOSPI/KOSDAQ source snapshot. Only values accepted by validation
-- are later copied into the public market_briefings summary.
CREATE TABLE IF NOT EXISTS market_index_daily (
  as_of_date TEXT NOT NULL CHECK (as_of_date GLOB '????-??-??'),
  index_code TEXT NOT NULL CHECK (index_code IN ('KOSPI', 'KOSDAQ')),
  index_name TEXT NOT NULL,
  close_value REAL NOT NULL CHECK (close_value > 0),
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

CREATE INDEX IF NOT EXISTS idx_market_index_daily_code_date
  ON market_index_daily (index_code, as_of_date DESC);

-- Daily AUM-weighted return scopes are calculated directly from each validated
-- daily ETF snapshot. No individual ETF weight cap is applied.
-- Public, canonical one-row summary per market date.
-- This table is the only source for latest and archive APIs.
CREATE TABLE IF NOT EXISTS market_briefings (
  as_of_date TEXT PRIMARY KEY CHECK (as_of_date GLOB '????-??-??'),
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status = 'ready'),
  calculation_version TEXT NOT NULL,
  publication_version INTEGER NOT NULL DEFAULT 1 CHECK (publication_version >= 1),
  source_run_id TEXT NOT NULL,
  previous_ready_date TEXT CHECK (previous_ready_date IS NULL OR previous_ready_date GLOB '????-??-??'),

  -- Fast archive/list fields. Full UI payload remains in metrics_json.
  kospi_close REAL NOT NULL CHECK (kospi_close > 0),
  kospi_change_pct REAL NOT NULL,
  kosdaq_close REAL NOT NULL CHECK (kosdaq_close > 0),
  kosdaq_change_pct REAL NOT NULL,
  general_aum_weighted_return_pct REAL NOT NULL,
  top50_aum_weighted_return_pct REAL NOT NULL,
  top100_aum_weighted_return_pct REAL NOT NULL,
  top200_aum_weighted_return_pct REAL NOT NULL,
  general_etf_count INTEGER NOT NULL CHECK (general_etf_count > 0),
  up_count INTEGER NOT NULL CHECK (up_count >= 0),
  flat_count INTEGER NOT NULL CHECK (flat_count >= 0),
  down_count INTEGER NOT NULL CHECK (down_count >= 0),
  breadth_ratio_pct REAL NOT NULL CHECK (breadth_ratio_pct >= 0 AND breadth_ratio_pct <= 100),
  market_temperature TEXT NOT NULL CHECK (market_temperature IN (
    '상승 우세', '완만한 상승', '혼조', '완만한 하락', '하락 우세'
  )),
  general_total_aum REAL NOT NULL CHECK (general_total_aum >= 0),
  general_total_trade_value REAL NOT NULL CHECK (general_total_trade_value >= 0),
  top10_trade_share_pct REAL NOT NULL CHECK (top10_trade_share_pct >= 0 AND top10_trade_share_pct <= 100),

  -- Human-readable content generated only from the validated fields above.
  headline_text TEXT,
  headline_generation_status TEXT NOT NULL DEFAULT 'not_requested'
    CHECK (headline_generation_status IN ('not_requested', 'validated', 'suppressed', 'manual')),
  metrics_json TEXT NOT NULL,
  source_dates_json TEXT NOT NULL,
  validation_json TEXT NOT NULL,
  published_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (source_run_id) REFERENCES briefing_runs(run_id)
);

CREATE INDEX IF NOT EXISTS idx_market_briefings_published
  ON market_briefings (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_briefings_temperature
  ON market_briefings (market_temperature, as_of_date DESC);

-- Detailed asset-class aggregates for the table beneath the V0 cards.
CREATE TABLE IF NOT EXISTS market_briefing_asset_classes (
  as_of_date TEXT NOT NULL CHECK (as_of_date GLOB '????-??-??'),
  asset_class TEXT NOT NULL,
  etf_count INTEGER NOT NULL CHECK (etf_count >= 0),
  up_count INTEGER NOT NULL CHECK (up_count >= 0),
  flat_count INTEGER NOT NULL CHECK (flat_count >= 0),
  down_count INTEGER NOT NULL CHECK (down_count >= 0),
  breadth_ratio_pct REAL CHECK (breadth_ratio_pct IS NULL OR (breadth_ratio_pct >= 0 AND breadth_ratio_pct <= 100)),
  aum_weighted_return_pct REAL,
  total_aum REAL NOT NULL CHECK (total_aum >= 0),
  aum_share_pct REAL NOT NULL CHECK (aum_share_pct >= 0 AND aum_share_pct <= 100),
  total_trade_value REAL NOT NULL CHECK (total_trade_value >= 0),
  trade_share_pct REAL NOT NULL CHECK (trade_share_pct >= 0 AND trade_share_pct <= 100),
  PRIMARY KEY (as_of_date, asset_class),
  FOREIGN KEY (as_of_date) REFERENCES market_briefings(as_of_date) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_market_briefing_asset_classes_rank
  ON market_briefing_asset_classes (as_of_date, total_trade_value DESC);

-- Top three general ETFs by validated daily trade value. This preserves what was
-- shown on a historical briefing even if the source data is later corrected.
CREATE TABLE IF NOT EXISTS market_briefing_focus_etfs (
  as_of_date TEXT NOT NULL CHECK (as_of_date GLOB '????-??-??'),
  rank_no INTEGER NOT NULL CHECK (rank_no BETWEEN 1 AND 3),
  ticker TEXT NOT NULL,
  etf_name TEXT NOT NULL,
  asset_class TEXT,
  close_value REAL NOT NULL CHECK (close_value >= 0),
  change_pct REAL NOT NULL,
  trade_value REAL NOT NULL CHECK (trade_value >= 0),
  trade_share_pct REAL NOT NULL CHECK (trade_share_pct >= 0 AND trade_share_pct <= 100),
  selection_rule TEXT NOT NULL DEFAULT 'general_etf_trade_value_desc',
  PRIMARY KEY (as_of_date, rank_no),
  UNIQUE (as_of_date, ticker),
  FOREIGN KEY (as_of_date) REFERENCES market_briefings(as_of_date) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_market_briefing_focus_etfs_ticker
  ON market_briefing_focus_etfs (ticker, as_of_date DESC);

-- Transactional outbox isolates notification delivery from collection/publication.
CREATE TABLE IF NOT EXISTS briefing_alert_outbox (
  alert_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('P1', 'P2', 'P3')),
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'authentication_failed',
    'source_unavailable',
    'schema_changed',
    'date_alignment_delayed',
    'validation_suppressed',
    'consecutive_failed_runs'
  )),
  payload_json TEXT NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN ('pending', 'sent', 'failed', 'discarded')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (run_id) REFERENCES briefing_runs(run_id)
);

CREATE INDEX IF NOT EXISTS idx_briefing_alert_outbox_pending
  ON briefing_alert_outbox (delivery_status, next_attempt_at, created_at);

-- Cloudflare D1 applies each migration atomically; do not add BEGIN/COMMIT here.

-- ────────────────────────────────────────────────────────────────────────────
-- Required Worker write order (one D1 batch / transaction where feasible)
-- ────────────────────────────────────────────────────────────────────────────
-- 1. INSERT briefing_runs(status='collecting')
-- 2. Acquire briefing_run_locks via conditional INSERT/UPDATE in a short transaction.
-- 3. UPSERT briefing_etf_daily and market_index_daily after normalisation.
-- 4. Calculate whole-universe and AUM Top 50/100/200 weighted returns from
--    the validated daily ETF snapshot, without individual constituent caps.
-- 5. INSERT market_briefings, market_briefing_asset_classes, and
--    market_briefing_focus_etfs only after all validation passes.
-- 6. UPDATE briefing_runs(status='ready', published_as_of_date=...).
-- 7. On failure or suppression, UPDATE briefing_runs and INSERT alert outbox item;
--    never insert into market_briefings.

-- ────────────────────────────────────────────────────────────────────────────
-- Public read queries
-- ────────────────────────────────────────────────────────────────────────────
-- Latest ready briefing:
-- SELECT * FROM market_briefings ORDER BY as_of_date DESC LIMIT 1;
--
-- Asset-class table for a briefing:
-- SELECT * FROM market_briefing_asset_classes
-- WHERE as_of_date = ? ORDER BY total_trade_value DESC;
--
-- Focus ETFs for a briefing:
-- SELECT * FROM market_briefing_focus_etfs
-- WHERE as_of_date = ? ORDER BY rank_no ASC;
--
-- Archive cards:
-- SELECT as_of_date, headline_text, kospi_change_pct, kosdaq_change_pct,
--        general_aum_weighted_return_pct, top100_aum_weighted_return_pct,
--        breadth_ratio_pct, market_temperature
-- FROM market_briefings
-- WHERE as_of_date >= ? AND as_of_date < ?
-- ORDER BY as_of_date DESC;
