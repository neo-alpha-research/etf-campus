import {
  appendSetCookie,
  getSession,
  json,
} from "../../_shared/auth.js";

export async function onRequest(context) {
  const session = await getSession(context.request, context.env);

  if (!session.user) {
    let response = json({ error: "authentication_required" }, { status: 401 });
    if (session.setCookie) response = appendSetCookie(response, session.setCookie);
    return response;
  }

  // 신뢰할 수 없는 request header가 아니라 middleware가 검증한 결과만 전달합니다.
  context.data.auth = { user: session.user };

  let response = await context.next();
  if (session.setCookie) response = appendSetCookie(response, session.setCookie);
  return response;
}
