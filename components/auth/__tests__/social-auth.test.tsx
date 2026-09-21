import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/community/turnstile-captcha", () => ({
  TurnstileCaptcha: () => <div data-testid="captcha" />,
}));

vi.mock("@/lib/community/browser-client", () => ({
  communityFetch: vi.fn(),
  markCommunitySession: vi.fn(),
  refreshCommunitySession: vi.fn(),
}));

import { SupabaseAuthFlow } from "../supabase-auth-flow";

describe("SupabaseAuthFlow Social Login UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders Kakao and Naver social login buttons in login step", () => {
    render(<SupabaseAuthFlow onAuthenticated={vi.fn()} />);

    expect(screen.getByRole("button", { name: /카카오로 3초 만에 시작하기/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /네이버로 시작하기/i })).toBeInTheDocument();
    expect(screen.getByText("또는 이메일로 로그인")).toBeInTheDocument();
  });

  it("displays friendly error message for initialError", () => {
    const { rerender } = render(<SupabaseAuthFlow initialError="oauth_cancelled" onAuthenticated={vi.fn()} />);
    expect(screen.getByText("소셜 로그인이 취소되었습니다.")).toBeInTheDocument();

    rerender(<SupabaseAuthFlow initialError="invalid_state" onAuthenticated={vi.fn()} />);
    expect(screen.getByText("로그인 세션이 만료되었습니다. 다시 시도해 주세요.")).toBeInTheDocument();
  });

  it("handles localhost mock social login for developer convenience", () => {
    const onAuth = vi.fn();
    render(<SupabaseAuthFlow onAuthenticated={onAuth} />);

    const kakaoBtn = screen.getByRole("button", { name: /카카오로 3초 만에 시작하기/i });
    fireEvent.click(kakaoBtn);

    expect(onAuth).toHaveBeenCalledTimes(1);
    const saved = localStorage.getItem("etf-campus:local-session");
    expect(saved).toContain("kakao_user@oauth.etfcampus.kr");
  });
});
