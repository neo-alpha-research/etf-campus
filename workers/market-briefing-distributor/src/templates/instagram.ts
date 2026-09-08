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
  if (!dateStr) return "2026.09.07 · 월요일";
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const days = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
  const dayName = days[date.getDay()] || "월요일";
  return `${dateStr.replace(/-/g, ".")} · ${dayName}`;
}

export function cleanEtfNameForBanner(name?: string, maxChars: number = 14): string {
  if (!name) return "대표 ETF";
  let clean = name.replace(/\s*\([^)]*\)/g, '').trim();
  if (clean.length > maxChars) {
    clean = clean.slice(0, maxChars - 1) + "…";
  }
  return clean;
}

export function calcBannerFontSize(text: string, maxWidthPx: number = 720, baseFs: number = 28, minFs: number = 24): number {
  let estWidth = 0;
  for (const char of text) {
    estWidth += char.charCodeAt(0) > 128 ? baseFs * 0.95 : baseFs * 0.55;
  }
  if (estWidth <= maxWidthPx) return baseFs;
  const scale = maxWidthPx / estWidth;
  return Math.max(minFs, Math.floor(baseFs * scale));
}

export function generateInstagramCarousel(
  payload: MarketBriefingPayload,
  baseUrl: string,
  narrative?: PolishedNarrative | MarketRegime
): InstagramSlide[] {
  const regime = narrative || classifyMarketRegime(payload);
  const dateStr = payload.asOfDate || "2026-09-07";
  const formattedDate = formatDateWithDay(dateStr);

  const kospi = payload.kospiChangePct ?? 4.61;
  const kosdaq = payload.kosdaqChangePct ?? 1.07;
  const etfReturn = payload.generalAumWeightedReturnPct ?? 1.88;
  const kospiSign = kospi > 0 ? "+" : "";
  const kosdaqSign = kosdaq > 0 ? "+" : "";
  const etfSign = etfReturn > 0 ? "+" : "";
  const kospiColor = kospi >= 0 ? "#D92D20" : "#175CD3";
  const kosdaqColor = kosdaq >= 0 ? "#D92D20" : "#175CD3";
  const etfColor = etfReturn >= 0 ? "#D92D20" : "#175CD3";

  const up = payload.upCount ?? 535;
  const down = payload.downCount ?? 466;
  const flat = payload.flatCount ?? 18;
  const generalCount = payload.generalEtfCount ?? 1019;

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
  const cleanInflowBannerName = cleanEtfNameForBanner(topInflow.name, 14);

  // Asset classes
  const assetClasses = (payload.assetClasses && payload.assetClasses.length > 0) ? payload.assetClasses : [];

  // Disparity data for Slide 5 (Fixed 4-Slot Architecture)
  const disparityList = payload.disparityWarning || [];
  const premiums = [...disparityList].filter(d => (d.disparityPct ?? 0) > 0).sort((a, b) => (b.disparityPct ?? 0) - (a.disparityPct ?? 0)).slice(0, 2);
  const discounts = [...disparityList].filter(d => (d.disparityPct ?? 0) < 0).sort((a, b) => (a.disparityPct ?? 0) - (b.disparityPct ?? 0)).slice(0, 2);

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
      <style>
        * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', '맑은 고딕', 'Noto Sans KR', sans-serif; }
        .tabular { font-variant-numeric: tabular-nums; letter-spacing: -0.5px; }
      </style>
    </defs>
  `;

  // Common crisp footer (Zero shaded box, high-contrast green text)
  const commonFooter = `
    <g transform="translate(540, 1255)">
      <text x="0" y="0" fill="#475569" font-size="18" font-weight="700" text-anchor="middle">* 본 자료는 투자 판단을 돕기 위한 정보 제공용이며, 특정 종목의 매수·매도를 권유하지 않습니다.</text>
      <text x="0" y="38" fill="#047857" font-size="24" font-weight="900" text-anchor="middle" letter-spacing="0.5">ETF 캠퍼스 | https://etf-campus.pages.dev</text>
    </g>
  `;

  // =========================================================================
  // SLIDE 1: Cover & 3 Key Pulses (1 / 6)
  // =========================================================================
  const cleanTopThemeName = (topTheme.peerGroup || "주요 섹터").replace(/\s*\([^)]*\)/g, '').trim();
  const themeVerb = (topTheme.cappedAumWeightedReturnPct ?? 0) > 0 ? "주도" : "선방";
  const slide1HeroSubText = `'${cleanTopThemeName}' ${themeVerb} 속 '${cleanInflowBannerName}' 수급 집중`;
  const slide1HeroSubFs = calcBannerFontSize(slide1HeroSubText, 870, 30, 26);

  const slide1Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ETF 데일리 마켓 브리핑 - 표지 및 3대 핵심 펄스">
      <title>ETF 데일리 마켓 브리핑 - 1페이지</title>
      ${commonDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>
      <circle cx="950" cy="180" r="320" fill="#2E6819" fill-opacity="0.04"/>
      <circle cx="120" cy="1150" r="260" fill="#0284C7" fill-opacity="0.03"/>

      <!-- Header (y=48) -->
      <g transform="translate(70, 48)">
        <text x="0" y="34" fill="#0F172A" font-size="36" font-weight="900">ETF 데일리 마켓 브리핑</text>
        <rect x="710" y="0" width="230" height="46" rx="14" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5" filter="url(#cardShadow)"/>
        <text x="825" y="29" fill="#1E293B" font-size="20" font-weight="900" text-anchor="middle" class="tabular">${formattedDate}</text>
      </g>

      <!-- Main Hero Hook Card (y=122, h=185) -->
      <g transform="translate(70, 122)" filter="url(#softShadow)">
        <rect width="940" height="185" rx="24" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2"/>
        
        <!-- 헤드라인 1: 빅 넘버 대비 (48px 대형 볼드) -->
        <text x="35" y="72" fill="#0F172A" font-size="48" font-weight="900" letter-spacing="-1.2">
          코스피 <tspan fill="${kospiColor}">${kospiSign}${kospi.toFixed(2)}%</tspan> <tspan fill="#64748B" font-weight="900">vs</tspan> 일반 ETF <tspan fill="${etfColor}">${etfSign}${etfReturn.toFixed(2)}%</tspan>
        </text>

        <!-- 헤드라인 2: 테마 & 수급 핵심 설명 한 줄 (26~30px 볼드) -->
        <text x="35" y="136" fill="#047857" font-size="${slide1HeroSubFs}" font-weight="900" letter-spacing="-0.6">
          &apos;${escapeXml(cleanTopThemeName)}&apos; ${themeVerb} 속 &apos;${escapeXml(cleanInflowBannerName)}&apos; 수급 집중
        </text>
      </g>

      <!-- Pulse 1: Market Temperature (y=327, h=230) -->
      <g transform="translate(70, 327)" filter="url(#cardShadow)">
        <rect width="940" height="230" rx="24" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.6"/>
        <text x="35" y="46" fill="#0F172A" font-size="26" font-weight="900">1. 시장 체온 &amp; 3대 지수 비교</text>
        
        <rect x="580" y="16" width="325" height="44" rx="12" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.2"/>
        <text x="742" y="45" font-size="20" font-weight="900" text-anchor="middle">
          <tspan fill="#D92D20">상승 ${up}</tspan><tspan fill="#64748B"> · </tspan><tspan fill="#334155">보합 ${flat}</tspan><tspan fill="#64748B"> · </tspan><tspan fill="#175CD3">하락 ${down}</tspan>
        </text>

        <g transform="translate(35, 84)">
          <!-- KOSPI -->
          <rect x="0" y="0" width="278" height="112" rx="16" fill="${kospi >= 0 ? '#FEF2F2' : '#EFF6FF'}" stroke="${kospi >= 0 ? '#FECACA' : '#BFDBFE'}" stroke-width="1.2"/>
          <text x="22" y="44" fill="${kospi >= 0 ? '#991B1B' : '#1E40AF'}" font-size="22" font-weight="900">KOSPI</text>
          <text x="256" y="88" fill="${kospiColor}" font-size="42" font-weight="900" text-anchor="end" class="tabular">${kospiSign}${kospi.toFixed(2)}%</text>

          <!-- KOSDAQ -->
          <rect x="296" y="0" width="278" height="112" rx="16" fill="${kosdaq >= 0 ? '#FEF2F2' : '#EFF6FF'}" stroke="${kosdaq >= 0 ? '#FECACA' : '#BFDBFE'}" stroke-width="1.2"/>
          <text x="318" y="44" fill="${kosdaq >= 0 ? '#991B1B' : '#1E40AF'}" font-size="22" font-weight="900">KOSDAQ</text>
          <text x="552" y="88" fill="${kosdaqColor}" font-size="42" font-weight="900" text-anchor="end" class="tabular">${kosdaqSign}${kosdaq.toFixed(2)}%</text>

          <!-- 일반 ETF -->
          <rect x="592" y="0" width="278" height="112" rx="16" fill="#F0FDF4" stroke="#BBF7D0" stroke-width="1.5"/>
          <text x="614" y="44" fill="#15803D" font-size="22" font-weight="900">일반 ETF</text>
          <text x="848" y="88" fill="${etfColor}" font-size="42" font-weight="900" text-anchor="end" class="tabular">${etfSign}${etfReturn.toFixed(2)}%</text>
        </g>
      </g>

      <!-- Pulse 2: Long/Short Themes (y=577, h=230) -->
      <g transform="translate(70, 577)" filter="url(#cardShadow)">
        <rect width="940" height="230" rx="24" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.6"/>
        <text x="35" y="46" fill="#0F172A" font-size="26" font-weight="900">2. 오늘의 극과 극 테마</text>
        
        <rect x="685" y="16" width="220" height="44" rx="12" fill="#FFF7ED" stroke="#FDBA74" stroke-width="1.2"/>
        <text x="795" y="45" fill="#C2410C" font-size="20" font-weight="900" text-anchor="middle">테마 격차 ${themeGap}%p</text>

        <!-- Left: ▲ 상위 1위 카드 -->
        <g transform="translate(35, 82)">
          <rect width="425" height="116" rx="16" fill="#FEF2F2" stroke="#FECACA" stroke-width="1.2"/>
          <rect x="18" y="16" width="105" height="34" rx="8" fill="#FEE2E2"/>
          <text x="70" y="40" fill="#991B1B" font-size="20" font-weight="900" text-anchor="middle">▲ 상위 1위</text>
          <text x="407" y="44" fill="#D92D20" font-size="40" font-weight="900" text-anchor="end" class="tabular">+${(topTheme.cappedAumWeightedReturnPct ?? 0).toFixed(2)}%</text>
          <text x="18" y="92" fill="#0F172A" font-size="${cleanTopThemeName.length > 11 ? 26 : 29}" font-weight="900">${escapeXml(cleanTopThemeName)}</text>
        </g>

        <!-- Right: ▼ 하위 1위 카드 -->
        <g transform="translate(480, 82)">
          <rect width="425" height="116" rx="16" fill="#F1F5F9" stroke="#E2E8F0" stroke-width="1.2"/>
          <rect x="18" y="16" width="105" height="34" rx="8" fill="#E2E8F0"/>
          <text x="70" y="40" fill="#475569" font-size="20" font-weight="900" text-anchor="middle">▼ 하위 1위</text>
          <text x="407" y="44" fill="${(bottomTheme.cappedAumWeightedReturnPct ?? 0) >= 0 ? '#D92D20' : '#175CD3'}" font-size="40" font-weight="900" text-anchor="end" class="tabular">${(bottomTheme.cappedAumWeightedReturnPct ?? 0) > 0 ? '+' : ''}${(bottomTheme.cappedAumWeightedReturnPct ?? 0).toFixed(2)}%</text>
          <text x="18" y="92" fill="#0F172A" font-size="${(bottomTheme.peerGroup || '').length > 11 ? 26 : 29}" font-weight="900">${escapeXml((bottomTheme.peerGroup || "소외 섹터").replace(/\s*\([^)]*\)/g, '').trim())}</text>
        </g>
      </g>

      <!-- Pulse 3: Smart Money Flow (y=827, h=220) -->
      <g transform="translate(70, 827)" filter="url(#cardShadow)">
        <rect width="940" height="220" rx="24" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.6"/>
        <text x="35" y="46" fill="#0F172A" font-size="26" font-weight="900">3. 스마트머니 실질 순유입 1위</text>
        
        <rect x="35" y="82" width="870" height="106" rx="16" fill="#FFF1F2" stroke="#FECDD3" stroke-width="1.2"/>
        <circle cx="68" cy="135" r="26" fill="#D92D20"/>
        <text x="68" y="144" fill="#FFFFFF" font-size="24" font-weight="900" text-anchor="middle">1</text>
        
        <text x="110" y="122" fill="#0F172A" font-size="30" font-weight="900">${escapeXml(cleanInflowBannerName)}</text>
        
        <rect x="110" y="136" width="90" height="32" rx="8" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1"/>
        <text x="155" y="158" fill="#1E293B" font-size="20" font-weight="900" text-anchor="middle" class="tabular">${topInflow.ticker}</text>
        
        <text x="880" y="132" fill="#D92D20" font-size="44" font-weight="900" text-anchor="end" class="tabular">+${(topInflow.inflow || 0).toLocaleString()}<tspan font-size="26" font-weight="900" fill="#991B1B">억원</tspan></text>
        <text x="880" y="162" fill="#BE123C" font-size="20" font-weight="900" text-anchor="end">당일 최대 순유입</text>
      </g>

      <!-- Common Disclaimer & Watermark -->
      ${commonFooter}
    </svg>
  `;

  // =========================================================================
  // SLIDE 2: Theme Dynamics (2 / 6)
  // =========================================================================
  const cleanTopThemeClean = topTheme.peerGroup.replace(/\s*\([^)]*\)/g, '').trim();
  const cleanBotThemeClean = bottomTheme.peerGroup.replace(/\s*\([^)]*\)/g, '').trim();

  const slide2Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ETF 데일리 마켓 브리핑 - 주도 테마 TOP 3 vs 부진 테마">
      <title>ETF 데일리 마켓 브리핑 - 2페이지</title>
      ${commonDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>

      <!-- Header (y=48) -->
      <g transform="translate(70, 48)">
        <text x="0" y="34" fill="#0F172A" font-size="36" font-weight="900">오늘 시장 주도/부진 테마 TOP 3</text>
        <text x="0" y="64" fill="#334155" font-size="20" font-weight="700">※ 테마별 순자산 가중수익률 기준 상위/하위 랭킹</text>
        <rect x="830" y="0" width="110" height="46" rx="14" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5"/>
        <text x="885" y="30" fill="#1E293B" font-size="20" font-weight="900" text-anchor="middle" class="tabular">2 / ${totalSlides}</text>
      </g>

      <!-- Summary Banner (y=125, h=115) -->
      <g transform="translate(70, 125)" filter="url(#cardShadow)">
        <rect width="940" height="115" rx="22" fill="#FFFBEB" stroke="#FDE68A" stroke-width="1.5"/>
        <rect x="30" y="16" width="135" height="38" rx="10" fill="#FEF3C7" stroke="#FCD34D" stroke-width="1.2"/>
        <text x="97" y="42" fill="#B45309" font-size="20" font-weight="900" text-anchor="middle">테마 핵심</text>
        <text x="180" y="44" fill="#0F172A" font-size="30" font-weight="900">&apos;${escapeXml(cleanTopThemeClean)}&apos; ${(topTheme.cappedAumWeightedReturnPct ?? 0) > 0 ? "주도" : "선방"} vs &apos;${escapeXml(cleanBotThemeClean)}&apos; 조정</text>
        <text x="30" y="90" fill="#1E293B" font-size="24" font-weight="800">
          테마 간 수익률 격차 <tspan fill="#B45309" font-weight="900">${themeGap}%p</tspan>로 주도 섹터와 소외 섹터의 뚜렷한 차별화
        </text>
      </g>

      <!-- Panel 1: Top 3 Leaders (▲ 상위 Top 3) (y=260, h=450) -->
      <g transform="translate(70, 260)" filter="url(#cardShadow)">
        <rect width="940" height="450" rx="24" fill="#FFFFFF" stroke="#FECDCA" stroke-width="1.5"/>
        <rect x="0" y="0" width="940" height="56" rx="24" fill="#FEF3F2"/>
        <text x="35" y="38" fill="#B42318" font-size="25" font-weight="900">▲ 상위 Top 3 주도 테마</text>

        ${winners.map((w, idx) => {
          const cleanName = w.peerGroup.replace(/\s*\([^)]*\)/g, '').trim();
          const ret = w.cappedAumWeightedReturnPct ?? 0;
          const retSign = ret > 0 ? "▲ +" : ret < 0 ? "▼ " : "";
          const retColor = ret >= 0 ? "#D92D20" : "#175CD3";
          return `
          <g transform="translate(35, ${72 + idx * 122})">
            <rect width="870" height="110" rx="20" fill="#FAFDF4" stroke="#D7EABB" stroke-width="1.5"/>
            <circle cx="50" cy="55" r="26" fill="${idx === 0 ? '#D92D20' : '#FEE4E2'}"/>
            <text x="50" y="64" fill="${idx === 0 ? '#FFFFFF' : '#D92D20'}" font-size="24" font-weight="900" text-anchor="middle">${idx + 1}</text>
            <text x="96" y="48" fill="#0F172A" font-size="30" font-weight="900">${escapeXml(cleanName)}</text>
            <rect x="96" y="62" width="160" height="32" rx="8" fill="#F0FDF4" stroke="#BBF7D0" stroke-width="1"/>
            <text x="176" y="84" fill="#15803D" font-size="19" font-weight="900" text-anchor="middle">가중수익률 상위</text>
            <text x="840" y="70" fill="${retColor}" font-size="44" font-weight="900" text-anchor="end" class="tabular">${retSign}${ret.toFixed(2)}%</text>
          </g>
        `;}).join("")}
      </g>

      <!-- Panel 2: Bottom 3 Laggards (▼ 하위 Worst 3) (y=730, h=450) -->
      <g transform="translate(70, 730)" filter="url(#cardShadow)">
        <rect width="940" height="450" rx="24" fill="#FFFFFF" stroke="#BFDBFE" stroke-width="1.5"/>
        <rect x="0" y="0" width="940" height="56" rx="24" fill="#EFF6FF"/>
        <text x="35" y="38" fill="#1D4ED8" font-size="25" font-weight="900">▼ 하위 Worst 3 부진 테마</text>

        ${losers.map((l, idx) => {
          const cleanName = l.peerGroup.replace(/\s*\([^)]*\)/g, '').trim();
          const ret = l.cappedAumWeightedReturnPct ?? 0;
          const retSign = ret > 0 ? "▲ +" : ret < 0 ? "▼ " : "";
          const retColor = ret >= 0 ? "#D92D20" : "#175CD3";
          return `
          <g transform="translate(35, ${72 + idx * 122})">
            <rect width="870" height="110" rx="20" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5"/>
            <circle cx="50" cy="55" r="26" fill="${idx === 0 ? '#175CD3' : '#DBEAFE'}"/>
            <text x="50" y="64" fill="${idx === 0 ? '#FFFFFF' : '#175CD3'}" font-size="24" font-weight="900" text-anchor="middle">${idx + 1}</text>
            <text x="96" y="48" fill="#0F172A" font-size="30" font-weight="900">${escapeXml(cleanName)}</text>
            <rect x="96" y="62" width="160" height="32" rx="8" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1"/>
            <text x="176" y="84" fill="#475569" font-size="19" font-weight="900" text-anchor="middle">가중수익률 하위</text>
            <text x="840" y="70" fill="${retColor}" font-size="44" font-weight="900" text-anchor="end" class="tabular">${retSign}${ret.toFixed(2)}%</text>
          </g>
        `;}).join("")}
      </g>

      <!-- Common Disclaimer & Watermark -->
      ${commonFooter}
    </svg>
  `;

  // =========================================================================
  // SLIDE 3: Asset Class Dynamics (3 / 6)
  // =========================================================================
  const domesticStock = assetClasses.find(a => a.assetClass?.includes("국내") || a.assetClass?.includes("주식-국내"));
  const domRet = domesticStock?.aumWeightedReturnPct ?? 4.14;
  const domShare = domesticStock?.aumSharePct ?? 48.8;
  const domSign = domRet > 0 ? "+" : "";

  const sortedByRet = [...assetClasses].sort((a, b) => (b.aumWeightedReturnPct ?? 0) - (a.aumWeightedReturnPct ?? 0));
  const topAsset = sortedByRet[0] || { assetClass: "국내주식", aumWeightedReturnPct: 4.14 };
  const botAsset = sortedByRet[sortedByRet.length - 1] || { assetClass: "원자재", aumWeightedReturnPct: -1.98 };

  const domStatusStr = domRet > 0.5 ? "상승 견인" : domRet >= -0.5 ? "보합 혼조" : "조정 숨고르기";

  const slide3Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ETF 데일리 마켓 브리핑 - 자산군별 성과 및 비중 현황">
      <title>ETF 데일리 마켓 브리핑 - 3페이지</title>
      ${commonDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>

      <!-- Header (y=48) -->
      <g transform="translate(70, 48)">
        <text x="0" y="34" fill="#0F172A" font-size="36" font-weight="900">자산군별 수익률 &amp; 비중 현황</text>
        <text x="0" y="64" fill="#334155" font-size="20" font-weight="700">※ 자산군별 당일 순자산 가중수익률 및 전체 순자산 비중</text>
        <rect x="830" y="0" width="110" height="46" rx="14" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5"/>
        <text x="885" y="30" fill="#1E293B" font-size="20" font-weight="900" text-anchor="middle" class="tabular">3 / ${totalSlides}</text>
      </g>

      <!-- Summary Box (y=125, h=115) -->
      <g transform="translate(70, 125)" filter="url(#cardShadow)">
        <rect width="940" height="115" rx="22" fill="#F0FDF4" stroke="#BBF7D0" stroke-width="1.5"/>
        <rect x="30" y="16" width="145" height="38" rx="10" fill="#DCFCE7" stroke="#86EFAC" stroke-width="1.2"/>
        <text x="102" y="42" fill="#15803D" font-size="20" font-weight="900" text-anchor="middle">자산군 핵심</text>
        <text x="190" y="44" fill="#0F172A" font-size="30" font-weight="900">&apos;${escapeXml(topAsset.assetClass)}&apos; 상승 vs &apos;${escapeXml(botAsset.assetClass)}&apos; 조정</text>
        <text x="30" y="90" fill="#1E293B" font-size="24" font-weight="800">
          최대 비중 ${(domShare ?? 0).toFixed(1)}%의 국내주식은 <tspan fill="${domRet >= 0 ? '#15803D' : '#175CD3'}" font-weight="900">${domSign}${(domRet ?? 0).toFixed(2)}% ${domStatusStr}</tspan>, 분산 효과 확인
        </text>
      </g>

      <!-- 6 Asset Classes List (y=260, step=156, h=142) -->
      <g transform="translate(70, 260)">
        ${assetClasses.slice(0, 6).map((ac, idx) => {
          const rawAum = ac.totalAum || 0;
          const aumEok = rawAum > 100_000_000_000 ? rawAum / 100_000_000 : rawAum;
          const aumJo = (aumEok / 10000).toFixed(1);
          const ret = ac.aumWeightedReturnPct ?? 0;
          const retSign = ret > 0 ? "▲ +" : ret < 0 ? "▼ " : "";
          const retColor = ret >= 0 ? "#D92D20" : "#175CD3";
          const share = ac.aumSharePct ?? 0;

          return `
            <g transform="translate(0, ${idx * 156})" filter="url(#cardShadow)">
              <rect width="940" height="142" rx="22" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
              <text x="35" y="52" fill="#0F172A" font-size="34" font-weight="900">${escapeXml(ac.assetClass)}</text>
              <text x="35" y="92" fill="#1E293B" font-size="23" font-weight="800">
                순자산 <tspan font-weight="900" fill="#0F172A">${aumJo}조원</tspan> · 비중 <tspan font-weight="900" fill="#047857">${share.toFixed(1)}%</tspan>
              </text>
              
              <rect x="35" y="112" width="380" height="12" rx="6" fill="#F1F5F9"/>
              <rect x="35" y="112" width="${Math.min(380, Math.max(12, share * 3.8))}" height="12" rx="6" fill="#047857"/>
              
              <rect x="520" y="18" width="385" height="106" rx="16" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1"/>
              <rect x="540" y="24" width="105" height="32" rx="8" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1"/>
              <text x="592" y="46" fill="#475569" font-size="19" font-weight="900" text-anchor="middle">가중수익률</text>
              <text x="880" y="52" fill="${retColor}" font-size="44" font-weight="900" text-anchor="end" class="tabular">${retSign}${ret.toFixed(2)}%</text>
              
              <text x="545" y="96" fill="#475569" font-size="20" font-weight="800">종목 분포</text>
              <text x="880" y="96" fill="#1E293B" font-size="22" font-weight="900" text-anchor="end" class="tabular">상승 ${ac.upCount} · 하락 ${ac.downCount}</text>
            </g>
          `;
        }).join("")}
      </g>

      <!-- Common Disclaimer & Watermark -->
      ${commonFooter}
    </svg>
  `;

  // =========================================================================
  // SLIDE 4: Smart Money Flow (4 / 6)
  // =========================================================================
  const secondInflow = topInflows[1];
  const cleanInflow2Name = secondInflow ? cleanEtfNameForBanner(secondInflow.name, 14) : "";
  const slide4BannerTitle = regime.slide4BannerTitle || (secondInflow
    ? `스마트머니, '${escapeXml(cleanInflowBannerName)}' 등 집중 순유입`
    : `스마트머니, '${escapeXml(cleanInflowBannerName)}' 집중 순유입`);
  const slide4BannerDesc = regime.slide4BannerDesc || `상위 5종목으로 총 ${top5InflowSum.toLocaleString()}억원 실질 자금 순유입`;
  const slide4TitleFs = calcBannerFontSize(slide4BannerTitle, 720, 28, 24);
  const slide4DescFs = calcBannerFontSize(slide4BannerDesc, 870, 24, 22);

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
        <text x="0" y="64" fill="#334155" font-size="20" font-weight="700">※ 발행좌수 증감으로 산출된 기관·외국인의 실질 자금 순유입액</text>
        <rect x="830" y="0" width="110" height="46" rx="14" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5"/>
        <text x="885" y="30" fill="#1E293B" font-size="20" font-weight="900" text-anchor="middle" class="tabular">4 / ${totalSlides}</text>
      </g>

      <!-- Summary Banner (y=125, h=115) -->
      <g transform="translate(70, 125)" filter="url(#cardShadow)">
        <rect width="940" height="115" rx="22" fill="#FFF1F2" stroke="#FECDD3" stroke-width="1.5"/>
        <rect x="30" y="16" width="135" height="38" rx="10" fill="#FFE4E6" stroke="#FDA4AF" stroke-width="1.2"/>
        <text x="97" y="42" fill="#BE123C" font-size="20" font-weight="900" text-anchor="middle">수급 핵심</text>
        <text x="180" y="44" fill="#0F172A" font-size="${slide4TitleFs}" font-weight="900">${slide4BannerTitle}</text>
        <text x="30" y="90" fill="#1E293B" font-size="${slide4DescFs}" font-weight="800">
          ${escapeXml(slide4BannerDesc)}
        </text>
      </g>

      <!-- TOP 5 Inflow Ranking Cards (y=260, step=188, h=172) -->
      <g transform="translate(70, 260)">
        ${topInflows.slice(0, 5).map((item, idx) => {
          const inflowJo = item.inflow ? item.inflow.toLocaleString() : "1,000";
          const isTop = idx === 0;
          const cleanName = cleanEtfNameForBanner(item.name, 16);
          return `
            <g transform="translate(0, ${idx * 188})" filter="url(#cardShadow)">
              <rect width="940" height="172" rx="24" fill="${isTop ? '#FFF8F8' : '#FFFFFF'}" stroke="${isTop ? '#FCA5A5' : '#E2E8F0'}" stroke-width="${isTop ? '2' : '1.5'}"/>
              ${isTop ? '<rect x="0" y="0" width="8" height="172" rx="4" fill="#D92D20"/>' : ''}

              <!-- 순위 뱃지 -->
              <circle cx="58" cy="86" r="28" fill="${isTop ? '#D92D20' : '#F1F5F9'}" ${!isTop ? 'stroke="#CBD5E1" stroke-width="1.5"' : ''}/>
              <text x="58" y="96" fill="${isTop ? '#FFFFFF' : '#475569'}" font-size="26" font-weight="900" text-anchor="middle">${idx + 1}</text>

              <!-- ETF명 -->
              <text x="106" y="68" fill="#0F172A" font-size="30" font-weight="900">${escapeXml(cleanName)}</text>

              <!-- 티커 -->
              <rect x="106" y="88" width="95" height="34" rx="8" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1"/>
              <text x="153" y="112" fill="#1E293B" font-size="20" font-weight="900" text-anchor="middle" class="tabular">${item.ticker}</text>

              <!-- 테마 태그 -->
              <rect x="212" y="88" width="145" height="34" rx="8" fill="${isTop ? '#FFE4E6' : '#F8FAFC'}" stroke="${isTop ? '#FDA4AF' : '#E2E8F0'}" stroke-width="1"/>
              <text x="284" y="112" fill="${isTop ? '#BE123C' : '#334155'}" font-size="20" font-weight="900" text-anchor="middle">${escapeXml(item.theme || "핵심ETF")}</text>

              <!-- 순유입 금액 -->
              <text x="910" y="78" fill="${isTop ? '#D92D20' : '#1E293B'}" font-size="46" font-weight="900" text-anchor="end" class="tabular">+${inflowJo}<tspan font-size="26" font-weight="900" fill="${isTop ? '#BE123C' : '#334155'}">억원</tspan></text>
              <text x="910" y="114" fill="${isTop ? '#E11D48' : '#475569'}" font-size="20" font-weight="900" text-anchor="end">${isTop ? '당일 최대 실질 순유입' : '순유입 상위 종목'}</text>
            </g>
          `;
        }).join("")}
      </g>

      <!-- Common Disclaimer & Watermark -->
      ${commonFooter}
    </svg>
  `;

  // =========================================================================
  // SLIDE 5: Disparity Alert (Fixed 4-Slot Architecture) (5 / 6)
  // =========================================================================
  const prem1 = premiums[0];
  const prem2 = premiums[1];
  const disc1 = discounts[0];
  const disc2 = discounts[1];

  const slide5Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ETF 데일리 마켓 브리핑 - 괴리율 고평가·할증 vs 저평가·할인 진단">
      <title>ETF 데일리 마켓 브리핑 - 5페이지</title>
      ${commonDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>

      <!-- Header (y=48) -->
      <g transform="translate(70, 48)">
        <text x="0" y="34" fill="#0F172A" font-size="36" font-weight="900" letter-spacing="-0.8">괴리율 고평가·할증 vs 저평가·할인 진단</text>
        <text x="0" y="64" fill="#334155" font-size="20" font-weight="700">※ 순자산가치 NAV 대비 시장 종가의 가격 왜곡 정도를 진단합니다.</text>
        <rect x="830" y="0" width="110" height="46" rx="14" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5"/>
        <text x="885" y="30" fill="#1E293B" font-size="20" font-weight="900" text-anchor="middle" class="tabular">5 / ${totalSlides}</text>
      </g>

      <!-- Alert Banner (y=125, h=110) -->
      <g transform="translate(70, 125)" filter="url(#cardShadow)">
        <rect width="940" height="110" rx="22" fill="#FFFBEB" stroke="#FDE68A" stroke-width="1.6"/>
        <rect x="30" y="16" width="135" height="38" rx="10" fill="#FEF3C7" stroke="#FCD34D" stroke-width="1.2"/>
        <text x="97" y="42" fill="#B45309" font-size="20" font-weight="900" text-anchor="middle">괴리율 진단</text>
        <text x="180" y="44" fill="#0F172A" font-size="28" font-weight="900">순자산가치 NAV 대비 시장 가격 왜곡 점검</text>
        <text x="30" y="88" fill="#1E293B" font-size="24" font-weight="800">
          장 시작 및 마감 시점의 호가 공백과 해외 시차로 인한 왜곡을 점검합니다.
        </text>
      </g>

      <!-- SECTION 1: NAV 대비 고평가 · 할증 Top 2 (y=255) -->
      <g transform="translate(70, 255)">
        <text x="5" y="28" fill="#991B1B" font-size="25" font-weight="900">▲ NAV 대비 고평가 · 할증 주의 (시장가 &gt; 가치)</text>

        <!-- Slot 1 (y=44) -->
        ${prem1 ? `
        <g transform="translate(0, 44)" filter="url(#cardShadow)">
          <rect width="940" height="142" rx="22" fill="#FFF8F8" stroke="#FCA5A5" stroke-width="2"/>
          <rect x="0" y="0" width="8" height="142" rx="4" fill="#D92D20"/>
          <circle cx="58" cy="71" r="26" fill="#D92D20"/>
          <text x="58" y="80" fill="#FFFFFF" font-size="24" font-weight="900" text-anchor="middle">1</text>
          <text x="104" y="56" fill="#0F172A" font-size="28" font-weight="900">${escapeXml(cleanEtfNameForBanner(prem1.etfName, 18))}</text>
          <rect x="104" y="76" width="95" height="34" rx="8" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1"/>
          <text x="151" y="100" fill="#1E293B" font-size="20" font-weight="900" text-anchor="middle" class="tabular">${prem1.ticker}</text>
          <rect x="210" y="76" width="145" height="34" rx="8" fill="#FEE2E2" stroke="#FDA4AF" stroke-width="1"/>
          <text x="282" y="100" fill="#BE123C" font-size="20" font-weight="900" text-anchor="middle">고평가 할증</text>
          <text x="910" y="68" fill="#D92D20" font-size="46" font-weight="900" text-anchor="end" class="tabular">+${(prem1.disparityPct ?? 0).toFixed(2)}%</text>
          <text x="910" y="104" fill="#BE123C" font-size="20" font-weight="900" text-anchor="end">NAV 대비 할증 거래 중</text>
        </g>
        ` : `
        <g transform="translate(0, 44)" filter="url(#cardShadow)">
          <rect width="940" height="142" rx="22" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5"/>
          <text x="470" y="82" fill="#15803D" font-size="25" font-weight="900" text-anchor="middle">✔ 전 종목 NAV 대비 할증률 정상 범위 유지 (고평가 종목 없음)</text>
        </g>
        `}

        <!-- Slot 2 (y=202) -->
        ${prem2 ? `
        <g transform="translate(0, 202)" filter="url(#cardShadow)">
          <rect width="940" height="142" rx="22" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
          <circle cx="58" cy="71" r="26" fill="#FEE2E2"/>
          <text x="58" y="80" fill="#991B1B" font-size="24" font-weight="900" text-anchor="middle">2</text>
          <text x="104" y="56" fill="#0F172A" font-size="28" font-weight="900">${escapeXml(cleanEtfNameForBanner(prem2.etfName, 18))}</text>
          <rect x="104" y="76" width="95" height="34" rx="8" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1"/>
          <text x="151" y="100" fill="#1E293B" font-size="20" font-weight="900" text-anchor="middle" class="tabular">${prem2.ticker}</text>
          <rect x="210" y="76" width="145" height="34" rx="8" fill="#FEE2E2" stroke="#FDA4AF" stroke-width="1"/>
          <text x="282" y="100" fill="#BE123C" font-size="20" font-weight="900" text-anchor="middle">고평가 할증</text>
          <text x="910" y="68" fill="#D92D20" font-size="46" font-weight="900" text-anchor="end" class="tabular">+${(prem2.disparityPct ?? 0).toFixed(2)}%</text>
          <text x="910" y="104" fill="#BE123C" font-size="20" font-weight="900" text-anchor="end">NAV 대비 할증 거래 중</text>
        </g>
        ` : `
        <g transform="translate(0, 202)" filter="url(#cardShadow)">
          <rect width="940" height="142" rx="22" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5"/>
          <text x="470" y="82" fill="#475569" font-size="24" font-weight="800" text-anchor="middle">✔ 추가 고평가 종목 없음 (대부분 종목 정상 호가 유지)</text>
        </g>
        `}
      </g>

      <!-- SECTION 2: NAV 대비 저평가 · 할인 Top 2 (y=670) -->
      <g transform="translate(70, 670)">
        <text x="5" y="28" fill="#166534" font-size="25" font-weight="900">▼ NAV 대비 저평가 · 할인 체크 (시장가 &lt; 가치)</text>

        <!-- Slot 1 (y=44) -->
        ${disc1 ? `
        <g transform="translate(0, 44)" filter="url(#cardShadow)">
          <rect width="940" height="142" rx="22" fill="#F0FDF4" stroke="#86EFAC" stroke-width="2"/>
          <rect x="0" y="0" width="8" height="142" rx="4" fill="#059669"/>
          <circle cx="58" cy="71" r="26" fill="#059669"/>
          <text x="58" y="80" fill="#FFFFFF" font-size="24" font-weight="900" text-anchor="middle">1</text>
          <text x="104" y="56" fill="#0F172A" font-size="28" font-weight="900">${escapeXml(cleanEtfNameForBanner(disc1.etfName, 18))}</text>
          <rect x="104" y="76" width="95" height="34" rx="8" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1"/>
          <text x="151" y="100" fill="#1E293B" font-size="20" font-weight="900" text-anchor="middle" class="tabular">${disc1.ticker}</text>
          <rect x="210" y="76" width="145" height="34" rx="8" fill="#DCFCE7" stroke="#86EFAC" stroke-width="1"/>
          <text x="282" y="100" fill="#15803D" font-size="20" font-weight="900" text-anchor="middle">저평가 할인</text>
          <text x="910" y="68" fill="#047857" font-size="46" font-weight="900" text-anchor="end" class="tabular">${(disc1.disparityPct ?? 0).toFixed(2)}%</text>
          <text x="910" y="104" fill="#15803D" font-size="20" font-weight="900" text-anchor="end">NAV 대비 할인 거래 중</text>
        </g>
        ` : `
        <g transform="translate(0, 44)" filter="url(#cardShadow)">
          <rect width="940" height="142" rx="22" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5"/>
          <text x="470" y="82" fill="#15803D" font-size="25" font-weight="900" text-anchor="middle">✔ 전 종목 NAV 대비 할인율 정상 범위 유지 (저평가 왜곡 없음)</text>
        </g>
        `}

        <!-- Slot 2 (y=202) -->
        ${disc2 ? `
        <g transform="translate(0, 202)" filter="url(#cardShadow)">
          <rect width="940" height="142" rx="22" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
          <circle cx="58" cy="71" r="26" fill="#DCFCE7"/>
          <text x="58" y="80" fill="#166534" font-size="24" font-weight="900" text-anchor="middle">2</text>
          <text x="104" y="56" fill="#0F172A" font-size="28" font-weight="900">${escapeXml(cleanEtfNameForBanner(disc2.etfName, 18))}</text>
          <rect x="104" y="76" width="95" height="34" rx="8" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1"/>
          <text x="151" y="100" fill="#1E293B" font-size="20" font-weight="900" text-anchor="middle" class="tabular">${disc2.ticker}</text>
          <rect x="210" y="76" width="145" height="34" rx="8" fill="#DCFCE7" stroke="#86EFAC" stroke-width="1"/>
          <text x="282" y="100" fill="#15803D" font-size="20" font-weight="900" text-anchor="middle">저평가 할인</text>
          <text x="910" y="68" fill="#047857" font-size="46" font-weight="900" text-anchor="end" class="tabular">${(disc2.disparityPct ?? 0).toFixed(2)}%</text>
          <text x="910" y="104" fill="#15803D" font-size="20" font-weight="900" text-anchor="end">NAV 대비 할인 거래 중</text>
        </g>
        ` : `
        <g transform="translate(0, 202)" filter="url(#cardShadow)">
          <rect width="940" height="142" rx="22" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5"/>
          <text x="470" y="82" fill="#475569" font-size="24" font-weight="800" text-anchor="middle">✔ 추가 저평가 종목 없음 (정상 범위 호가 유지)</text>
        </g>
        `}
      </g>

      <!-- SECTION 3: 실전 체크리스트 (y=1080, h=140) -->
      <g transform="translate(70, 1080)" filter="url(#cardShadow)">
        <rect width="940" height="140" rx="22" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.5"/>
        <text x="35" y="44" fill="#0F172A" font-size="25" font-weight="900">💡 실전 투자 가이드 — 괴리율 대응 체크포인트</text>
        <text x="35" y="86" fill="#1E293B" font-size="23" font-weight="800">
          • 해외 ETF 괴리율은 개장 직후 LP 호가가 공급되며 정상 범위로 수렴합니다.
        </text>
        <text x="35" y="120" fill="#1E293B" font-size="23" font-weight="800">
          • 괴리율이 비정상적으로 확대된 종목은 시장가 추격 매수를 피하고 iNAV를 확인하세요.
        </text>
      </g>

      <!-- Common Disclaimer & Watermark -->
      ${commonFooter}
    </svg>
  `;

  // =========================================================================
  // SLIDE 6: Summary & Action Strategy (6 / 6)
  // =========================================================================
  const rawTopTheme = (topTheme.peerGroup || "주도 테마").replace(/\s*\([^)]*\)/g, '').trim();
  const rawBotTheme = (bottomTheme.peerGroup || "소외 테마").replace(/\s*\([^)]*\)/g, '').trim();
  const cleanSlide6TopTheme = cleanEtfNameForBanner(rawTopTheme, 20);
  const cleanSlide6BotTheme = cleanEtfNameForBanner(rawBotTheme, 20);

  const slide6Card1Fact = `• 상승 종목 ${up}개 우위로 시장 매수 심리 전반 회복`;
  const slide6Card1Action = `대형주 및 핵심 성장 섹터 중심의 안정적 상방 탄력 유효`;

  const slide6Card2Fact = `• 테마 간 수익률 격차 ${themeGap}%p로 극심한 차별화 장세`;
  const slide6Card2Action = `단기 급등 테마 무리한 추격 매수 자제 및 분할 리밸런싱`;

  const slide6Card3Fact = `• 기관·외국인 스마트머니 상위 5종목으로 수급 집중`;
  const slide6Card3Action = `단기 시세 추종 지양, 안전자산 완충력 확보하는 균형 전략`;

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
        <text x="0" y="64" fill="#334155" font-size="20" font-weight="700">※ 3대 핵심 축으로 요약하는 시장 진단과 실전 투자 대응 가이드</text>
        <rect x="830" y="0" width="110" height="46" rx="14" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5"/>
        <text x="885" y="30" fill="#1E293B" font-size="20" font-weight="900" text-anchor="middle" class="tabular">6 / ${totalSlides}</text>
      </g>

      <!-- 1. CARD 01: [시장 진단] (y=125, h=315) -->
      <g transform="translate(70, 125)" filter="url(#cardShadow)">
        <rect width="940" height="315" rx="24" fill="#FFFFFF" stroke="#BBF7D0" stroke-width="1.8"/>
        <rect x="0" y="0" width="8" height="315" rx="4" fill="#10B981"/>

        <!-- Header -->
        <rect x="35" y="24" width="150" height="46" rx="12" fill="#DCFCE7" stroke="#86EFAC" stroke-width="1.2"/>
        <text x="110" y="55" fill="#15803D" font-size="22" font-weight="900" text-anchor="middle">01 시장 진단</text>
        <text x="200" y="56" fill="#0F172A" font-size="28" font-weight="900">코스피 ${kospiSign}${kospi.toFixed(2)}% · 일반 ETF ${etfSign}${etfReturn.toFixed(2)}% 반등 랠리</text>

        <!-- Divider -->
        <line x1="35" y1="92" x2="905" y2="92" stroke="#F1F5F9" stroke-width="1.5"/>

        <!-- 1행: 핵심 팩트 (28px 대형 볼드) -->
        <text x="35" y="148" fill="#1E293B" font-size="28" font-weight="900">
          ${slide6Card1Fact}
        </text>

        <!-- 2행: 실전 대응 액션 밴드 (25px 볼드) -->
        <rect x="35" y="196" width="870" height="88" rx="16" fill="#F0FDF4" stroke="#BBF7D0" stroke-width="1.2"/>
        <rect x="52" y="217" width="105" height="46" rx="10" fill="#DCFCE7"/>
        <text x="104" y="247" fill="#15803D" font-size="20" font-weight="900" text-anchor="middle">대응 요약</text>
        <text x="175" y="248" fill="#166534" font-size="25" font-weight="900">${slide6Card1Action}</text>
      </g>

      <!-- 2. CARD 02: [테마 순환] (y=465, h=315) -->
      <g transform="translate(70, 465)" filter="url(#cardShadow)">
        <rect width="940" height="315" rx="24" fill="#FFFFFF" stroke="#FECDD3" stroke-width="1.8"/>
        <rect x="0" y="0" width="8" height="315" rx="4" fill="#F43F5E"/>

        <!-- Header -->
        <rect x="35" y="24" width="150" height="46" rx="12" fill="#FFE4E6" stroke="#FDA4AF" stroke-width="1.2"/>
        <text x="110" y="55" fill="#BE123C" font-size="22" font-weight="900" text-anchor="middle">02 테마 순환</text>
        <text x="200" y="56" fill="#0F172A" font-size="28" font-weight="900">&apos;${escapeXml(cleanSlide6TopTheme)}&apos; 독주 vs &apos;${escapeXml(cleanSlide6BotTheme)}&apos; 조정</text>

        <!-- Divider -->
        <line x1="35" y1="92" x2="905" y2="92" stroke="#F1F5F9" stroke-width="1.5"/>

        <!-- 1행: 핵심 팩트 (28px 대형 볼드) -->
        <text x="35" y="148" fill="#1E293B" font-size="28" font-weight="900">
          ${slide6Card2Fact}
        </text>

        <!-- 2행: 실전 대응 액션 밴드 (25px 볼드) -->
        <rect x="35" y="196" width="870" height="88" rx="16" fill="#FFF1F2" stroke="#FECDD3" stroke-width="1.2"/>
        <rect x="52" y="217" width="105" height="46" rx="10" fill="#FFE4E6"/>
        <text x="104" y="247" fill="#BE123C" font-size="20" font-weight="900" text-anchor="middle">전략 요약</text>
        <text x="175" y="248" fill="#9F1239" font-size="25" font-weight="900">${slide6Card2Action}</text>
      </g>

      <!-- 3. CARD 03: [대응 전략] (y=805, h=315) -->
      <g transform="translate(70, 805)" filter="url(#cardShadow)">
        <rect width="940" height="315" rx="24" fill="#FFFFFF" stroke="#BFDBFE" stroke-width="1.8"/>
        <rect x="0" y="0" width="8" height="315" rx="4" fill="#3B82F6"/>

        <!-- Header -->
        <rect x="35" y="24" width="150" height="46" rx="12" fill="#DBEAFE" stroke="#93C5FD" stroke-width="1.2"/>
        <text x="110" y="55" fill="#1D4ED8" font-size="22" font-weight="900" text-anchor="middle">03 자금 흐름</text>
        <text x="200" y="56" fill="#0F172A" font-size="28" font-weight="900">스마트머니, &apos;${escapeXml(cleanInflowBannerName)}&apos; 중심 +${top5InflowSum.toLocaleString()}억 집중</text>

        <!-- Divider -->
        <line x1="35" y1="92" x2="905" y2="92" stroke="#F1F5F9" stroke-width="1.5"/>

        <!-- 1행: 핵심 팩트 (28px 대형 볼드) -->
        <text x="35" y="148" fill="#1E293B" font-size="28" font-weight="900">
          ${slide6Card3Fact}
        </text>

        <!-- 2행: 실전 대응 액션 밴드 (25px 볼드) -->
        <rect x="35" y="196" width="870" height="88" rx="16" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="1.2"/>
        <rect x="52" y="217" width="105" height="46" rx="10" fill="#DBEAFE"/>
        <text x="104" y="247" fill="#1D4ED8" font-size="20" font-weight="900" text-anchor="middle">실전 조언</text>
        <text x="175" y="248" fill="#1E40AF" font-size="25" font-weight="900">${slide6Card3Action}</text>
      </g>

      <!-- Bottom KRX Notice Banner (y=1140, h=70) -->
      <g transform="translate(70, 1140)">
        <rect width="940" height="70" rx="18" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.2"/>
        <text x="470" y="44" fill="#1E293B" font-size="22" font-weight="900" text-anchor="middle">
          한국거래소 KRX 전 거래일 마감 공시 기준 · 국내 상장 일반 ETF ${generalCount.toLocaleString()}개 전수 분석
        </text>
      </g>

      <!-- Common Disclaimer & Watermark -->
      ${commonFooter}
    </svg>
  `;

  return [
    { slideNumber: 1, title: "Cover", subtitle: "1초 후킹 표지 & 3대 핵심 펄스", svgContent: slide1Svg.trim() },
    { slideNumber: 2, title: "Theme Dynamics", subtitle: "주도 테마 TOP 3 vs 부진 테마", svgContent: slide2Svg.trim() },
    { slideNumber: 3, title: "Asset Class Dynamics", subtitle: "자산군별 수익률 & 비중 현황", svgContent: slide3Svg.trim() },
    { slideNumber: 4, title: "Smart Money Flow", subtitle: "실질 자금 순유입 TOP 5", svgContent: slide4Svg.trim() },
    { slideNumber: 5, title: "Disparity Alert", subtitle: "괴리율 고평가·할증 vs 저평가·할인 진단", svgContent: slide5Svg.trim() },
    { slideNumber: 6, title: "Summary & Action Strategy", subtitle: "오늘 시장 총정리 & 핵심 전략", svgContent: slide6Svg.trim() },
  ];
}

export function generateInstagramCaption(
  payload: MarketBriefingPayload,
  narrative?: PolishedNarrative | MarketRegime
): string {
  const regime = narrative || classifyMarketRegime(payload);
  const generalCount = payload.generalEtfCount ?? 1019;
  const formattedDate = formatDateWithDay(payload.asOfDate);
  
  const topInflows = payload.periodicFlows?.dailyFundFlows?.topInflows?.slice(0, 3) || [];
  const cleanTheme = (str?: string) => (str || "").replace(/\s*\([^)]*\)/g, '').trim();

  const inflowText = topInflows.length > 0 
    ? topInflows.map(i => {
        const name = cleanTheme(i.name || (i as any).etfName);
        const val = i.inflow ?? ((i as any).netInflowValue ? Math.round((i as any).netInflowValue / 100000000) : 0);
        return `• ${name} +${(val || 0).toLocaleString()}억원`;
      }).join('\n')
    : "• 집계 중";

  const sortedPeerGroups = [...(payload.peerGroups || [])].sort((a, b) => (b.cappedAumWeightedReturnPct ?? 0) - (a.cappedAumWeightedReturnPct ?? 0));
  const strongThemes = sortedPeerGroups.slice(0, 3);
  const weakThemes = [...sortedPeerGroups].reverse().slice(0, 3);

  const strongText = strongThemes.length > 0 
    ? strongThemes.map(t => `${cleanTheme(t.peerGroup)} ${(t.cappedAumWeightedReturnPct ?? 0) > 0 ? '+' : ''}${(t.cappedAumWeightedReturnPct ?? 0).toFixed(2)}%`).join(', ') 
    : "집계 중";

  const weakText = weakThemes.length > 0
    ? weakThemes.map(t => `${cleanTheme(t.peerGroup)} ${(t.cappedAumWeightedReturnPct ?? 0) > 0 ? '+' : ''}${(t.cappedAumWeightedReturnPct ?? 0).toFixed(2)}%`).join(', ')
    : "집계 중";

  const kospi = payload.kospiChangePct ?? 4.61;
  const etfRet = payload.generalAumWeightedReturnPct ?? 1.88;
  const kospiSign = kospi > 0 ? "+" : "";
  const etfSign = etfRet > 0 ? "+" : "";

  return `[${formattedDate}] 국내 ETF 마켓 데일리 브리핑

