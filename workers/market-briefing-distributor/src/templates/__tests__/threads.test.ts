import { describe, expect, it } from "vitest";
import { generateThreadsThread, selectThreadsTopicTag } from "../threads";
import type { MarketBriefingPayload } from "../../types";

const mockPayload: MarketBriefingPayload = {
  asOfDate: "2026-09-18",
  kospiChangePct: 2.66,
  kosdaqChangePct: 0.6,
  generalAumWeightedReturnPct: 1.79,
  upCount: 828,
  flatCount: 27,
  downCount: 173,
  generalEtfCount: 1028,
  peerGroups: [
    { peerGroup: "사이버보안 (보안·양자)", cappedAumWeightedReturnPct: 4.83 },
    { peerGroup: "비만치료제 (바이오)", cappedAumWeightedReturnPct: -1.68 },
  ],
  periodicFlows: {
    dailyFundFlows: {
      topInflows: [
        {
          name: "KODEX 200타겟위클리커버드콜",
          ticker: "0000D0",
          inflow: 1350,
          netInflowValue: 135000000000,
        },
        {
          name: "RISE 200종합채권액티브",
          ticker: "0000E0",
          inflow: 545,
          netInflowValue: 54500000000,
        },
      ],
    },
  },
} as unknown as MarketBriefingPayload;

describe("스레드 템플릿 모바일 레이아웃 및 타이포그래피 예산 검증", () => {
  const posts = generateThreadsThread(mockPayload, "https://etf-campus.pages.dev");
  const post = posts[0]?.content || "";

  it("1. 첫 줄 헤더는 45자 이내여야 한다", () => {
    const lines = post.split("\n");
    const firstLine = lines[0];
    expect(firstLine).toContain("2026.09.18");
    expect(firstLine).toContain("ETF 마켓 동향");
    expect(firstLine.length).toBeLessThanOrEqual(45);
  });

  it("2. 지표 라인은 코스피/코스닥, 주도 테마, 실질 순유입 3행으로 구성되어야 한다", () => {
    expect(post).toContain("코스피");
    expect(post).toContain("코스닥");
    expect(post).toContain("주도 테마:");
    expect(post).toContain("실질 순유입:");
  });

  it("3. 주도 테마와 실질 순유입 1위 종목명은 글자 잘림 없이 완결형으로 노출되어야 한다", () => {
    expect(post).toContain("사이버보안");
    expect(post).toContain("KODEX 200위클리");
  });

  it("4. 분석 불릿은 1., 2., 3. 번호가 매겨지고 48자 이내 단문이어야 한다", () => {
    const lines = post.split("\n");
    const bulletLines = lines.filter(l => /^[1-3]\./.test(l.trim()));
    expect(bulletLines.length).toBe(3);
    for (const b of bulletLines) {
      expect(b.length).toBeLessThanOrEqual(48);
    }
  });

  it("5. 기계적 투표 및 사족 질문 CTA, 자문형 관전포인트가 완전히 배제되고 자본시장법 제101조 면책 문구가 탑재되어야 한다", () => {
    expect(post).not.toContain("1번:");
    expect(post).not.toContain("2번:");
    expect(post).not.toContain("댓글에");
    expect(post).not.toContain("다들");
    expect(post).not.toContain("?");
    expect(post).not.toContain("관전 포인트:");
    expect(post).toContain("본 자료는 투자 판단을 돕기 위한 정보 제공용이며");
  });

  it("6. 본문 텍스트 내 괄호 및 유니코드 이모지가 없어야 한다", () => {
    // 괄호 배제 검사
    expect(post).not.toMatch(/\([^)]*\)/);
    // 이모지 배제 검사
    expect(post).not.toMatch(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u);
  });

  it("7. 단일 니치 토픽 태그 #ETF투자가 정의되고 본문 중복이 배제되어야 한다", () => {
    expect(selectThreadsTopicTag()).toBe("#ETF투자");
    // 본문 끝은 출처 공시로 단정하게 마감되고, 토픽 태그는 메타데이터로 분리됨
    expect(post).toContain("* 기준:");
  });
});
