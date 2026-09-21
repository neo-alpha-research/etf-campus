import { publicSupabase } from "../_lib/supabase";
import { enforceDatabaseRateLimit, parseJsonBody, verifyTurnstile } from "../_lib/request-security";
import { errorResponse } from "../_lib/api-security";
import { passwordSetupHeaders, sessionHeaders, checkProfileConfigured } from "../_lib/session";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_PATTERN = /^\d{8}$/;

export async function onRequestPost(context) {
  const payload = await parseJsonBody(context.request);
  const rememberMe = payload?.rememberMe !== false;
  const email = typeof payload?.email === "string" ? payload.email.trim().toLowerCase() : "";
  const token = typeof payload?.token === "string" ? payload.token.trim() : "";
  const purpose = payload?.purpose === "reset_password" ? "reset_password" : "login";

  if (!EMAIL_PATTERN.test(email) || !OTP_PATTERN.test(token)) {
    return errorResponse(400, "VALIDATION_ERROR", "이메일과 8자리 인증 코드를 확인해 주세요.");
  }

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
    if (error || !data.session || !data.user) {
      return errorResponse(401, "AUTH_REQUIRED", "인증 코드가 올바르지 않거나 만료되었습니다. 가장 최근에 받은 8자리 코드로 다시 시도해 주세요.");
    }

    // 1. 비밀번호 재설정 명시적 요청 흐름 (Explicit Password Reset Flow)
    if (purpose === "reset_password") {
      const headers = passwordSetupHeaders(data.session, { rememberMe });
      headers.set("Content-Type", "application/json");

      return new Response(
        JSON.stringify({
          authenticated: true,
          passwordSetupRequired: true,
          isPasswordReset: true,
          user: { id: data.user.id, email: data.user.email },
        }),
        { status: 200, headers }
      );
    }

    // 2. 일반 이메일 인증 로그인 / 신규 회원가입 흐름 (Login / Signup Flow)
    const profileConfigured = await checkProfileConfigured(context.env, data.user.id);

    // Case A: 기존 가입 완료 회원 (닉네임 설정 완료) -> 완전한 세션 쿠키 발급 및 즉시 복귀
    if (profileConfigured) {
      const headers = sessionHeaders(data.session, undefined, rememberMe);
      headers.set("Content-Type", "application/json");

      return new Response(
        JSON.stringify({
          authenticated: true,
          profileConfigured: true,
          passwordSetupRequired: false,
          isNewUser: false,
          user: { id: data.user.id, email: data.user.email },
        }),
        { status: 200, headers }
      );
    }

    // Case B: 신규 회원 또는 프로필 미설정 회원 -> 비밀번호 설정 및 프로필 단계 진행
    const headers = passwordSetupHeaders(data.session, { rememberMe });
    headers.set("Content-Type", "application/json");

    return new Response(
      JSON.stringify({
        authenticated: true,
        profileConfigured: false,
        passwordSetupRequired: true,
        isNewUser: true,
        user: { id: data.user.id, email: data.user.email },
      }),
      { status: 200, headers }
    );
  } catch (err) {
    console.error("verify-otp error:", err?.message ?? String(err));
    return errorResponse(503, "UNAVAILABLE", "인증 서비스를 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.");
  }
}
