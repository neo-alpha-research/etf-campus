// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  publicPostMaybeSingle: vi.fn(),
  ownPostSlugs: vi.fn(),
}));

vi.mock("../../_lib/supabase", () => ({
  publicSupabase: (_env: unknown, token?: string) => {
    if (token) {
      return {
        rpc: mocks.ownPostSlugs,
      };
    }

    return {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: mocks.publicPostMaybeSingle,
          }),
        }),
      }),
    };
  },
  authenticatedSupabase: vi.fn(),
}));

vi.mock("../../_lib/request-security", () => ({
  enforceDatabaseRateLimit: vi.fn(),
  parseJsonBody: vi.fn(),
}));

vi.mock("../../_lib/api-security", () => ({
  errorResponse: (status: number, code: string, message: string) => Response.json({ error: { code, message } }, { status }),
  jsonResponse: (body: unknown, status = 200) => Response.json(body, { status }),
}));

vi.mock("../../_lib/contracts", () => ({
  CommunityValidationError: class CommunityValidationError extends Error {},
  toPublicPost: (row: Record<string, string | number>) => ({
    slug: row.slug,
    title: row.title,
    bodyText: row.body_text,
    category: { slug: row.category_slug, name: row.category_name },
    authorNickname: row.author_nickname,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    commentCount: row.comment_count,
  }),
  validatePostInput: vi.fn(),
}));

import { onRequestGet } from "./index.js";

const postSlug = "11111111-1111-4111-8111-111111111111";

function requestContext(authorization?: string) {
  return {
    params: { slug: postSlug },
    request: new Request(`https://preview.example.com/api/community/posts/${postSlug}`, {
      headers: authorization ? { Authorization: authorization } : undefined,
    }),
    env: {},
  };
}

describe("커뮤니티 게시물 상세 소유자 제어", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.publicPostMaybeSingle.mockResolvedValue({
      data: {
        slug: postSlug,
        title: "연금 ETF 질문",
        body_text: "확인할 기준을 적었습니다.",
        category_slug: "pension-etf-qna",
        category_name: "연금 ETF Q&A",
        author_nickname: "테스트 사용자",
        created_at: "2026-08-19T00:00:00.000Z",
        updated_at: "2026-08-19T00:00:00.000Z",
        comment_count: 0,
      },
      error: null,
    });
  });

  it("비로그인 공개 조회에는 작성자 제어 권한을 노출하지 않는다", async () => {
    const response = await onRequestGet(requestContext());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ post: { slug: postSlug, canEdit: false } });
    expect(mocks.ownPostSlugs).not.toHaveBeenCalled();
  });

  it("로그인한 게시물 작성자에게만 canEdit을 반환한다", async () => {
    mocks.ownPostSlugs.mockResolvedValue({ data: [{ slug: postSlug }], error: null });

    const response = await onRequestGet(requestContext("Bearer owner-session-token"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ post: { slug: postSlug, canEdit: true } });
    expect(mocks.ownPostSlugs).toHaveBeenCalledWith("list_own_community_post_slugs", { p_post_slug: postSlug });
  });

  it("다른 로그인 회원에게는 작성자 제어 권한을 반환하지 않는다", async () => {
    mocks.ownPostSlugs.mockResolvedValue({ data: [], error: null });

    const response = await onRequestGet(requestContext("Bearer other-member-session-token"));

    await expect(response.json()).resolves.toMatchObject({ post: { slug: postSlug, canEdit: false } });
  });
});
