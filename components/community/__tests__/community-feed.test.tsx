import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  communityFetch: vi.fn(),
}));

vi.mock("@/lib/community/browser-client", () => ({
  communityFetch: mocks.communityFetch,
  getCommunitySession: vi.fn(() => ({ authenticated: true })),
  refreshCommunitySession: vi.fn(() => Promise.resolve(true)),
}));

import { CommunityFeed } from "../community-feed";

describe("CommunityFeed", () => {
  beforeEach(() => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        posts: [
          {
            slug: "test-slug-123",
            title: "테스트 제목",
            bodyText: "테스트 본문",
            category: { slug: "etf-questions", name: "ETF 정보" },
            authorNickname: "사용자",
            createdAt: "2026-08-19T00:00:00.000Z",
            commentCount: 0,
          }
        ]
      })
    })) as unknown as typeof fetch;
  });

  it("D-1: 목록의 게시물 링크 href가 /community/read/?slug=<slug> 형태이다", async () => {
    render(<CommunityFeed />);
    
    const links = await screen.findAllByRole("link", { name: /테스트 제목/i });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0].getAttribute("href")).toContain("/community/read");
    expect(links[0].getAttribute("href")).toContain("slug=test-slug-123");
    expect(links[0].getAttribute("href")).not.toContain("/community/test-slug-123/");
  });

  it("D-2: 게시판 카테고리 탭과 글 작성 버튼을 제공한다", () => {
    render(<CommunityFeed />);
    expect(screen.getByRole("button", { name: /글 작성/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /전체/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /자유·질문/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /전략·포트폴리오/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /종목·비용 분석/i })).toBeInTheDocument();
  });

  it("D-3: 초기 렌더링 시 팝업 다이얼로그가 열리지 않는다", () => {
    render(<CommunityFeed />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("D-4: 서버가 빈 목록을 반환하면 mock 데이터를 fallback으로 불러온다", async () => {
    global.fetch = vi.fn((url: string) => {
      if (url.includes("/api/community/posts")) {
        return Promise.resolve({
          ok: true,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve({ posts: [] }),
        });
      }
      if (url.includes("/mock-community-posts.json")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            posts: [
              {
                slug: "mock-fallback-slug",
                title: "목업 fallback 제목",
                bodyText: "목업 fallback 본문",
                category: { slug: "free-qna", name: "자유·질문" },
                authorNickname: "목업작성자",
                createdAt: "2026-08-27T00:00:00.000Z",
                commentCount: 2,
              },
            ],
          }),
        });
      }
      return Promise.reject(new Error("Unknown URL"));
    }) as unknown as typeof fetch;

    render(<CommunityFeed />);
    const links = await screen.findAllByRole("link", { name: /목업 fallback 제목/i });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toBeInTheDocument();
  });
});
