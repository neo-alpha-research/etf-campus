begin;

alter table public.community_challenge_participants
  add column if not exists payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'free')),
  add column if not exists milestone_10 boolean not null default false,
  add column if not exists milestone_20 boolean not null default false,
  add column if not exists milestone_30 boolean not null default false;

alter table public.community_challenge_participants drop constraint if exists community_challenge_participants_interest_account_type_check;

update public.community_challenge_participants set interest_account_type = 'none' where interest_account_type is null;
update public.community_challenge_participants set interest_account_type = 'none' where interest_account_type not in ('dc', 'irp', 'both', 'unknown', 'none');

alter table public.community_challenge_participants 
  add constraint community_challenge_participants_interest_account_type_check 
  check (interest_account_type in ('dc', 'irp', 'both', 'unknown', 'none'));

alter table public.community_challenge_participants
  alter column learning_topic drop not null;

update public.community_challenge_participants set goal_note = '목표가 입력되지 않았습니다.' where goal_note is null;

alter table public.community_challenge_participants
  alter column interest_account_type set not null,
  alter column goal_note set not null;

create or replace function public.apply_to_community_challenge(
  p_cohort_slug text,
  p_interest_account_type text,
  p_goal_note text,
  p_private_record_consent_version text
)
returns table (cohort_slug text, participant_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_cohort public.community_challenge_cohorts%rowtype;
  participant_count integer;
begin
  if current_user_id is null or public.current_community_role() not in ('member', 'admin', 'moderator') or not public.has_community_nickname() then
    raise exception 'community member profile required';
  end if;
  if p_interest_account_type not in ('dc', 'irp', 'both', 'unknown', 'none') then
    raise exception 'invalid account type';
  end if;
  if char_length(p_goal_note) not between 2 and 240 then
    raise exception 'invalid goal note length';
  end if;
  if p_goal_note ~* '<[[:space:]]*/?[[:space:]]*[[:alpha:]]' then
    raise exception 'html tags are not allowed in goal note';
  end if;

  select * into target_cohort from public.community_challenge_cohorts where slug = p_cohort_slug and status in ('recruiting', 'active');
  if target_cohort.id is null then
    raise exception 'cohort unavailable';
  end if;

  if target_cohort.capacity is not null then
    select count(*) into participant_count from public.community_challenge_participants where cohort_id = target_cohort.id and status in ('applied', 'active', 'completed');
    if participant_count >= target_cohort.capacity then
      raise exception 'cohort capacity full';
    end if;
  end if;

  insert into public.community_challenge_participants (
    cohort_id, profile_id, status, interest_account_type, goal_note, private_record_consent_version
  ) values (
    target_cohort.id, current_user_id, 'applied', p_interest_account_type, p_goal_note, p_private_record_consent_version
  );

  return query select target_cohort.slug, 'applied'::text;
end;
$$;

revoke all on function public.apply_to_community_challenge(text, text, text, text) from public, anon;
grant execute on function public.apply_to_community_challenge(text, text, text, text) to authenticated;

drop function if exists public.apply_to_community_challenge(text, text, text, text, text);

commit;
