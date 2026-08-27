import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  communityFetch: vi.fn(),
  assign: vi.fn(),
  loadCommunityDraft: vi.fn(() => null),
  saveCommunityDraft: vi.fn(),
}));

vi.mock("@/lib/community/browser-client", () => ({
  communityFetch: mocks.communityFetch,
  getCommunitySession: vi.fn(() => ({ authenticated: true })),
  refreshCommunitySession: vi.fn(() => Promise.resolve(true)),
  loadCommunityDraft: mocks.loadCommunityDraft,
  clearCommunityDraft: vi.fn(),
  saveCommunityDraft: mocks.saveCommunityDraft,
}));

import { CommunityComposer } from "../community-composer";

describe("CommunityComposer", () => {
  it("D-2: 글 등록 성공 시 이동 대상이 /community/read/?slug=<새 글 slug>", async () => {
    Object.defineProperty(window, "location", {
      value: { assign: mocks.assign, search: "" },
      writable: true,
    });
    mocks.communityFetch.mockResolvedValueOnce({ post: { slug: "new-post-123" } });
    render(<CommunityComposer />);
    fireEvent.change(screen.getByLabelText(/제목/), { target: { value: "새 글 제목" } });
    fireEvent.change(screen.getByLabelText(/본문/), { target: { value: "새 글 본문 내용" } });
    const submitButton = await screen.findByRole("button", { name: "게시물 등록" });
    fireEvent.click(submitButton);
    await waitFor(() => {
      expect(mocks.assign).toHaveBeenCalledWith("/community/read/?slug=new-post-123");
    });
  });

  it("카테고리를 바꾸면 비어 있거나 기존 템플릿인 본문에 맞춤 작성 템플릿을 넣는다", async () => {
    render(<CommunityComposer />);
    const body = await screen.findByLabelText(/본문/);

    expect((body as HTMLTextAreaElement).value).toContain("질문 내용");
    fireEvent.change(screen.getByLabelText(/게시판/), { target: { value: "stock-cost-analysis" } });

    expect((body as HTMLTextAreaElement).value).toContain("분석 대상 ETF");
    expect(screen.getByLabelText(/제목/)).toHaveAttribute("placeholder", expect.stringContaining("실부담비용"));
  });

  it("빠른 경로의 category 쿼리값을 선택한 게시판과 템플릿에 반영한다", async () => {
    Object.defineProperty(window, "location", {
      value: { search: "?category=stock-cost-analysis" },
      writable: true,
    });
    render(<CommunityComposer />);

    await waitFor(() => {
      expect(screen.getByLabelText(/게시판/)).toHaveValue("stock-cost-analysis");
    });
    expect((screen.getByLabelText(/본문/) as HTMLTextAreaElement).value).toContain("분석 대상 ETF");
  });

  it("사용자가 작성한 본문은 게시판을 바꿔도 덮어쓰지 않는다", async () => {
    render(<CommunityComposer />);
    const body = await screen.findByLabelText(/본문/);
    fireEvent.change(body, { target: { value: "운영자가 확인할 수 있도록 재현한 실제 오류 내용입니다." } });
    fireEvent.change(screen.getByLabelText(/게시판/), { target: { value: "strategy-portfolio" } });

    expect(body).toHaveValue("운영자가 확인할 수 있도록 재현한 실제 오류 내용입니다.");
    expect(screen.getByRole("status")).toHaveTextContent("작성 중인 본문은 유지했습니다");
  });

  it("안내 문구만 남은 템플릿은 실제 내용으로 바꾼 뒤 등록하도록 막는다", async () => {
    render(<CommunityComposer />);
    fireEvent.change(screen.getByLabelText(/제목/), { target: { value: "연금 계좌 질문" } });
    fireEvent.click(await screen.findByRole("button", { name: "게시물 등록" }));

    expect(await screen.findByRole("status")).toHaveTextContent("실제 확인 내용과 질문으로 바꾼 뒤 등록");
    expect(mocks.communityFetch).not.toHaveBeenCalled();
  });
});
