import * as dotenv from 'dotenv';
dotenv.config();
import { generateInstagramCarousel, generateInstagramCaption } from "./src/templates/instagram";
import { generateThreadsThread, generateThreadsImageSvg } from "./src/templates/threads";
import { generateNewsletterHtml } from "./src/templates/newsletter";
import { validateBriefingPayload } from "./src/circuit-breaker";
import type { MarketBriefingPayload } from "./src/types";
import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";

const payload20260828: MarketBriefingPayload = {
  asOfDate: "2026-08-28",
  publicationVersion: 1,
  headlineText: "일반 ETF 1,022개 중 상승 350개, 보합 35개, 하락 637개로 평균 -0.86% 하락하며 전반적인 약세를 나타냈습니다.",
  marketTemperature: "하락 우세",
  kospiClose: 6788.88,
  kospiChangePct: -1.79,
  kosdaqClose: 838.41,
  kosdaqChangePct: 0.09,
  generalEtfCount: 1022,
  upCount: 350,
  flatCount: 35,
  downCount: 637,
  breadthRatioPct: 34.25,
  generalTotalAum: 3851607,
  generalTotalTradeValue: 87792,
  marketTurnoverPct: 2.28,
  top10TradeSharePct: 67.37,
  allTop10TradeSharePct: 60.93,
  generalAumWeightedReturnPct: -0.86,
  top50WeightedReturnPct: -1.11,
  assetClasses: [
    { assetClass: "원자재", etfCount: 35, upCount: 22, flatCount: 4, downCount: 9, breadthRatioPct: 62.9, aumWeightedReturnPct: 1.25, totalAum: 76000, aumSharePct: 2.0, totalTradeValue: 1800, tradeSharePct: 2.1, ytdReturnPct: 14.5 },
    { assetClass: "채권", etfCount: 148, upCount: 75, flatCount: 28, downCount: 45, breadthRatioPct: 50.7, aumWeightedReturnPct: -0.08, totalAum: 541000, aumSharePct: 14.2, totalTradeValue: 11000, tradeSharePct: 12.5, ytdReturnPct: 4.2 },
    { assetClass: "국내주식", etfCount: 415, upCount: 142, flatCount: 20, downCount: 253, breadthRatioPct: 34.2, aumWeightedReturnPct: -0.12, totalAum: 1808000, aumSharePct: 47.3, totalTradeValue: 44000, tradeSharePct: 50.1, ytdReturnPct: 16.8 },
    { assetClass: "혼합·자산배분", etfCount: 28, upCount: 8, flatCount: 3, downCount: 17, breadthRatioPct: 28.6, aumWeightedReturnPct: -0.90, totalAum: 31000, aumSharePct: 0.8, totalTradeValue: 450, tradeSharePct: 0.5, ytdReturnPct: 5.1 },
    { assetClass: "해외주식", etfCount: 322, upCount: 95, flatCount: 18, downCount: 209, breadthRatioPct: 29.5, aumWeightedReturnPct: -1.18, totalAum: 1295000, aumSharePct: 33.9, totalTradeValue: 28000, tradeSharePct: 31.9, ytdReturnPct: 22.4 },
    { assetClass: "부동산/리츠", etfCount: 22, upCount: 4, flatCount: 2, downCount: 16, breadthRatioPct: 18.2, aumWeightedReturnPct: -1.53, totalAum: 68000, aumSharePct: 1.8, totalTradeValue: 700, tradeSharePct: 0.8, ytdReturnPct: 3.5 },
  ],
  focusEtfs: [
    { rankNo: 1, ticker: "069500", etfName: "KODEX 200", assetClass: "국내주식", closeValue: 42100, changePct: -0.95, tradeValue: 18200, tradeSharePct: 20.7 },
    { rankNo: 2, ticker: "396500", etfName: "TIGER 반도체TOP10", assetClass: "국내주식", closeValue: 34500, changePct: -1.82, tradeValue: 12400, tradeSharePct: 14.1 },
    { rankNo: 3, ticker: "102110", etfName: "TIGER 200", assetClass: "국내주식", closeValue: 42200, changePct: -0.92, tradeValue: 9100, tradeSharePct: 10.4 },
  ],
  peerGroups: [
    { assetClass: "국내주식", peerGroup: "K-푸드 & K-뷰티", etfCount: 12, cappedAumWeightedReturnPct: 6.62 },
    { assetClass: "원자재", peerGroup: "금 (실물 & 선물)", etfCount: 6, cappedAumWeightedReturnPct: 1.28 },
    { assetClass: "국내주식", peerGroup: "철강화학", etfCount: 8, cappedAumWeightedReturnPct: 1.19 },
    { assetClass: "해외주식", peerGroup: "국내 일반 반도체", etfCount: 18, cappedAumWeightedReturnPct: -1.55 },
    { assetClass: "해외주식", peerGroup: "AI 반도체 & HBM", etfCount: 14, cappedAumWeightedReturnPct: -1.83 },
    { assetClass: "해외주식", peerGroup: "미국 반도체 소부장", etfCount: 9, cappedAumWeightedReturnPct: -2.24 },
  ],
  periodicFlows: {
    dailyFundFlows: {
      topInflows: [
        { rank: 1, ticker: "069500", name: "KODEX 200", theme: "국내대표지수", inflow: 5325, changePct: -0.95 },
        { rank: 2, ticker: "396500", name: "TIGER 반도체TOP10", theme: "국내반도체", inflow: 3053, changePct: -1.82 },
        { rank: 3, ticker: "102110", name: "TIGER 200", theme: "국내대표지수", inflow: 2178, changePct: -0.92 },
        { rank: 4, ticker: "091160", name: "KODEX 반도체", theme: "국내반도체", inflow: 1781, changePct: -1.75 },
        { rank: 5, ticker: "278530", name: "KODEX 200TR", theme: "대표지수TR", inflow: 1619, changePct: -0.90 },
      ],
      topOutflows: [
        { rank: 1, ticker: "114800", name: "KODEX 인버스", theme: "파생인버스", inflow: -850, changePct: 0.95 },
      ],
    },
    weeklyFundFlows: {
      topInflows: [
        { rank: 1, ticker: "069500", name: "KODEX 200", inflow: 21500 },
        { rank: 2, ticker: "379800", name: "KODEX 미국S&P500TR", inflow: 16400 },
        { rank: 3, ticker: "133690", name: "TIGER 미국나스닥100", inflow: 14200 },
      ],
      topOutflows: [],
    },
  },
};

