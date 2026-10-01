import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import puppeteer from 'puppeteer';

const artifactDir = 'C:/Users/kibae/.gemini/antigravity/brain/774bc5ad-a35e-4bfd-8724-cec9d335f3ef';

// Common defs
const commonDefs = `
  <defs>
    <filter id="softShadow" x="-10%" y="-10%" width="120%" height="125%">
      <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#0F172A" flood-opacity="0.06"/>
    </filter>
    <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="125%">
      <feDropShadow dx="0" dy="4" stdDeviation="10" flood-color="#0F172A" flood-opacity="0.04"/>
    </filter>
    <clipPath id="heroSummaryClip">
      <rect x="0" y="0" width="870" height="54" rx="14"/>
    </clipPath>
    <clipPath id="chipClip">
      <rect x="0" y="0" width="280" height="74" rx="14"/>
    </clipPath>
    <clipPath id="wideChipClip">
      <rect x="0" y="0" width="870" height="74" rx="14"/>
    </clipPath>
    <clipPath id="factBandClip">
      <rect x="0" y="0" width="870" height="72" rx="14"/>
    </clipPath>
    <style>
      @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css');
      * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', '맑은 고딕', 'Noto Sans KR', 'Segoe UI', sans-serif, 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji'; }
      .tabular { font-variant-numeric: tabular-nums; letter-spacing: -0.5px; }
    </style>
  </defs>
`;

const commonFooter = `
  <!-- Legal Disclaimer (자본시장법 제101조 준수) -->
  <text x="540" y="1224" fill="#64748B" font-size="18" font-weight="700" text-anchor="middle">
    * 본 자료는 투자 판단을 돕기 위한 정보 제공용이며, 특정 종목의 매수·매도를 권유하지 않습니다.
  </text>

  <!-- ETF 캠퍼스 공식 최신 표준 풋터 밴드 (Y: 1242 ~ 1306, H: 64) -->
  <g transform="translate(60, 1242)">
    <!-- 1. 부드러운 라운드 배너 배경 -->
    <rect x="0" y="0" width="960" height="64" rx="8" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.2"/>
    
    <g transform="translate(480, 40)" text-anchor="middle">
      <!-- 2. 초록색 핵심 설명 문구 (이모지 포함) -->
      <text x="-195" y="0" fill="#059669" font-size="20" font-weight="800" letter-spacing="-0.2">
        🔍 DC/IRP, 연금저축, ISA 계좌별 ETF 비교 분석 최적화
      </text>
      
      <!-- 3. 구분선 -->
      <text x="90" y="-1" fill="#CBD5E1" font-size="20" font-weight="400">|</text>
      
      <!-- 4. 브랜드명 및 도메인 URL (이모지 포함) -->
      <text x="285" y="0" fill="#0F172A" font-size="20" font-weight="900">
        📊 ETF 캠퍼스 etf-campus.pages.dev
      </text>
    </g>
  </g>
`;

// Escape XML
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Conservative text width measurement to guarantee zero overflow
function measureTextWidth(text: string, fontSize: number): number {
  let width = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code > 0x07ff) {
      width += fontSize * 0.98; // Conservative Korean ceiling
    } else if (code >= 0x0041 && code <= 0x005a) {
      width += fontSize * 0.72; // Uppercase Latin
    } else if (code >= 0x0030 && code <= 0x0039) {
      width += fontSize * 0.62; // Digits
    } else if (code === 0x0020) {
      width += fontSize * 0.35; // Space
    } else {
      width += fontSize * 0.58; // Lowercase Latin, symbols
    }
  }
  return width;
}

