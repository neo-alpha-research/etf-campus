import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { TurnstileCaptcha, _resetTurnstileStateForTesting } from "../turnstile-captcha";

describe("TurnstileCaptcha 실측 검증", () => {
  const originalFetch = globalThis.fetch;
  const originalTurnstile = window.turnstile;

  beforeEach(() => {
    _resetTurnstileStateForTesting();
    document.querySelectorAll('script[src*="challenges.cloudflare.com/turnstile"]').forEach((s) => s.remove());
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    window.turnstile = originalTurnstile;
    _resetTurnstileStateForTesting();
    document.querySelectorAll('script[src*="challenges.cloudflare.com/turnstile"]').forEach((s) => s.remove());
  });

  it("입력 중(부모 컴포넌트 리렌더링) 위젯 render/remove 횟수가 늘어나지 않고 1회를 유지한다", async () => {
    const renderSpy = vi.fn().mockReturnValue("widget-123");
    const removeSpy = vi.fn();
    const resetSpy = vi.fn();

    window.turnstile = {
      render: renderSpy,
      remove: removeSpy,
      reset: resetSpy,
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ required: true, siteKey: "test-site-key" }),
    });

    // 부모 컴포넌트에 input을 배치하여 타이핑 시 리렌더링 유발
    function ParentWithInput() {
      const [text, setText] = useState("");
      return (
        <div>
          <input
            data-testid="email-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <TurnstileCaptcha action="community_password_login" onToken={vi.fn()} />
        </div>
      );
    }

    render(<ParentWithInput />);

    await waitFor(() => {
      expect(renderSpy).toHaveBeenCalledTimes(1);
    });

    // 10회 타이핑 발생
    const input = screen.getByTestId("email-input");
    for (let i = 0; i < 10; i++) {
      fireEvent.change(input, { target: { value: `typing_${i}` } });
    }

    // render와 remove 횟수가 타이핑 중에 증가하지 않음을 실측 확인
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledTimes(0);
  });

  it("최초 스크립트 로드 실패 후 '보안 확인 다시 시도' 클릭 시 스크립트를 재호출하여 렌더링에 성공한다", async () => {
    delete (window as any).turnstile;

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ required: true, siteKey: "test-site-key" }),
    });

    let attemptCount = 0;
    const renderSpy = vi.fn().mockReturnValue("widget-retry-success");

    const originalAppend = document.head.appendChild.bind(document.head);
    const appendSpy = vi.spyOn(document.head, "appendChild").mockImplementation((node) => {
      if (node instanceof HTMLScriptElement && node.src.includes("challenges.cloudflare.com/turnstile")) {
        attemptCount++;
        if (attemptCount === 1) {
          // 1차 시도: 네트워크 장애 시뮬레이션
          setTimeout(() => {
            node.onerror?.(new Event("error") as any);
          }, 10);
        } else {
          // 2차 시도: 정상 로드
          (window as any).turnstile = {
            render: renderSpy,
            remove: vi.fn(),
            reset: vi.fn(),
          };
          setTimeout(() => {
            node.onload?.(new Event("load") as any);
          }, 10);
        }
      }
      return originalAppend(node);
    });

    try {
      render(<TurnstileCaptcha action="community_password_login" onToken={vi.fn()} />);

      // 실패 문구와 재시도 버튼 노출 확인
      await waitFor(() => {
        expect(screen.getByText("보안 확인 도구를 불러오지 못했습니다.")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "보안 확인 다시 시도" })).toBeInTheDocument();
      });

      // 재시도 클릭
      fireEvent.click(screen.getByRole("button", { name: "보안 확인 다시 시도" }));

      // 재시도 후 성공 및 위젯 렌더링 확인
      await waitFor(() => {
        expect(renderSpy).toHaveBeenCalledTimes(1);
        expect(screen.queryByText("보안 확인 도구를 불러오지 못했습니다.")).not.toBeInTheDocument();
      });
    } finally {
      appendSpy.mockRestore();
    }
  });

  it("설정 API(/api/community/auth/config) 요청이 타임아웃(AbortError)되거나 응답 실패 시 에러 메시지와 재시도를 제공한다", async () => {
    window.turnstile = {
      render: vi.fn(),
      remove: vi.fn(),
      reset: vi.fn(),
    };

    // 1. AbortError 타임아웃 시뮬레이션
    globalThis.fetch = vi.fn().mockRejectedValueOnce(
      new DOMException("The operation was aborted", "AbortError")
    );

    const { unmount } = render(<TurnstileCaptcha action="community_password_login" onToken={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("보안 확인 설정 요청 시간이 초과되었습니다.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "보안 확인 다시 시도" })).toBeInTheDocument();
    });

    unmount();
    _resetTurnstileStateForTesting();

    // 2. 500 서버 에러 시뮬레이션
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: "인증 서비스 설정 점검 중" } }),
    });

    render(<TurnstileCaptcha action="community_password_login" onToken={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("인증 서비스 설정 점검 중")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "보안 확인 다시 시도" })).toBeInTheDocument();
    });
  });
});
