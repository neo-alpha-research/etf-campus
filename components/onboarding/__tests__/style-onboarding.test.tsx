import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { DIAGNOSIS_QUESTIONS, PRESCRIPTION_QUESTIONS, STYLE_CHANGE_EVENT, STYLE_STORAGE_KEY } from "@/lib/onboarding/style-diagnosis";
import { StyleOnboarding } from "../style-onboarding";

function openStyleOnboarding() {
  fireEvent(window, new CustomEvent(STYLE_CHANGE_EVENT, { detail: { open: true } }));
}

describe("StyleOnboarding Component", () => {
  beforeEach(() => localStorage.clear());

  it("첫 방문에는 자동 노출하지 않고 사용자의 명시적 요청에서만 13문항 안내를 연다", async () => {
    render(<StyleOnboarding />);

    expect(screen.queryByRole("dialog", { name: "ETF 투자 스타일 점검" })).not.toBeInTheDocument();

    openStyleOnboarding();
    expect(await screen.findByRole("dialog", { name: "ETF 투자 스타일 점검" })).toBeInTheDocument();
    expect(screen.getByText(/약 3분 · 13문항/)).toBeInTheDocument();
    expect(screen.getByText("나의 ETF 전공 적성 검사")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "건너뛰기" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STYLE_STORAGE_KEY)!).status).toBe("skipped");
  });

  it("1~10 슬라이더로 10문항에 답하면 동물 결과(1층)가 먼저 나오고, 이어서 마무리 3문항(2층)으로 도서가 배정된다", async () => {
    render(<StyleOnboarding />);
    openStyleOnboarding();
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "투자 스타일 점검 시작" }));

    // 10문항 동물 진단 답변 (모두 1번 -> 거북이)
    for (const [index] of DIAGNOSIS_QUESTIONS.entries()) {
      fireEvent.change(screen.getByRole("slider", { name: "A와 B 사이의 위치" }), { target: { value: "1" } });
      fireEvent.click(screen.getByRole("button", {
        name: index === DIAGNOSIS_QUESTIONS.length - 1 ? "내 동물 확인" : "다음 질문",
      }));
    }

    // 1층 동물 결과 확인
    expect(screen.getByRole("heading", { name: "원칙을 지키는 거북이" })).toBeInTheDocument();
    expect(screen.getByText("5가지 탐색 축")).toBeInTheDocument();
    expect(screen.getAllByText(/숫자가 춤을 춰도/)[0]).toBeInTheDocument(); // punchline
    expect(screen.getByText(/나와 가장 다르게 보는 유형/)).toBeInTheDocument();
    expect(screen.getAllByText(/조건을 엮는 여우/)[0]).toBeInTheDocument(); // opposite style

    // 소셜 공유 바 버튼 확인
    expect(screen.getByRole("button", { name: /카카오톡 · SNS 공유/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /결과 링크 복사/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /인스타 스토리 카드 저장/ })).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "연금 계좌에서 ETF 찾기" })).toHaveAttribute("href", "/quick?mode=pension");
    expect(screen.getByRole("link", { name: "일반 계좌에서 ETF 찾기" })).toHaveAttribute("href", "/quick?mode=general");
    expect(screen.getByRole("link", { name: "내 동물 유형(원칙을 지키는 거북이) 전용 페이지 보기" })).toHaveAttribute("href", "/style/turtle");

    // 2층 마무리 3문항 시작하기
    expect(screen.getByText("내 계좌에 비어 있는 도서 1권 찾기")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /마무리 3문항 시작하기/ }));

    // 3문항 마무리 답변
    for (const [pIndex, pQ] of PRESCRIPTION_QUESTIONS.entries()) {
      expect(screen.getByText(pQ.title)).toBeInTheDocument();
      // B 선택지 (map -> index-asset-allocation) 클릭
      const optionB = screen.getByRole("button", { name: new RegExp(`B\\..*${pQ.options[1].label}`) });
      fireEvent.click(optionB);

      fireEvent.click(screen.getByRole("button", {
        name: pIndex === PRESCRIPTION_QUESTIONS.length - 1 ? "도서 결과 확인" : "다음 질문",
      }));
    }

    // 진단 결과 도서 확인 (②편 지수·자산배분)
    expect(screen.getByText("나의 퇴직연금 ETF 시작 도서")).toBeInTheDocument();
    expect(screen.getAllByText("감정을 끄고 시스템으로 ② 지수·자산배분").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/②편\(지수·자산배분\)은 계좌 전체의 목표 비율과 허용 밴드를 세우는 상위 규정서/)).toBeInTheDocument();
    expect(screen.getByText("추천 읽는 순서 (3편 시리즈 전체)")).toBeInTheDocument();

    const stored = JSON.parse(localStorage.getItem(STYLE_STORAGE_KEY)!);
    expect(stored).toMatchObject({
      version: 4,
      status: "completed",
      style: "turtle",
      prescription: {
        primaryBookSlug: "index-asset-allocation",
      },
    });
  });
});
