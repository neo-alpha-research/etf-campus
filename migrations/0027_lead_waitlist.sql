-- 0027_lead_waitlist.sql
-- ETF 자가 점검 가이드 및 챌린지 출시 알림 대기자(Lead Waitlist) 테이블
CREATE TABLE IF NOT EXISTS lead_waitlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  interest TEXT DEFAULT 'all',
  source TEXT DEFAULT 'compare_bridge',
  campaign TEXT NOT NULL DEFAULT 'challenge_guide_2026',
  terms_version TEXT NOT NULL DEFAULT 'v1.0',
  agreed_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(email, campaign)
);

CREATE INDEX IF NOT EXISTS idx_lead_waitlist_email ON lead_waitlist(email);
CREATE INDEX IF NOT EXISTS idx_lead_waitlist_campaign ON lead_waitlist(campaign);
CREATE INDEX IF NOT EXISTS idx_lead_waitlist_created_at ON lead_waitlist(created_at);
