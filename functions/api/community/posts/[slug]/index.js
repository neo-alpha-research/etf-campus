import { authenticatedSupabase, publicSupabase } from "../../_lib/supabase";
import { enforceDatabaseRateLimit, parseJsonBody } from "../../_lib/request-security";
import { errorResponse, jsonResponse } from "../../_lib/api-security";
import { CommunityValidationError, toPublicPost, validatePostInput } from "../../_lib/contracts";

function validSlug(value) { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
async function publicPostBySlug(env, slug) { return publicSupabase(env).from("community_public_posts").select("slug,title,body_text,category_slug,category_name,author_nickname,created_at,updated_at,comment_count").eq("slug", slug).maybeSingle(); }
function mapRpcError(error, action) {
  const message = error?.message ?? "";
  if (message.includes("forbidden")) return errorResponse(403, "FORBIDDEN", `본인???�성??게시물만 ${action}?????�습?�다.`);
  if (message.includes("not found")) return errorResponse(404, "NOT_FOUND", "게시물을 찾을 ???�습?�다.");
  return null;
}

export async function onRequestGet(context) {
  const slug = context.params.slug;
  if (!validSlug(slug)) return errorResponse(404, "NOT_FOUND", "게시물을 찾을 ???�습?�다.");
  try {
    const { data, error } = await publicPostBySlug(context.env, slug);
    if (error) throw error;
    if (!data) return errorResponse(404, "NOT_FOUND", "게시물을 찾을 ???�습?�다.");
    return Response.json({ post: toPublicPost(data) }, { headers: { "Cache-Control": "public, max-age=30, s-maxage=30", "X-Content-Type-Options": "nosniff" } });
  } catch { return errorResponse(503, "UNAVAILABLE", "게시물을 불러?????�습?�다."); }
}

export async function onRequestPatch(context) {
  const slug = context.params.slug;
  if (!validSlug(slug)) return errorResponse(404, "NOT_FOUND", "게시물을 찾을 ???�습?�다.");
  const auth = await authenticatedSupabase(context);
  if (auth.error) return auth.error;
  const payload = await parseJsonBody(context.request);
  try {
    const input = validatePostInput(payload);
    const rateLimitError = await enforceDatabaseRateLimit(context, "post-update", auth.user.id, 10, 600);
    if (rateLimitError) return rateLimitError;
    const { data, error } = await auth.client.rpc("update_community_post", { p_slug: slug, p_category_slug: input.categorySlug, p_title: input.title, p_body_text: input.bodyText });
    if (error) return mapRpcError(error, "?�정") ?? errorResponse(503, "UNAVAILABLE", "게시물을 ?�정?????�습?�다.");
    return jsonResponse({ post: { slug: Array.isArray(data) ? data[0]?.slug : data?.slug } });
  } catch (error) { return error instanceof CommunityValidationError ? errorResponse(400, "VALIDATION_ERROR", error.message) : errorResponse(503, "UNAVAILABLE", "게시물을 ?�정?????�습?�다."); }
}

export async function onRequestDelete(context) {
  const slug = context.params.slug;
  if (!validSlug(slug)) return errorResponse(404, "NOT_FOUND", "게시물을 찾을 ???�습?�다.");
  const auth = await authenticatedSupabase(context);
  if (auth.error) return auth.error;
  const rateLimitError = await enforceDatabaseRateLimit(context, "post-delete", auth.user.id, 5, 600);
  if (rateLimitError) return rateLimitError;
  const { error } = await auth.client.rpc("soft_delete_community_post", { p_slug: slug });
  if (error) return mapRpcError(error, "??��") ?? errorResponse(503, "UNAVAILABLE", "게시물을 ??��?????�습?�다.");
  return jsonResponse({ deleted: true });
}
