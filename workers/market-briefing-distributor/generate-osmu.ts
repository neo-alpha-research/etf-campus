import * as dotenv from 'dotenv';
dotenv.config();
import { generateInstagramCarousel, generateInstagramCaption } from "./src/templates/instagram";
import { generateThreadsThread, generateThreadsImageSvg } from "./src/templates/threads";
import { generateNewsletterHtml } from "./src/templates/newsletter";
import { validateBriefingPayload } from "./src/circuit-breaker";
import { classifyMarketRegime } from "./src/services/market-regime";
import { reviewAndRefineWithGemini } from "./src/services/gemini";
import type { MarketBriefingPayload } from "./src/types";
import * as fs from "fs";
import * as path from "path";
import * as puppeteerModule from "puppeteer";

const payload20260904: MarketBriefingPayload = {
  asOfDate: "2026-09-04",
  publicationVersion: 1,
  headlineText: "국내 상장 일반 ETF 1,025개 중 794개가 상승하며 견조한 반등세를 시현했습니다. 코스피 +1.64% 상승과 함께 일반 ETF 시장 가중수익률은 +1.33%를 기록했으며, 피지컬 AI & 로봇 +6.06% 테마의 기술적 반등과 스마트머니 +853억원의 종합채권 순유입이 시장을 견인했습니다.",
  marketTemperature: "상승 우세",
  kospiClose: 2600.00,
  kospiChangePct: 1.64,
  kosdaqClose: 813.50,
  kosdaqChangePct: 2.95,
  generalEtfCount: 1025,
  upCount: 794,
  flatCount: 50,
  downCount: 181,
  breadthRatioPct: 77.46,
  generalTotalAum: 3895000,
  generalTotalTradeValue: 115200,
  marketTurnoverPct: 2.96,
  top10TradeSharePct: 62.40,
  allTop10TradeSharePct: 55.80,
  generalAumWeightedReturnPct: 1.33,
  top50WeightedReturnPct: 1.45,
  pulse: {
    asOfDate: "2026-09-04",
    generalEtfCount: 1025,
    generalTotalAum: 3895000,
    generalTotalTradeValue: 115200,
    generalAumWeightedReturnPct: 1.33,
    top50WeightedReturnPct: 1.45,
    upCount: 794,
    flatCount: 50,
    downCount: 181,
    breadthRatioPct: 77.46,
    marketTemperature: "상승 우세",
  },
  assetClasses: [
    { assetClass: "국내주식", etfCount: 420, upCount: 345, flatCount: 20, downCount: 55, breadthRatioPct: 82.1, aumWeightedReturnPct: 1.85, totalAum: 1850000, aumSharePct: 47.5, totalTradeValue: 52000, tradeSharePct: 45.1, ytdReturnPct: 17.5 },
    { assetClass: "해외주식", etfCount: 325, upCount: 230, flatCount: 15, downCount: 80, breadthRatioPct: 70.8, aumWeightedReturnPct: 0.95, totalAum: 1320000, aumSharePct: 33.9, totalTradeValue: 31000, tradeSharePct: 26.9, ytdReturnPct: 23.1 },
    { assetClass: "채권", etfCount: 150, upCount: 110, flatCount: 12, downCount: 28, breadthRatioPct: 73.3, aumWeightedReturnPct: 0.12, totalAum: 550000, aumSharePct: 14.1, totalTradeValue: 14000, tradeSharePct: 12.2, ytdReturnPct: 4.3 },
    { assetClass: "원자재", etfCount: 35, upCount: 15, flatCount: 3, downCount: 17, breadthRatioPct: 42.9, aumWeightedReturnPct: -0.42, totalAum: 75000, aumSharePct: 1.9, totalTradeValue: 1600, tradeSharePct: 1.4, ytdReturnPct: 13.8 },
    { assetClass: "혼합·자산배분", etfCount: 28, upCount: 20, flatCount: 2, downCount: 6, breadthRatioPct: 71.4, aumWeightedReturnPct: 0.55, totalAum: 32000, aumSharePct: 0.8, totalTradeValue: 500, tradeSharePct: 0.4, ytdReturnPct: 5.4 },
    { assetClass: "부동산/리츠", etfCount: 22, upCount: 14, flatCount: 3, downCount: 5, breadthRatioPct: 63.6, aumWeightedReturnPct: 0.35, totalAum: 68000, aumSharePct: 1.7, totalTradeValue: 650, tradeSharePct: 0.6, ytdReturnPct: 3.8 },
  ],
  focusEtfs: [
    { rankNo: 1, ticker: "069500", etfName: "KODEX 200", assetClass: "국내주식", closeValue: 42850, changePct: 1.65, tradeValue: 15400, tradeSharePct: 13.4 },
    { rankNo: 2, ticker: "091160", etfName: "KODEX 반도체", assetClass: "국내주식", closeValue: 35880, changePct: 4.01, tradeValue: 14200, tradeSharePct: 12.3 },
    { rankNo: 3, ticker: "442580", etfName: "PLUS 피지컬AI로봇", assetClass: "국내주식", closeValue: 12450, changePct: 6.06, tradeValue: 8900, tradeSharePct: 7.7 },
  ],
  peerGroups: [
    { assetClass: "국내주식", peerGroup: "피지컬 AI & 지능형 로봇", etfCount: 6, cappedAumWeightedReturnPct: 6.06 },
    { assetClass: "국내주식", peerGroup: "전통 반도체 소부장", etfCount: 18, cappedAumWeightedReturnPct: 4.01 },
    { assetClass: "국내주식", peerGroup: "조선 & 해운", etfCount: 8, cappedAumWeightedReturnPct: 2.85 },
    { assetClass: "해외주식", peerGroup: "미국 빅테크", etfCount: 15, cappedAumWeightedReturnPct: 1.25 },
    { assetClass: "해외주식", peerGroup: "글로벌 럭셔리 & 소비재", etfCount: 7, cappedAumWeightedReturnPct: -0.71 },
    { assetClass: "국내주식", peerGroup: "K-푸드 & K-뷰티", etfCount: 12, cappedAumWeightedReturnPct: -1.41 },
  ],
  disparityWarning: [],
  periodicFlows: {
    dailyFundFlows: {
      topInflows: [
        { rank: 1, ticker: "153130", name: "KODEX 종합채권(AA-이상)액티브", theme: "채권액티브", inflow: 853, changePct: 0.08 },
        { rank: 2, ticker: "446720", name: "TIGER 은행고배당플러스TOP10", theme: "고배당", inflow: 342, changePct: 0.95 },
        { rank: 3, ticker: "069500", name: "KODEX 200", theme: "국내대표지수", inflow: 295, changePct: 1.65 },
        { rank: 4, ticker: "379800", name: "KODEX 미국S&P500TR", theme: "해외대표지수", inflow: 260, changePct: 0.42 },
        { rank: 5, ticker: "091160", name: "KODEX 반도체", theme: "국내반도체", inflow: 210, changePct: 4.01 },
      ],
      topOutflows: [
        { rank: 1, ticker: "252670", name: "KODEX 200선물인버스2X", theme: "파생인버스", inflow: -620, changePct: -3.25 },
      ],
    },
    weeklyFundFlows: {
      topInflows: [
        { rank: 1, ticker: "153130", name: "KODEX 종합채권(AA-이상)액티브", inflow: 18500 },
        { rank: 2, ticker: "069500", name: "KODEX 200", inflow: 14200 },
        { rank: 3, ticker: "379800", name: "KODEX 미국S&P500TR", inflow: 12800 },
      ],
      topOutflows: [],
    },
  },
};

