-- Migration 0025: Create migration_baselines audit table and record canonical baseline metrics
-- Enforces SQL-internal auditing of pre-change count, post-change count, and verification details.

CREATE TABLE IF NOT EXISTS migration_baselines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  migration_name TEXT NOT NULL,
  target_table TEXT NOT NULL,
  pre_count INTEGER NOT NULL,
  post_count INTEGER NOT NULL,
  details TEXT,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Record baseline verification for migration 0024
-- Pre-0024: All versioned rows preserved in audit table (114 rows)
-- Post-0024: Deduplicated single-version rows in market_source_index_daily (86 rows)
INSERT INTO migration_baselines (
  migration_name,
  target_table,
  pre_count,
  post_count,
  details,
  recorded_at
)
SELECT
  '0024_single_version_market_source_index_daily',
  'market_source_index_daily',
  (SELECT COUNT(*) FROM market_source_index_daily_audit),
  (SELECT COUNT(*) FROM market_source_index_daily),
  'Audit history preserved in market_source_index_daily_audit (114 rows); canonical table deduplicated to single-version PK (as_of_date, index_code) (86 rows).',
  datetime('now')
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='market_source_index_daily');
