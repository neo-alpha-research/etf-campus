import { publicSupabase } from "../_lib/supabase";
import { enforceDatabaseRateLimit, parseJsonBody, verifyTurnstile } from "../_lib/request-security";
import { errorResponse, jsonResponse } from "../_lib/api-security";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NEUTRAL_MESSAGE = "?ÖÎ†•???¥Î©î?ºÏùÑ ?ïÏù∏?????àÎäî Í≤ΩÏö∞ ?∏Ï¶ù ÏΩîÎìúÎ•?Î≥¥ÎÉà?µÎãà?? Î©îÏùº?®Í≥º ?§Ìå∏?®ÏùÑ ?ïÏù∏??Ï£ºÏÑ∏??";

export async function onRequestPost(context) {
  const payload = await parseJsonBody(context.request);
  const email = typeof payload?.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!EMAIL_PATTERN.test(email) || email.length > 254) return errorResponse(400, "VALIDATION_ERROR", "?¥Î©î??Ï£ºÏÜåÎ•??ïÏù∏??Ï£ºÏÑ∏??");

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
    return errorResponse(503, "CONFIGURATION_ERROR", "?∏Ï¶ù ?úÎπÑ???§Ï†ï???ïÏù∏??Ï£ºÏÑ∏??");
  }
  return jsonResponse({ message: NEUTRAL_MESSAGE });
}
