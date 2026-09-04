import { describe, expect, it } from "vitest";
import {
  AXIS_DEFINITIONS,
  DIAGNOSIS_QUESTIONS,
  diagnoseStyle,
  SCALE_OPTIONS,
  STYLE_PROFILES,
  type DiagnosisAnswers,
  type ScaleAnswer,
  type StyleId,
} from "../style-diagnosis";

describe("Style Diagnosis Distribution & Determinism", () => {
  it("동점 처리가 결정론적이며 동일 응답에 대해 일관된 결과를 반환한다", () => {
    const mockAnswers: DiagnosisAnswers = Object.fromEntries(
      DIAGNOSIS_QUESTIONS.map((q) => [q.id, 4 as ScaleAnswer])
    );
    const result1 = diagnoseStyle(mockAnswers);
    const result2 = diagnoseStyle(mockAnswers);
    expect(result1).toBe(result2);
    expect(Object.keys(STYLE_PROFILES)).toContain(result1);
  });

  it("4단 척도(1, 4, 7, 10) 시뮬레이션에서 어떤 동물도 25%를 초과하지 않고 4% 미만으로 떨어지지 않는다", () => {
    const counts: Record<StyleId, number> = Object.fromEntries(
      Object.keys(STYLE_PROFILES).map((id) => [id as StyleId, 0])
    ) as Record<StyleId, number>;

    const scaleValues = SCALE_OPTIONS.map((o) => o.value);
    const N = 20000;

    // Pseudo-random deterministic LCG generator for reproducible simulation
    let seed = 42;
    function rand() {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    }

    for (let i = 0; i < N; i++) {
      const answers: DiagnosisAnswers = Object.fromEntries(
        DIAGNOSIS_QUESTIONS.map((q) => {
          const val = scaleValues[Math.floor(rand() * scaleValues.length)];
          return [q.id, val as ScaleAnswer];
        })
      );
      const style = diagnoseStyle(answers);
      counts[style]++;
    }

    const shares: Record<string, string> = {};
    for (const [style, count] of Object.entries(counts)) {
      const share = count / N;
      shares[style] = `${(share * 100).toFixed(1)}%`;
      expect(share, `${style} 점유율(${shares[style]})이 25%를 초과하지 않아야 함`).toBeLessThanOrEqual(0.25);
      expect(share, `${style} 점유율(${shares[style]})이 4% 미만으로 떨어지지 않아야 함`).toBeGreaterThanOrEqual(0.04);
    }
  });

  it("과거 1~10 슬라이더 응답(v4)도 하위 호환되며 오류 없이 스타일을 진단한다", () => {
    const turtleAnswers: DiagnosisAnswers = Object.fromEntries(
      DIAGNOSIS_QUESTIONS.map((q) => [q.id, 1 as ScaleAnswer])
    );
    expect(diagnoseStyle(turtleAnswers)).toBe("turtle");

    const foxAnswers: DiagnosisAnswers = Object.fromEntries(
      DIAGNOSIS_QUESTIONS.map((q) => [q.id, 10 as ScaleAnswer])
    );
    expect(diagnoseStyle(foxAnswers)).toBe("fox");
  });
});
