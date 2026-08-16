import { authenticatedSupabase, publicSupabase } from "../_lib/supabase";
import { enforceDatabaseRateLimit, parseJsonBody } from "../_lib/request-security";
import { errorResponse, jsonResponse } from "../_lib/api-security";
import { CommunityValidationError, toPublicPost, validatePostInput } from "../_lib/contracts";

function listLimit(value) { const parsed = Number.parseInt(value ?? "20", 10); return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 50) : 20; }

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const category = url.searchParams.get("category");
  try {
    const supabase = publicSupabase(context.env);
    let query = supabase.from("community_public_posts").select("slug,title,body_text,category_slug,category_name,author_nickname,created_at,updated_at,comment_count").order("created_at", { ascending: false }).limit(listLimit(url.searchParams.get("limit")));
    if (category) query = query.eq("category_slug", category);
    const { data, error } = await query;
    if (error) throw error;
    return Response.json({ posts: (data ?? []).map(toPublicPost) }, { headers: { "Cache-Control": "public, max-age=30, s-maxage=30", "X-Content-Type-Options": "nosniff" } });
  } catch { return errorResponse(503, "UNAVAILABLE", "ì»¤ë??ˆí‹° ê¸€??ë¶ˆëŸ¬?????†ìŠµ?ˆë‹¤."); }
}

export async function onRequestPost(context) {
  const auth = await authenticatedSupabase(context);
  if (auth.error) return auth.error;
  const payload = await parseJsonBody(context.request);
  try {
    const input = validatePostInput(payload);
    const rateLimitError = await enforceDatabaseRateLimit(context, "post-create", auth.user.id, 5, 600);
    if (rateLimitError) return rateLimitError;
    const { data, error } = await auth.client.rpc("create_community_post", { p_category_slug: input.categorySlug, p_title: input.title, p_body_text: input.bodyText });
    if (error) {
      if (error.message?.includes("member profile")) return errorResponse(403, "FORBIDDEN", "?‰ë„¤???¤ì •???„ë£Œ???¸ì¦ ?Œì›ë§?ê¸€???‘ì„±?????ˆìŠµ?ˆë‹¤.");
      throw error;
    }
    const result = Array.isArray(data) ? data[0] : data;
    return jsonResponse({ post: { slug: result?.slug } }, 201);
  } catch (error) {
    if (error instanceof CommunityValidationError) return errorResponse(400, "VALIDATION_ERROR", error.message);
    return errorResponse(503, "UNAVAILABLE", "ê²Œì‹œë¬¼ì„ ?€?¥í•  ???†ìŠµ?ˆë‹¤.");
  }
}
