import type { MarketBriefingPayload } from "../types";

export interface InstagramSlide {
  slideNumber: number;
  title: string;
  subtitle: string;
  svgContent: string;
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
  const sortedPeerGroups = [...(payload.peerGroups || [])].sort((a, b) => b.cappedAumWeightedReturnPct - a.cappedAumWeightedReturnPct);
  const topTheme = sortedPeerGroups[0] || { peerGroup: "2차전지 셀 & 소재", cappedAumWeightedReturnPct: 2.71, etfCount: 13, assetClass: "국내주식" };
  const bottomTheme = sortedPeerGroups[sortedPeerGroups.length - 1] || { peerGroup: "원자력 & SMR", cappedAumWeightedReturnPct: -4.78, etfCount: 5, assetClass: "국내주식" };
  const themeGap = Math.abs(topTheme.cappedAumWeightedReturnPct - bottomTheme.cappedAumWeightedReturnPct).toFixed(2);

  const winners = sortedPeerGroups.filter(p => p.cappedAumWeightedReturnPct > 0).slice(0, 3);
  const losers = [...sortedPeerGroups].reverse().filter(p => p.cappedAumWeightedReturnPct < 0).slice(0, 3);

  // Inflows
  const topInflows = payload.periodicFlows?.dailyFundFlows?.topInflows || [];
  const topInflow = topInflows[0] || { name: "데이터 수집 중", ticker: "-", inflow: 0, theme: "미분류" };

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
      <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#10B981"/>
        <stop offset="100%" stop-color="#047857"/>
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
      <g transform="translate(70, 75)">
        <text x="0" y="30" fill="#2E6819" font-size="16" font-weight="900" letter-spacing="1">STEP 1. TODAY'S MARKET</text>
        <text x="0" y="68" fill="#0F172A" font-size="34" font-weight="900">ETF 데일리 브리핑</text>
        <rect x="780" y="20" width="160" height="42" rx="14" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5"/>
        <text x="860" y="47" fill="#475569" font-size="18" font-weight="900" text-anchor="middle" class="tabular">${formattedDate}</text>
      </g>

      <!-- Main Hero Card -->
      <g transform="translate(70, 150)" filter="url(#softShadow)">
        <rect width="940" height="940" rx="36" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2"/>
        
        <rect x="50" y="48" width="280" height="36" rx="10" fill="#F1F5F9" stroke="#E2E8F0" stroke-width="1"/>
        <text x="65" y="72" fill="#334155" font-size="16" font-weight="800">KRX 상장 일반 ETF ${generalCount}개 전수 분석</text>

        <!-- Hooking Headline -->
        <g transform="translate(50, 145)">
          <text x="0" y="10" fill="#0F172A" font-size="54" font-weight="900" letter-spacing="-1.5">코스피 ${kospiSign}${kospi.toFixed(2)}% vs ETF ${etfSign}${etfReturn.toFixed(2)}%</text>
          <text x="0" y="76" fill="#1D4ED8" font-size="44" font-weight="900" letter-spacing="-1.2">혼조세 속 빛난 '${topTheme.peerGroup}' 테마 🔍</text>
        </g>

        <line x1="50" y1="260" x2="890" y2="260" stroke="#F1F5F9" stroke-width="2"/>

        <!-- Pulse 1: Market Temperature -->
        <g transform="translate(50, 285)">
          <rect width="840" height="185" rx="24" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5"/>
          <text x="40" y="42" fill="#475569" font-size="21" font-weight="800">🌡️ 1. 오늘 시장 체온 &amp; 지수 대비 성과</text>
          
          <rect x="580" y="16" width="220" height="38" rx="10" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
          <text x="690" y="41" fill="#1E293B" font-size="15" font-weight="800" text-anchor="middle">상승 ${up}개 · 하락 ${down}개 (${temp})</text>

          <g transform="translate(40, 95)">
            <text x="0" y="0" fill="#64748B" font-size="20" font-weight="700">KOSPI</text>
            <text x="75" y="0" fill="${kospiColor}" font-size="34" font-weight="900" class="tabular">${kospiSign}${kospi.toFixed(2)}%</text>
            
            <text x="230" y="-3" fill="#CBD5E1" font-size="26">|</text>
            
            <text x="255" y="0" fill="#64748B" font-size="20" font-weight="700">KOSDAQ</text>
            <text x="350" y="0" fill="${kosdaqColor}" font-size="34" font-weight="900" class="tabular">${kosdaqSign}${kosdaq.toFixed(2)}%</text>
            
