-- ETF Campus: ETF listing-date evidence ledger
-- Apply after the existing scripts/d1_schema.sql price table schema.

CREATE TABLE IF NOT EXISTS etf_listing_dates (
  ticker TEXT PRIMARY KEY,
  isin TEXT NOT NULL,
  listing_date TEXT,
  first_traded_date TEXT,
  fund_inception_date TEXT,
  listing_date_status TEXT NOT NULL CHECK (
    listing_date_status IN (
      'verified_official',
      'official_notice_pending_isin',
      'provisional_first_trade',
      'conflict',
      'manual_review',
      'unavailable'
    )
  ),
  listing_date_source_type TEXT,
  listing_date_source_url TEXT,
  kind_receipt_no TEXT,
  verified_at TEXT,
  verification_note TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_etf_listing_dates_isin
  ON etf_listing_dates (isin);

CREATE INDEX IF NOT EXISTS idx_etf_listing_dates_status
  ON etf_listing_dates (listing_date_status);

CREATE INDEX IF NOT EXISTS idx_etf_listing_dates_listing_date
  ON etf_listing_dates (listing_date);
