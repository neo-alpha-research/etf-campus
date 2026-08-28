-- Scope: Adds index to etf_prices to optimize ticker=ALL queries
CREATE INDEX IF NOT EXISTS idx_etf_prices_ticker_date_desc ON etf_prices (ticker, date DESC, close);
