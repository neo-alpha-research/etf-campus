begin;

-- All data mutations move behind narrowly scoped RPCs. RLS remains enabled as a second line of defense.
revoke all on table public.user_profiles, public.community_user_roles, public.community_posts, public.community_comments, public.post_revisions, public.consent_records, public.community_rate_limit_buckets, public.community_admin_audit_logs, public.community_withdrawal_requests from public, anon, authenticated;
revoke all on table public.community_categories from public;
revoke all on table public.community_public_posts, public.community_public_comments from public;
grant select on table public.community_categories, public.community_public_posts, public.community_public_comments to anon, authenticated;

-- SECURITY DEFINER functions use no ambient search path and only explicit grants.
alter function public.current_community_role() set search_path = '';
alter function public.has_community_nickname() set search_path = '';
alter function public.consume_community_rate_limit(text, integer, integer) set search_path = '';
alter function public.bootstrap_community_profile(text, text, text) set search_path = '';
alter function public.create_community_comment(uuid, text) set search_path = '';
alter function public.list_own_community_comment_ids(uuid) set search_path = '';
alter function public.prepare_community_withdrawal(public.community_content_disposition) set search_path = '';
alter function public.assign_initial_community_admin(uuid, text) set search_path = '';

revoke all on function public.current_community_role() from public, anon, authenticated;
revoke all on function public.has_community_nickname() from public, anon, authenticated;
revoke all on function public.consume_community_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.bootstrap_community_profile(text, text, text) from public, anon, authenticated;
revoke all on function public.create_community_comment(uuid, text) from public, anon, authenticated;
revoke all on function public.list_own_community_comment_ids(uuid) from public, anon, authenticated;
revoke all on function public.prepare_community_withdrawal(public.community_content_disposition) from public, anon, authenticated;
revoke all on function public.assign_initial_community_admin(uuid, text) from public, anon, authenticated;

-- Policy helper functions are only callable by authenticated members; initial admin assignment remains console/service-only.
grant execute on function public.current_community_role(), public.has_community_nickname() to authenticated;
grant execute on function public.bootstrap_community_profile(text, text, text), public.create_community_comment(uuid, text), public.list_own_community_comment_ids(uuid) to authenticated;
grant execute on function public.consume_community_rate_limit(text, integer, integer) to service_role;

-- Never allow a client to update server-generated identity, timestamps, role, audit, withdrawal or consent-history fields through the Data API.
drop policy if exists "profiles_select_self" on public.user_profiles;
drop policy if exists "profiles_insert_self" on public.user_profiles;
drop policy if exists "profiles_update_self" on public.user_profiles;
drop policy if exists "posts_select_author_or_admin" on public.community_posts;
drop policy if exists "posts_insert_member" on public.community_posts;
drop policy if exists "posts_update_author_or_admin" on public.community_posts;
drop policy if exists "comments_select_author_or_admin" on public.community_comments;
drop policy if exists "comments_insert_member" on public.community_comments;
drop policy if exists "comments_update_author_or_admin" on public.community_comments;
drop policy if exists "consents_select_self" on public.consent_records;
drop policy if exists "consents_insert_self" on public.consent_records;
drop policy if exists "consents_update_self" on public.consent_records;

-- Withdrawals become an explicit, retryable state machine. The platform scheduler is intentionally not configured by this migration.
alter table public.community_withdrawal_requests add column if not exists status text not null default 'requested';
alter table public.community_withdrawal_requests add column if not exists last_error_code text;
alter table public.community_withdrawal_requests add column if not exists retry_count integer not null default 0;
alter table public.community_withdrawal_requests add column if not exists updated_at timestamptz not null default timezone('utc', now());
alter table public.community_withdrawal_requests drop constraint if exists community_withdrawal_requests_status_check;
alter table public.community_withdrawal_requests add constraint community_withdrawal_requests_status_check check (status in ('requested', 'auth_delete_failed', 'auth_deleted', 'purged'));
create unique index if not exists community_withdrawal_requests_active_user_idx on public.community_withdrawal_requests (former_user_id) where completed_at is null;

create or replace function public.create_community_comment(p_post_slug uuid, p_body_text text)
returns table (public_id uuid)
language plpgsql security definer set search_path = ''
as $$
declare target_post_id uuid; created_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if public.current_community_role() not in ('member', 'admin') or not public.has_community_nickname() then raise exception 'community member profile required'; end if;
  if char_length(btrim(p_body_text)) not between 1 and 2000 or p_body_text ~* '<[[:space:]]*/?[[:space:]]*[[:alpha:]]' then raise exception 'invalid comment body'; end if;
  select id into target_post_id from public.community_posts where slug = p_post_slug and deleted_at is null;
  if target_post_id is null then raise exception 'post not found'; end if;
  insert into public.community_comments(post_id, author_profile_id, body_text) values (target_post_id, auth.uid(), btrim(p_body_text)) returning community_comments.public_id into created_id;
  return query select created_id;
