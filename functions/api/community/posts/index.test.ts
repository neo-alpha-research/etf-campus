import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listPublicPosts: vi.fn(),
  authenticatedSupabase: vi.fn(),
  enforceDatabaseRateLimit: vi.fn(),
  parseJsonBody: vi.fn(),
  validatePostInput: vi.fn(),
}));

vi.mock("../_lib/supabase", () => ({
  publicSupabase: () => ({ rpc: mocks.listPublicPosts }),
  authenticatedSupabase: mocks.authenticatedSupabase,
}));

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
  toPublicPost: (row: Record<string, unknown>) => ({
    slug: row.slug,
    title: row.title,
    bodyText: row.body_text,
    category: { slug: row.category_slug, name: row.category_name },
    authorNickname: row.author_nickname,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    commentCount: row.comment_count,
    isPinned: row.is_pinned,
  }),
  validatePostInput: mocks.validatePostInput,
}));

import { onRequestGet } from "./index.js";

function context(query = "") {
  return {
    request: new Request(`https://etf-campus.pages.dev/api/community/posts${query}`),
    env: {},
  };
}

describe("커뮤니티 게시물 목록 계약", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listPublicPosts.mockResolvedValue({
      data: [
        {
          slug: "11111111-1111-4111-8111-111111111111",
          title: "운영 공지",
          body_text: "학습 기준을 확인해 주세요.",
          category_slug: "notice",
          category_name: "공지",
          author_nickname: "ETF Campus 운영",
          created_at: "2026-08-22T00:00:00.000Z",
          updated_at: "2026-08-22T00:00:00.000Z",
          comment_count: 0,
          is_pinned: true,
        },
        {
          slug: "22222222-2222-4222-8222-222222222222",
          title: "두 번째 공지",
          body_text: "다음 페이지를 확인합니다.",
          category_slug: "notice",
          category_name: "공지",
          author_nickname: "ETF Campus 운영",
          created_at: "2026-08-21T00:00:00.000Z",
          updated_at: "2026-08-21T00:00:00.000Z",
          comment_count: 0,
          is_pinned: true,
        },
      ],
      error: null,
    });
  });

  it("공지·고정 상태와 다음 커서를 포함한 공개 목록을 반환한다", async () => {
    const response = await onRequestGet(context("?category=notice&limit=1"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ posts: [{ category: { slug: "notice" }, isPinned: true }] });
    expect(typeof body.nextCursor).toBe("string");
    expect(mocks.listPublicPosts).toHaveBeenCalledWith("list_community_public_posts", expect.objectContaining({
      p_category_slug: "notice",
      p_limit: 2,
    }));
  });

  it("잘못된 커서는 검증 오류로 거부한다", async () => {
    const response = await onRequestGet(context("?cursor=not-a-valid-cursor"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    expect(mocks.listPublicPosts).not.toHaveBeenCalled();
  });
});
