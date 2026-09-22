-- Least Privilege Hardening for service_role
-- Restricts service_role access strictly to operational tables and functions required by Cloudflare Workers

BEGIN;

-- 1. Revoke blanket access across all public tables
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM service_role;

-- 2. Grant explicit minimal access to operational tables
GRANT SELECT, UPDATE ON TABLE public.user_profiles TO service_role;
GRANT ALL ON TABLE public.community_oauth_identities TO service_role;
GRANT ALL ON TABLE public.community_oauth_transactions TO service_role;
GRANT ALL ON TABLE public.community_admin_audit_logs TO service_role;
GRANT ALL ON TABLE public.community_withdrawal_requests TO service_role;
GRANT ALL ON TABLE public.community_maintenance_runs TO service_role;
GRANT ALL ON TABLE public.community_rate_limit_buckets TO service_role;

-- 3. Preserve execution rights on all SECURITY DEFINER functions and sequence usage
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

COMMIT;
