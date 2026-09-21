import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enforceDatabaseRateLimit: vi.fn(),
  recordTransaction: vi.fn(),
  consumeTransaction: vi.fn(),
  resolveOrCreateOAuthUser: vi.fn(),
  issueBridgeSession: vi.fn(),
  checkProfileConfigured: vi.fn(),
  exchangeCode: vi.fn(),
  getSubject: vi.fn(),
}));

vi.mock("../../../_lib/request-security", () => ({
  enforceDatabaseRateLimit: mocks.enforceDatabaseRateLimit,
  parseJsonBody: async (req: Request) => req.json().catch(() => ({})),
}));

vi.mock("../../../_lib/oauth-bridge", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../_lib/oauth-bridge")>();
  return {
    ...actual,
    recordTransaction: mocks.recordTransaction,
    consumeTransaction: mocks.consumeTransaction,
    resolveOrCreateOAuthUser: mocks.resolveOrCreateOAuthUser,
    issueBridgeSession: mocks.issueBridgeSession,
    checkProfileConfigured: mocks.checkProfileConfigured,
  };
});

vi.mock("../../../_lib/oauth-providers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../_lib/oauth-providers")>();
  return {
    ...actual,
    getProviderAdapter: (provider: string) => ({
      getAuthorizationUrl: (_env: any, state: string, redirectUri: string) =>
        `https://${provider}.mock/authorize?state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`,
      exchangeCode: mocks.exchangeCode,
      getSubject: mocks.getSubject,
    }),
  };
});

import { onRequestPost as onStartPost } from "../[provider]/start.js";
import { onRequestGet as onCallbackGet } from "../[provider]/callback.js";
import { createOAuthStateCookie, signOAuthState } from "../../../_lib/oauth-state";

