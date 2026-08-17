import { publicSupabase } from "../_lib/supabase";
import { enforceDatabaseRateLimit, parseJsonBody, verifyTurnstile } from "../_lib/request-security";
import { errorResponse, jsonResponse } from "../../../../lib/community/api-security";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NEUTRAL_MESSAGE = "입력한 이메일을 확인할 수 있는 경우 인증 코드를 보냈습니다. 메일함과 스팸함을 확인해 주세요.";

export async function onRequestPost(context) {
  const payload = await parseJsonBody(context.request);
  const email = typeof payload?.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!EMAIL_PATTERN.test(email) || email.length > 254) return errorResponse(400, "VALIDATION_ERROR", "이메일 주소를 확인해 주세요.");

  const captchaError = await verifyTurnstile(context, payload?.captchaToken, "community_otp_request");
  if (captchaError) return captchaError;
  const emailLimit = await enforceDatabaseRateLimit(context, "otp-request-email", email, 3, 600);
  if (emailLimit) return emailLimit;
  const ipLimit = await enforceDatabaseRateLimit(context, "otp-request-ip", context.request.headers.get("CF-Connecting-IP") ?? "unknown", 10, 600);
  if (ipLimit) return ipLimit;

  try {
    const supabase = publicSupabase(context.env);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) console.error("community OTP dispatch failed");
  } catch {
    return errorResponse(503, "CONFIGURATION_ERROR", "인증 서비스 설정을 확인해 주세요.");
  }
  return jsonResponse({ message: NEUTRAL_MESSAGE });
}
