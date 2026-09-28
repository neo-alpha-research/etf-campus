-- Migration: 20260928000001_backoffice_member_ops_read_rpcs.sql
-- Description: Universal Operational Read-Only RPCs for Backoffice Member Management
-- Target Database: Production DB (uetzvsfqnydzdvnpytus)
-- WARNING: DO NOT apply to Preview DB (vdjyuqtcqhchopbrhexd) where the 3 synthetic user whitelist must remain locked.
-- Exposes masked members view, server-side pagination, search, and KPI statistics.
-- Grants execute ONLY to service_role (Least Privilege). Revokes ALL from PUBLIC, anon, authenticated.

BEGIN;

-- Drop prior signatures if they exist to prevent PostgreSQL "cannot change return type" errors and PostgREST overload ambiguity
DROP FUNCTION IF EXISTS public.get_backoffice_member_stats();
DROP FUNCTION IF EXISTS public.count_backoffice_members(text);
DROP FUNCTION IF EXISTS public.count_backoffice_members(text, text, text);
DROP FUNCTION IF EXISTS public.get_backoffice_members(int, int, text, text, text);
DROP FUNCTION IF EXISTS public.get_backoffice_members(int, int, text, text, text, text, text);

-- 1. KPI Stats RPC for Backoffice Overview
CREATE OR REPLACE FUNCTION public.get_backoffice_member_stats()
RETURNS TABLE (
  total_members bigint,
  today_signups bigint,
  marketing_consent_count bigint,
  marketing_consent_rate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = backoffice, ops_private, public, pg_temp
AS $$
DECLARE
  v_total bigint;
  v_today bigint;
  v_mkt bigint;
  v_rate numeric;
  v_kst_today_start timestamptz;
BEGIN
  -- KST (UTC+9) start of today
  v_kst_today_start := (date_trunc('day', now() AT TIME ZONE 'Asia/Seoul')) AT TIME ZONE 'Asia/Seoul';

  SELECT count(*) INTO v_total FROM backoffice.members;
  SELECT count(*) INTO v_today FROM backoffice.members WHERE created_at >= v_kst_today_start;
  SELECT count(*) INTO v_mkt FROM backoffice.members WHERE marketing_consent = true;

  IF v_total > 0 THEN
    v_rate := round((v_mkt::numeric * 100.0) / v_total::numeric, 1);
  ELSE
    v_rate := 0.0;
  END IF;

  RETURN QUERY SELECT v_total, v_today, v_mkt, v_rate;
END;
$$;

-- 2. Count RPC with search, role, and status filters
CREATE OR REPLACE FUNCTION public.count_backoffice_members(
  p_search text DEFAULT NULL,
  p_role text DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = backoffice, ops_private, public, pg_temp
AS $$
DECLARE
  v_count bigint;
BEGIN
  SELECT count(*) INTO v_count
  FROM backoffice.members m
  WHERE (
    p_search IS NULL 
    OR btrim(p_search) = ''
    OR m.public_nickname ILIKE '%' || btrim(p_search) || '%'
    OR m.email_masked ILIKE '%' || btrim(p_search) || '%'
  )
  AND (p_role IS NULL OR btrim(p_role) = '' OR m.role = btrim(p_role))
  AND (p_status IS NULL OR btrim(p_status) = '' OR m.status = btrim(p_status));

  RETURN v_count;
END;
$$;

-- 3. List RPC for backoffice members with rich metadata for detail view
CREATE OR REPLACE FUNCTION public.get_backoffice_members(
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0,
  p_search text DEFAULT NULL,
  p_role text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_sort_field text DEFAULT 'created_at',
  p_sort_direction text DEFAULT 'desc'
)
RETURNS TABLE (
  id uuid,
  public_nickname text,
  email_masked text,
  role text,
  status text,
  profile_complete boolean,
  terms_consented_at timestamptz,
  marketing_consent boolean,
  signup_utm_source text,
  created_at timestamptz,
  age_band text,
  interest_account_type text,
  terms_version text,
  marketing_consent_at timestamptz,
  signup_utm_medium text,
  signup_utm_campaign text,
  last_sign_in_at timestamptz,
  suspended_until timestamptz,
  oauth_providers text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = backoffice, ops_private, public, pg_temp
AS $$
DECLARE
  v_limit int;
  v_offset int;
  v_sort_field text;
  v_sort_asc boolean;
BEGIN
  v_limit := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
  v_offset := GREATEST(COALESCE(p_offset, 0), 0);

  IF p_sort_field IN ('public_nickname', 'status', 'created_at', 'role') THEN
    v_sort_field := p_sort_field;
  ELSE
    v_sort_field := 'created_at';
  END IF;

  v_sort_asc := (LOWER(COALESCE(p_sort_direction, 'desc')) = 'asc');

  RETURN QUERY
  SELECT 
    m.id,
    m.public_nickname,
    m.email_masked,
    m.role,
    m.status,
    m.profile_complete,
    m.terms_consented_at,
    m.marketing_consent,
    m.signup_utm_source,
    m.created_at,
    m.age_band,
    m.interest_account_type,
    m.terms_version,
    m.marketing_consent_at,
    m.signup_utm_medium,
    m.signup_utm_campaign,
    m.last_sign_in_at,
    m.suspended_until,
    m.oauth_providers
  FROM backoffice.members m
  WHERE (
    p_search IS NULL 
    OR btrim(p_search) = ''
    OR m.public_nickname ILIKE '%' || btrim(p_search) || '%'
    OR m.email_masked ILIKE '%' || btrim(p_search) || '%'
  )
  AND (p_role IS NULL OR btrim(p_role) = '' OR m.role = btrim(p_role))
  AND (p_status IS NULL OR btrim(p_status) = '' OR m.status = btrim(p_status))
  ORDER BY
    CASE WHEN v_sort_field = 'created_at' AND v_sort_asc THEN m.created_at END ASC,
    CASE WHEN v_sort_field = 'created_at' AND NOT v_sort_asc THEN m.created_at END DESC,
    CASE WHEN v_sort_field = 'public_nickname' AND v_sort_asc THEN m.public_nickname END ASC,
    CASE WHEN v_sort_field = 'public_nickname' AND NOT v_sort_asc THEN m.public_nickname END DESC,
    CASE WHEN v_sort_field = 'status' AND v_sort_asc THEN m.status END ASC,
    CASE WHEN v_sort_field = 'status' AND NOT v_sort_asc THEN m.status END DESC,
    CASE WHEN v_sort_field = 'role' AND v_sort_asc THEN m.role END ASC,
    CASE WHEN v_sort_field = 'role' AND NOT v_sort_asc THEN m.role END DESC,
    m.id ASC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

-- 4. Strict Least Privilege: Only service_role can execute
REVOKE ALL ON FUNCTION public.get_backoffice_member_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_backoffice_member_stats() TO service_role;

REVOKE ALL ON FUNCTION public.count_backoffice_members(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_backoffice_members(text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.get_backoffice_members(int, int, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_backoffice_members(int, int, text, text, text, text, text) TO service_role;

COMMIT;
