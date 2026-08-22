import { authenticatedSupabase } from "../_lib/supabase";
import { enforceDatabaseRateLimit, parseJsonBody } from "../_lib/request-security";
import { errorResponse, jsonResponse } from "../_lib/api-security";
import { CommunityValidationError } from "../_lib/contracts";

function validateNotice(payload) {
  if (!payload || typeof payload !== "object") throw new CommunityValidationError("공지 입력값이 올바르지 않습니다.");
  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const bodyText = typeof payload.bodyText === "string" ? payload.bodyText.trim() : "";
  if (title.length < 2 || title.length > 120 || bodyText.length < 2 || bodyText.length > 6000) {
    throw new CommunityValidationError("공지 제목과 본문 길이를 확인해 주세요.");
  }
  if (/<\s*\/?\s*[a-z][^>]*>/i.test(title) || /<\s*\/?\s*[a-z][^>]*>/i.test(bodyText)) {
    throw new CommunityValidationError("HTML 태그는 사용할 수 없습니다.");
  }
  return { title, bodyText, isPinned: payload.isPinned !== false };
}

function adminError(error) {
  const message = error?.message ?? "";
  if (message.includes("admin role required")) return errorResponse(403, "FORBIDDEN", "커뮤니티 관리자만 공지를 변경할 수 있습니다.");
  if (message.includes("post not found")) return errorResponse(404, "NOT_FOUND", "게시물을 찾을 수 없습니다.");
  return errorResponse(503, "UNAVAILABLE", "공지 요청을 처리하지 못했습니다.");
}

export async function onRequestPost(context) {
  const auth = await authenticatedSupabase(context);
  if (auth.error) return auth.error;
  const payload = await parseJsonBody(context.request);

  try {
    const input = validateNotice(payload);
    const rateLimitError = await enforceDatabaseRateLimit(context, "community-notice-admin", auth.user.id, 10, 600);
    if (rateLimitError) return rateLimitError;
    const { data, error } = await auth.client.rpc("create_community_notice", {
      p_title: input.title,
      p_body_text: input.bodyText,
      p_is_pinned: input.isPinned,
    });
    if (error) return adminError(error);
    const result = Array.isArray(data) ? data[0] : data;
    return jsonResponse({ slug: result?.slug }, 201);
  } catch (error) {
    return error instanceof CommunityValidationError ? errorResponse(400, "VALIDATION_ERROR", error.message) : adminError(error);
  }
}

export async function onRequestPatch(context) {
  const auth = await authenticatedSupabase(context);
  if (auth.error) return auth.error;
  const payload = await parseJsonBody(context.request);
  if (typeof payload?.slug !== "string" || typeof payload?.isPinned !== "boolean") {
    return errorResponse(400, "VALIDATION_ERROR", "게시물과 고정 여부를 확인해 주세요.");
  }

  const rateLimitError = await enforceDatabaseRateLimit(context, "community-notice-admin", auth.user.id, 10, 600);
  if (rateLimitError) return rateLimitError;
  const { error } = await auth.client.rpc("set_community_post_pinned", { p_post_slug: payload.slug, p_is_pinned: payload.isPinned });
  if (error) return adminError(error);
  return jsonResponse({ pinned: payload.isPinned });
}
