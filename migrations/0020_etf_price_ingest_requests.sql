-- Scope: Creates etf_price_ingest_requests table for signed price ingestion
CREATE TABLE IF NOT EXISTS etf_price_ingest_requests (
  request_id TEXT PRIMARY KEY,
  received_at TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_etf_price_ingest_requests_expires_at ON etf_price_ingest_requests(expires_at);
