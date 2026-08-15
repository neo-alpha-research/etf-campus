import { authenticatedSupabase, publicSupabase } from "../../../_lib/supabase";
import { enforceDatabaseRateLimit, parseJsonBody, verifyTurnstile } from "../../../_lib/request-security";
import { errorResponse, jsonResponse, mutationOutcome } from "../../../../../lib/community/api-security";
import { CommunityValidationError, validateCommentInput } from "../../../../../lib/community/contracts";

function validUuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function publicCommentExists(env, postSlug, commentId) {
  const supabase = publicSupabase(env);
  const { data } = await supabase
    .from("community_public_comments")
    .select("public_id")
    .eq("post_slug", postSlug)
    .eq("public_id", commentId)
    .maybeSingle();
  return Boolean(data);
}

export async function onRequestPatch(context) {
  const postSlug = context.params.slug;
  const commentId = context.params.commentId;
  if (!validUuid(postSlug) || !validUuid(commentId)) return errorResponse(404, "NOT_FOUND", "댓글을 찾을 수 없습니다.");

  const auth = await authenticatedSupabase(context);
  if (auth.error) return auth.error;
  const payload = await parseJsonBody(context.request);

  try {
    const input = validateCommentInput(payload);
    const captchaError = await verifyTurnstile(context, payload?.captchaToken);
    if (captchaError) return captchaError;
    const rateLimitError = await enforceDatabaseRateLimit(context, "comment-update", auth.user.id, 15, 600);
    if (rateLimitError) return rateLimitError;

    const { data, error } = await auth.client
      .from("community_comments")
      .update({ body_text: input.bodyText })
      .eq("public_id", commentId)
      .select("public_id");
    if (error) throw error;

    const outcome = mutationOutcome((data?.length ?? 0) === 1, await publicCommentExists(context.env, postSlug, commentId));
    if (outcome === "forbidden") return errorResponse(403, "FORBIDDEN", "본인이 작성한 댓글만 수정할 수 있습니다.");
    if (outcome === "not_found") return errorResponse(404, "NOT_FOUND", "댓글을 찾을 수 없습니다.");

    return jsonResponse({ comment: { publicId: commentId } });
  } catch (error) {
    if (error instanceof CommunityValidationError) return errorResponse(400, "VALIDATION_ERROR", error.message);
    console.error("community comment update failed", error instanceof Error ? error.message : "unknown");
    return errorResponse(503, "UNAVAILABLE", "댓글을 수정할 수 없습니다.");
  }
}

export async function onRequestDelete(context) {
  const postSlug = context.params.slug;
  const commentId = context.params.commentId;
  if (!validUuid(postSlug) || !validUuid(commentId)) return errorResponse(404, "NOT_FOUND", "댓글을 찾을 수 없습니다.");

  const auth = await authenticatedSupabase(context);
  if (auth.error) return auth.error;

  try {
    const rateLimitError = await enforceDatabaseRateLimit(context, "comment-delete", auth.user.id, 10, 600);
    if (rateLimitError) return rateLimitError;

    const now = new Date().toISOString();
    const { data, error } = await auth.client
      .from("community_comments")
      .update({ deleted_at: now, deletion_requested_at: now })
      .eq("public_id", commentId)
      .select("public_id");
    if (error) throw error;

    const outcome = mutationOutcome((data?.length ?? 0) === 1, await publicCommentExists(context.env, postSlug, commentId));
    if (outcome === "forbidden") return errorResponse(403, "FORBIDDEN", "본인이 작성한 댓글만 삭제할 수 있습니다.");
    if (outcome === "not_found") return errorResponse(404, "NOT_FOUND", "댓글을 찾을 수 없습니다.");

    return jsonResponse({ deleted: true });
  } catch (error) {
    console.error("community comment deletion failed", error instanceof Error ? error.message : "unknown");
    return errorResponse(503, "UNAVAILABLE", "댓글을 삭제할 수 없습니다.");
  }
}
