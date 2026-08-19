begin;

-- The public post view deliberately excludes author_profile_id. This RPC exposes only
-- whether the authenticated caller owns the requested active post, never an author ID.
create or replace function public.list_own_community_post_slugs(p_post_slug uuid)
returns table (slug uuid)
language sql
stable
security definer
set search_path = public
as $$
  select post.slug
  from public.community_posts post
  where post.slug = p_post_slug
    and post.author_profile_id = auth.uid()
    and post.deleted_at is null;
$$;

revoke all on function public.list_own_community_post_slugs(uuid) from public, anon;
grant execute on function public.list_own_community_post_slugs(uuid) to authenticated;

commit;
