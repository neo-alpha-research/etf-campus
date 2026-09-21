-- 0028_lead_waitlist_hardening.sql
-- 대기자 테이블 스키마 보강: 캠페인 격리, 동의 버전/시각 추적, 멱등 업데이트 지원

-- 0. migration_baselines 감사 테이블 준비 및 Step 1 사전 행수 기록 (FM-011 준수)
CREATE TABLE IF NOT EXISTS migration_baselines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  migration_name TEXT NOT NULL,
  target_table TEXT NOT NULL,
  pre_count INTEGER NOT NULL,
  post_count INTEGER NOT NULL,
  details TEXT,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO migration_baselines (
  migration_name,
  target_table,
  pre_count,
  post_count,
  details,
  recorded_at
)
SELECT
  '0028_lead_waitlist_hardening',
  'lead_waitlist',
  (SELECT COUNT(*) FROM lead_waitlist),
  -1,
  'Migration started: pre-change row count captured',
  datetime('now')
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='lead_waitlist');

-- 1. 신규 컬럼 증분 추가 (기존 테이블 구조 보존)
ALTER TABLE lead_waitlist ADD COLUMN campaign TEXT NOT NULL DEFAULT 'challenge_guide_2026';
ALTER TABLE lead_waitlist ADD COLUMN terms_version TEXT;
ALTER TABLE lead_waitlist ADD COLUMN agreed_at TEXT;
ALTER TABLE lead_waitlist ADD COLUMN updated_at TEXT;

-- 2. 기존 레거시 데이터 무결성 정리
-- 기존 신청자의 갱신일자는 생성일자로 보존하며, 확인되지 않은 동의 버전/시각은 임의 날조하지 않고 NULL 유지
UPDATE lead_waitlist 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- 동일 이메일 및 캠페인 기준 중복 행이 존재할 경우 최신 행(MAX id) 1건만 보존
DELETE FROM lead_waitlist 
WHERE id NOT IN (
  SELECT MAX(id) 
  FROM lead_waitlist 
  GROUP BY email, campaign
);

-- 3. 멱등성 보장을 위한 복합 고유 인덱스 생성
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_waitlist_email_campaign 
ON lead_waitlist(email, campaign);

CREATE INDEX IF NOT EXISTS idx_lead_waitlist_campaign 
ON lead_waitlist(campaign);

-- 4. 무차별 신청 방지를 위한 리드 수집 레이트 리밋 테이블
CREATE TABLE IF NOT EXISTS lead_rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  reset_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lead_rate_limits_reset_at 
ON lead_rate_limits(reset_at);

-- 5. Step 3: 사후 행수 기록 및 완료 마킹 (FM-011 준수)
UPDATE migration_baselines
SET post_count = (SELECT COUNT(*) FROM lead_waitlist),
    details = 'Migration completed: post-change row count verified',
    recorded_at = datetime('now')
WHERE migration_name = '0028_lead_waitlist_hardening';
