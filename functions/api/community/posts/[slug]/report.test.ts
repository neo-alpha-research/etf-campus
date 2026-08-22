import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticatedSupabase: vi.fn(),
  enforceDatabaseRateLimit: vi.fn(),
  parseJsonBody: vi.fn(),
  validateCommunityReport: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("../../_lib/supabase", () => ({ authenticatedSupabase: mocks.authenticatedSupabase }));
vi.mock("../../_lib/request-security", () => ({
  enforceDatabaseRateLimit: mocks.enforceDatabaseRateLimit,
  parseJsonBody: mocks.parseJsonBody,
}));
vi.mock("../../_lib/api-security", () => ({
  errorResponse: (status: number, code: string, message: string) => Response.json({ error: { code, message } }, { status }),
  jsonResponse: (body: unknown, status = 200) => Response.json(body, { status }),
}));
vi.mock("../../_lib/contracts", () => ({
  CommunityValidationError: class CommunityValidationError extends Error {},
  validateCommunityReport: mocks.validateCommunityReport,
}));

import { onRequestPost } from "./report.js";

const slug = "11111111-1111-4111-8111-111111111111";

function context(targetSlug = slug) {
  return { request: new Request(`https://etf-campus.pages.dev/api/community/posts/${targetSlug}/report`, { method: "POST" }), params: { slug: targetSlug }, env: {} };
}

describe("게시물 신고 API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticatedSupabase.mockResolvedValue({ client: { rpc: mocks.rpc }, user: { id: "user-1" } });
    mocks.parseJsonBody.mockResolvedValue({ reasonCode: "harassment_or_abuse" });
    mocks.validateCommunityReport.mockReturnValue({ reasonCode: "harassment_or_abuse", details: null });
    mocks.enforceDatabaseRateLimit.mockResolvedValue(null);
    mocks.rpc.mockResolvedValue({ data: [{ report_id: "report-1", status: "open" }], error: null });
  });

  it("인증 회원의 신고를 수동 검토용 RPC에 접수한다", async () => {
    const response = await onRequestPost(context());

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ report: { id: "report-1", status: "open" } });
    expect(mocks.rpc).toHaveBeenCalledWith("create_community_report", {
      p_target_type: "post",
      p_target_reference: slug,
      p_reason_code: "harassment_or_abuse",
      p_details: null,
    });
  });

  it("속도 제한에 걸리면 신고 RPC를 호출하지 않는다", async () => {
    const limited = Response.json({ error: { code: "RATE_LIMITED" } }, { status: 429 });
    mocks.enforceDatabaseRateLimit.mockResolvedValue(limited);

    const response = await onRequestPost(context());

    expect(response.status).toBe(429);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("본인 콘텐츠 신고는 검증 오류로 반환하고 자동 제재를 수행하지 않는다", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "cannot report own content" } });

    const response = await onRequestPost(context());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });
});
