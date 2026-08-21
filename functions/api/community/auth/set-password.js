import { publicSupabase } from "../_lib/supabase";
import { parseJsonBody, verifyTurnstile, enforceDatabaseRateLimit } from "../_lib/request-security";
import { errorResponse, jsonResponse } from "../_lib/api-security";
import { sessionHeaders, readPasswordSetup } from "../_lib/session";

const PWSETUP_COOKIE_CLEAR = "__Host-etf-campus-community-pwsetup=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0";

function clearPwSetup(response) {
  response.headers.append("Set-Cookie", PWSETUP_COOKIE_CLEAR);
  return response;
}

export async function onRequestPost(context) {
  try {
    const payload = await parseJsonBody(context.request);
    const password = typeof payload?.password === "string" ? payload.password : "";

    if (password.length < 8) return errorResponse(400, "VALIDATION_ERROR", "비밀번호는 최소 8자리 이상이어야 합니다.");

    const setupData = readPasswordSetup(context.request);
    if (!setupData) return errorResponse(401, "AUTH_REQUIRED", "세션이 만료되었습니다. 다시 시도해 주세요.");

    const captchaError = await verifyTurnstile(context, payload?.captchaToken, "community_password_set");
    if (captchaError) return captchaError;

    const ipLimit = await enforceDatabaseRateLimit(context, "password-set-ip", context.request.headers.get("CF-Connecting-IP") ?? "unknown", 10, 600);
    if (ipLimit) return clearPwSetup(ipLimit);

    const cookieHeader = context.request.headers.get("Cookie") || "";
    const match = cookieHeader.match(/__Host-etf-campus-community-pwsetup=([^;]+)/);
    const tokenString = match ? match[1] : "";
    const tokenLimit = await enforceDatabaseRateLimit(context, "password-set-token", tokenString, 1, 600);
    if (tokenLimit) {
      const response = tokenLimit.status === 429
        ? errorResponse(429, "RATE_LIMITED", "이미 사용된 인증입니다. 처음부터 다시 시도해 주세요.")
        : tokenLimit;
      return clearPwSetup(response);
    }

    const supabase = publicSupabase(context.env, setupData.accessToken);
    const { data: updateData, error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError || !updateData.user) {
      console.error("Set password error:", { code: updateError?.code, status: updateError?.status, message: updateError?.message });
      let errorMessage = updateError?.message || "비밀번호 설정에 실패했습니다.";
      if (errorMessage.includes("different from the old password")) {
        errorMessage = "새 비밀번호는 기존 비밀번호와 달라야 설정이야 합니다.";
      } else if (errorMessage.includes("Password should be at least")) {
        errorMessage = "비밀번호는 최소 8자리 이상이어야 합니다.";
      } else if (errorMessage.includes("Weak password")) {
        errorMessage = "보안을 위해 더 안전한 비밀번호를 설정해 주세요.";
      } else if (errorMessage.toLowerCase().includes("jwt") || errorMessage.toLowerCase().includes("token")) {
        errorMessage = "보안 세션이 만료되었습니다. 인증을 다시 진행해 주세요.";
      }
      return clearPwSetup(errorResponse(400, "VALIDATION_ERROR", errorMessage));
    }

    const email = updateData.user.email;
    await supabase.auth.signOut({ scope: "global" });

    const newSupabase = publicSupabase(context.env);
    const { data: signInData, error: signInError } = await newSupabase.auth.signInWithPassword({ email, password });

    if (signInError || !signInData.session) {
      const response = jsonResponse(
        { error: { code: "UNAVAILABLE", message: "비밀번호는 정상 변경되었습니다. 새 비밀번호로 다시 로그인해 주세요." }, passwordChanged: true },
        503
      );
      return clearPwSetup(response);
    }

    const headers = sessionHeaders(signInData.session, undefined, setupData.rememberMe);
    headers.set("Content-Type", "application/json");
    headers.append("Set-Cookie", PWSETUP_COOKIE_CLEAR);

    return new Response(JSON.stringify({ authenticated: true }), { status: 200, headers });

  } catch (err) {
    console.error("set-password unhandled error:", err?.message ?? String(err));
    return errorResponse(503, "UNAVAILABLE", "서비스가 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.");
  }
}
