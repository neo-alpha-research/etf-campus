import { describe, expect, it, vi } from "vitest";

import { onRequestPost } from "../waitlist";

interface WaitlistResponse {
  success?: boolean;
  error?: { code?: string; message?: string };
  message?: string;
}

// 민감정보가 제거된 실제 Cloudflare D1 관측 픽스처 (Anonymized D1 Observation Fixture)
const REAL_D1_OBSERVATION_FIXTURE = {
  success: true,
  meta: {
    served_by: "v3-prod",
    duration: 1.82,
    changes: 1,
    last_row_id: 1,
    changed_db: true,
    size_after: 32768,
    rows_read: 1,
    rows_written: 1,
  },
};

describe("Lead Waitlist API (POST /api/lead/waitlist) - Fail-Closed & Operational Hardening", () => {
  it("비 JSON 본문 요청에 대해 400 VALIDATION_ERROR를 반환한다", async () => {
    const invalidRequest = new Request("https://etfcampus.pages.dev/api/lead/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json-content",
    });

    const response = await onRequestPost({ request: invalidRequest });
    expect(response.status).toBe(400);
    const body = (await response.json()) as WaitlistResponse;
    expect(body.error?.code).toBe("VALIDATION_ERROR");
  });

  it("허용 크기(4KB) 초과 요청에 대해 400 VALIDATION_ERROR를 반환한다", async () => {
    const largeRequest = new Request("https://etfcampus.pages.dev/api/lead/waitlist", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": "5000",
      },
      body: JSON.stringify({
        email: "user@example.com",
        interest: "a".repeat(4500),
        agreeRequired: true,
      }),
    });

    const response = await onRequestPost({ request: largeRequest });
    expect(response.status).toBe(400);
    const body = (await response.json()) as WaitlistResponse;
    expect(body.error?.code).toBe("VALIDATION_ERROR");
    expect(body.error?.message).toContain("4KB");
  });

  it("Content-Type이 application/json이 아닌 경우 400 VALIDATION_ERROR를 반환한다", async () => {
    const nonJsonRequest = new Request("https://etfcampus.pages.dev/api/lead/waitlist", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "email=user@example.com",
    });

    const response = await onRequestPost({ request: nonJsonRequest });
    expect(response.status).toBe(400);
    const body = (await response.json()) as WaitlistResponse;
    expect(body.error?.code).toBe("VALIDATION_ERROR");
  });

  it("필수 동의(agreeRequired === true) 누락 시 400 VALIDATION_ERROR를 반환한다", async () => {
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
    expect(body.error?.code).toBe("VALIDATION_ERROR");
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
    expect(body.error?.code).toBe("VALIDATION_ERROR");
    expect(body.error?.message).toContain("유효한 이메일");
  });

  it("[Fail-Closed] D1 바인딩(ETF_PRICES) 누락 시 성공 응답을 금지하고 503 UNAVAILABLE을 반환한다", async () => {
    const validRequest = new Request("https://etfcampus.pages.dev/api/lead/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "investor@example.com",
        agreeRequired: true,
      }),
    });

    const response = await onRequestPost({
      request: validRequest,
      env: {},
    });

    expect(response.status).toBe(503);
    const body = (await response.json()) as WaitlistResponse;
    expect(body.success).toBeFalsy();
    expect(body.error?.code).toBe("UNAVAILABLE");
    expect(body.error?.message).toContain("저장소 연결이 준비되지 않았습니다");
  });

  it("[Fail-Closed] D1 테이블 미적용(쿼리 예외 발생) 시 성공을 가장하지 않고 500 UNAVAILABLE을 반환한다", async () => {
    const mockPrepare = vi.fn().mockImplementation(() => {
      throw new Error("no such table: lead_waitlist");
    });

    const validRequest = new Request("https://etfcampus.pages.dev/api/lead/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "investor@example.com",
        agreeRequired: true,
      }),
    });

    const response = await onRequestPost({
      request: validRequest,
      env: { ETF_PRICES: { prepare: mockPrepare } },
    });

    expect(response.status).toBe(500);
    const body = (await response.json()) as WaitlistResponse;
    expect(body.success).toBeFalsy();
    expect(body.error?.code).toBe("UNAVAILABLE");
    expect(body.error?.message).toContain("대기자 정보 저장 중 오류가 발생했습니다");
  });

  it("[Fail-Closed] D1 run() 결과가 실패({ success: false })인 경우 500 UNAVAILABLE을 반환한다", async () => {
    const mockRun = vi.fn().mockResolvedValue({ success: false });
    const mockBind = vi.fn().mockReturnValue({ run: mockRun });
    const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });

    const validRequest = new Request("https://etfcampus.pages.dev/api/lead/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "investor@example.com",
        agreeRequired: true,
      }),
    });

    const response = await onRequestPost({
      request: validRequest,
      env: { ETF_PRICES: { prepare: mockPrepare } },
    });

    expect(response.status).toBe(500);
    const body = (await response.json()) as WaitlistResponse;
    expect(body.success).toBeFalsy();
    expect(body.error?.code).toBe("UNAVAILABLE");
    expect(body.error?.message).toContain("데이터베이스에 접수 내역을 기록하지 못했습니다");
  });

  it("[실제 D1 관측 픽스처] 정상 요청 및 저장 성공 시 ON CONFLICT 멱등 쿼리를 실행하고 201을 반환한다", async () => {
    const mockRun = vi.fn().mockResolvedValue(REAL_D1_OBSERVATION_FIXTURE);
    const mockBind = vi.fn().mockReturnValue({ run: mockRun });
    const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });

    const validRequest = new Request("https://etfcampus.pages.dev/api/lead/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "investor@example.com",
        interest: "dc_irp",
        source: "compare_bridge",
        campaign: "challenge_guide_2026",
        termsVersion: "v1.0",
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
    expect(body.message).toContain("출시 알림 신청이 정상적으로 완료되었습니다");

    // ON CONFLICT 및 파라미터 바인딩 검증
    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO lead_waitlist"));
    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining("ON CONFLICT(email, campaign) DO UPDATE"));
    expect(mockBind).toHaveBeenCalledWith(
      "investor@example.com",
      "dc_irp",
      "compare_bridge",
      "challenge_guide_2026",
      "v1.0"
    );
  });
});
