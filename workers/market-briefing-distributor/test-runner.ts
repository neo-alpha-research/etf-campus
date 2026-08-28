import { generateInstagramCarousel } from "./src/templates/instagram";
import { generateThreadsThread } from "./src/templates/threads";
import { generateNewsletterHtml } from "./src/templates/newsletter";
import { validateBriefingPayload } from "./src/circuit-breaker";
import type { MarketBriefingPayload } from "./src/types";
import * as fs from "fs";
import * as path from "path";

const samplePayload: MarketBriefingPayload = {
  asOfDate: "2026-08-27",
  publicationVersion: 1,
  headlineText: "대형 지수형 ETF의 견고한 방어력 속에 기관의 2.3조원 규모 실질 진성수급이 유입되었습니다.",
  marketTemperature: "상승 우세",
  kospiClose: 3185.42,
  kospiChangePct: 1.07,
  kosdaqClose: 812.30,
  kosdaqChangePct: 0.85,
  generalEtfCount: 1018,
  upCount: 642,
  flatCount: 88,
  downCount: 288,
  breadthRatioPct: 63.06,
  generalTotalAum: 3851607,
  generalTotalTradeValue: 99147,
  marketTurnoverPct: 2.57,
  top10TradeSharePct: 42.5,
  allTop10TradeSharePct: 56.1,
  generalAumWeightedReturnPct: 1.07,
  top50WeightedReturnPct: 1.25,
  assetClasses: [
    { assetClass: "국내주식", etfCount: 412, upCount: 280, flatCount: 30, downCount: 102, breadthRatioPct: 68.0, aumWeightedReturnPct: 1.45, totalAum: 1850000, aumSharePct: 48.0, totalTradeValue: 48000, tradeSharePct: 48.4, ytdReturnPct: 18.2 },
    { assetClass: "해외주식", etfCount: 320, upCount: 210, flatCount: 25, downCount: 85, breadthRatioPct: 65.6, aumWeightedReturnPct: 1.12, totalAum: 1120000, aumSharePct: 29.1, totalTradeValue: 28000, tradeSharePct: 28.2, ytdReturnPct: 24.5 },
    { assetClass: "채권", etfCount: 145, upCount: 90, flatCount: 20, downCount: 35, breadthRatioPct: 62.1, aumWeightedReturnPct: 0.15, totalAum: 520000, aumSharePct: 13.5, totalTradeValue: 12000, tradeSharePct: 12.1, ytdReturnPct: 4.8 },
    { assetClass: "파생형", etfCount: 68, upCount: 32, flatCount: 5, downCount: 31, breadthRatioPct: 47.1, aumWeightedReturnPct: -0.42, totalAum: 145000, aumSharePct: 3.8, totalTradeValue: 8500, tradeSharePct: 8.6, ytdReturnPct: -8.5 },
    { assetClass: "원자재", etfCount: 35, upCount: 18, flatCount: 4, downCount: 13, breadthRatioPct: 51.4, aumWeightedReturnPct: 0.85, totalAum: 82000, aumSharePct: 2.1, totalTradeValue: 1500, tradeSharePct: 1.5, ytdReturnPct: 11.2 },
    { assetClass: "부동산/리츠", etfCount: 22, upCount: 12, flatCount: 3, downCount: 7, breadthRatioPct: 54.5, aumWeightedReturnPct: 0.35, totalAum: 65000, aumSharePct: 1.7, totalTradeValue: 800, tradeSharePct: 0.8, ytdReturnPct: 6.4 },
    { assetClass: "통화/기타", etfCount: 16, upCount: 0, flatCount: 1, downCount: 15, breadthRatioPct: 0.0, aumWeightedReturnPct: -0.65, totalAum: 69607, aumSharePct: 1.8, totalTradeValue: 347, tradeSharePct: 0.4, ytdReturnPct: -3.2 },
  ],
  focusEtfs: [
    { rankNo: 1, ticker: "069500", etfName: "KODEX 200", assetClass: "국내주식", closeValue: 42500, changePct: 1.25, tradeValue: 15200, tradeSharePct: 15.3 },
    { rankNo: 2, ticker: "102110", etfName: "TIGER 200", assetClass: "국내주식", closeValue: 42600, changePct: 1.22, tradeValue: 9800, tradeSharePct: 9.9 },
    { rankNo: 3, ticker: "133690", etfName: "TIGER 미국나스닥100", assetClass: "해외주식", closeValue: 124500, changePct: 1.65, tradeValue: 8200, tradeSharePct: 8.3 },
  ],
  peerGroups: [
    { assetClass: "국내주식", peerGroup: "반도체 및 소부장", etfCount: 18, cappedAumWeightedReturnPct: 3.42 },
    { assetClass: "해외주식", peerGroup: "미국 빅테크 Top10", etfCount: 12, cappedAumWeightedReturnPct: 2.85 },
    { assetClass: "국내주식", peerGroup: "조선·방산", etfCount: 8, cappedAumWeightedReturnPct: 2.15 },
    { assetClass: "국내주식", peerGroup: "2차전지 소재", etfCount: 15, cappedAumWeightedReturnPct: -2.85 },
    { assetClass: "해외주식", peerGroup: "중국 전기차·태양광", etfCount: 9, cappedAumWeightedReturnPct: -1.95 },
  ],
  periodicFlows: {
    dailyFundFlows: {
      topInflows: [
        { rank: 1, ticker: "069500", name: "KODEX 200", theme: "국내대표지수", inflow: 4250, changePct: 1.25 },
        { rank: 2, ticker: "379800", name: "KODEX 미국S&P500TR", theme: "해외대표지수", inflow: 3120, changePct: 0.95 },
        { rank: 3, ticker: "133690", name: "TIGER 미국나스닥100", theme: "해외빅테크", inflow: 2850, changePct: 1.65 },
        { rank: 4, ticker: "448290", name: "PLUS 고배당주", theme: "국내고배당", inflow: 1950, changePct: 0.45 },
        { rank: 5, ticker: "396500", name: "ACE 미국30년국채액티브", theme: "미국장기채", inflow: 1650, changePct: -0.15 },
      ],
      topOutflows: [],
    },
    weeklyFundFlows: {
      topInflows: [
        { rank: 1, ticker: "069500", name: "KODEX 200", inflow: 18500 },
        { rank: 2, ticker: "379800", name: "KODEX 미국S&P500TR", inflow: 14200 },
        { rank: 3, ticker: "133690", name: "TIGER 미국나스닥100", inflow: 12800 },
        { rank: 4, ticker: "448290", name: "PLUS 고배당주", inflow: 8900 },
        { rank: 5, ticker: "396500", name: "ACE 미국30년국채액티브", inflow: 7600 },
      ],
      topOutflows: [],
    },
  },
};