end;
$$;

create or replace function public.get_community_profile()
returns table (public_nickname text, interest_account_type text, investment_experience text, role public.community_role)
language sql stable security definer set search_path = ''
as $$
  select profile.public_nickname, profile.interest_account_type, profile.investment_experience, role_row.role
  from public.user_profiles profile
  join public.community_user_roles role_row on role_row.user_id = profile.id
  where profile.id = auth.uid();
$$;

create or replace function public.create_community_post(p_category_slug text, p_title text, p_body_text text)
returns table (slug uuid)
language plpgsql security definer set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  category_uuid uuid;
  created_slug uuid;
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  if public.current_community_role() not in ('member', 'admin') or not public.has_community_nickname() then raise exception 'community member profile required'; end if;
  if char_length(btrim(p_title)) not between 2 and 120 or char_length(btrim(p_body_text)) not between 2 and 6000 then raise exception 'invalid post length'; end if;
  if p_title ~* '<[[:space:]]*/?[[:space:]]*[[:alpha:]]' or p_body_text ~* '<[[:space:]]*/?[[:space:]]*[[:alpha:]]' then raise exception 'html is not allowed'; end if;
  select id into category_uuid from public.community_categories where slug = p_category_slug and is_active;
  if category_uuid is null then raise exception 'category not found'; end if;
  insert into public.community_posts(category_id, author_profile_id, title, body_text) values (category_uuid, current_user_id, btrim(p_title), btrim(p_body_text)) returning community_posts.slug into created_slug;
  return query select created_slug;
end;
$$;

create or replace function public.update_community_post(p_slug uuid, p_category_slug text, p_title text, p_body_text text)
returns table (slug uuid)
language plpgsql security definer set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  category_uuid uuid;
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  if char_length(btrim(p_title)) not between 2 and 120 or char_length(btrim(p_body_text)) not between 2 and 6000 then raise exception 'invalid post length'; end if;
  if p_title ~* '<[[:space:]]*/?[[:space:]]*[[:alpha:]]' or p_body_text ~* '<[[:space:]]*/?[[:space:]]*[[:alpha:]]' then raise exception 'html is not allowed'; end if;
  select id into category_uuid from public.community_categories where slug = p_category_slug and is_active;
  if category_uuid is null then raise exception 'category not found'; end if;
  update public.community_posts set category_id = category_uuid, title = btrim(p_title), body_text = btrim(p_body_text)
  where community_posts.slug = p_slug and community_posts.author_profile_id = current_user_id and community_posts.deleted_at is null;
  if not found then raise exception 'post not found or forbidden'; end if;
  return query select p_slug;
end;
$$;

create or replace function public.soft_delete_community_post(p_slug uuid)
returns table (slug uuid)
language plpgsql security definer set search_path = ''
as $$
begin
  update public.community_posts set deleted_at = timezone('utc', now()), deletion_requested_at = timezone('utc', now())
  where community_posts.slug = p_slug and community_posts.author_profile_id = auth.uid() and community_posts.deleted_at is null;
  if not found then raise exception 'post not found or forbidden'; end if;
  return query select p_slug;
end;
$$;

create or replace function public.update_community_comment(p_public_id uuid, p_body_text text)
returns table (public_id uuid)
language plpgsql security definer set search_path = ''
as $$
begin
  if char_length(btrim(p_body_text)) not between 1 and 2000 or p_body_text ~* '<[[:space:]]*/?[[:space:]]*[[:alpha:]]' then raise exception 'invalid comment body'; end if;
  update public.community_comments set body_text = btrim(p_body_text)
  where community_comments.public_id = p_public_id and community_comments.author_profile_id = auth.uid() and community_comments.deleted_at is null;
  if not found then raise exception 'comment not found or forbidden'; end if;
  return query select p_public_id;
end;
$$;

create or replace function public.soft_delete_community_comment(p_public_id uuid)
returns table (public_id uuid)
language plpgsql security definer set search_path = ''
as $$
begin
  update public.community_comments set deleted_at = timezone('utc', now()), deletion_requested_at = timezone('utc', now())
  where community_comments.public_id = p_public_id and community_comments.author_profile_id = auth.uid() and community_comments.deleted_at is null;
  if not found then raise exception 'comment not found or forbidden'; end if;
  return query select p_public_id;
end;
$$;