// Auto-fit and clamp text to maxWidthPx
function fitAndClampText(
  text: string,
  maxWidthPx: number,
  initialFs: number = 22,
  minFs: number = 18
): { text: string; fontSize: number } {
  if (!text) return { text: '', fontSize: initialFs };

  let w = measureTextWidth(text, initialFs);
  if (w <= maxWidthPx) {
    return { text, fontSize: initialFs };
  }

  for (let fs = initialFs - 1; fs >= minFs; fs--) {
    w = measureTextWidth(text, fs);
    if (w <= maxWidthPx) {
      return { text, fontSize: fs };
    }
  }

  let clamped = text;
  while (clamped.length > 1) {
    clamped = clamped.slice(0, -1);
    const testStr = clamped.trim() + '…';
    if (measureTextWidth(testStr, minFs) <= maxWidthPx) {
      return { text: testStr, fontSize: minFs };
    }
  }

  return { text: '…', fontSize: minFs };
}

// Data Model
interface StyleInflowItem {
  name: string;
  inflow: number;
}

interface StyleCardData {
  num: string;
  title: string;
  purpose: string;
  items: StyleInflowItem[];
  sum: number;
  pct: number;
  themeBorder: string;
  barFill: string;
  badgeBg: string;
  badgeBorder: string;
  badgeTextColor: string;
  factText: string;
  subNote: string;
}

// Render Single Style Card Template (Guaranteed Zero Overflow)
function renderStyleCardTemplate(card: StyleCardData, yPos: number): string {
  let middleContent = '';

  if (card.items.length >= 2) {
    const top3 = card.items.slice(0, 3);
    middleContent = top3.map((it, idx) => {
      const posX = 35 + idx * 295;
      // Max usable text width inside 280px chip: 280 - 56 (badge) - 10 (padding) = 214px
      const fittedName = fitAndClampText(it.name, 214, 18.5, 18);
      return `
        <g transform="translate(${posX}, 88)" clip-path="url(#chipClip)">
          <rect width="280" height="76" rx="14" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.4"/>
          <rect x="12" y="17" width="38" height="42" rx="10" fill="${card.badgeBg}"/>
          <text x="31" y="45" fill="${card.badgeTextColor}" font-size="20" font-weight="900" text-anchor="middle">${idx + 1}</text>
          <text x="58" y="39" fill="#0F172A" font-size="${fittedName.fontSize}" font-weight="900">${escapeXml(fittedName.text)}</text>
          <text x="58" y="63" fill="${card.badgeTextColor}" font-size="18" font-weight="900" class="tabular">+${it.inflow.toLocaleString()}억원 유입</text>
        </g>
      `;
    }).join('');
  } else if (card.items.length === 1) {
    const it = card.items[0];
    // Generous width for name: 290px
    const fittedName = fitAndClampText(it.name, 290, 23, 19);
    // Usable width for note: 260px
    const fittedNote = fitAndClampText(card.subNote, 260, 19, 18);

    middleContent = `
      <g transform="translate(35, 88)" clip-path="url(#wideChipClip)">
        <rect width="870" height="76" rx="14" fill="${card.badgeBg}" stroke="${card.badgeBorder}" stroke-width="1.4"/>
        <rect x="16" y="17" width="85" height="42" rx="10" fill="#FFFFFF"/>
        <text x="58.5" y="44" fill="${card.badgeTextColor}" font-size="19" font-weight="900" text-anchor="middle">1위 집중</text>
        <text x="112" y="47" fill="#0F172A" font-size="${fittedName.fontSize}" font-weight="900">${escapeXml(fittedName.text)}</text>
        <rect x="415" y="17" width="165" height="42" rx="10" fill="#FFFFFF" stroke="${card.badgeBorder}" stroke-width="1.2"/>
        <text x="497.5" y="44" fill="${card.badgeTextColor}" font-size="19" font-weight="900" text-anchor="middle" class="tabular">+${it.inflow.toLocaleString()}억원 순유입</text>
        <text x="595" y="46" fill="#475569" font-size="${fittedNote.fontSize}" font-weight="800">${escapeXml(fittedNote.text)}</text>
      </g>
    `;
  } else {
    middleContent = `
      <g transform="translate(35, 88)">
        <rect width="870" height="76" rx="14" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.4"/>
        <text x="435" y="45" fill="#64748B" font-size="19" font-weight="800" text-anchor="middle">✔ 당일 상위 순유입 종목군 내 집계 대기</text>
      </g>
    `;
  }

  // Factual commentary text fitted strictly within 680px (870 - 145 - 45)
  const fittedFact = fitAndClampText(card.factText, 680, 21, 18);

  return `
    <g transform="translate(70, ${yPos})" filter="url(#cardShadow)">
      <rect width="940" height="276" rx="24" fill="#FFFFFF" stroke="${card.themeBorder}" stroke-width="2"/>
      <rect x="0" y="0" width="8" height="276" rx="4" fill="${card.barFill}"/>

      <!-- Header line: 스타일명 + 직관적 한글 목적 뱃지 + 금액/점유율 -->
      <rect x="35" y="18" width="160" height="42" rx="10" fill="${card.badgeBg}" stroke="${card.badgeBorder}" stroke-width="1.4"/>
      <text x="115" y="46" fill="${card.badgeTextColor}" font-size="20" font-weight="900" text-anchor="middle">${card.num} ${card.title}</text>
      
      <rect x="210" y="18" width="165" height="42" rx="10" fill="#F1F5F9" stroke="#E2E8F0" stroke-width="1.2"/>
      <text x="292.5" y="46" fill="#334155" font-size="20" font-weight="900" text-anchor="middle">${card.purpose}</text>

      <text x="905" y="49" fill="${card.badgeTextColor}" font-size="32" font-weight="900" text-anchor="end" class="tabular">+${card.sum.toLocaleString()}억원 <tspan font-size="22" fill="#64748B" font-weight="800">(점유율 ${card.pct}%)</tspan></text>

      <line x1="35" y1="74" x2="905" y2="74" stroke="#F1F5F9" stroke-width="1.5"/>

      <!-- Middle: Dynamic Items Chips Grid (Guaranteed Zero Overflow) -->
      ${middleContent}

      <!-- Bottom: Factual Commentary Band (Strictly Clamped to 680px) -->
      <g transform="translate(35, 180)" clip-path="url(#factBandClip)">
        <rect width="870" height="76" rx="14" fill="${card.badgeBg}" stroke="${card.badgeBorder}" stroke-width="1.2"/>
        <rect x="14" y="17" width="115" height="42" rx="10" fill="#FFFFFF"/>
        <text x="71.5" y="44" fill="${card.badgeTextColor}" font-size="19" font-weight="900" text-anchor="middle">수급 팩트</text>
        <text x="144" y="45" fill="#1E293B" font-size="${fittedFact.fontSize}" font-weight="800">
          ${escapeXml(fittedFact.text)}
        </text>
      </g>
    </g>
  `;
}

