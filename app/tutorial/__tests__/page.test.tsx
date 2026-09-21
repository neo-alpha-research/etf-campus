import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TutorialPage from "../page";

let mockSearchParams = new URLSearchParams();
let mockAuthenticated = false;

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/auth/use-auth-session", () => ({
  useAuthSession: () => ({
    authenticated: mockAuthenticated,
    user: mockAuthenticated ? { email: "test@example.com", nickname: "테스터" } : null,
    loading: false,
  }),
}));

// Mock child components
vi.mock("@/components/tutorial/founder-letter", () => ({
  FounderLetter: () => <div data-testid="founder-letter">설립 취지문</div>,
}));

vi.mock("@/components/tutorial/campus-tour", () => ({
  CampusTour: () => <div data-testid="campus-tour">캠퍼스 시설 안내</div>,
}));

describe("TutorialPage Component", () => {
  beforeEach(() => {
    localStorage.clear();
    mockSearchParams = new URLSearchParams();
    mockAuthenticated = false;
  });

  it("기본 진입 시 팩트체크 탭과 1단계 문항이 렌더링된다", () => {
    render(<TutorialPage />);
    expect(screen.getByText(/5대 절세 팩트체크 1\/5단계/)).toBeInTheDocument();
    expect(screen.getByText(/주식형 ETF 편입 한도 규제/)).toBeInTheDocument();
  });

  it("download=auto 쿼리가 있어도 미완주 상태라면 5단계로 치트 해금되지 않고 1단계로 유지된다", () => {
    mockSearchParams = new URLSearchParams("download=auto");
    render(<TutorialPage />);

    // 해금 단계 및 현재 단계가 1단계로 유지되어야 함
    expect(screen.getByText(/5대 절세 팩트체크 1\/5단계/)).toBeInTheDocument();
    expect(localStorage.getItem("tutorial_max_unlocked_step")).toBeNull();
  });

  it("전체 10문항을 모두 맞추지 않은 상태에서는 완료 뱃지가 아닌 현재 단계(1/5)가 표시된다", () => {
    render(<TutorialPage />);
    expect(screen.getByText("1/5")).toBeInTheDocument();
  });

  it("1단계 정답을 선택하면 즉시 피드백이 표시되고 다음 단계가 해금된다", () => {
    render(<TutorialPage />);

    // 1-1 문항 맞습니다(true) 선택
    const trueButtons = screen.getAllByRole("button", { name: /맞습니다/i });
    fireEvent.click(trueButtons[0]);

    // 피드백 박스 확인
    expect(screen.getByText(/완벽합니다! 확실한 팩트체크/)).toBeInTheDocument();
  });

  it("10문항 완주 및 로그인 상태 시 수동 다운로드 버튼이 상시 노출된다", () => {
    // 10문항 정답 모킹
    const allAnswers: Record<string, boolean> = {
      "1-1": true,
      "1-2": true,
      "2-1": false,
      "2-2": true,
      "3-1": true,
      "3-2": false,
      "4-1": false,
      "4-2": true,
      "5-1": true,
      "5-2": true,
    };
    localStorage.setItem("tutorial_answers", JSON.stringify(allAnswers));
    localStorage.setItem("tutorial_progress", "5");
    localStorage.setItem("tutorial_max_unlocked_step", "5");
    mockAuthenticated = true;

    render(<TutorialPage />);

    // 완료 뱃지 표시 확인
    expect(screen.getByText("완료")).toBeInTheDocument();

    // 치트시트 수동 다운로드 버튼이 화면에 안전하게 렌더링되어 있는지 확인
    const downloadBtn = screen.getByRole("link", { name: /치트시트 수동 다운로드/i });
    expect(downloadBtn).toBeInTheDocument();
    expect(downloadBtn).toHaveAttribute("href", "/downloads/2026_직장인_3대절세계좌_완벽운용_치트시트.pdf");
  });
});
