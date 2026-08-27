import { authenticatedSupabase } from "../../_lib/supabase";
import { enforceDatabaseRateLimit } from "../../_lib/request-security";
import { errorResponse, jsonResponse } from "../../_lib/api-security";

const SLUG_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function mapRpcError(error) {
  const message = error?.message ?? "";
  if (message.includes("authentication required")) {
    return errorResponse(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }
  if (message.includes("community member profile required") || message.includes("member profile")) {
    return errorResponse(403, "FORBIDDEN", "닉네임 설정을 완료한 인증 회원만 추천할 수 있습니다.");
  }
  if (message.includes("post not found")) {
    return errorResponse(404, "NOT_FOUND", "게시물을 찾을 수 없습니다.");
  }
  return null;
}

export async function onRequestPost(context) {
  const slug = context.params.slug;
  if (!slug || typeof slug !== "string" || !SLUG_PATTERN.test(slug)) {
    return errorResponse(404, "NOT_FOUND", "게시물을 찾을 수 없습니다.");
  }

  const auth = await authenticatedSupabase(context);
  if (auth.error) return auth.error;

  const rateLimitError = await enforceDatabaseRateLimit(context, "post-upvote", auth.user.id, 30, 60);
  if (rateLimitError) return rateLimitError;

  try {
    const { data, error } = await auth.client.rpc("toggle_community_post_upvote", {
      p_slug: slug,
    });

    if (error) {
      return mapRpcError(error) ?? errorResponse(503, "UNAVAILABLE", "추천 처리를 완료하지 못했습니다.");
    }

    const row = Array.isArray(data) ? data[0] : data;
    return jsonResponse({
      upvoteCount: row?.upvote_count ?? 0,
      isUpvoted: Boolean(row?.is_upvoted),
    });
  } catch {
    return errorResponse(503, "UNAVAILABLE", "추천 처리를 완료하지 못했습니다.");
  }
}
