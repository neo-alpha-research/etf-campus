import {
  hasTrustedOrigin,
  json,
  revokeAllUserSessions,
} from "../../_shared/auth.js";

function noContent(cookie) {
  const headers = new Headers({ "cache-control": "no-store" });
  if (cookie) headers.set("set-cookie", cookie);
  return new Response(null, { status: 204, headers });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // 전체 기기 로그아웃은 현재 로그인된 세션의 권한을 요구합니다.
  if (!hasTrustedOrigin(request, env)) {
    return json({ error: "request_not_allowed" }, { status: 403 });
  }

  try {
    const result = await revokeAllUserSessions(request, env);

    if (!result.user) {
      const response = json({ error: "authentication_required" }, { status: 401 });
      if (result.setCookie) response.headers.set("set-cookie", result.setCookie);
      return response;
    }

    return noContent(result.setCookie);
  } catch (error) {
    console.error("auth_logout_all_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return json({ error: "logout_all_failed" }, { status: 500 });
  }
}
