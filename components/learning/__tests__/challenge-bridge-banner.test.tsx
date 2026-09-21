import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { ChallengeBridgeBanner } from "../challenge-bridge-banner";
import { ChallengeWaitlistModal } from "../challenge-waitlist-modal";

describe("ChallengeBridgeBanner - Neutral Educational Copy", () => {
  it("담백한 교육 안내 헤드라인과 3대 점검 기둥, 면책 문구를 올바르게 렌더링한다", () => {
    render(<ChallengeBridgeBanner source="compare_test" />);

    expect(
      screen.getByText("ETF 비용과 계좌별 규칙을 차근차근 확인해 보세요")
    ).toBeInTheDocument();

    expect(screen.getByText("실부담비용 항목 이해")).toBeInTheDocument();
    expect(screen.getByText("계좌별 편입 규칙 점검")).toBeInTheDocument();
    expect(screen.getByText("단계별 자가 점검 루틴")).toBeInTheDocument();

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
      screen.getByRole("button", { name: /출시 알림 신청하기/ })
    ).toBeInTheDocument();
  });

  it("출시 알림 버튼 클릭 시 대기자 등록 모달이 열린다", () => {
    render(<ChallengeBridgeBanner source="compare_test" />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /출시 알림 신청하기/ }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /ETF 비용과 계좌별 규칙 자가 점검 가이드/ })
    ).toBeInTheDocument();
  });
});

describe("ChallengeWaitlistModal - Operational Requirements & A11y", () => {
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

  it("동의 체크박스는 기본 미선택(unchecked)이어야 하며, 미동의 시 에러를 표시한다", () => {
    render(<ChallengeWaitlistModal isOpen={true} onClose={() => {}} />);

    const checkbox = screen.getByLabelText(/위 개인정보 수집·이용 및 출시 알림 수신에 동의합니다/);
    expect(checkbox).not.toBeChecked();

    const emailInput = screen.getByLabelText(/출시 알림 수신 이메일/);
    fireEvent.change(emailInput, { target: { value: "lead@example.com" } });

    fireEvent.submit(screen.getByTestId("waitlist-form"));

    expect(
      screen.getByText("개인정보 수집 및 출시 알림 수신에 동의해 주세요.")
    ).toBeInTheDocument();
  });

  it("이메일 입력 및 필수 동의 후 성공적으로 신청되면 완료 화면을 표시한다", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, message: "신청 완료" }),
    });
    global.fetch = mockFetch;

    render(<ChallengeWaitlistModal isOpen={true} onClose={() => {}} />);

    const emailInput = screen.getByLabelText(/출시 알림 수신 이메일/);
    fireEvent.change(emailInput, { target: { value: "lead@example.com" } });

    // 동의 체크
    const checkbox = screen.getByLabelText(/위 개인정보 수집·이용 및 출시 알림 수신에 동의합니다/);
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    // 제출
    const submitBtn = screen.getByRole("button", { name: /출시 알림 신청하기/ });
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
        screen.getByText("출시 알림 신청이 완료되었습니다")
      ).toBeInTheDocument();
    });
  });

  it("이메일 형식 오류 시 클라이언트 유효성 에러를 표시한다", () => {
    render(<ChallengeWaitlistModal isOpen={true} onClose={() => {}} />);

    const emailInput = screen.getByLabelText(/출시 알림 수신 이메일/);
    fireEvent.change(emailInput, { target: { value: "bad-email-no-at" } });

    fireEvent.submit(screen.getByTestId("waitlist-form"));

    expect(screen.getByText("유효한 이메일 주소를 입력해 주세요.")).toBeInTheDocument();
  });

  it("API 실패 응답 시 에러 메시지를 표시하고 기존 입력값을 보존한다", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: { message: "데이터베이스에 접수 내역을 기록하지 못했습니다. 잠시 후 다시 시도해 주세요." },
      }),
    });
    global.fetch = mockFetch;

    render(<ChallengeWaitlistModal isOpen={true} onClose={() => {}} />);

    const emailInput = screen.getByLabelText(/출시 알림 수신 이메일/) as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: "keep-me@example.com" } });

    const checkbox = screen.getByLabelText(/위 개인정보 수집·이용 및 출시 알림 수신에 동의합니다/);
    fireEvent.click(checkbox);

    fireEvent.submit(screen.getByTestId("waitlist-form"));

    await waitFor(() => {
      expect(
        screen.getByText("데이터베이스에 접수 내역을 기록하지 못했습니다. 잠시 후 다시 시도해 주세요.")
      ).toBeInTheDocument();
    });

    // 입력값 보존 검증
    expect(emailInput.value).toBe("keep-me@example.com");
  });
});
