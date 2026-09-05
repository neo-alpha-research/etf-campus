-- D1 Database Cleanup: Delete 2026-08-24 ~ 2026-08-28 published briefings
DELETE FROM market_briefing_asset_classes WHERE as_of_date BETWEEN '2026-08-24' AND '2026-08-28';
DELETE FROM market_briefing_focus_etfs WHERE as_of_date BETWEEN '2026-08-24' AND '2026-08-28';
DELETE FROM market_briefings WHERE as_of_date BETWEEN '2026-08-24' AND '2026-08-28';
