import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  captchaCallbacks: new Map<string, (token: string | null) => void>(),
  communityFetch: vi.fn(),
}));

vi.mock("@/components/community/turnstile-captcha", () => ({
  TurnstileCaptcha: ({ action, onToken }: { action: string; onToken: (token: string | null) => void }) => {
    mocks.captchaCallbacks.set(action, onToken);
    return <div data-testid={`captcha-${action}`} />;
  },
}));

vi.mock("@/lib/community/browser-client", () => ({
  communityFetch: mocks.communityFetch,
  markCommunitySession: vi.fn(),
  refreshCommunitySession: vi.fn(),
}));

import { CommunityAuthDialog } from "../community-auth-dialog";

describe("CommunityAuthDialog Turnstile 단계 전환", () => {
  afterEach(() => {
    mocks.captchaCallbacks.clear();
    mocks.communityFetch.mockReset();
  });

  it("OTP 재신청 전에 이미 소비된 request용 Turnstile 토큰을 비운다", async () => {
    mocks.communityFetch.mockResolvedValueOnce({ message: "인증 코드를 보냈습니다." });

    render(<CommunityAuthDialog open onClose={vi.fn()} onAuthenticated={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "신규 회원가입 / 비밀번호 재설정 (이메일 인증)" }));

    await act(async () => {
      mocks.captchaCallbacks.get("community_otp_request")?.("consumed-request-token");
    });

    fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "member@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "8자리 인증 코드 받기" }));
    await waitFor(() => expect(screen.getByTestId("captcha-community_otp_verify")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "이메일 변경" }));
    await waitFor(() => expect(screen.getByTestId("captcha-community_otp_request")).toBeInTheDocument());

    expect(screen.getByRole("button", { name: "8자리 인증 코드 받기" })).toBeDisabled();

    await act(async () => {
      mocks.captchaCallbacks.get("community_otp_request")?.("fresh-request-token");
    });

    expect(screen.getByRole("button", { name: "8자리 인증 코드 받기" })).toBeEnabled();
  });

  it("비밀번호 설정 완료 시 자동 로그인이 실패하면 login 단계로 돌아가 재로그인을 유도한다", async () => {
    // 1. request OTP
    mocks.communityFetch.mockResolvedValueOnce({ message: "인증 코드를 보냈습니다." });
    
    // 2. verify OTP
    mocks.communityFetch.mockResolvedValueOnce({ profileConfigured: true });
    
    // 3. set password throws error with passwordChanged: true
    const setPasswordError = new Error("비밀번호는 정상 변경되었습니다. 새 비밀번호로 다시 로그인해 주세요.") as Error & { status: number; code: string; body: { passwordChanged: boolean } };
    setPasswordError.status = 503;
    setPasswordError.code = "UNAVAILABLE";
    setPasswordError.body = { passwordChanged: true };
    mocks.communityFetch.mockRejectedValueOnce(setPasswordError);

    render(<CommunityAuthDialog open onClose={vi.fn()} onAuthenticated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "신규 회원가입 / 비밀번호 재설정 (이메일 인증)" }));

    // OTP request step
    await act(async () => mocks.captchaCallbacks.get("community_otp_request")?.("token1"));
    fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "test@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "8자리 인증 코드 받기" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "인증 완료" })).toBeInTheDocument());

    // OTP verify step
    await act(async () => mocks.captchaCallbacks.get("community_otp_verify")?.("token2"));
    fireEvent.change(screen.getByLabelText("인증 코드"), { target: { value: "12345678" } });
    fireEvent.click(screen.getByRole("button", { name: "인증 완료" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "비밀번호 설정" })).toBeInTheDocument());

    // Set password step
    await act(async () => mocks.captchaCallbacks.get("community_password_set")?.("token3"));
    fireEvent.change(screen.getByLabelText("새 비밀번호"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "비밀번호 설정" }));
    
    // Expect fallback to login step
    await waitFor(() => {
      expect(screen.getByText("비밀번호는 정상 변경되었습니다. 새 비밀번호로 다시 로그인해 주세요.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "로그인" })).toBeInTheDocument(); // Login step's main button
    });
  });
});
