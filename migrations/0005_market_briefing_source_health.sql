-- Adds durable source health for KV-backed circuit breaking.
-- KV is a short-lived, eventually-consistent cache. D1 remains the source of truth.

CREATE TABLE IF NOT EXISTS briefing_source_health (
  source_key TEXT PRIMARY KEY, -- e.g. etf_price, krx_kospi_index, krx_kosdaq_index
  consecutive_failures INTEGER NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
  circuit_open_until TEXT,
  last_success_at TEXT,
  last_error_code TEXT,
  last_error_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_briefing_source_health_open
  ON briefing_source_health (circuit_open_until);

-- briefing_alert_outbox already exists in 20260818_market_briefing_v0.sql.
-- The deterministic alert_id used by resilience.ts prevents duplicate P1 alerts
-- across retry slots for the same source, error class, and target date.
