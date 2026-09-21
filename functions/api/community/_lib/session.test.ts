import { describe, expect, it, vi } from "vitest";
import {
  passwordSetupHeaders,
  readPasswordSetup,
  clearPasswordSetupHeaders,
  COMMUNITY_SESSION_COOKIE_NAMES,
  getProfileStatus,
  checkProfileConfigured,
} from "./session";

const mocks = vi.hoisted(() => ({
  adminSupabase: vi.fn(),
}));

vi.mock("./supabase", () => ({
  adminSupabase: mocks.adminSupabase,
  publicSupabase: vi.fn(),
}));



describe("session", () => {
  describe("passwordSetupHeaders", () => {
    it("S-1: Set-Cookie에 속성이 올바르게 설정됨", () => {
      const session = { access_token: "test-access" };
      const headers = passwordSetupHeaders(session, { rememberMe: true });
      const setCookies = headers.getSetCookie();
      const pwCookie = setCookies.find((c) => c.startsWith("__Host-etf-campus-community-pwsetup="));
      
      expect(pwCookie).toBeTruthy();
      expect(pwCookie).toContain("HttpOnly");
      expect(pwCookie).toContain("Secure");
      expect(pwCookie).toContain("Path=/");
      expect(pwCookie).toContain("SameSite=Lax");
      expect(pwCookie).toContain("Max-Age=600");
    });

    it("S-2: CSRF 쿠키와 X-Community-CSRF 헤더 값이 일치하며 CSRF 쿠키는 HttpOnly가 없음", () => {
      const session = { access_token: "test-access" };
      const headers = passwordSetupHeaders(session, { rememberMe: true });
      const csrfHeader = headers.get("X-Community-CSRF");
      const setCookies = headers.getSetCookie();
      const csrfCookie = setCookies.find((c) => c.startsWith("__Host-etf-campus-community-csrf="));
      
      expect(csrfHeader).toBeTruthy();
      expect(csrfCookie).toBeTruthy();
      expect(csrfCookie).not.toContain("HttpOnly");
      
      const match = csrfCookie?.match(/__Host-etf-campus-community-csrf=([^;]+)/);
      expect(match?.[1]).toBe(csrfHeader);
    });

    it("S-3: 쿠키 값이 URL-safe 문자로만 구성됨", () => {
      const session = { access_token: "test-access" };
      const headers = passwordSetupHeaders(session, { rememberMe: true });
      const setCookies = headers.getSetCookie();
      const pwCookie = setCookies.find((c) => c.startsWith("__Host-etf-campus-community-pwsetup=")) || "";
      const match = pwCookie.match(/__Host-etf-campus-community-pwsetup=([^;]+)/);
      const value = match ? match[1] : "";
      
      expect(value).toMatch(/^[A-Za-z0-9-_]+$/);
    });

    it("S-9: 페이로드를 디코딩했을 때 refreshToken이 없음", () => {
      const session = { access_token: "test-access", refresh_token: "test-refresh" };
      const headers = passwordSetupHeaders(session, { rememberMe: true });
      const setCookies = headers.getSetCookie();
      const pwCookie = setCookies.find((c) => c.startsWith("__Host-etf-campus-community-pwsetup=")) || "";
      const req = new Request("https://example.com", { headers: { Cookie: pwCookie } });
      const decoded = readPasswordSetup(req)!;
      expect(decoded.accessToken).toBe("test-access");
      expect(decoded.rememberMe).toBe(true);
      expect(decoded.refreshToken).toBeUndefined();
    });
  });

  describe("readPasswordSetup (왕복 테스트)", () => {
    it("S-4: 원본 accessToken과 rememberMe를 복원함 (rememberMe: true)", () => {
      const session = { access_token: "test-access-1" };
      const headers = passwordSetupHeaders(session, { rememberMe: true });
      const setCookies = headers.getSetCookie();
      const pwCookie = setCookies.find((c) => c.startsWith("__Host-etf-campus-community-pwsetup=")) || "";
      const match = pwCookie.match(/__Host-etf-campus-community-pwsetup=([^;]+)/);
      const value = match ? match[1] : "";
      
      const req = new Request("https://example.com", {
        headers: { Cookie: `__Host-etf-campus-community-pwsetup=${value}` },
      });
      const setup = readPasswordSetup(req);
      expect(setup).toEqual({ accessToken: "test-access-1", rememberMe: true });
    });

    it("S-4: 원본 accessToken과 rememberMe를 복원함 (rememberMe: false)", () => {
      const session = { access_token: "test-access-2" };
      const headers = passwordSetupHeaders(session, { rememberMe: false });
      const setCookies = headers.getSetCookie();
      const pwCookie = setCookies.find((c) => c.startsWith("__Host-etf-campus-community-pwsetup=")) || "";
      const match = pwCookie.match(/__Host-etf-campus-community-pwsetup=([^;]+)/);
      const value = match ? match[1] : "";
      
      const req = new Request("https://example.com", {
        headers: { Cookie: `__Host-etf-campus-community-pwsetup=${value}` },
      });
      const setup = readPasswordSetup(req);
      expect(setup).toEqual({ accessToken: "test-access-2", rememberMe: false });
    });

    it("S-5: 한글 및 특수문자가 포함된 페이로드도 왕복 복원됨", () => {
      const session = { access_token: "한글-access-특수문자!@#$" };
      const headers = passwordSetupHeaders(session, { rememberMe: true });
      const setCookies = headers.getSetCookie();
      const pwCookie = setCookies.find((c) => c.startsWith("__Host-etf-campus-community-pwsetup=")) || "";
      const match = pwCookie.match(/__Host-etf-campus-community-pwsetup=([^;]+)/);
      const value = match ? match[1] : "";
      
      const req = new Request("https://example.com", {
        headers: { Cookie: `__Host-etf-campus-community-pwsetup=${value}` },
      });
      const setup = readPasswordSetup(req);
      expect(setup).toEqual({ accessToken: "한글-access-특수문자!@#$", rememberMe: true });
    });

    it("S-6: 쿠키 없음, 손상된 base64, JSON이 아닌 값에 대해 null을 반환", () => {
      expect(readPasswordSetup(new Request("https://example.com"))).toBeNull();
      
      const badBase64Req = new Request("https://example.com", {
        headers: { Cookie: "__Host-etf-campus-community-pwsetup=invalid-base64!" },
      });
      expect(readPasswordSetup(badBase64Req)).toBeNull();
      
      const notJson = Buffer.from("not-json").toString("base64url");
      const badJsonReq = new Request("https://example.com", {
        headers: { Cookie: `__Host-etf-campus-community-pwsetup=${notJson}` },
      });
      expect(readPasswordSetup(badJsonReq)).toBeNull();
    });
  });

  describe("clearPasswordSetupHeaders", () => {
    it("S-7: Max-Age=0으로 pwsetup 쿠키만 만료시키고 세션 쿠키는 건드리지 않음", () => {
      const headers = clearPasswordSetupHeaders();
      const setCookies = headers.getSetCookie();
      expect(setCookies).toHaveLength(1);
      
      const pwCookie = setCookies[0];
      expect(pwCookie).toContain("__Host-etf-campus-community-pwsetup=");
      expect(pwCookie).toContain("Max-Age=0");
    });
  });

  describe("COMMUNITY_SESSION_COOKIE_NAMES", () => {
    it("S-8: PWSETUP_COOKIE가 포함됨", () => {
      expect(Object.values(COMMUNITY_SESSION_COOKIE_NAMES)).toContain("__Host-etf-campus-community-pwsetup");
    });
  });

  describe("getProfileStatus & checkProfileConfigured", () => {
    it("닉네임과 필수 약관 동의(terms_version)가 모두 존재하면 profileConfigured: true를 반환한다", async () => {
      mocks.adminSupabase.mockReturnValue({
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { public_nickname: "Neo", terms_version: "v2026-08-24" },
                error: null,
              }),
            }),
          }),
        }),
      });

      const status = await getProfileStatus({} as any, "6fa34caa-f8c8-49a4-8d7d-e3561e5e9c5c");
      expect(status).toEqual({
        hasNickname: true,
        hasTermsConsent: true,
        profileConfigured: true,
        nickname: "Neo",
        termsVersion: "v2026-08-24",
      });

      const configured = await checkProfileConfigured({} as any, "6fa34caa-f8c8-49a4-8d7d-e3561e5e9c5c");
      expect(configured).toBe(true);
    });

    it("닉네임은 있지만 필수 약관 동의가 누락된 경우 hasNickname: true, hasTermsConsent: false, profileConfigured: false를 분리 반환한다", async () => {
      mocks.adminSupabase.mockReturnValue({
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { public_nickname: "기존연구원", terms_version: null },
                error: null,
              }),
            }),
          }),
        }),
      });

      const status = await getProfileStatus({} as any, "user-uuid-no-terms");
      expect(status.hasNickname).toBe(true);
      expect(status.hasTermsConsent).toBe(false);
      expect(status.profileConfigured).toBe(false);
    });

    it("신규 회원이거나 닉네임이 없으면 hasNickname: false, profileConfigured: false를 반환한다", async () => {
      mocks.adminSupabase.mockReturnValue({
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: null,
                error: null,
              }),
            }),
          }),
        }),
      });

      const status = await getProfileStatus({} as any, "user-new-uuid");
      expect(status.hasNickname).toBe(false);
      expect(status.hasTermsConsent).toBe(false);
      expect(status.profileConfigured).toBe(false);

      const configured = await checkProfileConfigured({} as any, "user-new-uuid");
      expect(configured).toBe(false);
    });

    it("프로필 조회 중 DB 오류가 발생하면 예외를 던져 503 Fail-Closed로 처리되게 한다 (신규 회원 오판 방지)", async () => {
      mocks.adminSupabase.mockReturnValue({
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: null,
                error: { message: "connection timeout" },
              }),
            }),
          }),
        }),
      });

      await expect(getProfileStatus({} as any, "user-uuid-error")).rejects.toThrow(
        "Failed to query user profile"
      );
    });
  });
});
