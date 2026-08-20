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
      console.error("Set password error:", error);
      let errorMessage = error?.message || error?.msg || error?.error_description || "비밀번호 설정에 실패했습니다.";
      if (errorMessage.includes("different from the old password")) {
        errorMessage = "새 비밀번호는 기존 비밀번호와 다르게 설정해야 합니다.";
      } else if (errorMessage.includes("Password should be at least")) {
        errorMessage = "비밀번호는 최소 8자리 이상이어야 합니다.";
      } else if (errorMessage.includes("Weak password")) {
        errorMessage = "보안을 위해 더 안전한 비밀번호를 설정해 주세요.";
      } else if (errorMessage.toLowerCase().includes("jwt") || errorMessage.toLowerCase().includes("token")) {
        errorMessage = "보안 세션이 만료되었습니다. 인증을 다시 진행해 주세요.";
      }
      return errorResponse(400, "VALIDATION_ERROR", errorMessage);
    }

    const session = { access_token: tempAccessToken, refresh_token: tempRefreshToken };
    const headers = sessionHeaders(session);

    return new Response(JSON.stringify({ authenticated: true }), { status: 200, headers });
  } catch {
    return errorResponse(503, "UNAVAILABLE", "서비스를 일시적으로 사용할 수 없습니다.");
  }
}
