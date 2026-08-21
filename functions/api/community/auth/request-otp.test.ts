// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
  parseJsonBody: vi.fn(),
  verifyTurnstile: vi.fn(),
  enforceDatabaseRateLimit: vi.fn(),
}));

vi.mock("../_lib/supabase", () => ({
  publicSupabase: () => ({
    auth: { signInWithOtp: mocks.signInWithOtp },
  }),
}));

vi.mock("../_lib/request-security", () => ({
  parseJsonBody: mocks.parseJsonBody,
  verifyTurnstile: mocks.verifyTurnstile,
  enforceDatabaseRateLimit: mocks.enforceDatabaseRateLimit,
}));

vi.mock("../_lib/api-security", () => ({
  errorResponse: (status: number, code: string, message: string) => Response.json({ error: { code, message } }, { status }),
  jsonResponse: (body: unknown, status = 200) => Response.json(body, { status }),
}));

import { onRequestPost } from "./request-otp.js";

function requestContext() {
  return {
    request: new Request("https://preview.example.com/api/community/auth/request-otp", {
      method: "POST",
      headers: { "CF-Connecting-IP": "203.0.113.10" },
    }),
    env: {},
  };
}

describe("커뮤니티 OTP 발송 실패 처리", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.parseJsonBody.mockResolvedValue({
      email: "member@example.com",
      captchaToken: "fresh-captcha-token",
    });
    mocks.verifyTurnstile.mockResolvedValue(null);
    mocks.enforceDatabaseRateLimit.mockResolvedValue(null);
  });

  it("Supabase 발송 오류를 성공 응답으로 숨기지 않고 안전한 503으로 반환한다", async () => {
    mocks.signInWithOtp.mockResolvedValue({
      error: { code: "smtp_error", status: 500, message: "SMTP password rejected" },
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await onRequestPost(requestContext());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: {
        code: "UNAVAILABLE",
        message: "인증 코드를 보낼 수 없습니다. 잠시 후 다시 시도해 주세요.",
      },
    });
    expect(JSON.stringify(body)).not.toContain("smtp_error");
    expect(JSON.stringify(body)).not.toContain("SMTP password rejected");
    expect(consoleError).toHaveBeenCalledWith("community OTP dispatch failed", {
      code: "smtp_error",
      status: 500,
    });
  });

  it("Supabase 발송 성공 시에만 중립적인 성공 응답을 반환한다", async () => {
    mocks.signInWithOtp.mockResolvedValue({ error: null });

    const response = await onRequestPost(requestContext());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      message: "입력한 이메일을 확인해 주세요. 계정이 있는 경우 인증 코드를 보냈습니다. 메일함과 스팸함을 확인해 주세요.",
    });
  });
});
