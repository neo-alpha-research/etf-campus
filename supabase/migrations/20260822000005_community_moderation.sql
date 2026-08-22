begin;

alter table public.community_posts
  add column if not exists moderated_hidden_at timestamptz,
  add column if not exists moderated_hidden_by uuid references auth.users(id) on delete set null,
  add column if not exists moderated_hidden_reason text;

alter table public.community_comments
  add column if not exists moderated_hidden_at timestamptz,
  add column if not exists moderated_hidden_by uuid references auth.users(id) on delete set null,
  add column if not exists moderated_hidden_reason text;

create index if not exists community_posts_visible_feed_idx
  on public.community_posts (is_pinned desc, created_at desc, slug desc)
  where deleted_at is null and moderated_hidden_at is null;

create index if not exists community_comments_visible_idx
  on public.community_comments (post_id, created_at asc)
  where deleted_at is null and moderated_hidden_at is null;

create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid references auth.users(id) on delete set null,
  target_type text not null check (target_type in ('post', 'comment')),
  target_reference uuid not null,
  reason_code text not null check (reason_code in ('privacy_exposure', 'scam_or_external_inducement', 'guaranteed_return_or_trade_signal', 'misleading_information', 'harassment_or_abuse', 'advertising_or_copyright', 'other')),
  details text,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  resolution_note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null default timezone('utc', now()) + interval '1 year',
  constraint community_reports_details_length check (details is null or char_length(details) between 2 and 600),
  constraint community_reports_resolution_note_length check (resolution_note is null or char_length(resolution_note) between 2 and 500)
);

create index if not exists community_reports_open_target_idx
  on public.community_reports (target_type, target_reference, status, created_at desc);

create unique index if not exists community_reports_active_reporter_target_idx
  on public.community_reports (reporter_user_id, target_type, target_reference)
  where status in ('open', 'reviewing');

alter table public.community_reports enable row level security;
revoke all on table public.community_reports from public, anon, authenticated;

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
  p.is_pinned,
  count(comment.id) filter (where comment.deleted_at is null and comment.moderated_hidden_at is null) as comment_count
from public.community_posts p
join public.community_categories c on c.id = p.category_id and c.is_active = true
left join public.user_profiles profile on profile.id = p.author_profile_id
left join public.community_comments comment on comment.post_id = p.id
where p.deleted_at is null and p.moderated_hidden_at is null
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
join public.community_posts post on post.id = comment.post_id and post.deleted_at is null and post.moderated_hidden_at is null
left join public.user_profiles profile on profile.id = comment.author_profile_id
where comment.deleted_at is null and comment.moderated_hidden_at is null;