// 2026-09-30 Actual Data
const totalInflow = 2036;
const coreInflow = 1014;
const growthInflow = 854;
const defensiveInflow = 168;

const corePct = 50;
const growthPct = 42;
const defensivePct = 8;

const totalBarW = 870;
const coreW = Math.round(totalBarW * (corePct / 100)); // 435
const growthW = Math.round(totalBarW * (growthPct / 100)); // 365
const defW = totalBarW - coreW - growthW; // 70

const heroSummaryRaw = `시장대표 패시브 적립(${corePct}%)과 성장 테마 저가매수(${growthPct}%)로 스마트머니 92% 집중`;
const fittedHeroSummary = fitAndClampText(heroSummaryRaw, 680, 21, 18);

const cardsData: StyleCardData[] = [
  {
    num: "01",
    title: "시장 대표형",
    purpose: "지수 패시브 적립",
    items: [
      { name: "TIGER 미국S&P500", inflow: 451 },
      { name: "TIGER 200", inflow: 329 },
      { name: "KODEX 미국S&P500TR", inflow: 234 },
    ],
    sum: coreInflow,
    pct: corePct,
    themeBorder: "#BBF7D0",
    barFill: "#10B981",
    badgeBg: "#DCFCE7",
    badgeBorder: "#86EFAC",
    badgeTextColor: "#15803D",
    factText: "지수 조정에도 대표 벤치마크군으로 기계적 패시브 적립 자금 최다 유입",
    subNote: "",
  },
  {
    num: "02",
    title: "공격 성장형",
    purpose: "혁신 성장 저가매수",
    items: [
      { name: "KODEX 2차전지산업", inflow: 854 },
    ],
    sum: growthInflow,
    pct: growthPct,
    themeBorder: "#FECDD3",
    barFill: "#F43F5E",
    badgeBg: "#FFE4E6",
    badgeBorder: "#FDA4AF",
    badgeTextColor: "#BE123C",
    factText: "단기 낙폭 과대 기술주 테마를 겨냥한 스마트머니의 선별적 저가 매수세 집중",
    subNote: "(단일 종목 순유입 압도적 1위)",
  },
  {
    num: "03",
    title: "방어 인컴형",
    purpose: "변동성 방어·채권",
    items: [
      { name: "ACE 회사채(AA-이상)액티브", inflow: 168 },
    ],
    sum: defensiveInflow,
    pct: defensivePct,
    themeBorder: "#BFDBFE",
    barFill: "#3B82F6",
    badgeBg: "#EFF6FF",
    badgeBorder: "#BFDBFE",
    badgeTextColor: "#1D4ED8",
    factText: "시장 변동성 속 우량 크레딧 회사채 중심의 안전 이자수익 완충 수급 형성",
    subNote: "(우량 신용등급 안전 완충)",
  },
];

