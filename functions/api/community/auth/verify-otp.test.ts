import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  parseJsonBody: vi.fn(),
  verifyTurnstile: vi.fn(),
  enforceDatabaseRateLimit: vi.fn(),
}));

vi.mock("../_lib/supabase", () => ({
  publicSupabase: () => ({
    auth: { verifyOtp: mocks.verifyOtp },
  }),
}));

vi.mock("../_lib/request-security", () => ({
  parseJsonBody: mocks.parseJsonBody,
  verifyTurnstile: mocks.verifyTurnstile,
  enforceDatabaseRateLimit: mocks.enforceDatabaseRateLimit,
}));

vi.mock("../_lib/api-security", () => ({
  errorResponse: (status: number, code: string, message: string) => Response.json({ error: { code, message } }, { status }),
}));

vi.mock("../_lib/session", () => ({
  passwordSetupHeaders: () => {
    const headers = new Headers();
    headers.append("Set-Cookie", "__Host-etf-campus-community-pwsetup=mock; HttpOnly; Secure; Max-Age=600");
    headers.set("X-Community-CSRF", "mock-csrf");
    return headers;
  },
}));

import { onRequestPost } from "./verify-otp.js";

function requestContext() {
  return {
    request: new Request("https://preview.example.com/api/community/auth/verify-otp", {
      method: "POST",
      headers: { "CF-Connecting-IP": "203.0.113.10" },
    }),
    env: {},
  };
}

describe("커뮤니티 8자리 이메일 OTP 검증", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.parseJsonBody.mockResolvedValue({
      email: "member@example.com",
      token: "12345678",
      captchaToken: "fresh-captcha-token",
    });
    mocks.verifyTurnstile.mockResolvedValue(null);
    mocks.enforceDatabaseRateLimit.mockResolvedValue(null);
    mocks.verifyOtp.mockResolvedValue({
      data: { session: { access_token: "test-access-token" }, user: { id: "test-user" } },
      error: null,
    });
  });

  it("8자리 숫자 코드를 검증하고 임시 세션 토큰을 쿠키로 반환하며 본문에는 토큰을 포함하지 않는다", async () => {
    const response = await onRequestPost(requestContext());

    expect(response.status).toBe(200);
    expect(mocks.verifyOtp).toHaveBeenCalledWith({
      email: "member@example.com",
      token: "12345678",
      type: "email",
    });
    
    // Check that tempAccessToken/tempRefreshToken are not in the response body
    const body = await response.json();
    expect(body).toEqual({
      authenticated: true,
      passwordSetupRequired: true,
    });
    
    // Check that Set-Cookie header contains pwsetup cookie and CSRF header is present
    const setCookie = response.headers.get("Set-Cookie");
    expect(setCookie).toContain("__Host-etf-campus-community-pwsetup=");
    expect(setCookie).toContain("Max-Age=600");
    
    const csrfHeader = response.headers.get("X-Community-CSRF");
    expect(csrfHeader).toBe("mock-csrf");
  });

  it("6자리 코드는 Supabase 검증 호출 전에 거부한다", async () => {
    mocks.parseJsonBody.mockResolvedValue({
      email: "member@example.com",
      token: "123456",
      captchaToken: "fresh-captcha-token",
    });

    const response = await onRequestPost(requestContext());

    expect(response.status).toBe(400);
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      error: { code: "VALIDATION_ERROR", message: "이메일과 8자리 인증 코드를 확인해 주세요." },
    });
  });

  it("유효하지 않은 OTP는 최신 8자리 코드 안내와 함께 거부한다", async () => {
    mocks.verifyOtp.mockResolvedValue({ data: { session: null, user: null }, error: { message: "token has expired or is invalid" } });

    const response = await onRequestPost(requestContext());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: { code: "AUTH_REQUIRED", message: "인증 코드가 올바르지 않거나 만료되었습니다. 가장 최근에 받은 8자리 코드로 다시 시도해 주세요." },
    });
  });
});
