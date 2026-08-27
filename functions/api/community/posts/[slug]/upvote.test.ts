import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  authenticatedSupabase: vi.fn(),
  enforceDatabaseRateLimit: vi.fn(),
}));

vi.mock("../../_lib/supabase", () => ({
  authenticatedSupabase: mocks.authenticatedSupabase,
}));

vi.mock("../../_lib/request-security", () => ({
  enforceDatabaseRateLimit: mocks.enforceDatabaseRateLimit,
}));

vi.mock("../../_lib/api-security", () => ({
  errorResponse: (status: number, code: string, message: string) => Response.json({ error: { code, message } }, { status }),
  jsonResponse: (body: unknown, status = 200) => Response.json(body, { status }),
}));

import { onRequestPost } from "./upvote.js";

const postSlug = "11111111-1111-4111-8111-111111111111";

function requestContext(slug = postSlug) {
  return {
    params: { slug },
    request: new Request('https://preview.example.com/api/community/posts/' + slug + '/upvote', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }),
    env: {},
  };
}

describe("커뮤니티 게시물 추천 API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enforceDatabaseRateLimit.mockResolvedValue(null);
    mocks.authenticatedSupabase.mockResolvedValue({
      user: { id: "user-123" },
      client: { rpc: mocks.rpc },
    });
  });

  it("비로그인 사용자는 401 오류를 반환한다", async () => {
    mocks.authenticatedSupabase.mockResolvedValue({
      error: Response.json({ error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." } }, { status: 401 }),
    });

    const response = await onRequestPost(requestContext());
    expect(response.status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("속도 제한을 초과하면 429 오류를 반환한다", async () => {
    mocks.enforceDatabaseRateLimit.mockResolvedValue(
      Response.json({ error: { code: "RATE_LIMITED", message: "요청이 너무 많습니다." } }, { status: 429 })
    );

    const response = await onRequestPost(requestContext());
    expect(response.status).toBe(429);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("정상적인 추천 토글 시 RPC를 호출하고 갱신된 추천 수와 상태를 반환한다", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ upvote_count: 5, is_upvoted: true }],
      error: null,
    });

    const response = await onRequestPost(requestContext());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      upvoteCount: 5,
      isUpvoted: true,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("toggle_community_post_upvote", {
      p_slug: postSlug,
    });
  });

  it("존재하지 않는 게시물 추천 시 404를 반환한다", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "post not found" },
    });

    const response = await onRequestPost(requestContext());
    expect(response.status).toBe(404);
  });
});
