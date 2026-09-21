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

    fireEvent.click(screen.getByRole("button", { name: "이메일 간편 로그인 / 회원가입" }));

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
    
    // 2. verify OTP (reset password returns passwordSetupRequired)
    mocks.communityFetch.mockResolvedValueOnce({
      authenticated: true,
      passwordSetupRequired: true,
      isPasswordReset: true,
    });
    
    // 3. set password throws error with passwordChanged: true
    const setPasswordError = new Error("비밀번호는 정상 변경되었습니다. 새 비밀번호로 다시 로그인해 주세요.") as Error & { status: number; code: string; body: { passwordChanged: boolean } };
    setPasswordError.status = 503;
    setPasswordError.code = "UNAVAILABLE";
    setPasswordError.body = { passwordChanged: true };
    mocks.communityFetch.mockRejectedValueOnce(setPasswordError);

    render(<CommunityAuthDialog open onClose={vi.fn()} onAuthenticated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "비밀번호 재설정" }));

    // OTP request step
    await act(async () => mocks.captchaCallbacks.get("community_otp_request")?.("token1"));
    fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "test@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "8자리 인증 코드 받기" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "인증 완료" })).toBeInTheDocument());

    // OTP verify step
    await act(async () => mocks.captchaCallbacks.get("community_otp_verify")?.("token2"));
    fireEvent.change(screen.getByLabelText("인증 코드"), { target: { value: "12345678" } });
    fireEvent.click(screen.getByRole("button", { name: "인증 완료" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "비밀번호 저장 후 계속" })).toBeInTheDocument());

    // Set password step
    await act(async () => mocks.captchaCallbacks.get("community_password_set")?.("token3"));
    fireEvent.change(screen.getByLabelText("새 비밀번호"), { target: { value: "password123" } });
    fireEvent.change(screen.getByLabelText("새 비밀번호 확인"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "비밀번호 저장 후 계속" }));
    
    // Expect fallback to login step
    await waitFor(() => {
      expect(screen.getByText("비밀번호는 정상 변경되었습니다. 새 비밀번호로 다시 로그인해 주세요.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "이메일 로그인" })).toBeInTheDocument(); // Login step's main button
    });
  });

  it("기존 회원이 이메일 간편 로그인으로 인증 코드를 입력하면 비밀번호 설정 없이 즉시 인증 완료된다", async () => {
    const onAuthenticated = vi.fn();
    mocks.communityFetch
      .mockResolvedValueOnce({ message: "인증 코드를 보냈습니다." })
      .mockResolvedValueOnce({
        authenticated: true,
        profileConfigured: true,
        passwordSetupRequired: false,
        isNewUser: false,
      });

    render(<CommunityAuthDialog open onClose={vi.fn()} onAuthenticated={onAuthenticated} />);
    fireEvent.click(screen.getByRole("button", { name: "이메일 간편 로그인 / 회원가입" }));

    // OTP request step
    await act(async () => mocks.captchaCallbacks.get("community_otp_request")?.("token1"));
    fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "existing@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "8자리 인증 코드 받기" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "인증 완료" })).toBeInTheDocument());

    // OTP verify step
    await act(async () => mocks.captchaCallbacks.get("community_otp_verify")?.("token2"));
    fireEvent.change(screen.getByLabelText("인증 코드"), { target: { value: "87654321" } });
    fireEvent.click(screen.getByRole("button", { name: "인증 완료" }));

    // Should call onAuthenticated immediately without showing password setup
    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("button", { name: "비밀번호 저장 후 계속" })).not.toBeInTheDocument();
  });

  it("닉네임은 있지만 필수 약관 동의가 필요한 기존 회원은 비밀번호 설정과 온보딩을 건너뛰고 약관 보완(terms API) 후 즉시 인증 완료된다", async () => {
    const onAuthenticated = vi.fn();
    mocks.communityFetch
      .mockResolvedValueOnce({ message: "인증 코드를 보냈습니다." })
      .mockResolvedValueOnce({
        authenticated: true,
        profileConfigured: false,
        hasNickname: true,
        hasTermsConsent: false,
        needsTermsConsent: true,
        passwordSetupRequired: false,
        isNewUser: false,
        user: { id: "uuid-123", email: "existing@example.com", nickname: "기존연구원" },
      })
      .mockResolvedValueOnce({
        hasNickname: true,
        hasTermsConsent: false,
        profile: { nickname: "기존연구원" },
      })
      .mockResolvedValueOnce({
        success: true,
        profileConfigured: true,
      });

    render(<CommunityAuthDialog open onClose={vi.fn()} onAuthenticated={onAuthenticated} />);
    fireEvent.click(screen.getByRole("button", { name: "이메일 간편 로그인 / 회원가입" }));

    // OTP request step
    await act(async () => mocks.captchaCallbacks.get("community_otp_request")?.("token1"));
    fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "existing@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "8자리 인증 코드 받기" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "인증 완료" })).toBeInTheDocument());

    // OTP verify step
    await act(async () => mocks.captchaCallbacks.get("community_otp_verify")?.("token2"));
    fireEvent.change(screen.getByLabelText("인증 코드"), { target: { value: "87654321" } });
    fireEvent.click(screen.getByRole("button", { name: "인증 완료" }));

    // 비밀번호 설정(password-setup) 건너뛰고 바로 이용약관 동의(profile) 화면으로 이동
    await waitFor(() => {
      expect(screen.getByText("이용약관 동의")).toBeInTheDocument();
      expect(screen.getByText("기존 회원")).toBeInTheDocument();
      expect(screen.getByText("기존연구원")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "동의하고 계속하기" })).toBeInTheDocument();
    });

    // 약관 체크박스 선택
    fireEvent.click(screen.getByLabelText(/만 14세 이상입니다/));
    fireEvent.click(screen.getByLabelText(/서비스 이용약관 동의/));
    fireEvent.click(screen.getByLabelText(/개인정보 수집 및 이용 동의/));

    // 동의하고 계속하기 클릭
    fireEvent.click(screen.getByRole("button", { name: "동의하고 계속하기" }));

    // terms API가 호출되고 온보딩(맞춤 정보 설정) 화면을 거치지 않고 즉시 onAuthenticated 호출
    await waitFor(() => {
      expect(mocks.communityFetch).toHaveBeenCalledWith(
        "/api/community/auth/terms",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"agreedToTerms":true'),
        })
      );
      expect(onAuthenticated).toHaveBeenCalledTimes(1);
    });

    // 신규 온보딩 화면이나 버튼이 노출되지 않음을 확인
    expect(screen.queryByText("맞춤 정보 설정")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "커뮤니티 시작하기" })).not.toBeInTheDocument();
  });
});
