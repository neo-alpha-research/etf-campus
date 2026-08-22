begin;

create table public.community_challenge_cohorts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null,
  status text not null default 'draft' check (status in ('draft', 'recruiting', 'locked', 'active', 'grace_review', 'completed', 'archived')),
  capacity integer check (capacity is null or capacity between 1 and 200),
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint community_challenge_cohorts_dates_check check (ends_on = starts_on + 29)
);

create table public.community_challenge_participants (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.community_challenge_cohorts(id) on delete cascade,
  profile_id uuid not null references public.user_profiles(id) on delete cascade,
  status text not null default 'applied' check (status in ('applied', 'active', 'withdrawn', 'completed')),
  interest_account_type text check (interest_account_type is null or interest_account_type in ('dc', 'irp', 'pension_savings', 'general', 'none')),
  learning_topic text not null check (learning_topic in ('cost_comparison', 'distribution_notice', 'pension_account', 'risk_check', 'weekly_learning')),
  goal_note text check (goal_note is null or char_length(goal_note) between 2 and 240),
  private_record_consent_version text not null,
  private_record_consented_at timestamptz not null default timezone('utc', now()),
  applied_at timestamptz not null default timezone('utc', now()),
  activated_at timestamptz,
  withdrawn_at timestamptz,
  completed_at timestamptz,
  constraint community_challenge_participants_goal_no_html check (goal_note is null or goal_note !~* '<[[:space:]]*/?[[:space:]]*[[:alpha:]]'),
  constraint community_challenge_participants_unique_profile unique (cohort_id, profile_id)
);

create table public.community_challenge_records (
  id uuid primary key default gen_random_uuid(),
  public_id uuid not null unique default gen_random_uuid(),
  participant_id uuid not null references public.community_challenge_participants(id) on delete cascade,
  day_number integer not null check (day_number between 1 and 30),
  metric_key text not null check (metric_key in ('study_checkin', 'source_review', 'criteria_check', 'learning_note')),
  metric_value integer not null check (metric_value between 0 and 10),
  note text check (note is null or char_length(note) between 2 and 500),
  is_public boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint community_challenge_records_note_no_html check (note is null or note !~* '<[[:space:]]*/?[[:space:]]*[[:alpha:]]'),
  constraint community_challenge_records_unique_metric unique (participant_id, day_number, metric_key)
);

create table public.community_challenge_supports (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.community_challenge_records(id) on delete cascade,
  supporter_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  constraint community_challenge_supports_unique unique (record_id, supporter_profile_id)
);

create table public.community_challenge_day_evaluations (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.community_challenge_participants(id) on delete cascade,
  day_number integer not null check (day_number between 1 and 30),
  status text not null check (status in ('pending', 'submitted_on_time', 'submitted_late', 'not_submitted', 'excuse_requested', 'excused', 'confirmed_not_submitted')),
  determined_at timestamptz not null default timezone('utc', now()),
  determined_by uuid references auth.users(id) on delete set null,
  rule_version text not null default 'challenge-v1',
  reason_code text,
  previous_status text,
  constraint community_challenge_day_evaluations_unique unique (participant_id, day_number, rule_version)
);

