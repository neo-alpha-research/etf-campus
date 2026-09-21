-- 0027_lead_waitlist.sql
-- 얼리버드 패키지 및 30일 챌린지 출시 알림 대기자(Lead Waitlist) 테이블
CREATE TABLE IF NOT EXISTS lead_waitlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  interest TEXT DEFAULT 'all',
  source TEXT DEFAULT 'compare_bridge',
  status TEXT DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_lead_waitlist_email ON lead_waitlist(email);
CREATE INDEX IF NOT EXISTS idx_lead_waitlist_created_at ON lead_waitlist(created_at);
