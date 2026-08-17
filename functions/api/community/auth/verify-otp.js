import { publicSupabase } from "../_lib/supabase";
import { enforceDatabaseRateLimit, parseJsonBody, verifyTurnstile } from "../_lib/request-security";
import { errorResponse } from "../_lib/api-security";
import { sessionHeaders } from "../_lib/session";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_PATTERN = /^\d{6}$/;

export async function onRequestPost(context) {
  const payload = await parseJsonBody(context.request);
  const email = typeof payload?.email === "string" ? payload.email.trim().toLowerCase() : "";
  const token = typeof payload?.token === "string" ? payload.token.trim() : "";
  if (!EMAIL_PATTERN.test(email) || !OTP_PATTERN.test(token)) return errorResponse(400, "VALIDATION_ERROR", "?´ë©”?¼ê³¼ 6?ë¦¬ ?¸ì¦ ì½”ë“œë¥??•ì¸??ì£¼ì„¸??");

  const captchaError = await verifyTurnstile(context, payload?.captchaToken, "community_otp_verify");
  if (captchaError) return captchaError;
  const emailLimit = await enforceDatabaseRateLimit(context, "otp-verify-email", email, 5, 600);
  if (emailLimit) return emailLimit;
  const ipLimit = await enforceDatabaseRateLimit(context, "otp-verify-ip", context.request.headers.get("CF-Connecting-IP") ?? "unknown", 10, 600);
  if (ipLimit) return ipLimit;

  try {
    const supabase = publicSupabase(context.env);
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    if (error || !data.session || !data.user) return errorResponse(401, "AUTH_REQUIRED", "?¸ì¦ ì½”ë“œê°€ ?¬ë°”ë¥´ì? ?Šê±°??ë§Œë£Œ?˜ì—ˆ?µë‹ˆ??");

    const headers = sessionHeaders(data.session);
    return new Response(JSON.stringify({ authenticated: true, profileConfigured: false }), { status: 200, headers });
  } catch {
    return errorResponse(503, "UNAVAILABLE", "?¸ì¦ ?œë¹„?¤ë? ?¼ì‹œ?ìœ¼ë¡??¬ìš©?????†ìŠµ?ˆë‹¤.");
  }
}