📌 오늘의 3줄 요약
1. 시장 체온: 코스피 ${kospiSign}${kospi.toFixed(2)}% 상승 속 일반 ETF 가중수익률 ${etfSign}${etfRet.toFixed(2)}% 기록
2. 주도 테마: ${strongThemes[0] ? cleanTheme(strongThemes[0].peerGroup) + ' +' + (strongThemes[0].cappedAumWeightedReturnPct ?? 0).toFixed(2) + '%' : '집계 중'} 중심 상방 탄력
3. 스마트머니: ${topInflows[0] ? cleanTheme(topInflows[0].name) + ' 등 상위 종목 집중 유입' : '상위 종목 집중 유입'}

───────────────────────

🔎 세부 테마 & 수급 동향
• 상위 주도 테마: ${strongText}
• 하위 소외 테마: ${weakText}

스마트머니 실질 순유입 Top 3:
${inflowText}

───────────────────────

💡 오늘의 시장 관전 포인트
${regime.captionWatchPoint || "변동성이 확대된 국면에서는 지수 등락 자체보다 섹터 간 자금 이동 경로와 방어적 자산의 완충력을 관찰하는 것이 유효합니다."}

오늘 개장 후 여러분이 가장 주목하고 계신 테마나 지표는 무엇인가요? 댓글로 자유롭게 의견을 나눠주세요.

───────────────────────
데이터 출처: 한국거래소 KRX 전 거래일 마감 공시 기준 · 국내 상장 일반 ETF ${generalCount.toLocaleString()}개 전수 분석
* 본 자료는 투자 판단을 돕기 위한 정보 제공용이며 특정 종목의 매수·매도를 권유하지 않습니다.

#ETFCampus #ETF투자 #ETF브리핑 #마켓브리핑 #재테크`;
}