function formatBarSegmentLabel(name: string, pct: number, sumEok: number, widthPx: number): { text: string; fontSize: number } {
  if (widthPx >= 220) {
    return { text: `${name} ${pct}% (+${sumEok.toLocaleString()}억)`, fontSize: 23 };
  }
  if (widthPx >= 110) {
    return { text: `${name} ${pct}%`, fontSize: 21 };
  }
  if (widthPx >= 48) {
    return { text: `${pct}%`, fontSize: 22 };
  }
  return { text: '', fontSize: 0 };
}

const coreLabel = formatBarSegmentLabel("시장대표", corePct, coreInflow, coreW);
const growthLabel = formatBarSegmentLabel("공격성장", growthPct, growthInflow, growthW);
const defLabel = formatBarSegmentLabel("방어", defensivePct, defensiveInflow, defW);

const svg = `
<svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ETF 데일리 마켓 브리핑 - 오늘 시장 수급 나침반: 스마트머니 스타일 로테이션">
  <title>ETF 데일리 마켓 브리핑 - 6페이지</title>
  ${commonDefs}
  <rect width="1080" height="1350" fill="#F8FAFC"/>
  <circle cx="950" cy="180" r="300" fill="#059669" fill-opacity="0.035"/>
  <circle cx="100" cy="1150" r="260" fill="#3B82F6" fill-opacity="0.03"/>

  <!-- Header (y=40) -->
  <g transform="translate(70, 40)">
    <rect x="0" y="4" width="8" height="42" rx="4" fill="#10B981"/>
    <text x="22" y="38" fill="#047857" font-size="44" font-weight="900" letter-spacing="-0.8">오늘 시장 수급 나침반</text>
    <rect x="825" y="0" width="115" height="50" rx="15" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.8" filter="url(#cardShadow)"/>
    <text x="882.5" y="34" fill="#0F172A" font-size="24" font-weight="900" text-anchor="middle" class="tabular">6 / 6</text>
  </g>

  <!-- 1. Hero 3-Way Segment Bar Card (y=102, h=214) -->
  <g transform="translate(70, 102)" filter="url(#cardShadow)">
    <rect width="940" height="214" rx="24" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.8"/>
    
    <!-- Title row inside Hero: 스타일 로테이션 + 명시적 당일 순유입 TOP 10 뱃지 + 합산 금액 -->
    <text x="35" y="42" fill="#0F172A" font-size="26" font-weight="900">
      스마트머니 3대 스타일 로테이션
    </text>
    <rect x="425" y="16" width="180" height="40" rx="10" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
    <text x="515" y="42" fill="#475569" font-size="19" font-weight="900" text-anchor="middle">
      당일 순유입 TOP 10
    </text>
    <rect x="680" y="16" width="225" height="40" rx="10" fill="#ECFDF5" stroke="#A7F3D0" stroke-width="1.2"/>
    <text x="792.5" y="42" fill="#047857" font-size="21" font-weight="900" text-anchor="middle" class="tabular">
      TOP 10 합산 +${totalInflow.toLocaleString()}억
    </text>

    <!-- 3-Segment Stack Bar (y=66, w=870, h=60, rx=16) -->
    <g transform="translate(35, 66)">
      <clipPath id="heroBarClip">
        <rect width="870" height="60" rx="16"/>
      </clipPath>
      <g clip-path="url(#heroBarClip)">
        <rect x="0" y="0" width="${coreW}" height="60" fill="#10B981"/>
        <rect x="${coreW}" y="0" width="${growthW}" height="60" fill="#F43F5E"/>
        <rect x="${coreW + growthW}" y="0" width="${defW}" height="60" fill="#3B82F6"/>
      </g>
      
      <!-- Segment Text Labels inside Bar (Smart Threshold Labeling: Zero Overflow) -->
      ${coreLabel.text ? `<text x="${coreW / 2}" y="38" fill="#FFFFFF" font-size="${coreLabel.fontSize}" font-weight="900" text-anchor="middle">${coreLabel.text}</text>` : ''}
      ${growthLabel.text ? `<text x="${coreW + growthW / 2}" y="38" fill="#FFFFFF" font-size="${growthLabel.fontSize}" font-weight="900" text-anchor="middle">${growthLabel.text}</text>` : ''}
      ${defLabel.text ? `<text x="${coreW + growthW + defW / 2}" y="38" fill="#FFFFFF" font-size="${defLabel.fontSize}" font-weight="900" text-anchor="middle">${defLabel.text}</text>` : ''}
    </g>

    <!-- Hero Summary Fact Text (y=142, h=56) with clipPath -->
    <g transform="translate(35, 142)" clip-path="url(#heroSummaryClip)">
      <rect width="870" height="56" rx="14" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.2"/>
      <rect x="14" y="10" width="95" height="36" rx="8" fill="#DCFCE7"/>
      <text x="61.5" y="34" fill="#15803D" font-size="19" font-weight="900" text-anchor="middle">핵심 요약</text>
      <text x="125" y="35" fill="#1E293B" font-size="${fittedHeroSummary.fontSize}" font-weight="800">
        ${escapeXml(fittedHeroSummary.text)}
      </text>
    </g>
  </g>

  <!-- 2. Detailed Style Cards (y=334, step=294, h=276) -->
  ${renderStyleCardTemplate(cardsData[0], 334)}
  ${renderStyleCardTemplate(cardsData[1], 628)}
  ${renderStyleCardTemplate(cardsData[2], 922)}

  <!-- Common Disclaimer & Watermark (KRX Notice Box Completely Purged) -->
  ${commonFooter}
</svg>
`;

async function run() {
  const outSvgPath = path.join(artifactDir, 'slide_06_preview_v7.svg');
  const outPngPath = path.join(artifactDir, 'slide_06_preview_v7.png');
  fs.writeFileSync(outSvgPath, svg, 'utf-8');
  console.log('Saved SVG to:', outSvgPath);

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const launchOptions: any = {
    headless: true,
    executablePath: fs.existsSync(chromePath) ? chromePath : undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=none'
    ]
  };

  try {
    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 2 });
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" as="style" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: 1080px; height: 1350px; overflow: hidden; background: #F8FAFC; }
    svg { width: 1080px; height: 1350px; display: block; }
  </style>
</head>
<body>
${svg}
</body>
</html>`;
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.evaluateHandle('document.fonts.ready');
    await page.screenshot({ path: outPngPath, type: 'png', omitBackground: false });
    await browser.close();
    console.log('Rendered Chromium 2x Retina PNG to:', outPngPath);
  } catch (err) {
    console.warn('Chromium launch failed, falling back to sharp:', err);
    await sharp(Buffer.from(svg))
      .resize(1080, 1350)
      .png()
      .toFile(outPngPath);
    console.log('Rendered Sharp PNG to:', outPngPath);
  }
}

run().catch(console.error);
