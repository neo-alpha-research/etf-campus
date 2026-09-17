-- Migration 0026: Correct migration_baselines pre_count for 0024
-- 0024's pre-change count was not measured at the time of migration execution (baseline mechanism was absent).
-- Rather than using the cumulative audit table count (which is not a point-in-time pre-migration snapshot),
-- we record pre_count = -1 (unmeasured) with full transparency and zero fabrication.

UPDATE migration_baselines
SET pre_count = -1,
    details = 'Pre-count unmeasured (-1): baseline recording mechanism was absent at time of 0024 migration execution. Post-0024 count is 86 canonical single-version rows.'
WHERE migration_name = '0024_single_version_market_source_index_daily';
