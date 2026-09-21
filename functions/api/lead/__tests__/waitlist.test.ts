import { describe, expect, it, vi } from "vitest";

import { onRequestPost } from "../waitlist";

interface WaitlistResponse {
  success?: boolean;
  error?: { code?: string; message?: string };
  message?: string;
}

describe("Lead Waitlist API (POST /api/lead/waitlist)", () => {
  it("잘못된 본문(비 JSON)에 대해 400 VALIDATION_ERROR를 반환한다", async () => {
    const invalidRequest = new Request("https://etfcampus.pages.dev/api/lead/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });

    const response = await onRequestPost({ request: invalidRequest });
    expect(response.status).toBe(400);
    const body = (await response.json()) as WaitlistResponse;
    expect(body.error?.code).toBe("VALIDATION_ERROR");
  });

  it("필수 동의(agreeRequired) 누락 시 400 VALIDATION_ERROR를 반환한다", async () => {
    const noConsentRequest = new Request("https://etfcampus.pages.dev/api/lead/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "user@example.com",
        agreeRequired: false,
      }),
    });

    const response = await onRequestPost({ request: noConsentRequest });
    expect(response.status).toBe(400);
    const body = (await response.json()) as WaitlistResponse;
    expect(body.error?.message).toContain("동의");
  });

  it("유효하지 않은 이메일 형식에 대해 400 VALIDATION_ERROR를 반환한다", async () => {
    const invalidEmailRequest = new Request("https://etfcampus.pages.dev/api/lead/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "invalid-email-no-at",
        agreeRequired: true,
      }),
    });

    const response = await onRequestPost({ request: invalidEmailRequest });
    expect(response.status).toBe(400);
    const body = (await response.json()) as WaitlistResponse;
    expect(body.error?.message).toContain("유효한 이메일");
  });

  it("정상 요청 시 D1 바인딩이 있을 때 INSERT 쿼리를 실행하고 201을 반환한다", async () => {
    const mockRun = vi.fn().mockResolvedValue({ success: true });
    const mockBind = vi.fn().mockReturnValue({ run: mockRun });
    const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });

    const validRequest = new Request("https://etfcampus.pages.dev/api/lead/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "investor@example.com",
        interest: "dc_irp",
        source: "compare_bridge",
        agreeRequired: true,
      }),
    });

    const response = await onRequestPost({
      request: validRequest,
      env: { ETF_PRICES: { prepare: mockPrepare } },
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as WaitlistResponse;
    expect(body.success).toBe(true);
    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO lead_waitlist"));
    expect(mockBind).toHaveBeenCalledWith("investor@example.com", "dc_irp", "compare_bridge");
  });

  it("D1 바인딩이 없거나 DB 에러가 발생해도 Graceful Fallback으로 201을 반환한다", async () => {
    const mockPrepare = vi.fn().mockImplementation(() => {
      throw new Error("D1 Table not migrated yet");
    });

    const validRequest = new Request("https://etfcampus.pages.dev/api/lead/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "fallback@example.com",
        agreeRequired: true,
      }),
    });

    const response = await onRequestPost({
      request: validRequest,
      env: { ETF_PRICES: { prepare: mockPrepare } },
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as WaitlistResponse;
    expect(body.success).toBe(true);
  });
});
