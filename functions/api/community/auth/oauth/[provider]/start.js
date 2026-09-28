import { errorResponse, jsonResponse } from "../../../_lib/api-security";
import { enforceDatabaseRateLimit, parseJsonBody } from "../../../_lib/request-security";
import { getProviderAdapter, isSupportedProvider } from "../../../_lib/oauth-providers";
import { createOAuthStateCookie, generateTxId, signOAuthState } from "../../../_lib/oauth-state";
import { recordTransaction } from "../../../_lib/oauth-bridge";
import { safeReturnTo } from "../../../../../../lib/auth/return-to";

function getRequestOrigin(request) {
  const url = new URL(request.url);
  return url.origin;
}

export async function onRequestPost(context) {
  const provider = String(context.params?.provider ?? "").toLowerCase();
  if (!isSupportedProvider(provider)) {
    return errorResponse(400, "INVALID_PROVIDER", "지원하지 않는 소셜 로그인 제공자입니다.");
  }

  const ip = context.request.headers.get("CF-Connecting-IP") || "unknown";
  const [rateLimitError, payload] = await Promise.all([
    enforceDatabaseRateLimit(context, "oauth-start-ip", ip, 30, 600),
    parseJsonBody(context.request),
  ]);
  if (rateLimitError) return rateLimitError;

  const rawReturnTo = payload?.returnTo;
  const returnTo = safeReturnTo(rawReturnTo, "/");
  const rememberMe = payload?.rememberMe !== false;
  const origin = getRequestOrigin(context.request);

  try {
    const adapter = getProviderAdapter(provider);
    const txId = generateTxId();
    const callbackUri = `${origin}/api/community/auth/oauth/${provider}/callback`;

    // 2. Build provider authorization URL
    const authorizationUrl = adapter.getAuthorizationUrl(context.env, txId, callbackUri);

    // 3. Issue signed state and record transaction concurrently
    const statePayload = {
      version: 1,
      txId,
      provider,
      origin,
      expiresAt: Date.now() + 600_000, // 10 minutes
    };

    const secret = context.env.OAUTH_STATE_HMAC_SECRET || "dev-oauth-state-hmac-secret-default";
    const [, signedState] = await Promise.all([
      recordTransaction(context.env, {
        txId,
        provider,
        origin,
        returnTo,
        rememberMe,
        mode: "login",
      }),
      signOAuthState(secret, statePayload),
    ]);

    const stateCookie = createOAuthStateCookie(signedState, 600);

    const headers = new Headers({
      "Content-Type": "application/json",
      "Set-Cookie": stateCookie,
    });

    return new Response(JSON.stringify({ authorizationUrl }), {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("OAuth start failed", error);
    return errorResponse(500, "OAUTH_START_FAILED", "소셜 로그인을 시작할 수 없습니다. 잠시 후 다시 시도해 주세요.");
  }
}