const baseUrl = "https://etf-campus.pages.dev";

async function fetchLatestPayload(): Promise<MarketBriefingPayload> {
  try {
    const res = await fetch(`${baseUrl}/api/briefings/latest?_t=${Date.now()}`, {
      headers: {
        "User-Agent": "ETF-Campus-Distributor/1.0",
        "Cache-Control": "no-cache"
      }
    });
    if (res.ok) {
      const data: any = await res.json();
      const raw = data.briefing || data;
      const pulse = raw.pulse || {};
      const kospi = raw.marketIndices?.find((i: any) => i.code === "KOSPI");
      const kosdaq = raw.marketIndices?.find((i: any) => i.code === "KOSDAQ");

      console.log(`[Test-Runner] Successfully fetched LIVE briefing payload for ${raw.asOfDate}!`);
      return {
        ...raw,
        pulse: {
          ...pulse,
          generalAumWeightedReturnPct: pulse.generalAumWeightedReturnPct ?? raw.generalAumWeightedReturnPct ?? raw.general_aum_weighted_return_pct ?? 0,
        },
        asOfDate: raw.asOfDate || "2026-09-04",
        headlineText: raw.headline?.text || raw.headlineText || "",
        marketTemperature: pulse.marketTemperature || raw.marketTemperature || "혼조",
        kospiClose: kospi?.close ?? raw.kospiClose ?? 0,
        kospiChangePct: kospi?.change_pct ?? raw.kospiChangePct ?? 0,
        kosdaqClose: kosdaq?.close ?? raw.kosdaqClose ?? 0,
        kosdaqChangePct: kosdaq?.change_pct ?? raw.kosdaqChangePct ?? 0,
        generalEtfCount: pulse.generalEtfCount ?? raw.generalEtfCount ?? 0,
        generalTotalAum: pulse.generalTotalAum ?? raw.generalTotalAum ?? 0,
        generalTotalTradeValue: pulse.generalTotalTradeValue ?? raw.generalTotalTradeValue ?? 0,
        generalAumWeightedReturnPct: pulse.generalAumWeightedReturnPct ?? raw.generalAumWeightedReturnPct ?? raw.general_aum_weighted_return_pct ?? 0,
        upCount: pulse.upCount ?? raw.upCount ?? 0,
        flatCount: pulse.flatCount ?? raw.flatCount ?? 0,
        downCount: pulse.downCount ?? raw.downCount ?? 0,
        breadthRatioPct: pulse.breadthRatioPct ?? raw.breadthRatioPct ?? 0,
        top10TradeSharePct: pulse.top10TradeSharePct ?? raw.top10TradeSharePct ?? 0,
        allTop10TradeSharePct: pulse.allTop10TradeSharePct ?? raw.allTop10TradeSharePct ?? 0,
        assetClasses: (raw.assetClasses || []).map((a: any) => ({
          assetClass: a.assetClass || a.asset_class,
          etfCount: a.etfCount || a.etf_count || 0,
          upCount: a.upCount || a.up_count || 0,
          flatCount: a.flatCount || a.flat_count || 0,
          downCount: a.downCount || a.down_count || 0,
          breadthRatioPct: a.breadthRatioPct ?? a.breadth_ratio_pct ?? 0,
          aumWeightedReturnPct: a.aumWeightedReturnPct ?? a.aum_weighted_return_pct ?? 0,
          totalAum: a.totalAum || a.total_aum || 0,
          aumSharePct: a.aumSharePct ?? a.aum_share_pct ?? 0,
          totalTradeValue: a.totalTradeValue || a.total_trade_value || 0,
          tradeSharePct: a.tradeSharePct ?? a.trade_share_pct ?? 0,
          ytdReturnPct: a.ytdReturnPct || 0,
        })),
        focusEtfs: raw.focusEtfs || [],
        peerGroups: raw.peerGroups || [],
        disparityWarning: raw.disparityWarning || [],
        periodicFlows: raw.periodicFlows || (raw.fundFlow?.general ? {
          dailyFundFlows: {
            topInflows: (raw.fundFlow.general.topInflows || []).map((f: any, idx: number) => ({
              rank: idx + 1,
              ticker: f.ticker,
              name: f.etfName,
              theme: f.theme || "핵심ETF",
              inflow: Math.round(f.netInflowValue / 100000000),
              changePct: 0
            })),
            topOutflows: (raw.fundFlow.general.topOutflows || []).map((f: any, idx: number) => ({
              rank: idx + 1,
              ticker: f.ticker,
              name: f.etfName,
              theme: f.theme || "핵심ETF",
              inflow: Math.round(f.netInflowValue / 100000000),
              changePct: 0
            }))
          }
        } : undefined),
      };
    }
  } catch (e) {
    console.warn("[Test-Runner] Live fetch failed, using canonical master payload:", e);
  }
  return payload20260904;
}

