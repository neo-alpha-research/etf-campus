import { authenticatedSession, clearSessionHeaders, mergeSessionHeaders } from "../_lib/session";
import { jsonResponse } from "../_lib/api-security";

export async function onRequestGet(context) {
  const session = await authenticatedSession(context);
  if (session.error) return session.error;
  return mergeSessionHeaders(jsonResponse({ authenticated: true }), session);
}

export async function onRequestDelete() {
  return new Response(JSON.stringify({ signedOut: true }), { status: 200, headers: clearSessionHeaders() });
}
