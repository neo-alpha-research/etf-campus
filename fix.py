import re

with open('functions/api/community/_lib/session.js', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

new_csrf = '''export function enforceCsrf(context) {
  const expected = requestCsrfToken(context.request);
  const supplied = context.request.headers.get("X-Community-CSRF");
  if (!expected || !supplied || expected.length !== supplied.length) return errorResponse(403, "FORBIDDEN", "요청 보안 확인에 실패했습니다. 페이지를 새로고침하여 다시 시도해 주세요.");
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) mismatch |= expected.charCodeAt(index) ^ supplied.charCodeAt(index);
  return mismatch === 0 ? null : errorResponse(403, "FORBIDDEN", "요청 보안 확인에 실패했습니다. 페이지를 새로고침하여 다시 시도해 주세요.");
}'''

content = re.sub(r'export function enforceCsrf\(context\) \{.*?(?=\nexport function)', new_csrf + '\n\n', content, flags=re.DOTALL)

new_cleared = '''function clearedAuthError() {
  return clearSessionResponse(errorResponse(401, "AUTH_REQUIRED", "로그인 상태가 만료되었거나 유효하지 않습니다."));
}'''

content = re.sub(r'function clearedAuthError\(\) \{.*?(?=\nexport async function)', new_cleared + '\n\n', content, flags=re.DOTALL)

content = re.sub(r'try \{ client = publicSupabase\(context.env, accessToken\); \} catch \{ return \{ error: errorResponse\(503, "CONFIGURATION_ERROR", .*?\) \}; \}', 'try { client = publicSupabase(context.env, accessToken); } catch { return { error: errorResponse(503, "CONFIGURATION_ERROR", "인증 서비스 설정을 확인해 주세요.") }; }', content)

with open('functions/api/community/_lib/session.js', 'w', encoding='utf-8') as f:
    f.write(content)
