-- Add missing columns to market_source_etf_daily
ALTER TABLE market_source_etf_daily ADD COLUMN asset_detail TEXT;
ALTER TABLE market_source_etf_daily ADD COLUMN nav_value REAL;
ALTER TABLE market_source_etf_daily ADD COLUMN disparity_pct REAL;
