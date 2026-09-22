import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getProviderAdapter, kakaoProvider, naverProvider } from "./oauth-providers";

describe("OAuth Providers Adapter", () => {
  let globalFetch: any;

  beforeEach(() => {
    globalFetch = vi.fn();
    vi.stubGlobal("fetch", globalFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("kakaoProvider", () => {
    const env = {
      KAKAO_REST_API_KEY: "mock_kakao_client_id",
      KAKAO_CLIENT_SECRET: "mock_kakao_client_secret",
    };

    it("generates correct authorization URL with state and redirectUri", () => {
      const url = kakaoProvider.getAuthorizationUrl(env, "state123", "https://example.com/callback");
      const parsed = new URL(url);
      expect(parsed.origin).toBe("https://kauth.kakao.com");
      expect(parsed.pathname).toBe("/oauth/authorize");
      expect(parsed.searchParams.get("client_id")).toBe("mock_kakao_client_id");
      expect(parsed.searchParams.get("state")).toBe("state123");
      expect(parsed.searchParams.get("redirect_uri")).toBe("https://example.com/callback");
      expect(parsed.searchParams.get("response_type")).toBe("code");
    });

    it("exchangeCode with 4 arguments (env, code, state, redirectUri) uses redirectUri", async () => {
      globalFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: "kakao_at_123" }),
      });

      const token = await kakaoProvider.exchangeCode(
        env,
        "auth_code_xyz",
        "state_tx_hash_value",
        "https://example.com/api/community/auth/oauth/kakao/callback"
      );

      expect(token).toBe("kakao_at_123");
      expect(globalFetch).toHaveBeenCalledTimes(1);
      const call = globalFetch.mock.calls[0];
      expect(call[0]).toBe("https://kauth.kakao.com/oauth/token");

      const bodyParams = new URLSearchParams(call[1].body);
      expect(bodyParams.get("grant_type")).toBe("authorization_code");
      expect(bodyParams.get("client_id")).toBe("mock_kakao_client_id");
      expect(bodyParams.get("client_secret")).toBe("mock_kakao_client_secret");
      expect(bodyParams.get("code")).toBe("auth_code_xyz");
      // Must NOT be the state hash! Must be the actual callback URI!
      expect(bodyParams.get("redirect_uri")).toBe("https://example.com/api/community/auth/oauth/kakao/callback");
    });

    it("exchangeCode with 3 arguments (env, code, redirectUri) also works gracefully", async () => {
      globalFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: "kakao_at_legacy" }),
      });

      const token = await kakaoProvider.exchangeCode(
        env,
        "auth_code_xyz",
        "https://example.com/api/community/auth/oauth/kakao/callback"
      );

      expect(token).toBe("kakao_at_legacy");
      const bodyParams = new URLSearchParams(globalFetch.mock.calls[0][1].body);
      expect(bodyParams.get("redirect_uri")).toBe("https://example.com/api/community/auth/oauth/kakao/callback");
    });

    it("throws KAKAO_TOKEN_EXCHANGE_FAILED on provider error", async () => {
      globalFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: "invalid_grant", error_description: "Redirect URI mismatch" }),
      });

      await expect(
        kakaoProvider.exchangeCode(env, "bad_code", "state", "https://example.com/cb")
      ).rejects.toThrow("KAKAO_TOKEN_EXCHANGE_FAILED: Redirect URI mismatch");
    });
  });

  describe("naverProvider", () => {
    const env = {
      NAVER_CLIENT_ID: "mock_naver_id",
      NAVER_CLIENT_SECRET: "mock_naver_secret",
    };

    it("generates correct authorization URL", () => {
      const url = naverProvider.getAuthorizationUrl(env, "state456", "https://example.com/callback");
      const parsed = new URL(url);
      expect(parsed.origin).toBe("https://nid.naver.com");
      expect(parsed.pathname).toBe("/oauth2.0/authorize");
      expect(parsed.searchParams.get("client_id")).toBe("mock_naver_id");
      expect(parsed.searchParams.get("state")).toBe("state456");
      expect(parsed.searchParams.get("redirect_uri")).toBe("https://example.com/callback");
    });

    it("exchangeCode includes state and redirect_uri in token request", async () => {
      globalFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: "naver_at_456" }),
      });

      const token = await naverProvider.exchangeCode(
        env,
        "code_abc",
        "state_tx_hash",
        "https://example.com/callback"
      );

      expect(token).toBe("naver_at_456");
      expect(globalFetch).toHaveBeenCalledTimes(1);
      const requestedUrl = new URL(globalFetch.mock.calls[0][0]);
      expect(requestedUrl.searchParams.get("grant_type")).toBe("authorization_code");
      expect(requestedUrl.searchParams.get("client_id")).toBe("mock_naver_id");
      expect(requestedUrl.searchParams.get("client_secret")).toBe("mock_naver_secret");
      expect(requestedUrl.searchParams.get("code")).toBe("code_abc");
      expect(requestedUrl.searchParams.get("state")).toBe("state_tx_hash");
      expect(requestedUrl.searchParams.get("redirect_uri")).toBe("https://example.com/callback");
    });
  });
});
