import { publicSupabase } from "../_lib/supabase";
import { enforceDatabaseRateLimit, parseJsonBody, verifyTurnstile } from "../_lib/request-security";
import { errorResponse } from "../_lib/api-security";
import { sessionHeaders } from "../_lib/session";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function onRequestPost(context) {
  const payload = await parseJsonBody(context.request);
  const rememberMe = payload?.rememberMe !== false;
  const email = typeof payload?.email === "string" ? payload.email.trim().toLowerCase() : "";
  const password = typeof payload?.password === "string" ? payload.password : "";

  if (!EMAIL_PATTERN.test(email) || !password) return errorResponse(400, "VALIDATION_ERROR", "이메일과 비밀번호를 확인해 주세요.");

  const captchaError = await verifyTurnstile(context, payload?.captchaToken, "community_password_login");
  if (captchaError) return captchaError;

  const emailLimit = await enforceDatabaseRateLimit(context, "password-login-email", email, 10, 600);
  if (emailLimit) return emailLimit;
  const ipLimit = await enforceDatabaseRateLimit(context, "password-login-ip", context.request.headers.get("CF-Connecting-IP") ?? "unknown", 20, 600);
  if (ipLimit) return ipLimit;

  try {
    const supabase = publicSupabase(context.env);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user) {
      return errorResponse(401, "AUTH_REQUIRED", "이메일 또는 비밀번호가 올바르지 않습니다.");
    }

    const headers = sessionHeaders(data.session);
    return new Response(JSON.stringify({ authenticated: true }), { status: 200, headers });
  } catch {
    return errorResponse(503, "UNAVAILABLE", "로그인 서비스를 일시적으로 사용할 수 없습니다.");
  }
}
