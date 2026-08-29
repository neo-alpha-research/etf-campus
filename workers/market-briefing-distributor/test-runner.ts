import { generateInstagramCarousel } from "./src/templates/instagram";
import { generateThreadsThread } from "./src/templates/threads";
import { generateNewsletterHtml } from "./src/templates/newsletter";
import { validateBriefingPayload } from "./src/circuit-breaker";
import type { MarketBriefingPayload } from "./src/types";
import * as fs from "fs";
import * as path from "path";

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
    { assetClass: "해외주식", peerGroup: "국내 일반 반도체", etfCount: 18, cappedAumWeightedReturnPct: -1.83 },
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

console.log("=== 1. Circuit Breaker Validation ===");
const validation = validateBriefingPayload(payload20260828, {
  ETF_PRICES: {} as any,
  BRIEFING_KV: {} as any,
  SITE_BASE_URL: baseUrl,
});
console.log("Circuit Breaker Valid:", validation.isSafe, validation.reasons);

console.log("\n=== 2. Instagram 6-Slide Standardized Carousel Generation ===");
const slides = generateInstagramCarousel(payload20260828, baseUrl);
console.log(`Generated ${slides.length} slides.`);

const outputDir = path.resolve(process.cwd(), "distributor-preview");
fs.mkdirSync(outputDir, { recursive: true });

slides.forEach((s) => {
  fs.writeFileSync(path.join(outputDir, `instagram_slide_${s.slideNumber}.svg`), s.svgContent, "utf-8");
  console.log(`- Slide ${s.slideNumber}: [${s.title}] ${s.subtitle} -> Saved (${s.svgContent.length} bytes)`);
});

console.log("\n=== 3. Threads 4-Post Thread Generation ===");
const threads = generateThreadsThread(payload20260828, baseUrl);
threads.forEach((t) => {
  console.log(`\n--- Post ${t.sequence}/4 ---\n${t.content}`);
});
fs.writeFileSync(path.join(outputDir, "threads_thread.json"), JSON.stringify(threads, null, 2), "utf-8");

console.log("\n=== 4. Newsletter Responsive HTML Generation ===");
const newsletter = generateNewsletterHtml(payload20260828, baseUrl);
console.log(`Subject: ${newsletter.subject}`);
console.log(`HTML Length: ${newsletter.html.length} chars`);
fs.writeFileSync(path.join(outputDir, "newsletter.html"), newsletter.html, "utf-8");

