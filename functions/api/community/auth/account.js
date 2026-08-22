import { adminSupabase, authenticatedSupabase } from "../_lib/supabase";
import { enforceDatabaseRateLimit, parseJsonBody } from "../_lib/request-security";
import { clearSessionResponse } from "../_lib/session";
import { errorResponse, jsonResponse } from "../_lib/api-security";
import { CommunityValidationError, validateWithdrawalDisposition } from "../_lib/contracts";

export async function onRequestPost(context) {
  const auth = await authenticatedSupabase(context);
  if (auth.error) return auth.error;

  try {
    await auth.client.auth.signOut({ scope: "global" });
  } catch {
    // Browser cookies are still explicitly cleared.
  }
  return clearSessionResponse(jsonResponse({ signedOut: true }));
}

export async function onRequestDelete(context) {
  const auth = await authenticatedSupabase(context);
  if (auth.error) return auth.error;
  const payload = await parseJsonBody(context.request);

  try {
    const disposition = validateWithdrawalDisposition(payload?.contentDisposition);
    const rateLimitError = await enforceDatabaseRateLimit(context, "withdrawal", auth.user.id, 2, 3600);
    if (rateLimitError) return rateLimitError;

    const { data, error: preparationError } = await auth.client.rpc("request_community_withdrawal", { p_disposition: disposition });
    if (preparationError || !data) throw preparationError ?? new Error("withdrawal request failed");

    const requestId = Array.isArray(data) ? data[0]?.request_id : data.request_id;
    if (!requestId) return errorResponse(503, "UNAVAILABLE", "탈퇴 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");

    const admin = adminSupabase(context.env);
    const { error: deletionError } = await admin.auth.admin.deleteUser(auth.user.id);
    if (deletionError) {
      const marker = await admin.rpc("mark_community_withdrawal_auth_failed", { p_request_id: requestId });
      if (marker.error || marker.data !== true) console.error("community withdrawal failure marker could not be saved");
      return errorResponse(503, "UNAVAILABLE", "탈퇴 요청은 기록됐습니다. 계정 삭제를 다시 시도할 수 있도록 운영 상태를 확인해 주세요.");
    }

    const marker = await admin.rpc("mark_community_withdrawal_auth_deleted", { p_request_id: requestId });
    if (marker.error || marker.data !== true) {
      console.error("community withdrawal completion marker could not be saved");
      return clearSessionResponse(errorResponse(503, "UNAVAILABLE", "계정 삭제는 완료됐지만 처리 상태를 확인해야 합니다. 운영 상태를 확인해 주세요."));
    }

    return clearSessionResponse(jsonResponse({ deleted: true, contentDisposition: disposition }));
  } catch (error) {
    if (error instanceof CommunityValidationError) return errorResponse(400, "VALIDATION_ERROR", error.message);
    return errorResponse(503, "UNAVAILABLE", "탈퇴 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
}
