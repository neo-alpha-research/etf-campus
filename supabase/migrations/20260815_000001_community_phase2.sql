begin;

create extension if not exists pgcrypto;

create type public.community_role as enum ('guest', 'member', 'moderator', 'admin');
create type public.community_content_disposition as enum ('anonymize', 'delete');

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  public_nickname text unique,
  interest_account_type text,
  investment_experience text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint user_profiles_nickname_length check (public_nickname is null or char_length(public_nickname) between 2 and 24),
  constraint user_profiles_interest_account_type check (interest_account_type is null or interest_account_type in ('dc', 'irp', 'pension_savings', 'general', 'none')),
  constraint user_profiles_investment_experience check (investment_experience is null or investment_experience in ('beginner', 'intermediate', 'experienced'))
);

comment on table public.user_profiles is 'Community profile. Email and auth identifiers remain in auth schema and are never exposed by public views.';

create table public.community_user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.community_role not null default 'member',
  granted_at timestamptz not null default timezone('utc', now()),
  granted_by uuid references auth.users(id) on delete set null,
  reason text not null default 'initial member role'
);

comment on table public.community_user_roles is 'Protected role table. No client policy permits role insertion or modification.';

create table public.community_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  sort_order integer not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint community_categories_slug_check check (slug in ('pension-etf-qna', 'etf-questions', 'challenge-30', 'feedback'))
);

insert into public.community_categories (slug, name, description, sort_order)
values
  ('pension-etf-qna', '연금 ETF Q&A', 'DC·IRP·연금저축 ETF의 판단 기준과 제도·용어를 질문합니다.', 10),
  ('etf-questions', 'ETF 정보·질문', 'ETF 구조, 비용, 위험, 공시를 확인하는 질문을 나눕니다.', 20),
  ('challenge-30', '30일 챌린지', '수익 경쟁이 아닌 ETF 판단 기준 학습 기록을 남깁니다.', 30),
  ('feedback', '오류·기능 제안', '데이터 오류와 서비스 개선점을 재현 가능한 방식으로 제보합니다.', 40);

create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  slug uuid not null unique default gen_random_uuid(),
  category_id uuid not null references public.community_categories(id) on delete restrict,
  author_profile_id uuid references public.user_profiles(id) on delete set null,
  title text not null,
  body_text text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  deletion_requested_at timestamptz,
  constraint community_posts_title_length check (char_length(title) between 2 and 120),
  constraint community_posts_body_length check (char_length(body_text) between 2 and 6000),
  constraint community_posts_no_html_title check (title !~* '<[[:space:]]*/?[[:space:]]*[[:alpha:]]'),
  constraint community_posts_no_html_body check (body_text !~* '<[[:space:]]*/?[[:space:]]*[[:alpha:]]')
);

create index community_posts_public_feed_idx on public.community_posts (category_id, created_at desc) where deleted_at is null;
create index community_posts_author_idx on public.community_posts (author_profile_id, updated_at desc);

create table public.community_comments (
  id uuid primary key default gen_random_uuid(),
  public_id uuid not null unique default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_profile_id uuid references public.user_profiles(id) on delete set null,
  body_text text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  deletion_requested_at timestamptz,
  constraint community_comments_body_length check (char_length(body_text) between 1 and 2000),
  constraint community_comments_no_html_body check (body_text !~* '<[[:space:]]*/?[[:space:]]*[[:alpha:]]')
);

create index community_comments_public_idx on public.community_comments (post_id, created_at asc) where deleted_at is null;
create index community_comments_author_idx on public.community_comments (author_profile_id, updated_at desc);

create table public.post_revisions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  editor_profile_id uuid references public.user_profiles(id) on delete set null,
  title text not null,
  body_text text not null,
  revised_at timestamptz not null default timezone('utc', now()),
  revision_reason text not null default 'author_edit'
);

