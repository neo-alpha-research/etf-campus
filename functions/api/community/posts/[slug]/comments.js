import { authenticatedSupabase, publicSupabase } from "../../_lib/supabase";
import { enforceDatabaseRateLimit, parseJsonBody } from "../../_lib/request-security";
import { errorResponse, jsonResponse } from "../../_lib/api-security";
import { CommunityValidationError, toPublicComment, validateCommentInput } from "../../_lib/contracts";

function validSlug(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function ownCommentIds(env, authorization, postSlug) {
  const token = authorization?.match(/^Bearer\s+([^\s]+)$/i)?.[1];
  if (!token) return new Set();

  try {
    const supabase = publicSupabase(env, token);
    const { data } = await supabase.rpc("list_own_community_comment_ids", { p_post_slug: postSlug });
    return new Set((data ?? []).map((row) => row.public_id));
  } catch {
    return new Set();
  }
}

export async function onRequestGet(context) {
  const slug = context.params.slug;
  if (!validSlug(slug)) return errorResponse(404, "NOT_FOUND", "게시물을 찾을 수 없습니다.");

  try {
    const supabase = publicSupabase(context.env);
    const { data, error } = await supabase
      .from("community_public_comments")
      .select("public_id,post_slug,body_text,author_nickname,created_at,updated_at")
      .eq("post_slug", slug)
      .order("created_at", { ascending: true });
    if (error) throw error;

    const ownIds = await ownCommentIds(context.env, context.request.headers.get("authorization"), slug);
    return Response.json(
      { comments: (data ?? []).map((row) => ({ ...toPublicComment(row), canEdit: ownIds.has(row.public_id) })) },
      { headers: { "Cache-Control": "public, max-age=30, s-maxage=30", "X-Content-Type-Options": "nosniff" } },
    );
  } catch (error) {
    console.error("community comments read failed", error instanceof Error ? error.message : "unknown");
    return errorResponse(503, "UNAVAILABLE", "댓글을 불러오지 못했습니다.");
  }
}

export async function onRequestPost(context) {
  const slug = context.params.slug;
  if (!validSlug(slug)) return errorResponse(404, "NOT_FOUND", "게시물을 찾을 수 없습니다.");

  const auth = await authenticatedSupabase(context);
  if (auth.error) return auth.error;
  const payload = await parseJsonBody(context.request);

  try {
    const input = validateCommentInput(payload);
    const rateLimitError = await enforceDatabaseRateLimit(context, "comment-create", auth.user.id, 10, 600);
    if (rateLimitError) return rateLimitError;

    const { data, error } = await auth.client.rpc("create_community_comment", {
      p_post_slug: slug,
      p_body_text: input.bodyText,
    });

    if (error) {
      if (error.message.includes("member profile")) {
        return errorResponse(403, "FORBIDDEN", "닉네임 설정을 완료한 인증 회원만 댓글을 작성할 수 있습니다.");
      }
      if (error.message.includes("post not found")) return errorResponse(404, "NOT_FOUND", "게시물을 찾을 수 없습니다.");
      throw error;
    }

    const result = Array.isArray(data) ? data[0] : data;
    return jsonResponse({ comment: { publicId: result?.public_id } }, 201);
  } catch (error) {
    if (error instanceof CommunityValidationError) return errorResponse(400, "VALIDATION_ERROR", error.message);
    console.error("community comment creation failed", error instanceof Error ? error.message : "unknown");
    return errorResponse(503, "UNAVAILABLE", "댓글을 저장하지 못했습니다.");
  }
}
