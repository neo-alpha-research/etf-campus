import type { MarketBriefingPayload } from "../types";

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

export function generateInstagramCarousel(payload: MarketBriefingPayload, baseUrl: string): InstagramSlide[] {
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
  // SLIDE 1: Cover & 3 Key Pulses
  // =========================================================================
  const slide1Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${commonDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>
      <circle cx="950" cy="180" r="320" fill="#2E6819" fill-opacity="0.04"/>
      <circle cx="120" cy="1150" r="260" fill="#0284C7" fill-opacity="0.03"/>

      <!-- Header -->
      <g transform="translate(70, 70)">
        <text x="0" y="28" fill="#2E6819" font-size="15" font-weight="900" letter-spacing="1">STEP 1. TODAY'S MARKET</text>
        <text x="0" y="62" fill="#0F172A" font-size="32" font-weight="900">ETF 데일리 브리핑</text>
        <rect x="780" y="18" width="160" height="40" rx="12" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
        <text x="860" y="44" fill="#475569" font-size="17" font-weight="900" text-anchor="middle" class="tabular">${formattedDate}</text>
      </g>

      <!-- Main Hero Card -->
      <g transform="translate(70, 140)" filter="url(#softShadow)">
        <rect width="940" height="925" rx="32" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2"/>
        
        <rect x="40" y="32" width="280" height="34" rx="10" fill="#F1F5F9" stroke="#E2E8F0" stroke-width="1"/>
        <text x="55" y="55" fill="#334155" font-size="15" font-weight="800">KRX 상장 일반 ETF ${generalCount}개 전수 분석</text>

        <!-- Hooking Headline (Factually Precise: Theme Return vs Smart Money Inflow) -->
        <g transform="translate(40, 115)">
          <text x="0" y="0" fill="#0F172A" font-size="46" font-weight="900" letter-spacing="-1">코스피 ${kospiSign}${kospi.toFixed(2)}% vs ETF ${etfSign}${etfReturn.toFixed(2)}%</text>
          <text x="0" y="44" fill="#1D4ED8" font-size="27" font-weight="800" letter-spacing="-0.5">'${escapeXml(topTheme.peerGroup.replace(/\s*\([^)]*\)/g, ''))}' 테마 상승 속 '국내 대표지수'로 스마트머니 유입 🔍</text>
        </g>

        <line x1="40" y1="185" x2="900" y2="185" stroke="#F1F5F9" stroke-width="2"/>

        <!-- Pulse 1: Market Temperature -->
        <g transform="translate(40, 205)">
          <rect width="860" height="195" rx="20" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5"/>
          <text x="35" y="38" fill="#334155" font-size="20" font-weight="800">🌡️ 1. 시장 체온 &amp; 지수 대비 성과</text>
          
          <rect x="535" y="15" width="290" height="38" rx="12" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.2"/>
          <text x="680" y="40" font-size="16" font-weight="900" text-anchor="middle">
            <tspan fill="#D92D20">상승 ${up}</tspan><tspan fill="#94A3B8"> · </tspan><tspan fill="#64748B">보합 ${flat}</tspan><tspan fill="#94A3B8"> · </tspan><tspan fill="#175CD3">하락 ${down}</tspan>
          </text>

          <g transform="translate(35, 95)">
            <text x="0" y="0" fill="#64748B" font-size="18" font-weight="700">KOSPI</text>
            <text x="70" y="0" fill="${kospiColor}" font-size="30" font-weight="900" class="tabular">${kospiSign}${kospi.toFixed(2)}%</text>
            
            <text x="215" y="-3" fill="#CBD5E1" font-size="24">|</text>
            
            <text x="240" y="0" fill="#64748B" font-size="18" font-weight="700">KOSDAQ</text>
            <text x="330" y="0" fill="${kosdaqColor}" font-size="30" font-weight="900" class="tabular">${kosdaqSign}${kosdaq.toFixed(2)}%</text>
            
            <text x="475" y="-3" fill="#CBD5E1" font-size="24">|</text>
            
            <text x="500" y="0" fill="#0F172A" font-size="18" font-weight="800">일반 ETF</text>
            <text x="590" y="0" fill="${etfColor}" font-size="30" font-weight="900" class="tabular">${etfSign}${etfReturn.toFixed(2)}%</text>
          </g>

          <text x="35" y="160" fill="#64748B" font-size="16" font-weight="700">💡 KOSPI ${kospiSign}${kospi.toFixed(2)}% vs 일반 ETF ${etfSign}${etfReturn.toFixed(2)}% · 중소형주 조정으로 지수 대비 숨고르기</text>
        </g>

        <!-- Pulse 2: Long/Short Themes (2-Column Comparative Split Cards) -->
        <g transform="translate(40, 420)">
          <rect width="860" height="215" rx="20" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
          <text x="35" y="38" fill="#0F172A" font-size="20" font-weight="800">🔥 2. 오늘의 극과 극 테마</text>
          
          <rect x="640" y="16" width="185" height="34" rx="10" fill="#FFF7ED" stroke="#FDBA74" stroke-width="1.2"/>
          <text x="732" y="39" fill="#C2410C" font-size="14" font-weight="900" text-anchor="middle">테마 온도차 ${themeGap}%p ⚡</text>

          <!-- Left: 상승 1위 카드 -->
          <g transform="translate(35, 60)">
            <rect width="380" height="100" rx="14" fill="#FEF2F2" stroke="#FCA5A5" stroke-width="1.2"/>
            <text x="20" y="34" fill="#B42318" font-size="14" font-weight="900">상승 1위</text>
            <text x="20" y="68" fill="#0F172A" font-size="${topTheme.peerGroup.length > 14 ? 16 : (topTheme.peerGroup.length > 11 ? 17.5 : 19)}" font-weight="900">${escapeXml(topTheme.peerGroup)}</text>
            <text x="360" y="64" fill="#D92D20" font-size="26" font-weight="900" text-anchor="end" class="tabular">+${topTheme.cappedAumWeightedReturnPct.toFixed(2)}%</text>
          </g>

          <!-- Right: 하락 1위 카드 -->
          <g transform="translate(445, 60)">
            <rect width="380" height="100" rx="14" fill="#EFF6FF" stroke="#93C5FD" stroke-width="1.2"/>
            <text x="20" y="34" fill="#175CD3" font-size="14" font-weight="900">하락 1위</text>
            <text x="20" y="68" fill="#0F172A" font-size="${bottomTheme.peerGroup.length > 14 ? 16 : (bottomTheme.peerGroup.length > 11 ? 17.5 : 19)}" font-weight="900">${escapeXml(bottomTheme.peerGroup)}</text>
            <text x="360" y="64" fill="#175CD3" font-size="26" font-weight="900" text-anchor="end" class="tabular">${bottomTheme.cappedAumWeightedReturnPct.toFixed(2)}%</text>
          </g>

          <text x="35" y="190" fill="#64748B" font-size="15" font-weight="700">💡 ${topTheme.peerGroup} +${topTheme.cappedAumWeightedReturnPct.toFixed(2)}% 선방 vs ${bottomTheme.peerGroup} ${bottomTheme.cappedAumWeightedReturnPct.toFixed(2)}% 차익 실현</text>
        </g>

        <!-- Pulse 3: Top Inflow -->
        <g transform="translate(40, 655)">
          <rect width="860" height="185" rx="20" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5"/>
          <text x="35" y="38" fill="#334155" font-size="20" font-weight="800">🏦 3. 실질 자금 순유입 1위</text>
          
          <rect x="685" y="16" width="140" height="34" rx="10" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.2"/>
          <text x="755" y="39" fill="#1E293B" font-size="14" font-weight="900" text-anchor="middle">기관·외국인 합산</text>

          <text x="35" y="98" fill="#0F172A" font-size="30" font-weight="900">
            ${topInflow.name} <tspan fill="#D92D20" font-size="28" font-weight="900" class="tabular">(+${topInflow.inflow?.toLocaleString() || "1,130"}억원)</tspan>
          </text>

          <text x="35" y="148" fill="#64748B" font-size="16" font-weight="700">💡 상위 5종목 총 ${top5InflowSum.toLocaleString()}억원 순유입 · 상세 순위는 4페이지에서 확인</text>
        </g>
      </g>

      <!-- Bottom Swipe CTA -->
      <g transform="translate(70, 1095)">
        <rect width="940" height="88" rx="24" fill="url(#brandGrad)"/>
        <text x="470" y="54" fill="#FFFFFF" font-size="23" font-weight="900" text-anchor="middle" letter-spacing="-0.5">
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
        <text x="170" y="43" fill="#0F172A" font-size="30" font-weight="900">'${topTheme.peerGroup}' 독주 vs '${bottomTheme.peerGroup}' 조정</text>
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
            <text x="85" y="44" fill="#0F172A" font-size="28" font-weight="900">${w.peerGroup}</text>
            <text x="85" y="76" fill="#64748B" font-size="17" font-weight="600">총 ${w.etfCount}개 ETF 구성 | 자산군: ${w.assetClass || "국내주식"}</text>
            <text x="840" y="60" fill="#D92D20" font-size="38" font-weight="900" text-anchor="end" class="tabular">▲ +${w.cappedAumWeightedReturnPct.toFixed(2)}%</text>
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
            <text x="85" y="44" fill="#0F172A" font-size="28" font-weight="900">${l.peerGroup}</text>
            <text x="85" y="76" fill="#64748B" font-size="17" font-weight="600">총 ${l.etfCount}개 ETF 구성 | 자산군: ${l.assetClass || "해외주식"}</text>
            <text x="840" y="60" fill="#175CD3" font-size="38" font-weight="900" text-anchor="end" class="tabular">▼ ${l.cappedAumWeightedReturnPct.toFixed(2)}%</text>
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
        <text x="180" y="43" fill="#0F172A" font-size="28" font-weight="900">'${topAsset.assetClass}' 상승 속 '${botAsset.assetClass}' 조정</text>
        <text x="30" y="88" fill="#334155" font-size="21" font-weight="700">
          최대 비중(${(domShare ?? 0).toFixed(1)}%) 국내주식은 <tspan fill="${domRet >= 0 ? '#15803D' : '#175CD3'}" font-weight="900">${domSign}${(domRet ?? 0).toFixed(2)}% 숨고르기</tspan>, ${topAsset.assetClass}(${topAssetSign}${(topAsset.aumWeightedReturnPct ?? 0).toFixed(2)}%)가 방어
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
              <text x="35" y="48" fill="#0F172A" font-size="32" font-weight="900">${ac.assetClass}</text>
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
        <text x="170" y="37" fill="#0F172A" font-size="27" font-weight="900">스마트머니, '${topInflow.name}' 및 '미국 대표지수' 집중 순유입</text>
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
              <text x="243" y="96" fill="${isTop ? '#BE123C' : '#64748B'}" font-size="13" font-weight="800" text-anchor="middle">${item.theme || "핵심ETF"}</text>

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
  let disparityBannerTitle = `'${disparityList[0]?.etfName || "차이나과창판STAR50"}' 등 NAV 대비 할인 거래`;
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
    disparityBannerTitle = `'${disparityList[0]?.etfName}' 등 NAV 대비 비싼 할증 상태`;
    disparityBannerDesc = "단기 매수 과열로 시장가가 실제 가치보다 비쌉니다. 고점 추격 매수에 유의하세요.";
    disparityBannerTip = "고점 추격 매수 유의";
  } else if (premiums.length > 0 && discounts.length > 0) {
    disparityHeaderTitle = "괴리율 가격 왜곡 종목 TOP 5";
    disparityBannerTag = "⚠️ 왜곡 주의";
    disparityBannerTitle = `'${disparityList[0]?.etfName}' 등 할인/할증 왜곡 발생`;
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
          
          <text x="90" y="48" fill="#0F172A" font-size="28" font-weight="900">코스피 ${kospiSign}${kospi.toFixed(2)}% vs 일반 ETF ${etfSign}${etfReturn.toFixed(2)}% 혼조세</text>
          <text x="24" y="104" fill="#334155" font-size="20" font-weight="700">국내 대형주 지지 속 일반 ETF는 상승 ${up}개 · 보합 ${flat}개 · 하락 ${down}개로 소폭 약세 흐름.</text>
        </g>

        <!-- Block 2 -->
        <g transform="translate(25, 192)">
          <rect width="890" height="150" rx="20" fill="#FFF1F2" stroke="#FECDD3" stroke-width="1.2"/>
          <rect x="24" y="22" width="52" height="34" rx="9" fill="#FFE4E6" stroke="#FDA4AF" stroke-width="1"/>
          <text x="50" y="46" fill="#BE123C" font-size="20" font-weight="900" font-family="monospace" text-anchor="middle">02</text>
          
          <text x="90" y="48" fill="#0F172A" font-size="28" font-weight="900">'${topTheme.peerGroup}' 반등 vs '${bottomTheme.peerGroup}' 차익실현</text>
          <text x="24" y="104" fill="#334155" font-size="21" font-weight="700">주도 테마 간 수익률 격차가 ${themeGap}%p까지 벌어지는 강한 섹터 로테이션 전개.</text>
        </g>

        <!-- Block 3 -->
        <g transform="translate(25, 362)">
          <rect width="890" height="150" rx="20" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="1.2"/>
          <rect x="24" y="22" width="52" height="34" rx="9" fill="#DBEAFE" stroke="#93C5FD" stroke-width="1"/>
          <text x="50" y="46" fill="#1D4ED8" font-size="20" font-weight="900" font-family="monospace" text-anchor="middle">03</text>
          
          <text x="90" y="48" fill="#0F172A" font-size="25" font-weight="900">스마트머니, '${topInflow.name}' +${topInflow.inflow ? topInflow.inflow.toLocaleString() : "1,130"}억원 집중 순유입</text>
          <text x="24" y="104" fill="#334155" font-size="21" font-weight="700">국내 대표지수(KODEX 200) 및 미국 대표지수 분할 매수 자금 유입 집중.</text>
        </g>
      </g>

      <!-- 2. Grand Hero CTA Card (Soft Slate Navy & Gentle Butter Pastel Gold) -->
      <g transform="translate(70, 720)" filter="url(#softShadow)">
        <rect width="940" height="510" rx="30" fill="url(#midnightNavyGrad)" stroke="#64748B" stroke-width="1.5"/>
        <circle cx="850" cy="100" r="180" fill="#38BDF8" fill-opacity="0.06"/>
        <circle cx="120" cy="420" r="150" fill="#FEF08A" fill-opacity="0.04"/>
        
        <g transform="translate(0, 0)">
          <!-- Top Mini Tag (Larger & More Prominent) -->
          <rect x="270" y="32" width="400" height="48" rx="24" fill="#475569" stroke="#64748B" stroke-width="1.2"/>
          <text x="470" y="63" fill="#FEF08A" font-size="21" font-weight="900" text-anchor="middle">💡 100% 무료 ETF 시황 &amp; 마켓 브리핑</text>
          
          <!-- Main Action Headline -->
          <text x="470" y="136" fill="#FFFFFF" font-size="36" font-weight="900" text-anchor="middle" letter-spacing="-0.8">
            내 계좌 속 ETF, 지금 바로 비교해 보세요!
          </text>

          <!-- 3 Value Props (Left-Aligned Starting at x=175, Font Size 24px) -->
          <g transform="translate(0, 152)">
            <text x="175" y="40" fill="#E2E8F0" font-size="24" font-weight="700" text-anchor="start">
              ✨  <tspan font-weight="900" fill="#FFFFFF">1,022개 일반 ETF</tspan> 총보수 &amp; 괴리율 1초 완벽 비교
            </text>
            <text x="175" y="82" fill="#E2E8F0" font-size="24" font-weight="700" text-anchor="start">
              ✨  주도 테마별 등락 동향부터 스마트머니 자금 유입까지
            </text>
            <text x="175" y="124" fill="#E2E8F0" font-size="24" font-weight="700" text-anchor="start">
              ✨  매일 아침 업데이트되는 기관·외국인 수급 전수 분석
            </text>
          </g>

          <!-- Big Action Button (Soft Gentle Butter Pastel Gold Gradient) -->
          <g transform="translate(100, 325)">
            <rect width="740" height="92" rx="26" fill="url(#goldButtonGrad)" stroke="#FDE047" stroke-width="1.5" filter="url(#goldGlow)"/>
            <text x="370" y="58" fill="#78350F" font-size="30" font-weight="900" text-anchor="middle" letter-spacing="-0.5">
              👉 프로필 링크 'ETF 캠퍼스' 바로가기 🔗
            </text>
          </g>

          <!-- Sub Guarantee (Crisp Silver Slate) -->
          <text x="470" y="464" fill="#CBD5E1" font-size="20" font-weight="800" text-anchor="middle">
            별도 가입 없이 프로필 링크에서 누구나 즉시 무료로 확인하실 수 있습니다.
          </text>
        </g>
      </g>

      <!-- Footer Disclaimer -->
      <g transform="translate(540, 1265)">
        <text x="0" y="0" fill="#64748B" font-size="16" font-weight="600" text-anchor="middle">* 본 자료는 투자 판단을 돕기 위한 정보 제공용이며, 특정 종목의 매수·매도를 권유하지 않습니다.</text>
        <rect x="-215" y="14" width="430" height="40" rx="12" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
        <text x="0" y="40" fill="#1E293B" font-size="18" font-weight="900" text-anchor="middle" letter-spacing="0.5">ETF 캠퍼스 | https://etf-campus.pages.dev</text>
      </g>
    </svg>
  `;

  return [
    { slideNumber: 1, title: "Cover", subtitle: "1초 후킹 표지 & 3대 핵심 펄스", svgContent: slide1Svg },
    { slideNumber: 2, title: "Theme Dynamics", subtitle: "주도 테마 TOP 3 vs 부진 테마", svgContent: slide2Svg },
    { slideNumber: 3, title: "Asset Class Dynamics", subtitle: "자산군별 수익률/기여도", svgContent: slide3Svg },
    { slideNumber: 4, title: "Smart Money Flow", subtitle: "실질 자금 순유입 TOP 5", svgContent: slide4Svg },
    { slideNumber: 5, title: "Disparity Alert", subtitle: "괴리율 고평가/저평가 TOP 3", svgContent: slide5Svg },
    { slideNumber: 6, title: "Summary & Action", subtitle: "오늘 시장 3대 체크리스트 & 완벽 비교", svgContent: slide6Svg },
  ];
}

export function generateInstagramCaption(payload: MarketBriefingPayload): string {
  const dateStr = payload.asOfDate || "2026.08.31";
  const kospiChangePct = payload.kospiChangePct ?? 0.46;
  const etfReturn = payload.generalAumWeightedReturnPct ?? -0.28;
  const generalCount = payload.generalEtfCount ?? 1022;
  const up = payload.upCount ?? 305;
  const flat = payload.flatCount ?? 47;
  const down = payload.downCount ?? 670;
  
  const etfSign = etfReturn > 0 ? "+" : "";
  const sign = kospiChangePct > 0 ? "+" : "";
  
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

코스피는 ${sign}${kospiChangePct.toFixed(2)}% 소폭 상승 마감했지만, 국내 상장 일반 ETF ${generalCount.toLocaleString()}개 시장을 전수 분석한 결과는 사뭇 달랐습니다.

상승 ${up}개 대비 하락 ${down}개로 하락 종목이 우세했으며, 일반 ETF 시장 전체 평균 수익률은 ${etfSign}${etfReturn.toFixed(2)}%로 차별화된 숨고르기 장세를 보였습니다. 📊

[지난 장 국내 ETF 시장 3대 핵심 동향]

1. 📈 테마군 수익률 명암:
• 상승 테마: ${strongText}
• 조정 테마: ${weakText}${inflowText}

3. 🧭 시장 흐름:
• 단기 숨고르기 속에서도 국내외 대표지수로 저가 분할 매수 지속

지수의 겉모습만으로는 내 계좌 속 ETF 흐름을 다 알 수 없습니다. 1,022개 ETF 전수 데이터로 시장의 진짜 수급과 맥박을 확인해 보세요. 📱

💬 어제 여러분의 포트폴리오에서 가장 든든했던 테마는 어디였나요? 댓글로 나눠주세요! 👇

🔗 프로필 링크에서 매일 장 시작 전 1,022개 일반 ETF 완벽 비교 & 마켓 브리핑 전체 리포트를 무료로 확인하세요!

#ETF캠퍼스 #국내상장ETF #ETF투자 #퇴직연금 #IRP #ISA #자산배분 #스마트머니 #마켓브리핑`;
}
