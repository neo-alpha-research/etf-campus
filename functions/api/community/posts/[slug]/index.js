import { authenticatedSupabase, publicSupabase } from "../../_lib/supabase";
import { enforceDatabaseRateLimit, parseJsonBody } from "../../_lib/request-security";
import { errorResponse, jsonResponse } from "../../_lib/api-security";
import { CommunityValidationError, toPublicPost, validatePostInput } from "../../_lib/contracts";

function validSlug(value) { return typeof value === "string" && /^[a-z0-9-_]{2,128}$/i.test(value); }

async function publicPostBySlug(env, slug) {
  return publicSupabase(env)
    .from("community_public_posts")
    .select("slug,title,body_text,category_slug,category_name,author_nickname,created_at,updated_at,is_pinned,is_author_seed,comment_count")
    .eq("slug", slug)
    .maybeSingle();
}

async function ownPostSlugs(env, authorization, postSlug) {
  const token = authorization?.match(/^Bearer\s+([^\s]+)$/i)?.[1];
  if (!token) return new Set();

  try {
    const supabase = publicSupabase(env, token);
    const { data } = await supabase.rpc("list_own_community_post_slugs", { p_post_slug: postSlug });
    return new Set((data ?? []).map((row) => row.slug));
  } catch {
    return new Set();
  }
}

async function canModerateContent(env, authorization) {
  const token = authorization?.match(/^Bearer\s+([^\s]+)$/i)?.[1];
  if (!token) return false;
  try {
    const { data } = await publicSupabase(env, token).rpc("current_community_role");
    return data === "admin";
  } catch {
    return false;
  }
}

function mapRpcError(error, action) {
  const message = error?.message ?? "";
  if (message.includes("forbidden")) return errorResponse(403, "FORBIDDEN", `본인이 작성한 게시물만 ${action}할 수 있습니다.`);
  if (message.includes("not found")) return errorResponse(404, "NOT_FOUND", "게시물을 찾을 수 없습니다.");
  return null;
}

export async function onRequestGet(context) {
  const slug = context.params.slug;
  if (!validSlug(slug)) return errorResponse(404, "NOT_FOUND", "게시물을 찾을 수 없습니다.");

  try {
    const { data, error } = await publicPostBySlug(context.env, slug);
    if (error) throw error;
    if (!data) return errorResponse(404, "NOT_FOUND", "게시물을 찾을 수 없습니다.");

    const authorization = context.request.headers.get("authorization");
    const [ownSlugs, canModerate] = await Promise.all([
      ownPostSlugs(context.env, authorization, slug),
      canModerateContent(context.env, authorization),
    ]);
    return Response.json({ post: { ...toPublicPost(data), canEdit: ownSlugs.has(slug), canModerate } }, {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return errorResponse(503, "UNAVAILABLE", "게시물을 불러오지 못했습니다.");
  }
}

export async function onRequestPatch(context) {
  const slug = context.params.slug;
  if (!validSlug(slug)) return errorResponse(404, "NOT_FOUND", "게시물을 찾을 수 없습니다.");

  const auth = await authenticatedSupabase(context);
  if (auth.error) return auth.error;
  const payload = await parseJsonBody(context.request);

  try {
    const input = validatePostInput(payload);
    const rateLimitError = await enforceDatabaseRateLimit(context, "post-update", auth.user.id, 10, 600);
    if (rateLimitError) return rateLimitError;

    const { data, error } = await auth.client.rpc("update_community_post", {
      p_slug: slug,
      p_category_slug: input.categorySlug,
      p_title: input.title,
      p_body_text: input.bodyText,
    });
    if (error) return mapRpcError(error, "수정") ?? errorResponse(503, "UNAVAILABLE", "게시물을 수정하지 못했습니다.");

    return jsonResponse({ post: { slug: Array.isArray(data) ? data[0]?.slug : data?.slug } });
  } catch (error) {
    return error instanceof CommunityValidationError
      ? errorResponse(400, "VALIDATION_ERROR", error.message)
      : errorResponse(503, "UNAVAILABLE", "게시물을 수정하지 못했습니다.");
  }
}

export async function onRequestDelete(context) {
  const slug = context.params.slug;
  if (!validSlug(slug)) return errorResponse(404, "NOT_FOUND", "게시물을 찾을 수 없습니다.");

  const auth = await authenticatedSupabase(context);
  if (auth.error) return auth.error;
  const rateLimitError = await enforceDatabaseRateLimit(context, "post-delete", auth.user.id, 5, 600);
  if (rateLimitError) return rateLimitError;

  const { error } = await auth.client.rpc("soft_delete_community_post", { p_slug: slug });
  if (error) return mapRpcError(error, "삭제") ?? errorResponse(503, "UNAVAILABLE", "게시물을 삭제하지 못했습니다.");
  return jsonResponse({ deleted: true });
}