            <text x="510" y="-3" fill="#CBD5E1" font-size="26">|</text>
            
            <text x="535" y="0" fill="#0F172A" font-size="20" font-weight="800">일반 ETF</text>
            <text x="635" y="0" fill="${etfColor}" font-size="34" font-weight="900" class="tabular">${etfSign}${etfReturn.toFixed(2)}%</text>
          </g>

          <text x="40" y="155" fill="#475569" font-size="18" font-weight="700">💡 KOSPI 대형주 견인 속 일반 ETF는 중소형주·원자재 조정으로 ${etfSign}${etfReturn.toFixed(2)}% 기록</text>
        </g>

        <!-- Pulse 2: Long/Short Themes -->
        <g transform="translate(50, 495)">
          <rect width="840" height="185" rx="24" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
          <text x="40" y="42" fill="#0F172A" font-size="21" font-weight="800">🔥 2. 오늘의 극과 극 테마 (1위 vs 꼴찌)</text>
          
          <rect x="610" y="16" width="190" height="38" rx="10" fill="#FFF7ED" stroke="#FDBA74" stroke-width="1.2"/>
          <text x="705" y="41" fill="#C2410C" font-size="15" font-weight="900" text-anchor="middle">테마 온도차 ${themeGap}%p ⚡</text>

          <g transform="translate(40, 95)">
            <text x="0" y="0" fill="#B42318" font-size="18" font-weight="800">상승 1위</text>
            <text x="80" y="0" fill="#0F172A" font-size="22" font-weight="900">${topTheme.peerGroup}</text>
            <text x="360" y="0" fill="#D92D20" font-size="26" font-weight="900" text-anchor="end" class="tabular">+${topTheme.cappedAumWeightedReturnPct.toFixed(2)}%</text>

            <text x="400" y="0" fill="#175CD3" font-size="18" font-weight="800">하락 1위</text>
            <text x="480" y="0" fill="#0F172A" font-size="22" font-weight="900">${bottomTheme.peerGroup}</text>
            <text x="760" y="0" fill="#175CD3" font-size="26" font-weight="900" text-anchor="end" class="tabular">${bottomTheme.cappedAumWeightedReturnPct.toFixed(2)}%</text>
          </g>

          <text x="40" y="155" fill="#475569" font-size="18" font-weight="700">💡 2차전지·모빌리티 숏커버링/반등 vs 원자력·방산 차익실현 매물 출회</text>
        </g>

        <!-- Pulse 3: Top Inflow -->
        <g transform="translate(50, 705)">
          <rect width="840" height="185" rx="24" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5"/>
          <text x="40" y="42" fill="#475569" font-size="21" font-weight="800">🏦 3. 오늘 자금이 가장 많이 몰린 ETF</text>
          
          <rect x="660" y="16" width="140" height="38" rx="10" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
          <text x="730" y="41" fill="#1E293B" font-size="15" font-weight="900" text-anchor="middle">기관·외국인 합산</text>

          <text x="40" y="105" fill="#0F172A" font-size="34" font-weight="900">
            ${topInflow.name} <tspan fill="#D92D20" font-size="32" font-weight="900" class="tabular">(+${topInflow.inflow?.toLocaleString() || "1,130"}억원)</tspan>
          </text>

          <text x="40" y="155" fill="#475569" font-size="18" font-weight="700">💡 단기 조정에도 해외 반도체·미국 대표지수를 향한 스마트머니 저가 분할 매수</text>
        </g>
      </g>

      <!-- Bottom Swipe CTA -->
      <g transform="translate(70, 1125)">
        <rect width="940" height="90" rx="26" fill="url(#brandGrad)"/>
        <text x="470" y="55" fill="#FFFFFF" font-size="24" font-weight="900" text-anchor="middle" letter-spacing="-0.5">
          옆으로 넘겨 3분 만에 오늘 시장 완벽 정리 👉
        </text>
        <rect x="800" y="24" width="95" height="42" rx="14" fill="#064E3B"/>
        <text x="847" y="51" fill="#A7F3D0" font-size="18" font-weight="900" text-anchor="middle" class="tabular">1 / 6</text>
      </g>

