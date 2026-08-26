-- Add shares column to ETF daily tables
ALTER TABLE market_source_etf_daily ADD COLUMN shares INTEGER;
ALTER TABLE briefing_etf_daily ADD COLUMN shares INTEGER;