create or replace function public.list_community_public_posts(
  p_category_slug text default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_slug uuid default null,
  p_cursor_is_pinned boolean default null,
  p_limit integer default 21
)
returns table (
  slug uuid,
  title text,
  body_text text,
  category_slug text,
  category_name text,
  author_nickname text,
  created_at timestamptz,
  updated_at timestamptz,
  comment_count bigint,
  is_pinned boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_limit < 1 or p_limit > 31 then
    raise exception 'invalid page limit';
  end if;

  if p_category_slug is not null and p_category_slug not in ('notice', 'pension-etf-qna', 'etf-questions', 'challenge-30', 'feedback') then
    raise exception 'invalid category';
  end if;

  if (p_cursor_created_at is null) <> (p_cursor_slug is null)
     or (p_cursor_created_at is null) <> (p_cursor_is_pinned is null) then
    raise exception 'invalid cursor';
  end if;

  return query
  select
    post.slug,
    post.title,
    post.body_text,
    category.slug,
    category.name,
    coalesce(profile.public_nickname, '탈퇴한 사용자'),
    post.created_at,
    post.updated_at,
    count(comment.id) filter (where comment.deleted_at is null and comment.moderated_hidden_at is null),
    post.is_pinned
  from public.community_posts post
  join public.community_categories category on category.id = post.category_id and category.is_active = true
  left join public.user_profiles profile on profile.id = post.author_profile_id
  left join public.community_comments comment on comment.post_id = post.id
  where post.deleted_at is null
    and post.moderated_hidden_at is null
    and (p_category_slug is null or category.slug = p_category_slug)
    and (
      p_cursor_created_at is null
      or post.is_pinned < p_cursor_is_pinned
      or (
        post.is_pinned = p_cursor_is_pinned
        and (
          post.created_at < p_cursor_created_at
          or (post.created_at = p_cursor_created_at and post.slug < p_cursor_slug)
        )
      )
    )
  group by post.id, category.slug, category.name, profile.public_nickname
  order by post.is_pinned desc, post.created_at desc, post.slug desc
  limit p_limit;
end;
$$;

create or replace function public.create_community_report(
  p_target_type text,
  p_target_reference uuid,
  p_reason_code text,
  p_details text default null
)
returns table (report_id uuid, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_author_id uuid;
  target_exists boolean := false;
  existing_report public.community_reports%rowtype;
  created_id uuid;
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  if public.current_community_role() not in ('member', 'admin') or not public.has_community_nickname() then
    raise exception 'community member profile required';
  end if;

  if p_target_type not in ('post', 'comment') then
    raise exception 'invalid report target';
  end if;

  if p_reason_code not in ('privacy_exposure', 'scam_or_external_inducement', 'guaranteed_return_or_trade_signal', 'misleading_information', 'harassment_or_abuse', 'advertising_or_copyright', 'other') then
    raise exception 'invalid report reason';
  end if;

  if p_details is not null and (
    char_length(btrim(p_details)) not between 2 and 600
    or p_details ~* '<[[:space:]]*/?[[:space:]]*[[:alpha:]]'
  ) then
    raise exception 'invalid report details';
  end if;

  if p_target_type = 'post' then
    select author_profile_id, true into target_author_id, target_exists
    from public.community_posts
    where slug = p_target_reference and deleted_at is null;
  else
    select comment.author_profile_id, true into target_author_id, target_exists
    from public.community_comments comment
    join public.community_posts post on post.id = comment.post_id and post.deleted_at is null
    where comment.public_id = p_target_reference and comment.deleted_at is null;
  end if;

  if not target_exists then
    raise exception 'report target not found';
  end if;

  if target_author_id is not null and target_author_id = current_user_id then
    raise exception 'cannot report own content';
  end if;

  select * into existing_report
  from public.community_reports
  where reporter_user_id = current_user_id
    and target_type = p_target_type
    and target_reference = p_target_reference
    and status in ('open', 'reviewing')
  order by created_at desc
  limit 1;

  if found then
    return query select existing_report.id, existing_report.status;
    return;
  end if;

  insert into public.community_reports (reporter_user_id, target_type, target_reference, reason_code, details)
  values (current_user_id, p_target_type, p_target_reference, p_reason_code, nullif(btrim(p_details), ''))
  returning id into created_id;

  return query select created_id, 'open'::text;
end;
$$;

create or replace function public.set_community_content_hidden(
  p_target_type text,
  p_target_reference uuid,
  p_is_hidden boolean,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  changed boolean := false;
begin
  if current_user_id is null or public.current_community_role() <> 'admin' then
    raise exception 'admin role required';
  end if;

  if p_target_type not in ('post', 'comment') then
    raise exception 'invalid moderation target';
  end if;

  if char_length(btrim(p_reason)) not between 2 and 500
     or p_reason ~* '<[[:space:]]*/?[[:space:]]*[[:alpha:]]' then
    raise exception 'invalid moderation reason';
  end if;

  if p_target_type = 'post' then
    update public.community_posts
    set moderated_hidden_at = case when p_is_hidden then timezone('utc', now()) else null end,
        moderated_hidden_by = case when p_is_hidden then current_user_id else null end,
        moderated_hidden_reason = case when p_is_hidden then btrim(p_reason) else null end
    where slug = p_target_reference and deleted_at is null;
  else
    update public.community_comments
    set moderated_hidden_at = case when p_is_hidden then timezone('utc', now()) else null end,
        moderated_hidden_by = case when p_is_hidden then current_user_id else null end,
        moderated_hidden_reason = case when p_is_hidden then btrim(p_reason) else null end
    where public_id = p_target_reference and deleted_at is null;
  end if;

  get diagnostics changed = row_count > 0;
  if not changed then
    raise exception 'moderation target not found';
  end if;

  if p_is_hidden then
    update public.community_reports
    set status = 'resolved',
        resolved_at = timezone('utc', now()),
        resolved_by = current_user_id,
        resolution_note = btrim(p_reason),
        updated_at = timezone('utc', now())
    where target_type = p_target_type
      and target_reference = p_target_reference
      and status in ('open', 'reviewing');
  end if;

  insert into public.community_admin_audit_logs (actor_user_id, action, reason, metadata)
  values (
    current_user_id,
    case when p_is_hidden then 'community_content_temporarily_hidden' else 'community_content_restored' end,
    btrim(p_reason),
    jsonb_build_object('target_type', p_target_type, 'target_reference', p_target_reference, 'is_hidden', p_is_hidden)
  );

  return true;
end;
$$;

create or replace function public.create_community_comment(p_post_slug uuid, p_body_text text)
returns table (public_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare target_post_id uuid; created_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if public.current_community_role() not in ('member', 'admin') or not public.has_community_nickname() then raise exception 'community member profile required'; end if;
  if char_length(btrim(p_body_text)) not between 1 and 2000 or p_body_text ~* '<[[:space:]]*/?[[:space:]]*[[:alpha:]]' then raise exception 'invalid comment body'; end if;
  select id into target_post_id
  from public.community_posts
  where slug = p_post_slug and deleted_at is null and moderated_hidden_at is null;
  if target_post_id is null then raise exception 'post not found'; end if;
  insert into public.community_comments(post_id, author_profile_id, body_text) values (target_post_id, auth.uid(), btrim(p_body_text)) returning community_comments.public_id into created_id;
  return query select created_id;
end;
$$;

create or replace function public.purge_expired_community_reports()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare affected integer := 0;
begin
  delete from public.community_reports where expires_at <= timezone('utc', now());
  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.run_community_maintenance(p_run_key date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  run_id uuid;
  withdrawal_purge_count integer := 0;
  report_purge_count integer := 0;
  evaluation_count integer := 0;
begin
  insert into public.community_maintenance_runs (task_name, run_key, status)
  values ('community_daily_maintenance', p_run_key, 'running')
  on conflict (task_name, run_key) do nothing
  returning id into run_id;

  if run_id is null then
    return jsonb_build_object('status', 'already_processed', 'run_key', p_run_key);
  end if;

  begin
    select public.purge_due_community_withdrawals() into withdrawal_purge_count;
    select public.purge_expired_community_reports() into report_purge_count;
    select public.record_due_community_challenge_evaluations(p_run_key) into evaluation_count;

    update public.community_maintenance_runs
    set status = 'completed',
        affected_count = coalesce(withdrawal_purge_count, 0) + coalesce(report_purge_count, 0) + coalesce(evaluation_count, 0),
        completed_at = timezone('utc', now())
    where id = run_id;

    insert into public.community_admin_audit_logs (action, reason, metadata)
    values (
      'community_maintenance_completed',
      'scheduled_withdrawal_purge_report_purge_and_challenge_evaluation',
      jsonb_build_object('run_key', p_run_key, 'withdrawal_purge_count', coalesce(withdrawal_purge_count, 0), 'report_purge_count', coalesce(report_purge_count, 0), 'evaluation_count', coalesce(evaluation_count, 0))
    );

    return jsonb_build_object('status', 'completed', 'run_key', p_run_key, 'affected_count', coalesce(withdrawal_purge_count, 0) + coalesce(report_purge_count, 0) + coalesce(evaluation_count, 0));
  exception when others then
    update public.community_maintenance_runs
    set status = 'failed',
        error_code = left(sqlstate, 40),
        completed_at = timezone('utc', now())
    where id = run_id;

    insert into public.community_admin_audit_logs (action, reason, metadata)
    values (
      'community_maintenance_failed',
      'scheduled_withdrawal_purge_report_purge_and_challenge_evaluation',
      jsonb_build_object('run_key', p_run_key, 'sqlstate', sqlstate)
    );

    raise;
  end;
end;
$$;

revoke all on function public.create_community_comment(uuid, text) from public, anon, authenticated;
revoke all on function public.create_community_report(text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.set_community_content_hidden(text, uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.purge_expired_community_reports() from public, anon, authenticated;
revoke all on function public.run_community_maintenance(date) from public, anon, authenticated;

grant execute on function public.create_community_comment(uuid, text), public.create_community_report(text, uuid, text, text) to authenticated;
grant execute on function public.set_community_content_hidden(text, uuid, boolean, text) to authenticated;
grant execute on function public.purge_expired_community_reports(), public.run_community_maintenance(date) to service_role;

commit;
