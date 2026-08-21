// @ts-nocheck
import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyTurnstile } from "./request-security.js";

const ORIGINAL_FETCH = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  vi.restoreAllMocks();
});

describe("Turnstile rate-limit 오류 전파", () => {
  it("rate-limit 보안 구성이 없을 때 CAPTCHA 재사용 오류로 덮어쓰지 않고 503을 반환한다", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          hostname: "community-phase-3-preview-rc.etf-campus.pages.dev",
          action: "community_otp_request",
          challenge_ts: new Date().toISOString(),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const context = {
      request: new Request("https://community-phase-3-preview-rc.etf-campus.pages.dev/api/community/auth/request-otp", {
        headers: { "CF-Connecting-IP": "203.0.113.10" },
      }),
      env: {
        COMMUNITY_ENVIRONMENT: "preview",
        TURNSTILE_REQUIRED: "true",
        TURNSTILE_SECRET_KEY: "test-secret",
        TURNSTILE_EXPECTED_HOSTNAME: "community-phase-3-preview-rc.etf-campus.pages.dev",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      },
    };

    const response = await verifyTurnstile(context, "fresh-token", "community_otp_request");
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: {
        code: "CONFIGURATION_ERROR",
        message: "보안 설정을 확인해 주세요.",
      },
    });
    expect(consoleError).toHaveBeenCalledWith("community rate limit unavailable", { scope: "turnstile-token" });
  });

  it("rate-limit 재사용 제한일 때에만 CAPTCHA 재사용 오류로 변환한다", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          hostname: "community-phase-3-preview-rc.etf-campus.pages.dev",
          action: "community_otp_request",
          challenge_ts: new Date().toISOString(),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const context = {
      request: new Request("https://community-phase-3-preview-rc.etf-campus.pages.dev/api/community/auth/request-otp"),
      env: {
        COMMUNITY_ENVIRONMENT: "preview",
        TURNSTILE_REQUIRED: "true",
        TURNSTILE_SECRET_KEY: "test-secret",
        TURNSTILE_EXPECTED_HOSTNAME: "community-phase-3-preview-rc.etf-campus.pages.dev",
        COMMUNITY_RATE_LIMIT_SALT: "test-rate-limit-salt",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      },
    };

    const response = await verifyTurnstile(context, "fresh-token", "community_otp_request");
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: {
        code: "CAPTCHA_REQUIRED",
        message: "이미 사용했거나 만료된 보안 확인입니다. 다시 시도해 주세요.",
      },
    });
  });
});
