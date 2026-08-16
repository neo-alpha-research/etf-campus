import { errorResponse } from "./_lib/api-security";
import { authenticatedSession, enforceCsrf, mergeSessionHeaders, requestSessionTokens } from "./_lib/session";

const UNSAFE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);
const OTP_PATHS = new Set(["/api/community/auth/request-otp", "/api/community/auth/verify-otp"]);

function isSameOrigin(request) {
  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get("Origin");
  if (origin) return origin === requestOrigin;
  const referer = request.headers.get("Referer");
  if (!referer) return false;
  try { return new URL(referer).origin === requestOrigin; } catch { return false; }
}

function needsAuthentication(pathname, method) {
  if (pathname === "/api/community/auth/session" && method === "GET") return false;
  if (OTP_PATHS.has(pathname)) return false;
  if (pathname === "/api/community/posts" && method === "GET") return false;
  if (method === "GET" && /^\/api\/community\/posts\/[0-9a-f-]+(?:\/comments)?$/i.test(pathname)) return false;
  return true;
}

export async function onRequest(context) {
  const method = context.request.method.toUpperCase();
  const pathname = new URL(context.request.url).pathname;
  const unsafe = UNSAFE_METHODS.has(method);

  if (unsafe) {
    if (!isSameOrigin(context.request)) return errorResponse(403, "FORBIDDEN", "?ˆìš©?˜ì? ?Šì? ?”ì²­ ì¶œì²˜?…ë‹ˆ??");
    if (!context.request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) return errorResponse(415, "VALIDATION_ERROR", "JSON ?”ì²­ë§??ˆìš©?©ë‹ˆ??");
    if (!OTP_PATHS.has(pathname)) {
      const csrfError = enforceCsrf(context);
      if (csrfError) return csrfError;
    }
  }

  const required = needsAuthentication(pathname, method);
  const tokens = requestSessionTokens(context.request);
  if (!required && !tokens.accessToken) return context.next();
  if (required && !tokens.accessToken) return errorResponse(401, "AUTH_REQUIRED", "ë¡œê·¸?????´ìš©?????ˆìŠµ?ˆë‹¤.");

  const session = await authenticatedSession(context);
  if (session.error) return required ? session.error : context.next();
  const headers = new Headers(context.request.headers);
  headers.set("Authorization", `Bearer ${session.accessToken}`);
  const request = new Request(context.request, { headers });
  const response = await context.next(request);
  return mergeSessionHeaders(response, session);
}