create index post_revisions_post_idx on public.post_revisions (post_id, revised_at desc);

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  consent_type text not null,
  policy_version text not null,
  granted boolean not null,
  created_at timestamptz not null default timezone('utc', now()),
  withdrawn_at timestamptz,
  constraint consent_records_type_check check (consent_type in ('community_terms', 'privacy_notice', 'marketing'))
);

create index consent_records_user_idx on public.consent_records (user_id, consent_type, created_at desc);

create table public.community_rate_limit_buckets (
  bucket_key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.community_admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  subject_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null default timezone('utc', now()) + interval '1 year'
);

create index community_admin_audit_logs_expiry_idx on public.community_admin_audit_logs (expires_at);

create table public.community_withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  former_user_id uuid,
  content_disposition public.community_content_disposition not null,
  requested_at timestamptz not null default timezone('utc', now()),
  account_deleted_at timestamptz,
  content_purge_due_at timestamptz,
  completed_at timestamptz,
  notes text
);

create or replace function public.set_community_timestamp()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at = timezone('utc', now());
  end if;
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger user_profiles_timestamp
before insert or update on public.user_profiles
for each row execute procedure public.set_community_timestamp();

create trigger community_categories_timestamp
before insert or update on public.community_categories
for each row execute procedure public.set_community_timestamp();

create trigger community_posts_timestamp
before insert or update on public.community_posts
for each row execute procedure public.set_community_timestamp();

create trigger community_comments_timestamp
before insert or update on public.community_comments
for each row execute procedure public.set_community_timestamp();

create or replace function public.capture_post_revision()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.title is distinct from new.title or old.body_text is distinct from new.body_text then
    insert into public.post_revisions (post_id, editor_profile_id, title, body_text, revised_at)
    values (old.id, auth.uid(), old.title, old.body_text, timezone('utc', now()));
  end if;
  return new;
end;
$$;

create trigger community_posts_capture_revision
after update on public.community_posts
for each row execute procedure public.capture_post_revision();

create or replace function public.current_community_role()
returns public.community_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.community_user_roles where user_id = auth.uid()),
    'guest'::public.community_role
  );
$$;

create or replace function public.has_community_nickname()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_profiles
    where id = auth.uid() and public_nickname is not null
  );
$$;

create or replace function public.consume_community_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_bucket public.community_rate_limit_buckets%rowtype;
  now_utc timestamptz := timezone('utc', now());
begin
  if p_limit < 1 or p_window_seconds not in (60, 300, 600, 3600) then
    raise exception 'invalid rate limit parameters';
  end if;

  select * into current_bucket
  from public.community_rate_limit_buckets
  where bucket_key = p_bucket_key
  for update;

  if not found then
    insert into public.community_rate_limit_buckets (bucket_key, window_started_at, request_count, updated_at)
    values (p_bucket_key, now_utc, 1, now_utc);
    return true;
  end if;

  if current_bucket.window_started_at + make_interval(secs => p_window_seconds) <= now_utc then
    update public.community_rate_limit_buckets
    set window_started_at = now_utc, request_count = 1, updated_at = now_utc
    where bucket_key = p_bucket_key;
    return true;
  end if;

  if current_bucket.request_count >= p_limit then
    return false;
  end if;

  update public.community_rate_limit_buckets
  set request_count = request_count + 1, updated_at = now_utc
  where bucket_key = p_bucket_key;
  return true;
end;
$$;

