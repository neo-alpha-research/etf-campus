import { adminSupabase, authenticatedSupabase } from "../_lib/supabase";
import { enforceDatabaseRateLimit, parseJsonBody } from "../_lib/request-security";
import { errorResponse, jsonResponse } from "../../../../lib/community/api-security";
import { CommunityValidationError, validateWithdrawalDisposition } from "../../../../lib/community/contracts";

export async function onRequestPost(context) {
  const auth = await authenticatedSupabase(context);
  if (auth.error) return auth.error;

  try {
    await auth.client.auth.signOut({ scope: "global" });
  } catch {
    // The browser will also clear its locally held token. Do not leak session internals.
  }

  return jsonResponse({ signedOut: true });
}

export async function onRequestDelete(context) {
  const auth = await authenticatedSupabase(context);
  if (auth.error) return auth.error;
  const payload = await parseJsonBody(context.request);

  try {
    const disposition = validateWithdrawalDisposition(payload?.contentDisposition);
    const rateLimitError = await enforceDatabaseRateLimit(context, "withdrawal", auth.user.id, 2, 3600);
    if (rateLimitError) return rateLimitError;

    const { error: preparationError } = await auth.client.rpc("prepare_community_withdrawal", {
      p_disposition: disposition,
    });
    if (preparationError) throw preparationError;

    const admin = adminSupabase(context.env);
    const { error: deletionError } = await admin.auth.admin.deleteUser(auth.user.id);
    if (deletionError) throw deletionError;

    return jsonResponse({
      deleted: true,
      contentDisposition: disposition,
      message: "탈퇴 요청을 처리했습니다. 브라우저의 로그인 정보도 삭제해 주세요.",
    });
  } catch (error) {
    if (error instanceof CommunityValidationError) {
      return errorResponse(400, "VALIDATION_ERROR", error.message);
    }
    console.error("community account deletion failed", error instanceof Error ? error.message : "unknown");
    return errorResponse(503, "UNAVAILABLE", "탈퇴 요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.");
  }
}
