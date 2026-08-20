-- ETF Campus: market briefing editorial schema
-- Target: Cloudflare D1 (SQLite)

-- 1. Admin Authentication Schema
CREATE TABLE IF NOT EXISTS admin_users (
  user_id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_auth_roles (
  role_id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  permissions_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS admin_user_sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES admin_users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  log_id TEXT PRIMARY KEY,
  action_name TEXT NOT NULL,
  actor_user_id TEXT,
  ip_hash TEXT,
  user_agent_hash TEXT,
  resource_snapshot TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Initial Roles and Permissions
INSERT OR IGNORE INTO admin_auth_roles (role_id, description, permissions_json) VALUES 
  ('platform.owner', 'Full platform access', '["superuser"]'),
  ('editor', 'Briefing editor', '["briefing.draft.read", "briefing.edit", "briefing.publish", "briefing.rollback"]');

-- 2. Market Briefing Editorial Schema
CREATE TABLE IF NOT EXISTS market_briefing_editorial_documents (
  briefing_id TEXT PRIMARY KEY,
  as_of_date TEXT NOT NULL UNIQUE,
  base_source_version TEXT NOT NULL,
  base_metrics_hash TEXT NOT NULL,
  current_revision_no INTEGER NOT NULL DEFAULT 1,
  published_revision_no INTEGER,
  published_version INTEGER NOT NULL DEFAULT 0,
  public_state TEXT NOT NULL DEFAULT 'draft'
    CHECK (public_state IN ('draft','published','withdrawn','needs_rebase')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TEXT
);

CREATE TABLE IF NOT EXISTS market_briefing_editorial_revisions (
  revision_id TEXT PRIMARY KEY,
  briefing_id TEXT NOT NULL,
  revision_no INTEGER NOT NULL,
  workflow_status TEXT NOT NULL
    CHECK (workflow_status IN ('draft','published','superseded','withdrawn')),
  origin TEXT NOT NULL CHECK (origin IN ('system_init','editor','restore')),
  base_metrics_hash TEXT NOT NULL,
  base_metrics_json TEXT NOT NULL,
  title TEXT NOT NULL,
  one_line_text TEXT NOT NULL,
  market_temperature_commentary TEXT NOT NULL,
  summary_markdown TEXT NOT NULL,
  newsletter_cta_title TEXT,
  newsletter_cta_body TEXT,
  newsletter_cta_url TEXT,
  disclosure_text TEXT NOT NULL,
  change_summary TEXT NOT NULL,
  created_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (briefing_id, revision_no),
  FOREIGN KEY (briefing_id) REFERENCES market_briefing_editorial_documents(briefing_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS market_briefing_editorial_events (
  event_id TEXT PRIMARY KEY,
  briefing_id TEXT NOT NULL,
  revision_no INTEGER,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('system','user')),
  actor_user_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS market_briefing_editorial_cache_outbox (
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
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
