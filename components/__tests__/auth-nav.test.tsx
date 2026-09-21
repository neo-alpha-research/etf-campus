import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AuthNav } from "../auth/auth-nav";

let mockSession = {
  authenticated: false,
  user: null as { email: string; displayName?: string } | null,
  isLoading: false,
  signOut: vi.fn(),
};

vi.mock("@/components/auth/use-auth-session", () => ({
  useAuthSession: () => mockSession,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/explore/",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

describe("AuthNav Component - Responsive Compact Account Menu", () => {
  beforeEach(() => {
    mockSession = {
      authenticated: false,
      user: null,
      isLoading: false,
      signOut: vi.fn(),
    };
  });

  it("비로그인 상태에서 로그인 링크와 모바일 드롭다운 트리거가 정상 렌더링된다", () => {
    render(<AuthNav />);

    // 데스크톱 로그인 링크 확인
    const desktopLogin = screen.getByRole("link", { name: "로그인" });
    expect(desktopLogin).toHaveAttribute("href", expect.stringContaining("/login"));

    // 모바일 로그인 드롭다운 트리거 확인
    const mobileTrigger = screen.getByRole("button", { name: "계정 및 로그인 메뉴" });
    expect(mobileTrigger).toBeInTheDocument();
  });

  it("비로그인 상태에서 모바일 트리거를 클릭하면 로그인, 회원가입, 적성 진단 메뉴가 펼쳐진다", () => {
    render(<AuthNav />);

    const mobileTrigger = screen.getByRole("button", { name: "계정 및 로그인 메뉴" });
    fireEvent.click(mobileTrigger);

    expect(screen.getByRole("menu", { name: "계정 메뉴" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /무료 회원가입/i })).toHaveAttribute("href", expect.stringContaining("/register"));
    expect(screen.getByRole("menuitem", { name: /전공 적성 진단/i })).toBeInTheDocument();
  });

  it("로그인 상태에서는 [내 계정] 버튼 하나만 노출된다", () => {
    mockSession = {
      authenticated: true,
      user: { email: "investor@etfcampus.dev", displayName: "투자왕" },
      isLoading: false,
      signOut: vi.fn(),
    };

    render(<AuthNav />);

    const accountBtn = screen.getByRole("button", { name: /내 계정 메뉴/i });
    expect(accountBtn).toBeInTheDocument();
    expect(screen.getByText("투자왕")).toBeInTheDocument();
  });

  it("로그인 상태에서 [내 계정] 클릭 시 사용자 이메일과 로그아웃 버튼이 팝업된다", () => {
    mockSession = {
      authenticated: true,
      user: { email: "investor@etfcampus.dev", displayName: "투자왕" },
      isLoading: false,
      signOut: vi.fn(),
    };

    render(<AuthNav />);

    const accountBtn = screen.getByRole("button", { name: /내 계정 메뉴/i });
    fireEvent.click(accountBtn);

    expect(screen.getByRole("menu", { name: "사용자 계정 메뉴" })).toBeInTheDocument();
    expect(screen.getByText("investor@etfcampus.dev")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /로그아웃/i })).toBeInTheDocument();
  });

  it("드롭다운이 열린 상태에서 Escape 키를 누르면 닫힌다", () => {
    mockSession = {
      authenticated: true,
      user: { email: "investor@etfcampus.dev", displayName: "투자왕" },
      isLoading: false,
      signOut: vi.fn(),
    };

    render(<AuthNav />);

    const accountBtn = screen.getByRole("button", { name: /내 계정 메뉴/i });
    fireEvent.click(accountBtn);
    expect(screen.getByRole("menu", { name: "사용자 계정 메뉴" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("menu", { name: "사용자 계정 메뉴" })).not.toBeInTheDocument();
  });
});