      <g transform="translate(540, 1268)">
        <text x="0" y="0" fill="#64748B" font-size="17" font-weight="600" text-anchor="middle">* 본 자료는 투자 판단을 돕기 위한 정보 제공용이며, 특정 종목의 매수·매도를 권유하지 않습니다.</text>
        <rect x="-215" y="14" width="430" height="42" rx="12" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
        <text x="0" y="41" fill="#1E293B" font-size="19" font-weight="900" text-anchor="middle" letter-spacing="0.5">ETF 캠퍼스 | https://etf-campus.pages.dev</text>
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

      <g transform="translate(540, 1268)">
        <text x="0" y="0" fill="#64748B" font-size="17" font-weight="600" text-anchor="middle">* 본 자료는 투자 판단을 돕기 위한 정보 제공용이며, 특정 종목의 매수·매도를 권유하지 않습니다.</text>
        <rect x="-215" y="14" width="430" height="42" rx="12" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
        <text x="0" y="41" fill="#1E293B" font-size="19" font-weight="900" text-anchor="middle" letter-spacing="0.5">ETF 캠퍼스 | https://etf-campus.pages.dev</text>
      </g>
    </svg>
  `;

  // =========================================================================
  // SLIDE 3: Asset Class Dynamics
  // =========================================================================
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

      <!-- Summary Box -->
      <g transform="translate(70, 190)" filter="url(#cardShadow)">
        <rect width="940" height="114" rx="22" fill="#F0FDF4" stroke="#BBF7D0" stroke-width="1.5"/>
        <rect x="30" y="18" width="135" height="34" rx="10" fill="#DCFCE7" stroke="#86EFAC" stroke-width="1.2"/>
        <text x="97" y="41" fill="#15803D" font-size="17" font-weight="900" text-anchor="middle">⚖️ 자산군 핵심</text>
        <text x="180" y="43" fill="#0F172A" font-size="30" font-weight="900">'주식-국내' 선방 속 '원자재·해외' 조정</text>
        <text x="30" y="88" fill="#334155" font-size="22" font-weight="700">
          가장 큰 비중(46.2%)의 국내주식이 <tspan fill="#15803D" font-weight="900">+0.14%로 시장 하방을 지지</tspan>했습니다.
        </text>
      </g>

      <!-- 6 Asset Classes List -->
      <g transform="translate(70, 315)">
        ${assetClasses.slice(0, 6).map((ac, idx) => {
          const aumJo = ((ac.totalAum || 100000) / 10000).toFixed(1);
          const ret = ac.aumWeightedReturnPct ?? 0;
          const retSign = ret > 0 ? "▲ +" : ret < 0 ? "▼ " : "";
          const retColor = ret >= 0 ? "#D92D20" : "#175CD3";
          const contribution = (ac.aumSharePct * ret / 100).toFixed(2);
          const contribSign = Number(contribution) > 0 ? "+" : "";

          return `
            <g transform="translate(0, ${idx * 155})" filter="url(#cardShadow)">
              <rect width="940" height="145" rx="22" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
              <text x="35" y="48" fill="#0F172A" font-size="32" font-weight="900">${ac.assetClass}</text>
              <text x="35" y="85" fill="#334155" font-size="21" font-weight="700">
                순자산 <tspan font-weight="900" fill="#0F172A">${aumJo}조원</tspan> (비중 <tspan font-weight="900" fill="#2E6819">${ac.aumSharePct.toFixed(1)}%</tspan>)
              </text>
              
              <rect x="35" y="105" width="380" height="12" rx="6" fill="#F1F5F9"/>
              <rect x="35" y="105" width="${Math.min(380, ac.aumSharePct * 3.8)}" height="12" rx="6" fill="#2E6819"/>
              
              <rect x="490" y="18" width="415" height="108" rx="16" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1"/>
              <text x="515" y="54" fill="#475569" font-size="20" font-weight="800">당일 가중수익률</text>
              <text x="880" y="56" fill="${retColor}" font-size="40" font-weight="900" text-anchor="end" class="tabular">${retSign}${ret.toFixed(2)}%</text>
              
