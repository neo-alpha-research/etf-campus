import { publicSupabase, adminSupabase } from "./supabase";
import { errorResponse } from "../_lib/api-security";

const ACCESS_COOKIE = "__Host-etf-campus-community-at";
const REFRESH_COOKIE = "__Host-etf-campus-community-rt";
const CSRF_COOKIE = "__Host-etf-campus-community-csrf";
const RM_COOKIE = "__Host-etf-campus-community-rm";
const PWSETUP_COOKIE = "__Host-etf-campus-community-pwsetup";
const ACCESS_MAX_AGE = 60 * 60;
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;
const PWSETUP_MAX_AGE = 600;

export function encodeBase64Url(str) {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => String.fromCharCode('0x' + p1))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeBase64Url(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
}

function cookieMap(header) {
  return Object.fromEntries((header ?? "").split(";").map((part) => {
    const index = part.indexOf("=");
    return index < 0 ? ["", ""] : [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(([key]) => key));
}

function secureRandom() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function serializeCookie(name, value, { httpOnly = true, maxAge } = {}) {
  const directives = [`${name}=${encodeURIComponent(value)}`, "Path=/", "Secure", "SameSite=Lax"];
  if (typeof maxAge === "number") directives.push(`Max-Age=${maxAge}`);
  if (httpOnly) directives.push("HttpOnly");
  return directives.join("; ");
}

function expiredCookie(name, { httpOnly = true } = {}) {
  return serializeCookie(name, "", { httpOnly, maxAge: 0 });
}

function cacheHeaders(csrfToken) {
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    Pragma: "no-cache",
    Vary: "Cookie, Origin",
    "X-Content-Type-Options": "nosniff",
  });
  if (csrfToken) headers.set("X-Community-CSRF", csrfToken);
  return headers;
}

function appendCookies(headers, cookies) {
  for (const value of cookies) headers.append("Set-Cookie", value);
  return headers;
}

function sessionCookies(session, csrfToken, rememberMe = true) {
  const maxAge = rememberMe ? REFRESH_MAX_AGE : undefined;
  return [
    serializeCookie(ACCESS_COOKIE, session.access_token, { maxAge: ACCESS_MAX_AGE }),
    serializeCookie(REFRESH_COOKIE, session.refresh_token, { maxAge }),
    serializeCookie(CSRF_COOKIE, csrfToken, { httpOnly: false, maxAge }),
    serializeCookie(RM_COOKIE, rememberMe ? "1" : "0", { httpOnly: true, maxAge }),
  ];
}

export function sessionHeaders(session, csrfToken = secureRandom(), rememberMe = true) {
  return appendCookies(cacheHeaders(csrfToken), sessionCookies(session, csrfToken, rememberMe));
}

export function clearSessionHeaders() {
  return appendCookies(cacheHeaders(), [
    expiredCookie(ACCESS_COOKIE),
    expiredCookie(REFRESH_COOKIE),
    expiredCookie(CSRF_COOKIE, { httpOnly: false }),
    expiredCookie(RM_COOKIE),
  ]);
}

export function passwordSetupHeaders(session, { rememberMe, csrfToken }) {
  const value = encodeBase64Url(JSON.stringify({ accessToken: session.access_token, rememberMe }));
  const token = csrfToken ?? secureRandom();
  return appendCookies(cacheHeaders(token), [
    serializeCookie(PWSETUP_COOKIE, value, { maxAge: PWSETUP_MAX_AGE }),
    serializeCookie(CSRF_COOKIE, token, { httpOnly: false, maxAge: PWSETUP_MAX_AGE }),
  ]);
}

export function readPasswordSetup(request) {
  try {
    const values = cookieMap(request.headers.get("Cookie"));
    const cookie = values[PWSETUP_COOKIE];
    if (!cookie) return null;
    return JSON.parse(decodeBase64Url(cookie));
  } catch {
    return null;
  }
}

export function clearPasswordSetupHeaders() {
  return appendCookies(cacheHeaders(), [
    expiredCookie(PWSETUP_COOKIE),
  ]);
}

function responseWithHeaders(response, headers, cookies = []) {
  const merged = new Headers(response.headers);
  for (const [key, value] of headers.entries()) merged.set(key, value);
  appendCookies(merged, cookies);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: merged });
}

export function mergeSessionHeaders(response, session) {
  return responseWithHeaders(response, session?.headers ?? cacheHeaders(), session?.cookies ?? []);
}

export function clearSessionResponse(response) {
  const clearHeaders = clearSessionHeaders();
  const cookies = [
    expiredCookie(ACCESS_COOKIE),
    expiredCookie(REFRESH_COOKIE),
    expiredCookie(CSRF_COOKIE, { httpOnly: false }),
    expiredCookie(RM_COOKIE),
  ];
  const base = new Headers(clearHeaders);
  base.delete("Set-Cookie");
  return responseWithHeaders(response, base, cookies);
}

