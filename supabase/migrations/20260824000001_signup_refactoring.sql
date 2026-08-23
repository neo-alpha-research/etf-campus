-- Drop old constraint
alter table public.user_profiles drop constraint if exists user_profiles_interest_account_type;

-- Add new columns to user_profiles
alter table public.user_profiles
  add column age_band text check (age_band is null or age_band in ('20s', '30s', '40s', '50s', '60s_plus')),
  add column marketing_consent boolean not null default false,
  add column marketing_consent_at timestamptz,
  add column terms_version text,
  add column signup_utm_source text,
  add column signup_utm_medium text,
  add column signup_utm_campaign text;

-- Add new constraint
alter table public.user_profiles
  add constraint user_profiles_interest_account_type
  check (interest_account_type is null or interest_account_type in ('dc', 'irp', 'db', 'both', 'general', 'none', 'unknown', 'pension_savings'));

-- Drop old bootstrap function
drop function if exists public.bootstrap_community_profile(text, text, text);
drop function if exists public.bootstrap_community_profile(text);

-- Recreate bootstrap function with new signature
create or replace function public.bootstrap_community_profile(
  p_public_nickname text,
  p_terms_version text,
  p_marketing_consent boolean,
  p_signup_utm_source text default null,
  p_signup_utm_medium text default null,
  p_signup_utm_campaign text default null
)
returns table (public_nickname text, role public.community_role)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_nickname text := btrim(p_public_nickname);
  resolved_role public.community_role;
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;
  if char_length(normalized_nickname) < 2 or char_length(normalized_nickname) > 24 then
    raise exception 'invalid nickname length';
  end if;
  if normalized_nickname !~ '^[0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ_.-]+$' then
    raise exception 'invalid nickname format';
  end if;

  insert into public.user_profiles (
    id, public_nickname, terms_version, marketing_consent,
    marketing_consent_at, signup_utm_source, signup_utm_medium, signup_utm_campaign
  )
  values (
    current_user_id, normalized_nickname, p_terms_version, p_marketing_consent,
    case when p_marketing_consent then timezone('utc', now()) else null end,
    p_signup_utm_source, p_signup_utm_medium, p_signup_utm_campaign
  )
  on conflict (id) do update
  set public_nickname = excluded.public_nickname,
      terms_version = excluded.terms_version,
      marketing_consent = excluded.marketing_consent,
      marketing_consent_at = excluded.marketing_consent_at,
      signup_utm_source = excluded.signup_utm_source,
      signup_utm_medium = excluded.signup_utm_medium,
      signup_utm_campaign = excluded.signup_utm_campaign;

  insert into public.community_user_roles (user_id, role, reason)
  values (current_user_id, 'member', 'authenticated profile bootstrap')
  on conflict (user_id) do nothing;

  select public.community_user_roles.role into resolved_role from public.community_user_roles where user_id = current_user_id;
  return query select normalized_nickname, resolved_role;
end;
$$;

revoke all on function public.bootstrap_community_profile(text, text, boolean, text, text, text) from public, anon;
grant execute on function public.bootstrap_community_profile(text, text, boolean, text, text, text) to authenticated;

-- Create onboarding update function
create or replace function public.update_community_profile_onboarding(
  p_age_band text,
  p_interest_account_type text
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

  update public.user_profiles
  set age_band = nullif(btrim(p_age_band), ''),
      interest_account_type = nullif(btrim(p_interest_account_type), ''),
      updated_at = timezone('utc', now())
  where id = current_user_id;
end;
$$;

revoke all on function public.update_community_profile_onboarding(text, text) from public, anon;
grant execute on function public.update_community_profile_onboarding(text, text) to authenticated;
