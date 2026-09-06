import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteHeader } from "../site-header";

let mockPathname = "/explore/";
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
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

  it("ETF 탐색 메뉴에 계좌군 3종과 특성군 4종이 정상 렌더링된다", () => {
    render(<SiteHeader />);

    // 1단 계좌군
    expect(screen.getByRole("link", { name: "전체계좌" })).toHaveAttribute("href", "/explore?account=all");
    expect(screen.getByRole("link", { name: "퇴직연금" })).toHaveAttribute("href", "/explore?account=pension");
    expect(screen.getByRole("link", { name: "중개형ISA" })).toHaveAttribute("href", "/explore?account=isa");

    // 2단 특성군
    expect(screen.getByRole("link", { name: "혼합채권" })).toHaveAttribute("href", "/quick?mode=mixed_bonds");
    expect(screen.getByRole("link", { name: "TDF" })).toHaveAttribute("href", "/quick?mode=tdf");
    expect(screen.getByRole("link", { name: "레버리지·인버스" })).toHaveAttribute("href", "/quick?mode=derivatives");
    expect(screen.getByRole("link", { name: "신규 상장" })).toHaveAttribute("href", "/quick?mode=new");
  });

  it("/explore/ 기본 진입 시 퇴직연금 탭이 활성화(aria-current='page')된다", () => {
    render(<SiteHeader />);
    const pensionTab = screen.getByRole("link", { name: "퇴직연금" });
    expect(pensionTab).toHaveAttribute("aria-current", "page");
  });

  it("account=isa 파라미터 시 중개형ISA 탭이 활성화된다", () => {
    mockSearchParams = new URLSearchParams("account=isa");
    render(<SiteHeader />);
    const isaTab = screen.getByRole("link", { name: "중개형ISA" });
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
});
