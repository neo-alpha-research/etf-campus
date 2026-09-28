-- Fix get_community_profile RPC to include terms_version column
-- Wrapped in atomic transaction block to eliminate race conditions between drop and create

BEGIN;

DROP FUNCTION IF EXISTS public.get_community_profile();

CREATE FUNCTION public.get_community_profile()
RETURNS TABLE (
  public_nickname text,
  interest_account_type text,
  investment_experience text,
  age_band text,
  marketing_consent boolean,
  role public.community_role,
  terms_version text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  RETURN QUERY
  SELECT 
    profile.public_nickname, 
    profile.interest_account_type, 
    profile.investment_experience, 
    profile.age_band, 
    profile.marketing_consent, 
    role_row.role,
    profile.terms_version
  FROM public.user_profiles profile
  JOIN public.community_user_roles role_row ON role_row.user_id = profile.id
  WHERE profile.id = current_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_community_profile() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_community_profile() TO authenticated, service_role;

COMMIT;
