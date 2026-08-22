import { authenticatedSupabase, publicSupabase } from "../_lib/supabase";
import { enforceDatabaseRateLimit, parseJsonBody } from "../_lib/request-security";
import { errorResponse, jsonResponse } from "../_lib/api-security";
import { CommunityValidationError, toPublicPost, validatePostInput } from "../_lib/contracts";

const LISTABLE_CATEGORY_SLUGS = new Set(["notice", "pension-etf-qna", "etf-questions", "challenge-30", "feedback"]);
const CURSOR_SLUG_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function listLimit(value) {
  const parsed = Number.parseInt(value ?? "20", 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 30) : 20;
}

function parseCursor(value) {
  if (!value) return null;
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(normalized);
    const cursor = JSON.parse(decoded);
    if (
      !cursor ||
      typeof cursor.createdAt !== "string" ||
      Number.isNaN(Date.parse(cursor.createdAt)) ||
      typeof cursor.slug !== "string" ||
      !CURSOR_SLUG_PATTERN.test(cursor.slug) ||
      typeof cursor.isPinned !== "boolean"
    ) {
      return null;
    }
    return cursor;
  } catch {
    return null;
  }
}

function serializeCursor(post) {
  return btoa(JSON.stringify({
    createdAt: post.created_at,
    slug: post.slug,
    isPinned: Boolean(post.is_pinned),
  })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const category = url.searchParams.get("category");
  const cursorValue = url.searchParams.get("cursor");
  const cursor = parseCursor(cursorValue);
  const limit = listLimit(url.searchParams.get("limit"));

  if (category && !LISTABLE_CATEGORY_SLUGS.has(category)) {
    return errorResponse(400, "VALIDATION_ERROR", "유효하지 않은 게시판입니다.");
  }
  if (cursorValue && !cursor) {
    return errorResponse(400, "VALIDATION_ERROR", "목록 커서가 올바르지 않습니다.");
  }

  try {
    const supabase = publicSupabase(context.env);
    const { data, error } = await supabase.rpc("list_community_public_posts", {
      p_category_slug: category || null,
      p_cursor_created_at: cursor?.createdAt ?? null,
      p_cursor_slug: cursor?.slug ?? null,
      p_cursor_is_pinned: cursor?.isPinned ?? null,
      p_limit: limit + 1,
    });
    if (error) throw error;

    const rows = data ?? [];
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return Response.json(
      {
        posts: page.map(toPublicPost),
        nextCursor: rows.length > limit && last ? serializeCursor(last) : null,
      },
      { headers: { "Cache-Control": "public, max-age=30, s-maxage=30", "X-Content-Type-Options": "nosniff" } },
    );
  } catch {
    return errorResponse(503, "UNAVAILABLE", "커뮤니티 글을 불러오지 못했습니다.");
  }
}

export async function onRequestPost(context) {
  const auth = await authenticatedSupabase(context);
  if (auth.error) return auth.error;
  const payload = await parseJsonBody(context.request);

  try {
    const input = validatePostInput(payload);
    const rateLimitError = await enforceDatabaseRateLimit(context, "post-create", auth.user.id, 5, 600);
    if (rateLimitError) return rateLimitError;

    const { data, error } = await auth.client.rpc("create_community_post", {
      p_category_slug: input.categorySlug,
      p_title: input.title,
      p_body_text: input.bodyText,
    });

    if (error) {
      if (error.message?.includes("member profile")) {
        return errorResponse(403, "FORBIDDEN", "닉네임 설정을 완료한 인증 회원만 글을 작성할 수 있습니다.");
      }
      throw error;
    }

    const result = Array.isArray(data) ? data[0] : data;
    return jsonResponse({ post: { slug: result?.slug } }, 201);
  } catch (error) {
    if (error instanceof CommunityValidationError) return errorResponse(400, "VALIDATION_ERROR", error.message);
    return errorResponse(503, "UNAVAILABLE", "게시물을 저장하지 못했습니다.");
  }
}
