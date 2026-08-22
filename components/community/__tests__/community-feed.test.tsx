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
    
    const link = await screen.findByRole("link", { name: /테스트 제목/i });
    expect(link.getAttribute("href")).toContain("/community/read");
    expect(link.getAttribute("href")).toContain("slug=test-slug-123");
    expect(link.getAttribute("href")).not.toContain("/community/test-slug-123/");
  });

  it("D-5: 배너 문구에 '신고' 문자열 부재", () => {
    render(<CommunityFeed />);
    const notice = screen.getByText(/게시물은 공개로 읽을 수 있으며/);
    expect(notice.textContent).not.toContain("신고");
    expect(notice.textContent).toContain("작성·댓글은");
  });

  it("P1: 팝업 없이 목적 기반 4개 빠른 경로를 제공한다", () => {
    render(<CommunityFeed />);

    expect(screen.getByRole("link", { name: /질문하기/ }).getAttribute("href")).toBe("/community/write?category=pension-etf-qna");
    expect(screen.getByRole("link", { name: /ETF 읽기/ }).getAttribute("href")).toBe("/community/learning-bundles");
    expect(screen.getByRole("link", { name: /30일 기록/ }).getAttribute("href")).toBe("/community/challenge");
    expect(screen.getByRole("link", { name: /오류 제보/ }).getAttribute("href")).toBe("/community/write?category=feedback");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