const baseUrl = "https://etf-campus.pages.dev";

async function run() {
  console.log("=== 1. Circuit Breaker Validation ===");
  const validation = validateBriefingPayload(payload20260828, {
    ETF_PRICES: {} as any,
    BRIEFING_KV: {} as any,
    SITE_BASE_URL: baseUrl,
  });
  console.log("Circuit Breaker Valid:", validation.isSafe, validation.reasons);

  console.log("\n=== 2. Instagram 6-Slide Generation ===");
  const slides = generateInstagramCarousel(payload20260828, baseUrl);
  console.log(`Generated ${slides.length} slides.`);

  const dateStr = payload20260828.asOfDate || "YYYY-MM-DD";
  
  // Destination 1: Root OSMU Archive
  const rootArchiveDir = path.resolve(process.cwd(), "..", "..", "OSMU_Archive", dateStr);
  const rootInstaDir = path.join(rootArchiveDir, "1_Instagram");
  const rootThreadsDir = path.join(rootArchiveDir, "2_Threads");
  const rootEmailDir = path.join(rootArchiveDir, "3_Email");

  // Destination 2: Local Preview Directory (for distributor-preview/index.html)
  const localPreviewDir = path.resolve(process.cwd(), "distributor-preview");

  [rootInstaDir, rootThreadsDir, rootEmailDir, localPreviewDir].forEach(d => fs.mkdirSync(d, { recursive: true }));

  // Render & Save Slides
  for (const s of slides) {
    const safeSvg = s.svgContent.replace(/&(?!(amp|lt|gt|quot|apos);)/g, "&amp;");
    
    // Save to root OSMU Archive
    const rootSvgPath = path.join(rootInstaDir, `instagram_slide_${s.slideNumber}.svg`);
    const rootPngPath = path.join(rootInstaDir, `instagram_slide_${s.slideNumber}.png`);
    fs.writeFileSync(rootSvgPath, safeSvg, "utf-8");
    await sharp(Buffer.from(safeSvg)).png().toFile(rootPngPath);

    // Save to local distributor-preview
    const localSvgPath = path.join(localPreviewDir, `instagram_slide_${s.slideNumber}.svg`);
    const localPngPath = path.join(localPreviewDir, `instagram_slide_${s.slideNumber}.png`);
    fs.writeFileSync(localSvgPath, safeSvg, "utf-8");
    await sharp(Buffer.from(safeSvg)).png().toFile(localPngPath);

    console.log(`- Slide ${s.slideNumber}: [${s.title}] ${s.subtitle} -> Rendered PNG & SVG`);
  }

  // Instagram Caption
  const caption = generateInstagramCaption(payload20260828).replace(/\r?\n/g, "\r\n");
  const captionBuf = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(caption, "utf-8")]);
  fs.writeFileSync(path.join(rootInstaDir, "instagram_caption.txt"), captionBuf);
  fs.writeFileSync(path.join(localPreviewDir, "instagram_caption.txt"), captionBuf);
  console.log("- Instagram Caption -> Saved to both locations");

  // Threads Content & Image
  console.log("\n=== 3. Threads Generation ===");
  const threads = generateThreadsThread(payload20260828, baseUrl);
  let threadsText = "";
  threads.forEach((t) => {
    const label = t.sequence === 1 ? "Main Post" : "First Comment (CTA)";
    threadsText += `--- ${label} ---\n${t.content}\n\n`;
  });
  const threadsBuf = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(threadsText.replace(/\r?\n/g, "\r\n"), "utf-8")]);
  fs.writeFileSync(path.join(rootThreadsDir, "threads_script.txt"), threadsBuf);
  fs.writeFileSync(path.join(localPreviewDir, "threads_script.txt"), threadsBuf);

  const threadsSvgContent = generateThreadsImageSvg(payload20260828);
  const safeThreadsSvg = threadsSvgContent.replace(/&(?!(amp|lt|gt|quot|apos);)/g, "&amp;");
  
  // Save Threads SVG & PNG to both
  const rootThreadsSvg = path.join(rootThreadsDir, "threads_image.svg");
  const rootThreadsPng = path.join(rootThreadsDir, "threads_image.png");
  fs.writeFileSync(rootThreadsSvg, safeThreadsSvg, "utf-8");
  await sharp(Buffer.from(safeThreadsSvg)).png().toFile(rootThreadsPng);

  const localThreadsSvg = path.join(localPreviewDir, "threads_image.svg");
  const localThreadsPng = path.join(localPreviewDir, "threads_image.png");
  fs.writeFileSync(localThreadsSvg, safeThreadsSvg, "utf-8");
  await sharp(Buffer.from(safeThreadsSvg)).png().toFile(localThreadsPng);
  console.log("- Threads Image -> Rendered PNG & SVG to both locations");

  // Newsletter
  console.log("\n=== 4. Newsletter HTML Generation ===");
  const newsletter = generateNewsletterHtml(payload20260828, baseUrl);
  const newsBuf = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(newsletter.html, "utf-8")]);

  fs.writeFileSync(path.join(rootEmailDir, "email_body.html"), newsBuf);
  fs.writeFileSync(path.join(localPreviewDir, "newsletter.html"), newsBuf);

  console.log("\n=== 5. Email Puppeteer High-Res Capture (Actual Webpage) ===");
  console.log("Launching headless browser to snapshot actual Market Briefing webpage...");
  console.log(`Navigating to: ${baseUrl}/briefing`);
  const emailPngPath = path.join(rootEmailDir, "email_snapshot.png");

  try {
    const puppeteer = (await import("puppeteer")).default;
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 600, height: 1800, deviceScaleFactor: 2 });
    await page.goto(`${baseUrl}/briefing`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await new Promise((r) => setTimeout(r, 2000));

    await page.evaluate(() => {
      document.querySelectorAll('header, nav, [class*="ticker"], [class*="sticky"]').forEach(el => el.remove());
      document.querySelectorAll('h1').forEach(h1 => {
        const parentSection = h1.closest('section') || h1.closest('header') || h1.parentElement;
        if (parentSection) parentSection.remove();
      });
      document.querySelectorAll('details').forEach(el => el.remove());
      const historyTitle = document.getElementById('briefing-history-title');
      if (historyTitle) {
        const parentSec = historyTitle.closest('section') || historyTitle.closest('div');
        if (parentSec) parentSec.remove();
      }
      document.querySelectorAll('footer').forEach(el => el.remove());
      document.body.style.padding = '0';
      document.body.style.margin = '0';
      const main = document.querySelector('main');
      if (main) {
        main.style.padding = '0';
        main.style.margin = '0';
        main.style.minHeight = 'auto';
      }
    });

    await new Promise((r) => setTimeout(r, 500));

    const mainElement = (await page.$('main')) || page;
    await mainElement.screenshot({ path: emailPngPath });
    await browser.close();
    fs.copyFileSync(emailPngPath, path.join(localPreviewDir, "email_snapshot.png"));
    console.log(`Tight Webpage snapshot saved to: ${emailPngPath}`);
  } catch(e) {
    console.error("Puppeteer capture failed:", e);
  }

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
        subject: `🚨 [QA 테스트] 🚨 ${newsletter.subject}`,
        html: `
          <div style="background-color: #0F172A; padding: 40px 0; font-family: sans-serif; text-align: center; width: 100%;">
            <div style="max-width: 600px; margin: 0 auto;">
              <a href="${baseUrl}/briefing" style="display: block; text-decoration: none;">
                <img src="cid:newsletter_full_image" alt="Market Briefing" style="max-width: 100%; border-radius: 20px; display: block; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);" />
              </a>
              <p style="margin-top: 32px; font-size: 12px; color: #94A3B8; line-height: 1.6;">
                 본 메일은 ETF 캠퍼스 뉴스레터 자동 발송 테스트입니다.<br/>
                 © 2026 ETF Campus. All rights reserved.
              </p>
            </div>
          </div>
        `,
        attachments: [
          {
            filename: "email_snapshot.png",
            path: emailPngPath,
            cid: "newsletter_full_image"
          }
        ]
      };
      const info = await transporter.sendMail(mailOptions);
      console.log(`QA Email sent successfully: <${info.messageId}>`);
    } catch(e) {
      console.error("Nodemailer sending failed:", e);
    }
  } else {
    console.log("No SMTP credentials found. Skipping Nodemailer.");
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
          🔄 새로고침
        </button>
      </div>
    </header>

    <!-- 3-Channel Tabs -->
    <div class="flex border-b border-slate-800 gap-2" id="channelTabs">
      <button onclick="switchTab('instagram')" id="tab-instagram" class="px-6 py-3 font-bold text-sm border-b-2 border-emerald-500 text-emerald-400 flex items-center gap-2">
        📷 인스타그램 6-Slide 카드뉴스 & 캡션
      </button>
      <button onclick="switchTab('threads')" id="tab-threads" class="px-6 py-3 font-bold text-sm border-b-2 border-transparent text-slate-400 hover:text-slate-200 flex items-center gap-2">
        🧵 Threads 모닝 브리핑 & 이미지
      </button>
      <button onclick="switchTab('newsletter')" id="tab-newsletter" class="px-6 py-3 font-bold text-sm border-b-2 border-transparent text-slate-400 hover:text-slate-200 flex items-center gap-2">
        📧 이메일 뉴스레터
      </button>
    </div>

    <!-- TAB 1: Instagram Carousel -->
    <section id="panel-instagram" class="space-y-6">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div class="lg:col-span-7 bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-2xl flex flex-col items-center">
          <div class="flex items-center justify-between w-full mb-3 text-xs text-slate-400 font-bold px-2">
            <span id="activeSlideTitle">Slide 1 / 6</span>
            <div class="flex gap-2">
              <button onclick="prevSlide()" class="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-white font-bold">◀ 이전</button>
              <button onclick="nextSlide()" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white font-bold">다음 ▶</button>
            </div>
          </div>
          <div id="focusedSlideContainer" class="w-full max-w-[500px] slide-svg shadow-2xl rounded-2xl overflow-hidden border border-slate-700/50"></div>
        </div>

        <div class="lg:col-span-5 space-y-4">
          <div class="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-3">
            <h3 class="text-sm font-extrabold text-slate-300">📝 인스타그램 캡션 미리보기</h3>
            <pre class="text-xs text-slate-300 whitespace-pre-wrap bg-slate-900 p-4 rounded-xl border border-slate-800 max-h-[380px] overflow-y-auto">${caption}</pre>
          </div>
          <h3 class="text-sm font-extrabold text-slate-300 uppercase tracking-wider">전체 6장 슬라이드 썸네일</h3>
          <div class="grid grid-cols-3 gap-2" id="thumbnailsContainer"></div>
        </div>
      </div>
    </section>

    <!-- TAB 2: Threads Thread -->
    <section id="panel-threads" class="hidden space-y-6">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div class="lg:col-span-6 space-y-4" id="threadsContainer"></div>
        <div class="lg:col-span-6 bg-slate-950 p-6 rounded-2xl border border-slate-800 flex flex-col items-center">
          <h3 class="text-sm font-bold text-slate-300 mb-4 self-start">🖼️ 스레드 단일 첨부 이미지</h3>
          <div class="slide-svg max-w-[420px] rounded-2xl overflow-hidden shadow-2xl border border-slate-700 w-full">
            ${threadsSvgContent}
          </div>
        </div>
      </div>
    </section>

    <!-- TAB 3: Newsletter HTML -->
    <section id="panel-newsletter" class="hidden space-y-6">
      <div class="bg-slate-800 p-4 rounded-2xl flex items-center justify-between">
        <div>
          <span class="text-xs text-slate-400">제목:</span>
          <span class="font-bold text-white text-sm ml-2">🚨 [QA 테스트] 🚨 ${newsletter.subject}</span>
        </div>
      </div>
      <div class="bg-[#0F172A] rounded-2xl overflow-hidden shadow-2xl p-8 border border-slate-700 flex flex-col items-center">
        <div class="max-w-[480px] w-full">
          <img src="./email_snapshot.png" class="w-full rounded-2xl shadow-2xl border border-slate-700" alt="Full Email Snapshot" />
          <p class="mt-8 text-[12px] text-slate-400 leading-relaxed text-center">
            본 메일은 ETF 캠퍼스 뉴스레터 자동 발송 테스트입니다.<br/>
            © 2026 ETF Campus. All rights reserved.
          </p>
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
      document.getElementById('activeSlideTitle').innerText = 'Slide ' + s.slideNumber + ' : ' + s.title;
      document.getElementById('focusedSlideContainer').innerHTML = s.svgContent;

      const thumbContainer = document.getElementById('thumbnailsContainer');
      thumbContainer.innerHTML = slides.map((item, idx) => \`
        <div onclick="setSlide(\${idx})" class="cursor-pointer bg-slate-950 p-1.5 rounded-xl border \${idx === currentIdx ? 'border-emerald-500 ring-2 ring-emerald-500/30' : 'border-slate-800'} transition">
          <div class="slide-svg rounded-lg overflow-hidden">\${item.svgContent}</div>
        </div>
      \`).join('');
    }

    function setSlide(idx) {
      currentIdx = idx;
      renderSlides();
    }

    function prevSlide() {
      currentIdx = (currentIdx - 1 + slides.length) % slides.length;
      renderSlides();
    }

    function nextSlide() {
      currentIdx = (currentIdx + 1) % slides.length;
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
    }

    renderSlides();
    renderThreads();
  </script>
</body>
</html>`;

  const dashboardBuf = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(previewDashboardHtml, "utf-8")]);
  fs.writeFileSync(path.join(rootArchiveDir, "index.html"), dashboardBuf);
  fs.writeFileSync(path.join(localPreviewDir, "index.html"), dashboardBuf);

  console.log(`\n🎉 All PNGs, SVGs, and Previews freshly synchronized to BOTH:`);
  console.log(`1. file://${path.join(localPreviewDir, "index.html")}`);
  console.log(`2. file://${path.join(rootArchiveDir, "index.html")}`);
}

run().catch(console.error);
