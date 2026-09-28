import { render, screen } from "@testing-library/react";
import fs from "node:fs";
import { describe, expect, it, vi, afterEach } from "vitest";

import SelfCheckGuidePage, { metadata } from "../page";

describe("SelfCheckGuidePage - Guide & Checklist Page", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("1. 메타데이터가 올바르게 정의되어 있다", () => {
    expect(metadata.title).toBe("ETF 비용·계좌별 규칙 자가 점검 가이드");
    expect(metadata.alternates?.canonical).toBe("/guides/self-check");
  });

  it("2. 정상 상황: 가이드 본문(Part 1, 2), 체크리스트 컴포넌트, 출처 표(Part 4)가 모두 렌더링된다", () => {
    render(<SelfCheckGuidePage />);

    // Breadcrumb
    expect(screen.getByRole("link", { name: /가이드 목록/ })).toHaveAttribute(
      "href",
      "/guides"
    );

    // Part 1
    expect(
      screen.getByRole("heading", { name: "PART 1 — ETF 비용 공시 읽기" })
    ).toBeInTheDocument();

    // Part 2
    expect(
      screen.getByRole("heading", { name: "PART 2 — 계좌별 규칙 확인하기" })
    ).toBeInTheDocument();

    // Checklist heading (from interactive component)
    expect(
      screen.getByRole("heading", { name: "10문항 자가 점검 체크리스트" })
    ).toBeInTheDocument();

    // Part 4
    expect(
      screen.getByRole("heading", {
        name: "PART 4 — 출처, 시행일 및 적용 조건 (Provenance SSOT)",
      })
    ).toBeInTheDocument();

    // Legal disclaimer
    expect(screen.getByText(/자본시장법 제101조 준수/)).toBeInTheDocument();

    // Internal QA notes must NOT be present on page
    expect(
      screen.queryByText(/가상 페르소나 시뮬레이션 평가/)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/프라이버시 아키텍처 원칙/)
    ).not.toBeInTheDocument();
  });

  it("3. 파일 읽기 실패 모의(FS Read Failure Mock): readFileSync 실패 시 크래시 없이 폴백 안내문과 체크리스트가 안전하게 렌더링된다", () => {
    // Mock fs.readFileSync to throw an IO/Permission/ENOENT error
    vi.spyOn(fs, "readFileSync").mockImplementation(() => {
      throw new Error("ENOENT: no such file or directory, open 'etf-self-check-guide-draft.md'");
    });

    render(<SelfCheckGuidePage />);

    // Graceful fallback heading & error message rendered
    expect(screen.getByText("가이드 문서를 불러올 수 없습니다.")).toBeInTheDocument();

    // The interactive checklist component still renders safely
    expect(
      screen.getByRole("heading", { name: "10문항 자가 점검 체크리스트" })
    ).toBeInTheDocument();

    // Part 4 is not rendered when bottomContent is empty
    expect(
      screen.queryByRole("heading", {
        name: "PART 4 — 출처, 시행일 및 적용 조건 (Provenance SSOT)",
      })
    ).not.toBeInTheDocument();
  });
});
