import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/community/community-challenge", () => ({
  CommunityChallenge: () => <div data-testid="challenge-component">30일 챌린지 컴포넌트</div>,
}));

import { NoticeHub } from "../notice-hub";

describe("NoticeHub", () => {
  it("공지사항 탭과 상위 공지 리스트를 최신순으로 올바르게 렌더링한다", () => {
    render(<NoticeHub />);
    expect(screen.getByRole("button", { name: /공지사항/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /30일 챌린지/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /의견·오류 제보/i })).toBeInTheDocument();

    const titles = screen.getAllByRole("heading", { level: 3 });
    expect(titles[0]).toHaveTextContent("ETF Campus 운영 원칙 및 객관적 데이터 분석 가이드라인");
  });

  it("탭을 클릭하면 해당 서브 컨텐츠로 전환된다", () => {
    render(<NoticeHub />);
    fireEvent.click(screen.getByRole("button", { name: /30일 챌린지/i }));
    expect(screen.getByTestId("challenge-component")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /의견·오류 제보/i }));
    expect(screen.getByText(/ETF Campus 개선 의견 및 오류 제보/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /의견·오류 제보하기/i })).toHaveAttribute(
      "href",
      "/community/write?category=feedback"
    );
  });
});

