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
  sessionHeaders: () => ({ "Content-Type": "application/json" }),
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

  it("8자리 숫자 코드를 Supabase email OTP 검증에 전달한다", async () => {
    const response = await onRequestPost(requestContext());

    expect(response.status).toBe(200);
    expect(mocks.verifyOtp).toHaveBeenCalledWith({
      email: "member@example.com",
      token: "12345678",
      type: "email",
    });
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
  });
});
