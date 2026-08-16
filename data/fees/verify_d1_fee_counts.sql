SELECT COUNT(*) AS total_rows,
SUM(CASE WHEN verification_status='verified_official' THEN 1 ELSE 0 END) AS verified_rows,
SUM(CASE WHEN effective_burden_cost_pct IS NOT NULL THEN 1 ELSE 0 END) AS burden_rows
FROM etf_fees;