create or replace function public.bootstrap_community_profile(
  p_public_nickname text,
  p_interest_account_type text default null,
  p_investment_experience text default null
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
  if normalized_nickname !~ '^[0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ _.-]+$' then
    raise exception 'invalid nickname format';
  end if;

  insert into public.user_profiles (id, public_nickname, interest_account_type, investment_experience)
  values (current_user_id, normalized_nickname, p_interest_account_type, p_investment_experience)
  on conflict (id) do update
  set public_nickname = excluded.public_nickname,
      interest_account_type = excluded.interest_account_type,
      investment_experience = excluded.investment_experience;

  insert into public.community_user_roles (user_id, role, reason)
  values (current_user_id, 'member', 'authenticated profile bootstrap')
  on conflict (user_id) do nothing;

  select role into resolved_role from public.community_user_roles where user_id = current_user_id;
  return query select normalized_nickname, resolved_role;
end;
$$;

create or replace function public.create_community_comment(
  p_post_slug uuid,
  p_body_text text
)
returns table (public_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_post_id uuid;
  created_comment_id uuid;
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;
  if public.current_community_role() not in ('member', 'moderator', 'admin') or not public.has_community_nickname() then
    raise exception 'community member profile required';
  end if;
  if char_length(btrim(p_body_text)) < 1 or char_length(btrim(p_body_text)) > 2000 or p_body_text ~* '<[[:space:]]*/?[[:space:]]*[[:alpha:]]' then
    raise exception 'invalid comment body';
  end if;

  select id into target_post_id
  from public.community_posts
  where slug = p_post_slug and deleted_at is null;
  if target_post_id is null then
    raise exception 'post not found';
  end if;

  insert into public.community_comments (post_id, author_profile_id, body_text)
  values (target_post_id, current_user_id, btrim(p_body_text))
  returning public_id into created_comment_id;

  return query select created_comment_id;
end;
$$;

create or replace function public.list_own_community_comment_ids(p_post_slug uuid)
returns table (public_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select comment.public_id
  from public.community_comments comment
  join public.community_posts post on post.id = comment.post_id
  where comment.author_profile_id = auth.uid()
    and post.slug = p_post_slug
    and comment.deleted_at is null;
$$;

create or replace function public.prepare_community_withdrawal(p_disposition public.community_content_disposition)
returns table (content_disposition public.community_content_disposition)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  purge_due_at timestamptz := timezone('utc', now()) + interval '30 days';
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  if p_disposition = 'delete' then
    update public.community_posts
    set deleted_at = timezone('utc', now()), deletion_requested_at = timezone('utc', now())
    where author_profile_id = current_user_id and deleted_at is null;

    update public.community_comments
    set deleted_at = timezone('utc', now()), deletion_requested_at = timezone('utc', now())
    where author_profile_id = current_user_id and deleted_at is null;
  end if;

  insert into public.community_withdrawal_requests (
    former_user_id,
    content_disposition,
    requested_at,
    content_purge_due_at
  ) values (
    current_user_id,
    p_disposition,
    timezone('utc', now()),
    case when p_disposition = 'delete' then purge_due_at else null end
  );

  insert into public.community_admin_audit_logs (actor_user_id, subject_user_id, action, reason, metadata)
  values (current_user_id, current_user_id, 'account_withdrawal_requested', null, jsonb_build_object('content_disposition', p_disposition));

  return query select p_disposition;
end;
$$;

create or replace function public.assign_initial_community_admin(
  p_target_user_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from auth.users where id = p_target_user_id) then
    raise exception 'target user does not exist';
  end if;

  insert into public.community_user_roles (user_id, role, granted_by, reason)
  values (p_target_user_id, 'admin', auth.uid(), p_reason)
  on conflict (user_id) do update
  set role = 'admin', granted_at = timezone('utc', now()), granted_by = excluded.granted_by, reason = excluded.reason;

  insert into public.community_admin_audit_logs (actor_user_id, subject_user_id, action, reason)
  values (auth.uid(), p_target_user_id, 'role_granted', p_reason);
end;
$$;

revoke all on function public.assign_initial_community_admin(uuid, text) from public, anon, authenticated;
revoke all on function public.consume_community_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.bootstrap_community_profile(text, text, text) from public, anon;
revoke all on function public.create_community_comment(uuid, text) from public, anon;
revoke all on function public.list_own_community_comment_ids(uuid) from public, anon;
grant execute on function public.consume_community_rate_limit(text, integer, integer) to service_role;
grant execute on function public.bootstrap_community_profile(text, text, text) to authenticated;
grant execute on function public.create_community_comment(uuid, text) to authenticated;
grant execute on function public.list_own_community_comment_ids(uuid) to authenticated;
grant execute on function public.prepare_community_withdrawal(public.community_content_disposition) to authenticated;

alter table public.user_profiles enable row level security;
alter table public.community_user_roles enable row level security;
alter table public.community_categories enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.post_revisions enable row level security;
alter table public.consent_records enable row level security;
alter table public.community_rate_limit_buckets enable row level security;
alter table public.community_admin_audit_logs enable row level security;
alter table public.community_withdrawal_requests enable row level security;

create policy "profiles_select_self" on public.user_profiles
for select to authenticated using (id = auth.uid());
create policy "profiles_insert_self" on public.user_profiles
for insert to authenticated with check (id = auth.uid());
create policy "profiles_update_self" on public.user_profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "categories_public_read" on public.community_categories
for select to anon, authenticated using (is_active = true);

create policy "posts_select_author_or_admin" on public.community_posts
for select to authenticated using (author_profile_id = auth.uid() or public.current_community_role() = 'admin');
create policy "posts_insert_member" on public.community_posts
for insert to authenticated with check (
  author_profile_id = auth.uid()
  and public.current_community_role() in ('member', 'moderator', 'admin')
  and public.has_community_nickname()
);
create policy "posts_update_author_or_admin" on public.community_posts
for update to authenticated using (
  (author_profile_id = auth.uid() and deleted_at is null)
  or public.current_community_role() = 'admin'
) with check (
  author_profile_id = auth.uid() or public.current_community_role() = 'admin'
);

create policy "comments_select_author_or_admin" on public.community_comments
for select to authenticated using (author_profile_id = auth.uid() or public.current_community_role() = 'admin');
create policy "comments_insert_member" on public.community_comments
for insert to authenticated with check (
  author_profile_id = auth.uid()
  and public.current_community_role() in ('member', 'moderator', 'admin')
  and public.has_community_nickname()
);
create policy "comments_update_author_or_admin" on public.community_comments
for update to authenticated using (
  (author_profile_id = auth.uid() and deleted_at is null)
  or public.current_community_role() = 'admin'
) with check (
  author_profile_id = auth.uid() or public.current_community_role() = 'admin'
);

create policy "consents_select_self" on public.consent_records
for select to authenticated using (user_id = auth.uid());
create policy "consents_insert_self" on public.consent_records
for insert to authenticated with check (user_id = auth.uid());
create policy "consents_update_self" on public.consent_records
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "revisions_admin_read" on public.post_revisions
for select to authenticated using (public.current_community_role() = 'admin');
create policy "audit_admin_read" on public.community_admin_audit_logs
for select to authenticated using (public.current_community_role() = 'admin');

create or replace view public.community_public_posts
with (security_invoker = false)
as
select
  p.slug,
  p.title,
  p.body_text,
  c.slug as category_slug,
  c.name as category_name,
  coalesce(profile.public_nickname, '탈퇴한 사용자') as author_nickname,
  p.created_at,
  p.updated_at,
  count(comment.id) filter (where comment.deleted_at is null) as comment_count
from public.community_posts p
join public.community_categories c on c.id = p.category_id and c.is_active = true
left join public.user_profiles profile on profile.id = p.author_profile_id
left join public.community_comments comment on comment.post_id = p.id
where p.deleted_at is null
group by p.id, c.slug, c.name, profile.public_nickname;

create or replace view public.community_public_comments
with (security_invoker = false)
as
select
  comment.public_id,
  post.slug as post_slug,
  comment.body_text,
  coalesce(profile.public_nickname, '탈퇴한 사용자') as author_nickname,
  comment.created_at,
  comment.updated_at
from public.community_comments comment
join public.community_posts post on post.id = comment.post_id and post.deleted_at is null
left join public.user_profiles profile on profile.id = comment.author_profile_id
where comment.deleted_at is null;

grant select on public.community_public_posts, public.community_public_comments, public.community_categories to anon, authenticated;

commit;
