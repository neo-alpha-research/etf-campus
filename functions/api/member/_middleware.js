import { authenticatedSession, mergeSessionHeaders } from "../community/_lib/session";
import { errorResponse } from "../community/_lib/api-security";

export async function onRequest(context) {
  const session = await authenticatedSession(context);
  if (session.error) return session.error;
  
  if (session.user) {
    context.data = context.data || {};
    context.data.user = session.user;
  } else {
    return errorResponse(401, "AUTH_REQUIRED", "로그인이 필요합니다.");
  }

  const response = await context.next();
  return mergeSessionHeaders(response, session);
}
