import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { STYLE_STORAGE_KEY } from "@/lib/onboarding/style-diagnosis";
import { StyleOnboarding } from "../style-onboarding";

describe("StyleOnboarding", () => {
  beforeEach(() => localStorage.clear());

  it("첫 방문에 30초 안내와 건너뛰기를 제공한다", async () => {
    render(<StyleOnboarding />);
    expect(await screen.findByRole("dialog", { name: "ETF 탐색 스타일 진단" })).toBeInTheDocument();
    expect(screen.getByText(/30초 · 5문항/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "건너뛰기" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STYLE_STORAGE_KEY)!).status).toBe("skipped");
  });

  it("5개 답변 후 결과와 계좌 기반 다음 동선을 저장한다", async () => {
    render(<StyleOnboarding />);
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
    for (const answer of ["연금계좌", "얼마나 흔들렸는지", "변동과 위험이 잘 설명된 정보", "기본 설명부터 필요하다", "안전 원칙을 배우는 기초 강의실"]) {
      fireEvent.click(screen.getByRole("button", { name: answer }));
      fireEvent.click(screen.getByRole("button", { name: "다음" }));
    }
    expect(screen.getByRole("heading", { name: "천천히 쌓는 성벽형" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "내 스타일 가이드 보기" })).toHaveAttribute("href", "/guides?style=fortress");
    expect(screen.getByRole("link", { name: "내 계좌 조건으로 스크리너 열기" })).toHaveAttribute("href", "/screener?pension=eligible");
    expect(JSON.parse(localStorage.getItem(STYLE_STORAGE_KEY)!).status).toBe("completed");
  });
});
