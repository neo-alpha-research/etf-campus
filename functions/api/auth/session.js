import {
  appendSetCookie,
  getSession,
  json,
} from "../../_shared/auth.js";

export async function onRequestGet(context) {
  const session = await getSession(context.request, context.env);

  let response = json({
    authenticated: Boolean(session.user),
    user: session.user,
  });

  if (session.setCookie) response = appendSetCookie(response, session.setCookie);
  return response;
}
