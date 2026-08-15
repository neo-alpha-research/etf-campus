import { authenticatedSupabase, publicSupabase } from "../_lib/supabase";
import { enforceDatabaseRateLimit, parseJsonBody, verifyTurnstile } from "../_lib/request-security";
import { errorResponse, jsonResponse } from "../../../../lib/community/api-security";
import { CommunityValidationError, toPublicPost, validatePostInput } from "../../../../lib/community/contracts";

function listLimit(value) {
  const parsed = Number.parseInt(value ?? "20", 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 50) : 20;
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const category = url.searchParams.get("category");

  try {
    const supabase = publicSupabase(context.env);
    let query = supabase
      .from("community_public_posts")
      .select("slug,title,body_text,category_slug,category_name,author_nickname,created_at,updated_at,comment_count")
      .order("created_at", { ascending: false })
      .limit(listLimit(url.searchParams.get("limit")));

    if (category) query = query.eq("category_slug", category);
    const { data, error } = await query;
    if (error) throw error;

    return Response.json({ posts: (data ?? []).map(toPublicPost) }, {
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=30",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("community public feed failed", error instanceof Error ? error.message : "unknown");
    return errorResponse(503, "UNAVAILABLE", "커뮤니티 글을 불러올 수 없습니다.");
  }
}

export async function onRequestPost(context) {
  const auth = await authenticatedSupabase(context);
  if (auth.error) return auth.error;
  const payload = await parseJsonBody(context.request);

  try {
    const input = validatePostInput(payload);
    const captchaError = await verifyTurnstile(context, payload?.captchaToken);
    if (captchaError) return captchaError;
    const rateLimitError = await enforceDatabaseRateLimit(context, "post-create", auth.user.id, 5, 600);
    if (rateLimitError) return rateLimitError;

    const { data: category, error: categoryError } = await auth.client
      .from("community_categories")
      .select("id")
      .eq("slug", input.categorySlug)
      .eq("is_active", true)
      .maybeSingle();
    if (categoryError || !category) {
      return errorResponse(400, "VALIDATION_ERROR", "현재 작성할 수 없는 게시판입니다.");
    }

    const { data, error } = await auth.client
      .from("community_posts")
      .insert({
        category_id: category.id,
        author_profile_id: auth.user.id,
        title: input.title,
        body_text: input.bodyText,
      })
      .select("slug")
      .single();

    if (error || !data) {
      if (error?.code === "42501") {
        return errorResponse(403, "FORBIDDEN", "닉네임 설정을 완료한 인증 회원만 글을 작성할 수 있습니다.");
      }
      throw error;
    }

    return jsonResponse({ post: { slug: data.slug } }, 201);
  } catch (error) {
    if (error instanceof CommunityValidationError) {
      return errorResponse(400, "VALIDATION_ERROR", error.message);
    }
    console.error("community post creation failed", error instanceof Error ? error.message : "unknown");
    return errorResponse(503, "UNAVAILABLE", "게시물을 저장할 수 없습니다.");
  }
}
