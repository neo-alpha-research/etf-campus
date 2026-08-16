import { adminSupabase } from "./supabase";
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
    const { data, error } = await admin.rpc("consume_community_rate_limit", { p_bucket_key: bucketKey, p_limit: limit, p_window_seconds: windowSeconds });
    if (error) throw error;
    if (data !== true) return errorResponse(429, "RATE_LIMITED", "?îÏ≤≠???àÎ¨¥ ÎßéÏäµ?àÎã§. ?†Ïãú ???§Ïãú ?úÎèÑ??Ï£ºÏÑ∏??");
    return null;
  } catch {
    return errorResponse(503, "CONFIGURATION_ERROR", "Î≥¥Ïïà ?§Ï†ï???ïÏù∏??Ï£ºÏÑ∏??");
  }
}

function turnstileConfigurationError(env) {
  const required = env.TURNSTILE_REQUIRED === "true";
  if (externalEnvironment(env) && !required) return "?∏Î? Preview ?∏Ï¶ù Î≥¥Ïïà ?§Ï†ï??Ï§ÄÎπÑÎêòÏßÄ ?äÏïò?µÎãà??";
  if (required && (!env.TURNSTILE_SECRET_KEY || !env.TURNSTILE_EXPECTED_HOSTNAME)) return "CAPTCHA Î≥¥Ïïà ?§Ï†ï???ïÏù∏??Ï£ºÏÑ∏??";
  return null;
}

export async function verifyTurnstile(context, token, expectedAction) {
  const configurationError = turnstileConfigurationError(context.env);
  if (configurationError) return errorResponse(503, "CONFIGURATION_ERROR", configurationError);
  if (context.env.TURNSTILE_REQUIRED !== "true") return null;
  if (!token || typeof token !== "string") return errorResponse(400, "CAPTCHA_REQUIRED", "Î≥¥Ïïà ?ïÏù∏???ÑÎ£å??Ï£ºÏÑ∏??");

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
    if (!response.ok || result.success !== true || result.hostname !== context.env.TURNSTILE_EXPECTED_HOSTNAME || result.action !== expectedAction || !validAge) {
      return errorResponse(400, "CAPTCHA_REQUIRED", "Î≥¥Ïïà ?ïÏù∏???§Ìå®?àÏäµ?àÎã§. ?§Ïãú ?úÎèÑ??Ï£ºÏÑ∏??");
    }

    const replayError = await enforceDatabaseRateLimit(context, "turnstile-token", token, 1, 600);
    if (replayError) return errorResponse(400, "CAPTCHA_REQUIRED", "?¥Î? ?¨Ïö©?àÍ±∞??ÎßåÎ£å??Î≥¥Ïïà ?ïÏù∏?ÖÎãà?? ?§Ïãú ?úÎèÑ??Ï£ºÏÑ∏??");
    return null;
  } catch {
    return errorResponse(503, "UNAVAILABLE", "Î≥¥Ïïà ?ïÏù∏ ?úÎπÑ?§Î? ?ºÏãú?ÅÏúºÎ°??¨Ïö©?????ÜÏäµ?àÎã§.");
  }
}

export function parseJsonBody(request) { return request.json().catch(() => null); }