create or replace function public.append_community_consent(p_consent_type text, p_policy_version text, p_granted boolean)
returns table (consent_id uuid, created_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare record_id uuid; recorded_at timestamptz;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_consent_type not in ('community_terms', 'privacy_notice', 'marketing') or char_length(btrim(p_policy_version)) not between 1 and 80 then raise exception 'invalid consent'; end if;
  insert into public.consent_records(user_id, consent_type, policy_version, granted, created_at)
  values (auth.uid(), p_consent_type, btrim(p_policy_version), p_granted, timezone('utc', now())) returning id, consent_records.created_at into record_id, recorded_at;
  return query select record_id, recorded_at;
end;
$$;

create or replace function public.list_community_consents()
returns table (consent_type text, policy_version text, granted boolean, created_at timestamptz, withdrawn_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select consent.consent_type, consent.policy_version, consent.granted, consent.created_at, consent.withdrawn_at
  from public.consent_records consent where consent.user_id = auth.uid() order by consent.created_at desc;
$$;

create or replace function public.withdraw_community_marketing_consent()
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  update public.consent_records set withdrawn_at = timezone('utc', now())
  where consent_records.user_id = auth.uid() and consent_records.consent_type = 'marketing' and consent_records.granted and consent_records.withdrawn_at is null;
end;
$$;

create or replace function public.request_community_withdrawal(p_disposition public.community_content_disposition)
returns table (request_id uuid, status text)
language plpgsql security definer set search_path = ''
as $$
declare current_user_id uuid := auth.uid(); existing public.community_withdrawal_requests%rowtype;
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  select * into existing from public.community_withdrawal_requests where former_user_id = current_user_id and completed_at is null order by requested_at desc limit 1;
  if found then return query select existing.id, existing.status; return; end if;
  if p_disposition = 'delete' then
    update public.community_posts set deleted_at = timezone('utc', now()), deletion_requested_at = timezone('utc', now()) where author_profile_id = current_user_id and deleted_at is null;
    update public.community_comments set deleted_at = timezone('utc', now()), deletion_requested_at = timezone('utc', now()) where author_profile_id = current_user_id and deleted_at is null;
  end if;
  insert into public.community_withdrawal_requests(former_user_id, content_disposition, requested_at, content_purge_due_at, status, updated_at)
  values (current_user_id, p_disposition, timezone('utc', now()), case when p_disposition = 'delete' then timezone('utc', now()) + interval '30 days' else null end, 'requested', timezone('utc', now()))
  returning id, status into request_id, status;
end;
$$;

create or replace function public.mark_community_withdrawal_auth_failed(p_request_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.community_withdrawal_requests set status = 'auth_delete_failed', retry_count = retry_count + 1, last_error_code = 'auth_delete_failed', updated_at = timezone('utc', now()) where id = p_request_id and completed_at is null;
end;
$$;

create or replace function public.mark_community_withdrawal_auth_deleted(p_request_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.community_withdrawal_requests
  set status = 'auth_deleted',
      account_deleted_at = timezone('utc', now()),
      completed_at = case when content_disposition = 'anonymize' then timezone('utc', now()) else completed_at end,
      updated_at = timezone('utc', now())
  where id = p_request_id and completed_at is null;
end;
$$;

create or replace function public.purge_due_community_withdrawals()
returns integer language plpgsql security definer set search_path = ''
as $$
declare affected integer := 0;
begin
  delete from public.post_revisions revision using public.community_posts post where revision.post_id = post.id and post.deleted_at is not null and post.deletion_requested_at <= timezone('utc', now()) - interval '30 days';
  delete from public.community_comments where deleted_at is not null and deletion_requested_at <= timezone('utc', now()) - interval '30 days';
  delete from public.community_posts where deleted_at is not null and deletion_requested_at <= timezone('utc', now()) - interval '30 days';
  update public.community_withdrawal_requests set status = 'purged', completed_at = timezone('utc', now()), updated_at = timezone('utc', now()) where status = 'auth_deleted' and content_disposition = 'delete' and content_purge_due_at <= timezone('utc', now()) and completed_at is null;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- Required functions only; no ordinary member can grant roles or call service maintenance.
revoke all on function public.get_community_profile(), public.create_community_post(text, text, text), public.update_community_post(uuid, text, text, text), public.soft_delete_community_post(uuid), public.update_community_comment(uuid, text), public.soft_delete_community_comment(uuid), public.append_community_consent(text, text, boolean), public.list_community_consents(), public.withdraw_community_marketing_consent(), public.request_community_withdrawal(public.community_content_disposition), public.mark_community_withdrawal_auth_failed(uuid), public.mark_community_withdrawal_auth_deleted(uuid), public.purge_due_community_withdrawals() from public, anon, authenticated;
grant execute on function public.get_community_profile(), public.create_community_post(text, text, text), public.update_community_post(uuid, text, text, text), public.soft_delete_community_post(uuid), public.update_community_comment(uuid, text), public.soft_delete_community_comment(uuid), public.append_community_consent(text, text, boolean), public.list_community_consents(), public.withdraw_community_marketing_consent(), public.request_community_withdrawal(public.community_content_disposition) to authenticated;
grant execute on function public.mark_community_withdrawal_auth_failed(uuid), public.mark_community_withdrawal_auth_deleted(uuid), public.purge_due_community_withdrawals(), public.assign_initial_community_admin(uuid, text) to service_role;

commit;
