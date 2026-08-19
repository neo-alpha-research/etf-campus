import { publicSupabase } from "../_lib/supabase";
import { parseJsonBody } from "../_lib/request-security";
import { errorResponse } from "../_lib/api-security";
import { sessionHeaders } from "../_lib/session";

export async function onRequestPost(context) {
  const payload = await parseJsonBody(context.request);
  const password = typeof payload?.password === "string" ? payload.password : "";
  const tempAccessToken = typeof payload?.tempAccessToken === "string" ? payload.tempAccessToken : "";
  const tempRefreshToken = typeof payload?.tempRefreshToken === "string" ? payload.tempRefreshToken : "";

  if (password.length < 8) return errorResponse(400, "VALIDATION_ERROR", "비밀번호는 최소 8자리 이상이어야 합니다.");
  if (!tempAccessToken || !tempRefreshToken) return errorResponse(401, "AUTH_REQUIRED", "세션이 만료되었습니다. 다시 시도해 주세요.");

  try {
    const supabase = publicSupabase(context.env, tempAccessToken);
    const { data, error } = await supabase.auth.updateUser({ password });
    if (error || !data.user) {
      return errorResponse(400, "VALIDATION_ERROR", "비밀번호 설정에 실패했습니다.");
    }

    const session = { access_token: tempAccessToken, refresh_token: tempRefreshToken };
    const headers = sessionHeaders(session);

    return new Response(JSON.stringify({ authenticated: true }), { status: 200, headers });
  } catch {
    return errorResponse(503, "UNAVAILABLE", "서비스를 일시적으로 사용할 수 없습니다.");
  }
}