export function requestCsrfToken(request) {
  return cookieMap(request.headers.get("Cookie"))[CSRF_COOKIE] ?? null;
}

export function enforceCsrf(context) {
  const expected = requestCsrfToken(context.request);
  const supplied = context.request.headers.get("X-Community-CSRF");
  if (!expected || !supplied || expected.length !== supplied.length) return errorResponse(403, "FORBIDDEN", "요청 보안 확인에 실패했습니다. 페이지를 새로고침하여 다시 시도해 주세요.");
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) mismatch |= expected.charCodeAt(index) ^ supplied.charCodeAt(index);
  return mismatch === 0 ? null : errorResponse(403, "FORBIDDEN", "요청 보안 확인에 실패했습니다. 페이지를 새로고침하여 다시 시도해 주세요.");
}


export function requestSessionTokens(request) {
  const values = cookieMap(request.headers.get("Cookie"));
  return { accessToken: values[ACCESS_COOKIE] ?? null, refreshToken: values[REFRESH_COOKIE] ?? null, rememberMe: values[RM_COOKIE] !== "0" };
}

async function refreshSupabaseSession(env, refreshToken) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return { data: null, error: { message: "Supabase configuration is missing" } };
  try {
    const response = await fetch(new URL("/auth/v1/token?grant_type=refresh_token", env.SUPABASE_URL), {
      method: "POST",
      headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const data = await response.json().catch(() => null);
    return response.ok ? { data: { session: data }, error: null } : { data: null, error: data ?? { message: "Session refresh failed" } };
  } catch {
    return { data: null, error: { message: "Session refresh failed" } };
  }
}

function clearedAuthError() {
  return clearSessionResponse(errorResponse(401, "AUTH_REQUIRED", "로그인 상태가 만료되었거나 유효하지 않습니다."));
}


export async function authenticatedSession(context) {
  const { accessToken, refreshToken, rememberMe } = requestSessionTokens(context.request);
  const csrfToken = requestCsrfToken(context.request) ?? secureRandom();
  const maxAge = rememberMe ? REFRESH_MAX_AGE : undefined;
  const csrfCookies = requestCsrfToken(context.request) ? [] : [serializeCookie(CSRF_COOKIE, csrfToken, { httpOnly: false, maxAge })];

  if (accessToken) {
    try {
      const client = publicSupabase(context.env, accessToken);
      const result = await client.auth.getUser(accessToken);
      if (!result.error && result.data.user) {
        return { client, user: result.data.user, accessToken, headers: cacheHeaders(csrfToken), cookies: csrfCookies };
      }
    } catch {
      return { error: errorResponse(503, "CONFIGURATION_ERROR", "인증 서비스 설정을 확인해 주세요.") };
    }
  }

  if (!refreshToken) return { error: clearedAuthError() };

  const refreshed = await refreshSupabaseSession(context.env, refreshToken);
  if (refreshed.error || !refreshed.data.session?.access_token || !refreshed.data.session?.refresh_token) return { error: clearedAuthError() };
  
  try {
    const client = publicSupabase(context.env, refreshed.data.session.access_token);
    const result = await client.auth.getUser(refreshed.data.session.access_token);
    if (result.error || !result.data.user) return { error: clearedAuthError() };
    return {
      client,
      user: result.data.user,
      accessToken: refreshed.data.session.access_token,
      headers: cacheHeaders(csrfToken),
      cookies: sessionCookies(refreshed.data.session, csrfToken, rememberMe),
    };
  } catch {
    return { error: errorResponse(503, "CONFIGURATION_ERROR", "인증 서비스 설정을 확인해 주세요.") };
  }
}

export async function getProfileStatus(env, userId) {
  const admin = adminSupabase(env);
  const { data, error } = await admin
    .from("user_profiles")
    .select("public_nickname, terms_version")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("getProfileStatus query error:", error);
    throw new Error("Failed to query user profile");
  }

  const hasNickname = Boolean(
    data?.public_nickname &&
    typeof data.public_nickname === "string" &&
    data.public_nickname.trim().length >= 2 &&
    data.public_nickname.trim().length <= 24
  );

  const hasTermsConsent = Boolean(
    data?.terms_version &&
    typeof data.terms_version === "string" &&
    data.terms_version.trim().length > 0
  );

  return {
    hasNickname,
    hasTermsConsent,
    profileConfigured: hasNickname && hasTermsConsent,
    nickname: data?.public_nickname ?? null,
    termsVersion: data?.terms_version ?? null,
  };
}

export async function checkProfileConfigured(env, userId) {
  const status = await getProfileStatus(env, userId);
  return status.profileConfigured;
}

export const COMMUNITY_SESSION_COOKIE_NAMES = { ACCESS_COOKIE, REFRESH_COOKIE, CSRF_COOKIE, RM_COOKIE, PWSETUP_COOKIE };
