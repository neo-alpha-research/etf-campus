import { publicSupabase } from "../_lib/supabase";
import { parseJsonBody, verifyTurnstile, enforceDatabaseRateLimit } from "../_lib/request-security";
import { errorResponse, jsonResponse } from "../_lib/api-security";
import { sessionHeaders, readPasswordSetup, clearPasswordSetupHeaders } from "../_lib/session";

export async function onRequestPost(context) {
  const payload = await parseJsonBody(context.request);
  const password = typeof payload?.password === "string" ? payload.password : "";

  if (password.length < 8) return errorResponse(400, "VALIDATION_ERROR", "비밀번호는 최소 8자리 이상이어야 합니다.");

  const setupData = readPasswordSetup(context.request);
  if (!setupData) return errorResponse(401, "AUTH_REQUIRED", "세션이 만료되었습니다. 다시 시도해 주세요.");

  const captchaError = await verifyTurnstile(context, payload?.captchaToken, "community_password_set");
  if (captchaError) return captchaError;

  const ipLimit = await enforceDatabaseRateLimit(context, "password-set-ip", context.request.headers.get("CF-Connecting-IP") ?? "unknown", 10, 600);
  if (ipLimit) return ipLimit;

  const cookieHeader = context.request.headers.get("Cookie") || "";
  const match = cookieHeader.match(/__Host-etf-campus-community-pwsetup=([^;]+)/);
  const tokenString = match ? match[1] : "";
  const tokenLimit = await enforceDatabaseRateLimit(context, "password-set-token", tokenString, 1, 600);
  if (tokenLimit) {
    let response = tokenLimit;
    if (tokenLimit.status === 429) {
      response = errorResponse(429, "RATE_LIMITED", "이미 사용한 인증입니다. 처음부터 다시 시도해 주세요.");
    }
    const clearHeaders = clearPasswordSetupHeaders();
    for (const value of clearHeaders.getSetCookie()) response.headers.append("Set-Cookie", value);
    return response;
  }

  try {
    const supabase = publicSupabase(context.env, setupData.accessToken);
    const { data: updateData, error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError || !updateData.user) {
      console.error("Set password error:", { code: updateError?.code, status: updateError?.status });
      let errorMessage = updateError?.message || updateError?.msg || updateError?.error_description || "비밀번호 설정에 실패했습니다.";
      if (errorMessage.includes("different from the old password")) {
        errorMessage = "새 비밀번호는 기존 비밀번호와 다르게 설정해야 합니다.";
      } else if (errorMessage.includes("Password should be at least")) {
        errorMessage = "비밀번호는 최소 8자리 이상이어야 합니다.";
      } else if (errorMessage.includes("Weak password")) {
        errorMessage = "보안을 위해 더 안전한 비밀번호를 설정해 주세요.";
      } else if (errorMessage.toLowerCase().includes("jwt") || errorMessage.toLowerCase().includes("token")) {
        errorMessage = "보안 세션이 만료되었습니다. 인증을 다시 진행해 주세요.";
      }
      const response = errorResponse(400, "VALIDATION_ERROR", errorMessage);
      const clearHeaders = clearPasswordSetupHeaders();
      for (const value of clearHeaders.getSetCookie()) response.headers.append("Set-Cookie", value);
      return response;
    }

    const email = updateData.user.email;
    await supabase.auth.signOut({ scope: "global" });

    const newSupabase = publicSupabase(context.env);
    const { data: signInData, error: signInError } = await newSupabase.auth.signInWithPassword({ email, password });
    
    if (signInError || !signInData.session) {
      const clearHeaders = clearPasswordSetupHeaders();
      const response = jsonResponse(
        { error: { code: "UNAVAILABLE", message: "비밀번호는 정상 변경되었습니다. 새 비밀번호로 다시 로그인해 주세요." }, passwordChanged: true },
        503
      );
      for (const value of clearHeaders.getSetCookie()) response.headers.append("Set-Cookie", value);
      return response;
    }

    const headers = sessionHeaders(signInData.session, undefined, setupData.rememberMe);
    const clearHeaders = clearPasswordSetupHeaders();
    for (const value of clearHeaders.getSetCookie()) headers.append("Set-Cookie", value);

    return new Response(JSON.stringify({ authenticated: true }), { status: 200, headers });
  } catch (err) {
    const response = errorResponse(503, "UNAVAILABLE", "서비스를 일시적으로 사용할 수 없습니다.");
    const clearHeaders = clearPasswordSetupHeaders();
    for (const value of clearHeaders.getSetCookie()) response.headers.append("Set-Cookie", value);
    return response;
  }
}
