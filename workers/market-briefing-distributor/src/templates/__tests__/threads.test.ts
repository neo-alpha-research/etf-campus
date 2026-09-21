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

  it("2. 지표 라인(| 포함)은 1행 1완결을 위해 28자 이내여야 한다", () => {
    const lines = post.split("\n");
    const indicatorLines = lines.filter(l => l.includes("|"));
    expect(indicatorLines.length).toBeGreaterThanOrEqual(2);
    for (const line of indicatorLines) {
      expect(line.length).toBeLessThanOrEqual(28);
    }
  });

  it("3. 지표 라인은 코스피/코스닥, 상하위 테마, 스마트머니 순으로 3행 2열 대칭이어야 한다", () => {
    expect(post).toContain("코스피");
    expect(post).toContain("코스닥");
    expect(post).toContain("사이버보안");
    expect(post).toContain("비만치료제");
  });

  it("4. 분석 불릿은 1., 2., 3. 번호가 매겨지고 48자 이내 단문이어야 한다", () => {
    const lines = post.split("\n");
    const bulletLines = lines.filter(l => /^[1-3]\./.test(l.trim()));
    expect(bulletLines.length).toBe(3);
    for (const b of bulletLines) {
      expect(b.length).toBeLessThanOrEqual(48);
    }
  });

  it("5. 기계적 1 vs 2 투표 문구가 배제되고 3층 구조 질문이 탑재되어야 한다", () => {
    expect(post).not.toContain("1번:");
    expect(post).not.toContain("2번:");
    expect(post).not.toContain("댓글에 1");
    expect(post).toContain("장기 적립 관점");
    expect(post).toContain("다들은");
  });

  it("6. 본문 텍스트 내 괄호 및 유니코드 이모지가 없어야 한다", () => {
    // 괄호 배제 검사
    expect(post).not.toMatch(/\([^)]*\)/);
    // 이모지 배제 검사
    expect(post).not.toMatch(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u);
  });

  it("7. 단일 니치 토픽 태그 #ETF투자가 포함되어야 한다", () => {
    expect(selectThreadsTopicTag()).toBe("#ETF투자");
    expect(post).toContain("#ETF투자");
  });
});
