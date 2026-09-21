import { describe, expect, it, vi } from "vitest";

import { onRequestPost } from "../waitlist";

interface WaitlistResponse {
  success?: boolean;
  alreadySent?: boolean;
  error?: { code?: string; message?: string };
  message?: string;
}

// 민감정보가 제거된 실제 Cloudflare D1 관측 픽스처 (Anonymized D1 Observation Fixture)
const REAL_D1_OBSERVATION_FIXTURE = {
  success: true,
  meta: {
    served_by: "v3-prod",
    served_by_region: "APAC",
    served_by_colo: "ICN",
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

  it("Content-Length 헤더가 명시된 4KB 초과 요청에 대해 400 VALIDATION_ERROR를 반환한다", async () => {
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
        campaign: "challenge_guide_2026",
        termsVersion: "v1.0",
      }),
    });

    const response = await onRequestPost({ request: largeRequest });
    expect(response.status).toBe(400);
    const body = (await response.json()) as WaitlistResponse;
    expect(body.error?.code).toBe("VALIDATION_ERROR");
    expect(body.error?.message).toContain("4KB");
  });

  it("Content-Length 헤더가 누락되었더라도 실제 본문이 4KB를 초과하면 스트림 중단 후 400을 반환한다", async () => {
    const largeBodyWithoutLength = JSON.stringify({
      email: "user@example.com",
      interest: "b".repeat(4500),
      agreeRequired: true,
      campaign: "challenge_guide_2026",
      termsVersion: "v1.0",
    });

    const largeRequest = new Request("https://etfcampus.pages.dev/api/lead/waitlist", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: largeBodyWithoutLength,
    });

    const response = await onRequestPost({ request: largeRequest });
    expect(response.status).toBe(400);
    const body = (await response.json()) as WaitlistResponse;
    expect(body.error?.code).toBe("VALIDATION_ERROR");
    expect(body.error?.message).toContain("4KB");
  });

  it("정확히 4096바이트 경계값 요청은 정상 허용되고, 4097바이트 초과 요청은 즉시 거부된다", async () => {
    const prefix = JSON.stringify({
      email: "boundary@example.com",
      agreeRequired: true,
      campaign: "challenge_guide_2026",
      termsVersion: "v1.0",
      interest: "",
    });

    // 1. 4097바이트 초과 페이로드
    const neededOver = 4097 - new TextEncoder().encode(prefix).length;
    const body4097 = JSON.stringify({
      email: "boundary@example.com",
      agreeRequired: true,
      campaign: "challenge_guide_2026",
      termsVersion: "v1.0",
      interest: "x".repeat(neededOver),
    });
    expect(new TextEncoder().encode(body4097).length).toBe(4097);

    const resOver = await onRequestPost({
      request: new Request("https://etfcampus.pages.dev/api/lead/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body4097,
      }),
    });
    expect(resOver.status).toBe(400);

    // 2. 정확히 4096바이트 경계값 페이로드
    const neededExact = 4096 - new TextEncoder().encode(prefix).length;
    const body4096 = JSON.stringify({
      email: "boundary@example.com",
      agreeRequired: true,
      campaign: "challenge_guide_2026",
      termsVersion: "v1.0",
      interest: "x".repeat(neededExact),
    });
    expect(new TextEncoder().encode(body4096).length).toBe(4096);

    const mockRun = vi.fn().mockResolvedValue({ success: true });
    const mockFirst = vi.fn().mockImplementation(() => {
      return Promise.resolve({ count: 1, reset_at: Math.floor(Date.now() / 1000) + 60 });
    });
    const mockBind = vi.fn().mockReturnValue({ run: mockRun, first: mockFirst });
    const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });

    const resExact = await onRequestPost({
      request: new Request("https://etfcampus.pages.dev/api/lead/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body4096,
      }),
      env: { ETF_PRICES: { prepare: mockPrepare } },
    });
    expect(resExact.status).toBe(201);
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
        campaign: "challenge_guide_2026",
        termsVersion: "v1.0",
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
        email: "not-an-email",
        agreeRequired: true,
        campaign: "challenge_guide_2026",
        termsVersion: "v1.0",
      }),
    });

    const response = await onRequestPost({ request: invalidEmailRequest });
    expect(response.status).toBe(400);
    const body = (await response.json()) as WaitlistResponse;
    expect(body.error?.code).toBe("VALIDATION_ERROR");
    expect(body.error?.message).toContain("유효한 이메일");
  });

  it("화이트리스트에 없는 캠페인 식별자 요청에 대해 400 VALIDATION_ERROR를 반환한다", async () => {
    const invalidCampaignRequest = new Request("https://etfcampus.pages.dev/api/lead/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "user@example.com",
        agreeRequired: true,
        campaign: "unknown_campaign_hijack",
        termsVersion: "v1.0",
      }),
    });

    const response = await onRequestPost({ request: invalidCampaignRequest });
    expect(response.status).toBe(400);
    const body = (await response.json()) as WaitlistResponse;
    expect(body.error?.code).toBe("VALIDATION_ERROR");
    expect(body.error?.message).toContain("허용되지 않거나 위변조된 캠페인");
  });

  it("서버 기준과 다른 약관 버전(termsVersion) 요청에 대해 400 VALIDATION_ERROR를 반환한다", async () => {
    const invalidTermsRequest = new Request("https://etfcampus.pages.dev/api/lead/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "user@example.com",
        agreeRequired: true,
        campaign: "challenge_guide_2026",
        termsVersion: "v999.0",
      }),
    });

    const response = await onRequestPost({ request: invalidTermsRequest });
    expect(response.status).toBe(400);
    const body = (await response.json()) as WaitlistResponse;
    expect(body.error?.code).toBe("VALIDATION_ERROR");
    expect(body.error?.message).toContain("약관 버전");
  });

  it("[Fail-Closed] D1 바인딩(ETF_PRICES) 누락 시 성공 응답을 금지하고 503 UNAVAILABLE을 반환한다", async () => {
    const validRequest = new Request("https://etfcampus.pages.dev/api/lead/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "investor@example.com",
        agreeRequired: true,
        campaign: "challenge_guide_2026",
        termsVersion: "v1.0",
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

  it("[Fail-Closed] 레이트 리밋 저장소 장애 시 인메모리 임의 우회 대신 503 UNAVAILABLE을 반환한다", async () => {
    const mockPrepare = vi.fn().mockImplementation(() => {
      throw new Error("D1 connection lost during rate limit");
    });

    const validRequest = new Request("https://etfcampus.pages.dev/api/lead/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "investor@example.com",
        agreeRequired: true,
        campaign: "challenge_guide_2026",
        termsVersion: "v1.0",
      }),
    });

    const response = await onRequestPost({
      request: validRequest,
      env: { ETF_PRICES: { prepare: mockPrepare } },
    });

    expect(response.status).toBe(503);
    const body = (await response.json()) as WaitlistResponse;
    expect(body.success).toBeFalsy();
    expect(body.error?.code).toBe("UNAVAILABLE");
    expect(body.error?.message).toContain("보안 확인 서비스를 일시적으로 사용할 수 없습니다");
  });

  it("[Fail-Closed] D1 테이블 미적용(쿼리 예외 발생) 시 성공을 가장하지 않고 500 UNAVAILABLE을 반환한다", async () => {
    const mockPrepare = vi.fn().mockImplementation((query: string) => {
      if (query.includes("lead_rate_limits")) {
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue({ count: 1, reset_at: Math.floor(Date.now() / 1000) + 60 }),
          }),
        };
      }
      throw new Error("no such table: lead_waitlist");
    });

    const validRequest = new Request("https://etfcampus.pages.dev/api/lead/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "investor@example.com",
        agreeRequired: true,
        campaign: "challenge_guide_2026",
        termsVersion: "v1.0",
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
    const mockFirst = vi.fn().mockImplementation(() => {
      return Promise.resolve({ count: 1, reset_at: Math.floor(Date.now() / 1000) + 60 });
    });
    const mockBind = vi.fn().mockReturnValue({ run: mockRun, first: mockFirst });
    const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });

    const validRequest = new Request("https://etfcampus.pages.dev/api/lead/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "investor@example.com",
        agreeRequired: true,
        campaign: "challenge_guide_2026",
        termsVersion: "v1.0",
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

  it("[Fail-Closed] D1 run() 결과에 success 필드가 누락된 경우({ meta: {} }) 500 UNAVAILABLE을 반환한다", async () => {
    const mockRun = vi.fn().mockResolvedValue({ meta: {} });
    const mockFirst = vi.fn().mockImplementation(() => {
      return Promise.resolve({ count: 1, reset_at: Math.floor(Date.now() / 1000) + 60 });
    });
    const mockBind = vi.fn().mockReturnValue({ run: mockRun, first: mockFirst });
    const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });

    const validRequest = new Request("https://etfcampus.pages.dev/api/lead/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "investor@example.com",
        agreeRequired: true,
        campaign: "challenge_guide_2026",
        termsVersion: "v1.0",
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

  it("[신청 범위 엄격 일치] 이미 발송 완료된 사용자(status === 'sent')의 재신청은 상태를 pending으로 강제 변경하지 않고 200 발송완료 안내를 반환한다", async () => {
    const mockRun = vi.fn().mockResolvedValue({ success: true });
    const mockFirst = vi.fn().mockImplementation(() => {
      return Promise.resolve({ status: "sent", count: 1, reset_at: Math.floor(Date.now() / 1000) + 60 });
    });
    const mockBind = vi.fn().mockReturnValue({ run: mockRun, first: mockFirst });
    const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });

    const validRequest = new Request("https://etfcampus.pages.dev/api/lead/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "already_sent@example.com",
        agreeRequired: true,
        campaign: "challenge_guide_2026",
        termsVersion: "v1.0",
      }),
    });

    const response = await onRequestPost({
      request: validRequest,
      env: { ETF_PRICES: { prepare: mockPrepare } },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as WaitlistResponse;
    expect(body.success).toBe(true);
    expect(body.alreadySent).toBe(true);
    expect(body.message).toContain("이미 해당 이메일로 가이드 출시 알림이 발송 완료되었습니다");
    expect(mockRun).not.toHaveBeenCalled();
  });

  it("[실제 D1 관측 픽스처] 정상 요청 및 저장 성공 시 ON CONFLICT 멱등 쿼리를 실행하고 201을 반환한다", async () => {
    const mockRun = vi.fn().mockResolvedValue(REAL_D1_OBSERVATION_FIXTURE);
    const mockFirst = vi.fn().mockImplementation(() => {
      return Promise.resolve({ count: 1, reset_at: Math.floor(Date.now() / 1000) + 60 });
    });
    const mockBind = vi.fn().mockReturnValue({ run: mockRun, first: mockFirst });
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
