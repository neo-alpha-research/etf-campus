import type { MarketBriefingPayload } from "../types";
import { classifyMarketRegime, type MarketRegime } from "../services/market-regime";
import type { PolishedNarrative } from "../services/gemini";

export interface InstagramSlide {
  slideNumber: number;
  title: string;
  subtitle: string;
  svgContent: string;
}

function escapeXml(unsafe?: string): string {
  if (!unsafe) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDateWithDay(dateStr?: string): string {
  if (!dateStr) return "2026.09.04 · 금요일";
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const days = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
  const dayName = days[date.getDay()] || "금요일";
  return `${dateStr.replace(/-/g, ".")} · ${dayName}`;
}

export function splitSubheadline(text?: string): string[] {
  if (!text) return [""];
  const trimmed = text.trim();
  if (trimmed.length <= 26) return [trimmed];

  const keywords = [" 속 ", " 가운데 ", " 대비 ", " vs ", " 함께 ", " 및 "];
  for (const kw of keywords) {
    if (trimmed.includes(kw)) {
      const idx = trimmed.indexOf(kw) + kw.trimEnd().length;
      const part1 = trimmed.slice(0, idx).trim();
      const part2 = trimmed.slice(idx).trim();
      if (part1.length <= 32 && part2.length <= 38) {
        return [part1, part2];
      }
    }
  }

  const spaceIdx = trimmed.slice(0, 28).lastIndexOf(" ");
  if (spaceIdx > 12) {
    return [trimmed.slice(0, spaceIdx).trim(), trimmed.slice(spaceIdx).trim()];
  }

  return [trimmed.slice(0, 25), trimmed.slice(25)];
}

export function cleanEtfNameForBanner(name?: string, maxChars: number = 15): string {
  if (!name) return "대표 ETF";
  let clean = name.replace(/\s*\([^)]*\)/g, '').trim();
  if (clean.length > maxChars) {
    clean = clean.slice(0, maxChars - 1) + "…";
  }
  return clean;
}

export function calcBannerFontSize(text: string, maxWidthPx: number = 720, baseFs: number = 28): number {
  let estWidth = 0;
  for (const char of text) {
    estWidth += char.charCodeAt(0) > 128 ? baseFs * 0.95 : baseFs * 0.55;
  }
  if (estWidth <= maxWidthPx) return baseFs;
  const scale = maxWidthPx / estWidth;
  return Math.max(20, Math.floor(baseFs * scale));
}

