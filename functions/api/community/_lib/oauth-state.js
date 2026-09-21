import { decodeBase64Url, encodeBase64Url } from "./session";

export const OAUTH_STATE_COOKIE = "__Host-oauth-state";
export const OAUTH_STATE_MAX_AGE = 600; // 10 minutes

function textEncoder() {
  return new TextEncoder();
}

function bytesToHex(buffer) {
  return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function generateTxId() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export async function hashTxId(txId) {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder().encode(String(txId ?? "")));
  return bytesToHex(digest);
}

export function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function hmacSha256(secret, data) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder().encode(data));
  return bytesToHex(signature);
}

export async function signOAuthState(secret, payload) {
  if (!secret || typeof secret !== "string") {
    throw new Error("Missing OAUTH_STATE_HMAC_SECRET");
  }
  const serialized = JSON.stringify(payload);
  const encodedPayload = encodeBase64Url(serialized);
  const signature = await hmacSha256(secret, encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export async function verifyOAuthState(secret, rawCookieValue, expectedTxId) {
  if (!secret || typeof secret !== "string" || !rawCookieValue || typeof rawCookieValue !== "string") {
    return null;
  }
  const parts = rawCookieValue.split(".");
  if (parts.length !== 2) return null;
  const [encodedPayload, providedSignature] = parts;
  if (!encodedPayload || !providedSignature) return null;

  try {
    const expectedSignature = await hmacSha256(secret, encodedPayload);
    if (!constantTimeEqual(providedSignature, expectedSignature)) {
      return null;
    }

    const jsonString = decodeBase64Url(encodedPayload);
    const payload = JSON.parse(jsonString);

    if (!payload || typeof payload !== "object") return null;
    if (typeof payload.txId !== "string" || !constantTimeEqual(payload.txId, expectedTxId)) {
      return null;
    }
    if (typeof payload.expiresAt !== "number" || payload.expiresAt <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function createOAuthStateCookie(signedValue, maxAge = OAUTH_STATE_MAX_AGE) {
  return `${OAUTH_STATE_COOKIE}=${encodeURIComponent(signedValue)}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearOAuthStateCookie() {
  return `${OAUTH_STATE_COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function parseOAuthCookie(cookieHeader) {
  const cookies = Object.fromEntries(
    (cookieHeader ?? "").split(";").map((part) => {
      const index = part.indexOf("=");
      return index < 0 ? ["", ""] : [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
    }).filter(([key]) => key)
  );
  return cookies[OAUTH_STATE_COOKIE] ?? null;
}
