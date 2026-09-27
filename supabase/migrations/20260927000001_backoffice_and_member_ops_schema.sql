-- Migration: 20260927000001_backoffice_and_member_ops_schema.sql
-- Description: Core Backoffice Schemas, Masked Member Views, and Least-Privilege Roles for Appsmith / Operations (Draft Implementation)

BEGIN;

-- 1. Create Dedicated Least-Privilege Roles if they don't already exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'appsmith_ro') THEN
    CREATE ROLE appsmith_ro LOGIN PASSWORD NULL NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT CONNECTION LIMIT 5;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'n8n_runner') THEN
    CREATE ROLE n8n_runner LOGIN PASSWORD NULL NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT CONNECTION LIMIT 5;
  END IF;
END $$;

GRANT CONNECT ON DATABASE postgres TO appsmith_ro, n8n_runner;
GRANT appsmith_ro TO postgres;
GRANT n8n_runner TO postgres;
ALTER ROLE appsmith_ro SET statement_timeout = '5s';
ALTER ROLE appsmith_ro SET default_transaction_read_only = on;
ALTER ROLE n8n_runner SET statement_timeout = '10s';

-- 2. Create Schemas
CREATE SCHEMA IF NOT EXISTS ops_private AUTHORIZATION postgres;
CREATE SCHEMA IF NOT EXISTS backoffice AUTHORIZATION postgres;

REVOKE ALL ON SCHEMA ops_private, backoffice FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA backoffice TO appsmith_ro;

-- Revoke default public execution privileges on newly created functions in these schemas
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA backoffice REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA ops_private REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- 3. Operations Private Tables

-- 3.1 Member Controls (Active / Suspended / Blocked state machine)
CREATE TABLE IF NOT EXISTS ops_private.member_controls (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'blocked')),
  suspended_until timestamptz,
  version integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (status = 'suspended' AND suspended_until IS NOT NULL) OR
    (status <> 'suspended' AND suspended_until IS NULL)
  )
);

-- 3.2 Member Verified Contact Emails (Explicit verification audit ledger)
CREATE TABLE IF NOT EXISTS ops_private.member_contact_emails (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  verified_at timestamptz NOT NULL,
  verification_method text NOT NULL CHECK (verification_method IN ('email_otp', 'native_auth_verified'))
);

-- 3.3 Operator ACL (Separating regular admin from superadmin who can grant/revoke admin roles)
CREATE TABLE IF NOT EXISTS ops_private.operator_acl (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  can_manage_admin boolean NOT NULL DEFAULT false
);

-- 3.4 Member Action Audit Log
CREATE TABLE IF NOT EXISTS ops_private.member_action_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  before_state jsonb NOT NULL,
  after_state jsonb NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3.5 Admin Change Guard (Concurrency singleton lock to prevent race conditions during admin role updates)
CREATE TABLE IF NOT EXISTS ops_private.admin_change_guard (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton)
);

INSERT INTO ops_private.admin_change_guard VALUES (true) ON CONFLICT (singleton) DO NOTHING;

-- 3.6 Operational Configuration (Holds automation_activated_at and operational toggles)
CREATE TABLE IF NOT EXISTS ops_private.operational_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO ops_private.operational_config (key, value, description)
VALUES 
  ('automation_activated_at', 'null'::jsonb, 'Immutable timestamp when signup automation became active'),
  ('dispatch_enabled_ops_notification', 'false'::jsonb, 'Kill switch toggle for ops notification channel'),
  ('dispatch_enabled_welcome_marketing', 'false'::jsonb, 'Kill switch toggle for welcome marketing email channel')
ON CONFLICT (key) DO NOTHING;

