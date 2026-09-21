import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SiteHeader } from "../site-header";

let mockPathname = "/explore/";
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({ push: vi.fn() }),
}));


vi.mock("@/components/brand/tickery", () => ({
  Tickery: () => <div data-testid="tickery" />,
}));

vi.mock("@/components/onboarding/style-chip", () => ({
  StyleChip: () => <div data-testid="style-chip" />,
}));

vi.mock("@/components/auth/auth-nav", () => ({
  AuthNav: () => <div data-testid="auth-nav" />,
}));

describe("SiteHeader Component - Sub-navigation Hierarchy", () => {
  beforeEach(() => {
    mockPathname = "/explore/";
    mockSearchParams = new URLSearchParams();
  });

  it("ETF 탐색 메뉴에 계좌별 4종과 전략별 5종 및 그룹 뱃지가 정상 렌더링된다", () => {
    render(<SiteHeader />);

    // 대분류 뱃지 및 그룹 접근성
    expect(screen.getByRole("group", { name: "계좌별 ETF 탐색" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "전략별 ETF 탐색" })).toBeInTheDocument();
    expect(screen.getByText("계좌별")).toBeInTheDocument();
    expect(screen.getByText("전략별")).toBeInTheDocument();

    // 1단 계좌별 4종
    expect(screen.getByRole("link", { name: "전체계좌" })).toHaveAttribute("href", "/explore?account=all");
    expect(screen.getByRole("link", { name: "퇴직연금" })).toHaveAttribute("href", "/explore?account=pension");
    expect(screen.getByRole("link", { name: "연금저축" })).toHaveAttribute("href", "/explore?account=personal_pension");
    expect(screen.getByRole("link", { name: "중개형 ISA" })).toHaveAttribute("href", "/explore?account=isa");

    // 2단 전략별 5종
    expect(screen.getByRole("link", { name: "혼합채권" })).toHaveAttribute("href", "/quick?mode=mixed_bonds");
    expect(screen.getByRole("link", { name: "TDF" })).toHaveAttribute("href", "/quick?mode=tdf");
    expect(screen.getByRole("link", { name: "커버드콜" })).toHaveAttribute("href", "/quick?mode=covered_call");
    expect(screen.getByRole("link", { name: "레버리지·인버스" })).toHaveAttribute("href", "/quick?mode=derivatives");
    expect(screen.getByRole("link", { name: "신규 상장" })).toHaveAttribute("href", "/quick?mode=new");
  });

  it("/explore/ 기본 진입 시 퇴직연금 탭이 활성화(aria-current='page')된다", () => {
    render(<SiteHeader />);
    const pensionTab = screen.getByRole("link", { name: "퇴직연금" });
    expect(pensionTab).toHaveAttribute("aria-current", "page");
  });

  it("account=isa 파라미터 시 중개형 ISA 탭이 활성화된다", () => {
    mockSearchParams = new URLSearchParams("account=isa");
    render(<SiteHeader />);
    const isaTab = screen.getByRole("link", { name: "중개형 ISA" });
    expect(isaTab).toHaveAttribute("aria-current", "page");
  });

  it("account=all 파라미터 시 전체계좌 탭이 활성화된다", () => {
    mockSearchParams = new URLSearchParams("account=all");
    render(<SiteHeader />);
    const generalTab = screen.getByRole("link", { name: "전체계좌" });
    expect(generalTab).toHaveAttribute("aria-current", "page");
  });

  it("/quick/ 경로에서 mode=tdf 파라미터 시 TDF 탭이 활성화된다", () => {
    mockPathname = "/quick";
    mockSearchParams = new URLSearchParams("mode=tdf");
    render(<SiteHeader />);
    const tdfTab = screen.getByRole("link", { name: "TDF" });
    expect(tdfTab).toHaveAttribute("aria-current", "page");
  });

  it("탐색 메뉴 탭 클릭 시 화면 최상단으로 즉시 스크롤(scrollTo instant)된다", () => {
    const scrollToSpy = vi.fn();
    window.scrollTo = scrollToSpy;

    render(<SiteHeader />);
    const mixedBondsTab = screen.getByRole("link", { name: "혼합채권" });
    mixedBondsTab.click();

    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: "instant" });
  });

  it("ETF 검색 버튼이 렌더링되고 클릭 시 통합 검색 모달이 열린다", () => {
    render(<SiteHeader />);

    // 데스크톱 또는 모바일의 ETF 검색 버튼 확인
    const searchButtons = screen.getAllByRole("button", { name: /ETF.*빠른 검색/i });
    expect(searchButtons.length).toBeGreaterThanOrEqual(1);

    // 검색 모달 열기 전에는 모달이 없음
    expect(screen.queryByRole("dialog", { name: "ETF 통합 퀵 검색" })).not.toBeInTheDocument();

    // 검색 버튼 클릭 (fireEvent 사용)
    fireEvent.click(searchButtons[0]);

    // 모달이 열림
    expect(screen.getByRole("dialog", { name: "ETF 통합 퀵 검색" })).toBeInTheDocument();
  });

  it("주요 메뉴 7개가 정상 렌더링된다", () => {
    render(<SiteHeader />);

    const expectedLabels = [
      "마켓 브리핑",
      "캠퍼스 투어",
      "ETF 탐색",
      "ETF 비교",
      "ETF 이야기",
      "도서·리뷰",
      "알림·참여",
    ];

    for (const label of expectedLabels) {
      const links = screen.getAllByRole("link", { name: label });
      expect(links.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("적성 리포트 칩(StyleChip)과 계정 내비게이션(AuthNav)이 마운트된다", () => {
    render(<SiteHeader />);

    expect(screen.getByTestId("style-chip")).toBeInTheDocument();
    expect(screen.getAllByTestId("auth-nav").length).toBeGreaterThanOrEqual(1);
  });
});

