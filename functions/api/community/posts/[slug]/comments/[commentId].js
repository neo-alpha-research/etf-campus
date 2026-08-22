import { authenticatedSupabase } from "../../../_lib/supabase";
import { enforceDatabaseRateLimit, parseJsonBody } from "../../../_lib/request-security";
import { errorResponse, jsonResponse } from "../../../_lib/api-security";
import { CommunityValidationError, validateCommentInput } from "../../../_lib/contracts";

function validUuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function rpcError(error, action) {
  const message = error?.message ?? "";
  if (message.includes("forbidden")) return errorResponse(403, "FORBIDDEN", `본인이 작성한 댓글만 ${action}할 수 있습니다.`);
  if (message.includes("not found")) return errorResponse(404, "NOT_FOUND", "댓글을 찾을 수 없습니다.");
  return errorResponse(503, "UNAVAILABLE", `댓글을 ${action}하지 못했습니다.`);
}

export async function onRequestPatch(context) {
  const commentId = context.params.commentId;
  if (!validUuid(context.params.slug) || !validUuid(commentId)) return errorResponse(404, "NOT_FOUND", "댓글을 찾을 수 없습니다.");

  const auth = await authenticatedSupabase(context);
  if (auth.error) return auth.error;
  const payload = await parseJsonBody(context.request);

  try {
    const input = validateCommentInput(payload);
    const rateLimitError = await enforceDatabaseRateLimit(context, "comment-update", auth.user.id, 15, 600);
    if (rateLimitError) return rateLimitError;

    const { data, error } = await auth.client.rpc("update_community_comment", { p_public_id: commentId, p_body_text: input.bodyText });
    if (error) return rpcError(error, "수정");
    return jsonResponse({ comment: { publicId: Array.isArray(data) ? data[0]?.public_id : data?.public_id } });
  } catch (error) {
    return error instanceof CommunityValidationError
      ? errorResponse(400, "VALIDATION_ERROR", error.message)
      : errorResponse(503, "UNAVAILABLE", "댓글을 수정하지 못했습니다.");
  }
}

export async function onRequestDelete(context) {
  const commentId = context.params.commentId;
  if (!validUuid(context.params.slug) || !validUuid(commentId)) return errorResponse(404, "NOT_FOUND", "댓글을 찾을 수 없습니다.");

  const auth = await authenticatedSupabase(context);
  if (auth.error) return auth.error;
  const rateLimitError = await enforceDatabaseRateLimit(context, "comment-delete", auth.user.id, 10, 600);
  if (rateLimitError) return rateLimitError;

  const { error } = await auth.client.rpc("soft_delete_community_comment", { p_public_id: commentId });
  if (error) return rpcError(error, "삭제");
  return jsonResponse({ deleted: true });
}
