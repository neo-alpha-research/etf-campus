import { describe, expect, it } from "vitest";
import { generateInstagramCaption, generateInstagramCarousel } from "../instagram";
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

describe("인스타그램 템플릿 모바일 뷰포트 및 캡션 레이아웃 검증", () => {
  const caption = generateInstagramCaption(mockPayload);

  it("1. 캡션 상단 첫 2행은 '더보기' 접힘 전 75자 골든 존 안에 핵심 결론을 담아야 한다", () => {
    const lines = caption.split("\n");
    const goldenZone = `${lines[0]}\n${lines[1]}`;
    expect(goldenZone.length).toBeLessThanOrEqual(75);
    expect(goldenZone).toContain("2026.09.18");
    expect(goldenZone).toContain("코스피");
  });

  it("2. 지표 블록은 스레드와 동일하게 2열 대칭 파이프 그리드를 유지해야 한다", () => {
    const lines = caption.split("\n");
    const indicatorLines = lines.filter(l => l.includes("|"));
    expect(indicatorLines.length).toBeGreaterThanOrEqual(2);
    for (const l of indicatorLines) {
      expect(l.length).toBeLessThanOrEqual(28);
    }
  });

  it("3. 인스타그램 탐색 및 SEO 유입을 위한 5대 큐레이션 해시태그가 #ETF투자 우선순위로 유지되어야 한다", () => {
    expect(caption).toContain("#ETF투자 #ETF브리핑 #마켓브리핑 #재테크 #ETFCampus");
  });

  it("4. 캡션 본문 텍스트 내 괄호 및 유니코드 이모지가 없어야 한다", () => {
    expect(caption).not.toMatch(/\([^)]*\)/);
    expect(caption).not.toMatch(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u);
  });

  it("5. 카드뉴스 6슬라이드 전체에서 최소 폰트 크기가 18px 이상이어야 한다", () => {
    const slides = generateInstagramCarousel(mockPayload, "https://etf-campus.pages.dev");
    expect(slides.length).toBe(6);
    for (const slide of slides) {
      const fontSizes = [...slide.svgContent.matchAll(/font-size=["']?([0-9.]+)/g)].map(m => parseFloat(m[1]));
      for (const fs of fontSizes) {
        expect(fs).toBeGreaterThanOrEqual(18);
      }
    }
  });
});
