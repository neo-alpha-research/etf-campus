-- ==============================================================================
-- Standard Destructive Migration Template (SSOT)
-- ==============================================================================
-- Any migration performing destructive schema operations (DROP TABLE, ALTER TABLE,
-- or PRIMARY KEY re-definition) MUST strictly follow this 3-step atomic baseline
-- record pattern within the exact same migration file (enforced by FM-011 linter).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Step 1: Record pre-change baseline row count before altering the table
-- ------------------------------------------------------------------------------
INSERT INTO migration_baselines (
  migration_name,
  target_table,
  pre_count,
  post_count,
  details,
  recorded_at
)
SELECT
  '00XX_migration_name_here',
  'target_table_name_here',
  (SELECT COUNT(*) FROM target_table_name_here),
  -1, -- Pending completion
  'Migration started: pre-change row count captured',
  datetime('now')
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='target_table_name_here');

-- ------------------------------------------------------------------------------
-- Step 2: Perform schema migration (DDL / Table Recreation / Data Transformation)
-- ------------------------------------------------------------------------------
-- Example:
-- CREATE TABLE target_table_new (...);
-- INSERT INTO target_table_new SELECT ... FROM target_table_name_here;
-- DROP TABLE target_table_name_here;
-- ALTER TABLE target_table_new RENAME TO target_table_name_here;

-- ------------------------------------------------------------------------------
-- Step 3: Record post-change baseline row count and mark completed
-- ------------------------------------------------------------------------------
UPDATE migration_baselines
SET post_count = (SELECT COUNT(*) FROM target_table_name_here),
    details = 'Migration completed: post-change row count verified',
    recorded_at = datetime('now')
WHERE migration_name = '00XX_migration_name_here';
