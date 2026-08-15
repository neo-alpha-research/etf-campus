SELECT
  COUNT(*) AS listing_date_rows,
  SUM(CASE WHEN listing_date_status = 'verified_official' THEN 1 ELSE 0 END) AS verified_official_rows,
  SUM(CASE WHEN listing_date_status = 'official_notice_pending_isin' THEN 1 ELSE 0 END) AS notice_sourced_rows
FROM etf_listing_dates;

SELECT COUNT(*) AS evidence_rows
FROM etf_listing_date_evidence;
