import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { ChallengeBridgeBanner } from "../challenge-bridge-banner";
import { ChallengeWaitlistModal } from "../challenge-waitlist-modal";

describe("ChallengeBridgeBanner", () => {
  it("Astra 핵심 카피와 3대 점검 기둥, 면책 문구를 올바르게 렌더링한다", () => {
    render(<ChallengeBridgeBanner source="compare_test" />);

    expect(
      screen.getByText("비교는 끝났습니다. 다음은 내 계좌를 스스로 점검할 차례입니다.")
    ).toBeInTheDocument();

    expect(screen.getByText("숨은 실부담비용 역산")).toBeInTheDocument();
    expect(screen.getByText("70% 위험자산 한도 점검")).toBeInTheDocument();
    expect(screen.getByText("30일 자기주도 체크리스트")).toBeInTheDocument();

    // 면책 조항
    expect(
      screen.getByText(/자본시장법 제101조에 따라 특정 종목의 매수·매도를 권유하지 않습니다/)
    ).toBeInTheDocument();

    // 링크 및 버튼
    expect(screen.getByRole("link", { name: /가이드 둘러보기/ })).toHaveAttribute(
      "href",
      "/books"
    );
    expect(
      screen.getByRole("button", { name: /얼리버드 50% 혜택 알림 받기/ })
    ).toBeInTheDocument();
  });

  it("얼리버드 버튼 클릭 시 대기자 등록 모달이 열린다", () => {
    render(<ChallengeBridgeBanner source="compare_test" />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /얼리버드 50% 혜택 알림 받기/ }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /30일 자기주도 챌린지 & 가이드 패키지/ })
    ).toBeInTheDocument();
  });
});

describe("ChallengeWaitlistModal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("isOpen이 false일 때는 모달을 렌더링하지 않는다", () => {
    const { container } = render(
      <ChallengeWaitlistModal isOpen={false} onClose={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("ESC 키를 누르면 onClose 콜백이 호출된다", () => {
    const handleClose = vi.fn();
    render(<ChallengeWaitlistModal isOpen={true} onClose={handleClose} />);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("이메일 입력 후 성공적으로 신청되면 완료 화면을 표시한다", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, message: "등록 완료" }),
    });
    global.fetch = mockFetch;

    render(<ChallengeWaitlistModal isOpen={true} onClose={() => {}} />);

    const emailInput = screen.getByLabelText(/출시 알림 및 쿠폰 수신 이메일/);
    fireEvent.change(emailInput, { target: { value: "lead@example.com" } });

    // 제출
    const submitBtn = screen.getByRole("button", { name: /얼리버드 50% 혜택 알림 받기/ });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/lead/waitlist",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("lead@example.com"),
        })
      );
    });

    // 성공 메시지 확인
    await waitFor(() => {
      expect(
        screen.getByText("얼리버드 대기자 등록이 완료되었습니다!")
      ).toBeInTheDocument();
    });
  });

  it("이메일 형식 오류 시 클라이언트 유효성 에러를 표시한다", () => {
    render(<ChallengeWaitlistModal isOpen={true} onClose={() => {}} />);

    const emailInput = screen.getByLabelText(/출시 알림 및 쿠폰 수신 이메일/);
    fireEvent.change(emailInput, { target: { value: "bad-email-no-at" } });

    fireEvent.submit(screen.getByTestId("waitlist-form"));

    expect(screen.getByText("유효한 이메일 주소를 입력해 주세요.")).toBeInTheDocument();
  });

  it("API 실패 응답 시 서버 에러 메시지를 표시한다", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: { message: "서버 처리 중 일시적인 오류입니다." },
      }),
    });
    global.fetch = mockFetch;

    render(<ChallengeWaitlistModal isOpen={true} onClose={() => {}} />);

    const emailInput = screen.getByLabelText(/출시 알림 및 쿠폰 수신 이메일/);
    fireEvent.change(emailInput, { target: { value: "test@domain.com" } });

    fireEvent.submit(screen.getByTestId("waitlist-form"));

    await waitFor(() => {
      expect(screen.getByText("서버 처리 중 일시적인 오류입니다.")).toBeInTheDocument();
    });
  });
});