export function generateInstagramCarousel(
  payload: MarketBriefingPayload,
  baseUrl: string,
  narrative?: PolishedNarrative | MarketRegime
): InstagramSlide[] {
  const regime = narrative || classifyMarketRegime(payload);
  const dateStr = payload.asOfDate || "2026-09-04";
  const formattedDate = formatDateWithDay(dateStr);

  const kospi = payload.kospiChangePct ?? 1.64;
  const kosdaq = payload.kosdaqChangePct ?? 2.95;
  const etfReturn = payload.generalAumWeightedReturnPct ?? 1.33;
  const kospiSign = kospi > 0 ? "+" : "";
  const kosdaqSign = kosdaq > 0 ? "+" : "";
  const etfSign = etfReturn > 0 ? "+" : "";
  const kospiColor = kospi >= 0 ? "#D92D20" : "#175CD3";
  const kosdaqColor = kosdaq >= 0 ? "#D92D20" : "#175CD3";
  const etfColor = etfReturn >= 0 ? "#D92D20" : "#175CD3";

  const up = payload.upCount ?? 794;
  const down = payload.downCount ?? 181;
  const flat = payload.flatCount ?? 50;
  const generalCount = payload.generalEtfCount ?? 1025;

  // Peer Groups (상위/하위 랭킹 SSOT)
  const sortedPeerGroups = [...(payload.peerGroups || [])].sort((a, b) => (b.cappedAumWeightedReturnPct ?? 0) - (a.cappedAumWeightedReturnPct ?? 0));
  const topTheme = sortedPeerGroups[0] || { peerGroup: "주요 섹터", cappedAumWeightedReturnPct: 0, etfCount: 0, assetClass: "국내주식" };
  const bottomTheme = sortedPeerGroups[sortedPeerGroups.length - 1] || topTheme;
  const themeGap = Math.abs((topTheme.cappedAumWeightedReturnPct ?? 0) - (bottomTheme.cappedAumWeightedReturnPct ?? 0)).toFixed(2);

  const winners = sortedPeerGroups.slice(0, 3);
  const losers = [...sortedPeerGroups].reverse().slice(0, 3);

  // Inflows
  const topInflows = payload.periodicFlows?.dailyFundFlows?.topInflows || [];
  const topInflow = topInflows[0] || { name: "데이터 수집 중", ticker: "-", inflow: 0, theme: "미분류" };
  const top5InflowSum = topInflows.slice(0, 5).reduce((sum, item) => sum + (item.inflow || 0), 0);
  const secondInflow = topInflows[1];
  const cleanInflowBannerName = cleanEtfNameForBanner(topInflow.name, 18);
  const cleanInflow2Name = secondInflow ? cleanEtfNameForBanner(secondInflow.name, 22) : "";

  // Asset classes
  const assetClasses = (payload.assetClasses && payload.assetClasses.length > 0) ? payload.assetClasses : [];

  // Disparity data for Slide 5
  const disparityList = payload.disparityWarning || [];
  const premiums = [...disparityList].filter(d => (d.disparityPct ?? 0) > 0).sort((a, b) => (b.disparityPct ?? 0) - (a.disparityPct ?? 0)).slice(0, 2);
  const discounts = [...disparityList].filter(d => (d.disparityPct ?? 0) < 0).sort((a, b) => (a.disparityPct ?? 0) - (b.disparityPct ?? 0)).slice(0, 2);

  // Standard 6-slide carousel
  const totalSlides = 6;

  // Common SVG Defs
  const commonDefs = `
    <defs>
      <filter id="softShadow" x="-10%" y="-10%" width="120%" height="125%">
        <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#0F172A" flood-opacity="0.06"/>
      </filter>
      <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="125%">
        <feDropShadow dx="0" dy="4" stdDeviation="10" flood-color="#0F172A" flood-opacity="0.04"/>
      </filter>
      <linearGradient id="midnightNavyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#334155"/>
        <stop offset="100%" stop-color="#475569"/>
      </linearGradient>
      <linearGradient id="goldButtonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FEF9C3"/>
        <stop offset="100%" stop-color="#FEF08A"/>
      </linearGradient>
      <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="6" stdDeviation="12" flood-color="#FEF08A" flood-opacity="0.2"/>
      </filter>
      <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#10B981"/>
        <stop offset="100%" stop-color="#047857"/>
      </linearGradient>
      <linearGradient id="heroSoftGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#F0FDF4"/>
        <stop offset="100%" stop-color="#DCFCE7"/>
      </linearGradient>
      <linearGradient id="blueBadgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#EFF6FF"/>
        <stop offset="100%" stop-color="#DBEAFE"/>
      </linearGradient>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Pretendard:wght@400;500;600;700;800;900&amp;display=swap');
        * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'Segoe UI', Roboto, sans-serif; }
        .tabular { font-variant-numeric: tabular-nums; letter-spacing: -0.5px; }
      </style>
    </defs>
  `;

  // Common pure text footer (Zero shaded box, crisp #047857 green text)
  const commonFooter = `
    <g transform="translate(540, 1255)">
      <text x="0" y="0" fill="#64748B" font-size="16.5" font-weight="600" text-anchor="middle">* 본 자료는 투자 판단을 돕기 위한 정보 제공용이며, 특정 종목의 매수·매도를 권유하지 않습니다.</text>
      <text x="0" y="38" fill="#047857" font-size="22" font-weight="900" text-anchor="middle" letter-spacing="0.5">ETF 캠퍼스 | https://etf-campus.pages.dev</text>
    </g>
  `;

  // =========================================================================
  // SLIDE 1: Cover & 3 Key Pulses (1 / 6)
  // =========================================================================
  const cleanTopThemeName = (topTheme.peerGroup || "주요 섹터").replace(/\s*\([^)]*\)/g, '').trim();
  const themeVerb = (topTheme.cappedAumWeightedReturnPct ?? 0) > 0 ? "주도" : "선방";

  const slide1Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ETF 데일리 마켓 브리핑 - 표지 및 핵심 펄스">
      <title>ETF 데일리 마켓 브리핑 - 1페이지</title>
      ${commonDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>
      <circle cx="950" cy="180" r="320" fill="#2E6819" fill-opacity="0.04"/>
      <circle cx="120" cy="1150" r="260" fill="#0284C7" fill-opacity="0.03"/>

      <!-- Header (y=48) -->
      <g transform="translate(70, 48)">
        <text x="0" y="34" fill="#0F172A" font-size="36" font-weight="900">ETF 데일리 마켓 브리핑</text>
        <rect x="710" y="0" width="230" height="46" rx="14" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5" filter="url(#cardShadow)"/>
        <text x="825" y="29" fill="#1E293B" font-size="18.5" font-weight="900" text-anchor="middle" class="tabular">${formattedDate}</text>
      </g>

      <!-- Main Hero Hook Card (y=122, h=185) -->
      <g transform="translate(70, 122)" filter="url(#softShadow)">
        <rect width="940" height="185" rx="24" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2"/>
        
        <!-- 헤드라인 1: 빅 넘버 대비 (48px 대형 볼드) -->
        <text x="35" y="72" fill="#0F172A" font-size="48" font-weight="900" letter-spacing="-1.2">
          코스피 <tspan fill="${kospiColor}">${kospiSign}${kospi.toFixed(2)}%</tspan> <tspan fill="#94A3B8" font-weight="600">vs</tspan> 일반 ETF <tspan fill="${etfColor}">${etfSign}${etfReturn.toFixed(2)}%</tspan>
        </text>

        <!-- 헤드라인 2: 테마 & 수급 녹색 핵심 설명 한 줄 (31px 볼드) -->
        <text x="35" y="136" fill="#047857" font-size="31" font-weight="900" letter-spacing="-0.6">
          &apos;${escapeXml(cleanTopThemeName)}&apos; ${themeVerb} 속 &apos;${escapeXml(cleanInflowBannerName)}&apos; 수급 집중
        </text>
      </g>

      <!-- Pulse 1: Market Temperature (y=327, h=230) -->
      <g transform="translate(70, 327)" filter="url(#cardShadow)">
        <rect width="940" height="230" rx="24" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.6"/>
        <text x="35" y="46" fill="#1E293B" font-size="24" font-weight="900">1. 시장 체온 &amp; 3대 지수 비교</text>
        
        <rect x="590" y="18" width="315" height="42" rx="12" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.2"/>
        <text x="747" y="46" font-size="19" font-weight="900" text-anchor="middle">
          <tspan fill="#D92D20">상승 ${up}</tspan><tspan fill="#94A3B8"> · </tspan><tspan fill="#64748B">보합 ${flat}</tspan><tspan fill="#94A3B8"> · </tspan><tspan fill="#175CD3">하락 ${down}</tspan>
        </text>

        <g transform="translate(35, 84)">
          <!-- KOSPI -->
          <rect x="0" y="0" width="278" height="112" rx="16" fill="${kospi >= 0 ? '#FEF2F2' : '#EFF6FF'}" stroke="${kospi >= 0 ? '#FECACA' : '#BFDBFE'}" stroke-width="1.2"/>
          <text x="22" y="66" fill="${kospi >= 0 ? '#991B1B' : '#1E40AF'}" font-size="22" font-weight="800">KOSPI</text>
          <text x="256" y="69" fill="${kospiColor}" font-size="40" font-weight="900" text-anchor="end" class="tabular">${kospiSign}${kospi.toFixed(2)}%</text>

          <!-- KOSDAQ -->
          <rect x="296" y="0" width="278" height="112" rx="16" fill="${kosdaq >= 0 ? '#FEF2F2' : '#EFF6FF'}" stroke="${kosdaq >= 0 ? '#FECACA' : '#BFDBFE'}" stroke-width="1.2"/>
          <text x="318" y="66" fill="${kosdaq >= 0 ? '#991B1B' : '#1E40AF'}" font-size="22" font-weight="800">KOSDAQ</text>
          <text x="552" y="69" fill="${kosdaqColor}" font-size="40" font-weight="900" text-anchor="end" class="tabular">${kosdaqSign}${kosdaq.toFixed(2)}%</text>

          <!-- 일반 ETF -->
          <rect x="592" y="0" width="278" height="112" rx="16" fill="#F0FDF4" stroke="#BBF7D0" stroke-width="1.5"/>
          <text x="614" y="66" fill="#15803D" font-size="22" font-weight="900">일반 ETF</text>
          <text x="848" y="69" fill="${etfColor}" font-size="40" font-weight="900" text-anchor="end" class="tabular">${etfSign}${etfReturn.toFixed(2)}%</text>
        </g>
      </g>

      <!-- Pulse 2: Long/Short Themes (y=577, h=230) -->
      <g transform="translate(70, 577)" filter="url(#cardShadow)">
        <rect width="940" height="230" rx="24" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.6"/>
        <text x="35" y="46" fill="#0F172A" font-size="24" font-weight="900">2. 오늘의 극과 극 테마</text>
        
        <rect x="695" y="18" width="210" height="42" rx="12" fill="#FFF7ED" stroke="#FDBA74" stroke-width="1.2"/>
        <text x="800" y="45" fill="#C2410C" font-size="18" font-weight="900" text-anchor="middle">테마 격차 ${themeGap}%p</text>

        <!-- Left: ▲ 상위 1위 카드 -->
        <g transform="translate(35, 82)">
          <rect width="420" height="118" rx="18" fill="#FEF2F2" stroke="#FCA5A5" stroke-width="1.2"/>
          <text x="22" y="38" fill="#B42318" font-size="18" font-weight="900">▲ 상위 1위</text>
          <text x="22" y="80" fill="#0F172A" font-size="26" font-weight="900">${escapeXml(topTheme.peerGroup.replace(/\s*\([^)]*\)/g, '').trim())}</text>
          <text x="400" y="76" fill="#D92D20" font-size="40" font-weight="900" text-anchor="end" class="tabular">${(topTheme.cappedAumWeightedReturnPct ?? 0) > 0 ? "+" : ""}${(topTheme.cappedAumWeightedReturnPct ?? 0).toFixed(2)}%</text>
        </g>

        <!-- Right: ▼ 하위 1위 카드 -->
        <g transform="translate(485, 82)">
          <rect width="420" height="118" rx="18" fill="#EFF6FF" stroke="#93C5FD" stroke-width="1.2"/>
          <text x="22" y="38" fill="#175CD3" font-size="18" font-weight="900">▼ 하위 1위</text>
          <text x="22" y="80" fill="#0F172A" font-size="${bottomTheme.peerGroup.replace(/\s*\([^)]*\)/g, '').trim().length > 14 ? 20 : (bottomTheme.peerGroup.replace(/\s*\([^)]*\)/g, '').trim().length > 11 ? 23 : 26)}" font-weight="900">${escapeXml(bottomTheme.peerGroup.replace(/\s*\([^)]*\)/g, '').trim())}</text>
          <text x="400" y="76" fill="#175CD3" font-size="40" font-weight="900" text-anchor="end" class="tabular">${(bottomTheme.cappedAumWeightedReturnPct ?? 0) > 0 ? "+" : ""}${(bottomTheme.cappedAumWeightedReturnPct ?? 0).toFixed(2)}%</text>
        </g>
      </g>

      <!-- Pulse 3: Top Inflow (y=827, h=235) -->
      <g transform="translate(70, 827)" filter="url(#cardShadow)">
        <rect width="940" height="235" rx="24" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.6"/>
        <text x="35" y="46" fill="#1E293B" font-size="24" font-weight="900">3. 실질 자금 순유입 1위</text>
        
        <rect x="745" y="18" width="160" height="42" rx="12" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
        <text x="825" y="45" fill="#1E293B" font-size="17.5" font-weight="900" text-anchor="middle">기관·외국인 합산</text>

        <!-- Main Inflow Row -->
        <g transform="translate(35, 78)">
          <rect width="870" height="84" rx="18" fill="#F0FDF4" stroke="#BBF7D0" stroke-width="1.5"/>
          <circle cx="42" cy="42" r="21" fill="#10B981"/>
          <text x="42" y="49" fill="#FFFFFF" font-size="18" font-weight="900" text-anchor="middle">1</text>
          <text x="80" y="51" fill="#0F172A" font-size="27" font-weight="900">
            ${escapeXml(cleanInflowBannerName)} <tspan fill="#64748B" font-size="18" font-weight="700">· ${escapeXml(topInflow.ticker)}</tspan>
          </text>
          <text x="845" y="54" fill="#047857" font-size="42" font-weight="900" text-anchor="end" class="tabular">+${(topInflow.inflow ?? 0).toLocaleString()}억원</text>
        </g>

        <text x="35" y="198" fill="#334155" font-size="19.5" font-weight="800">
          상위 5종목 총 ${top5InflowSum.toLocaleString()}억원 순유입 · 상세 순위는 4페이지에서 확인
        </text>
      </g>

      <!-- Bottom Swipe CTA (y=1082, h=105) -->
      <g transform="translate(70, 1082)" filter="url(#softShadow)">
        <rect width="940" height="105" rx="24" fill="url(#brandGrad)"/>
        <text x="430" y="65" fill="#FFFFFF" font-size="26" font-weight="900" text-anchor="middle" letter-spacing="-0.5">
          👉 옆으로 넘겨 테마·수급·괴리율 상세 분석
        </text>
        <rect x="805" y="30" width="95" height="44" rx="14" fill="#064E3B"/>
        <text x="852" y="58" fill="#A7F3D0" font-size="18.5" font-weight="900" text-anchor="middle" class="tabular">1 / ${totalSlides}</text>
      </g>

      <!-- Disclaimer & Watermark (Zero shaded box) -->
      ${commonFooter}
    </svg>
  `;

  // =========================================================================
  // SLIDE 2: Theme Dynamics (2 / 6)
  // =========================================================================
  const slide2Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ETF 데일리 마켓 브리핑 - 주도 테마 TOP 3 vs 부진 테마">
      <title>ETF 데일리 마켓 브리핑 - 2페이지</title>
      ${commonDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>

      <!-- Header (y=48) -->
      <g transform="translate(70, 48)">
        <text x="0" y="34" fill="#0F172A" font-size="36" font-weight="900">오늘 시장 주도/부진 테마 TOP 3</text>
        <text x="0" y="64" fill="#64748B" font-size="17" font-weight="600">※ 테마별 AUM 가중수익률 기준 상위/하위 랭킹</text>
        <rect x="830" y="0" width="110" height="44" rx="14" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5"/>
        <text x="885" y="28" fill="#475569" font-size="18" font-weight="900" text-anchor="middle" class="tabular">2 / ${totalSlides}</text>
      </g>

      <!-- Summary Banner (y=128, h=125) -->
      <g transform="translate(70, 128)" filter="url(#cardShadow)">
        <rect width="940" height="125" rx="22" fill="#FFFBEB" stroke="#FDE68A" stroke-width="1.5"/>
        <rect x="30" y="20" width="135" height="36" rx="10" fill="#FEF3C7" stroke="#FCD34D" stroke-width="1.2"/>
        <text x="97" y="44" fill="#B45309" font-size="18" font-weight="900" text-anchor="middle">테마 핵심</text>
        <text x="180" y="47" fill="#0F172A" font-size="30" font-weight="900">&apos;${escapeXml(topTheme.peerGroup.replace(/\s*\([^)]*\)/g, '').trim())}&apos; ${(topTheme.cappedAumWeightedReturnPct ?? 0) > 0 ? "주도" : "선방"} vs &apos;${escapeXml(bottomTheme.peerGroup.replace(/\s*\([^)]*\)/g, '').trim())}&apos; 조정</text>
        <text x="30" y="96" fill="#334155" font-size="22" font-weight="700">
          테마 간 수익률 격차 <tspan fill="#B45309" font-weight="900">${themeGap}%p</tspan>로 주도 섹터와 소외 섹터의 뚜렷한 차별화
        </text>
      </g>

      <!-- Panel 1: Top 3 Leaders (▲ 상위 Top 3) (y=273, h=450) -->
      <g transform="translate(70, 273)" filter="url(#cardShadow)">
        <rect width="940" height="450" rx="24" fill="#FFFFFF" stroke="#FECDCA" stroke-width="1.5"/>
        <rect x="0" y="0" width="940" height="54" rx="24" fill="#FEF3F2"/>
        <text x="35" y="36" fill="#B42318" font-size="23" font-weight="900">▲ 상위 Top 3 주도 테마</text>

        ${winners.map((w, idx) => {
          const cleanName = w.peerGroup.replace(/\s*\([^)]*\)/g, '').trim();
          const nameFs = cleanName.length > 14 ? 24 : (cleanName.length > 11 ? 26 : 28);
          const ret = w.cappedAumWeightedReturnPct ?? 0;
          const retSign = ret > 0 ? "▲ +" : ret < 0 ? "▼ " : "";
          const retColor = ret >= 0 ? "#D92D20" : "#175CD3";
          return `
          <g transform="translate(35, ${72 + idx * 124})">
            <rect width="870" height="112" rx="20" fill="#FAFDF4" stroke="#D7EABB" stroke-width="1.5"/>
            <circle cx="48" cy="56" r="24" fill="${idx === 0 ? '#D92D20' : '#FEE4E2'}"/>
            <text x="48" y="64" fill="${idx === 0 ? '#FFFFFF' : '#D92D20'}" font-size="21" font-weight="900" text-anchor="middle">${idx + 1}</text>
            <text x="92" y="48" fill="#0F172A" font-size="${nameFs}" font-weight="900">${escapeXml(cleanName)}</text>
            <text x="92" y="84" fill="#64748B" font-size="18" font-weight="700">총 ${w.etfCount}개 ETF 구성 · 자산군: ${escapeXml(w.assetClass || "국내주식")}</text>
            <text x="840" y="66" fill="${retColor}" font-size="42" font-weight="900" text-anchor="end" class="tabular">${retSign}${ret.toFixed(2)}%</text>
          </g>
        `;}).join("")}
      </g>

      <!-- Panel 2: Bottom 3 Laggards (▼ 하위 Worst 3) (y=743, h=450) -->
      <g transform="translate(70, 743)" filter="url(#cardShadow)">
        <rect width="940" height="450" rx="24" fill="#FFFFFF" stroke="#BFDBFE" stroke-width="1.5"/>
        <rect x="0" y="0" width="940" height="54" rx="24" fill="#EFF6FF"/>
        <text x="35" y="36" fill="#1D4ED8" font-size="23" font-weight="900">▼ 하위 Worst 3 부진 테마</text>

        ${losers.map((l, idx) => {
          const cleanName = l.peerGroup.replace(/\s*\([^)]*\)/g, '').trim();
          const nameFs = cleanName.length > 14 ? 24 : (cleanName.length > 11 ? 26 : 28);
          const ret = l.cappedAumWeightedReturnPct ?? 0;
          const retSign = ret > 0 ? "▲ +" : ret < 0 ? "▼ " : "";
          const retColor = ret >= 0 ? "#D92D20" : "#175CD3";
          return `
          <g transform="translate(35, ${72 + idx * 124})">
            <rect width="870" height="112" rx="20" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5"/>
            <circle cx="48" cy="56" r="24" fill="${idx === 0 ? '#175CD3' : '#DBEAFE'}"/>
            <text x="48" y="64" fill="${idx === 0 ? '#FFFFFF' : '#175CD3'}" font-size="21" font-weight="900" text-anchor="middle">${idx + 1}</text>
            <text x="92" y="48" fill="#0F172A" font-size="${nameFs}" font-weight="900">${escapeXml(cleanName)}</text>
            <text x="92" y="84" fill="#64748B" font-size="18" font-weight="700">총 ${l.etfCount}개 ETF 구성 · 자산군: ${escapeXml(l.assetClass || "해외주식")}</text>
            <text x="840" y="66" fill="${retColor}" font-size="42" font-weight="900" text-anchor="end" class="tabular">${retSign}${ret.toFixed(2)}%</text>
          </g>
        `;}).join("")}
      </g>

      <!-- Disclaimer & Watermark (Zero shaded box) -->
      ${commonFooter}
    </svg>
  `;

  // =========================================================================
  // SLIDE 3: Asset Class Dynamics (3 / 6)
  // =========================================================================
  const domesticStock = assetClasses.find(a => a.assetClass?.includes("국내") || a.assetClass?.includes("주식-국내"));
  const domRet = domesticStock?.aumWeightedReturnPct ?? -0.12;
  const domShare = domesticStock?.aumSharePct ?? 46.1;
  const domSign = domRet > 0 ? "+" : "";

  const sortedByRet = [...assetClasses].sort((a, b) => (b.aumWeightedReturnPct ?? 0) - (a.aumWeightedReturnPct ?? 0));
  const topAsset = sortedByRet[0] || { assetClass: "해외주식", aumWeightedReturnPct: 0.09 };
  const botAsset = sortedByRet[sortedByRet.length - 1] || { assetClass: "리츠·인프라", aumWeightedReturnPct: -0.72 };
  const isDomTop = topAsset.assetClass?.includes("국내") || topAsset.assetClass?.includes("주식-국내");
  const secondAsset = sortedByRet.find(a => !a.assetClass?.includes("국내")) || botAsset;
  const secondSign = (secondAsset.aumWeightedReturnPct ?? 0) > 0 ? "+" : "";

  const domStatusStr = domRet > 0.5 ? "상승 견인" : domRet >= -0.5 ? "보합 혼조" : "조정 숨고르기";
  const assetLeadStr = !isDomTop && (topAsset.aumWeightedReturnPct ?? 0) > 0
    ? `, ${escapeXml(topAsset.assetClass)} +${(topAsset.aumWeightedReturnPct ?? 0).toFixed(2)}% 분산 기여`
    : ((secondAsset.aumWeightedReturnPct ?? 0) > 0 
        ? `, ${escapeXml(secondAsset.assetClass)} ${secondSign}${(secondAsset.aumWeightedReturnPct ?? 0).toFixed(2)}% 분산 기여`
        : `, 일반 ETF 평균 ${etfSign}${(etfReturn ?? 0).toFixed(2)}% 기록`);

  const slide3Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ETF 데일리 마켓 브리핑 - 자산군별 성과 및 분산 기여도">
      <title>ETF 데일리 마켓 브리핑 - 3페이지</title>
      ${commonDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>

      <!-- Header (y=48) -->
      <g transform="translate(70, 48)">
        <text x="0" y="34" fill="#0F172A" font-size="36" font-weight="900">자산군별 수익률/기여도</text>
        <text x="0" y="64" fill="#64748B" font-size="17" font-weight="600">※ 자산군별 당일 가중수익률, 순자산 비중 및 시장 기여도 현황입니다.</text>
        <rect x="830" y="0" width="110" height="44" rx="14" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5"/>
        <text x="885" y="28" fill="#475569" font-size="18" font-weight="900" text-anchor="middle" class="tabular">3 / ${totalSlides}</text>
      </g>

      <!-- Summary Box (y=128, h=125) -->
      <g transform="translate(70, 128)" filter="url(#cardShadow)">
        <rect width="940" height="125" rx="22" fill="#F0FDF4" stroke="#BBF7D0" stroke-width="1.5"/>
        <rect x="30" y="20" width="145" height="36" rx="10" fill="#DCFCE7" stroke="#86EFAC" stroke-width="1.2"/>
        <text x="102" y="44" fill="#15803D" font-size="18" font-weight="900" text-anchor="middle">자산군 핵심</text>
        <text x="190" y="47" fill="#0F172A" font-size="30" font-weight="900">&apos;${escapeXml(topAsset.assetClass)}&apos; 상승 속 &apos;${escapeXml(botAsset.assetClass)}&apos; 조정</text>
        <text x="30" y="96" fill="#334155" font-size="22" font-weight="700">
          최대 비중 ${(domShare ?? 0).toFixed(1)}%의 국내주식은 <tspan fill="${domRet >= 0 ? '#15803D' : '#175CD3'}" font-weight="900">${domSign}${(domRet ?? 0).toFixed(2)}% ${domStatusStr}</tspan>${assetLeadStr}
        </text>
      </g>

      <!-- 6 Asset Classes List (y=273, step=152, h=138) -->
      <g transform="translate(70, 273)">
        ${assetClasses.slice(0, 6).map((ac, idx) => {
          const rawAum = ac.totalAum || 0;
          const aumEok = rawAum > 100_000_000_000 ? rawAum / 100_000_000 : rawAum;
          const aumJo = (aumEok / 10000).toFixed(1);
          const ret = ac.aumWeightedReturnPct ?? 0;
          const retSign = ret > 0 ? "▲ +" : ret < 0 ? "▼ " : "";
          const retColor = ret >= 0 ? "#D92D20" : "#175CD3";
          const share = ac.aumSharePct ?? 0;
          const contribution = ((share * ret) / 100).toFixed(2);
          const contribSign = Number(contribution) > 0 ? "+" : "";

          return `
            <g transform="translate(0, ${idx * 152})" filter="url(#cardShadow)">
              <rect width="940" height="138" rx="22" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
              <text x="35" y="48" fill="#0F172A" font-size="32" font-weight="900">${escapeXml(ac.assetClass)}</text>
              <text x="35" y="86" fill="#334155" font-size="21" font-weight="700">
                순자산 <tspan font-weight="900" fill="#0F172A">${aumJo}조원</tspan> · 비중 <tspan font-weight="900" fill="#2E6819">${share.toFixed(1)}%</tspan>
              </text>
              
              <rect x="35" y="106" width="380" height="12" rx="6" fill="#F1F5F9"/>
              <rect x="35" y="106" width="${Math.min(380, share * 3.8)}" height="12" rx="6" fill="#2E6819"/>
              
              <rect x="490" y="14" width="415" height="110" rx="16" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1"/>
              <text x="515" y="50" fill="#475569" font-size="20" font-weight="800">당일 가중수익률</text>
              <text x="880" y="52" fill="${retColor}" font-size="42" font-weight="900" text-anchor="end" class="tabular">${retSign}${ret.toFixed(2)}%</text>
              
              <text x="515" y="92" fill="#64748B" font-size="18" font-weight="700">시장 기여도</text>
              <text x="880" y="94" fill="${retColor}" font-size="22" font-weight="900" text-anchor="end" class="tabular">${contribSign}${contribution}%p</text>
            </g>
          `;
        }).join("")}
      </g>

      <!-- Disclaimer & Watermark (Zero shaded box) -->
      ${commonFooter}
    </svg>
  `;

  // =========================================================================
  // SLIDE 4: Smart Money Flow (4 / 6)
  // =========================================================================
  const slide4BannerTitle = regime.slide4BannerTitle || (secondInflow
    ? `스마트머니, &apos;${escapeXml(cleanInflowBannerName)}&apos; 및 &apos;${escapeXml(cleanInflow2Name)}&apos; 집중 순유입`
    : `스마트머니, &apos;${escapeXml(cleanInflowBannerName)}&apos; 등 상위 종목 집중 순유입`);
  const slide4BannerDesc = regime.slide4BannerDesc || `시장 흐름 속에서 상위 5종목으로 총 ${top5InflowSum.toLocaleString()}억원 실질 자금 순유입`;
  const slide4TitleFs = calcBannerFontSize(slide4BannerTitle, 720, 28);
  const slide4DescFs = calcBannerFontSize(slide4BannerDesc, 870, 20.5);

  const slide4Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ETF 데일리 마켓 브리핑 - 스마트머니 실질 순유입 TOP 5">
      <title>ETF 데일리 마켓 브리핑 - 4페이지</title>
      ${commonDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>
      <circle cx="950" cy="180" r="300" fill="#D92D20" fill-opacity="0.035"/>
      <circle cx="100" cy="1150" r="260" fill="#BE123C" fill-opacity="0.03"/>

      <!-- Header (y=48) -->
      <g transform="translate(70, 48)">
        <text x="0" y="34" fill="#0F172A" font-size="38" font-weight="900">실질 자금 순유입 TOP 5</text>
        <text x="0" y="64" fill="#64748B" font-size="17" font-weight="600">※ 발행좌수 증감으로 산출된 기관·외국인의 실질 자금 순유입액</text>
        <rect x="830" y="0" width="110" height="44" rx="14" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5"/>
        <text x="885" y="28" fill="#475569" font-size="18" font-weight="900" text-anchor="middle" class="tabular">4 / ${totalSlides}</text>
      </g>

      <!-- Summary Banner (y=128, h=120) -->
      <g transform="translate(70, 128)" filter="url(#cardShadow)">
        <rect width="940" height="120" rx="22" fill="#FFF1F2" stroke="#FECDD3" stroke-width="1.5"/>
        <rect x="30" y="18" width="135" height="36" rx="10" fill="#FFE4E6" stroke="#FDA4AF" stroke-width="1.2"/>
        <text x="97" y="42" fill="#BE123C" font-size="18" font-weight="900" text-anchor="middle">수급 핵심</text>
        <text x="180" y="44" fill="#0F172A" font-size="${slide4TitleFs}" font-weight="900">${slide4BannerTitle}</text>
        <text x="30" y="94" fill="#334155" font-size="${slide4DescFs}" font-weight="700">
          ${escapeXml(slide4BannerDesc)}
        </text>
      </g>

      <!-- TOP 5 Inflow Ranking Cards (y=268, step=184, h=170) -->
      <g transform="translate(70, 268)">
        ${topInflows.slice(0, 5).map((item, idx) => {
          const inflowJo = item.inflow ? item.inflow.toLocaleString() : "1,000";
          const isTop = idx === 0;
          return `
            <g transform="translate(0, ${idx * 184})" filter="url(#cardShadow)">
              <rect width="940" height="170" rx="24" fill="${isTop ? '#FFF8F8' : '#FFFFFF'}" stroke="${isTop ? '#FCA5A5' : '#E2E8F0'}" stroke-width="${isTop ? '2' : '1.5'}"/>
              ${isTop ? '<rect x="0" y="0" width="8" height="170" rx="4" fill="#D92D20"/>' : ''}

              <!-- 순위 뱃지 -->
              <circle cx="58" cy="85" r="28" fill="${isTop ? '#D92D20' : '#F1F5F9'}" ${!isTop ? 'stroke="#CBD5E1" stroke-width="1.5"' : ''}/>
              <text x="58" y="94" fill="${isTop ? '#FFFFFF' : '#475569'}" font-size="24" font-weight="900" text-anchor="middle">${idx + 1}</text>

              <!-- ETF명 -->
              <text x="102" y="68" fill="#0F172A" font-size="${item.name.length > 22 ? 22 : (item.name.length > 18 ? 25 : 28)}" font-weight="900">${escapeXml(item.name)}</text>

              <!-- 티커 -->
              <rect x="102" y="86" width="86" height="30" rx="7" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1"/>
              <text x="145" y="107" fill="#475569" font-size="16.5" font-weight="800" text-anchor="middle" class="tabular">${item.ticker}</text>

              <!-- 테마 태그 -->
              <rect x="198" y="86" width="135" height="30" rx="7" fill="${isTop ? '#FFE4E6' : '#F8FAFC'}" stroke="${isTop ? '#FDA4AF' : '#E2E8F0'}" stroke-width="1"/>
              <text x="265" y="107" fill="${isTop ? '#BE123C' : '#64748B'}" font-size="16.5" font-weight="800" text-anchor="middle">${escapeXml(item.theme || "핵심ETF")}</text>

              <!-- 순유입 금액 -->
              <text x="910" y="78" fill="${isTop ? '#D92D20' : '#1E293B'}" font-size="44" font-weight="900" text-anchor="end" class="tabular">+${inflowJo}<tspan font-size="24" font-weight="700" fill="${isTop ? '#BE123C' : '#64748B'}">억원</tspan></text>
              <text x="910" y="112" fill="${isTop ? '#E11D48' : '#64748B'}" font-size="17.5" font-weight="800" text-anchor="end">${isTop ? '당일 최대 실질 순유입' : '순유입 상위 종목'}</text>
            </g>
          `;
        }).join("")}
      </g>

      <!-- Disclaimer & Watermark (Zero shaded box) -->
      ${commonFooter}
    </svg>
  `;

  // =========================================================================
  // SLIDE 5: Disparity Alert (5 / 6)
  // =========================================================================
  const hasPremiums = premiums.length > 0;
  const hasDiscounts = discounts.length > 0;

  const premiumRowsCount = hasPremiums ? premiums.length : 1;
  const premiumRowsHeight = 44 + premiumRowsCount * 148;
  const discountSectionY = 258 + premiumRowsHeight + 16;
  const discountRowsCount = hasDiscounts ? discounts.length : 1;
  const discountRowsHeight = 44 + discountRowsCount * 148;
  const guideBoxY = discountSectionY + discountRowsHeight + 20;
  const guideBoxH = Math.max(160, 1205 - guideBoxY);

  const slide5Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ETF 데일리 마켓 브리핑 - 괴리율 고평가·할증 vs 저평가·할인 진단">
      <title>ETF 데일리 마켓 브리핑 - 5페이지</title>
      ${commonDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>
      <circle cx="950" cy="180" r="300" fill="#EAB308" fill-opacity="0.04"/>
      <circle cx="100" cy="1150" r="260" fill="#F59E0B" fill-opacity="0.035"/>

      <!-- Header (y=48) -->
      <g transform="translate(70, 48)">
        <text x="0" y="34" fill="#0F172A" font-size="36" font-weight="900" letter-spacing="-0.8">괴리율 고평가·할증 vs 저평가·할인 진단</text>
        <text x="0" y="64" fill="#64748B" font-size="17" font-weight="600">※ 순자산가치 NAV 대비 시장 종가의 가격 왜곡 정도를 진단합니다.</text>
        <rect x="830" y="0" width="110" height="44" rx="14" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5"/>
        <text x="885" y="28" fill="#475569" font-size="18" font-weight="900" text-anchor="middle" class="tabular">5 / ${totalSlides}</text>
      </g>

      <!-- Alert Banner (y=128, h=110) -->
      <g transform="translate(70, 128)" filter="url(#cardShadow)">
        <rect width="940" height="110" rx="22" fill="#FFFBEB" stroke="#FDE68A" stroke-width="1.6"/>
        <rect x="30" y="18" width="135" height="36" rx="10" fill="#FEF3C7" stroke="#FCD34D" stroke-width="1.2"/>
        <text x="97" y="42" fill="#B45309" font-size="18" font-weight="900" text-anchor="middle">괴리율 진단</text>
        <text x="180" y="44" fill="#0F172A" font-size="28" font-weight="900">NAV 대비 고평가 vs 저평가 왜곡 점검</text>
        <text x="30" y="88" fill="#475569" font-size="20" font-weight="700">
          장 시작 및 마감 시점의 호가 공백과 해외 시차로 인한 가격 왜곡을 점검합니다.
        </text>
      </g>

      <!-- SECTION 1: NAV 대비 고평가 · 할증 주의 (y=258) -->
      <g transform="translate(70, 258)">
        <text x="5" y="26" fill="#991B1B" font-size="24" font-weight="900">NAV 대비 고평가 · 할증 주의</text>
        <rect x="310" y="4" width="270" height="32" rx="8" fill="#FEE2E2" stroke="#FECACA" stroke-width="1.2"/>
        <text x="445" y="26" fill="#DC2626" font-size="16" font-weight="800" text-anchor="middle">시장가 &gt; 가치 · 고점 매수 유의</text>

        ${hasPremiums ? premiums.map((d: any, idx: number) => {
          const isTop = idx === 0;
          return `
            <g transform="translate(0, ${44 + idx * 148})" filter="url(#cardShadow)">
              <rect width="940" height="136" rx="22" fill="${isTop ? '#FFF8F8' : '#FFFFFF'}" stroke="${isTop ? '#FCA5A5' : '#E2E8F0'}" stroke-width="${isTop ? '2' : '1.5'}"/>
              ${isTop ? '<rect x="0" y="0" width="8" height="136" rx="4" fill="#D92D20"/>' : ''}
              <circle cx="58" cy="68" r="26" fill="${isTop ? '#D92D20' : '#FEE2E2'}"/>
              <text x="58" y="77" fill="${isTop ? '#FFFFFF' : '#991B1B'}" font-size="22" font-weight="900" text-anchor="middle">${idx + 1}</text>
              <text x="102" y="54" fill="#0F172A" font-size="27" font-weight="900">${escapeXml(cleanEtfNameForBanner(d.etfName, 22))}</text>
              <rect x="102" y="74" width="90" height="30" rx="7" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1"/>
              <text x="147" y="95" fill="#475569" font-size="16" font-weight="800" text-anchor="middle" class="tabular">${d.ticker}</text>
              <rect x="202" y="74" width="135" height="30" rx="7" fill="#FEE2E2" stroke="#FDA4AF" stroke-width="1"/>
              <text x="269" y="95" fill="#BE123C" font-size="16" font-weight="800" text-anchor="middle">고평가 · 할증</text>
              <text x="910" y="66" fill="#D92D20" font-size="44" font-weight="900" text-anchor="end" class="tabular">+${(d.disparityPct ?? 0).toFixed(2)}%</text>
              <text x="910" y="100" fill="#BE123C" font-size="17.5" font-weight="800" text-anchor="end">NAV 대비 할증 거래 중</text>
            </g>
          `;
        }).join("") : `
          <g transform="translate(0, 44)" filter="url(#cardShadow)">
            <rect width="940" height="110" rx="20" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5"/>
            <text x="470" y="64" fill="#15803D" font-size="21" font-weight="800" text-anchor="middle">✔ 전 종목 NAV 대비 할증률 정상 범위 유지 (고평가 왜곡 종목 없음)</text>
          </g>
        `}
      </g>

      <!-- SECTION 2: NAV 대비 저평가 · 할인 체크 -->
      <g transform="translate(70, ${discountSectionY})">
        <text x="5" y="26" fill="#166534" font-size="24" font-weight="900">NAV 대비 저평가 · 할인 체크</text>
        <rect x="310" y="4" width="280" height="32" rx="8" fill="#DCFCE7" stroke="#BBF7D0" stroke-width="1.2"/>
        <text x="450" y="26" fill="#15803D" font-size="16" font-weight="800" text-anchor="middle">시장가 &lt; 가치 · LP 호가 복귀 확인</text>

        ${hasDiscounts ? discounts.map((d: any, idx: number) => {
          const isTop = idx === 0;
          return `
            <g transform="translate(0, ${44 + idx * 148})" filter="url(#cardShadow)">
              <rect width="940" height="136" rx="22" fill="${isTop ? '#F0FDF4' : '#FFFFFF'}" stroke="${isTop ? '#86EFAC' : '#E2E8F0'}" stroke-width="${isTop ? '2' : '1.5'}"/>
              ${isTop ? '<rect x="0" y="0" width="8" height="136" rx="4" fill="#059669"/>' : ''}
              <circle cx="58" cy="68" r="26" fill="${isTop ? '#059669' : '#DCFCE7'}"/>
              <text x="58" y="77" fill="${isTop ? '#FFFFFF' : '#166534'}" font-size="22" font-weight="900" text-anchor="middle">${idx + 1}</text>
              <text x="102" y="54" fill="#0F172A" font-size="27" font-weight="900">${escapeXml(cleanEtfNameForBanner(d.etfName, 22))}</text>
              <rect x="102" y="74" width="90" height="30" rx="7" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1"/>
              <text x="147" y="95" fill="#475569" font-size="16" font-weight="800" text-anchor="middle" class="tabular">${d.ticker}</text>
              <rect x="202" y="74" width="135" height="30" rx="7" fill="#DCFCE7" stroke="#86EFAC" stroke-width="1"/>
              <text x="269" y="95" fill="#15803D" font-size="16" font-weight="800" text-anchor="middle">저평가 · 할인</text>
              <text x="910" y="66" fill="#047857" font-size="44" font-weight="900" text-anchor="end" class="tabular">${(d.disparityPct ?? 0).toFixed(2)}%</text>
              <text x="910" y="100" fill="#15803D" font-size="17.5" font-weight="800" text-anchor="end">NAV 대비 할인 거래 중</text>
            </g>
          `;
        }).join("") : `
          <g transform="translate(0, 44)" filter="url(#cardShadow)">
            <rect width="940" height="110" rx="20" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5"/>
            <text x="470" y="64" fill="#15803D" font-size="21" font-weight="800" text-anchor="middle">✔ 전 종목 NAV 대비 할인율 정상 범위 유지 (저평가 왜곡 종목 없음)</text>
          </g>
        `}
      </g>

      <!-- 실전 투자 가이드 박스 (y=${guideBoxY}, h=${guideBoxH}) -->
      <g transform="translate(70, ${guideBoxY})" filter="url(#cardShadow)">
        <rect width="940" height="${guideBoxH}" rx="22" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.5"/>
        <text x="35" y="44" fill="#0F172A" font-size="23" font-weight="900">💡 실전 투자 가이드 — 괴리율 대응 및 체크포인트</text>
        <text x="35" y="90" fill="#334155" font-size="20.5" font-weight="700">
          • 해외 ETF 괴리율은 개장 직후 LP 호가가 제출되면서 대부분 정상 범위로 수렴합니다.
        </text>
        <text x="35" y="132" fill="#334155" font-size="20.5" font-weight="700">
          • 장 초반 무리한 시장가 매수·매도를 피하고 실시간 순자산가치(iNAV)를 반드시 확인하세요.
        </text>
        <text x="35" y="174" fill="#334155" font-size="20.5" font-weight="700">
          • 해외 시장 휴장 및 시차로 인한 가격 왜곡 시 종가 기준 괴리율이 일시 확대될 수 있습니다.
        </text>
        <text x="35" y="216" fill="#334155" font-size="20.5" font-weight="700">
          • 괴리율이 지속적으로 +3% 이상 유지되는 종목은 단기 고평가 추격 매수에 유의하세요.
        </text>
      </g>

      <!-- Disclaimer & Watermark (Zero shaded box) -->
      ${commonFooter}
    </svg>
  `;

  // =========================================================================
  // SLIDE 6: Summary & Action Strategy (6 / 6)
  // =========================================================================
  const rawTopTheme = (topTheme.peerGroup || "주도 테마").replace(/\s*\([^)]*\)/g, '').trim();
  const rawBotTheme = (bottomTheme.peerGroup || "소외 테마").replace(/\s*\([^)]*\)/g, '').trim();
  const cleanSlide6TopTheme = cleanEtfNameForBanner(rawTopTheme, 25);
  const cleanSlide6BotTheme = cleanEtfNameForBanner(rawBotTheme, 25);

  const slide6Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ETF 데일리 마켓 브리핑 - 오늘 시장 총정리 & 핵심 전략">
      <title>ETF 데일리 마켓 브리핑 - 6페이지</title>
      ${commonDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>
      <circle cx="950" cy="180" r="300" fill="#1E3A8A" fill-opacity="0.035"/>
      <circle cx="100" cy="1150" r="260" fill="#0D9488" fill-opacity="0.03"/>

      <!-- Header (y=48) -->
      <g transform="translate(70, 48)">
        <text x="0" y="34" fill="#1E3A8A" font-size="40" font-weight="900" letter-spacing="-1.0">오늘 시장 총정리 &amp; 핵심 전략</text>
        <text x="0" y="64" fill="#64748B" font-size="17" font-weight="600">※ 3대 핵심 축으로 요약하는 시장 진단과 실전 투자 대응 가이드</text>
        <rect x="830" y="0" width="110" height="44" rx="14" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5"/>
        <text x="885" y="28" fill="#475569" font-size="18" font-weight="900" text-anchor="middle" class="tabular">6 / ${totalSlides}</text>
      </g>

      <!-- 1. CARD 01: [시장 진단] (y=128, h=295) -->
      <g transform="translate(70, 128)" filter="url(#cardShadow)">
        <rect width="940" height="295" rx="24" fill="#FFFFFF" stroke="#BBF7D0" stroke-width="1.8"/>
        <rect x="0" y="0" width="8" height="295" rx="4" fill="#10B981"/>

        <!-- Header -->
        <rect x="35" y="24" width="150" height="44" rx="12" fill="#DCFCE7" stroke="#86EFAC" stroke-width="1.2"/>
        <text x="110" y="53" fill="#15803D" font-size="20" font-weight="900" text-anchor="middle">01 시장 진단</text>
        <text x="200" y="55" fill="#0F172A" font-size="27" font-weight="900">코스피 ${kospiSign}${kospi.toFixed(2)}% · 일반 ETF ${etfSign}${etfReturn.toFixed(2)}% 반등 랠리</text>

        <!-- Divider -->
        <line x1="35" y1="88" x2="905" y2="88" stroke="#F1F5F9" stroke-width="1.5"/>

        <!-- 1행: 핵심 팩트 (27px 대형 볼드) -->
        <text x="35" y="142" fill="#1E293B" font-size="27" font-weight="900">
          • 상승 종목 ${up}개 우위로 시장 매수 심리 전반 회복
        </text>

        <!-- 2행: 실전 대응 액션 밴드 (24px 볼드) -->
        <rect x="35" y="186" width="870" height="82" rx="16" fill="#F0FDF4" stroke="#BBF7D0" stroke-width="1.2"/>
        <rect x="52" y="205" width="100" height="44" rx="10" fill="#DCFCE7"/>
        <text x="102" y="233" fill="#15803D" font-size="18" font-weight="900" text-anchor="middle">대응 요약</text>
        <text x="168" y="234" fill="#166534" font-size="24" font-weight="800">대형주 및 핵심 성장 섹터 중심의 안정적 상방 탄력 유효</text>
      </g>

      <!-- 2. CARD 02: [테마 순환] (y=443, h=295) -->
      <g transform="translate(70, 443)" filter="url(#cardShadow)">
        <rect width="940" height="295" rx="24" fill="#FFFFFF" stroke="#FECDD3" stroke-width="1.8"/>
        <rect x="0" y="0" width="8" height="295" rx="4" fill="#F43F5E"/>

        <!-- Header -->
        <rect x="35" y="24" width="150" height="44" rx="12" fill="#FFE4E6" stroke="#FDA4AF" stroke-width="1.2"/>
        <text x="110" y="53" fill="#BE123C" font-size="20" font-weight="900" text-anchor="middle">02 테마 순환</text>
        <text x="200" y="55" fill="#0F172A" font-size="25" font-weight="900">&apos;${escapeXml(cleanSlide6TopTheme)}&apos; 독주 vs &apos;${escapeXml(cleanSlide6BotTheme)}&apos; 조정</text>

        <!-- Divider -->
        <line x1="35" y1="88" x2="905" y2="88" stroke="#F1F5F9" stroke-width="1.5"/>

        <!-- 1행: 핵심 팩트 (27px 대형 볼드) -->
        <text x="35" y="142" fill="#1E293B" font-size="27" font-weight="900">
          • 테마 간 수익률 격차 ${themeGap}%p로 극심한 차별화 장세
        </text>

        <!-- 2행: 실전 대응 액션 밴드 (24px 볼드) -->
        <rect x="35" y="186" width="870" height="82" rx="16" fill="#FFF1F2" stroke="#FECDD3" stroke-width="1.2"/>
        <rect x="52" y="205" width="100" height="44" rx="10" fill="#FFE4E6"/>
        <text x="102" y="233" fill="#BE123C" font-size="18" font-weight="900" text-anchor="middle">전략 요약</text>
        <text x="168" y="234" fill="#9F1239" font-size="24" font-weight="800">단기 급등 테마 무리한 추격 매수 자제 및 분할 익절·리밸런싱</text>
      </g>

      <!-- 3. CARD 03: [대응 전략] (y=758, h=295) -->
      <g transform="translate(70, 758)" filter="url(#cardShadow)">
        <rect width="940" height="295" rx="24" fill="#FFFFFF" stroke="#BFDBFE" stroke-width="1.8"/>
        <rect x="0" y="0" width="8" height="295" rx="4" fill="#3B82F6"/>

        <!-- Header -->
        <rect x="35" y="24" width="150" height="44" rx="12" fill="#DBEAFE" stroke="#93C5FD" stroke-width="1.2"/>
        <text x="110" y="53" fill="#1D4ED8" font-size="20" font-weight="900" text-anchor="middle">03 대응 전략</text>
        <text x="200" y="55" fill="#0F172A" font-size="25" font-weight="900">스마트머니, &apos;${escapeXml(cleanInflowBannerName)}&apos; 중심 +${top5InflowSum.toLocaleString()}억 집중</text>

        <!-- Divider -->
        <line x1="35" y1="88" x2="905" y2="88" stroke="#F1F5F9" stroke-width="1.5"/>

        <!-- 1행: 핵심 팩트 (27px 대형 볼드) -->
        <text x="35" y="142" fill="#1E293B" font-size="27" font-weight="900">
          • 지수 변동성 속 기관·외국인 스마트머니 상위 5종목 집중 유입
        </text>

        <!-- 2행: 실전 대응 액션 밴드 (24px 볼드) -->
        <rect x="35" y="186" width="870" height="82" rx="16" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="1.2"/>
        <rect x="52" y="205" width="100" height="44" rx="10" fill="#DBEAFE"/>
        <text x="102" y="233" fill="#1D4ED8" font-size="18" font-weight="900" text-anchor="middle">실전 조언</text>
        <text x="168" y="234" fill="#1E40AF" font-size="24" font-weight="800">단기 시세 추종 지양, 안전자산 완충력 확보하는 균형 전략 유효</text>
      </g>

      <!-- Bottom KRX Notice Banner (y=1073, h=80) -->
      <g transform="translate(70, 1073)">
        <rect width="940" height="80" rx="20" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.2"/>
        <text x="470" y="48" fill="#475569" font-size="21" font-weight="800" text-anchor="middle">
          한국거래소 KRX 전 거래일 마감 공시 기준 · 국내 상장 일반 ETF ${generalCount.toLocaleString()}개 전수 분석
        </text>
      </g>

      <!-- Disclaimer & Watermark (Zero shaded box) -->
      ${commonFooter}
    </svg>
  `;

  return [
    { slideNumber: 1, title: "Cover", subtitle: "1초 후킹 표지 & 3대 핵심 펄스", svgContent: slide1Svg },
    { slideNumber: 2, title: "Theme Dynamics", subtitle: "주도 테마 TOP 3 vs 부진 테마", svgContent: slide2Svg },
    { slideNumber: 3, title: "Asset Class Dynamics", subtitle: "자산군별 수익률/기여도", svgContent: slide3Svg },
    { slideNumber: 4, title: "Smart Money Flow", subtitle: "실질 자금 순유입 TOP 5", svgContent: slide4Svg },
    { slideNumber: 5, title: "Disparity Alert", subtitle: "괴리율 고평가·할증 vs 저평가·할인 진단", svgContent: slide5Svg },
    { slideNumber: 6, title: "Summary & Action Strategy", subtitle: "오늘 시장 총정리 & 핵심 전략", svgContent: slide6Svg },
  ];
}

export function generateInstagramCaption(
  payload: MarketBriefingPayload,
  narrative?: PolishedNarrative | MarketRegime
): string {
  const regime = narrative || classifyMarketRegime(payload);
  const generalCount = payload.generalEtfCount ?? 1025;
  
  const topInflows = payload.periodicFlows?.dailyFundFlows?.topInflows?.slice(0, 2) || [];
  const inflowText = topInflows.length > 0 
    ? `\n\n2. 스마트머니 순유입:\n${topInflows.map(i => {
        const name = i.name || (i as any).etfName || "대표지수";
        const val = i.inflow ?? ((i as any).netInflowValue ? Math.round((i as any).netInflowValue / 100000000) : 0);
        return `• ${name} +${(val || 0).toLocaleString()}억 원`;
      }).join('\n')}` 
    : "";

  const sortedPeerGroups = [...(payload.peerGroups || [])].sort((a, b) => (b.cappedAumWeightedReturnPct ?? 0) - (a.cappedAumWeightedReturnPct ?? 0));
  const strongThemes = sortedPeerGroups.slice(0, 2);
  const weakThemes = [...sortedPeerGroups].reverse().slice(0, 2);
  
  const cleanTheme = (str?: string) => (str || "").replace(/\s*\([^)]*\)/g, '').trim();

  const strongText = strongThemes.length > 0 
    ? strongThemes.map(t => `${cleanTheme(t.peerGroup)} ${(t.cappedAumWeightedReturnPct ?? 0) > 0 ? '+' : ''}${(t.cappedAumWeightedReturnPct ?? 0).toFixed(2)}%`).join(', ') 
    : "집계 중";

  const weakText = weakThemes.length > 0
    ? weakThemes.map(t => `${cleanTheme(t.peerGroup)} ${(t.cappedAumWeightedReturnPct ?? 0) > 0 ? '+' : ''}${(t.cappedAumWeightedReturnPct ?? 0).toFixed(2)}%`).join(', ')
    : "집계 중";

  const formattedDate = formatDateWithDay(payload.asOfDate);
  const captionOpening = (regime.captionOpening || "").replace(/어제\s*/g, "").trim();
  const captionMarketSummary = (regime.captionMarketSummary || "").replace(/어제\s*/g, "").trim();

  return `${formattedDate} 국내 상장 일반 ETF ${generalCount.toLocaleString()}개 마켓 동향

${captionOpening}

${captionMarketSummary}

[지난 장 국내 ETF 시장 3대 핵심 동향]

1. 테마군 수익률 명암:
• 상위 테마: ${strongText}
• 하위 테마: ${weakText}${inflowText}

3. 시장 흐름 & 테마 분석:
• ${regime.captionThemeAnalysis || "단기 숨고르기 속에서도 국내외 대표지수로 저가 분할 매수 지속"}

[오늘의 시장 관전 포인트]
${regime.captionWatchPoint || "변동성이 확대된 국면에서는 지수 등락 자체보다 섹터 간 자금 이동 경로와 방어적 자산의 완충력을 관찰하는 것이 유효합니다."}

오늘 개장 후 여러분이 가장 주목하고 계신 테마나 지표는 무엇인가요? 댓글로 자유롭게 의견을 나눠주세요.

데이터 출처: 한국거래소 KRX 전 거래일 마감 공시 데이터 기준 · 국내 상장 일반 ETF ${generalCount.toLocaleString()}개 전수 분석. 본 콘텐츠는 순수 시황 분석 정보 제공 목적이며 투자 권유가 아닙니다.`;
}