-- 3.7 Channel Dispatch Kill Switch Predicate
CREATE OR REPLACE FUNCTION ops_private.is_dispatch_enabled(p_channel text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_key text;
  v_enabled boolean;
BEGIN
  IF p_channel IS NULL THEN
    RETURN false;
  END IF;
  v_key := 'dispatch_enabled_' || p_channel;
  SELECT COALESCE((value #>> '{}')::boolean, false) INTO v_enabled
  FROM ops_private.operational_config
  WHERE key = v_key;
  RETURN COALESCE(v_enabled, false);
END;
$$;

REVOKE ALL ON FUNCTION ops_private.is_dispatch_enabled(text) FROM PUBLIC, anon, authenticated, appsmith_ro;
GRANT EXECUTE ON FUNCTION ops_private.is_dispatch_enabled(text) TO n8n_runner, service_role, postgres;

-- 3.8 Enforcement Helper Function for Existing and Future Service APIs/RPCs
CREATE OR REPLACE FUNCTION ops_private.assert_member_active(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_control ops_private.member_controls%ROWTYPE;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_control
  FROM ops_private.member_controls
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN true; -- Default active
  END IF;

  IF v_control.status = 'blocked' THEN
    RAISE EXCEPTION 'member account is permanently blocked';
  END IF;

  IF v_control.status = 'suspended' THEN
    IF v_control.suspended_until > now() THEN
      RAISE EXCEPTION 'member account is temporarily suspended until %', v_control.suspended_until;
    ELSE
      -- Expired suspension treated as active
      RETURN true;
    END IF;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON ALL TABLES IN SCHEMA ops_private FROM PUBLIC, anon, authenticated, appsmith_ro, n8n_runner;
REVOKE ALL ON FUNCTION ops_private.assert_member_active(uuid) FROM PUBLIC, anon, authenticated, appsmith_ro, n8n_runner;
GRANT EXECUTE ON FUNCTION ops_private.assert_member_active(uuid) TO authenticated, service_role;

-- 4. Masked and Controlled Views

-- 4.1 Internal Member Source View (ops_private: never exposed directly to appsmith_ro)
CREATE OR REPLACE VIEW ops_private.member_source AS
SELECT 
  p.id,
  p.public_nickname,
  p.age_band,
  p.interest_account_type,
  p.terms_version,
  -- Single Source of Truth for Marketing Consent:
  -- Both user_profiles flag AND valid active record in consent_records (not withdrawn) must be present
  (
    COALESCE(p.marketing_consent, false) = true
    AND EXISTS (
      SELECT 1 
      FROM public.consent_records cr 
      WHERE cr.user_id = p.id 
        AND cr.consent_type = 'marketing' 
        AND cr.granted = true 
        AND cr.withdrawn_at IS NULL
    )
  ) AS marketing_consent,
  (
    SELECT max(cr.created_at)
    FROM public.consent_records cr
    WHERE cr.user_id = p.id
      AND cr.consent_type = 'marketing'
      AND cr.granted = true
      AND cr.withdrawn_at IS NULL
  ) AS marketing_consent_at,
  p.signup_utm_source,
  p.signup_utm_medium,
  p.signup_utm_campaign,
  p.created_at,
  p.updated_at,
  u.last_sign_in_at,
  r.role::text AS role,
  COALESCE(c.status, 'active') AS status,
  c.suspended_until,
  COALESCE(c.version, 0) AS control_version,
  -- Verified contact email: filters out synthetic OAuth bridge emails (kakao_..., naver_...)
  -- Requires explicit verified ledger entry OR confirmed non-OAuth email
  CASE 
    WHEN ce.verified_at IS NOT NULL THEN ce.email
    WHEN COALESCE(u.raw_app_meta_data ->> 'auth_bridge', '') <> 'oauth-v1' 
         AND u.email_confirmed_at IS NOT NULL 
         AND u.email !~* '@oauth\.etfcampus\.kr$' THEN u.email
    ELSE NULL 
  END AS contact_email,
  ( NULLIF(btrim(p.public_nickname), '') IS NOT NULL AND NULLIF(btrim(p.terms_version), '') IS NOT NULL ) AS profile_complete,
  ( 
    SELECT max(cr.created_at) 
    FROM public.consent_records cr 
    WHERE cr.user_id = p.id 
      AND cr.consent_type = 'community_terms' 
      AND cr.policy_version = p.terms_version 
      AND cr.granted = true 
      AND cr.withdrawn_at IS NULL 
  ) AS terms_consented_at,
  ARRAY( 
    SELECT DISTINCT oi.provider 
    FROM public.community_oauth_identities oi 
    WHERE oi.user_id = p.id 
    ORDER BY oi.provider 
  ) AS oauth_providers
FROM public.user_profiles p
JOIN auth.users u ON u.id = p.id
LEFT JOIN public.community_user_roles r ON r.user_id = p.id
LEFT JOIN ops_private.member_controls c ON c.user_id = p.id
LEFT JOIN ops_private.member_contact_emails ce ON ce.user_id = p.id;

-- 4.2 Backoffice Masked View (Exposed to appsmith_ro with security_barrier)
CREATE OR REPLACE VIEW backoffice.members WITH (security_barrier = true) AS
SELECT 
  id,
  public_nickname,
  age_band,
  interest_account_type,
  terms_version,
  terms_consented_at,
  marketing_consent,
  marketing_consent_at,
  signup_utm_source,
  signup_utm_medium,
  signup_utm_campaign,
  created_at,
  updated_at,
  last_sign_in_at,
  role,
  status,
  suspended_until,
  control_version,
  profile_complete,
  oauth_providers,
  CASE 
    WHEN contact_email IS NULL THEN NULL
    WHEN position('@' IN contact_email) <= 1 THEN '***'
    ELSE left(split_part(contact_email, '@', 1), 1) || '***@' || split_part(contact_email, '@', 2)
  END AS email_masked
FROM ops_private.member_source;

REVOKE ALL ON backoffice.members FROM PUBLIC, anon, authenticated;
GRANT SELECT ON backoffice.members TO appsmith_ro;

-- 4.3 Exact-Match Email Lookup Function (Returns UUID set only, never leaks raw email to appsmith_ro)
CREATE OR REPLACE FUNCTION backoffice.find_member_by_email(p_email text)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.id 
  FROM ops_private.member_source s
  WHERE char_length(btrim(p_email)) BETWEEN 5 AND 254
    AND s.contact_email IS NOT NULL
    AND lower(s.contact_email) = lower(btrim(p_email));
$$;

REVOKE ALL ON FUNCTION backoffice.find_member_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION backoffice.find_member_by_email(text) TO appsmith_ro;

COMMIT;
