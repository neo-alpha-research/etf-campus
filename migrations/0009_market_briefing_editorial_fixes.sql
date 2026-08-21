-- 1. admin_user_sessions IP/UA hashing
CREATE TABLE admin_user_sessions_new (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  ip_hash TEXT,
  user_agent_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES admin_users(user_id) ON DELETE CASCADE
);

INSERT INTO admin_user_sessions_new (session_id, user_id, expires_at, ip_hash, user_agent_hash, created_at)
SELECT session_id, user_id, expires_at, NULL, NULL, created_at FROM admin_user_sessions;

DROP TABLE admin_user_sessions;
ALTER TABLE admin_user_sessions_new RENAME TO admin_user_sessions;

-- 2 & 3. market_briefing_editorial_events with FK and index
CREATE TABLE market_briefing_editorial_events_new (
  event_id TEXT PRIMARY KEY,
  briefing_id TEXT NOT NULL,
  revision_no INTEGER,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('system','user')),
  actor_user_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (briefing_id) REFERENCES market_briefing_editorial_documents(briefing_id) ON DELETE CASCADE
);

INSERT INTO market_briefing_editorial_events_new (event_id, briefing_id, revision_no, event_type, from_status, to_status, actor_type, actor_user_id, metadata_json, created_at)
SELECT event_id, briefing_id, revision_no, event_type, from_status, to_status, actor_type, actor_user_id, metadata_json, created_at FROM market_briefing_editorial_events;

DROP TABLE market_briefing_editorial_events;
ALTER TABLE market_briefing_editorial_events_new RENAME TO market_briefing_editorial_events;

CREATE INDEX idx_editorial_events_briefing_id ON market_briefing_editorial_events(briefing_id);

-- [DOCUMENTATION: Outbox 용도 및 상태]
-- 이 테이블은 발행/롤백/회수 이벤트의 트랜잭셔널 아웃박스입니다.
-- 현재 소비자(디스패처·워커)가 없으며, 행이 'pending' 상태로 남는 것이 정상 동작입니다.
-- latest.js 가 D1에서 에디토리얼을 실시간 오버레이하므로 KV 무효화는 불필요합니다.
-- 향후 멀티채널 발행 팬아웃 구현 시 소비자를 붙일 예정입니다.
-- 2 & 3. market_briefing_editorial_cache_outbox with FK and indexes
CREATE TABLE market_briefing_editorial_cache_outbox_new (
  event_id TEXT PRIMARY KEY,
  briefing_id TEXT NOT NULL,
  as_of_date TEXT NOT NULL,
  revision_no INTEGER NOT NULL,
  published_version INTEGER NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('publish','rollback','withdraw')),
  delivery_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN ('pending','processing','sent','failed','discarded')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (briefing_id) REFERENCES market_briefing_editorial_documents(briefing_id) ON DELETE CASCADE
);

INSERT INTO market_briefing_editorial_cache_outbox_new (event_id, briefing_id, as_of_date, revision_no, published_version, action, delivery_status, attempt_count, next_attempt_at, last_error, created_at, sent_at, updated_at)
SELECT event_id, briefing_id, as_of_date, revision_no, published_version, action, delivery_status, attempt_count, next_attempt_at, last_error, created_at, sent_at, updated_at FROM market_briefing_editorial_cache_outbox;

DROP TABLE market_briefing_editorial_cache_outbox;
ALTER TABLE market_briefing_editorial_cache_outbox_new RENAME TO market_briefing_editorial_cache_outbox;

CREATE INDEX idx_editorial_outbox_delivery_next ON market_briefing_editorial_cache_outbox(delivery_status, next_attempt_at);

-- 4. updated_at automatic update trigger
CREATE TRIGGER trg_market_briefing_editorial_documents_updated_at
AFTER UPDATE ON market_briefing_editorial_documents
FOR EACH ROW
WHEN NEW.updated_at <= OLD.updated_at
BEGIN
    UPDATE market_briefing_editorial_documents 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE briefing_id = OLD.briefing_id;
END;