const baseUrl = "https://etf-campus.pages.dev";

console.log("=== 1. Circuit Breaker Test ===");
const validation = validateBriefingPayload(samplePayload, {
  ETF_PRICES: {} as any,
  BRIEFING_KV: {} as any,
  SITE_BASE_URL: baseUrl,
});
console.log("Circuit Breaker Valid:", validation.isSafe, validation.reasons);

console.log("=== 2. Instagram 6-Slide Carousel Generation ===");
const slides = generateInstagramCarousel(samplePayload, baseUrl);
console.log(`Generated ${slides.length} slides.`);
const outputDir = path.resolve(process.cwd(), "../../scratch/distributor-preview");
fs.mkdirSync(outputDir, { recursive: true });

slides.forEach((s) => {
  fs.writeFileSync(path.join(outputDir, `instagram_slide_${s.slideNumber}.svg`), s.svgContent, "utf-8");
  console.log(`- Slide ${s.slideNumber}: ${s.title} (${s.subtitle}) -> SVG saved (${s.svgContent.length} bytes)`);
});

console.log("=== 3. Threads 4-Post Thread Generation ===");
const threads = generateThreadsThread(samplePayload, baseUrl);
threads.forEach((t) => {
  console.log(`\n--- Post ${t.sequence}/4 ---\n${t.content}`);
});
fs.writeFileSync(path.join(outputDir, "threads_thread.json"), JSON.stringify(threads, null, 2), "utf-8");

console.log("\n=== 4. Newsletter Responsive HTML Generation ===");
const newsletter = generateNewsletterHtml(samplePayload, baseUrl);
console.log(`Subject: ${newsletter.subject}`);
console.log(`HTML Length: ${newsletter.html.length} chars`);
fs.writeFileSync(path.join(outputDir, "newsletter.html"), newsletter.html, "utf-8");

console.log(`\n🎉 All OSMU multi-channel assets successfully generated in: ${outputDir}`);
