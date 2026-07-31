import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { DIAGNOSIS_QUESTIONS, STYLE_STORAGE_KEY } from "@/lib/onboarding/style-diagnosis";
import { StyleOnboarding } from "../style-onboarding";

describe("StyleOnboarding", () => {
  beforeEach(() => localStorage.clear());

  it("첫 방문에 10문항 안내와 건너뛰기를 제공한다", async () => {
    render(<StyleOnboarding />);

    expect(await screen.findByRole("dialog", { name: "ETF 투자 스타일 점검" })).toBeInTheDocument();
    expect(screen.getByText(/약 2분 · 10문항/)).toBeInTheDocument();
    expect(screen.getByText("나의 ETF 투자 스타일 점검")).toBeInTheDocument();
    expect(screen.queryByLabelText("10가지 동물 유형 미리보기")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "건너뛰기" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STYLE_STORAGE_KEY)!).status).toBe("skipped");
  });

  it("1~10 슬라이더로 10문항에 답하면 동물 결과와 두 계좌 동선을 저장한다", async () => {
    render(<StyleOnboarding />);
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "투자 스타일 점검 시작" }));

    for (const [index] of DIAGNOSIS_QUESTIONS.entries()) {
      fireEvent.change(screen.getByRole("slider", { name: "A와 B 사이의 위치" }), { target: { value: "1" } });
      fireEvent.click(screen.getByRole("button", {
        name: index === DIAGNOSIS_QUESTIONS.length - 1 ? "내 동물 확인" : "다음 질문",
      }));
    }

    expect(screen.getByRole("heading", { name: "원칙을 지키는 거북이" })).toBeInTheDocument();
    expect(screen.getByText("5가지 탐색 축")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "연금 계좌에서 ETF 찾기" })).toHaveAttribute("href", "/?mode=pension");
    expect(screen.getByRole("link", { name: "일반 계좌에서 ETF 찾기" })).toHaveAttribute("href", "/?mode=general");
    expect(screen.getByRole("link", { name: "내 스타일 가이드 보기" })).toHaveAttribute("href", "/guides?style=turtle");

    const stored = JSON.parse(localStorage.getItem(STYLE_STORAGE_KEY)!);
    expect(stored).toMatchObject({ version: 3, status: "completed", style: "turtle" });
    expect(Object.keys(stored.answers)).toHaveLength(10);
  });
});
