import { authenticatedSupabase, publicSupabase } from "../../_lib/supabase";
import { enforceDatabaseRateLimit, parseJsonBody, verifyTurnstile } from "../../_lib/request-security";
import { errorResponse, jsonResponse, mutationOutcome } from "../../../../../lib/community/api-security";
import { CommunityValidationError, toPublicPost, validatePostInput } from "../../../../../lib/community/contracts";

function validSlug(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function publicPostBySlug(env, slug) {
  const supabase = publicSupabase(env);
  return supabase
    .from("community_public_posts")
    .select("slug,title,body_text,category_slug,category_name,author_nickname,created_at,updated_at,comment_count")
    .eq("slug", slug)
    .maybeSingle();
}

export async function onRequestGet(context) {
  const slug = context.params.slug;
  if (!validSlug(slug)) return errorResponse(404, "NOT_FOUND", "게시물을 찾을 수 없습니다.");

  try {
    const { data, error } = await publicPostBySlug(context.env, slug);
    if (error) throw error;
    if (!data) return errorResponse(404, "NOT_FOUND", "게시물을 찾을 수 없습니다.");

    return Response.json({ post: toPublicPost(data) }, {
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=30",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("community post detail failed", error instanceof Error ? error.message : "unknown");
    return errorResponse(503, "UNAVAILABLE", "게시물을 불러올 수 없습니다.");
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
    const captchaError = await verifyTurnstile(context, payload?.captchaToken);
    if (captchaError) return captchaError;
    const rateLimitError = await enforceDatabaseRateLimit(context, "post-update", auth.user.id, 10, 600);
    if (rateLimitError) return rateLimitError;

    const { data: category, error: categoryError } = await auth.client
      .from("community_categories")
      .select("id")
      .eq("slug", input.categorySlug)
      .eq("is_active", true)
      .maybeSingle();
    if (categoryError || !category) return errorResponse(400, "VALIDATION_ERROR", "현재 작성할 수 없는 게시판입니다.");

    const { data, error } = await auth.client
      .from("community_posts")
      .update({ category_id: category.id, title: input.title, body_text: input.bodyText })
      .eq("slug", slug)
      .select("slug");
    if (error) throw error;

    const outcome = mutationOutcome((data?.length ?? 0) === 1, Boolean((await publicPostBySlug(context.env, slug)).data));
    if (outcome === "forbidden") return errorResponse(403, "FORBIDDEN", "본인이 작성한 게시물만 수정할 수 있습니다.");
    if (outcome === "not_found") return errorResponse(404, "NOT_FOUND", "게시물을 찾을 수 없습니다.");

    return jsonResponse({ post: { slug } });
  } catch (error) {
    if (error instanceof CommunityValidationError) return errorResponse(400, "VALIDATION_ERROR", error.message);
    console.error("community post update failed", error instanceof Error ? error.message : "unknown");
    return errorResponse(503, "UNAVAILABLE", "게시물을 수정할 수 없습니다.");
  }
}

export async function onRequestDelete(context) {
  const slug = context.params.slug;
  if (!validSlug(slug)) return errorResponse(404, "NOT_FOUND", "게시물을 찾을 수 없습니다.");

  const auth = await authenticatedSupabase(context);
  if (auth.error) return auth.error;

  try {
    const rateLimitError = await enforceDatabaseRateLimit(context, "post-delete", auth.user.id, 5, 600);
    if (rateLimitError) return rateLimitError;

    const { data, error } = await auth.client
      .from("community_posts")
      .update({ deleted_at: new Date().toISOString(), deletion_requested_at: new Date().toISOString() })
      .eq("slug", slug)
      .select("slug");
    if (error) throw error;

    const outcome = mutationOutcome((data?.length ?? 0) === 1, Boolean((await publicPostBySlug(context.env, slug)).data));
    if (outcome === "forbidden") return errorResponse(403, "FORBIDDEN", "본인이 작성한 게시물만 삭제할 수 있습니다.");
    if (outcome === "not_found") return errorResponse(404, "NOT_FOUND", "게시물을 찾을 수 없습니다.");

    return jsonResponse({ deleted: true });
  } catch (error) {
    console.error("community post deletion failed", error instanceof Error ? error.message : "unknown");
    return errorResponse(503, "UNAVAILABLE", "게시물을 삭제할 수 없습니다.");
  }
}
