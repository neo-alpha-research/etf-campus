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

function post(canEdit: boolean, canModerate = false) {
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
    canModerate,
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

  it("비작성자에게 게시물 신고 버튼을 제공하고 신고 모달을 연다", async () => {
    mocks.communityFetch.mockImplementation((path: string) => Promise.resolve(path.endsWith("/comments") ? { comments: [] } : { post: post(false) }));

    render(<CommunityPostDetail />);

    await screen.findByRole("heading", { name: "연금 ETF 질문" });
    fireEvent.click(screen.getByRole("button", { name: "신고하기" }));
    expect(screen.getByRole("dialog", { name: "게시물 신고하기" })).toBeInTheDocument();
    expect(screen.getByText("신고는 자동 제재로 이어지지 않습니다. 운영자가 사실과 정책을 수동으로 검토합니다.")).toBeInTheDocument();
  });

  it("관리자에게만 임시 숨김 버튼과 사유 입력을 제공한다", async () => {
    mocks.communityFetch.mockImplementation((path: string) => Promise.resolve(path.endsWith("/comments") ? { comments: [] } : { post: post(false, true) }));
    Object.defineProperty(window, "location", { value: { assign: vi.fn(), search: "?slug=11111111-1111-4111-8111-111111111111" }, writable: true });

    render(<CommunityPostDetail />);

    await screen.findByRole("heading", { name: "연금 ETF 질문" });
    fireEvent.click(screen.getByRole("button", { name: "임시 숨김" }));
    fireEvent.change(screen.getByLabelText("처리 사유"), { target: { value: "개인정보 노출이 확인되었습니다." } });
    fireEvent.click(screen.getByRole("button", { name: "임시 숨김 처리" }));

    await waitFor(() => expect(mocks.communityFetch).toHaveBeenCalledWith(
      "/api/community/admin/moderation",
      expect.objectContaining({ method: "POST" }),
    ));
  });

  it("서버 오류 문구와 무관하게 NOT_FOUND 코드로 삭제·없는 게시물을 구분한다", async () => {
    const missing = Object.assign(new Error("서버 문구가 변경되었습니다."), { code: "NOT_FOUND" });
    mocks.communityFetch.mockRejectedValueOnce(missing);

    render(<CommunityPostDetail />);

    expect(await screen.findByRole("heading", { name: "게시물을 찾을 수 없습니다." })).toBeInTheDocument();
    expect(screen.getByText("존재하지 않거나 삭제된 게시물입니다.")).toBeInTheDocument();
  });

  it("상단에 '목록으로 가기' 링크를 제공하고 댓글을 정상 등록한다", async () => {
    render(<CommunityPostDetail />);

    expect(await screen.findByRole("heading", { name: "연금 ETF 질문" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← 목록으로 가기" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("댓글"), { target: { value: "좋은 분석 감사합니다!" } });
    fireEvent.click(screen.getByRole("button", { name: "댓글 등록" }));

    await waitFor(() => {
      expect(screen.getByText("좋은 분석 감사합니다!")).toBeInTheDocument();
    });
  });
});
