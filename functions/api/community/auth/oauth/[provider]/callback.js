import { getProviderAdapter, isSupportedProvider } from "../../../_lib/oauth-providers";
import { clearOAuthStateCookie, parseOAuthCookie, verifyOAuthState } from "../../../_lib/oauth-state";
import {
  checkProfileConfigured,
  consumeTransaction,
  issueBridgeSession,
  oauthSuccessRedirect,
  resolveOrCreateOAuthUser,
} from "../../../_lib/oauth-bridge";
import { safeReturnTo } from "../../../../../../lib/auth/return-to";

function getRequestOrigin(request) {
  const url = new URL(request.url);
  return url.origin;
}

function errorRedirect(destination, errorMessage) {
  const url = new URL(destination, "https://www.etfcampus.kr");
  if (errorMessage) {
    url.searchParams.set("error", errorMessage);
  }
  const headers = new Headers({
    Location: `${url.pathname}${url.search}`,
    "Referrer-Policy": "no-referrer",
    "Set-Cookie": clearOAuthStateCookie(),
  });
  return new Response(null, { status: 302, headers });
}

export async function onRequestGet(context) {
  const provider = String(context.params?.provider ?? "").toLowerCase();
  const requestUrl = new URL(context.request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const providerError = requestUrl.searchParams.get("error");

  // 1. Handle provider cancellation or denial
  if (providerError) {
    console.warn("OAuth provider returned error", { provider, error: providerError });
    return errorRedirect("/login/", "oauth_cancelled");
  }

  if (!isSupportedProvider(provider) || !code || !state) {
    return errorRedirect("/login/", "invalid_oauth_request");
  }

  const origin = getRequestOrigin(context.request);
  const cookieHeader = context.request.headers.get("Cookie");
  const stateCookie = parseOAuthCookie(cookieHeader);

  // 2. Verify state cookie signature & timestamp
  const secret = context.env.OAUTH_STATE_HMAC_SECRET || "dev-oauth-state-hmac-secret-default";
  const verifiedState = await verifyOAuthState(secret, stateCookie, state);
  if (!verifiedState || verifiedState.provider !== provider) {
    console.error("OAuth state verification failed", { provider, state });
    return errorRedirect("/login/", "invalid_state");
  }

  // 3. Atomically consume the database transaction (replay attack defense)
  const transaction = await consumeTransaction(context.env, state);
  if (!transaction || transaction.provider !== provider) {
    console.error("OAuth transaction already consumed or expired", { state });
    return errorRedirect("/login/", "state_expired");
  }

  try {
    const adapter = getProviderAdapter(provider);
    const callbackUri = `${origin}/api/community/auth/oauth/${provider}/callback`;

    // 4. Exchange authorization code for provider access token
    const accessToken = await adapter.exchangeCode(context.env, code, state, callbackUri);

    // 5. Query user subject identity (strictly no name or avatar collection)
    const identity = await adapter.getSubject(context.env, accessToken);

    // 6. Resolve existing account or provision new internal OAuth account
    const userResolution = await resolveOrCreateOAuthUser(context.env, {
      provider,
      appId: identity.appId,
      subject: identity.subject,
    });

    // 7. Issue genuine Supabase session via generateLink/verify loopback
    const session = await issueBridgeSession(context.env, {
      authEmail: userResolution.authEmail,
      userId: userResolution.userId,
    });

    // 8. Determine destination
    const profileConfigured = await checkProfileConfigured(context.env, userResolution.userId);
    const returnTo = safeReturnTo(transaction.return_to, "/");

    let destination = returnTo;
    if (!profileConfigured) {
      destination = `/login/?step=profile&returnTo=${encodeURIComponent(returnTo)}`;
    }

    // 9. Issue standard __Host- session cookies and redirect
    return oauthSuccessRedirect(session, destination, transaction.remember_me);
  } catch (error) {
    console.error("OAuth callback processing failed", error);
    return errorRedirect("/login/", "oauth_processing_failed");
  }
}