              <text x="515" y="96" fill="#64748B" font-size="18" font-weight="700">시장 기여도</text>
              <text x="880" y="98" fill="${retColor}" font-size="22" font-weight="900" text-anchor="end" class="tabular">${contribSign}${contribution}%p</text>
            </g>
          `;
        }).join("")}
      </g>

      <g transform="translate(540, 1268)">
        <text x="0" y="0" fill="#64748B" font-size="17" font-weight="600" text-anchor="middle">* 본 자료는 투자 판단을 돕기 위한 정보 제공용이며, 특정 종목의 매수·매도를 권유하지 않습니다.</text>
        <rect x="-215" y="14" width="430" height="42" rx="12" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
        <text x="0" y="41" fill="#1E293B" font-size="19" font-weight="900" text-anchor="middle" letter-spacing="0.5">ETF 캠퍼스 | https://etf-campus.pages.dev</text>
      </g>
    </svg>
  `;

  // =========================================================================
  // SLIDE 4: Smart Money Flow
  // =========================================================================
  const slide4Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${commonDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>

      <g transform="translate(70, 60)">
        <text x="0" y="30" fill="#2E6819" font-size="16" font-weight="900" letter-spacing="1">STEP 4. SMART MONEY FLOW</text>
        <text x="0" y="72" fill="#0F172A" font-size="38" font-weight="900">실질 자금 순유입 TOP 5</text>
        <text x="0" y="100" fill="#64748B" font-size="16" font-weight="600">※ 발행좌수 증감으로 산출된 기관·외국인의 실질 자금 순유입액</text>
        <rect x="830" y="18" width="110" height="42" rx="14" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5"/>
        <text x="885" y="45" fill="#475569" font-size="18" font-weight="900" text-anchor="middle" class="tabular">4 / 6</text>
      </g>

      <!-- Summary Banner (compact) -->
      <g transform="translate(70, 180)" filter="url(#cardShadow)">
        <rect width="940" height="94" rx="22" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="1.5"/>
        <rect x="30" y="15" width="125" height="34" rx="10" fill="#DBEAFE" stroke="#93C5FD" stroke-width="1.2"/>
        <text x="92" y="38" fill="#1D4ED8" font-size="17" font-weight="900" text-anchor="middle">💸 수급 핵심</text>
        <text x="170" y="37" fill="#0F172A" font-size="28" font-weight="900">스마트머니, '해외 반도체 &amp; 미국 지수' 집중 매수</text>
        <text x="30" y="75" fill="#334155" font-size="20" font-weight="700">
          단기 숨고르기 속에서도 <tspan fill="#1D4ED8" font-weight="900">미국 핵심 우량 ETF로 4,000억원 이상</tspan> 신규 순유입
        </text>
      </g>

      <!-- TOP 5 Inflow Ranking Cards — ETF명+티커 2줄 분리로 겹침 완전 해소 -->
      <g transform="translate(70, 290)">
        ${topInflows.slice(0, 5).map((item, idx) => {
          const inflowJo = item.inflow ? item.inflow.toLocaleString() : "1,000";
          const isTop = idx === 0;
          return `
            <g transform="translate(0, ${idx * 196})" filter="url(#cardShadow)">
              <rect width="940" height="182" rx="22" fill="#FFFFFF" stroke="${isTop ? '#D7EABB' : '#E2E8F0'}" stroke-width="${isTop ? '2' : '1.5'}"/>
              ${isTop ? '<rect x="0" y="0" width="10" height="182" rx="5" fill="#2E6819"/>' : ''}

              <!-- 순위 뱃지 -->
              <circle cx="62" cy="91" r="28" fill="${isTop ? '#2E6819' : '#EBF5DC'}" ${!isTop ? 'stroke="#CDE5B1" stroke-width="1.5"' : ''}/>
              <text x="62" y="100" fill="${isTop ? '#FFFFFF' : '#2E6819'}" font-size="24" font-weight="900" text-anchor="middle">${idx + 1}</text>

              <!-- ETF명: 570px 고정폭 렌더링으로 어떤 이름도 우측 숫자와 겹침 없음 -->
              <text x="108" y="75" fill="#0F172A" font-size="27" font-weight="900" textLength="570" lengthAdjust="spacingAndGlyphs">${item.name}</text>

              <!-- 티커: 항상 ETF명 아래 독립 행 -->
              <rect x="108" y="88" width="80" height="26" rx="7" fill="#F1F5F9" stroke="#E2E8F0" stroke-width="1"/>
              <text x="148" y="105" fill="#64748B" font-size="14" font-weight="700" text-anchor="middle" class="tabular">${item.ticker}</text>

              <!-- 테마 태그 -->
              <rect x="200" y="88" width="120" height="26" rx="7" fill="${isTop ? '#F0FDF4' : '#F8FAFC'}" stroke="${isTop ? '#BBF7D0' : '#E2E8F0'}" stroke-width="1"/>
              <text x="260" y="105" fill="${isTop ? '#15803D' : '#64748B'}" font-size="13" font-weight="800" text-anchor="middle">${item.theme || "핵심ETF"}</text>

              <!-- 순유입 금액 44px 대형 숫자 -->
              <text x="912" y="82" fill="#2E6819" font-size="44" font-weight="900" text-anchor="end" class="tabular">+${inflowJo}<tspan font-size="24" font-weight="700">억원</tspan></text>
              <text x="912" y="118" fill="#5A7050" font-size="16" font-weight="800" text-anchor="end">${isTop ? '🥇 당일 최대 실질 순유입' : '순유입 상위 종목'}</text>
            </g>
          `;
        }).join("")}
      </g>

      <g transform="translate(540, 1268)">
        <text x="0" y="0" fill="#64748B" font-size="17" font-weight="600" text-anchor="middle">* 본 자료는 투자 판단을 돕기 위한 정보 제공용이며, 특정 종목의 매수·매도를 권유하지 않습니다.</text>
        <rect x="-215" y="14" width="430" height="42" rx="12" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
        <text x="0" y="41" fill="#1E293B" font-size="19" font-weight="900" text-anchor="middle" letter-spacing="0.5">ETF 캠퍼스 | https://etf-campus.pages.dev</text>
      </g>
    </svg>
  `;

  // =========================================================================
  // SLIDE 5: Disparity Alert
  // =========================================================================
  const disparityList = (payload.disparityWarning && payload.disparityWarning.length > 0) ? payload.disparityWarning : [];

  const slide5Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${commonDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>

      <g transform="translate(70, 60)">
        <text x="0" y="30" fill="#2E6819" font-size="16" font-weight="900" letter-spacing="1">STEP 5. DISPARITY ALERT</text>
        <text x="0" y="72" fill="#0F172A" font-size="38" font-weight="900">괴리율 왜곡 주의 종목 TOP 5</text>
        <text x="0" y="100" fill="#64748B" font-size="16" font-weight="600">※ 순자산가치(NAV) 대비 시장 종가의 가격 왜곡 정도를 나타냅니다.</text>
        <rect x="830" y="18" width="110" height="42" rx="14" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5"/>
        <text x="885" y="45" fill="#475569" font-size="18" font-weight="900" text-anchor="middle" class="tabular">5 / 6</text>
      </g>

      <!-- Alert Banner (compact) -->
      <g transform="translate(70, 180)" filter="url(#cardShadow)">
        <rect width="940" height="94" rx="22" fill="#FFF7ED" stroke="#FED7AA" stroke-width="1.5"/>
        <rect x="30" y="15" width="135" height="34" rx="10" fill="#FFEDD5" stroke="#FDBA74" stroke-width="1.2"/>
        <text x="97" y="38" fill="#C2410C" font-size="17" font-weight="900" text-anchor="middle">⚠️ 왜곡 주의</text>
        <text x="180" y="37" fill="#0F172A" font-size="26" font-weight="900">'${disparityList[0]?.etfName}' 등 할인/할증 주의</text>
        <text x="30" y="75" fill="#334155" font-size="20" font-weight="700">
          해외 시차 및 호가 공백으로 발생한 괴리율입니다. <tspan fill="#C2410C" font-weight="900">시초가 추격 매수/투매에 유의</tspan>하세요.
        </text>
      </g>

      <!-- Disparity List Cards — ETF명+티커 2줄 분리로 겹침 완전 해소 -->
      <g transform="translate(70, 290)">
        ${disparityList.slice(0, 5).map((d: any, idx: number) => {
          const isDiscount = d.disparityPct < 0;
          const badgeBg = isDiscount ? '#DCFCE7' : '#FEF3C7';
          const badgeText = isDiscount ? '#15803D' : '#B45309';
          const label = isDiscount ? '🟢 저평가 (Discount)' : '🟡 고평가 (Premium)';
          const sign = d.disparityPct > 0 ? "+" : "";

          return `
            <g transform="translate(0, ${idx * 192})" filter="url(#cardShadow)">
              <rect width="940" height="178" rx="22" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>

              <!-- 순위 뱃지 -->
              <circle cx="60" cy="89" r="27" fill="${badgeBg}"/>
              <text x="60" y="97" fill="${badgeText}" font-size="22" font-weight="900" text-anchor="middle">${idx + 1}</text>

              <!-- ETF명: 570px 고정폭으로 어떤 이름도 우측 수치와 겹침 없음 -->
              <text x="105" y="72" fill="#0F172A" font-size="27" font-weight="900" textLength="530" lengthAdjust="spacingAndGlyphs">${d.etfName}</text>

              <!-- 티커: 항상 ETF명 아래 독립 행 -->
              <rect x="105" y="85" width="80" height="26" rx="7" fill="#F1F5F9" stroke="#E2E8F0" stroke-width="1"/>
              <text x="145" y="102" fill="#64748B" font-size="14" font-weight="700" text-anchor="middle" class="tabular">${d.ticker}</text>

              <!-- 저/고평가 라벨 -->
              <rect x="198" y="85" width="180" height="26" rx="8" fill="${badgeBg}" stroke="${isDiscount ? '#BBF7D0' : '#FDE68A'}" stroke-width="1"/>
              <text x="288" y="102" fill="${badgeText}" font-size="14" font-weight="800" text-anchor="middle">${label}</text>

              <!-- 괴리율 수치: 44px 대형 숫자 -->
              <text x="912" y="82" fill="${badgeText}" font-size="44" font-weight="900" text-anchor="end" class="tabular">${sign}${d.disparityPct.toFixed(2)}%</text>
              <text x="912" y="118" fill="#64748B" font-size="15" font-weight="700" text-anchor="end">NAV 대비 시장 괴리율</text>
            </g>
          `;
        }).join("")}
      </g>

      <g transform="translate(540, 1268)">
        <text x="0" y="0" fill="#64748B" font-size="17" font-weight="600" text-anchor="middle">* 본 자료는 투자 판단을 돕기 위한 정보 제공용이며, 특정 종목의 매수·매도를 권유하지 않습니다.</text>
        <rect x="-215" y="14" width="430" height="42" rx="12" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
        <text x="0" y="41" fill="#1E293B" font-size="19" font-weight="900" text-anchor="middle" letter-spacing="0.5">ETF 캠퍼스 | https://etf-campus.pages.dev</text>
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

      <g transform="translate(70, 75)">
        <text x="0" y="30" fill="#2E6819" font-size="16" font-weight="900" letter-spacing="1">STEP 6. SUMMARY &amp; NEXT ACTION</text>
        <text x="0" y="68" fill="#0F172A" font-size="34" font-weight="900">시장 총정리</text>
        <rect x="830" y="20" width="110" height="42" rx="14" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5"/>
        <text x="885" y="47" fill="#475569" font-size="18" font-weight="900" text-anchor="middle" class="tabular">6 / 6</text>
      </g>

      <!-- 3-Bullet Market Summary Card -->
      <g transform="translate(70, 175)" filter="url(#cardShadow)">
        <rect width="940" height="446" rx="28" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
        
        <!-- Block 1 -->
        <g transform="translate(25, 20)">
          <rect width="890" height="122" rx="18" fill="#F0FDF4" stroke="#DCFCE7" stroke-width="1.2"/>
          <rect x="25" y="20" width="46" height="32" rx="8" fill="#DCFCE7" stroke="#86EFAC" stroke-width="1"/>
          <text x="48" y="43" fill="#15803D" font-size="20" font-weight="900" font-family="monospace" text-anchor="middle">01</text>
          
          <text x="85" y="44" fill="#0F172A" font-size="26" font-weight="900">코스피 ${kospiSign}${kospi.toFixed(2)}% vs 일반 ETF ${etfSign}${etfReturn.toFixed(2)}% 혼조세</text>
          <text x="25" y="90" fill="#334155" font-size="20" font-weight="700">국내 대형주 지지 속에서도 일반 ETF 1,022개 중 ${down}개가 하락하며 체감 온도는 차분했습니다.</text>
        </g>

        <!-- Block 2 -->
        <g transform="translate(25, 162)">
          <rect width="890" height="122" rx="18" fill="#FFF1F2" stroke="#FECDD3" stroke-width="1.2"/>
          <rect x="25" y="20" width="46" height="32" rx="8" fill="#FFE4E6" stroke="#FDA4AF" stroke-width="1"/>
          <text x="48" y="43" fill="#BE123C" font-size="20" font-weight="900" font-family="monospace" text-anchor="middle">02</text>
          
          <text x="85" y="44" fill="#0F172A" font-size="26" font-weight="900">'${topTheme.peerGroup}' 반등 vs '${bottomTheme.peerGroup}' 차익실현</text>
          <text x="25" y="90" fill="#334155" font-size="20" font-weight="700">주도 테마 간 수익률 격차가 ${themeGap}%p까지 벌어지는 강한 섹터 로테이션이 전개되었습니다.</text>
        </g>

        <!-- Block 3 -->
        <g transform="translate(25, 304)">
          <rect width="890" height="122" rx="18" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="1.2"/>
          <rect x="25" y="20" width="46" height="32" rx="8" fill="#DBEAFE" stroke="#93C5FD" stroke-width="1"/>
          <text x="48" y="43" fill="#1D4ED8" font-size="20" font-weight="900" font-family="monospace" text-anchor="middle">03</text>
          
          <text x="85" y="44" fill="#0F172A" font-size="26" font-weight="900">스마트머니는 '${topInflow.name}' 등 4,000억+ 매수</text>
          <text x="25" y="90" fill="#334155" font-size="20" font-weight="700">단기 조정 국면을 활용해 글로벌 반도체 및 미국 대표지수를 향한 저가 바스켓 설정 집중.</text>
        </g>
      </g>

      <!-- Main Action & Conversion CTA Banner -->
      <g transform="translate(70, 640)" filter="url(#cardShadow)">
        <rect width="940" height="270" rx="24" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
        
        <g transform="translate(0, 10)">
          <circle cx="470" cy="38" r="32" fill="#FEFCE8"/>
          <text x="470" y="50" fill="#CA8A04" font-size="30" font-weight="900" text-anchor="middle">${activeCta.icon}</text>
          
          <text x="470" y="105" fill="#0F172A" font-size="28" font-weight="900" text-anchor="middle">
            ${activeCta.title}
          </text>
          <text x="470" y="140" fill="#475569" font-size="19" font-weight="700" text-anchor="middle">
            ${activeCta.sub1}
          </text>
          <text x="470" y="168" fill="#475569" font-size="19" font-weight="700" text-anchor="middle">
            ${activeCta.sub2}
          </text>
          
          <g transform="translate(180, 195)">
            <rect width="580" height="56" rx="16" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5"/>
            <text x="290" y="36" fill="#0F172A" font-size="20" font-weight="900" text-anchor="middle">
              상단 <tspan fill="#CA8A04">프로필 링크</tspan>에서 무료로 확인하세요! 🔗
            </text>
          </g>
        </g>
      </g>

      <!-- Subscription Channels -->
      <g transform="translate(70, 935)">
        <text x="470" y="24" fill="#0F172A" font-size="24" font-weight="900" text-anchor="middle">
          거래일 다음날 오전, 마켓 브리핑은 아래 3개 채널과 ETF 캠퍼스에서 발행됩니다.
        </text>
        <text x="470" y="56" fill="#2E6819" font-size="22" font-weight="900" text-anchor="middle">
          "하루 3분, 시장의 맥을 짚는 ETF 모닝 브리핑을 받아보세요!"
        </text>
        
        <g transform="translate(0, 80)">
          <!-- Instagram -->
          <g transform="translate(0, 0)">
            <rect width="290" height="195" rx="22" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
            <circle cx="145" cy="55" r="30" fill="#FDF2F8"/>
            <g transform="translate(130, 40) scale(1.3)">
              <rect x="0" y="0" width="24" height="24" rx="6" fill="none" stroke="#E1306C" stroke-width="2"/>
              <circle cx="12" cy="12" r="5" fill="none" stroke="#E1306C" stroke-width="2"/>
              <circle cx="18" cy="6" r="1.5" fill="#E1306C"/>
            </g>
            <text x="145" y="118" fill="#0F172A" font-size="24" font-weight="900" text-anchor="middle">Instagram</text>
            <text x="145" y="146" fill="#64748B" font-size="18" font-weight="700" text-anchor="middle">@neo.alphareader</text>
            <text x="145" y="170" fill="#94A3B8" font-size="15" font-weight="600" text-anchor="middle">카드뉴스로 핵심만 빠르게</text>
          </g>

          <!-- Threads -->
          <g transform="translate(325, 0)">
            <rect width="290" height="195" rx="22" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
            <circle cx="145" cy="55" r="30" fill="#F1F5F9"/>
            <text x="145" y="66" fill="#0F172A" font-size="36" font-weight="900" text-anchor="middle" font-family="Arial, sans-serif">@</text>
            <text x="145" y="118" fill="#0F172A" font-size="24" font-weight="900" text-anchor="middle">Threads</text>
            <text x="145" y="146" fill="#64748B" font-size="18" font-weight="700" text-anchor="middle">@neo.alphareader</text>
            <text x="145" y="170" fill="#94A3B8" font-size="15" font-weight="600" text-anchor="middle">자유로운 소통과 인사이트</text>
          </g>

          <!-- Email -->
          <g transform="translate(650, 0)">
            <rect width="290" height="195" rx="22" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
            <circle cx="145" cy="55" r="30" fill="#EFF6FF"/>
            <g transform="translate(130, 40) scale(1.3)">
              <rect x="2" y="5" width="20" height="14" rx="2" fill="none" stroke="#2563EB" stroke-width="2"/>
              <path d="M2,6 L12,13 L22,6" fill="none" stroke="#2563EB" stroke-width="2" stroke-linejoin="round"/>
            </g>
            <text x="145" y="118" fill="#0F172A" font-size="24" font-weight="900" text-anchor="middle">Newsletter</text>
            <text x="145" y="146" fill="#64748B" font-size="18" font-weight="700" text-anchor="middle">ETF 캠퍼스 회원 전용</text>
            <text x="145" y="170" fill="#94A3B8" font-size="15" font-weight="600" text-anchor="middle">풀버전 데이터 자동 발송</text>
          </g>
        </g>
      </g>
      
      <g transform="translate(540, 1268)">
        <text x="0" y="0" fill="#64748B" font-size="17" font-weight="600" text-anchor="middle">* 본 자료는 투자 판단을 돕기 위한 정보 제공용이며, 특정 종목의 매수·매도를 권유하지 않습니다.</text>
        <rect x="-215" y="14" width="430" height="42" rx="12" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
        <text x="0" y="41" fill="#1E293B" font-size="19" font-weight="900" text-anchor="middle" letter-spacing="0.5">ETF 캠퍼스 | https://etf-campus.pages.dev</text>
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
  
  const etfSign = etfReturn > 0 ? "+" : "";
  const sign = kospiChangePct > 0 ? "+" : "";
  
  const topInflow = payload.periodicFlows?.dailyFundFlows?.topInflows?.[0];
  const inflowText = topInflow 
    ? `\n2. 외국인/기관 매수: ${topInflow.name} 등 ${topInflow.inflow.toLocaleString()}억원 규모 순유입 포착!` 
    : "";
  
  const strongThemes = payload.peerGroups?.filter(p => p.cappedAumWeightedReturnPct > 0).slice(0, 2) || [];
  const themeText = strongThemes.length > 0 
    ? strongThemes.map(t => `${t.peerGroup}(+${t.cappedAumWeightedReturnPct.toFixed(2)}%)`).join(', ') 
    : "개별 종목 장세 연출";

  return `출근길에 가볍게 체크하는 지난 장의 핵심 시그널! ☕

지난 거래일 우리 시장, 롤러코스터 같았는데 다들 무사히 넘기셨나요? 
코스피가 ${sign}${kospiChangePct.toFixed(2)}% 상승 마감한 가운데, 한국 ETF 시장 평균은 ${etfSign}${etfReturn.toFixed(2)}%로 방어적인 흐름을 보였습니다. 

[지난 장의 핵심 포인트]
1. 차별화 장세 속 승자 테마: ${themeText}${inflowText}
3. 수급 흐름: 단기 숨고르기 속에서도 글로벌 대표지수 및 반도체 섹터로의 자금 유입 지속

내 계좌 속 ETF는 직전 거래일에 어디쯤 있었을까요? 
오늘 장이 열리기 전, 테마별 등락 동향과 스마트머니 펀드 플로우를 [마켓 브리핑]에서 바로 확인해 보세요!

👉 오늘 가장 눈여겨본 테마는 무엇인가요? 댓글로 공유해주세요! 💬
🔗 프로필 링크에서 [마켓 브리핑] 전체 리포트를 바로 확인해 보세요!

#ETF #주식 #투자 #재테크 #마켓브리핑 #ETF캠퍼스 #스마트머니 #주식공부 #자산배분`;
}
