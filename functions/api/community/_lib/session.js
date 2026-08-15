import { publicSupabase } from "./supabase";
import { errorResponse } from "../../../../lib/community/api-security";

const ACCESS_COOKIE = "__Host-etf-campus-community-at";
const REFRESH_COOKIE = "__Host-etf-campus-community-rt";
const CSRF_COOKIE = "__Host-etf-campus-community-csrf";
const ACCESS_MAX_AGE = 60 * 60;
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;

function cookieMap(header) {
  return Object.fromEntries((header ?? "").split(";").map((part) => {
    const index = part.indexOf("=");
    return index < 0 ? ["", ""] : [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(([key]) => key));
}

function cookie(name, value, { httpOnly = true, maxAge = REFRESH_MAX_AGE } = {}) {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; Secure; SameSite=Lax${httpOnly ? "; HttpOnly" : ""}`;
}

function expiredCookie(name, { httpOnly = true } = {}) {
  return `${name}=; Path=/; Max-Age=0; Secure; SameSite=Lax${httpOnly ? "; HttpOnly" : ""}`;
}

function secureRandom() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export function sessionHeaders(session, csrfToken = secureRandom()) {
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    "Pragma": "no-cache",
    "Vary": "Cookie, Origin",
    "X-Content-Type-Options": "nosniff",
    "X-Community-CSRF": csrfToken,
  });
  headers.append("Set-Cookie", cookie(ACCESS_COOKIE, session.access_token, { maxAge: ACCESS_MAX_AGE }));
  headers.append("Set-Cookie", cookie(REFRESH_COOKIE, session.refresh_token));
  headers.append("Set-Cookie", cookie(CSRF_COOKIE, csrfToken));
  return headers;
}

export function clearSessionHeaders() {
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    "Pragma": "no-cache",
    "Vary": "Cookie, Origin",
    "X-Content-Type-Options": "nosniff",
  });
  headers.append("Set-Cookie", expiredCookie(ACCESS_COOKIE));
  headers.append("Set-Cookie", expiredCookie(REFRESH_COOKIE));
  headers.append("Set-Cookie", expiredCookie(CSRF_COOKIE));
  return headers;
}

export function mergeSessionHeaders(response, session) {
  const headers = new Headers(response.headers);
  if (session?.headers) {
    const getSetCookie = session.headers.getSetCookie;
    const cookies = typeof getSetCookie === "function" ? getSetCookie.call(session.headers) : [session.headers.get("Set-Cookie")].filter(Boolean);
    for (const value of cookies) headers.append("Set-Cookie", value);
    for (const [key, value] of session.headers.entries()) {
      if (key.toLowerCase() !== "set-cookie") headers.set(key, value);
    }
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export function requestCsrfToken(request) {
  return cookieMap(request.headers.get("Cookie"))[CSRF_COOKIE] ?? null;
}

export function enforceCsrf(context) {
  const expected = requestCsrfToken(context.request);
  const supplied = context.request.headers.get("X-Community-CSRF");
  if (!expected || !supplied || expected.length !== supplied.length) {
    return errorResponse(403, "FORBIDDEN", "요청 보안 확인에 실패했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.");
  }
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) mismatch |= expected.charCodeAt(index) ^ supplied.charCodeAt(index);
  return mismatch === 0 ? null : errorResponse(403, "FORBIDDEN", "요청 보안 확인에 실패했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.");
}

export function requestSessionTokens(request) {
  const values = cookieMap(request.headers.get("Cookie"));
  return { accessToken: values[ACCESS_COOKIE] ?? null, refreshToken: values[REFRESH_COOKIE] ?? null };
}

async function refreshSupabaseSession(env, refreshToken) {
  const url = env.SUPABASE_URL;
  const anonKey = env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { data: null, error: { message: "Supabase configuration is missing" } };
  try {
    const response = await fetch(new URL("/auth/v1/token?grant_type=refresh_token", url), {
      method: "POST",
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const data = await response.json().catch(() => null);
    return response.ok ? { data: { session: data }, error: null } : { data: null, error: data ?? { message: "Session refresh failed" } };
  } catch (error) {
    return { data: null, error: { message: error instanceof Error ? error.message : "Session refresh failed" } };
  }
}

export async function authenticatedSession(context) {
  const { accessToken, refreshToken } = requestSessionTokens(context.request);
  if (!accessToken) return { error: errorResponse(401, "AUTH_REQUIRED", "로그인 후 이용할 수 있습니다.") };

  let client;
  try { client = publicSupabase(context.env, accessToken); } catch { return { error: errorResponse(503, "CONFIGURATION_ERROR", "인증 서비스 설정을 확인해 주세요.") }; }
  let result = await client.auth.getUser(accessToken);
  if (!result.error && result.data.user) return { client, user: result.data.user, accessToken, headers: sessionHeaders({ access_token: accessToken, refresh_token: refreshToken ?? secureRandom() }, requestCsrfToken(context.request) ?? undefined) };
  if (!refreshToken) return { error: errorResponse(401, "AUTH_REQUIRED", "로그인 상태가 만료되었거나 유효하지 않습니다.") };

  const refreshed = await refreshSupabaseSession(context.env, refreshToken);
  if (refreshed.error || !refreshed.data.session) return { error: errorResponse(401, "AUTH_REQUIRED", "로그인 상태가 만료되었거나 유효하지 않습니다.") };
  client = publicSupabase(context.env, refreshed.data.session.access_token);
  result = await client.auth.getUser(refreshed.data.session.access_token);
  if (result.error || !result.data.user) return { error: errorResponse(401, "AUTH_REQUIRED", "로그인 상태가 만료되었거나 유효하지 않습니다.") };
  return { client, user: result.data.user, accessToken: refreshed.data.session.access_token, headers: sessionHeaders(refreshed.data.session) };
}

export const COMMUNITY_SESSION_COOKIE_NAMES = { ACCESS_COOKIE, REFRESH_COOKIE, CSRF_COOKIE };
