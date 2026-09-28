import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  parseJsonBody: vi.fn(),
  verifyTurnstile: vi.fn(),
  enforceDatabaseRateLimit: vi.fn(),
  getProfileStatus: vi.fn(),
  checkProfileConfigured: vi.fn(),
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
  sessionHeaders: () => {
    const headers = new Headers();
    headers.append("Set-Cookie", "__Host-etf-campus-community-at=mock-at; HttpOnly; Secure; Max-Age=3600");
    headers.append("Set-Cookie", "__Host-etf-campus-community-rt=mock-rt; HttpOnly; Secure; Max-Age=2592000");
    headers.append("Set-Cookie", "__Host-etf-campus-community-csrf=mock-csrf; Secure; Max-Age=2592000");
    headers.set("X-Community-CSRF", "mock-csrf");
    return headers;
  },
  getProfileStatus: mocks.getProfileStatus,
  checkProfileConfigured: mocks.checkProfileConfigured,
}));

import { onRequestPost } from "./verify-otp.js";

function requestContext() {
  return {
    request: new Request("https://example.com/api/community/auth/verify-otp", {
      method: "POST",
      headers: { "CF-Connecting-IP": "203.0.113.10" },
    }),
    env: {},
  };
}

describe("커뮤니티 8자리 이메일 OTP 검증 및 회원 분기", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.parseJsonBody.mockResolvedValue({
      email: "member@example.com",
      token: "12345678",
      captchaToken: "fresh-captcha-token",
      purpose: "login",
    });
    mocks.verifyTurnstile.mockResolvedValue(null);
    mocks.enforceDatabaseRateLimit.mockResolvedValue(null);
    mocks.verifyOtp.mockResolvedValue({
      data: { session: { access_token: "test-access-token" }, user: { id: "test-uuid-1234", email: "member@example.com" } },
      error: null,
    });
    mocks.getProfileStatus.mockResolvedValue({
      hasNickname: false,
      hasTermsConsent: false,
      profileConfigured: false,
    });
  });

  it("신규 회원(닉네임 및 약관 미완료)은 password-setup 쿠키와 함께 가입 안내를 반환한다", async () => {
    mocks.getProfileStatus.mockResolvedValue({
      hasNickname: false,
      hasTermsConsent: false,
      profileConfigured: false,
    });

    const response = await onRequestPost(requestContext());
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({
      authenticated: true,
      profileConfigured: false,
      hasNickname: false,
      hasTermsConsent: false,
      needsTermsConsent: true,
      passwordSetupRequired: true,
      isNewUser: true,
      user: { id: "test-uuid-1234", email: "member@example.com", nickname: null },
    });

    const setCookie = response.headers.get("Set-Cookie");
    expect(setCookie).toContain("__Host-etf-campus-community-pwsetup=");
  });

  it("기존 회원(neo.alpharesearch: UUID, 닉네임, 필수약관 보존)은 비밀번호 설정 없이 정식 세션 쿠키를 발급받고 즉시 복귀한다", async () => {
    const neoUserId = "6fa34caa-f8c8-49a4-8d7d-e3561e5e9c5c";
    mocks.parseJsonBody.mockResolvedValue({
      email: "neo.alpharesearch@gmail.com",
      token: "12345678",
      captchaToken: "fresh-captcha-token",
      purpose: "login",
    });
    mocks.verifyOtp.mockResolvedValue({
      data: { session: { access_token: "test-access-token" }, user: { id: neoUserId, email: "neo.alpharesearch@gmail.com" } },
      error: null,
    });
    mocks.getProfileStatus.mockResolvedValue({
      hasNickname: true,
      hasTermsConsent: true,
      profileConfigured: true,
      nickname: "Neo",
      termsVersion: "v2026-08-24",
    });

    const response = await onRequestPost(requestContext());
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({
      authenticated: true,
      profileConfigured: true,
      hasNickname: true,
      hasTermsConsent: true,
      passwordSetupRequired: false,
      needsTermsConsent: false,
      isNewUser: false,
      user: { id: neoUserId, email: "neo.alpharesearch@gmail.com", nickname: "Neo" },
    });

    // 정식 세션 쿠키(at, rt, csrf) 발급 확인
    const setCookie = response.headers.get("Set-Cookie");
    expect(setCookie).toContain("__Host-etf-campus-community-at=");
  });

  it("닉네임은 있지만 필수 약관 동의가 누락된 기존 회원은 비밀번호 설정 없이(passwordSetupRequired: false) 정식 세션 쿠키와 함께 약관 동의 화면으로 직행한다", async () => {
    mocks.getProfileStatus.mockResolvedValue({
      hasNickname: true,
      hasTermsConsent: false,
      profileConfigured: false,
      nickname: "기존유저",
      termsVersion: null,
    });

    const response = await onRequestPost(requestContext());
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({
      authenticated: true,
      profileConfigured: false,
      hasNickname: true,
      hasTermsConsent: false,
      needsTermsConsent: true,
      passwordSetupRequired: false,
      isNewUser: false, // 닉네임이 있으므로 신규 유저가 아님
      user: { id: "test-uuid-1234", email: "member@example.com", nickname: "기존유저" },
    });

    // 정식 세션 쿠키가 발급되어 약관 동의를 즉시 저장할 수 있음을 확인
    const setCookie = response.headers.get("Set-Cookie");
    expect(setCookie).toContain("__Host-etf-campus-community-at=");
  });

  it("기존 회원이라도 사용자가 명시적으로 비밀번호 재설정(purpose: 'reset_password')을 요청한 경우 password-setup으로 진입한다", async () => {
    mocks.checkProfileConfigured.mockResolvedValue(true);
    mocks.parseJsonBody.mockResolvedValue({
      email: "member@example.com",
      token: "12345678",
      captchaToken: "fresh-captcha-token",
      purpose: "reset_password",
    });

    const response = await onRequestPost(requestContext());
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({
      authenticated: true,
      passwordSetupRequired: true,
      isPasswordReset: true,
      user: { id: "test-uuid-1234", email: "member@example.com" },
    });

    const setCookie = response.headers.get("Set-Cookie");
    expect(setCookie).toContain("__Host-etf-campus-community-pwsetup=");
    // 재설정 모드이므로 getProfileStatus 호출을 건너뜀
    expect(mocks.getProfileStatus).not.toHaveBeenCalled();
  });

  it("프로필 조회 중 DB 오류가 발생하면 503 UNAVAILABLE을 반환하여 기존 회원을 신규 회원으로 오판하지 않는다", async () => {
    mocks.getProfileStatus.mockRejectedValue(new Error("Database connection timeout"));

    const response = await onRequestPost(requestContext());
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error?.code).toBe("UNAVAILABLE");
  });

  it("6자리 코드는 Supabase 검증 호출 전에 400으로 거부한다", async () => {
    mocks.parseJsonBody.mockResolvedValue({
      email: "member@example.com",
      token: "123456",
      captchaToken: "fresh-captcha-token",
    });

    const response = await onRequestPost(requestContext());
    expect(response.status).toBe(400);
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
  });

  it("유효하지 않은 OTP는 최신 8자리 코드 안내와 함께 401로 거부한다", async () => {
    mocks.verifyOtp.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: "token has expired or is invalid" },
    });

    const response = await onRequestPost(requestContext());
    expect(response.status).toBe(401);
  });
});
