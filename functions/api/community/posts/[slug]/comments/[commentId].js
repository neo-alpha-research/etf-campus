import { authenticatedSupabase } from "../../../_lib/supabase";
import { enforceDatabaseRateLimit, parseJsonBody } from "../../../_lib/request-security";
import { errorResponse, jsonResponse } from "../../../_lib/api-security";
import { CommunityValidationError, validateCommentInput } from "../../../_lib/contracts";

function validUuid(value) { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function rpcError(error, action) { const message = error?.message ?? ""; if (message.includes("forbidden")) return errorResponse(403, "FORBIDDEN", `ë³¸ì¸???‘ì„±???“ê?ë§?${action}?????ˆìŠµ?ˆë‹¤.`); if (message.includes("not found")) return errorResponse(404, "NOT_FOUND", "?“ê???ì°¾ì„ ???†ìŠµ?ˆë‹¤."); return errorResponse(503, "UNAVAILABLE", `?“ê???${action}?????†ìŠµ?ˆë‹¤.`); }

export async function onRequestPatch(context) {
  const commentId = context.params.commentId;
  if (!validUuid(context.params.slug) || !validUuid(commentId)) return errorResponse(404, "NOT_FOUND", "?“ê???ì°¾ì„ ???†ìŠµ?ˆë‹¤.");
  const auth = await authenticatedSupabase(context);
  if (auth.error) return auth.error;
  const payload = await parseJsonBody(context.request);
  try {
    const input = validateCommentInput(payload);
    const rateLimitError = await enforceDatabaseRateLimit(context, "comment-update", auth.user.id, 15, 600);
    if (rateLimitError) return rateLimitError;
    const { data, error } = await auth.client.rpc("update_community_comment", { p_public_id: commentId, p_body_text: input.bodyText });
    if (error) return rpcError(error, "?˜ì •");
    return jsonResponse({ comment: { publicId: Array.isArray(data) ? data[0]?.public_id : data?.public_id } });
  } catch (error) { return error instanceof CommunityValidationError ? errorResponse(400, "VALIDATION_ERROR", error.message) : errorResponse(503, "UNAVAILABLE", "?“ê????˜ì •?????†ìŠµ?ˆë‹¤."); }
}

export async function onRequestDelete(context) {
  const commentId = context.params.commentId;
  if (!validUuid(context.params.slug) || !validUuid(commentId)) return errorResponse(404, "NOT_FOUND", "?“ê???ì°¾ì„ ???†ìŠµ?ˆë‹¤.");
  const auth = await authenticatedSupabase(context);
  if (auth.error) return auth.error;
  const rateLimitError = await enforceDatabaseRateLimit(context, "comment-delete", auth.user.id, 10, 600);
  if (rateLimitError) return rateLimitError;
  const { error } = await auth.client.rpc("soft_delete_community_comment", { p_public_id: commentId });
  if (error) return rpcError(error, "?? œ");
  return jsonResponse({ deleted: true });
}
