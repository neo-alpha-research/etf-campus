import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  communityFetch: vi.fn(),
}));

vi.mock("@/lib/community/browser-client", () => ({
  communityFetch: mocks.communityFetch,
  getCommunitySession: vi.fn(() => ({ authenticated: true })),
  refreshCommunitySession: vi.fn(),
}));

vi.mock("@/components/community/community-auth-dialog", () => ({
  CommunityAuthDialog: () => null,
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

import { CommunityPostDetail } from "../community-post-detail";

function post(canEdit: boolean) {
  return {
    slug: "11111111-1111-4111-8111-111111111111",
    title: "연금 ETF 질문",
    bodyText: "확인할 기준을 적었습니다.",
    category: { slug: "pension-etf-qna", name: "연금 ETF Q&A" },
    authorNickname: "테스트 사용자",
    createdAt: "2026-08-19T00:00:00.000Z",
    updatedAt: "2026-08-19T00:00:00.000Z",
    commentCount: 0,
    canEdit,
  };
}

describe("CommunityPostDetail 게시물 소유자 제어 UI", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/community/read/?slug=11111111-1111-4111-8111-111111111111");
    mocks.communityFetch.mockImplementation((path: string) => Promise.resolve(path.endsWith("/comments") ? { comments: [] } : { post: post(true) }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("작성자에게 수정·삭제 버튼과 기존 내용을 채운 수정 폼을 보여 준다", async () => {
    render(<CommunityPostDetail />);

    await screen.findByRole("heading", { name: "연금 ETF 질문" });
    fireEvent.click(screen.getByRole("button", { name: "수정" }));

    expect(screen.getByRole("form", { name: "게시물 수정" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("연금 ETF 질문")).toBeInTheDocument();
    expect(screen.getByDisplayValue("확인할 기준을 적었습니다.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "삭제" })).not.toBeInTheDocument();
  });

  it("다른 회원 또는 비로그인 조회에는 게시물 수정·삭제 버튼을 보여 주지 않는다", async () => {
    mocks.communityFetch.mockImplementation((path: string) => Promise.resolve(path.endsWith("/comments") ? { comments: [] } : { post: post(false) }));

    render(<CommunityPostDetail />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "연금 ETF 질문" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "수정" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "삭제" })).not.toBeInTheDocument();
  });
});
