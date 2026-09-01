-- Migration 0012: Optimize briefing_etf_daily queries for multi-timeframe series and top general ETFs
CREATE INDEX IF NOT EXISTS idx_briefing_date_general ON briefing_etf_daily(as_of_date, is_general_etf, aum_value DESC);
CREATE INDEX IF NOT EXISTS idx_briefing_date_trade ON briefing_etf_daily(as_of_date, trade_value DESC);