describe("OAuth start & callback endpoints", () => {
  const secret = "test-secret-for-oauth-tests-123456";
  const defaultEnv = {
    OAUTH_STATE_HMAC_SECRET: secret,
    OAUTH_IDENTITY_HMAC_SECRET: "identity-secret",
    KAKAO_REST_API_KEY: "test-kakao-key",
    NAVER_CLIENT_ID: "test-naver-id",
    NAVER_CLIENT_SECRET: "test-naver-secret",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enforceDatabaseRateLimit.mockResolvedValue(null);
    mocks.recordTransaction.mockResolvedValue("mock-tx-uuid");
  });

  describe("start.js", () => {
    it("rejects unsupported provider with 400", async () => {
      const context = {
        params: { provider: "google" },
        request: new Request("https://www.etfcampus.kr/api/community/auth/oauth/google/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ returnTo: "/compare" }),
        }),
        env: defaultEnv,
      };

      const response = await onStartPost(context as any);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error.code).toBe("INVALID_PROVIDER");
    });

    it("initializes transaction and returns authorizationUrl with state cookie for Kakao", async () => {
      const context = {
        params: { provider: "kakao" },
        request: new Request("https://www.etfcampus.kr/api/community/auth/oauth/kakao/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ returnTo: "/etf/069500", rememberMe: true }),
        }),
        env: defaultEnv,
      };

      const response = await onStartPost(context as any);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.authorizationUrl).toContain("https://kakao.mock/authorize?state=");
      expect(mocks.recordTransaction).toHaveBeenCalledWith(
        defaultEnv,
        expect.objectContaining({
          provider: "kakao",
          returnTo: "/etf/069500",
          rememberMe: true,
        })
      );

      const cookieHeader = response.headers.get("Set-Cookie");
      expect(cookieHeader).toContain("__Host-oauth-state=");
      expect(cookieHeader).toContain("HttpOnly");
      expect(cookieHeader).toContain("Secure");
    });
  });

  describe("callback.js", () => {
    it("redirects with error when provider returns error parameter", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const context = {
        params: { provider: "kakao" },
        request: new Request("https://www.etfcampus.kr/api/community/auth/oauth/kakao/callback?error=access_denied"),
        env: defaultEnv,
      };

      const response = await onCallbackGet(context as any);
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toContain("/login/?error=oauth_cancelled");
      expect(response.headers.get("Set-Cookie")).toContain("Max-Age=0");
      warnSpy.mockRestore();
    });

    it("redirects with invalid_state when cookie is missing or tampered", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const context = {
        params: { provider: "naver" },
        request: new Request("https://www.etfcampus.kr/api/community/auth/oauth/naver/callback?code=mock_code&state=fake_state"),
        env: defaultEnv,
      };

      const response = await onCallbackGet(context as any);
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toContain("/login/?error=invalid_state");
      errorSpy.mockRestore();
    });

    it("successfully processes callback, issues session cookies, and redirects to returnTo for configured profile", async () => {
      const txId = "test-valid-tx-id-64-characters-long-00000000000000000000000000000000";
      const signedState = await signOAuthState(secret, {
        version: 1,
        txId,
        provider: "naver",
        origin: "https://www.etfcampus.kr",
        expiresAt: Date.now() + 60_000,
      });

      mocks.consumeTransaction.mockResolvedValue({
        id: "tx-uuid",
        provider: "naver",
        return_to: "/compare",
        remember_me: true,
      });
      mocks.exchangeCode.mockResolvedValue("mock_access_token");
      mocks.getSubject.mockResolvedValue({
        provider: "naver",
        subject: "naver_user_12345",
        appId: "naver_app",
      });
      mocks.resolveOrCreateOAuthUser.mockResolvedValue({
        userId: "user-uuid-1",
        authEmail: "naver_hash@oauth.etfcampus.kr",
        isNewUser: false,
      });
      mocks.issueBridgeSession.mockResolvedValue({
        access_token: "mock-supabase-at",
        refresh_token: "mock-supabase-rt",
      });
      mocks.checkProfileConfigured.mockResolvedValue(true);

      const cookie = createOAuthStateCookie(signedState);
      const context = {
        params: { provider: "naver" },
        request: new Request(`https://www.etfcampus.kr/api/community/auth/oauth/naver/callback?code=good_code&state=${txId}`, {
          headers: { Cookie: cookie },
        }),
        env: defaultEnv,
      };

      const response = await onCallbackGet(context as any);
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/compare");

      // Verify Set-Cookie headers
      const setCookies = response.headers.getSetCookie ? response.headers.getSetCookie() : [response.headers.get("Set-Cookie") || ""];
      const cookieStr = setCookies.join("; ");
      expect(cookieStr).toContain("__Host-etf-campus-community-at=mock-supabase-at");
      expect(cookieStr).toContain("__Host-etf-campus-community-rt=mock-supabase-rt");
      expect(cookieStr).toContain("__Host-oauth-state=;"); // cleared
    });

    it("redirects unconfigured new user to profile step", async () => {
      const txId = "test-valid-tx-id-64-characters-long-00000000000000000000000000000001";
      const signedState = await signOAuthState(secret, {
        version: 1,
        txId,
        provider: "kakao",
        origin: "https://www.etfcampus.kr",
        expiresAt: Date.now() + 60_000,
      });

      mocks.consumeTransaction.mockResolvedValue({
        id: "tx-uuid",
        provider: "kakao",
        return_to: "/etf/069500",
        remember_me: true,
      });
      mocks.exchangeCode.mockResolvedValue("mock_access_token");
      mocks.getSubject.mockResolvedValue({ provider: "kakao", subject: "kakao_999", appId: "kakao_app" });
      mocks.resolveOrCreateOAuthUser.mockResolvedValue({ userId: "new-user-uuid", authEmail: "kakao_hash@oauth.etfcampus.kr", isNewUser: true });
      mocks.issueBridgeSession.mockResolvedValue({ access_token: "mock-supabase-at", refresh_token: "mock-supabase-rt" });
      mocks.checkProfileConfigured.mockResolvedValue(false); // new user!

      const cookie = createOAuthStateCookie(signedState);
      const context = {
        params: { provider: "kakao" },
        request: new Request(`https://www.etfcampus.kr/api/community/auth/oauth/kakao/callback?code=good_code&state=${txId}`, {
          headers: { Cookie: cookie },
        }),
        env: defaultEnv,
      };

      const response = await onCallbackGet(context as any);
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/login/?step=profile&returnTo=%2Fetf%2F069500");
    });
  });
});
