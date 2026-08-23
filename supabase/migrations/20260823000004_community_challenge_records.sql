begin;

-- 1. Alter community_posts to include challenge fields
alter table public.community_posts
  add column if not exists challenge_day_number integer check (challenge_day_number between 1 and 30),
  add column if not exists challenge_cohort_id uuid references public.community_challenge_cohorts(id) on delete set null,
  add column if not exists challenge_metric_key text check (challenge_metric_key in ('study_checkin', 'source_review', 'criteria_check', 'learning_note')),
  add column if not exists challenge_metric_value integer check (challenge_metric_value between 0 and 10),
  add column if not exists challenge_visibility text default 'cohort' check (challenge_visibility in ('cohort', 'public'));

-- 2. Update the public view to filter out 'cohort' visibility records
drop view if exists public.community_public_posts;
create view public.community_public_posts
with (security_invoker = false)
as
select
  p.slug,
  p.title,
  p.body_text,
  c.slug as category_slug,
  c.name as category_name,
  coalesce(profile.public_nickname, '탈퇴한 이용자') as author_nickname,
  p.created_at,
  p.updated_at,
  p.is_pinned,
  p.is_author_seed,
  p.challenge_day_number,
  p.challenge_cohort_id,
  p.challenge_metric_key,
  p.challenge_metric_value,
  count(comment.id) filter (where comment.deleted_at is null and comment.moderated_hidden_at is null) as comment_count
from public.community_posts p
join public.community_categories c on c.id = p.category_id and c.is_active = true
left join public.user_profiles profile on profile.id = p.author_profile_id
left join public.community_comments comment on comment.post_id = p.id
where p.deleted_at is null 
  and p.moderated_hidden_at is null
  and (p.challenge_visibility is null or p.challenge_visibility = 'public')
group by p.id, c.slug, c.name, profile.public_nickname, p.challenge_day_number, p.challenge_cohort_id, p.challenge_metric_key, p.challenge_metric_value;

grant select on public.community_public_posts to anon, authenticated;

-- 3. Update create_community_post RPC
create or replace function public.create_community_post(
  p_category_slug text, 
  p_title text, 
  p_body_text text, 
  p_is_author_seed boolean default false,
  p_challenge_day_number integer default null,
  p_challenge_cohort_id uuid default null,
  p_challenge_metric_key text default null,
  p_challenge_metric_value integer default null,
  p_challenge_visibility text default null
)
returns table (slug uuid)
language plpgsql security definer set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  category_uuid uuid;
  created_slug uuid;
  previous_post_body text;
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  if public.current_community_role() not in ('member', 'admin', 'moderator') or not public.has_community_nickname() then raise exception 'community member profile required'; end if;
  if p_is_author_seed and public.current_community_role() not in ('admin', 'moderator') then raise exception 'admin or moderator role required for author seed'; end if;
  if char_length(btrim(p_title)) not between 2 and 120 or char_length(btrim(p_body_text)) not between 2 and 6000 then raise exception 'invalid post length'; end if;
  if p_title ~* '<[[:space:]]*/?[[:space:]]*[[:alpha:]]' or p_body_text ~* '<[[:space:]]*/?[[:space:]]*[[:alpha:]]' then raise exception 'html is not allowed'; end if;

  -- Abusing prevention: check if the previous post body matches exactly
  select body_text into previous_post_body 
  from public.community_posts 
  where author_profile_id = current_user_id 
  order by created_at desc 
  limit 1;

  if previous_post_body is not null and btrim(previous_post_body) = btrim(p_body_text) then
    raise exception '이전 글과 본문 내용이 완전히 동일합니다.';
  end if;

  select id into category_uuid from public.community_categories where public.community_categories.slug = p_category_slug and public.community_categories.is_active;
  if category_uuid is null then raise exception 'category not found'; end if;

  insert into public.community_posts(
    category_id, 
    author_profile_id, 
    title, 
    body_text, 
    is_author_seed,
    challenge_day_number,
    challenge_cohort_id,
    challenge_metric_key,
    challenge_metric_value,
    challenge_visibility
  ) values (
    category_uuid, 
    current_user_id, 
    btrim(p_title), 
    btrim(p_body_text), 
    p_is_author_seed,
    p_challenge_day_number,
    p_challenge_cohort_id,
    p_challenge_metric_key,
    p_challenge_metric_value,
    p_challenge_visibility
  ) returning community_posts.slug into created_slug;
  return query select created_slug;
end;
$$;

revoke all on function public.create_community_post(text, text, text, boolean, integer, uuid, text, integer, text) from public, anon, authenticated;
grant execute on function public.create_community_post(text, text, text, boolean, integer, uuid, text, integer, text) to authenticated;

drop function if exists public.create_community_post(text, text, text, boolean);

commit;
