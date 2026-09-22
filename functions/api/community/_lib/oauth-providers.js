export const SUPPORTED_PROVIDERS = ["kakao", "naver"];

export function isSupportedProvider(provider) {
  return typeof provider === "string" && SUPPORTED_PROVIDERS.includes(provider.toLowerCase());
}

export const kakaoProvider = {
  getAuthorizationUrl(env, state, redirectUri) {
    const clientId = env.KAKAO_REST_API_KEY;
    if (!clientId) throw new Error("Missing KAKAO_REST_API_KEY");

    const url = new URL("https://kauth.kakao.com/oauth/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", state);
    return url.toString();
  },

  async exchangeCode(env, code, state, redirectUri) {
    const clientId = env.KAKAO_REST_API_KEY;
    if (!clientId) throw new Error("Missing KAKAO_REST_API_KEY");

    // Support both 4-argument call (env, code, state, redirectUri) and 3-argument call (env, code, redirectUri)
    const effectiveRedirectUri = redirectUri || state;

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      redirect_uri: effectiveRedirectUri,
      code,
    });

    if (env.KAKAO_CLIENT_SECRET) {
      body.set("client_secret", env.KAKAO_CLIENT_SECRET);
    }

    const response = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
      body: body.toString(),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.access_token) {
      const errorMsg = data?.error_description || data?.error || "Kakao token exchange failed";
      throw new Error(`KAKAO_TOKEN_EXCHANGE_FAILED: ${errorMsg}`);
    }

    return data.access_token;
  },

  async getSubject(env, accessToken) {
    const response = await fetch("https://kapi.kakao.com/v1/user/access_token_info", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.id) {
      const errorMsg = data?.msg || "Failed to fetch Kakao user identity";
      throw new Error(`KAKAO_USER_INFO_FAILED: ${errorMsg}`);
    }

    const appId = String(data.app_id ?? env.KAKAO_APP_ID ?? "kakao_app");
    if (env.KAKAO_APP_ID && String(data.app_id) !== String(env.KAKAO_APP_ID)) {
      throw new Error("KAKAO_APP_ID_MISMATCH");
    }

    return {
      provider: "kakao",
      subject: String(data.id),
      appId,
      rawEmail: null,
    };
  },
};

export const naverProvider = {
  getAuthorizationUrl(env, state, redirectUri) {
    const clientId = env.NAVER_CLIENT_ID;
    if (!clientId) throw new Error("Missing NAVER_CLIENT_ID");

    const url = new URL("https://nid.naver.com/oauth2.0/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    return url.toString();
  },

  async exchangeCode(env, code, state, redirectUri) {
    const clientId = env.NAVER_CLIENT_ID;
    const clientSecret = env.NAVER_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error("Missing NAVER_CLIENT_ID or NAVER_CLIENT_SECRET");

    const url = new URL("https://nid.naver.com/oauth2.0/token");
    url.searchParams.set("grant_type", "authorization_code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("client_secret", clientSecret);
    url.searchParams.set("code", code);
    url.searchParams.set("state", state);
    if (redirectUri) {
      url.searchParams.set("redirect_uri", redirectUri);
    }

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.access_token) {
      const errorMsg = data?.error_description || data?.error || "Naver token exchange failed";
      throw new Error(`NAVER_TOKEN_EXCHANGE_FAILED: ${errorMsg}`);
    }

    return data.access_token;
  },

  async getSubject(env, accessToken) {
    const response = await fetch("https://openapi.naver.com/v1/nid/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || data?.resultcode !== "00" || !data?.response?.id) {
      const errorMsg = data?.message || "Failed to fetch Naver profile";
      throw new Error(`NAVER_PROFILE_FAILED: ${errorMsg}`);
    }

    const appId = String(env.NAVER_CLIENT_ID ?? "naver_app");
    return {
      provider: "naver",
      subject: String(data.response.id),
      appId,
      rawEmail: typeof data.response.email === "string" ? data.response.email.trim().toLowerCase() : null,
    };
  },
};

export function getProviderAdapter(provider) {
  const normalized = String(provider ?? "").toLowerCase();
  if (normalized === "kakao") return kakaoProvider;
  if (normalized === "naver") return naverProvider;
  throw new Error(`Unsupported OAuth provider: ${provider}`);
}
