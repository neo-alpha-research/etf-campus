import { publicSupabase } from "../_lib/supabase";
import { enforceDatabaseRateLimit, parseJsonBody, verifyTurnstile } from "../_lib/request-security";
import { errorResponse } from "../_lib/api-security";
import { passwordSetupHeaders } from "../_lib/session";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_PATTERN = /^\d{8}$/;

export async function onRequestPost(context) {
  const payload = await parseJsonBody(context.request);
  const rememberMe = payload?.rememberMe !== false;
  const email = typeof payload?.email === "string" ? payload.email.trim().toLowerCase() : "";
  const token = typeof payload?.token === "string" ? payload.token.trim() : "";
  if (!EMAIL_PATTERN.test(email) || !OTP_PATTERN.test(token)) return errorResponse(400, "VALIDATION_ERROR", "이메일과 8자리 인증 코드를 확인해 주세요.");

  const [captchaError, emailLimit, ipLimit] = await Promise.all([
    verifyTurnstile(context, payload?.captchaToken, "community_otp_verify"),
    enforceDatabaseRateLimit(context, "otp-verify-email", email, 5, 600),
    enforceDatabaseRateLimit(context, "otp-verify-ip", context.request.headers.get("CF-Connecting-IP") ?? "unknown", 10, 600),
  ]);

  if (captchaError) return captchaError;
  if (emailLimit) return emailLimit;
  if (ipLimit) return ipLimit;

  try {
    const supabase = publicSupabase(context.env);
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    if (error || !data.session || !data.user) return errorResponse(401, "AUTH_REQUIRED", "인증 코드가 올바르지 않거나 만료되었습니다. 가장 최근에 받은 8자리 코드로 다시 시도해 주세요.");

    const headers = passwordSetupHeaders(data.session, { rememberMe });
    headers.set("Content-Type", "application/json");

    return new Response(
      JSON.stringify({ authenticated: true, passwordSetupRequired: true }),
      { status: 200, headers }
    );
  } catch {
    return errorResponse(503, "UNAVAILABLE", "인증 서비스를 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.");
  }
}
