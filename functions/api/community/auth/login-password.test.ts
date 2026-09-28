import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  parseJsonBody: vi.fn(),
  verifyTurnstile: vi.fn(),
  enforceDatabaseRateLimit: vi.fn(),
  checkProfileConfigured: vi.fn(),
}));

vi.mock("../_lib/supabase", () => ({
  publicSupabase: () => ({
    auth: { signInWithPassword: mocks.signInWithPassword },
  }),
}));

vi.mock("../_lib/request-security", () => ({
  parseJsonBody: mocks.parseJsonBody,
  verifyTurnstile: mocks.verifyTurnstile,
  enforceDatabaseRateLimit: mocks.enforceDatabaseRateLimit,
}));

vi.mock("../_lib/api-security", () => ({
  errorResponse: (status, code, message) => Response.json({ error: { code, message } }, { status }),
}));

vi.mock("../_lib/session", () => ({
  sessionHeaders: () => new Headers(),
  checkProfileConfigured: mocks.checkProfileConfigured,
}));

import { onRequestPost } from "./login-password.js";

function requestContext() {
  return {
    request: new Request("https://example.com/api/community/auth/login-password", {
      method: "POST",
      headers: { "CF-Connecting-IP": "127.0.0.1" }
    }),
    env: {}
  };
}

describe("로그인 열거 방지", () => {
  it("T-10: 존재하지 않는 계정이나 잘못된 비밀번호 모두 동일한 401 응답을 반환한다", async () => {
    mocks.parseJsonBody.mockResolvedValue({ email: "test@example.com", password: "wrong" });
    mocks.verifyTurnstile.mockResolvedValue(null);
    mocks.enforceDatabaseRateLimit.mockResolvedValue(null);
    
    // Case 1: Wrong password
    mocks.signInWithPassword.mockResolvedValueOnce({ error: { message: "Invalid login credentials" }, data: { user: null } });
    const response1 = await onRequestPost(requestContext());
    const body1 = await response1.json();
    
    // Case 2: Non-existent account
    mocks.signInWithPassword.mockResolvedValueOnce({ error: { message: "User not found" }, data: { user: null } });
    const response2 = await onRequestPost(requestContext());
    const body2 = await response2.json();
    
    expect(response1.status).toBe(401);
    expect(response2.status).toBe(401);
    expect(body1).toEqual(body2);
  });

  it("로그인 성공 시 profileConfigured: true와 200 상태코드를 반환한다", async () => {
    mocks.parseJsonBody.mockResolvedValue({ email: "user@example.com", password: "correct-password" });
    mocks.verifyTurnstile.mockResolvedValue(null);
    mocks.enforceDatabaseRateLimit.mockResolvedValue(null);
    mocks.signInWithPassword.mockResolvedValueOnce({
      error: null,
      data: {
        session: { access_token: "access_123", refresh_token: "refresh_123" },
        user: { id: "user_uuid_123", email: "user@example.com" },
      },
    });
    mocks.checkProfileConfigured.mockResolvedValueOnce(true);

    const response = await onRequestPost(requestContext());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ authenticated: true, profileConfigured: true });
    expect(mocks.checkProfileConfigured).toHaveBeenCalledWith(expect.anything(), "user_uuid_123");
  });

  it("온보딩 미완료 계정 로그인 성공 시 profileConfigured: false를 반환한다", async () => {
    mocks.parseJsonBody.mockResolvedValue({ email: "new@example.com", password: "correct-password" });
    mocks.verifyTurnstile.mockResolvedValue(null);
    mocks.enforceDatabaseRateLimit.mockResolvedValue(null);
    mocks.signInWithPassword.mockResolvedValueOnce({
      error: null,
      data: {
        session: { access_token: "access_456", refresh_token: "refresh_456" },
        user: { id: "user_uuid_456", email: "new@example.com" },
      },
    });
    mocks.checkProfileConfigured.mockResolvedValueOnce(false);

    const response = await onRequestPost(requestContext());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ authenticated: true, profileConfigured: false });
  });
});