async function run() {
  const currentPayload = await fetchLatestPayload();
  const dateStr = currentPayload.asOfDate || "YYYY-MM-DD";

  console.log(`\n=== 1. Circuit Breaker Validation (${dateStr}) ===`);
  const validation = await validateBriefingPayload(currentPayload, {
    ETF_PRICES: {} as any,
    BRIEFING_KV: {} as any,
    SITE_BASE_URL: baseUrl,
  });
  console.log("Circuit Breaker Valid:", validation.isSafe, validation.reasons);

  console.log(`\n=== 1.5. Gemini 7-Token Pool & 3.8 Waterfall AI Review ===`);
  const baseRegime = classifyMarketRegime(currentPayload);
  const narrative = await reviewAndRefineWithGemini(currentPayload, baseRegime, {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY
  } as any);
  console.log(`AI Review Status: [${narrative.source}] (Model: ${narrative.modelUsed || "default"}, Token: #${narrative.tokenIndex || 1})`);
  const slides = generateInstagramCarousel(currentPayload, baseUrl, narrative);
  console.log(`\n=== 2. Instagram ${slides.length}-Slide Generation ===`);
  console.log(`Generated ${slides.length} slides.`);
  
  // Destination: Root OSMU Archive
  const shouldSaveLocal = process.env.SAVE_LOCAL_ARCHIVE !== "false";

  const baseArchiveDir = path.resolve(process.cwd(), "..", "..", "OSMU_Archive");
  const rootArchiveDir = path.join(baseArchiveDir, dateStr);
  const rootInstaDir = path.join(rootArchiveDir, "1_Instagram");
  const rootThreadsDir = path.join(rootArchiveDir, "2_Threads");
  const rootEmailDir = path.join(rootArchiveDir, "3_Email");

  if (shouldSaveLocal) {
    [rootInstaDir, rootThreadsDir, rootEmailDir].forEach(d => fs.mkdirSync(d, { recursive: true }));
    // Clean up any stale slide files outside the current set
    const validSlideNumbers = new Set(slides.map(s => s.slideNumber));
    if (fs.existsSync(rootInstaDir)) {
      const existingFiles = fs.readdirSync(rootInstaDir);
      for (const file of existingFiles) {
        const match = file.match(/^instagram_slide_(\d+)\.(png|svg)$/);
        if (match && !validSlideNumbers.has(parseInt(match[1], 10))) {
          fs.unlinkSync(path.join(rootInstaDir, file));
          console.log(`- Removed stale slide file: ${file}`);
        }
      }
    }
  } else {
    console.log(`\n[OSMU Engine] Pure Cloud Mode active: Local OSMU_Archive disk write skipped (assets reviewed via Web Dashboard). Set SAVE_LOCAL_ARCHIVE=true to force local files.`);
  }

  // Puppeteer Browser Launch for high-fidelity PNG rendering across all channels
  const puppeteer = puppeteerModule.default || puppeteerModule;
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--hide-scrollbars'
    ]
  });
  const renderPage = await browser.newPage();

  async function convertSvgToPng(svg: string, outPng: string, w = 1080, h = 1350) {
    await renderPage.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await renderPage.setContent(`<!DOCTYPE html><html><head><style>html,body{margin:0;padding:0;background:transparent;overflow:hidden;width:${w}px;height:${h}px;}</style></head><body>${svg}</body></html>`, { waitUntil: 'domcontentloaded' });
    const el = await renderPage.$('svg') || await renderPage.$('body');
    if (el) {
      await el.screenshot({ path: outPng, omitBackground: false });
    }
  }

  // Render & Save Slides
  for (const s of slides) {
    const safeSvg = s.svgContent.replace(/&(?!(amp|lt|gt|quot|apos);)/g, "&amp;");
    
    if (shouldSaveLocal) {
      // Save to OSMU Archive
      const rootSvgPath = path.join(rootInstaDir, `instagram_slide_${s.slideNumber}.svg`);
      const rootPngPath = path.join(rootInstaDir, `instagram_slide_${s.slideNumber}.png`);
      fs.writeFileSync(rootSvgPath, safeSvg, "utf-8");
      await convertSvgToPng(safeSvg, rootPngPath, 1080, 1350);
      console.log(`- Slide ${s.slideNumber}: [${s.title}] ${s.subtitle} -> Rendered PNG & SVG`);
    }
  }

  // Instagram Caption
  const caption = generateInstagramCaption(currentPayload, narrative).replace(/\r?\n/g, "\r\n");
  const captionBuf = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(caption, "utf-8")]);
  if (shouldSaveLocal) {
    fs.writeFileSync(path.join(rootInstaDir, "instagram_caption.txt"), captionBuf);
    console.log("- Instagram Caption -> Saved");
  }

  // Threads Content & Image
  console.log("\n=== 3. Threads Generation ===");
  const threads = generateThreadsThread(currentPayload, baseUrl, narrative);
  let threadsText = "";
  threads.forEach((t) => {
    if (threads.length > 1) {
      const label = t.sequence === 1 ? "Main Post" : `Post #${t.sequence}`;
      threadsText += `--- ${label} ---\n${t.content}\n\n`;
    } else {
      threadsText += `${t.content}\n\n`;
    }
  });
  const threadsBuf = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(threadsText.replace(/\r?\n/g, "\r\n"), "utf-8")]);

  const threadsSvgContent = generateThreadsImageSvg(currentPayload);
  const safeThreadsSvg = threadsSvgContent.replace(/&(?!(amp|lt|gt|quot|apos);)/g, "&amp;");
  
  if (shouldSaveLocal) {
    fs.writeFileSync(path.join(rootThreadsDir, "threads_script.txt"), threadsBuf);
    const rootThreadsSvg = path.join(rootThreadsDir, "threads_image.svg");
    const rootThreadsPng = path.join(rootThreadsDir, "threads_image.png");
    fs.writeFileSync(rootThreadsSvg, safeThreadsSvg, "utf-8");
    await convertSvgToPng(safeThreadsSvg, rootThreadsPng, 1080, 1350);
    console.log("- Threads Image -> Rendered PNG & SVG");
  }

  // Newsletter
  console.log("\n=== 4. Newsletter HTML Generation ===");
  const newsletter = generateNewsletterHtml(currentPayload, baseUrl, narrative);
  const newsBuf = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(newsletter.html, "utf-8")]);

  if (shouldSaveLocal) {
    fs.writeFileSync(path.join(rootEmailDir, "email_body.html"), newsBuf);
    fs.writeFileSync(path.join(rootEmailDir, "newsletter.html"), newsBuf);
  }

  console.log("\n=== 5. Email Puppeteer High-Res Capture (Actual Webpage) ===");
  console.log("Capturing actual Market Briefing webpage snapshot...");
  console.log(`Navigating to: ${baseUrl}/briefing`);
  const emailPngPath = path.join(rootEmailDir, "email_snapshot.png");

  let imageMapAreas: { left: number, top: number, width: number, height: number, ticker: string }[] = [];

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 720, height: 900, deviceScaleFactor: 2 });
    await page.goto(`${baseUrl}/briefing`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await new Promise((r) => setTimeout(r, 2000));

    await page.evaluate(() => {
      document.querySelectorAll('#site-fixed-header, header, nav, footer, [class*="ticker"], [class*="fixed"], [class*="sticky"]').forEach(el => el.remove());

      document.querySelectorAll('h1').forEach(h1 => {
        const parentSection = h1.closest('section') || h1.closest('header') || h1.parentElement;
        if (parentSection && parentSection.tagName !== 'MAIN') parentSection.remove();
      });

      document.querySelectorAll('details').forEach(el => el.remove());

      const historySection = document.getElementById('briefing-history-section');
      if (historySection) historySection.remove();

      // Remove STEP 5, STEP 6, STEP 7 sections
      document.querySelectorAll('#step-trend, #step-scale, #step-growth').forEach(el => {
        const sec = el.closest('section') || el;
        sec.remove();
      });

      document.querySelectorAll('p, span, h2, h3').forEach(el => {
        const t = el.textContent || '';
        if (t.includes('STEP 5.') || t.includes('STEP 6.') || t.includes('STEP 7.') || t.includes('TREND & FLOW') || t.includes('MARKET STRUCTURE SNAPSHOT') || t.includes('MARKET GROWTH')) {
          const sec = el.closest('section');
          if (sec && sec.tagName === 'SECTION') {
            sec.remove();
          }
        }
      });

      document.body.style.padding = '0';
      document.body.style.margin = '0';
      const main = document.querySelector('main');
      if (main) {
        main.style.padding = '0';
        main.style.margin = '0';
        main.style.minHeight = 'auto';
      }
    });

    await new Promise((r) => setTimeout(r, 1000));

    // Extract bounding boxes for Image Map
    imageMapAreas = await page.evaluate(() => {
      const areas: { left: number, top: number, width: number, height: number, ticker: string }[] = [];
      const main = document.querySelector('main');
      const mainRect = main ? main.getBoundingClientRect() : { top: 0, left: 0 };
      
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      let n;
      while (n = walk.nextNode()) {
        const text = n.nodeValue?.trim();
        if (text) {
          const match = text.match(/\b(\d{6})\b/);
          if (match) {
            const el = n.parentElement;
            if (el) {
              const rect = el.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                // Calculate position relative to the main screenshot element
                areas.push({ 
                  left: Math.round(rect.left - mainRect.left), 
                  top: Math.round(rect.top - mainRect.top), 
                  width: Math.round(rect.width), 
                  height: Math.round(rect.height), 
                  ticker: match[1] 
                });
              }
            }
          }
        }
      }
      return areas;
    });

    const mainElement = (await page.$('main')) || page;
    await page.evaluate(() => {
      const header = document.getElementById('site-fixed-header');
      if (header) header.style.display = 'none';
    });
    await mainElement.screenshot({ path: emailPngPath });
    await browser.close();
    console.log(`Tight Webpage snapshot saved to: ${emailPngPath}`);
    console.log(`Extracted ${imageMapAreas.length} clickable ETF areas for Interactive Email.`);
  } catch(e) {
    console.error("Puppeteer capture failed:", e);
  }

  // Pre-header for Accessibility
  const topInflowName = currentPayload.periodicFlows?.dailyFundFlows?.topInflows?.[0]?.name || "KODEX 종합채권(AA-이상)액티브";
  const preHeaderText = `${currentPayload.asOfDate} 시장 브리핑 - KOSPI ${currentPayload.kospiChangePct}% / 오늘 실질 자금 유입 TOP 1위는? ${topInflowName} 등 주요 ETF 실시간 성과 확인하기`;

  // Generate Image Map HTML
  let mapHtml = '<map name="etf-map">\n';
  (imageMapAreas || []).forEach(area => {
    // Make the clickable area slightly larger (+10px padding)
    const x1 = Math.max(0, area.left - 10);
    const y1 = Math.max(0, area.top - 10);
    const x2 = area.left + area.width + 10;
    const y2 = area.top + area.height + 10;
    mapHtml += `  <area shape="rect" coords="${x1},${y1},${x2},${y2}" href="${baseUrl}/etf/${area.ticker}" alt="ETF ${area.ticker}" title="ETF 상세 보기: ${area.ticker}">\n`;
  });
  mapHtml += '</map>';

  console.log("\n=== 6. Send QA Email via Nodemailer ===");
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const nodemailer = (await import("nodemailer")).default;
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      });
      const mailOptions = {
        from: `"ETF Campus" <${process.env.SMTP_USER}>`,
        to: "neo.alpharesearch@gmail.com",
        subject: newsletter.subject,
        html: newsletter.html,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`Email sent successfully: <${info.messageId}>`);
    } catch(e) {
      console.error("Nodemailer sending failed:", e);
    }
  } else {
    console.log("No SMTP credentials found. Skipping Nodemailer.");
  }

  console.log("\n=== 7. Threads Publishing via Worker Gateway ===");
  if (process.env.OSMU_PUBLISH_THREADS !== "true") {
    console.log("OSMU_PUBLISH_THREADS is not 'true'. Skipping Threads publishing (opt-in required).");
  } else {
    const workerBaseUrl = process.env.WORKER_BASE_URL || "https://market-briefing-distributor.neo-alpha-research.workers.dev";
    const authToken = process.env.MANUAL_RUN_TOKEN;
    if (!authToken) {
      console.warn("[SECURITY] MANUAL_RUN_TOKEN missing. Skipping Threads publishing via Worker.");
    } else {
      try {
        console.log(`Delegating Threads publishing to Worker Gateway for date ${dateStr}...`);
        const workerPubUrl = `${workerBaseUrl}/api/publish/threads?date=${encodeURIComponent(dateStr)}`;
        const pubRes = await fetch(workerPubUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${authToken}`,
          },
        });
        const pubData: any = await pubRes.json();
        if (pubData.success) {
          console.log(`Threads published successfully via Worker Gateway: ID ${pubData.publishedPostId}`);
        } else {
          console.error(`Threads publishing rejected by Worker Gateway:`, pubData);
        }
      } catch (tErr) {
        console.error("Threads publishing via Worker Gateway failed:", tErr);
      }
    }
  }

  // Generate Integrated Preview Dashboard HTML
  const slidesJson = JSON.stringify(slides.map(s => ({
    slideNumber: s.slideNumber,
    title: s.title,
    subtitle: s.subtitle,
    svgContent: s.svgContent,
  })));

  const threadsJson = JSON.stringify(threads);

  const previewDashboardHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ETF Campus - OSMU Multi-Channel Local Preview (${dateStr})</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css">
  <style>
    * { font-family: 'Pretendard', sans-serif; }
    .slide-svg svg { width: 100%; height: auto; display: block; border-radius: 1.25rem; }
  </style>
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen p-4 md:p-8">
  <div class="max-w-7xl mx-auto space-y-8">
    <header class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-950 px-3 py-1 text-xs font-bold text-emerald-400 border border-emerald-800">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            LOCAL FAST PREVIEW
          </span>
          <span class="text-sm font-semibold text-slate-400">${dateStr} 장마감 기준</span>
        </div>
        <h1 class="text-2xl md:text-3xl font-extrabold text-white">
          ETF Campus OSMU 자동 배포 통합 프리뷰 대시보드
        </h1>
      </div>
      <div>
        <button onclick="window.location.reload()" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold border border-slate-700 transition">
          새로고침
        </button>
      </div>
    </header>

    <!-- 3-Channel Tabs -->
    <div class="flex border-b border-slate-800 gap-2" id="channelTabs">
      <button onclick="switchTab('instagram')" id="tab-instagram" class="px-6 py-3 font-bold text-sm border-b-2 border-emerald-500 text-emerald-400 flex items-center gap-2">
        인스타그램 ${slides.length}-Slide 카드뉴스 &amp; 캡션
      </button>
      <button onclick="switchTab('threads')" id="tab-threads" class="px-6 py-3 font-bold text-sm border-b-2 border-transparent text-slate-400 hover:text-slate-200 flex items-center gap-2">
        Threads 모닝 브리핑 &amp; 이미지
      </button>
      <button onclick="switchTab('newsletter')" id="tab-newsletter" class="px-6 py-3 font-bold text-sm border-b-2 border-transparent text-slate-400 hover:text-slate-200 flex items-center gap-2">
        이메일 뉴스레터
      </button>
    </div>

    <!-- TAB 1: Instagram Carousel -->
    <section id="panel-instagram" class="space-y-6">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div class="lg:col-span-7 bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-2xl flex flex-col items-center">
          <div class="flex items-center justify-between w-full mb-3 text-xs text-slate-400 font-bold px-2">
            <span id="activeSlideTitle">Slide 1 / ${slides.length}</span>
            <div class="flex gap-2">
              <button onclick="prevSlide()" class="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-white font-bold">◀ 이전</button>
              <button onclick="nextSlide()" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white font-bold">다음 ▶</button>
            </div>
          </div>
          <div id="focusedSlideContainer" class="w-full max-w-[500px] slide-svg shadow-2xl rounded-2xl overflow-hidden border border-slate-700/50"></div>
        </div>

        <div class="lg:col-span-5 space-y-4">
          <div class="bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-3">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-bold text-slate-300">인스타그램 캡션</h3>
              <a href="./1_Instagram/instagram_caption.txt" download class="text-xs text-emerald-400 font-bold hover:underline">다운로드</a>
            </div>
            <div class="text-xs leading-relaxed text-slate-300 bg-slate-900 p-4 rounded-2xl max-h-[300px] overflow-y-auto whitespace-pre-wrap">${caption}</div>
          </div>
          <div class="bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-3">
            <h3 class="text-sm font-bold text-slate-300">${slides.length}개 슬라이드 썸네일</h3>
            <div id="thumbnailsContainer" class="grid grid-cols-3 gap-2"></div>
          </div>
        </div>
      </div>
    </section>

    <!-- TAB 2: Threads -->
    <section id="panel-threads" class="hidden space-y-6">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div class="lg:col-span-7 space-y-4" id="threadsContainer"></div>
        <div class="lg:col-span-5 bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-2xl flex flex-col items-center">
          <div class="flex items-center justify-between w-full mb-4">
            <h3 class="text-sm font-bold text-slate-300">스레드 단일 첨부 이미지 (1080×1350)</h3>
            <a href="./2_Threads/threads_image.png" target="_blank" download="threads_image.png" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow">
              <span>PNG 다운로드</span>
            </a>
          </div>
          <div class="max-w-[420px] rounded-2xl overflow-hidden shadow-2xl border border-slate-700 w-full bg-slate-900">
            <img src="./2_Threads/threads_image.png" class="w-full h-auto rounded-2xl block" alt="스레드 모닝 브리핑 카드" onerror="this.onerror=null; this.src='./2_Threads/threads_image.svg';" />
          </div>
        </div>
      </div>
    </section>

    <!-- TAB 3: Newsletter HTML -->
    <section id="panel-newsletter" class="hidden space-y-6">
      <div class="bg-slate-800 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <span class="text-xs text-slate-400">이메일 제목:</span>
          <span class="font-bold text-white text-sm ml-2">${newsletter.subject}</span>
        </div>
        <div class="flex items-center gap-2">
          <a href="./3_Email/newsletter.html" target="_blank" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow">
            <span>새 창에서 이메일 전체보기</span>
          </a>
        </div>
      </div>

      <div class="bg-[#0F172A] rounded-2xl overflow-hidden shadow-2xl p-6 border border-slate-700 flex flex-col items-center">
        <div class="max-w-[680px] w-full bg-slate-900 p-3 rounded-2xl border border-slate-800">
          <div class="flex items-center justify-between px-3 py-2 text-xs text-slate-400 border-b border-slate-800 mb-3">
            <span class="font-bold text-slate-300">반응형 HTML 뉴스레터 라이브 뷰 (620px 이메일 표준 규격)</span>
            <span class="text-[11px] bg-slate-800 px-2 py-0.5 rounded text-emerald-400 font-bold">100% 팩트 정합성 검증</span>
          </div>
          <iframe src="./3_Email/newsletter.html" class="w-full h-[1180px] rounded-xl border border-slate-700 bg-white" title="뉴스레터 미리보기"></iframe>
        </div>
      </div>
    </section>
  </div>

  <script>
    const slides = ${slidesJson};
    const threads = ${threadsJson};
    let currentIdx = 0;

    function renderSlides() {
      const s = slides[currentIdx];
      document.getElementById('activeSlideTitle').innerText = 'Slide ' + s.slideNumber + ' / ' + slides.length + ' : ' + s.title;
      document.getElementById('focusedSlideContainer').innerHTML = s.svgContent;

      const thumbContainer = document.getElementById('thumbnailsContainer');
      thumbContainer.innerHTML = slides.map((item, idx) => \`
        <div onclick="setSlide(\${idx})" class="cursor-pointer bg-slate-950 p-1.5 rounded-xl border \${idx === currentIdx ? 'border-emerald-500 ring-2 ring-emerald-500/30' : 'border-slate-800'} transition">
          <div class="rounded-lg overflow-hidden slide-svg pointer-events-none">
            \${item.svgContent}
          </div>
        </div>
      \`).join('');
    }

    function setSlide(idx) {
      currentIdx = idx;
      localStorage.setItem('osmu_active_slide', idx);
      renderSlides();
    }

    function prevSlide() {
      currentIdx = (currentIdx - 1 + slides.length) % slides.length;
      localStorage.setItem('osmu_active_slide', currentIdx);
      renderSlides();
    }

    function nextSlide() {
      currentIdx = (currentIdx + 1) % slides.length;
      localStorage.setItem('osmu_active_slide', currentIdx);
      renderSlides();
    }

    function renderThreads() {
      const c = document.getElementById('threadsContainer');
      c.innerHTML = threads.map(t => {
        return '<div class="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-3">' +
          '<div class="flex items-center gap-2 border-b border-slate-800/80 pb-3">' +
            '<span class="font-bold text-sm text-emerald-400">Post ' + t.sequence + '</span>' +
          '</div>' +
          '<div class="text-sm leading-relaxed text-slate-200 whitespace-pre-wrap">' + t.content + '</div>' +
        '</div>';
      }).join('');
    }

    function switchTab(tab) {
      ['instagram', 'threads', 'newsletter'].forEach(t => {
        const btn = document.getElementById('tab-' + t);
        const p = document.getElementById('panel-' + t);
        if (t === tab) {
          btn.className = 'px-6 py-3 font-bold text-sm border-b-2 border-emerald-500 text-emerald-400 flex items-center gap-2';
          p.classList.remove('hidden');
        } else {
          btn.className = 'px-6 py-3 font-bold text-sm border-b-2 border-transparent text-slate-400 hover:text-slate-200 flex items-center gap-2';
          p.classList.add('hidden');
        }
      });
      localStorage.setItem('osmu_active_tab', tab);
      if (history.replaceState) {
        history.replaceState(null, '', '#' + tab);
      } else {
        location.hash = tab;
      }
    }

    // Restore saved slide index
    const savedSlide = parseInt(localStorage.getItem('osmu_active_slide') || '0', 10);
    if (!isNaN(savedSlide) && savedSlide >= 0 && savedSlide < slides.length) {
      currentIdx = savedSlide;
    }

    renderSlides();
    renderThreads();

    // Restore saved tab from hash or localStorage
    const hashTab = location.hash ? location.hash.replace('#', '') : null;
    const savedTab = hashTab || localStorage.getItem('osmu_active_tab') || 'instagram';
    switchTab(savedTab);
  </script>
</body>
</html>`;

  if (shouldSaveLocal && fs.existsSync(baseArchiveDir)) {
    const dashboardBuf = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(previewDashboardHtml, "utf-8")]);
    fs.writeFileSync(path.join(rootArchiveDir, "index.html"), dashboardBuf);

    // === 7. Generate Root Master Hub (OSMU_Archive/index.html) ===
    const allDateDirs = fs.readdirSync(baseArchiveDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d.name))
      .map(d => d.name)
      .sort()
      .reverse();

    const masterHubHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ETF CAMPUS · OSMU 배포 아카이브 마스터 허브</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" as="style" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
  <style>
    body { font-family: "Pretendard", -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif; }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col">
  <!-- Master Navigation Header -->
  <header class="bg-slate-900/95 backdrop-blur border-b border-slate-800 sticky top-0 z-50 px-6 py-3 flex flex-wrap items-center justify-between gap-4">
    <div class="flex items-center gap-3">
      <span class="text-xl font-black text-emerald-400">ETF</span>
      <div>
        <h1 class="text-base font-black text-white flex items-center gap-2">
          <span>ETF CAMPUS</span>
          <span class="text-[11px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-2.5 py-0.5 rounded-full font-extrabold tracking-wide">OSMU Master Hub</span>
        </h1>
        <p class="text-xs text-slate-400">인스타그램 · 스레드 · 뉴스레터 3대 채널 배포 콘텐츠 통합 뷰어</p>
      </div>
    </div>

    <!-- Date Selection & Direct Actions -->
    <div class="flex items-center gap-3">
      <span class="text-xs text-slate-400 font-bold">분석 기준일:</span>
      <select id="dateSelect" onchange="changeDate(this.value)" class="bg-slate-800 text-emerald-400 border border-slate-700 text-xs font-black rounded-xl px-3.5 py-2 outline-none cursor-pointer hover:border-emerald-500 transition">
        ${allDateDirs.map(d => `<option value="${d}" ${d === dateStr ? 'selected' : ''}>${d} ${d === allDateDirs[0] ? '(최신)' : ''}</option>`).join('')}
      </select>
      <a id="directDayLink" href="./${dateStr}/index.html" target="_blank" class="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1 border border-slate-700">
        <span>단독 창 열기</span>
      </a>
    </div>
  </header>

  <!-- Embedded Day Dashboard Iframe -->
  <main class="flex-1 w-full bg-slate-950">
    <iframe id="dayDashboardFrame" src="./${dateStr}/index.html" class="w-full h-[calc(100vh-62px)] border-0" title="Daily OSMU Dashboard"></iframe>
  </main>

  <script>
    function changeDate(d) {
      document.getElementById('dayDashboardFrame').src = './' + d + '/index.html' + location.hash;
      document.getElementById('directDayLink').href = './' + d + '/index.html';
      localStorage.setItem('osmu_master_selected_date', d);
    }

    const savedDate = localStorage.getItem('osmu_master_selected_date');
    if (savedDate && document.querySelector('#dateSelect option[value="' + savedDate + '"]')) {
      document.getElementById('dateSelect').value = savedDate;
      changeDate(savedDate);
    }
  </script>
</body>
</html>`;

    const masterHubBuf = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(masterHubHtml, "utf-8")]);
    fs.writeFileSync(path.join(baseArchiveDir, "index.html"), masterHubBuf);

    // === 8. Synchronize to distributor-preview for instant local serving ===
    const previewDir = path.resolve(process.cwd(), "distributor-preview");
    if (fs.existsSync(previewDir)) {
      try {
        const previewInstaDir = path.join(previewDir, "1_Instagram");
        if (fs.existsSync(previewInstaDir)) {
          const validSlideNumbers = new Set(slides.map(s => s.slideNumber));
          const pFiles = fs.readdirSync(previewInstaDir);
          for (const file of pFiles) {
            const match = file.match(/^instagram_slide_(\d+)\.(png|svg)$/);
            if (match && !validSlideNumbers.has(parseInt(match[1], 10))) {
              fs.unlinkSync(path.join(previewInstaDir, file));
            }
          }
        }
        fs.cpSync(rootArchiveDir, previewDir, { recursive: true, force: true });
        console.log(`3. Local Preview Dashboard -> synced to ${previewDir}`);
      } catch (err) {
        console.warn(`[Sync] Notice: Could not sync to distributor-preview:`, err);
      }
    }
  } else {
    console.log(`\nGeneration complete in Pure Cloud-Native Mode (Review via Web Dashboard).`);
  }
}

run().catch(console.error);
