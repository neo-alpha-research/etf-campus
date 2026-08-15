import { publicSupabase } from "../_lib/supabase";
import { enforceDatabaseRateLimit, parseJsonBody, verifyTurnstile } from "../_lib/request-security";
import { errorResponse, jsonResponse } from "../../../../lib/community/api-security";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_PATTERN = /^\d{6}$/;

export async function onRequestPost(context) {
  const payload = await parseJsonBody(context.request);
  const email = typeof payload?.email === "string" ? payload.email.trim().toLowerCase() : "";
  const token = typeof payload?.token === "string" ? payload.token.trim() : "";

  if (!EMAIL_PATTERN.test(email) || !OTP_PATTERN.test(token)) {
    return errorResponse(400, "VALIDATION_ERROR", "이메일과 6자리 인증 코드를 확인해 주세요.");
  }

  const captchaError = await verifyTurnstile(context, payload?.captchaToken);
  if (captchaError) return captchaError;

  const rateLimitError = await enforceDatabaseRateLimit(context, "otp-verify", email, 5, 600);
  if (rateLimitError) return rateLimitError;

  try {
    const supabase = publicSupabase(context.env);
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    if (error || !data.session || !data.user) {
      return errorResponse(401, "AUTH_REQUIRED", "인증 코드가 올바르지 않거나 만료되었습니다.");
    }

    return jsonResponse({
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at,
      },
      user: {
        profileConfigured: false,
      },
    });
  } catch (error) {
    console.error("community OTP verification failed", error instanceof Error ? error.message : "unknown");
    return errorResponse(503, "UNAVAILABLE", "인증 서비스를 일시적으로 사용할 수 없습니다.");
  }
}
