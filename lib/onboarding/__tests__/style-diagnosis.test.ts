import { describe, expect, it } from "vitest";

import {
  AXIS_DEFINITIONS,
  BOOK_SLUG_BY_NEED,
  DIAGNOSIS_QUESTIONS,
  diagnoseStyle,
  getAxisScores,
  getOppositeStyle,
  parseStoredDiagnosis,
  prescribeBooks,
  PRESCRIPTION_QUESTIONS,
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

describe("ETF 동물 투자 스타일 진단 (1층 정체성)", () => {
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

  it("축 점수와 가장 가까운 동물 유형을 결정한다 (회귀 검증)", () => {
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

  it("10가지 동물 유형 모두 유효한 한 줄 punchline을 보유한다", () => {
    for (const profile of Object.values(STYLE_PROFILES)) {
      expect(profile.punchline).toBeDefined();
      expect(profile.punchline.length).toBeGreaterThan(10);
    }
  });

  it("대비 유형(가장 먼 벡터)을 정상 산출한다", () => {
    expect(getOppositeStyle("turtle")).toBe("fox");
    expect(getOppositeStyle("fox")).toBe("turtle");
  });

  it("계좌 정보 없이 탐색 습관만으로 결과를 계산한다", () => {
    expect(Object.keys(answers(1))).not.toContain("account");
  });
});

describe("3편 시리즈 도서 처방 로직 (2층 처방)", () => {
  it("처방 문항은 3문항이며 가중치는 3, 2, 2이다", () => {
    expect(PRESCRIPTION_QUESTIONS).toHaveLength(3);
    expect(PRESCRIPTION_QUESTIONS[0].weight).toBe(3);
    expect(PRESCRIPTION_QUESTIONS[1].weight).toBe(2);
    expect(PRESCRIPTION_QUESTIONS[2].weight).toBe(2);
  });

  it("모든 문항에서 일치하는 니즈 선택 시 최고점 7점으로 배정된다", () => {
    const result = prescribeBooks({ gap: "signal", regret: "signal", goal: "signal" });
    expect(result).not.toBeNull();
    expect(result?.needScores).toEqual({ signal: 7, map: 0, income: 0 });
    expect(result?.primaryBookSlug).toBe(BOOK_SLUG_BY_NEED.signal);
    expect(result?.order[0]).toBe(BOOK_SLUG_BY_NEED.signal);
  });

  it("동점 처리 1순위: gap(가중 3) 문항에서 선택한 니즈가 우선한다", () => {
    const result = prescribeBooks({ gap: "income", regret: "signal", goal: "map" });
    expect(result).not.toBeNull();
    expect(result?.needScores).toEqual({ signal: 2, map: 2, income: 3 });
    expect(result?.primaryBookSlug).toBe(BOOK_SLUG_BY_NEED.income);
    // signal과 map은 둘 다 2점으로 동점 -> 2순위 규칙에 따라 map(②편) 우선
    expect(result?.order).toEqual([
      BOOK_SLUG_BY_NEED.income,
      BOOK_SLUG_BY_NEED.map,
      BOOK_SLUG_BY_NEED.signal,
    ]);
  });

  it("동점 처리 2순위: 완전 동점 시 map(②편 지수·자산배분)이 우선한다", () => {
    // regret=signal(2), goal=map(2), gap은 미응답이 아니라면 gap이 3점을 차지하므로 점수가 다름
    // 만약 gap=signal(3), regret=map(2), goal=income(2)인 경우 2위 동점(map vs income):
    const result = prescribeBooks({ gap: "signal", regret: "income", goal: "map" });
    expect(result?.order).toEqual([
      BOOK_SLUG_BY_NEED.signal,
      BOOK_SLUG_BY_NEED.map,
      BOOK_SLUG_BY_NEED.income,
    ]);
  });

  it("3문항 중 하나라도 누락되면 처방 결과는 null이다", () => {
    expect(prescribeBooks({ gap: "signal", regret: "map" })).toBeNull();
  });
});

describe("저장 스키마 v4 및 v3 호환성", () => {
  it("새 진단은 v4 저장 키를 사용한다", () => {
    expect(STYLE_STORAGE_KEY).toBe("etfcampus.style.v4");
  });

  it("유효한 v4 완료 결과(처방 포함)를 정상 파싱한다", () => {
    const input = answers(1);
    const stored = {
      version: 4,
      status: "completed",
      resultId: "test-uuid-1234",
      answers: input,
      style: "turtle",
      axisScores: getAxisScores(input),
      prescription: {
        answers: { gap: "map", regret: "map", goal: "map" },
        needScores: { signal: 0, map: 7, income: 0 },
        primaryBookSlug: "index-asset-allocation",
        order: ["index-asset-allocation", "momentum-etf-system", "dividend-cashflow"],
      },
      completedAt: "2026-08-27T00:00:00.000Z",
    };

    const parsed = parseStoredDiagnosis(JSON.stringify(stored));
    expect(parsed).toMatchObject({
      version: 4,
      status: "completed",
      resultId: "test-uuid-1234",
      style: "turtle",
      prescription: {
        primaryBookSlug: "index-asset-allocation",
      },
    });
  });

  it("기존 v3 저장값은 동물 결과를 유지하면서 v4로 무손실 승격한다", () => {
    const input = answers(1);
    const v3Stored = {
      version: 3,
      status: "completed",
      answers: input,
      style: "turtle",
      axisScores: getAxisScores(input),
      completedAt: "2026-07-25T00:00:00.000Z",
    };

    const parsed = parseStoredDiagnosis(JSON.stringify(v3Stored));
    expect(parsed).not.toBeNull();
    expect(parsed?.version).toBe(4);
    expect(parsed?.status).toBe("completed");
    if (parsed?.status === "completed") {
      expect(parsed.style).toBe("turtle");
      expect(parsed.prescription).toBeUndefined();
      expect(parsed.resultId).toBeDefined();
      expect(parsed.completedAt).toBe("2026-07-25T00:00:00.000Z");
    }
  });

  it("잘못된 버전이나 데이터는 거부한다", () => {
    expect(parseStoredDiagnosis('{"version":2}')).toBeNull();
    expect(parseStoredDiagnosis('{"version":4,"status":"completed"}')).toBeNull();
    expect(parseStoredDiagnosis("invalid")).toBeNull();
  });
});
