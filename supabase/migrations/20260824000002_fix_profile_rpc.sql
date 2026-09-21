-- Update get_community_profile to include new columns
drop function if exists public.get_community_profile();
create or replace function public.get_community_profile()
returns table (
  public_nickname text,
  interest_account_type text,
  investment_experience text,
  age_band text,
  marketing_consent boolean,
  role public.community_role
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
  select profile.public_nickname, profile.interest_account_type, profile.investment_experience, profile.age_band, profile.marketing_consent, role_row.role
  from public.user_profiles profile
  join public.community_user_roles role_row on role_row.user_id = profile.id
  where profile.id = current_user_id;
end;
$$;

revoke all on function public.get_community_profile() from public, anon;
grant execute on function public.get_community_profile() to authenticated;

-- Create update_community_profile_fields RPC
create or replace function public.update_community_profile_fields(
  p_updates jsonb
)
returns void
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

  if p_updates ? 'age_band' then
    update public.user_profiles set age_band = nullif(p_updates->>'age_band', ''), updated_at = timezone('utc', now()) where id = current_user_id;
  end if;
  
  if p_updates ? 'interest_account_type' then
    update public.user_profiles set interest_account_type = nullif(p_updates->>'interest_account_type', ''), updated_at = timezone('utc', now()) where id = current_user_id;
  end if;
  
  if p_updates ? 'marketing_consent' then
    update public.user_profiles set marketing_consent = (p_updates->>'marketing_consent')::boolean, marketing_consent_at = case when (p_updates->>'marketing_consent')::boolean then timezone('utc', now()) else null end, updated_at = timezone('utc', now()) where id = current_user_id;
  end if;
end;
$$;

revoke all on function public.update_community_profile_fields(jsonb) from public, anon;
grant execute on function public.update_community_profile_fields(jsonb) to authenticated;
