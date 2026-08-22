import { authenticatedSupabase } from "../_lib/supabase";
import { enforceDatabaseRateLimit, parseJsonBody } from "../_lib/request-security";
import { errorResponse, jsonResponse } from "../_lib/api-security";
import { CommunityValidationError, validateContentVisibilityAction } from "../_lib/contracts";

function validUuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function moderationRpcError(error) {
  const message = error?.message ?? "";
  if (message.includes("admin role required")) return errorResponse(403, "FORBIDDEN", "관리자만 임시 숨김 또는 복원을 처리할 수 있습니다.");
  if (message.includes("target not found")) return errorResponse(404, "NOT_FOUND", "처리할 콘텐츠를 찾을 수 없습니다.");
  return null;
}

export async function onRequestPost(context) {
  const auth = await authenticatedSupabase(context);
  if (auth.error) return auth.error;
  const payload = await parseJsonBody(context.request);

  try {
    const targetType = payload?.targetType;
    const targetReference = payload?.targetReference;
    if ((targetType !== "post" && targetType !== "comment") || !validUuid(targetReference)) {
      return errorResponse(400, "VALIDATION_ERROR", "처리할 콘텐츠가 올바르지 않습니다.");
    }
    const input = validateContentVisibilityAction(payload);
    const rateLimitError = await enforceDatabaseRateLimit(context, "community-moderation-action", auth.user.id, 20, 600);
    if (rateLimitError) return rateLimitError;

    const { error } = await auth.client.rpc("set_community_content_hidden", {
      p_target_type: targetType,
      p_target_reference: targetReference,
      p_is_hidden: input.isHidden,
      p_reason: input.reason,
    });
    if (error) return moderationRpcError(error) ?? errorResponse(503, "UNAVAILABLE", "임시 숨김 상태를 변경하지 못했습니다.");

    return jsonResponse({ targetType, targetReference, isHidden: input.isHidden });
  } catch (error) {
    return error instanceof CommunityValidationError
      ? errorResponse(400, "VALIDATION_ERROR", error.message)
      : errorResponse(503, "UNAVAILABLE", "임시 숨김 상태를 변경하지 못했습니다.");
  }
}