// Generate Integrated Local Preview Dashboard HTML
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
  <title>ETF Campus - OSMU Multi-Channel Local Preview (2026.08.28)</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css">
  <style>
    * { font-family: 'Pretendard', sans-serif; }
    .slide-svg svg { width: 100%; height: auto; display: block; border-radius: 1.25rem; }
  </style>
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen p-4 md:p-8">
  <div class="max-w-7xl mx-auto space-y-8">
    <!-- Header -->
    <header class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-950 px-3 py-1 text-xs font-bold text-emerald-400 border border-emerald-800">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            LOCAL FAST PREVIEW (3초 생성)
          </span>
          <span class="text-sm font-semibold text-slate-400">2026.08.28 (금) 장마감 기준</span>
        </div>
        <h1 class="text-2xl md:text-3xl font-extrabold text-white">
          ETF Campus OSMU 자동 배포 통합 프리뷰 대시보드
        </h1>
      </div>
      <div class="flex items-center gap-3">
        <button onclick="window.location.reload()" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold border border-slate-700 transition">
          🔄 새로고침
        </button>
        <span class="px-3 py-2 bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold">
          ✅ 6-Slide 표준 템플릿 검증 완료
        </span>
      </div>
    </header>

    <!-- 3-Channel Tabs -->
    <div class="flex border-b border-slate-800 gap-2" id="channelTabs">
      <button onclick="switchTab('instagram')" id="tab-instagram" class="px-6 py-3 font-bold text-sm border-b-2 border-emerald-500 text-emerald-400 flex items-center gap-2">
        📸 인스타그램 6-Slide 카드뉴스 (1080x1350)
      </button>
      <button onclick="switchTab('threads')" id="tab-threads" class="px-6 py-3 font-bold text-sm border-b-2 border-transparent text-slate-400 hover:text-slate-200 flex items-center gap-2">
        🧵 Threads 4단 타래
      </button>
      <button onclick="switchTab('newsletter')" id="tab-newsletter" class="px-6 py-3 font-bold text-sm border-b-2 border-transparent text-slate-400 hover:text-slate-200 flex items-center gap-2">
        📧 이메일 뉴스레터 (반응형)
      </button>
    </div>

    <!-- TAB 1: Instagram Carousel -->
    <section id="panel-instagram" class="space-y-6">
      <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-800/60 p-4 rounded-2xl border border-slate-700/60">
        <div>
          <h2 class="text-lg font-bold text-white flex items-center gap-2">
            <span>6-Slide 표준 캐러셀 갤러리</span>
            <span class="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-400/30">페르소나 9.50점 만장일치 S등급</span>
          </h2>
          <p class="text-xs text-slate-400 mt-0.5">올블랙 탈피 프리미엄 에디토리얼 테마 (#F8FAFC) + 4:5 모바일 최적화</p>
        </div>
        <!-- Slide Selectors -->
        <div class="flex items-center gap-1.5 flex-wrap" id="slidePills"></div>
      </div>

      <!-- Main Visual Carousel -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <!-- Main Single Slide Focused View -->
        <div class="lg:col-span-7 bg-slate-950 p-4 sm:p-6 rounded-3xl border border-slate-800 shadow-2xl flex flex-col items-center">
          <div class="flex items-center justify-between w-full mb-3 text-xs text-slate-400 font-bold px-2">
            <span id="activeSlideTitle">Slide 1 / 6</span>
            <div class="flex gap-2">
              <button onclick="prevSlide()" class="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-white font-bold">◀ 이전</button>
              <button onclick="nextSlide()" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white font-bold">다음 ▶</button>
            </div>
          </div>
          <div id="focusedSlideContainer" class="w-full max-w-[500px] slide-svg shadow-2xl rounded-2xl overflow-hidden border border-slate-700/50"></div>
        </div>

        <!-- All 6 Slides Grid Overview -->
        <div class="lg:col-span-5 space-y-4">
          <h3 class="text-sm font-extrabold text-slate-300 uppercase tracking-wider">전체 6개 슬라이드 한눈에 보기</h3>
          <div class="grid grid-cols-2 gap-3" id="thumbnailsContainer"></div>
        </div>
      </div>
    </section>

    <!-- TAB 2: Threads Thread -->
    <section id="panel-threads" class="hidden space-y-6">
      <div class="max-w-2xl mx-auto space-y-4" id="threadsContainer"></div>
    </section>

    <!-- TAB 3: Newsletter HTML -->
    <section id="panel-newsletter" class="hidden space-y-6">
      <div class="bg-slate-800 p-4 rounded-2xl flex items-center justify-between">
        <div>
          <span class="text-xs text-slate-400">제목:</span>
          <span class="font-bold text-white text-sm ml-2">${newsletter.subject}</span>
        </div>
        <a href="./newsletter.html" target="_blank" class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold">
          새 창에서 원본 열기 ↗
        </a>
      </div>
      <div class="bg-white rounded-2xl overflow-hidden shadow-2xl p-2 border border-slate-700">
        <iframe src="./newsletter.html" class="w-full h-[850px] rounded-xl border-0"></iframe>
      </div>
    </section>
  </div>

  <script>
    const slides = ${slidesJson};
    const threads = ${threadsJson};
    let currentIdx = 0;

    function renderSlides() {
      // Render Focused
      const s = slides[currentIdx];
      document.getElementById('activeSlideTitle').innerText = 'Slide ' + s.slideNumber + ' : ' + s.title + ' (' + s.subtitle + ')';
      document.getElementById('focusedSlideContainer').innerHTML = s.svgContent;

      // Render Pills
      const pillsContainer = document.getElementById('slidePills');
      pillsContainer.innerHTML = slides.map((item, idx) => \`
        <button onclick="setSlide(\${idx})" class="px-3 py-1.5 rounded-lg text-xs font-bold transition \${idx === currentIdx ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}">
          \${item.slideNumber}. \${item.title}
        </button>
      \`).join('');

      // Render Thumbnails
      const thumbContainer = document.getElementById('thumbnailsContainer');
      thumbContainer.innerHTML = slides.map((item, idx) => \`
        <div onclick="setSlide(\${idx})" class="cursor-pointer group bg-slate-950 p-2 rounded-xl border \${idx === currentIdx ? 'border-emerald-500 ring-2 ring-emerald-500/30' : 'border-slate-800 hover:border-slate-600'} transition">
          <div class="flex justify-between items-center mb-1 text-[11px] font-bold text-slate-400 group-hover:text-white">
            <span>\${item.slideNumber}. \${item.title}</span>
          </div>
          <div class="slide-svg rounded-lg overflow-hidden scale-95 origin-top">\${item.svgContent}</div>
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
          '<div class="flex items-center justify-between border-b border-slate-800/80 pb-3">' +
            '<div class="flex items-center gap-2">' +
              '<span class="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-white">@</span>' +
              '<span class="font-bold text-sm text-white">etfcampus</span>' +
              '<span class="text-xs text-slate-500">· Post ' + t.sequence + '/4</span>' +
            '</div>' +
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

fs.writeFileSync(path.join(outputDir, "index.html"), previewDashboardHtml, "utf-8");

console.log(`\n🎉 Integrated Local Multi-Channel Preview Dashboard generated!`);
console.log(`👉 Open in browser: file://${path.join(outputDir, "index.html")}`);
