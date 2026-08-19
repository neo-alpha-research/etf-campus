import re

with open('functions/api/community/_lib/session.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Add RM_COOKIE
content = content.replace(
    'const CSRF_COOKIE = "__Host-etf-campus-community-csrf";',
    'const CSRF_COOKIE = "__Host-etf-campus-community-csrf";\nconst RM_COOKIE = "__Host-etf-campus-community-rm";'
)

# Update sessionCookies
session_cookies_new = '''function sessionCookies(session, csrfToken, rememberMe = true) {
  const maxAge = rememberMe ? REFRESH_MAX_AGE : undefined;
  return [
    serializeCookie(ACCESS_COOKIE, session.access_token, { maxAge: ACCESS_MAX_AGE }),
    serializeCookie(REFRESH_COOKIE, session.refresh_token, { maxAge }),
    serializeCookie(CSRF_COOKIE, csrfToken, { httpOnly: false, maxAge }),
    serializeCookie(RM_COOKIE, rememberMe ? "1" : "0", { httpOnly: true, maxAge }),
  ];
}'''
content = re.sub(r'function sessionCookies\(session, csrfToken\) \{.*?\n\}', session_cookies_new, content, flags=re.DOTALL)

# Update sessionHeaders
content = content.replace(
    'export function sessionHeaders(session, csrfToken = secureRandom()) {',
    'export function sessionHeaders(session, csrfToken = secureRandom(), rememberMe = true) {'
).replace(
    'appendCookies(cacheHeaders(csrfToken), sessionCookies(session, csrfToken));',
    'appendCookies(cacheHeaders(csrfToken), sessionCookies(session, csrfToken, rememberMe));'
)

# Update clearSessionHeaders
clear_cookies_old = '''    expiredCookie(ACCESS_COOKIE),
    expiredCookie(REFRESH_COOKIE),
    expiredCookie(CSRF_COOKIE, { httpOnly: false }),
  ]);'''
clear_cookies_new = '''    expiredCookie(ACCESS_COOKIE),
    expiredCookie(REFRESH_COOKIE),
    expiredCookie(CSRF_COOKIE, { httpOnly: false }),
    expiredCookie(RM_COOKIE),
  ]);'''
content = content.replace(clear_cookies_old, clear_cookies_new)

# Update clearSessionResponse
clear_response_old = '''  const cookies = [
    expiredCookie(ACCESS_COOKIE),
    expiredCookie(REFRESH_COOKIE),
    expiredCookie(CSRF_COOKIE, { httpOnly: false }),
  ];'''
clear_response_new = '''  const cookies = [
    expiredCookie(ACCESS_COOKIE),
    expiredCookie(REFRESH_COOKIE),
    expiredCookie(CSRF_COOKIE, { httpOnly: false }),
    expiredCookie(RM_COOKIE),
  ];'''
content = content.replace(clear_response_old, clear_response_new)

# Update requestSessionTokens
request_tokens_old = '''export function requestSessionTokens(request) {
  const values = cookieMap(request.headers.get("Cookie"));
  return { accessToken: values[ACCESS_COOKIE] ?? null, refreshToken: values[REFRESH_COOKIE] ?? null };
}'''
request_tokens_new = '''export function requestSessionTokens(request) {
  const values = cookieMap(request.headers.get("Cookie"));
  return { accessToken: values[ACCESS_COOKIE] ?? null, refreshToken: values[REFRESH_COOKIE] ?? null, rememberMe: values[RM_COOKIE] !== "0" };
}'''
content = content.replace(request_tokens_old, request_tokens_new)

# Update authenticatedSession
content = content.replace(
    'const { accessToken, refreshToken } = requestSessionTokens(context.request);',
    'const { accessToken, refreshToken, rememberMe } = requestSessionTokens(context.request);'
)

csrf_cookies_old = '''const csrfCookies = requestCsrfToken(context.request) ? [] : [serializeCookie(CSRF_COOKIE, csrfToken, { httpOnly: false, maxAge: REFRESH_MAX_AGE })];'''
csrf_cookies_new = '''const maxAge = rememberMe ? REFRESH_MAX_AGE : undefined;\n  const csrfCookies = requestCsrfToken(context.request) ? [] : [serializeCookie(CSRF_COOKIE, csrfToken, { httpOnly: false, maxAge })];'''
content = content.replace(csrf_cookies_old, csrf_cookies_new)

content = content.replace(
    'cookies: sessionCookies(refreshed.data.session, csrfToken),',
    'cookies: sessionCookies(refreshed.data.session, csrfToken, rememberMe),'
)

content = content.replace(
    'export const COMMUNITY_SESSION_COOKIE_NAMES = { ACCESS_COOKIE, REFRESH_COOKIE, CSRF_COOKIE };',
    'export const COMMUNITY_SESSION_COOKIE_NAMES = { ACCESS_COOKIE, REFRESH_COOKIE, CSRF_COOKIE, RM_COOKIE };'
)

with open('functions/api/community/_lib/session.js', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
print('session.js updated')
