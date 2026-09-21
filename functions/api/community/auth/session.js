import { authenticatedSession, clearSessionHeaders, mergeSessionHeaders } from "../_lib/session";
import { adminSupabase } from "../_lib/supabase";
import { jsonResponse } from "../_lib/api-security";

export async function onRequestGet(context) {
  const session = await authenticatedSession(context);
  if (session.error) return session.error;
  
  const isInternalOAuthEmail = typeof session.user?.email === "string" && 
    (session.user.email.includes("@oauth.") || session.user?.app_metadata?.auth_bridge === "oauth-v1");
  const exposedEmail = isInternalOAuthEmail ? null : session.user?.email;

  let displayName = null;
  try {
    const admin = adminSupabase(context.env);
    const { data: profile } = await admin
      .from("user_profiles")
      .select("public_nickname")
      .eq("id", session.user.id)
      .maybeSingle();
    displayName = profile?.public_nickname ?? null;
  } catch {
    // Graceful fallback if profile lookup fails
  }

  return mergeSessionHeaders(
    jsonResponse({ 
      authenticated: true,
      user: {
        id: session.user.id,
        email: exposedEmail,
        displayName,
        isOAuth: Boolean(isInternalOAuthEmail),
      }
    }), 
    session
  );
}

export async function onRequestDelete() {
  return new Response(JSON.stringify({ signedOut: true }), { status: 200, headers: clearSessionHeaders() });
}
