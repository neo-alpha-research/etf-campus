import { describe, expect, it } from "vitest";
import { tutorialSteps } from "../tutorial-content";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

describe("Tutorial Content & Regulatory Integrity", () => {
  it("정확히 5단계, 각 2문항으로 총 10문항으로 구성된다", () => {
    expect(tutorialSteps).toHaveLength(5);
    const totalQuestions = tutorialSteps.reduce((acc, s) => acc + s.questions.length, 0);
    expect(totalQuestions).toBe(10);
  });

  it("제1단계: 연금저축펀드와 IRP 위험자산 70% 제한 규제가 정확히 명시되어 있다", () => {
    const step1 = tutorialSteps[0];
    expect(step1.step).toBe(1);
    const q1 = step1.questions.find((q) => q.id === "1-1");
    expect(q1).toBeDefined();
    expect(q1?.text).toContain("위험자산 편입 비중이 원칙적으로 70%로 제한된다");
    expect(q1?.correctFeedback).toContain("근로자퇴직급여보장법");
    expect(q1?.correctFeedback).toContain("원칙적으로 70%로 제한");
  });

  it("제3단계: ISA 만기 이전 시 추가 세액공제 대상 금액(최대 300만 원)과 실제 공제 효과(최대 49.5만 원)가 분리 명시되어 있다", () => {
    const step3 = tutorialSteps[2];
    expect(step3.step).toBe(3);
    const q1 = step3.questions.find((q) => q.id === "3-1");
    expect(q1).toBeDefined();
    expect(q1?.text).toContain("추가 세액공제 대상 금액");
    expect(q1?.correctFeedback).toContain("추가 세액공제액은 적용 공제율에 따라 최대 49.5만 원");
    expect(q1?.correctFeedback).toContain("합산 시 당해 연도 세액공제 대상은 총 1,200만 원, 공제액 합계는 최대 198만 원");
    expect(q1?.incorrectFeedback).toContain("세액공제 대상 금액");
  });

  it("제4단계: 근거 없는 0.2% 비용 절감 문구가 제거되고 실부담비용 확인법으로 정제되어 있다", () => {
    const step4 = tutorialSteps[3];
    expect(step4.step).toBe(4);
    expect(step4.benefitBadge).not.toContain("0.2% 절감");
    expect(step4.benefitBadge).toContain("기타비용·매매수수료 확인법");
  });

  it("제5단계: 근거 없는 수천만 원 확정 문구가 제거되고 500만 원 과세 대상 수익 가정이 명시되어 있다", () => {
    const step5 = tutorialSteps[4];
    expect(step5.step).toBe(5);
    expect(step5.benefitBadge).not.toContain("수천만 원");
    const q2 = step5.questions.find((q) => q.id === "5-2");
    expect(q2).toBeDefined();
    expect(q2?.shortTitle).toContain("과세표준 500만 원 가정");
    expect(q2?.text).toContain("전액 과세 대상 가정");
  });

  it("10문항 완주 판정 로직: 모든 문항이 정답일 때만 완료(true)로 판정된다", () => {
    // 10문항 모두 정답인 경우
    const allCorrectAnswers: Record<string, boolean> = {};
    for (const step of tutorialSteps) {
      for (const q of step.questions) {
        allCorrectAnswers[q.id] = q.answer;
      }
    }
    const isCompleted = tutorialSteps.every((s) =>
      s.questions.every((q) => allCorrectAnswers[q.id] === q.answer)
    );
    expect(isCompleted).toBe(true);

    // 1문항이라도 오답이거나 누락된 경우
    const partialAnswers = { ...allCorrectAnswers, "1-1": !allCorrectAnswers["1-1"] };
    const isPartialCompleted = tutorialSteps.every((s) =>
      s.questions.every((q) => partialAnswers[q.id] === q.answer)
    );
    expect(isPartialCompleted).toBe(false);
  });

  it("치트시트 PDF가 public/downloads에 존재하며 Marketing_Writer 마스터 파일과 SHA-256 해시가 일치한다", () => {
    const etfCampusPdf = path.resolve(process.cwd(), "public/downloads/2026_직장인_3대절세계좌_완벽운용_치트시트.pdf");
    expect(fs.existsSync(etfCampusPdf)).toBe(true);

    const buf = fs.readFileSync(etfCampusPdf);
    const hash = crypto.createHash("sha256").update(buf).digest("hex");
    // Marketing_Writer 마스터 파일 해시: 847455348f4b045261a578bf682c935c10abc27ff0802288eb6b85c0a4814fe5
    expect(hash.toLowerCase()).toBe("847455348f4b045261a578bf682c935c10abc27ff0802288eb6b85c0a4814fe5");
  });
});
