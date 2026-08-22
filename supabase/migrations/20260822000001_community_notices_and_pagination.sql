begin;

alter table public.community_categories
  drop constraint if exists community_categories_slug_check;

alter table public.community_categories
  add constraint community_categories_slug_check
  check (slug in ('notice', 'pension-etf-qna', 'etf-questions', 'challenge-30', 'feedback'));

insert into public.community_categories (slug, name, description, sort_order)
values ('notice', '공지', 'ETF Campus 운영 정책, 학습 안내, 서비스 변경 사항을 알립니다.', 0)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    sort_order = excluded.sort_order,
    is_active = true;

alter table public.community_posts
  add column if not exists is_pinned boolean not null default false,
  add column if not exists pinned_at timestamptz,
  add column if not exists pinned_by uuid references auth.users(id) on delete set null;

create index if not exists community_posts_pinned_feed_idx
  on public.community_posts (is_pinned desc, created_at desc, slug desc)
  where deleted_at is null;

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
  count(comment.id) filter (where comment.deleted_at is null) as comment_count
from public.community_posts p
join public.community_categories c on c.id = p.category_id and c.is_active = true
left join public.user_profiles profile on profile.id = p.author_profile_id
left join public.community_comments comment on comment.post_id = p.id
where p.deleted_at is null
group by p.id, c.slug, c.name, profile.public_nickname;

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
    count(comment.id) filter (where comment.deleted_at is null),
    post.is_pinned
  from public.community_posts post
  join public.community_categories category on category.id = post.category_id and category.is_active = true
  left join public.user_profiles profile on profile.id = post.author_profile_id
  left join public.community_comments comment on comment.post_id = post.id
  where post.deleted_at is null
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

create or replace function public.create_community_notice(
  p_title text,
  p_body_text text,
  p_is_pinned boolean default true
)
returns table (slug uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  category_id uuid;
  created_slug uuid;
begin
  if current_user_id is null or public.current_community_role() <> 'admin' then
    raise exception 'admin role required';
  end if;

  if char_length(btrim(p_title)) < 2 or char_length(btrim(p_title)) > 120
     or char_length(btrim(p_body_text)) < 2 or char_length(btrim(p_body_text)) > 6000
     or p_title ~* '<[[:space:]]*/?[[:space:]]*[[:alpha:]]'
     or p_body_text ~* '<[[:space:]]*/?[[:space:]]*[[:alpha:]]' then
    raise exception 'invalid notice content';
  end if;

  select id into category_id from public.community_categories where slug = 'notice' and is_active = true;
  if category_id is null then
    raise exception 'notice category unavailable';
  end if;

  insert into public.community_posts (category_id, author_profile_id, title, body_text, is_pinned, pinned_at, pinned_by)
  values (category_id, current_user_id, btrim(p_title), btrim(p_body_text), p_is_pinned, case when p_is_pinned then timezone('utc', now()) else null end, case when p_is_pinned then current_user_id else null end)
  returning community_posts.slug into created_slug;

  insert into public.community_admin_audit_logs (actor_user_id, action, reason, metadata)
  values (current_user_id, 'community_notice_created', null, jsonb_build_object('post_slug', created_slug, 'is_pinned', p_is_pinned));

  return query select created_slug;
end;
$$;

create or replace function public.set_community_post_pinned(
  p_post_slug uuid,
  p_is_pinned boolean
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

  update public.community_posts
  set is_pinned = p_is_pinned,
      pinned_at = case when p_is_pinned then timezone('utc', now()) else null end,
      pinned_by = case when p_is_pinned then current_user_id else null end
  where slug = p_post_slug and deleted_at is null;

  get diagnostics changed = row_count > 0;
  if not changed then
    raise exception 'post not found';
  end if;

  insert into public.community_admin_audit_logs (actor_user_id, action, reason, metadata)
  values (current_user_id, 'community_post_pin_changed', null, jsonb_build_object('post_slug', p_post_slug, 'is_pinned', p_is_pinned));

  return true;
end;
$$;

revoke all on function public.list_community_public_posts(text, timestamptz, uuid, boolean, integer) from public;
revoke all on function public.create_community_notice(text, text, boolean) from public, anon, authenticated;
revoke all on function public.set_community_post_pinned(uuid, boolean) from public, anon, authenticated;

grant execute on function public.list_community_public_posts(text, timestamptz, uuid, boolean, integer) to anon, authenticated;

commit;
