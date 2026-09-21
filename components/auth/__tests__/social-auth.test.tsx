import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  captchaCallbacks: new Map<string, (token: string | null) => void>(),
  turnstileRenderCount: 0,
  communityFetch: vi.fn(),
}));

vi.mock("@/components/community/turnstile-captcha", () => ({
  TurnstileCaptcha: ({ action, onToken }: { action: string; onToken: (token: string | null) => void }) => {
    mocks.turnstileRenderCount++;
    mocks.captchaCallbacks.set(action, onToken);
    return <div data-testid={`captcha-${action}`} />;
  },
}));

vi.mock("@/lib/community/browser-client", () => ({
  communityFetch: mocks.communityFetch,
  markCommunitySession: vi.fn(),
  refreshCommunitySession: vi.fn(),
}));

import { SupabaseAuthFlow } from "../supabase-auth-flow";

describe("SupabaseAuthFlow Social Login UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.captchaCallbacks.clear();
    mocks.turnstileRenderCount = 0;
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

  it("calls communityFetch for oauth start on non-localhost without error", async () => {
    const originalLocation = window.location;
    const assignMock = vi.fn();
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...originalLocation, hostname: "etf-campus.pages.dev", assign: assignMock },
    });

    try {
      mocks.communityFetch.mockResolvedValueOnce({
        authorizationUrl: "https://kauth.kakao.com/oauth/authorize?client_id=test",
      });

      render(<SupabaseAuthFlow onAuthenticated={vi.fn()} returnTo="/explore/" />);

      const kakaoBtn = screen.getByRole("button", { name: /카카오로 3초 만에 시작하기/i });
      fireEvent.click(kakaoBtn);

      await waitFor(() => {
        expect(mocks.communityFetch).toHaveBeenCalledWith(
          "/api/community/auth/oauth/kakao/start",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ returnTo: "/explore/", rememberMe: true }),
          })
        );
        expect(assignMock).toHaveBeenCalledWith("https://kauth.kakao.com/oauth/authorize?client_id=test");
      });
    } finally {
      Object.defineProperty(window, "location", {
        writable: true,
        value: originalLocation,
      });
    }
  });

  it("typing email or password does not recreate the Turnstile callback function reference", () => {
    render(<SupabaseAuthFlow onAuthenticated={vi.fn()} />);

    const initialCallback = mocks.captchaCallbacks.get("community_password_login");
    expect(initialCallback).toBeDefined();

    const emailInput = screen.getByLabelText("이메일");
    const passwordInput = screen.getByLabelText("비밀번호");

    // Type 10 characters
    fireEvent.change(emailInput, { target: { value: "a" } });
    fireEvent.change(emailInput, { target: { value: "ab" } });
    fireEvent.change(emailInput, { target: { value: "abc@test.com" } });
    fireEvent.change(passwordInput, { target: { value: "p" } });
    fireEvent.change(passwordInput, { target: { value: "password" } });

    // The callback function reference must remain identical across typing
    const updatedCallback = mocks.captchaCallbacks.get("community_password_login");
    expect(updatedCallback).toBe(initialCallback);
  });

  it("buffers Turnstile captcha token and shows '보안 확인 준비 중...' when user submits before captcha completes", async () => {
    const onAuth = vi.fn();
    mocks.communityFetch.mockResolvedValueOnce({ authenticated: true, profileConfigured: true });

    // Mock non-localhost hostname
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...originalLocation, hostname: "etf-campus.pages.dev" },
    });

    try {
      render(<SupabaseAuthFlow onAuthenticated={onAuth} />);

      const emailInput = screen.getByLabelText("이메일");
      const passwordInput = screen.getByLabelText("비밀번호");
      fireEvent.change(emailInput, { target: { value: "user@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "mypassword" } });

      const submitBtn = screen.getByRole("button", { name: "이메일 로그인" });
      expect(submitBtn).toBeEnabled();

      // Submit before captcha token arrives
      fireEvent.click(submitBtn);

      // Verify button shows loading and security check preparation state
      expect(screen.getByRole("button", { name: /보안 확인 준비 중\.\.\./i })).toBeInTheDocument();

      // Now captcha completes asynchronously
      const captchaCallback = mocks.captchaCallbacks.get("community_password_login");
      expect(captchaCallback).toBeDefined();

      captchaCallback?.("buffered-turnstile-token");

      await waitFor(() => {
        expect(mocks.communityFetch).toHaveBeenCalledWith("/api/community/auth/login-password", {
          method: "POST",
          body: JSON.stringify({
            email: "user@example.com",
            password: "mypassword",
            rememberMe: true,
            captchaToken: "buffered-turnstile-token",
          }),
        });
        expect(onAuth).toHaveBeenCalledTimes(1);
      });
    } finally {
      Object.defineProperty(window, "location", {
        writable: true,
        value: originalLocation,
      });
    }
  });
});
