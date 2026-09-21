import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateUser: vi.fn(),
  signOut: vi.fn(),
  signInWithPassword: vi.fn(),
  parseJsonBody: vi.fn(),
  verifyTurnstile: vi.fn(),
  enforceDatabaseRateLimit: vi.fn(),
}));

vi.mock("../_lib/supabase", () => ({
  publicSupabase: () => ({
    auth: {
      updateUser: mocks.updateUser,
      signOut: mocks.signOut,
      signInWithPassword: mocks.signInWithPassword,
    },
  }),
  adminSupabase: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: { public_nickname: "testuser" }, error: null }),
        }),
      }),
    }),
  }),
}));

vi.mock("../_lib/request-security", () => ({
  parseJsonBody: mocks.parseJsonBody,
  verifyTurnstile: mocks.verifyTurnstile,
  enforceDatabaseRateLimit: mocks.enforceDatabaseRateLimit,
}));

vi.mock("../_lib/api-security", () => ({
  errorResponse: (status, code, message) => Response.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }),
  jsonResponse: (body, status) => Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }),
}));

import { passwordSetupHeaders } from "../_lib/session.js";

function getSetupCookie(rememberMe = true) {
  const headers = passwordSetupHeaders({ access_token: "temp-access", refresh_token: "ignored" }, { rememberMe });
  for (const cookie of headers.getSetCookie()) {
    if (cookie.startsWith("__Host-etf-campus-community-pwsetup=")) {
      return cookie.split(";")[0];
    }
  }
  return "";
}

import { onRequestPost } from "./set-password.js";

function requestContext(cookie) {
  const cookieValue = cookie !== undefined ? cookie : getSetupCookie(true);
  return {
    request: new Request("https://preview.example.com/api/community/auth/set-password", {
      method: "POST",
      headers: { 
        "CF-Connecting-IP": "203.0.113.10",
        Cookie: cookieValue,
      },
    }),
    env: {},
  };
}

describe("커뮤니티 비밀번호 설정", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.parseJsonBody.mockResolvedValue({
      password: "valid-password-123",
      captchaToken: "fresh-captcha-token",
    });
    mocks.verifyTurnstile.mockResolvedValue(null);
    mocks.enforceDatabaseRateLimit.mockResolvedValue(null);
    mocks.updateUser.mockResolvedValue({
      data: { user: { id: "test-user", email: "test@example.com" } },
      error: null,
    });
    mocks.signInWithPassword.mockResolvedValue({
      data: { session: { access_token: "new-access", refresh_token: "new-refresh" }, user: { id: "test-user" } },
      error: null,
    });
    mocks.signOut.mockResolvedValue({ error: null });
  });

  it("단기 쿠키가 없으면 401을 반환한다", async () => {
    const response = await onRequestPost(requestContext(""));
    expect(response.status).toBe(401);
  });

  it("Turnstile 검증을 수행한다", async () => {
    mocks.verifyTurnstile.mockResolvedValue(Response.json({ error: "captcha failed" }, { status: 400 }));
    const response = await onRequestPost(requestContext());
    expect(response.status).toBe(400);
    expect(mocks.verifyTurnstile).toHaveBeenCalled();
  });

  it("정상적으로 비밀번호를 변경하고 세션을 교체한다 (rememberMe: true)", async () => {
    const response = await onRequestPost(requestContext());
    expect(response.status).toBe(200);
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: "valid-password-123" });
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "global" });
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: "test@example.com", password: "valid-password-123" });
    const setCookies = response.headers.getSetCookie();
    expect(setCookies.length).toBeGreaterThan(0);
    const refreshCookie = setCookies.find(c => c.startsWith("__Host-etf-campus-community-rt="));
    expect(refreshCookie).toContain("Max-Age=2592000"); // rememberMe: true
  });

  it("정상적으로 비밀번호를 변경하고 세션을 교체한다 (rememberMe: false)", async () => {
    const response = await onRequestPost(requestContext(getSetupCookie(false)));
    expect(response.status).toBe(200);
    const setCookies = response.headers.getSetCookie();
    const refreshCookie = setCookies.find(c => c.startsWith("__Host-etf-campus-community-rt="));
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).not.toContain("Max-Age="); // rememberMe: false
  });

  it("비밀번호 설정 토큰을 1회용으로 강제한다 (429 반환)", async () => {
    mocks.enforceDatabaseRateLimit.mockImplementation(async (_ctx, limitName, _key) => {
      if (limitName === "password-set-token") return Response.json({ error: "rate limited" }, { status: 429 });
      return null;
    });
    const response = await onRequestPost(requestContext());
    expect(response.status).toBe(429);
  });

  it("속도 제한 503 오류 발생 시 503을 유지한다 (429로 덮어쓰지 않음)", async () => {
    mocks.enforceDatabaseRateLimit.mockImplementation(async (_ctx, limitName, _key) => {
      if (limitName === "password-set-token") return Response.json({ error: { code: "CONFIGURATION_ERROR" } }, { status: 503 });
      return null;
    });
    const response = await onRequestPost(requestContext());
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error.code).toBe("CONFIGURATION_ERROR");
  });

  it("IP 속도 제한 발생 시 원본 429를 반환한다", async () => {
    mocks.enforceDatabaseRateLimit.mockImplementation(async (_ctx, limitName, _key) => {
      if (limitName === "password-set-ip") return Response.json({ error: { code: "RATE_LIMITED" } }, { status: 429 });
      return null;
    });
    const response = await onRequestPost(requestContext());
    expect(response.status).toBe(429);
  });

  it("비밀번호 변경 후 자동 로그인에 실패하면 503 UNAVAILABLE을 반환하고 passwordChanged: true를 넘긴다", async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: { message: "Internal Error" } });
    const response = await onRequestPost(requestContext());
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error.code).toBe("UNAVAILABLE");
    expect(body.error.message).toContain("정상 변경되었습니다");
    expect(body.passwordChanged).toBe(true);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});
