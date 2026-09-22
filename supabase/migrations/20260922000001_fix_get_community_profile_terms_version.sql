-- Fix get_community_profile RPC to include terms_version column
-- Prevents existing users from being erroneously treated as new signups

drop function if exists public.get_community_profile();

create or replace function public.get_community_profile()
returns table (
  public_nickname text,
  interest_account_type text,
  investment_experience text,
  age_band text,
  marketing_consent boolean,
  role public.community_role,
  terms_version text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  return query
  select 
    profile.public_nickname, 
    profile.interest_account_type, 
    profile.investment_experience, 
    profile.age_band, 
    profile.marketing_consent, 
    role_row.role,
    profile.terms_version
  from public.user_profiles profile
  join public.community_user_roles role_row on role_row.user_id = profile.id
  where profile.id = current_user_id;
end;
$$;

revoke all on function public.get_community_profile() from public, anon;
grant execute on function public.get_community_profile() to authenticated, service_role;
