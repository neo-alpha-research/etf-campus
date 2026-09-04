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
  if (!dateStr) return "2026.08.31 (월)";
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const dayName = days[date.getDay()] || "월";
  return `${dateStr.replace(/-/g, ".")} (${dayName})`;
}

export function splitSubheadline(text?: string): string[] {
  if (!text) return [""];
  const trimmed = text.trim();
  if (trimmed.length <= 26) return [trimmed];

  // Natural semantic break keywords in market commentary
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

  // Fallback: split at last space before 28 characters
  const spaceIdx = trimmed.slice(0, 28).lastIndexOf(" ");
  if (spaceIdx > 12) {
    return [trimmed.slice(0, spaceIdx).trim(), trimmed.slice(spaceIdx).trim()];
  }

  return [trimmed.slice(0, 25), trimmed.slice(25)];
}

export function generateInstagramCarousel(
  payload: MarketBriefingPayload,
  baseUrl: string,
  narrative?: PolishedNarrative | MarketRegime
): InstagramSlide[] {
  const regime = narrative || classifyMarketRegime(payload);
  const dateStr = payload.asOfDate || "2026-08-31";
  const formattedDate = formatDateWithDay(dateStr);

  const kospi = payload.kospiChangePct ?? 0.46;
  const kosdaq = payload.kosdaqChangePct ?? -0.49;
  const etfReturn = payload.generalAumWeightedReturnPct ?? -0.28;
  const kospiSign = kospi > 0 ? "+" : "";
  const kosdaqSign = kosdaq > 0 ? "+" : "";
  const etfSign = etfReturn > 0 ? "+" : "";
  const kospiColor = kospi >= 0 ? "#D92D20" : "#175CD3";
  const kosdaqColor = kosdaq >= 0 ? "#D92D20" : "#175CD3";
  const etfColor = etfReturn >= 0 ? "#D92D20" : "#175CD3";

  const up = payload.upCount ?? 305;
  const down = payload.downCount ?? 670;
  const flat = payload.flatCount ?? 47;
  const generalCount = payload.generalEtfCount ?? 1022;
  const temp = payload.marketTemperature || "하락 우세";

  // Peer Groups
  const sortedPeerGroups = [...(payload.peerGroups || [])].sort((a, b) => (b.cappedAumWeightedReturnPct ?? 0) - (a.cappedAumWeightedReturnPct ?? 0));
  const topTheme = sortedPeerGroups[0] || { peerGroup: "에너지 (원유·천연가스)", cappedAumWeightedReturnPct: 2.95, etfCount: 5, assetClass: "원자재" };
  const bottomTheme = sortedPeerGroups[sortedPeerGroups.length - 1] || { peerGroup: "조선 & 해운", cappedAumWeightedReturnPct: -6.15, etfCount: 7, assetClass: "국내주식" };
  const themeGap = Math.abs((topTheme.cappedAumWeightedReturnPct ?? 0) - (bottomTheme.cappedAumWeightedReturnPct ?? 0)).toFixed(2);

  const winners = sortedPeerGroups.filter(p => p.cappedAumWeightedReturnPct > 0).slice(0, 3);
  const losers = [...sortedPeerGroups].reverse().filter(p => p.cappedAumWeightedReturnPct < 0).slice(0, 3);

  // Inflows
  const topInflows = payload.periodicFlows?.dailyFundFlows?.topInflows || [];
  const topInflow = topInflows[0] || { name: "데이터 수집 중", ticker: "-", inflow: 0, theme: "미분류" };
  const top5InflowSum = topInflows.slice(0, 5).reduce((sum, item) => sum + (item.inflow || 0), 0);

  // Asset classes
  const assetClasses = (payload.assetClasses && payload.assetClasses.length > 0) ? payload.assetClasses : [];

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
      <linearGradient id="ctaGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FEF08A"/>
        <stop offset="100%" stop-color="#FDE047"/>
      </linearGradient>
      <linearGradient id="blueBadgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#EFF6FF"/>
        <stop offset="100%" stop-color="#DBEAFE"/>
      </linearGradient>
      <linearGradient id="inflowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#F2FDF5"/>
        <stop offset="100%" stop-color="#ECFDF5"/>
      </linearGradient>
      <pattern id="diagonalHatch" width="6" height="6" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
        <line x1="0" y1="0" x2="0" y2="6" stroke="#ffffff" stroke-width="2" stroke-opacity="0.3"/>
      </pattern>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Pretendard:wght@400;500;600;700;800;900&amp;display=swap');
        * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .tabular { font-variant-numeric: tabular-nums; letter-spacing: -0.5px; }
      </style>
    </defs>
  `;

  // =========================================================================
  // SLIDE 1: Cover & 3 Key Pulses (Overflow-Safe & Enhanced Readability)
  // =========================================================================
  const subheadlineLines = splitSubheadline(regime.slide1Subheadline);
  const isMultiLineSub = subheadlineLines.length > 1;
  const subMaxLen = Math.max(...subheadlineLines.map(l => l.length));
  const subFontSize = isMultiLineSub
    ? (subMaxLen > 32 ? 21.5 : (subMaxLen > 24 ? 23.5 : 25.5))
    : (subMaxLen > 24 ? 24 : 26.5);

  const subSvg = isMultiLineSub
    ? `<text x="0" y="40" fill="#047857" font-size="${subFontSize}" font-weight="800" letter-spacing="-0.5">
          <tspan x="0" dy="0">${escapeXml(subheadlineLines[0])}</tspan>
          <tspan x="0" dy="32">${escapeXml(subheadlineLines[1])}</tspan>
        </text>`
    : `<text x="0" y="44" fill="#047857" font-size="${subFontSize}" font-weight="800" letter-spacing="-0.5">${escapeXml(subheadlineLines[0])}</text>`;

  const lineY = isMultiLineSub ? 212 : 195;
  const p1Y = isMultiLineSub ? 228 : 215;
  const p2Y = isMultiLineSub ? 438 : 425;
  const p3Y = isMultiLineSub ? 668 : 655;

  const inflowLen = topInflow.name.length;
  const inflowFontSize = inflowLen > 22 ? 23 : (inflowLen > 16 ? 25.5 : 28);

  const slide1Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${commonDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>
      <circle cx="950" cy="180" r="320" fill="#2E6819" fill-opacity="0.04"/>
      <circle cx="120" cy="1150" r="260" fill="#0284C7" fill-opacity="0.03"/>

      <!-- Header -->
      <g transform="translate(70, 70)">
        <text x="0" y="28" fill="#2E6819" font-size="16" font-weight="900" letter-spacing="1">STEP 1. TODAY'S MARKET</text>
        <text x="0" y="62" fill="#0F172A" font-size="34" font-weight="900">ETF 데일리 브리핑</text>
        <rect x="770" y="16" width="170" height="42" rx="12" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
        <text x="855" y="43" fill="#334155" font-size="18" font-weight="900" text-anchor="middle" class="tabular">${formattedDate}</text>
      </g>

      <!-- Main Hero Card -->
      <g transform="translate(70, 140)" filter="url(#softShadow)">
        <rect width="940" height="925" rx="32" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2"/>
        
        <rect x="40" y="30" width="290" height="36" rx="10" fill="#F1F5F9" stroke="#E2E8F0" stroke-width="1.2"/>
        <text x="55" y="54" fill="#334155" font-size="16" font-weight="800">KRX 상장 일반 ETF ${generalCount.toLocaleString()}개 전수 분석</text>

        <!-- Hooking Headline -->
        <g transform="translate(40, 115)">
          <text x="0" y="0" fill="#0F172A" font-size="46" font-weight="900" letter-spacing="-1">코스피 ${kospiSign}${kospi.toFixed(2)}% vs ETF ${etfSign}${etfReturn.toFixed(2)}%</text>
          ${subSvg}
        </g>

        <line x1="40" y1="${lineY}" x2="900" y2="${lineY}" stroke="#E2E8F0" stroke-width="1.5"/>

        <!-- Pulse 1: Market Temperature -->
        <g transform="translate(40, ${p1Y})">
          <rect width="860" height="190" rx="20" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5"/>
          <text x="35" y="36" fill="#1E293B" font-size="21" font-weight="800">🌡️ 1. 시장 체온 &amp; 지수 대비 성과</text>
          
          <rect x="525" y="14" width="300" height="38" rx="12" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.2"/>
          <text x="675" y="39" font-size="17" font-weight="900" text-anchor="middle">
            <tspan fill="#D92D20">상승 ${up}</tspan><tspan fill="#94A3B8"> · </tspan><tspan fill="#64748B">보합 ${flat}</tspan><tspan fill="#94A3B8"> · </tspan><tspan fill="#175CD3">하락 ${down}</tspan>
          </text>

          <g transform="translate(35, 92)">
            <text x="0" y="0" fill="#475569" font-size="19" font-weight="800">KOSPI</text>
            <text x="75" y="0" fill="${kospiColor}" font-size="32" font-weight="900" class="tabular">${kospiSign}${kospi.toFixed(2)}%</text>
            <text x="215" y="-3" fill="#CBD5E1" font-size="24">|</text>
            <text x="240" y="0" fill="#475569" font-size="19" font-weight="800">KOSDAQ</text>
            <text x="335" y="0" fill="${kosdaqColor}" font-size="32" font-weight="900" class="tabular">${kosdaqSign}${kosdaq.toFixed(2)}%</text>
            <text x="475" y="-3" fill="#CBD5E1" font-size="24">|</text>
            <text x="500" y="0" fill="#0F172A" font-size="19" font-weight="900">일반 ETF</text>
            <text x="595" y="0" fill="${etfColor}" font-size="32" font-weight="900" class="tabular">${etfSign}${etfReturn.toFixed(2)}%</text>
          </g>

          <text x="35" y="155" fill="#475569" font-size="16.5" font-weight="700">${escapeXml(regime.slide1Tip)}</text>
        </g>

        <!-- Pulse 2: Long/Short Themes -->
        <g transform="translate(40, ${p2Y})">
          <rect width="860" height="210" rx="20" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
          <text x="35" y="36" fill="#0F172A" font-size="21" font-weight="800">🔥 2. 오늘의 극과 극 테마</text>
          
          <rect x="635" y="14" width="190" height="36" rx="10" fill="#FFF7ED" stroke="#FDBA74" stroke-width="1.2"/>
          <text x="730" y="38" fill="#C2410C" font-size="15" font-weight="900" text-anchor="middle">테마 온도차 ${themeGap}%p ⚡</text>

          <!-- Left: 상승 1위 카드 -->
          <g transform="translate(35, 58)">
            <rect width="380" height="98" rx="14" fill="#FEF2F2" stroke="#FCA5A5" stroke-width="1.2"/>
            <text x="20" y="32" fill="#B42318" font-size="14.5" font-weight="900">상승 1위</text>
            <text x="20" y="66" fill="#0F172A" font-size="20" font-weight="900">${escapeXml(topTheme.peerGroup)}</text>
            <text x="360" y="62" fill="#D92D20" font-size="28" font-weight="900" text-anchor="end" class="tabular">+${(topTheme.cappedAumWeightedReturnPct ?? 0).toFixed(2)}%</text>
          </g>

          <!-- Right: 하락 1위 카드 -->
          <g transform="translate(445, 58)">
            <rect width="380" height="98" rx="14" fill="#EFF6FF" stroke="#93C5FD" stroke-width="1.2"/>
            <text x="20" y="32" fill="#175CD3" font-size="14.5" font-weight="900">하락 1위</text>
            <text x="20" y="66" fill="#0F172A" font-size="${bottomTheme.peerGroup.length > 14 ? 16.5 : (bottomTheme.peerGroup.length > 11 ? 18 : 20)}" font-weight="900">${escapeXml(bottomTheme.peerGroup)}</text>
            <text x="360" y="62" fill="#175CD3" font-size="28" font-weight="900" text-anchor="end" class="tabular">${(bottomTheme.cappedAumWeightedReturnPct ?? 0).toFixed(2)}%</text>
          </g>

          <text x="35" y="185" fill="#475569" font-size="15.5" font-weight="700">💡 ${escapeXml(topTheme.peerGroup)} +${(topTheme.cappedAumWeightedReturnPct ?? 0).toFixed(2)}% 선방 vs ${escapeXml(bottomTheme.peerGroup)} ${(bottomTheme.cappedAumWeightedReturnPct ?? 0).toFixed(2)}% 차익 실현</text>
        </g>

        <!-- Pulse 3: Top Inflow -->
        <g transform="translate(40, ${p3Y})">
          <rect width="860" height="185" rx="20" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5"/>
          <text x="35" y="36" fill="#1E293B" font-size="21" font-weight="800">🏦 3. 실질 자금 순유입 1위</text>
          
          <rect x="680" y="14" width="145" height="34" rx="10" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.2"/>
          <text x="752" y="37" fill="#1E293B" font-size="14.5" font-weight="900" text-anchor="middle">기관·외국인 합산</text>

          <text x="35" y="96" fill="#0F172A" font-size="${inflowFontSize}" font-weight="900">
            ${escapeXml(topInflow.name)} <tspan fill="#D92D20" font-size="${inflowFontSize}" font-weight="900" class="tabular">(+${(topInflow.inflow ?? 0).toLocaleString()}억원)</tspan>
          </text>

          <text x="35" y="148" fill="#475569" font-size="16.5" font-weight="700">💡 상위 5종목 총 ${top5InflowSum.toLocaleString()}억원 순유입 · 상세 순위는 4페이지에서 확인</text>
        </g>
      </g>

      <!-- Bottom Swipe CTA -->
      <g transform="translate(70, 1095)">
        <rect width="940" height="88" rx="24" fill="url(#brandGrad)"/>
        <text x="470" y="55" fill="#FFFFFF" font-size="24" font-weight="900" text-anchor="middle" letter-spacing="-0.5">
          옆으로 넘겨 3분 만에 오늘 시장 완벽 정리 👉
        </text>
        <rect x="805" y="24" width="90" height="40" rx="12" fill="#064E3B"/>
        <text x="850" y="50" fill="#A7F3D0" font-size="17" font-weight="900" text-anchor="middle" class="tabular">1 / 6</text>
      </g>

      <g transform="translate(540, 1265)">
        <text x="0" y="0" fill="#64748B" font-size="16" font-weight="600" text-anchor="middle">* 본 자료는 투자 판단을 돕기 위한 정보 제공용이며, 특정 종목의 매수·매도를 권유하지 않습니다.</text>
        <rect x="-215" y="14" width="430" height="40" rx="12" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
        <text x="0" y="40" fill="#1E293B" font-size="18" font-weight="900" text-anchor="middle" letter-spacing="0.5">ETF 캠퍼스 | https://etf-campus.pages.dev</text>
      </g>
    </svg>
  `;

  // =========================================================================
  // SLIDE 2: Theme Dynamics
  // =========================================================================
  const slide2Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${commonDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>

      <g transform="translate(70, 75)">
        <text x="0" y="30" fill="#2E6819" font-size="16" font-weight="900" letter-spacing="1">STEP 2. THEME DYNAMICS</text>
        <text x="0" y="68" fill="#0F172A" font-size="34" font-weight="900">오늘 시장 주도/부진 테마 TOP 3</text>
        <text x="0" y="98" fill="#64748B" font-size="16" font-weight="600">※ 테마별 AUM 가중수익률 기준 상위/하위 랭킹</text>
        <rect x="830" y="20" width="110" height="42" rx="14" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5"/>
        <text x="885" y="47" fill="#475569" font-size="18" font-weight="900" text-anchor="middle" class="tabular">2 / 6</text>
      </g>

      <!-- Summary Banner -->
      <g transform="translate(70, 190)" filter="url(#cardShadow)">
        <rect width="940" height="114" rx="22" fill="#FFFBEB" stroke="#FDE68A" stroke-width="1.5"/>
        <rect x="30" y="18" width="125" height="34" rx="10" fill="#FEF3C7" stroke="#FCD34D" stroke-width="1.2"/>
        <text x="92" y="41" fill="#B45309" font-size="17" font-weight="900" text-anchor="middle">🔥 테마 핵심</text>
        <text x="170" y="43" fill="#0F172A" font-size="30" font-weight="900">&apos;${escapeXml(topTheme.peerGroup)}&apos; 독주 vs &apos;${escapeXml(bottomTheme.peerGroup)}&apos; 조정</text>
        <text x="30" y="88" fill="#334155" font-size="22" font-weight="700">
          테마 간 수익률 격차 <tspan fill="#B45309" font-weight="900">${themeGap}%p</tspan>로 주도 섹터와 소외 섹터의 뚜렷한 차별화
        </text>
      </g>

      <!-- Panel 1: Top 3 Winners -->
      <g transform="translate(70, 315)" filter="url(#cardShadow)">
        <rect width="940" height="450" rx="26" fill="#FFFFFF" stroke="#FECDCA" stroke-width="1.5"/>
        <rect x="0" y="0" width="940" height="58" rx="26" fill="#FEF3F2"/>
        <text x="35" y="38" fill="#B42318" font-size="22" font-weight="900">🔥 오늘 시장을 이끈 TOP 3 주도 테마 (상승 랠리)</text>

        ${winners.map((w, idx) => `
          <g transform="translate(35, ${80 + idx * 115})">
            <rect width="870" height="102" rx="18" fill="#FAFDF4" stroke="#D7EABB" stroke-width="1.5"/>
            <circle cx="45" cy="51" r="23" fill="${idx === 0 ? '#D92D20' : '#FEE4E2'}"/>
            <text x="45" y="59" fill="${idx === 0 ? '#FFFFFF' : '#D92D20'}" font-size="20" font-weight="900" text-anchor="middle">${idx + 1}</text>
            <text x="85" y="44" fill="#0F172A" font-size="28" font-weight="900">${escapeXml(w.peerGroup)}</text>
            <text x="85" y="76" fill="#64748B" font-size="17" font-weight="600">총 ${w.etfCount}개 ETF 구성 | 자산군: ${escapeXml(w.assetClass || "국내주식")}</text>
            <text x="840" y="60" fill="#D92D20" font-size="38" font-weight="900" text-anchor="end" class="tabular">▲ +${(w.cappedAumWeightedReturnPct ?? 0).toFixed(2)}%</text>
          </g>
        `).join("")}
      </g>

      <!-- Panel 2: Bottom 3 Losers -->
      <g transform="translate(70, 785)" filter="url(#cardShadow)">
        <rect width="940" height="450" rx="26" fill="#FFFFFF" stroke="#BFDBFE" stroke-width="1.5"/>
        <rect x="0" y="0" width="940" height="58" rx="26" fill="#EFF6FF"/>
        <text x="35" y="38" fill="#1D4ED8" font-size="22" font-weight="900">❄️ 차익 실현 &amp; 매물 출회 BOTTOM 3 부진 테마</text>

        ${losers.map((l, idx) => `
          <g transform="translate(35, ${80 + idx * 115})">
            <rect width="870" height="102" rx="18" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5"/>
            <circle cx="45" cy="51" r="23" fill="${idx === 0 ? '#175CD3' : '#DBEAFE'}"/>
            <text x="45" y="59" fill="${idx === 0 ? '#FFFFFF' : '#175CD3'}" font-size="20" font-weight="900" text-anchor="middle">${idx + 1}</text>
            <text x="85" y="44" fill="#0F172A" font-size="28" font-weight="900">${escapeXml(l.peerGroup)}</text>
            <text x="85" y="76" fill="#64748B" font-size="17" font-weight="600">총 ${l.etfCount}개 ETF 구성 | 자산군: ${escapeXml(l.assetClass || "해외주식")}</text>
            <text x="840" y="60" fill="#175CD3" font-size="38" font-weight="900" text-anchor="end" class="tabular">▼ ${(l.cappedAumWeightedReturnPct ?? 0).toFixed(2)}%</text>
          </g>
        `).join("")}
      </g>

      <g transform="translate(540, 1265)">
        <text x="0" y="0" fill="#64748B" font-size="16" font-weight="600" text-anchor="middle">* 본 자료는 투자 판단을 돕기 위한 정보 제공용이며, 특정 종목의 매수·매도를 권유하지 않습니다.</text>
        <rect x="-215" y="14" width="430" height="40" rx="12" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
        <text x="0" y="40" fill="#1E293B" font-size="18" font-weight="900" text-anchor="middle" letter-spacing="0.5">ETF 캠퍼스 | https://etf-campus.pages.dev</text>
      </g>
    </svg>
  `;

  // =========================================================================
  // SLIDE 3: Asset Class Dynamics
  // =========================================================================
  const domesticStock = assetClasses.find(a => a.assetClass?.includes("국내") || a.assetClass?.includes("주식-국내"));
  const domRet = domesticStock?.aumWeightedReturnPct ?? -0.12;
  const domShare = domesticStock?.aumSharePct ?? 46.1;
  const domSign = domRet > 0 ? "+" : "";

  const sortedByRet = [...assetClasses].sort((a, b) => (b.aumWeightedReturnPct ?? 0) - (a.aumWeightedReturnPct ?? 0));
  const topAsset = sortedByRet[0] || { assetClass: "해외주식", aumWeightedReturnPct: 0.09 };
  const botAsset = sortedByRet[sortedByRet.length - 1] || { assetClass: "리츠·인프라", aumWeightedReturnPct: -0.72 };
  const topAssetSign = (topAsset.aumWeightedReturnPct ?? 0) > 0 ? "+" : "";

  const slide3Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${commonDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>

      <g transform="translate(70, 75)">
        <text x="0" y="30" fill="#2E6819" font-size="16" font-weight="900" letter-spacing="1">STEP 3. ASSET CLASS DYNAMICS</text>
        <text x="0" y="68" fill="#0F172A" font-size="34" font-weight="900">자산군별 수익률/기여도</text>
        <text x="0" y="96" fill="#64748B" font-size="16" font-weight="600">※ 자산군별 당일 가중수익률, 순자산 비중 및 시장 기여도 현황입니다.</text>
        <rect x="830" y="20" width="110" height="42" rx="14" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5"/>
        <text x="885" y="47" fill="#475569" font-size="18" font-weight="900" text-anchor="middle" class="tabular">3 / 6</text>
      </g>

      <!-- Summary Box (Data-Driven Dynamic) -->
      <g transform="translate(70, 190)" filter="url(#cardShadow)">
        <rect width="940" height="114" rx="22" fill="#F0FDF4" stroke="#BBF7D0" stroke-width="1.5"/>
        <rect x="30" y="18" width="135" height="34" rx="10" fill="#DCFCE7" stroke="#86EFAC" stroke-width="1.2"/>
        <text x="97" y="41" fill="#15803D" font-size="17" font-weight="900" text-anchor="middle">⚖️ 자산군 핵심</text>
        <text x="180" y="43" fill="#0F172A" font-size="28" font-weight="900">&apos;${escapeXml(topAsset.assetClass)}&apos; 상승 속 &apos;${escapeXml(botAsset.assetClass)}&apos; 조정</text>
        <text x="30" y="88" fill="#334155" font-size="21" font-weight="700">
          최대 비중(${(domShare ?? 0).toFixed(1)}%) 국내주식은 <tspan fill="${domRet >= 0 ? '#15803D' : '#175CD3'}" font-weight="900">${domSign}${(domRet ?? 0).toFixed(2)}% 숨고르기</tspan>, ${escapeXml(topAsset.assetClass)}(${topAssetSign}${(topAsset.aumWeightedReturnPct ?? 0).toFixed(2)}%)가 방어
        </text>
      </g>

      <!-- 6 Asset Classes List -->
      <g transform="translate(70, 315)">
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
            <g transform="translate(0, ${idx * 155})" filter="url(#cardShadow)">
              <rect width="940" height="145" rx="22" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
              <text x="35" y="48" fill="#0F172A" font-size="32" font-weight="900">${escapeXml(ac.assetClass)}</text>
              <text x="35" y="85" fill="#334155" font-size="21" font-weight="700">
                순자산 <tspan font-weight="900" fill="#0F172A">${aumJo}조원</tspan> (비중 <tspan font-weight="900" fill="#2E6819">${share.toFixed(1)}%</tspan>)
              </text>
              
              <rect x="35" y="105" width="380" height="12" rx="6" fill="#F1F5F9"/>
              <rect x="35" y="105" width="${Math.min(380, share * 3.8)}" height="12" rx="6" fill="#2E6819"/>
              
              <rect x="490" y="18" width="415" height="108" rx="16" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1"/>
              <text x="515" y="54" fill="#475569" font-size="20" font-weight="800">당일 가중수익률</text>
              <text x="880" y="56" fill="${retColor}" font-size="40" font-weight="900" text-anchor="end" class="tabular">${retSign}${ret.toFixed(2)}%</text>
              
              <text x="515" y="96" fill="#64748B" font-size="18" font-weight="700">시장 기여도</text>
              <text x="880" y="98" fill="${retColor}" font-size="22" font-weight="900" text-anchor="end" class="tabular">${contribSign}${contribution}%p</text>
            </g>
          `;
        }).join("")}
      </g>

      <g transform="translate(540, 1265)">
        <text x="0" y="0" fill="#64748B" font-size="16" font-weight="600" text-anchor="middle">* 본 자료는 투자 판단을 돕기 위한 정보 제공용이며, 특정 종목의 매수·매도를 권유하지 않습니다.</text>
        <rect x="-215" y="14" width="430" height="40" rx="12" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
        <text x="0" y="40" fill="#1E293B" font-size="18" font-weight="900" text-anchor="middle" letter-spacing="0.5">ETF 캠퍼스 | https://etf-campus.pages.dev</text>
      </g>
    </svg>
  `;

  // =========================================================================
  // SLIDE 4: Smart Money Flow (Theme: Crimson Rose & Red Inflow)
  // =========================================================================
  const slide4Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${commonDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>
      <circle cx="950" cy="180" r="300" fill="#D92D20" fill-opacity="0.035"/>
      <circle cx="100" cy="1150" r="260" fill="#BE123C" fill-opacity="0.03"/>

      <g transform="translate(70, 60)">
        <text x="0" y="30" fill="#D92D20" font-size="16" font-weight="900" letter-spacing="1">STEP 4. SMART MONEY FLOW</text>
        <text x="0" y="72" fill="#0F172A" font-size="38" font-weight="900">실질 자금 순유입 TOP 5</text>
        <text x="0" y="100" fill="#64748B" font-size="16" font-weight="600">※ 발행좌수 증감으로 산출된 기관·외국인의 실질 자금 순유입액</text>
        <rect x="830" y="18" width="110" height="42" rx="14" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5"/>
        <text x="885" y="45" fill="#475569" font-size="18" font-weight="900" text-anchor="middle" class="tabular">4 / 6</text>
      </g>

      <!-- Summary Banner (Data-Driven Dynamic) -->
      <g transform="translate(70, 180)" filter="url(#cardShadow)">
        <rect width="940" height="94" rx="22" fill="#FFF1F2" stroke="#FECDD3" stroke-width="1.5"/>
        <rect x="30" y="15" width="125" height="34" rx="10" fill="#FFE4E6" stroke="#FDA4AF" stroke-width="1.2"/>
        <text x="92" y="38" fill="#BE123C" font-size="17" font-weight="900" text-anchor="middle">💸 수급 핵심</text>
        <text x="170" y="37" fill="#0F172A" font-size="27" font-weight="900">스마트머니, &apos;${escapeXml(topInflow.name)}&apos; 및 &apos;미국 대표지수&apos; 집중 순유입</text>
        <text x="30" y="75" fill="#334155" font-size="20" font-weight="700">
          단기 숨고르기 속에서도 <tspan fill="#D92D20" font-weight="900">상위 5종목으로 총 ${top5InflowSum.toLocaleString()}억원</tspan> 실질 자금 순유입
        </text>
      </g>

      <!-- TOP 5 Inflow Ranking Cards (Crimson Palette) -->
      <g transform="translate(70, 290)">
        ${topInflows.slice(0, 5).map((item, idx) => {
          const inflowJo = item.inflow ? item.inflow.toLocaleString() : "1,000";
          const isTop = idx === 0;
          return `
            <g transform="translate(0, ${idx * 180})" filter="url(#cardShadow)">
              <rect width="940" height="168" rx="22" fill="${isTop ? '#FFF8F8' : '#FFFFFF'}" stroke="${isTop ? '#FCA5A5' : '#E2E8F0'}" stroke-width="${isTop ? '2' : '1.5'}"/>
              ${isTop ? '<rect x="0" y="0" width="8" height="168" rx="4" fill="#D92D20"/>' : ''}

              <!-- 순위 뱃지 -->
              <circle cx="58" cy="84" r="26" fill="${isTop ? '#D92D20' : '#F1F5F9'}" ${!isTop ? 'stroke="#E2E8F0" stroke-width="1.5"' : ''}/>
              <text x="58" y="93" fill="${isTop ? '#FFFFFF' : '#475569'}" font-size="22" font-weight="900" text-anchor="middle">${idx + 1}</text>

              <!-- ETF명 (말줄임 없이 풀네임 노출 + 동적 폰트 스케일링) -->
              <text x="100" y="68" fill="#0F172A" font-size="${item.name.length > 22 ? 21 : (item.name.length > 18 ? 23 : 26)}" font-weight="900">${escapeXml(item.name)}</text>

              <!-- 티커 -->
              <rect x="100" y="80" width="76" height="24" rx="6" fill="#F1F5F9" stroke="#E2E8F0" stroke-width="1"/>
              <text x="138" y="96" fill="#64748B" font-size="13" font-weight="700" text-anchor="middle" class="tabular">${item.ticker}</text>

              <!-- 테마 태그 -->
              <rect x="186" y="80" width="115" height="24" rx="6" fill="${isTop ? '#FFE4E6' : '#F8FAFC'}" stroke="${isTop ? '#FDA4AF' : '#E2E8F0'}" stroke-width="1"/>
              <text x="243" y="96" fill="${isTop ? '#BE123C' : '#64748B'}" font-size="13" font-weight="800" text-anchor="middle">${escapeXml(item.theme || "핵심ETF")}</text>

              <!-- 순유입 금액 -->
              <text x="912" y="76" fill="${isTop ? '#D92D20' : '#1E293B'}" font-size="40" font-weight="900" text-anchor="end" class="tabular">+${inflowJo}<tspan font-size="22" font-weight="700" fill="${isTop ? '#BE123C' : '#64748B'}">억원</tspan></text>
              <text x="912" y="108" fill="${isTop ? '#E11D48' : '#64748B'}" font-size="15" font-weight="800" text-anchor="end">${isTop ? '🥇 당일 최대 실질 순유입' : '순유입 상위 종목'}</text>
            </g>
          `;
        }).join("")}
      </g>

      <g transform="translate(540, 1265)">
        <text x="0" y="0" fill="#64748B" font-size="16" font-weight="600" text-anchor="middle">* 본 자료는 투자 판단을 돕기 위한 정보 제공용이며, 특정 종목의 매수·매도를 권유하지 않습니다.</text>
        <rect x="-215" y="14" width="430" height="40" rx="12" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
        <text x="0" y="40" fill="#1E293B" font-size="18" font-weight="900" text-anchor="middle" letter-spacing="0.5">ETF 캠퍼스 | https://etf-campus.pages.dev</text>
      </g>
    </svg>
  `;

  // =========================================================================
  // SLIDE 5: Disparity Alert (Dynamic Discount vs Premium Policy)
  // =========================================================================
  const disparityList = (payload.disparityWarning && payload.disparityWarning.length > 0) ? payload.disparityWarning : [];
  const discounts = disparityList.filter(d => d.disparityPct < 0);
  const premiums = disparityList.filter(d => d.disparityPct > 0);

  let disparityHeaderTitle = "괴리율 저평가(할인) 체크 종목";
  let disparityBannerTag = "🟢 저평가(할인) 체크";
  let disparityBannerTitle = `&apos;${escapeXml(disparityList[0]?.etfName || "차이나과창판STAR50")}&apos; 등 NAV 대비 할인 거래`;
  let disparityBannerDesc = "보유자는 헐값 매도에 유의하고, 매수자는 시차 착시 여부를 확인해야 합니다.";
  let disparityBannerTip = "LP 정상 호가 복귀 확인";

  if (disparityList.length === 0) {
    disparityHeaderTitle = "전 종목 괴리율 정상 (시장 안정 구간)";
    disparityBannerTag = "✨ 괴리율 안정";
    disparityBannerTitle = "국내 상장 일반 ETF 전 종목 정상 괴리율 범위 유지";
    disparityBannerDesc = "유동성공급자(LP)의 원활한 호가 공급으로 안정적인 가격이 형성되고 있습니다.";
    disparityBannerTip = "전 종목 정상 거래 중";
  } else if (premiums.length > 0 && discounts.length === 0) {
    disparityHeaderTitle = "괴리율 고평가(할증) 주의 종목";
    disparityBannerTag = "🔴 고평가(할증) 주의";
    disparityBannerTitle = `&apos;${escapeXml(disparityList[0]?.etfName || "")}&apos; 등 NAV 대비 비싼 할증 상태`;
    disparityBannerDesc = "단기 매수 과열로 시장가가 실제 가치보다 비쌉니다. 고점 추격 매수에 유의하세요.";
    disparityBannerTip = "고점 추격 매수 유의";
  } else if (premiums.length > 0 && discounts.length > 0) {
    disparityHeaderTitle = "괴리율 가격 왜곡 종목 TOP 5";
    disparityBannerTag = "⚠️ 왜곡 주의";
    disparityBannerTitle = `&apos;${escapeXml(disparityList[0]?.etfName || "")}&apos; 등 할인/할증 왜곡 발생`;
    disparityBannerDesc = "해외 시차 및 호가 공백으로 발생한 괴리율입니다. 급등락 추격 매매에 유의하세요.";
    disparityBannerTip = "정상 호가 확인 필수";
  }

  const slide5Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${commonDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>
      <circle cx="950" cy="180" r="300" fill="#EAB308" fill-opacity="0.04"/>
      <circle cx="100" cy="1150" r="260" fill="#F59E0B" fill-opacity="0.035"/>

      <g transform="translate(70, 60)">
        <text x="0" y="30" fill="#B45309" font-size="16" font-weight="900" letter-spacing="1">STEP 5. DISPARITY ALERT</text>
        <text x="0" y="72" fill="#0F172A" font-size="36" font-weight="900">${disparityHeaderTitle}</text>
        <text x="0" y="100" fill="#64748B" font-size="16" font-weight="600">※ 순자산가치(NAV) 대비 시장 종가의 가격 왜곡 정도를 나타냅니다.</text>
        <rect x="830" y="18" width="110" height="42" rx="14" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5"/>
        <text x="885" y="45" fill="#475569" font-size="18" font-weight="900" text-anchor="middle" class="tabular">5 / 6</text>
      </g>

      <!-- Alert Banner (Amber Warning Theme) -->
      <g transform="translate(70, 180)" filter="url(#cardShadow)">
        <rect width="940" height="94" rx="22" fill="#FFFBEB" stroke="#FDE68A" stroke-width="1.5"/>
        <rect x="30" y="15" width="160" height="34" rx="10" fill="#FEF3C7" stroke="#FCD34D" stroke-width="1.2"/>
        <text x="110" y="38" fill="#B45309" font-size="16" font-weight="900" text-anchor="middle">${disparityBannerTag}</text>
        <text x="205" y="37" fill="#0F172A" font-size="26" font-weight="900">${disparityBannerTitle}</text>
        <text x="30" y="75" fill="#334155" font-size="19" font-weight="700">
          ${disparityBannerDesc} <tspan fill="#B45309" font-weight="900">${disparityBannerTip}</tspan>
        </text>
      </g>

      <!-- Disparity List Cards (Amber Yellow Alert Palette) -->
      <g transform="translate(70, 290)">
        ${disparityList.slice(0, 5).map((d: any, idx: number) => {
          const isDiscount = d.disparityPct < 0;
          const badgeBg = isDiscount ? '#DCFCE7' : '#FEF3C7';
          const badgeText = isDiscount ? '#15803D' : '#B45309';
          const label = isDiscount ? '🟢 저평가 (Discount)' : '🔴 고평가 (Premium)';
          const sign = d.disparityPct > 0 ? "+" : "";
          const isTop = idx === 0;

          return `
            <g transform="translate(0, ${idx * 180})" filter="url(#cardShadow)">
              <rect width="940" height="168" rx="22" fill="${isTop ? '#FFFDF5' : '#FFFFFF'}" stroke="${isTop ? '#FCD34D' : '#E2E8F0'}" stroke-width="${isTop ? '2' : '1.5'}"/>
              ${isTop ? '<rect x="0" y="0" width="8" height="168" rx="4" fill="#D97706"/>' : ''}

              <!-- 순위 뱃지 -->
              <circle cx="58" cy="84" r="26" fill="${isTop ? '#D97706' : '#FEF3C7'}" ${!isTop ? 'stroke="#FDE68A" stroke-width="1.2"' : ''}/>
              <text x="58" y="93" fill="${isTop ? '#FFFFFF' : '#B45309'}" font-size="22" font-weight="900" text-anchor="middle">${idx + 1}</text>

              <!-- ETF명 (말줄임 없이 풀네임 노출 + 동적 폰트 스케일링) -->
              <text x="100" y="68" fill="#0F172A" font-size="${d.etfName.length > 22 ? 21 : (d.etfName.length > 18 ? 23 : 26)}" font-weight="900">${escapeXml(d.etfName)}</text>

              <!-- 티커 -->
              <rect x="100" y="80" width="76" height="24" rx="6" fill="#F1F5F9" stroke="#E2E8F0" stroke-width="1"/>
              <text x="138" y="96" fill="#64748B" font-size="13" font-weight="700" text-anchor="middle" class="tabular">${d.ticker}</text>

              <!-- 저/고평가 라벨 -->
              <rect x="186" y="80" width="170" height="24" rx="7" fill="${badgeBg}" stroke="${isDiscount ? '#BBF7D0' : '#FDE68A'}" stroke-width="1"/>
              <text x="271" y="96" fill="${badgeText}" font-size="13" font-weight="800" text-anchor="middle">${label}</text>

              <!-- 괴리율 수치 -->
              <text x="912" y="76" fill="${badgeText}" font-size="40" font-weight="900" text-anchor="end" class="tabular">${sign}${(d.disparityPct ?? 0).toFixed(2)}%</text>
              <text x="912" y="108" fill="#64748B" font-size="15" font-weight="700" text-anchor="end">NAV 대비 시장 괴리율</text>
            </g>
          `;
        }).join("")}
      </g>

      <g transform="translate(540, 1265)">
        <text x="0" y="0" fill="#64748B" font-size="16" font-weight="600" text-anchor="middle">* 본 자료는 투자 판단을 돕기 위한 정보 제공용이며, 특정 종목의 매수·매도를 권유하지 않습니다.</text>
        <rect x="-215" y="14" width="430" height="40" rx="12" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
        <text x="0" y="40" fill="#1E293B" font-size="18" font-weight="900" text-anchor="middle" letter-spacing="0.5">ETF 캠퍼스 | https://etf-campus.pages.dev</text>
      </g>
    </svg>
  `;

  // =========================================================================
  // SLIDE 6: Summary & Conversion Action CTA
  // =========================================================================
  const dateNum = parseInt((dateStr).slice(-1), 10) || 1;
  const ctaMap: Record<number, { icon: string; title: string; sub1: string; sub2: string; highlight: string }> = {
    0: { icon: "⚖️", title: "ETF 완벽 비교 (총보수/괴리율)", sub1: "같은 지수라도 운용사마다 총보수와 괴리율이 다릅니다.", sub2: "프로필 링크에서 내 계좌 ETF를 1초 만에 비교해 보세요.", highlight: "ETF 완벽 비교" },
    1: { icon: "🔍", title: "내 연금·ISA 계좌용 맞춤 ETF 탐색", sub1: "일반·연금 계좌, 자산군, 분배금 조건별 ETF 스크리닝", sub2: "안전하고 효율적인 절세 포트폴리오를 구성해 보세요.", highlight: "맞춤 ETF 탐색" },
    2: { icon: "📈", title: "ETF 테마 및 종목별 상세 분석", sub1: "테마별 순자산 규모와 거래대금, 구성종목 정밀 분석", sub2: "프로필 링크에서 시장 주도 ETF의 세부 정보를 확인하세요.", highlight: "ETF 상세 분석" },
    3: { icon: "⚖️", title: "ETF 완벽 비교 (총보수/괴리율)", sub1: "같은 지수라도 운용사마다 총보수와 괴리율이 다릅니다.", sub2: "프로필 링크에서 내 계좌 ETF를 1초 만에 비교해 보세요.", highlight: "ETF 완벽 비교" },
    4: { icon: "🔍", title: "내 연금·ISA 계좌용 맞춤 ETF 탐색", sub1: "일반·연금 계좌, 자산군, 분배금 조건별 ETF 스크리닝", sub2: "안전하고 효율적인 절세 포트폴리오를 구성해 보세요.", highlight: "맞춤 ETF 탐색" },
    5: { icon: "📈", title: "ETF 테마 및 종목별 상세 분석", sub1: "테마별 순자산 규모와 거래대금, 구성종목 정밀 분석", sub2: "프로필 링크에서 시장 주도 ETF의 세부 정보를 확인하세요.", highlight: "ETF 상세 분석" },
    6: { icon: "⚖️", title: "ETF 완벽 비교 (총보수/괴리율)", sub1: "같은 지수라도 운용사마다 총보수와 괴리율이 다릅니다.", sub2: "프로필 링크에서 내 계좌 ETF를 1초 만에 비교해 보세요.", highlight: "ETF 완벽 비교" },
    7: { icon: "🔍", title: "내 연금·ISA 계좌용 맞춤 ETF 탐색", sub1: "일반·연금 계좌, 자산군, 분배금 조건별 ETF 스크리닝", sub2: "안전하고 효율적인 절세 포트폴리오를 구성해 보세요.", highlight: "맞춤 ETF 탐색" },
    8: { icon: "📈", title: "ETF 테마 및 종목별 상세 분석", sub1: "테마별 순자산 규모와 거래대금, 구성종목 정밀 분석", sub2: "프로필 링크에서 시장 주도 ETF의 세부 정보를 확인하세요.", highlight: "ETF 상세 분석" },
    9: { icon: "⚖️", title: "ETF 완벽 비교 (총보수/괴리율)", sub1: "같은 지수라도 운용사마다 총보수와 괴리율이 다릅니다.", sub2: "프로필 링크에서 내 계좌 ETF를 1초 만에 비교해 보세요.", highlight: "ETF 완벽 비교" }
  };
  const activeCta = ctaMap[dateNum] || ctaMap[1];

  const slide6Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${commonDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>
      <circle cx="950" cy="180" r="300" fill="#2E6819" fill-opacity="0.04"/>
      <circle cx="100" cy="1150" r="260" fill="#10B981" fill-opacity="0.03"/>

      <!-- Header -->
      <g transform="translate(70, 55)">
        <text x="0" y="30" fill="#2E6819" font-size="16" font-weight="900" letter-spacing="1">STEP 6. SUMMARY &amp; NEXT ACTION</text>
        <text x="0" y="72" fill="#0F172A" font-size="38" font-weight="900">오늘 시장 총정리 &amp; 내 ETF 진단</text>
        <rect x="830" y="18" width="110" height="42" rx="14" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5"/>
        <text x="885" y="45" fill="#475569" font-size="18" font-weight="900" text-anchor="middle" class="tabular">6 / 6</text>
      </g>

      <!-- 1. 3-Bullet Market Summary Card (Expanded & High Readability) -->
      <g transform="translate(70, 155)" filter="url(#cardShadow)">
        <rect width="940" height="540" rx="28" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
        
        <!-- Block 1 -->
        <g transform="translate(25, 22)">
          <rect width="890" height="150" rx="20" fill="#F0FDF4" stroke="#DCFCE7" stroke-width="1.2"/>
          <rect x="24" y="22" width="52" height="34" rx="9" fill="#DCFCE7" stroke="#86EFAC" stroke-width="1"/>
          <text x="50" y="46" fill="#15803D" font-size="20" font-weight="900" font-family="monospace" text-anchor="middle">01</text>
          
          <text x="90" y="48" fill="#0F172A" font-size="28" font-weight="900">${escapeXml(regime.slide6Block1Title)}</text>
          <text x="24" y="104" fill="#334155" font-size="20" font-weight="700">${escapeXml(regime.slide6Block1Desc)}</text>
        </g>

        <!-- Block 2 -->
        <g transform="translate(25, 192)">
          <rect width="890" height="150" rx="20" fill="#FFF1F2" stroke="#FECDD3" stroke-width="1.2"/>
          <rect x="24" y="22" width="52" height="34" rx="9" fill="#FFE4E6" stroke="#FDA4AF" stroke-width="1"/>
          <text x="50" y="46" fill="#BE123C" font-size="20" font-weight="900" font-family="monospace" text-anchor="middle">02</text>
          
          <text x="90" y="48" fill="#0F172A" font-size="28" font-weight="900">&apos;${escapeXml(topTheme.peerGroup)}&apos; 반등 vs &apos;${escapeXml(bottomTheme.peerGroup)}&apos; 차익실현</text>
          <text x="24" y="104" fill="#334155" font-size="21" font-weight="700">주도 테마 간 수익률 격차가 ${themeGap}%p까지 벌어지는 강한 섹터 로테이션 전개.</text>
        </g>

        <!-- Block 3 -->
        <g transform="translate(25, 362)">
          <rect width="890" height="150" rx="20" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="1.2"/>
          <rect x="24" y="22" width="52" height="34" rx="9" fill="#DBEAFE" stroke="#93C5FD" stroke-width="1"/>
          <text x="50" y="46" fill="#1D4ED8" font-size="20" font-weight="900" font-family="monospace" text-anchor="middle">03</text>
          
          <text x="90" y="48" fill="#0F172A" font-size="25" font-weight="900">스마트머니, &apos;${escapeXml(topInflow.name)}&apos; +${(topInflow.inflow ?? 0).toLocaleString()}억원 집중 순유입</text>
          <text x="24" y="104" fill="#334155" font-size="21" font-weight="700">국내 대표지수(KODEX 200) 및 미국 대표지수 분할 매수 자금 유입 집중.</text>
        </g>
      </g>

      <!-- 2. Pure Market Watch Point & KRX Public Data Notice (Light Premium Background) -->
      <g transform="translate(70, 720)" filter="url(#cardShadow)">
        <rect width="940" height="510" rx="28" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
        
        <g transform="translate(0, 0)">
          <!-- Top Mini Tag (Forest Emerald) -->
          <rect x="330" y="26" width="280" height="40" rx="20" fill="#F0FDF4" stroke="#BBF7D0" stroke-width="1.2"/>
          <text x="470" y="52" fill="#15803D" font-size="18" font-weight="900" text-anchor="middle">🧭 오늘의 시장 관전 포인트</text>
          
          <!-- Main Action Headline (High-Contrast Slate Navy) -->
          <text x="470" y="110" fill="#0F172A" font-size="34" font-weight="900" text-anchor="middle" letter-spacing="-0.8">
            오늘 장 시작 전 3대 핵심 체크리스트
          </text>

          <!-- 3 Value Watch Points (Light Tinted Cards with Vivid Accent Badges) -->
          <g transform="translate(35, 136)">
            <!-- Item 1: 거시 변수 -->
            <g transform="translate(0, 0)">
              <rect width="870" height="84" rx="18" fill="#F0F9FF" stroke="#BAE6FD" stroke-width="1.2"/>
              <rect x="20" y="20" width="130" height="44" rx="12" fill="#0284C7"/>
              <text x="85" y="48" fill="#FFFFFF" font-size="19" font-weight="900" text-anchor="middle">01 거시 변수</text>
              <text x="175" y="51" fill="#0F172A" font-size="21" font-weight="800">원/달러 환율 추이 및 미 국채 금리 안정 여부에 따른 외인 수급 점검</text>
            </g>

            <!-- Item 2: 섹터 순환 -->
            <g transform="translate(0, 98)">
              <rect width="870" height="84" rx="18" fill="#F0FDF4" stroke="#BBF7D0" stroke-width="1.2"/>
              <rect x="20" y="20" width="130" height="44" rx="12" fill="#16A34A"/>
              <text x="85" y="48" fill="#FFFFFF" font-size="19" font-weight="900" text-anchor="middle">02 섹터 순환</text>
              <text x="175" y="51" fill="#0F172A" font-size="21" font-weight="800">주도 테마의 연속성 확인 및 고베타 섹터 차익 매물 소화 과정 관찰</text>
            </g>

            <!-- Item 3: 스마트머니 -->
            <g transform="translate(0, 196)">
              <rect width="870" height="84" rx="18" fill="#FFFBEB" stroke="#FDE68A" stroke-width="1.2"/>
              <rect x="20" y="20" width="130" height="44" rx="12" fill="#D97706"/>
              <text x="85" y="48" fill="#FFFFFF" font-size="19" font-weight="900" text-anchor="middle">03 스마트머니</text>
              <text x="175" y="51" fill="#0F172A" font-size="21" font-weight="800">대표지수 및 방어적 자산(금리/배당)으로의 기관 저가 매수세 추적</text>
            </g>
          </g>

          <!-- Bottom Public Data Source Box (Crisp Slate Light Gray) -->
          <g transform="translate(35, 436)">
            <rect width="870" height="52" rx="14" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1"/>
            <text x="435" y="33" fill="#475569" font-size="18" font-weight="800" text-anchor="middle">
              📊 한국거래소(KRX) 전 거래일 마감 공시 기준 (국내 상장 일반 ETF ${generalCount.toLocaleString()}개 전수 분석)
            </text>
          </g>
        </g>
      </g>

      <!-- Footer Disclaimer -->
      <g transform="translate(540, 1265)">
        <text x="0" y="0" fill="#64748B" font-size="16" font-weight="600" text-anchor="middle">* 본 자료는 순수 정보 제공용 시황 칼럼이며, 특정 종목의 매수·매도를 권유하지 않습니다.</text>
        <rect x="-215" y="14" width="430" height="40" rx="12" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
        <text x="0" y="40" fill="#1E293B" font-size="18" font-weight="900" text-anchor="middle" letter-spacing="0.5">ETF 캠퍼스 마켓 브리핑</text>
      </g>
    </svg>
  `;

  return [
    { slideNumber: 1, title: "Cover", subtitle: "1초 후킹 표지 & 3대 핵심 펄스", svgContent: slide1Svg },
    { slideNumber: 2, title: "Theme Dynamics", subtitle: "주도 테마 TOP 3 vs 부진 테마", svgContent: slide2Svg },
    { slideNumber: 3, title: "Asset Class Dynamics", subtitle: "자산군별 수익률/기여도", svgContent: slide3Svg },
    { slideNumber: 4, title: "Smart Money Flow", subtitle: "실질 자금 순유입 TOP 5", svgContent: slide4Svg },
    { slideNumber: 5, title: "Disparity Alert", subtitle: "괴리율 고평가/저평가 TOP 3", svgContent: slide5Svg },
    { slideNumber: 6, title: "Summary & Watch Point", subtitle: "오늘 시장 3대 체크리스트 & 관전 포인트", svgContent: slide6Svg },
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
    ? `\n\n2. 💸 스마트머니 순유입:\n${topInflows.map(i => {
        const name = i.name || (i as any).etfName || "대표지수";
        const val = i.inflow ?? ((i as any).netInflowValue ? Math.round((i as any).netInflowValue / 100000000) : 0);
        return `• ${name} +${(val || 0).toLocaleString()}억 원`;
      }).join('\n')}` 
    : "";

  const strongThemes = payload.peerGroups?.filter(p => p.cappedAumWeightedReturnPct > 0).slice(0, 2) || [];
  const weakThemes = payload.peerGroups?.filter(p => p.cappedAumWeightedReturnPct < 0).slice(-2).reverse() || [];
  
  const strongText = strongThemes.length > 0 
    ? strongThemes.map(t => `${t.peerGroup.replace(/\s*\([^)]*\)/g, '')} +${(t.cappedAumWeightedReturnPct ?? 0).toFixed(2)}%`).join(', ') 
    : "에너지 +0.93%, 고배당 +0.85%";

  const weakText = weakThemes.length > 0
    ? weakThemes.map(t => `${t.peerGroup.replace(/\s*\([^)]*\)/g, '')} ${(t.cappedAumWeightedReturnPct ?? 0).toFixed(2)}%`).join(', ')
    : "K-푸드 -4.07%, K-방산 -2.68%";

  const formattedDate = (payload.asOfDate || "2026.08.31").replace(/-/g, '.');

  return `📌 ${formattedDate} 국내 상장 일반 ETF ${generalCount.toLocaleString()}개 마켓 동향 ☕

${regime.captionOpening}

${regime.captionMarketSummary}

[지난 장 국내 ETF 시장 3대 핵심 동향]

1. 📈 테마군 수익률 명암:
• 상승 테마: ${strongText}
• 조정 테마: ${weakText}${inflowText}

3. 🧭 시장 흐름 & 테마 분석:
• ${regime.captionThemeAnalysis || "단기 숨고르기 속에서도 국내외 대표지수로 저가 분할 매수 지속"}

💡 [오늘의 시장 관전 포인트]
${regime.captionWatchPoint || "변동성이 확대된 국면에서는 지수 등락 자체보다 섹터 간 자금 이동 경로와 방어적 자산의 완충력을 관찰하는 것이 유효합니다."}

💬 오늘 개장 후 여러분이 가장 주목하고 계신 테마나 지표는 무엇인가요? 댓글로 자유롭게 의견을 나눠주세요! 👇

📊 데이터 출처: 한국거래소(KRX) 전 거래일 마감 공시 데이터 기준 (국내 상장 일반 ETF ${generalCount.toLocaleString()}개 전수 분석). 본 콘텐츠는 순수 시황 분석 정보 제공 목적이며 투자 권유가 아닙니다.

#ETF캠퍼스 #국내상장ETF #ETF투자 #퇴직연금 #IRP #ISA #자산배분 #스마트머니 #마켓브리핑`;
}
