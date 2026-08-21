import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  parseJsonBody: vi.fn(),
  verifyTurnstile: vi.fn(),
  enforceDatabaseRateLimit: vi.fn(),
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
});
