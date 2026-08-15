import { adminSupabase } from "./supabase";
import { errorResponse } from "../../../../lib/community/api-security";

function textEncoder() {
  return new TextEncoder();
}

function bytesToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function stableRateLimitKey(env, scope, subject) {
  const salt = env.COMMUNITY_RATE_LIMIT_SALT;
  if (!salt || typeof salt !== "string") {
    throw new Error("Missing required environment variable: COMMUNITY_RATE_LIMIT_SALT");
  }
  const source = `${scope}:${subject}:${salt}`;
  const digest = await crypto.subtle.digest("SHA-256", textEncoder().encode(source));
  return `${scope}:${bytesToHex(digest)}`;
}

export async function enforceDatabaseRateLimit(context, scope, subject, limit, windowSeconds) {
  let bucketKey;
  try {
    bucketKey = await stableRateLimitKey(context.env, scope, subject);
    const admin = adminSupabase(context.env);
    const { data, error } = await admin.rpc("consume_community_rate_limit", {
      p_bucket_key: bucketKey,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) throw error;
    if (data !== true) {
      return errorResponse(429, "RATE_LIMITED", "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");
    }
  } catch (error) {
    console.error("community rate limit configuration error", error instanceof Error ? error.message : "unknown");
    return errorResponse(503, "CONFIGURATION_ERROR", "보안 설정을 확인해 주세요.");
  }
  return null;
}

export async function verifyTurnstile(context, token) {
  if (context.env.TURNSTILE_REQUIRED !== "true") return null;

  const secret = context.env.TURNSTILE_SECRET_KEY;
  if (!secret || typeof secret !== "string") {
    return errorResponse(503, "CONFIGURATION_ERROR", "CAPTCHA 보안 설정을 확인해 주세요.");
  }
  if (!token || typeof token !== "string") {
    return errorResponse(400, "CAPTCHA_REQUIRED", "보안 확인을 완료해 주세요.");
  }

  const formData = new FormData();
  formData.set("secret", secret);
  formData.set("response", token);
  const remoteIp = context.request.headers.get("CF-Connecting-IP");
  if (remoteIp) formData.set("remoteip", remoteIp);

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
    });
    const result = await response.json();
    if (!response.ok || result.success !== true) {
      return errorResponse(400, "CAPTCHA_REQUIRED", "보안 확인에 실패했습니다. 다시 시도해 주세요.");
    }
  } catch {
    return errorResponse(503, "UNAVAILABLE", "보안 확인 서비스를 일시적으로 사용할 수 없습니다.");
  }

  return null;
}

export function parseJsonBody(request) {
  return request.json().catch(() => null);
}
