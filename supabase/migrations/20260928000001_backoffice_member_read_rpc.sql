-- Migration: 20260928000001_backoffice_member_read_rpc.sql
-- Description: Server-side read-only RPCs for Backoffice Members masking view
-- Grants execute ONLY to service_role (Least Privilege). Revokes ALL from PUBLIC, anon, authenticated.

-- 1. Count RPC for backoffice members
CREATE OR REPLACE FUNCTION public.count_backoffice_members(
  p_search text DEFAULT NULL
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
  );
  RETURN v_count;
END;
$$;

-- 2. List RPC for backoffice members
CREATE OR REPLACE FUNCTION public.get_backoffice_members(
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0,
  p_search text DEFAULT NULL,
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
  created_at timestamptz
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

  IF p_sort_field IN ('public_nickname', 'status', 'created_at') THEN
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
    m.created_at
  FROM backoffice.members m
  WHERE (
    p_search IS NULL 
    OR btrim(p_search) = ''
    OR m.public_nickname ILIKE '%' || btrim(p_search) || '%'
    OR m.email_masked ILIKE '%' || btrim(p_search) || '%'
  )
  ORDER BY
    CASE WHEN v_sort_field = 'created_at' AND v_sort_asc THEN m.created_at END ASC,
    CASE WHEN v_sort_field = 'created_at' AND NOT v_sort_asc THEN m.created_at END DESC,
    CASE WHEN v_sort_field = 'public_nickname' AND v_sort_asc THEN m.public_nickname END ASC,
    CASE WHEN v_sort_field = 'public_nickname' AND NOT v_sort_asc THEN m.public_nickname END DESC,
    CASE WHEN v_sort_field = 'status' AND v_sort_asc THEN m.status END ASC,
    CASE WHEN v_sort_field = 'status' AND NOT v_sort_asc THEN m.status END DESC,
    m.id ASC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

-- 3. Strict Least Privilege: Only service_role can execute
REVOKE ALL ON FUNCTION public.count_backoffice_members(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_backoffice_members(text) TO service_role;

REVOKE ALL ON FUNCTION public.get_backoffice_members(int, int, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_backoffice_members(int, int, text, text, text) TO service_role;
