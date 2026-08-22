import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticatedSupabase: vi.fn(),
  enforceDatabaseRateLimit: vi.fn(),
  parseJsonBody: vi.fn(),
  validateContentVisibilityAction: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("../_lib/supabase", () => ({ authenticatedSupabase: mocks.authenticatedSupabase }));
vi.mock("../_lib/request-security", () => ({
  enforceDatabaseRateLimit: mocks.enforceDatabaseRateLimit,
  parseJsonBody: mocks.parseJsonBody,
}));
vi.mock("../_lib/api-security", () => ({
  errorResponse: (status: number, code: string, message: string) => Response.json({ error: { code, message } }, { status }),
  jsonResponse: (body: unknown, status = 200) => Response.json(body, { status }),
}));
vi.mock("../_lib/contracts", () => ({
  CommunityValidationError: class CommunityValidationError extends Error {},
  validateContentVisibilityAction: mocks.validateContentVisibilityAction,
}));

import { onRequestPost } from "./moderation.js";

const postSlug = "11111111-1111-4111-8111-111111111111";

function context() {
  return { request: new Request("https://etf-campus.pages.dev/api/community/admin/moderation", { method: "POST" }), env: {} };
}

describe("관리자 수동 모더레이션 API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticatedSupabase.mockResolvedValue({ client: { rpc: mocks.rpc }, user: { id: "admin-user" } });
    mocks.parseJsonBody.mockResolvedValue({ targetType: "post", targetReference: postSlug, isHidden: true, reason: "개인정보 노출이 확인되었습니다." });
    mocks.validateContentVisibilityAction.mockReturnValue({ isHidden: true, reason: "개인정보 노출이 확인되었습니다." });
    mocks.enforceDatabaseRateLimit.mockResolvedValue(null);
    mocks.rpc.mockResolvedValue({ data: true, error: null });
  });

  it("관리자 검증 RPC에만 임시 숨김 요청을 전달한다", async () => {
    const response = await onRequestPost(context());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ targetType: "post", targetReference: postSlug, isHidden: true });
    expect(mocks.rpc).toHaveBeenCalledWith("set_community_content_hidden", {
      p_target_type: "post",
      p_target_reference: postSlug,
      p_is_hidden: true,
      p_reason: "개인정보 노출이 확인되었습니다.",
    });
  });

  it("admin 이외 역할은 RPC의 FORBIDDEN 계약으로 차단한다", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "admin role required" } });

    const response = await onRequestPost(context());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "FORBIDDEN" } });
  });

  it("자동 제재·누적 신고 임계값 API를 호출하지 않는다", async () => {
    await onRequestPost(context());

    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).not.toHaveBeenCalledWith(expect.stringMatching(/ban|suspend|penalty/i), expect.anything());
  });
});
