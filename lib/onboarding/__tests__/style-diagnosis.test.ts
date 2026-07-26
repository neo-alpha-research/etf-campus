import { describe, expect, it } from "vitest";

import {
  AXIS_DEFINITIONS,
  DIAGNOSIS_QUESTIONS,
  diagnoseStyle,
  getAxisScores,
  parseStoredDiagnosis,
  STYLE_PROFILES,
  STYLE_STORAGE_KEY,
  type DiagnosisAnswers,
  type ScaleAnswer,
} from "../style-diagnosis";

function answers(value: ScaleAnswer): DiagnosisAnswers {
  return Object.fromEntries(
    DIAGNOSIS_QUESTIONS.map((question) => [question.id, value]),
  ) as DiagnosisAnswers;
}

describe("ETF 동물 투자 스타일 진단", () => {
  it("5개 축을 두 번씩 묻는 10문항으로 구성한다", () => {
    expect(DIAGNOSIS_QUESTIONS).toHaveLength(10);
    expect(Object.keys(STYLE_PROFILES)).toHaveLength(10);

    for (const axis of AXIS_DEFINITIONS) {
      expect(DIAGNOSIS_QUESTIONS.filter((question) => question.axis === axis.id)).toHaveLength(2);
    }
  });

  it("1~10 위치를 축별 -1~1 점수로 정규화한다", () => {
    expect(getAxisScores(answers(1))).toEqual({
      view: -1,
      range: -1,
      timing: -1,
      criteria: -1,
      depth: -1,
    });
    expect(getAxisScores(answers(10))).toEqual({
      view: 1,
      range: 1,
      timing: 1,
      criteria: 1,
      depth: 1,
    });
  });

  it("축 점수와 가장 가까운 동물 유형을 결정한다", () => {
    expect(diagnoseStyle(answers(1))).toBe("turtle");
    expect(diagnoseStyle(answers(10))).toBe("fox");

    const octopusAnswers = answers(10);
    octopusAnswers.reviewDay = 1;
    octopusAnswers.briefingHabit = 1;
    expect(diagnoseStyle(octopusAnswers)).toBe("octopus");
  });

  it("10가지 동물 유형이 각각 도달 가능한 점수 조합을 갖는다", () => {
    for (const [style, profile] of Object.entries(STYLE_PROFILES)) {
      const input = Object.fromEntries(
        DIAGNOSIS_QUESTIONS.map((question) => [
          question.id,
          profile.vector[question.axis] < 0 ? 1 : 10,
        ]),
      ) as DiagnosisAnswers;
      expect(diagnoseStyle(input)).toBe(style);
    }
  });

  it("계좌 정보 없이 탐색 습관만으로 결과를 계산한다", () => {
    expect(Object.keys(answers(0))).not.toContain("account");
  });

  it("새 진단은 기존 결과와 분리된 v3 저장 키를 사용한다", () => {
    expect(STYLE_STORAGE_KEY).toBe("etfcampus.style.v3");
  });

  it("유효한 v3 완료 결과만 복원하고 이전 버전은 무시한다", () => {
    const input = answers(1);
    const stored = {
      version: 3,
      status: "completed",
      answers: input,
      style: "turtle",
      axisScores: getAxisScores(input),
      completedAt: "2026-07-25T00:00:00.000Z",
    };

    expect(parseStoredDiagnosis(JSON.stringify(stored))).toEqual(stored);
    expect(parseStoredDiagnosis('{"version":2}')).toBeNull();
    expect(parseStoredDiagnosis('{"version":3,"status":"completed"}')).toBeNull();
    expect(parseStoredDiagnosis("invalid")).toBeNull();
  });
});
