import { describe, expect, it } from "vitest";

import { diagnoseStyle, parseStoredDiagnosis, STYLE_STORAGE_KEY, type DiagnosisAnswers } from "../style-diagnosis";

function answers(overrides: Partial<DiagnosisAnswers>): DiagnosisAnswers {
  return { account: "both", marketMove: "rule", preference: "stability", experience: "basic", campusRoom: "foundation", ...overrides };
}

describe("투자 스타일 진단", () => {
  it.each([
    ["fortress", answers({ marketMove: "volatility", preference: "stability", campusRoom: "foundation" })],
    ["compass", answers({ marketMove: "balance", preference: "allocation", campusRoom: "studio" })],
    ["explorer", answers({ marketMove: "context", preference: "breadth", campusRoom: "exploration" })],
    ["architect", answers({ marketMove: "data", preference: "criteria", campusRoom: "lab" })],
  ] as const)("%s 결과를 판정한다", (expected, input) => {
    expect(diagnoseStyle(input)).toBe(expected);
  });

  it("저장 키에 버전을 포함한다", () => {
    expect(STYLE_STORAGE_KEY).toBe("etfcampus.style.v1");
  });

  it("유효한 완료 결과만 복원하고 잘못된 값은 무시한다", () => {
    const stored = { version: 1, status: "completed", answers: answers({}), style: "fortress", completedAt: "2026-07-20T00:00:00.000Z" };
    expect(parseStoredDiagnosis(JSON.stringify(stored))).toEqual(stored);
    expect(parseStoredDiagnosis('{"version":2}')).toBeNull();
    expect(parseStoredDiagnosis("invalid")).toBeNull();
  });
});
