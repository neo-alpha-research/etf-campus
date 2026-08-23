import { describe, it, expect } from 'vitest';
import { getJudgmentTimeBounds, evaluateRecord } from "./judgment";

describe("Judgment Core Logic", () => {
  it("calculates time bounds correctly for KST", () => {
    // Simulate Cron running at 2026-08-24T03:05:00.000Z (which is 2026-08-24 12:05 KST)
    const runTime = new Date("2026-08-24T03:05:00.000Z");
    const bounds = getJudgmentTimeBounds(runTime, "2026-08-01");
    
    // We are judging for yesterday, which is 2026-08-23
    expect(bounds.targetDateStr).toBe("2026-08-23");
    
    // 2026-08-23 - 2026-08-01 = 22 days diff -> Day 23
    expect(bounds.dayNumber).toBe(23);
    
    // On-time deadline: 2026-08-23 23:59:59 KST = 2026-08-23 14:59:59 UTC
    expect(bounds.onTimeDeadline.toISOString()).toBe("2026-08-23T14:59:59.000Z");
    
    // Late deadline: 2026-08-24 12:00:00 KST = 2026-08-24 03:00:00 UTC
    expect(bounds.lateDeadline.toISOString()).toBe("2026-08-24T03:00:00.000Z");
  });

  describe("evaluateRecord", () => {
    const bounds = {
      targetDateStr: "2026-08-23",
      dayNumber: 23,
      onTimeDeadline: new Date("2026-08-23T14:59:59.000Z"),
      lateDeadline: new Date("2026-08-24T03:00:00.000Z")
    };

    it("accepts on-time records", () => {
      const post = {
        is_author_seed: false,
        challenge_day_number: 23,
        body_text: "a".repeat(30),
        created_at: "2026-08-23T14:00:00.000Z" // 23:00 KST
      };
      expect(evaluateRecord(post, bounds)).toEqual({ status: "on_time", reason: null });
    });

    it("accepts late records before late deadline", () => {
      const post = {
        is_author_seed: false,
        challenge_day_number: 23,
        body_text: "a".repeat(30),
        created_at: "2026-08-24T01:00:00.000Z" // 10:00 KST next day
      };
      expect(evaluateRecord(post, bounds)).toEqual({ status: "late", reason: null });
    });

    it("rejects late records after late deadline", () => {
      const post = {
        is_author_seed: false,
        challenge_day_number: 23,
        body_text: "a".repeat(30),
        created_at: "2026-08-24T03:00:01.000Z" // 12:00:01 KST next day
      };
      expect(evaluateRecord(post, bounds)).toEqual({ status: "failed", reason: "마감 시각 초과 (지각 인정 시간 초과)" });
    });

    it("rejects short text", () => {
      const post = {
        is_author_seed: false,
        challenge_day_number: 23,
        body_text: "too short",
        created_at: "2026-08-23T14:00:00.000Z"
      };
      expect(evaluateRecord(post, bounds)).toEqual({ status: "failed", reason: "본문 길이 30자 미만" });
    });
    
    it("rejects forbidden words", () => {
      const post = {
        is_author_seed: false,
        challenge_day_number: 23,
        body_text: "이것은 충분히 긴 텍스트입니다. 하지만 100만원 벌었어요.",
        created_at: "2026-08-23T14:00:00.000Z"
      };
      expect(evaluateRecord(post, bounds)).toEqual({ status: "failed", reason: "금칙어(절대금액) 포함" });
    });
  });
});
