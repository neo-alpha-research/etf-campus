import { describe, expect, it } from "vitest";
import { generateNewsletterHtml } from "../newsletter";
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
      ],
    },
  },
  disparityWarning: [
    {
      ticker: "489570",
      etfName: "TIGER 미국AI데이터센터TOP4Plus",
      disparityPct: 3.67,
      assetClass: "해외주식",
    },
    {
      ticker: "123450",
      etfName: "ACE 미국30년국채엔화노출액티브(H)",
      disparityPct: -2.15,
      assetClass: "채권",
    },
  ],
} as unknown as MarketBriefingPayload;

describe("이메일 뉴스레터 템플릿 모바일 최적화 & 컴플라이언스 무결성", () => {
  const baseUrl = "https://etf-campus.pages.dev";
  const { html, subject, preheader } = generateNewsletterHtml(mockPayload, baseUrl);

  it("1. 제목 및 프리헤더에 괄호 없이 핵심 정보가 담겨야 한다", () => {
    expect(subject).toContain("2026.09.18");
    expect(subject).toContain("사이버보안");
    expect(preheader).toContain("KOSPI +2.66%");
    expect(preheader).toContain("일반 ETF +1.79%");
  });

  it("2. 스마트머니 테이블: table-layout fixed, colgroup, 종목명 강제 줄바꿈 및 순유입액 헤더가 적용되어야 한다", () => {
    // Fixed layout & colgroup
    expect(html).toContain("table-layout: fixed;");
    expect(html).toContain('<col style="width: 32px;">');
    expect(html).toContain('<col style="width: 92px;">');
    // Header text shortened to avoid collapse
    expect(html).toContain(">순유입액</th>");
    // Word break for long compound ETF names
    expect(html).toContain("word-break: break-all; overflow-wrap: anywhere;");
    expect(html).toContain("KODEX 200타겟위클리커버드콜");
    expect(html).toContain("+1,350억원");
  });

  it("3. 괴리율 경보: 카드 컨테이너 내 2-Tier 층위 분리로 배지 이탈을 원천 차단해야 한다", () => {
    // 2-tier stacked layout
    expect(html).toContain("TIGER 미국AI데이터센터TOP4Plus");
    expect(html).toContain("+3.67% 고평가");
    expect(html).toContain("ACE 미국30년국채엔화노출액티브(H)");
    expect(html).toContain("-2.15% 저평가");
    // Disparity card uses separate row for badges so long names don't push them out
    expect(html).toContain("수급 쏠림 주의 ETF · 괴리율 경보");
  });

  it("4. CTA 버튼: 줄바꿈 방지 단문과 이메일 친화적 인라인 버튼 테이블이 적용되어야 한다", () => {
    // Shortened, high-impact CTA text
    expect(html).toContain("마켓 브리핑 풀버전 보기 ↗");
    // Bulletproof inline table button styling
    expect(html).toContain("background-color: #059669; border-radius: 12px;");
  });

  it("5. 공식 표준 풋터 배너: 2줄 스택 테이블 구조로 모바일 단어 끊김이 없어야 한다", () => {
    expect(html).toContain("🔍 DC/IRP · 연금저축 · ISA 계좌별 ETF 비교");
    expect(html).toContain("📊 ETF 캠퍼스");
    expect(html).toContain("etf-campus.pages.dev");
  });

  it("6. 컴플라이언스: 자본시장법 제101조 준수 (추천 단어 0건) 및 공식 As-Of 기준일자가 표기되어야 한다", () => {
    // Strictly ZERO occurrences of '추천'
    expect(html).not.toMatch(/추천/);
    // Statutory As-Of date format
    expect(html).toContain("* 기준: 2026.09.18 한국거래소(KRX) 및 금융투자협회 공시");
    // Statutory disclaimer
    expect(html).toContain("* 본 자료는 투자 판단을 돕기 위한 정보 제공용이며, 특정 종목의 매수·매도를 권유하지 않습니다.");
  });
});
