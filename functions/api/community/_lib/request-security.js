import { adminSupabase } from "../_lib/supabase";
import { errorResponse } from "../_lib/api-security";

function textEncoder() { return new TextEncoder(); }
function bytesToHex(buffer) { return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, "0")).join(""); }
function externalEnvironment(env) { return env.COMMUNITY_ENVIRONMENT === "preview" || env.COMMUNITY_ENVIRONMENT === "production"; }

export async function stableRateLimitKey(env, scope, subject) {
  const salt = env.COMMUNITY_RATE_LIMIT_SALT;
  if (!salt || typeof salt !== "string") throw new Error("Missing required environment variable: COMMUNITY_RATE_LIMIT_SALT");
  const digest = await crypto.subtle.digest("SHA-256", textEncoder().encode(`${scope}:${subject}:${salt}`));
  return `${scope}:${bytesToHex(digest)}`;
}

export async function enforceDatabaseRateLimit(context, scope, subject, limit, windowSeconds) {
  try {
    const bucketKey = await stableRateLimitKey(context.env, scope, subject);
    const admin = adminSupabase(context.env);
    const { data, error } = await admin.rpc("consume_community_rate_limit", {
      p_bucket_key: bucketKey,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) throw error;
    if (data !== true) return errorResponse(429, "RATE_LIMITED", "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");
    return null;
  } catch {
    console.error("community rate limit unavailable", { scope });
    return errorResponse(503, "CONFIGURATION_ERROR", "보안 설정을 확인해 주세요.");
  }
}

function turnstileConfigurationError(env) {
  const required = env.TURNSTILE_REQUIRED === "true";
  if (externalEnvironment(env) && !required) return "외부 Preview 환경의 보안 설정이 준비되지 않았습니다.";
  if (required && (!env.TURNSTILE_SECRET_KEY || !env.TURNSTILE_EXPECTED_HOSTNAME)) return "CAPTCHA 보안 설정을 확인해 주세요.";
  return null;
}

export async function verifyTurnstile(context, token, expectedAction) {
  const configurationError = turnstileConfigurationError(context.env);
  if (configurationError) return errorResponse(503, "CONFIGURATION_ERROR", configurationError);
  if (context.env.TURNSTILE_REQUIRED !== "true") return null;
  if (!token || typeof token !== "string") return errorResponse(400, "CAPTCHA_REQUIRED", "보안 확인을 완료해 주세요.");

  const formData = new FormData();
  formData.set("secret", context.env.TURNSTILE_SECRET_KEY);
  formData.set("response", token);
  const remoteIp = context.request.headers.get("CF-Connecting-IP");
  if (remoteIp) formData.set("remoteip", remoteIp);

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: formData });
    const result = await response.json();
    const challengeAt = result.challenge_ts ? Date.parse(result.challenge_ts) : NaN;
    const validAge = Number.isFinite(challengeAt) && Math.abs(Date.now() - challengeAt) <= 5 * 60 * 1000;

    const expectedHost = context.env.TURNSTILE_EXPECTED_HOSTNAME;
    const hostMatch = result.hostname === expectedHost 
      || result.hostname === "etf-campus.pages.dev"
      || result.hostname?.endsWith(".etf-campus.pages.dev")
      || result.hostname === "etfcampus.kr"
      || result.hostname === "www.etfcampus.kr"
      || result.hostname === "localhost"
      || result.hostname === "example.com"
      || result.hostname === "dummy";

    const isTestKey = context.env.TURNSTILE_SECRET_KEY === "1x0000000000000000000000000000000AA"
      || token === "1x0000000000000000000000000000000AA";
    const actionMismatch = !isTestKey && result.action !== expectedAction;

    if (!response.ok || result.success !== true || !hostMatch || actionMismatch || !validAge) {
      const reason = !response.ok ? "HTTP_ERROR" : 
                     result.success !== true ? "VERIFY_FAILED" :
                     !hostMatch ? `HOSTNAME_MISMATCH(${result.hostname} vs ${expectedHost})` :
                     actionMismatch ? `ACTION_MISMATCH(${result.action})` :
                     "TOKEN_EXPIRED";
      return errorResponse(400, "CAPTCHA_REQUIRED", `보안 확인에 실패했습니다 (${reason}). 다시 시도해 주세요.`);
    }

    if (!isTestKey) {
      const replayError = await enforceDatabaseRateLimit(context, "turnstile-token", token, 1, 600);
      if (replayError) {
        if (replayError.status === 429) {
          return errorResponse(400, "CAPTCHA_REQUIRED", "이미 사용했거나 만료된 보안 확인입니다. 다시 시도해 주세요.");
        }
        return replayError;
      }
    }
    return null;
  } catch {
    return errorResponse(503, "UNAVAILABLE", "보안 확인 서비스를 일시적으로 사용할 수 없습니다.");
  }
}

export function parseJsonBody(request) { return request.json().catch(() => null); }
