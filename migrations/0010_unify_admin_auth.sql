-- Unify Admin Auth with Community Supabase Auth

-- Drop old sessions table
DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS password_reset_tokens;

-- Alter auth_users to remove password fields and link to Supabase
-- If SQLite version does not support DROP COLUMN, this might fail, 
-- but D1 runs a modern SQLite version.
ALTER TABLE auth_users DROP COLUMN password_hash;
ALTER TABLE auth_users DROP COLUMN password_salt;

-- (Optional) add supabase_uid column for tighter linkage instead of just email
ALTER TABLE auth_users ADD COLUMN supabase_uid TEXT;