create table public.community_challenge_appeals (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.community_challenge_day_evaluations(id) on delete cascade,
  participant_id uuid not null references public.community_challenge_participants(id) on delete cascade,
  reason text not null check (char_length(reason) between 2 and 500),
  status text not null default 'requested' check (status in ('requested', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint community_challenge_appeals_reason_no_html check (reason !~* '<[[:space:]]*/?[[:space:]]*[[:alpha:]]')
);

create index community_challenge_cohorts_status_idx on public.community_challenge_cohorts (status, starts_on);
create index community_challenge_records_public_idx on public.community_challenge_records (is_public, created_at desc) where is_public = true;
create index community_challenge_evaluations_participant_idx on public.community_challenge_day_evaluations (participant_id, day_number);

alter table public.community_challenge_cohorts enable row level security;
alter table public.community_challenge_participants enable row level security;
alter table public.community_challenge_records enable row level security;
alter table public.community_challenge_supports enable row level security;
alter table public.community_challenge_day_evaluations enable row level security;
alter table public.community_challenge_appeals enable row level security;

revoke all on table public.community_challenge_cohorts, public.community_challenge_participants, public.community_challenge_records, public.community_challenge_supports, public.community_challenge_day_evaluations, public.community_challenge_appeals from public, anon, authenticated;

create or replace function public.list_community_challenge_cohorts()
returns table (slug text, title text, description text, status text, capacity integer, starts_on date, ends_on date)
language sql
stable
security definer
set search_path = public
as $$
  select cohort.slug, cohort.title, cohort.description, cohort.status, cohort.capacity, cohort.starts_on, cohort.ends_on
  from public.community_challenge_cohorts cohort
  where cohort.status in ('recruiting', 'locked', 'active', 'grace_review', 'completed')
  order by cohort.starts_on desc;
$$;

create or replace function public.apply_to_community_challenge(
  p_cohort_slug text,
  p_interest_account_type text,
  p_learning_topic text,
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
  if current_user_id is null or public.current_community_role() not in ('member', 'admin') or not public.has_community_nickname() then
    raise exception 'community member profile required';
  end if;
  if p_interest_account_type is not null and p_interest_account_type not in ('dc', 'irp', 'pension_savings', 'general', 'none') then
    raise exception 'invalid account type';
  end if;
  if p_learning_topic not in ('cost_comparison', 'distribution_notice', 'pension_account', 'risk_check', 'weekly_learning') then
    raise exception 'invalid learning topic';
  end if;
  if char_length(btrim(p_private_record_consent_version)) not between 1 and 80 then
    raise exception 'invalid consent version';
  end if;
  if p_goal_note is not null and (char_length(btrim(p_goal_note)) not between 2 and 240 or p_goal_note ~* '<[[:space:]]*/?[[:space:]]*[[:alpha:]]') then
    raise exception 'invalid goal note';
  end if;

  select * into target_cohort from public.community_challenge_cohorts where slug = p_cohort_slug for update;
  if not found or target_cohort.status <> 'recruiting' then
    raise exception 'cohort unavailable';
  end if;

  select count(*) into participant_count from public.community_challenge_participants where cohort_id = target_cohort.id and status in ('applied', 'active');
  if target_cohort.capacity is not null and participant_count >= target_cohort.capacity then
    raise exception 'cohort capacity reached';
  end if;

  insert into public.community_challenge_participants (cohort_id, profile_id, interest_account_type, learning_topic, goal_note, private_record_consent_version)
  values (target_cohort.id, current_user_id, p_interest_account_type, p_learning_topic, nullif(btrim(p_goal_note), ''), btrim(p_private_record_consent_version))
  on conflict (cohort_id, profile_id) do update
  set interest_account_type = excluded.interest_account_type,
      learning_topic = excluded.learning_topic,
      goal_note = excluded.goal_note,
      private_record_consent_version = excluded.private_record_consent_version,
      private_record_consented_at = timezone('utc', now())
  where public.community_challenge_participants.status = 'applied';

  return query select target_cohort.slug, 'applied'::text;
end;
$$;

create or replace function public.record_community_challenge_metric(
  p_cohort_slug text,
  p_day_number integer,
  p_metric_key text,
  p_metric_value integer,
  p_note text,
  p_is_public boolean default false
)
returns table (public_id uuid, is_public boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_participant_id uuid;
  created_public_id uuid;
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  if p_day_number not between 1 and 30 then raise exception 'invalid day number'; end if;
  if p_metric_key not in ('study_checkin', 'source_review', 'criteria_check', 'learning_note') then raise exception 'invalid metric key'; end if;
  if p_metric_value not between 0 and 10 then raise exception 'invalid metric value'; end if;
  if p_note is not null and (char_length(btrim(p_note)) not between 2 and 500 or p_note ~* '<[[:space:]]*/?[[:space:]]*[[:alpha:]]') then raise exception 'invalid record note'; end if;

  select participant.id into target_participant_id
  from public.community_challenge_participants participant
  join public.community_challenge_cohorts cohort on cohort.id = participant.cohort_id
  where participant.profile_id = current_user_id
    and participant.status = 'active'
    and cohort.slug = p_cohort_slug
    and cohort.status in ('active', 'grace_review');
  if target_participant_id is null then raise exception 'active participant required'; end if;

  insert into public.community_challenge_records (participant_id, day_number, metric_key, metric_value, note, is_public)
  values (target_participant_id, p_day_number, p_metric_key, p_metric_value, nullif(btrim(p_note), ''), coalesce(p_is_public, false))
  on conflict (participant_id, day_number, metric_key) do update
  set metric_value = excluded.metric_value,
      note = excluded.note,
      is_public = excluded.is_public,
      updated_at = timezone('utc', now())
  returning community_challenge_records.public_id, community_challenge_records.is_public into created_public_id, p_is_public;

  return query select created_public_id, p_is_public;
end;
$$;

create or replace function public.list_public_community_challenge_records(p_cohort_slug text, p_limit integer default 20)
returns table (public_id uuid, day_number integer, metric_key text, metric_value integer, note text, author_nickname text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select record.public_id, record.day_number, record.metric_key, record.metric_value, record.note, profile.public_nickname, record.created_at
  from public.community_challenge_records record
  join public.community_challenge_participants participant on participant.id = record.participant_id
  join public.community_challenge_cohorts cohort on cohort.id = participant.cohort_id
  join public.user_profiles profile on profile.id = participant.profile_id
  where record.is_public
    and cohort.slug = p_cohort_slug
    and participant.status in ('active', 'completed')
  order by record.created_at desc, record.public_id desc
  limit greatest(1, least(p_limit, 30));
$$;

create or replace function public.support_community_challenge_record(p_public_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_record_id uuid;
  owner_profile_id uuid;
begin
  if current_user_id is null or public.current_community_role() not in ('member', 'admin') then raise exception 'community member required'; end if;

  select record.id, participant.profile_id into target_record_id, owner_profile_id
  from public.community_challenge_records record
  join public.community_challenge_participants participant on participant.id = record.participant_id
  where record.public_id = p_public_id and record.is_public;
  if target_record_id is null then raise exception 'record not found'; end if;
  if owner_profile_id = current_user_id then raise exception 'cannot support own record'; end if;

  insert into public.community_challenge_supports (record_id, supporter_profile_id)
  values (target_record_id, current_user_id)
  on conflict (record_id, supporter_profile_id) do nothing;

  return true;
end;
$$;

revoke all on function public.list_community_challenge_cohorts(), public.list_public_community_challenge_records(text, integer) from public;
revoke all on function public.apply_to_community_challenge(text, text, text, text, text), public.record_community_challenge_metric(text, integer, text, integer, text, boolean), public.support_community_challenge_record(uuid) from public, anon;

grant execute on function public.list_community_challenge_cohorts(), public.list_public_community_challenge_records(text, integer) to anon, authenticated;
grant execute on function public.apply_to_community_challenge(text, text, text, text, text), public.record_community_challenge_metric(text, integer, text, integer, text, boolean), public.support_community_challenge_record(uuid) to authenticated;

commit;
