-- ETF Campus authentication foundation
-- This migration is designed for Cloudflare D1 (SQLite).

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS auth_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  display_name TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'deleted')),
  session_version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_consents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  consent_type TEXT NOT NULL
    CHECK (consent_type IN ('service_required', 'marketing_optional')),
  policy_version TEXT NOT NULL,
  agreed_at INTEGER NOT NULL,
  withdrawn_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  UNIQUE (user_id, consent_type, policy_version)
);

CREATE INDEX IF NOT EXISTS idx_auth_consents_user_id
  ON auth_consents(user_id);

CREATE TABLE IF NOT EXISTS user_sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_version INTEGER NOT NULL,
  token_hash TEXT NOT NULL,
  previous_token_hash TEXT,
  previous_token_valid_until INTEGER,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  rotated_at INTEGER NOT NULL,
  idle_expires_at INTEGER NOT NULL,
  absolute_expires_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id
  ON user_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_user_sessions_absolute_expiry
  ON user_sessions(absolute_expires_at);

CREATE INDEX IF NOT EXISTS idx_user_sessions_idle_expiry
  ON user_sessions(idle_expires_at);

-- OAuth identities will be introduced with the Google/Kakao social-login migration.
-- CREATE TABLE auth_identities (...);
