import { adminSupabase, authenticatedSupabase } from "../_lib/supabase";
import { enforceDatabaseRateLimit, parseJsonBody } from "../_lib/request-security";
import { clearSessionHeaders } from "../_lib/session";
import { errorResponse, jsonResponse } from "../../../../lib/community/api-security";
import { CommunityValidationError, validateWithdrawalDisposition } from "../../../../lib/community/contracts";

function withClearedSession(response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of clearSessionHeaders().entries()) {
    if (key.toLowerCase() === "set-cookie") headers.append(key, value);
    else headers.set(key, value);
  }
  return new Response(response.body, { status: response.status, headers });
}

export async function onRequestPost(context) {
  const auth = await authenticatedSupabase(context);
  if (auth.error) return auth.error;
  try { await auth.client.auth.signOut({ scope: "global" }); } catch { /* Cookie revocation still prevents browser reuse. */ }
  return withClearedSession(jsonResponse({ signedOut: true }));
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

    const admin = adminSupabase(context.env);
    const { error: deletionError } = await admin.auth.admin.deleteUser(auth.user.id);
    if (deletionError) {
      await admin.rpc("mark_community_withdrawal_auth_failed", { p_request_id: requestId });
      return errorResponse(503, "UNAVAILABLE", "탈퇴 요청을 기록했습니다. 계정 삭제를 다시 시도할 수 있도록 운영팀이 확인합니다.");
    }
    await admin.rpc("mark_community_withdrawal_auth_deleted", { p_request_id: requestId });
    return withClearedSession(jsonResponse({ deleted: true, contentDisposition: disposition }));
  } catch (error) {
    if (error instanceof CommunityValidationError) return errorResponse(400, "VALIDATION_ERROR", error.message);
    return errorResponse(503, "UNAVAILABLE", "탈퇴 요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.");
  }
}
