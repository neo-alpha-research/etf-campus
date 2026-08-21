import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  communityFetch: vi.fn(),
  assign: vi.fn(),
}));

vi.mock("@/lib/community/browser-client", () => ({
  communityFetch: mocks.communityFetch,
  getCommunitySession: vi.fn(() => ({ authenticated: true })),
  refreshCommunitySession: vi.fn(() => Promise.resolve(true)),
  loadCommunityDraft: vi.fn(() => null),
  clearCommunityDraft: vi.fn(),
  saveCommunityDraft: vi.fn(),
}));

import { CommunityComposer } from "../community-composer";

describe("CommunityComposer", () => {
  it("D-2: 글 등록 성공 시 이동 대상이 /community/read/?slug=<새 글 slug>", async () => {
    Object.defineProperty(window, "location", {
      value: { assign: mocks.assign },
      writable: true,
    });

    mocks.communityFetch.mockResolvedValueOnce({ post: { slug: "new-post-123" } });

    render(<CommunityComposer />);
    
    fireEvent.change(screen.getByLabelText(/제목/), { target: { value: "새 글 제목" } });
    fireEvent.change(screen.getByLabelText(/본문/), { target: { value: "새 글 본문 내용" } });
    
    fireEvent.click(screen.getByRole("button", { name: "게시물 등록" }));
    
    await waitFor(() => {
      expect(mocks.assign).toHaveBeenCalledWith("/community/read/?slug=new-post-123");
    });
  });
});
