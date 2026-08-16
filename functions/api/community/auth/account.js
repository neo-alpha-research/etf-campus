import { adminSupabase, authenticatedSupabase } from "../_lib/supabase";
import { enforceDatabaseRateLimit, parseJsonBody } from "../_lib/request-security";
import { clearSessionResponse } from "../_lib/session";
import { errorResponse, jsonResponse } from "../_lib/api-security";
import { CommunityValidationError, validateWithdrawalDisposition } from "../_lib/contracts";

export async function onRequestPost(context) {
  const auth = await authenticatedSupabase(context);
  if (auth.error) return auth.error;
  try { await auth.client.auth.signOut({ scope: "global" }); } catch { /* Browser cookies are still explicitly cleared. */ }
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
    if (!requestId) return errorResponse(503, "UNAVAILABLE", "?ˆí‡´ ?”ì²­??ì²˜ë¦¬?????†ìŠµ?ˆë‹¤. ? ì‹œ ???¤ì‹œ ?œë„??ì£¼ì„¸??");

    const admin = adminSupabase(context.env);
    const { error: deletionError } = await admin.auth.admin.deleteUser(auth.user.id);
    if (deletionError) {
      const marker = await admin.rpc("mark_community_withdrawal_auth_failed", { p_request_id: requestId });
      if (marker.error || marker.data !== true) console.error("community withdrawal failure marker could not be saved");
      return errorResponse(503, "UNAVAILABLE", "?ˆí‡´ ?”ì²­??ê¸°ë¡?ˆìŠµ?ˆë‹¤. ê³„ì • ?? œë¥??¤ì‹œ ?œë„?????ˆë„ë¡??´ì˜?€???•ì¸?©ë‹ˆ??");
    }

    const marker = await admin.rpc("mark_community_withdrawal_auth_deleted", { p_request_id: requestId });
    if (marker.error || marker.data !== true) {
      console.error("community withdrawal completion marker could not be saved");
      return clearSessionResponse(errorResponse(503, "UNAVAILABLE", "ê³„ì • ?? œ???„ë£Œ?ì?ë§?ì²˜ë¦¬ ?íƒœ ?•ì¸???„ìš”?©ë‹ˆ?? ?´ì˜?€???•ì¸?©ë‹ˆ??"));
    }
    return clearSessionResponse(jsonResponse({ deleted: true, contentDisposition: disposition }));
  } catch (error) {
    if (error instanceof CommunityValidationError) return errorResponse(400, "VALIDATION_ERROR", error.message);
    return errorResponse(503, "UNAVAILABLE", "?ˆí‡´ ?”ì²­??ì²˜ë¦¬?????†ìŠµ?ˆë‹¤. ? ì‹œ ???¤ì‹œ ?œë„??ì£¼ì„¸??");
  }
}
