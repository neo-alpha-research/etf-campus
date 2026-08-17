import {
  destroyCurrentSession,
  hasTrustedOrigin,
  json,
} from "../../_shared/auth.js";

function noContent(cookie) {
  const headers = new Headers({ "cache-control": "no-store" });
  if (cookie) headers.set("set-cookie", cookie);
  return new Response(null, { status: 204, headers });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // 세션 쿠키가 자동으로 전송되는 상태 변경 요청이므로 동일 Origin만 허용합니다.
  if (!hasTrustedOrigin(request, env)) {
    return json({ error: "request_not_allowed" }, { status: 403 });
  }

  try {
    // 현재 세션이 없거나 이미 만료됐더라도 로그아웃은 성공으로 처리합니다.
    // 이 호출은 멱등적이므로 클라이언트가 안전하게 반복할 수 있습니다.
    const result = await destroyCurrentSession(request, env);
    return noContent(result.setCookie);
  } catch (error) {
    console.error("auth_logout_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return json({ error: "logout_failed" }, { status: 500 });
  }
}
