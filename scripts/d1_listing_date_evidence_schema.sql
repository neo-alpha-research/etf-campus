-- ETF Campus: auditable evidence rows for listing-date verification.
-- Apply after scripts/d1_listing_dates_schema.sql.

CREATE TABLE IF NOT EXISTS etf_listing_date_evidence (
  evidence_id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticker TEXT NOT NULL,
  isin TEXT NOT NULL,
  candidate_listing_date TEXT,
  candidate_first_traded_date TEXT,
  source_rank INTEGER NOT NULL CHECK (source_rank BETWEEN 1 AND 4),
  source_type TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_document_id TEXT,
  source_document_title TEXT,
  evidence_quote TEXT,
  match_basis TEXT NOT NULL CHECK (
    match_basis IN ('isin', 'ticker', 'kind_ticker_code', 'normalized_name', 'manual')
  ),
  checked_at TEXT NOT NULL,
  checked_by TEXT NOT NULL,
  review_status TEXT NOT NULL CHECK (
    review_status IN ('pending', 'accepted', 'rejected', 'conflict')
  ),
  UNIQUE(ticker, source_type, source_url)
);

CREATE INDEX IF NOT EXISTS idx_listing_evidence_ticker
  ON etf_listing_date_evidence (ticker, review_status);

CREATE INDEX IF NOT EXISTS idx_listing_evidence_isin
  ON etf_listing_date_evidence (isin);
