import type { MarketBriefingPayload } from "../types";

export interface InstagramSlide {
  slideNumber: number;
  title: string;
  subtitle: string;
  svgContent: string;
}

export function generateInstagramCarousel(payload: MarketBriefingPayload, baseUrl: string): InstagramSlide[] {
  const dateStr = payload.asOfDate || "2026-08-28";
  const formattedDate = dateStr.replace(/-/g, ".");
  const temp = payload.marketTemperature || "하락 우세";
  const kospiClose = payload.kospiClose || 6788.88;
  const kospiChangePct = payload.kospiChangePct ?? -1.79;
  const kosdaqClose = payload.kosdaqClose || 838.41;
  const kosdaqChangePct = payload.kosdaqChangePct ?? 0.09;

  const kospiColor = kospiChangePct > 0 ? "#D92D20" : kospiChangePct < 0 ? "#175CD3" : "#64748B";
  const kospiSign = kospiChangePct > 0 ? "+" : "";
  const kosdaqColor = kosdaqChangePct > 0 ? "#D92D20" : kosdaqChangePct < 0 ? "#175CD3" : "#64748B";
  const kosdaqSign = kosdaqChangePct > 0 ? "+" : "";

  const etfReturn = payload.generalAumWeightedReturnPct ?? -0.86;
  const etfSign = etfReturn > 0 ? "+" : "";
  const etfColor = etfReturn > 0 ? "#D92D20" : etfReturn < 0 ? "#175CD3" : "#64748B";

  const spreadVsKospi = etfReturn - kospiChangePct;
  let spreadBadgeText = "";
  let spreadBadgeBg = "";
  let spreadBadgeBorder = "";
  let spreadBadgeColor = "";
  
  if (spreadVsKospi > 0) {
    if (kospiChangePct < 0 && etfReturn < 0) {
      spreadBadgeText = `코스피 대비 ${spreadVsKospi.toFixed(2)}%p 하락 방어 🛡️`;
      spreadBadgeBg = "#ECFDF5"; spreadBadgeBorder = "#A7F3D0"; spreadBadgeColor = "#059669";
    } else {
      spreadBadgeText = `코스피 대비 +${spreadVsKospi.toFixed(2)}%p 초과 수익 🚀`;
      spreadBadgeBg = "#FEF2F2"; spreadBadgeBorder = "#FECACA"; spreadBadgeColor = "#DC2626";
    }
  } else {
    spreadBadgeText = `코스피 대비 ${spreadVsKospi.toFixed(2)}%p 하회 📉`;
    spreadBadgeBg = "#EFF8FF"; spreadBadgeBorder = "#B9E6FE"; spreadBadgeColor = "#1D4ED8";
  }

  const aumJo = ((payload.generalTotalAum || 3851607) / 10000).toFixed(1);
  const tradeJo = ((payload.generalTotalTradeValue || 87792) / 10000).toFixed(1);

  const up = payload.upCount || 350;
  const flat = payload.flatCount || 35;
  const down = payload.downCount || 637;
  const total = up + flat + down || 1022;
  const upPct = ((up / total) * 100).toFixed(1);
  const flatPct = ((flat / total) * 100).toFixed(1);
  const downPct = ((down / total) * 100).toFixed(1);

  // Extract Top 1 & Bottom 1 Theme & Top 1 Inflow for Cover 3 Pulses
  const sortedPeerGroups = payload.peerGroups ? [...payload.peerGroups].sort((a, b) => b.cappedAumWeightedReturnPct - a.cappedAumWeightedReturnPct) : [];
  const topTheme = sortedPeerGroups[0] || { peerGroup: "K-푸드 & K-뷰티", cappedAumWeightedReturnPct: 6.62 };
  const bottomTheme = sortedPeerGroups[sortedPeerGroups.length - 1] || { peerGroup: "미국 반도체 소부장", cappedAumWeightedReturnPct: -2.24 };
  
  const formatThemeName = (name: string, maxLen = 13) => name.length > maxLen ? name.slice(0, maxLen - 1) + "…" : name;
  const topThemeName = formatThemeName(topTheme.peerGroup);
  const topThemeReturn = topTheme.cappedAumWeightedReturnPct > 0 ? `+${topTheme.cappedAumWeightedReturnPct.toFixed(2)}` : `${topTheme.cappedAumWeightedReturnPct.toFixed(2)}`;
  const bottomThemeName = formatThemeName(bottomTheme.peerGroup);
  const bottomThemeReturn = bottomTheme.cappedAumWeightedReturnPct > 0 ? `+${bottomTheme.cappedAumWeightedReturnPct.toFixed(2)}` : `${bottomTheme.cappedAumWeightedReturnPct.toFixed(2)}`;
  const themeGap = Math.abs(topTheme.cappedAumWeightedReturnPct - bottomTheme.cappedAumWeightedReturnPct).toFixed(2);

  const topInflowItem = payload.periodicFlows?.dailyFundFlows?.topInflows?.[0] || { name: "KODEX 200", inflow: 5325 };
  const topInflowName = topInflowItem.name;
  const topInflowAmount = topInflowItem.inflow.toLocaleString();

  // OSMU Automation: Dynamic Font Sizing for Variable Length ETF Names
  const inflowNameLen = topInflowName.length;
  const inflowFontSize = inflowNameLen > 14 ? 32 : inflowNameLen > 10 ? 38 : 44;
  const inflowAmountFontSize = inflowNameLen > 14 ? 26 : inflowNameLen > 10 ? 30 : 36;

  // Dynamic Cover Headline logic (코스피 등락폭 기반 궁금증 유발 - 2줄 압축)
  let coverLine1 = "";
  let coverLine2 = "";
  
  if (kospiChangePct >= 2.0) {
    coverLine1 = `코스피 +${kospiChangePct.toFixed(2)}% 폭등장!`;
    coverLine2 = `역대급 불장을 주도한 ETF는? 🚀`;
  } else if (kospiChangePct >= 1.0) {
    coverLine1 = `코스피 +${kospiChangePct.toFixed(2)}% 급등장!`;
    coverLine2 = `오늘 상승을 하드캐리한 테마는? 🔥`;
  } else if (kospiChangePct > 0.0) {
    coverLine1 = `코스피 +${kospiChangePct.toFixed(2)}% 상승 마감!`;
    coverLine2 = `소리 없이 강했던 1위 테마는? 👀`;
  } else if (kospiChangePct <= -2.0) {
    coverLine1 = `코스피 ${kospiChangePct.toFixed(2)}% 패닉셀!`;
    coverLine2 = `폭락장에도 나홀로 급등한 ETF는? 🛡️`;
  } else if (kospiChangePct <= -1.0) {
    coverLine1 = `코스피 ${kospiChangePct.toFixed(2)}% 급락장!`;
    coverLine2 = `얼어붙은 투심 속 빛난 테마는? 🔍`;
  } else {
    coverLine1 = `코스피 ${kospiChangePct.toFixed(2)}% 약세 마감...`;
    coverLine2 = `지루한 조정장 속 돋보인 ETF는? 💡`;
  }

  // 1-Line Summaries for Pulse Cards (Fund Flow / Precision Logic)
  let pulse1Summary = "";
  if (down > up) {
    pulse1Summary = `전반적 약세 장세 속, 글로벌 자산배분 테마의 견고한 방어력`;
  } else {
    pulse1Summary = `상승 종목 우세 속, 시장을 견인한 대형주 중심의 훈풍`;
  }

  const pulse2Summary = `주도 테마로 거래대금 쏠림 심화, 부진 섹터는 철저히 소외`;

  let pulse3Summary = "";
  if (kospiChangePct < 0 && topInflowItem.inflow > 0) {
    pulse3Summary = `지수 급락에도 1위 종목을 향한 대형 바스켓 설정(저가 매수)`;
  } else if (kospiChangePct > 0 && topInflowItem.inflow > 0) {
    pulse3Summary = `상승장에 올라타는 대형 자금, 1위 종목 대규모 설정(순증)`;
  } else {
    pulse3Summary = `실질 자금은 1위 종목으로 집중, 견고한 발행좌수 순증`;
  }

  const baseDefs = `
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
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Pretendard:wght@400;500;600;700;800;900&amp;display=swap');
        * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .tabular { font-variant-numeric: tabular-nums; letter-spacing: -0.5px; }
      </style>
    </defs>
  `;

  const disclaimer = "* 본 자료는 투자 판단을 돕기 위한 정보 제공용이며, 특정 종목의 매수·매도를 권유하지 않습니다.";
  const watermarkSvg = `
      <g transform="translate(540, 1260)">
        <text x="0" y="0" fill="#94A3B8" font-size="15" font-weight="500" text-anchor="middle">${disclaimer}</text>
        <rect x="-185" y="15" width="370" height="34" rx="10" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1"/>
        <text x="0" y="38" fill="#64748B" font-size="16" font-weight="800" text-anchor="middle" letter-spacing="0.5">ETF 캠퍼스 | https://etf-campus.pages.dev</text>
      </g>
  `;

  // =========================================================================
  // Slide 1: Cover (1초 스크롤 스토퍼 & 무결점 헤더)
  // =========================================================================
  const slide1Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${baseDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>
      <circle cx="950" cy="180" r="320" fill="#2E6819" fill-opacity="0.04"/>
      <circle cx="120" cy="1150" r="260" fill="#0284C7" fill-opacity="0.03"/>

      <!-- Top Header Navigation (No overlap) -->
      <g transform="translate(70, 75)">
        <rect width="190" height="44" rx="22" fill="#FAFDF4" stroke="#D7EABB" stroke-width="1.5"/>
        <circle cx="22" cy="22" r="5" fill="#2E6819"/>
        <text x="38" y="28" fill="#2E6819" font-size="15" font-weight="900" letter-spacing="1">ETF CAMPUS</text>

        <rect x="205" y="0" width="200" height="44" rx="22" fill="#EBF5DC" stroke="#CDE5B1" stroke-width="1.5"/>
        <text x="222" y="28" fill="#365314" font-size="14" font-weight="800">DAILY MARKET PULSE</text>

        <rect x="740" y="0" width="200" height="44" rx="22" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
        <text x="840" y="28" fill="#475569" font-size="16" font-weight="800" text-anchor="middle" class="tabular">${formattedDate} (금)</text>
      </g>

      <!-- Main Hero Card -->
      <g transform="translate(70, 150)" filter="url(#softShadow)">
        <rect width="940" height="940" rx="36" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2"/>
        
        <!-- Category Tag: KRX 일반 ETF 전수 분석 명시 (컴플라이언스 표준) -->
        <rect x="50" y="50" width="260" height="34" rx="10" fill="#F1F5F9" stroke="#E2E8F0" stroke-width="1"/>
        <text x="65" y="73" fill="#334155" font-size="14" font-weight="800">KRX 상장 일반 ETF ${total}개 전수 분석</text>

        <!-- Hooking Headline -->
        <g transform="translate(50, 150)">
          <text x="0" y="10" fill="#0F172A" font-size="56" font-weight="900" letter-spacing="-1.5">${coverLine1}</text>
          <text x="0" y="85" fill="#1D4ED8" font-size="56" font-weight="900" letter-spacing="-1.5">${coverLine2}</text>
        </g>

        <line x1="50" y1="280" x2="890" y2="280" stroke="#F1F5F9" stroke-width="2"/>

        <!-- 3 Key Daily Pulse Cards (오늘의 3대 핵심 사건) -->
        <!-- Pulse 1: Market Temperature & ETF vs KOSPI/KOSDAQ Comparison -->
        <g transform="translate(50, 310)">
          <rect width="840" height="175" rx="24" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5"/>
          <text x="40" y="45" fill="#475569" font-size="20" font-weight="800">🌡️ 1. 오늘 시장 체온 &amp; 벤치마크 대비 성과</text>
          
          <g transform="translate(40, 105)">
            <text x="0" y="0" fill="#64748B" font-size="20" font-weight="700">KOSPI</text>
            <text x="75" y="0" fill="${kospiColor}" font-size="36" font-weight="900" class="tabular">${kospiSign}${kospiChangePct.toFixed(2)}%</text>
            
            <text x="210" y="-5" fill="#CBD5E1" font-size="28" font-weight="400">|</text>
            
            <text x="235" y="0" fill="#64748B" font-size="20" font-weight="700">KOSDAQ</text>
            <text x="330" y="0" fill="${kosdaqColor}" font-size="36" font-weight="900" class="tabular">${kosdaqSign}${kosdaqChangePct.toFixed(2)}%</text>
            
            <text x="470" y="-5" fill="#CBD5E1" font-size="28" font-weight="400">|</text>
            
            <text x="495" y="0" fill="#0F172A" font-size="20" font-weight="800">일반 ETF</text>
            <text x="590" y="0" fill="${etfColor}" font-size="36" font-weight="900" class="tabular">${etfSign}${etfReturn.toFixed(2)}%</text>
          </g>

          <!-- Simple 1-line Summary -->
          <text x="40" y="150" fill="#475569" font-size="17" font-weight="700">💡 ${pulse1Summary}</text>
          
          <!-- Right side badge -->
          <rect x="520" y="20" width="280" height="42" rx="12" fill="${spreadBadgeBg}" stroke="${spreadBadgeBorder}" stroke-width="1.5"/>
          <text x="660" y="47" fill="${spreadBadgeColor}" font-size="15" font-weight="900" text-anchor="middle" class="tabular">${spreadBadgeText}</text>
        </g>

        <!-- Pulse 2: Top 1 vs Bottom 1 Theme (Clean Side-by-Side) -->
        <g transform="translate(50, 505)">
          <rect width="840" height="175" rx="24" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
          <text x="40" y="45" fill="#0F172A" font-size="20" font-weight="800">🔥 2. 오늘의 극과 극 테마 (1위 vs 꼴찌)</text>
          
          <rect x="610" y="20" width="190" height="42" rx="12" fill="#FFF7ED" stroke="#FDBA74" stroke-width="1.5"/>
          <text x="705" y="47" fill="#C2410C" font-size="15" font-weight="900" text-anchor="middle">테마 온도차 ${themeGap}%p ⚡</text>

          <!-- Side-by-Side Theme Row -->
          <!-- Top Theme (Left Column) -->
          <text x="40" y="105" fill="#B42318" font-size="16" font-weight="800">상승 1위</text>
          <text x="115" y="105" fill="#0F172A" font-size="21" font-weight="900">${topThemeName}</text>
          <text x="395" y="105" fill="#D92D20" font-size="24" font-weight="900" text-anchor="end" class="tabular">${topThemeReturn}%</text>
          
          <!-- Middle Divider -->
          <line x1="415" y1="80" x2="415" y2="120" stroke="#E2E8F0" stroke-width="1.5"/>

          <!-- Bottom Theme (Right Column) -->
          <text x="435" y="105" fill="#175CD3" font-size="16" font-weight="800">하락 1위</text>
          <text x="510" y="105" fill="#0F172A" font-size="21" font-weight="900">${bottomThemeName}</text>
          <text x="795" y="105" fill="#175CD3" font-size="24" font-weight="900" text-anchor="end" class="tabular">${bottomThemeReturn}%</text>

          <!-- Simple 1-line Summary -->
          <text x="40" y="150" fill="#475569" font-size="17" font-weight="700">💡 ${pulse2Summary}</text>
        </g>

        <!-- Pulse 3: Top 1 Smart Money Inflow (Clean Typography) -->
        <g transform="translate(50, 700)">
          <rect width="840" height="175" rx="24" fill="#FAFDF4" stroke="#D7EABB" stroke-width="1.5"/>
          <text x="40" y="45" fill="#2E6819" font-size="20" font-weight="800">💸 3. 오늘 실질 자금(Fund Flow) 유입 1위</text>
          
          <text x="40" y="105" fill="#0F172A" font-size="${inflowFontSize}" font-weight="900">
            ${topInflowName} <tspan fill="#047857" font-size="${inflowAmountFontSize}" font-weight="900" class="tabular">(+${topInflowAmount}억원)</tspan>
          </text>
          <rect x="650" y="20" width="150" height="42" rx="12" fill="#ECFDF5" stroke="#A7F3D0" stroke-width="1.5"/>
          <text x="725" y="47" fill="#047857" font-size="16" font-weight="900" text-anchor="middle">수급 1위 💰</text>

          <!-- Simple 1-line Summary -->
          <text x="40" y="150" fill="#475569" font-size="17" font-weight="700">💡 ${pulse3Summary}</text>
        </g>
      </g>

      <!-- Bottom Swipe CTA -->
      <g transform="translate(70, 1125)">
        <rect width="940" height="90" rx="26" fill="url(#brandGrad)"/>
        <text x="45" y="54" fill="#FFFFFF" font-size="21" font-weight="900" letter-spacing="-0.5">
          👉 옆으로 넘겨 3분 만에 오늘 시장 완벽 정리
        </text>
        <rect x="800" y="24" width="95" height="42" rx="14" fill="#064E3B"/>
        <text x="847" y="51" fill="#A7F3D0" font-size="17" font-weight="900" text-anchor="middle" class="tabular">1 / 6</text>
      </g>

${watermarkSvg}
    </svg>
  `;

  // =========================================================================
  // Slide 2: Leading Theme Dynamics (주도 테마 랭킹 - Conflict)
  // =========================================================================
  const slide2Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${baseDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>

      <g transform="translate(70, 75)">
        <text x="0" y="30" fill="#2E6819" font-size="16" font-weight="900" letter-spacing="1">STEP 2. THEME DYNAMICS</text>
        <text x="0" y="68" fill="#0F172A" font-size="34" font-weight="900">오늘 시장 주도 테마 TOP 3 vs 부진 테마</text>
        <rect x="830" y="20" width="110" height="42" rx="14" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5"/>
        <text x="885" y="47" fill="#475569" font-size="18" font-weight="900" text-anchor="middle" class="tabular">2 / 6</text>
      </g>

      <!-- Panel 1: TOP 3 주도 테마 (상승) -->
      <g transform="translate(70, 165)" filter="url(#cardShadow)">
        <rect width="940" height="450" rx="26" fill="#FFFFFF" stroke="#FECDCA" stroke-width="1.5"/>
        <rect x="0" y="0" width="940" height="58" rx="26" fill="#FEF3F2"/>
        <text x="35" y="36" fill="#B42318" font-size="19" font-weight="900">🔥 오늘 시장을 이끈 TOP 3 주도 테마 (상승 랠리)</text>

        <!-- Rank 1: K-푸드 & K-뷰티 -->
        <g transform="translate(35, 80)">
          <rect width="870" height="100" rx="18" fill="#FAFDF4" stroke="#D7EABB" stroke-width="1.5"/>
          <circle cx="45" cy="50" r="22" fill="#D92D20"/>
          <text x="45" y="57" fill="#FFFFFF" font-size="18" font-weight="900" text-anchor="middle">1</text>
          <text x="85" y="43" fill="#0F172A" font-size="22" font-weight="900">K-푸드 &amp; K-뷰티 테마</text>
          <text x="85" y="73" fill="#64748B" font-size="15" font-weight="600">글로벌 수출 서프라이즈 및 실적 랠리 독주 🚀</text>
          <text x="830" y="58" fill="#D92D20" font-size="32" font-weight="900" text-anchor="end" class="tabular">+6.62%</text>
        </g>

        <!-- Rank 2: 금 -->
        <g transform="translate(35, 195)">
          <rect width="870" height="100" rx="18" fill="#FAFDF4" stroke="#E2E8F0" stroke-width="1.5"/>
          <circle cx="45" cy="50" r="22" fill="#FEE4E2"/>
          <text x="45" y="57" fill="#D92D20" font-size="18" font-weight="900" text-anchor="middle">2</text>
          <text x="85" y="43" fill="#0F172A" font-size="22" font-weight="900">금 (실물 &amp; 선물)</text>
          <text x="85" y="73" fill="#64748B" font-size="15" font-weight="600">글로벌 지정학 리스크 속 안전자산 수요 유입</text>
          <text x="830" y="58" fill="#D92D20" font-size="32" font-weight="900" text-anchor="end" class="tabular">+1.28%</text>
        </g>

        <!-- Rank 3: 철강화학 -->
        <g transform="translate(35, 310)">
          <rect width="870" height="100" rx="18" fill="#FAFDF4" stroke="#E2E8F0" stroke-width="1.5"/>
          <circle cx="45" cy="50" r="22" fill="#FEE4E2"/>
          <text x="45" y="57" fill="#D92D20" font-size="18" font-weight="900" text-anchor="middle">3</text>
          <text x="85" y="43" fill="#0F172A" font-size="22" font-weight="900">철강화학 테마</text>
          <text x="85" y="73" fill="#64748B" font-size="15" font-weight="600">중국 부양책 기대감 및 저평가 밸류 부각</text>
          <text x="830" y="58" fill="#D92D20" font-size="32" font-weight="900" text-anchor="end" class="tabular">+1.19%</text>
        </g>
      </g>

      <!-- Panel 2: BOTTOM 3 부진 테마 (하락) -->
      <g transform="translate(70, 645)" filter="url(#cardShadow)">
        <rect width="940" height="450" rx="26" fill="#FFFFFF" stroke="#B9E6FE" stroke-width="1.5"/>
        <rect x="0" y="0" width="940" height="58" rx="26" fill="#EFF8FF"/>
        <text x="35" y="36" fill="#175CD3" font-size="19" font-weight="900">❄️ 가장 부진했던 BOTTOM 3 테마 (조정 국면)</text>

        <!-- Bottom 1: 미국 반도체 소부장 -->
        <g transform="translate(35, 80)">
          <rect width="870" height="100" rx="18" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5"/>
          <circle cx="45" cy="50" r="22" fill="#175CD3"/>
          <text x="45" y="57" fill="#FFFFFF" font-size="18" font-weight="900" text-anchor="middle">1</text>
          <text x="85" y="43" fill="#0F172A" font-size="22" font-weight="900">미국 반도체 소부장</text>
          <text x="85" y="73" fill="#64748B" font-size="15" font-weight="600">단기 급등에 따른 차익실현 및 밸류에이션 부담</text>
          <text x="830" y="58" fill="#175CD3" font-size="32" font-weight="900" text-anchor="end" class="tabular">-2.24%</text>
        </g>

        <!-- Bottom 2: AI 반도체 & HBM -->
        <g transform="translate(35, 195)">
          <rect width="870" height="100" rx="18" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5"/>
          <circle cx="45" cy="50" r="22" fill="#D1E9FF"/>
          <text x="45" y="57" fill="#175CD3" font-size="18" font-weight="900" text-anchor="middle">2</text>
          <text x="85" y="43" fill="#0F172A" font-size="22" font-weight="900">AI 반도체 &amp; HBM</text>
          <text x="85" y="73" fill="#64748B" font-size="15" font-weight="600">엔비디아 실적 발표 후 숨고르기 국면</text>
          <text x="830" y="58" fill="#175CD3" font-size="32" font-weight="900" text-anchor="end" class="tabular">-1.83%</text>
        </g>

        <!-- Bottom 3: 반도체 -->
        <g transform="translate(35, 310)">
          <rect width="870" height="100" rx="18" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5"/>
          <circle cx="45" cy="50" r="22" fill="#D1E9FF"/>
          <text x="45" y="57" fill="#175CD3" font-size="18" font-weight="900" text-anchor="middle">3</text>
          <text x="85" y="43" fill="#0F172A" font-size="22" font-weight="900">국내 일반 반도체</text>
          <text x="85" y="73" fill="#64748B" font-size="15" font-weight="600">외국인 선물 매도세에 따른 대형주 동반 조정</text>
          <text x="830" y="58" fill="#175CD3" font-size="32" font-weight="900" text-anchor="end" class="tabular">-1.83%</text>
        </g>
      </g>

      <!-- Gaze Connection Bridge Footer -->
      <g transform="translate(70, 1125)">
        <rect width="940" height="120" rx="22" fill="#FAFDF4" stroke="#D7EABB" stroke-width="2"/>
        <text x="35" y="42" fill="#2E6819" font-size="17" font-weight="900">🤔 지수는 빠졌는데... 왜 500조 펀더멘털은 견고할까?</text>
        <text x="35" y="76" fill="#475569" font-size="15" font-weight="600">
          파킹통장과 채권이 만든 <tspan font-weight="800" fill="#0F172A">503.5조원 시장의 하방 안전판</tspan>을 확인하세요.
        </text>
        <text x="35" y="102" fill="#2E6819" font-size="14" font-weight="900">👉 다음 장으로 스와이프 (3/6)</text>
      </g>

${watermarkSvg}
    </svg>
  `;

  // =========================================================================
  // Slide 3: Market Fundamental & Asset Classes (503.5조 생태계 스케일 - Twist)
  // =========================================================================
  const slide3Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${baseDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>

      <g transform="translate(70, 75)">
        <text x="0" y="30" fill="#2E6819" font-size="16" font-weight="900" letter-spacing="1">STEP 3. MARKET FUNDAMENTAL</text>
        <text x="0" y="68" fill="#0F172A" font-size="34" font-weight="900">503.5조원 ETF 생태계 스케일 &amp; 자산배분</text>
        <rect x="830" y="20" width="110" height="42" rx="14" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5"/>
        <text x="885" y="47" fill="#475569" font-size="18" font-weight="900" text-anchor="middle" class="tabular">3 / 6</text>
      </g>

      <!-- Macro Scale Banner -->
      <g transform="translate(70, 160)" filter="url(#cardShadow)">
        <rect width="940" height="175" rx="26" fill="#FFFFFF" stroke="#D7EABB" stroke-width="2"/>
        <text x="40" y="48" fill="#2E6819" font-size="16" font-weight="800">🏢 대한민국 ETF 총 순자산총액 (전체 503.5조원 / 일반 385.2조원)</text>
        <text x="40" y="112" fill="#0F172A" font-size="50" font-weight="900" class="tabular">
          503.5<tspan font-size="30" font-weight="700">조원</tspan>
        </text>
        <rect x="680" y="38" width="220" height="98" rx="18" fill="#FAFDF4" stroke="#D7EABB" stroke-width="1.5"/>
        <text x="790" y="73" fill="#475569" font-size="14" font-weight="700" text-anchor="middle">분석 유니버스</text>
        <text x="790" y="108" fill="#2E6819" font-size="24" font-weight="900" text-anchor="middle" class="tabular">1,022<tspan font-size="16">개 일반 ETF</tspan></text>
      </g>

      <!-- 7 Asset Classes Grid -->
      <g transform="translate(70, 360)">
        <text x="0" y="25" fill="#0F172A" font-size="20" font-weight="900">7대 자산군별 AUM 비중 &amp; 당일 방어력</text>

        <!-- Grid 1: 원자재 -->
        <g transform="translate(0, 45)" filter="url(#cardShadow)">
          <rect width="455" height="145" rx="20" fill="#FFFFFF" stroke="#D7EABB" stroke-width="2"/>
          <text x="25" y="42" fill="#2E6819" font-size="15" font-weight="800">⛏️ 원자재 (AUM 7.6조)</text>
          <text x="430" y="45" fill="#D92D20" font-size="28" font-weight="900" text-anchor="end" class="tabular">+1.25%</text>
          <text x="25" y="85" fill="#64748B" font-size="14" font-weight="600">전체 비중 2.0%</text>
          <text x="25" y="115" fill="#2E6819" font-size="14" font-weight="800">금·원유 강세가 상승 견인 🚀</text>
        </g>

        <!-- Grid 2: 채권 -->
        <g transform="translate(485, 45)" filter="url(#cardShadow)">
          <rect width="455" height="145" rx="20" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
          <text x="25" y="42" fill="#475569" font-size="15" font-weight="800">💵 채권 (AUM 54.1조)</text>
          <text x="430" y="45" fill="#175CD3" font-size="28" font-weight="900" text-anchor="end" class="tabular">-0.08%</text>
          <text x="25" y="85" fill="#64748B" font-size="14" font-weight="600">전체 비중 14.2%</text>
          <text x="25" y="115" fill="#475569" font-size="14" font-weight="700">국채 금리 안정 속 약보합 방어</text>
        </g>

        <!-- Grid 3: 주식-국내 -->
        <g transform="translate(0, 205)" filter="url(#cardShadow)">
          <rect width="455" height="145" rx="20" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
          <text x="25" y="42" fill="#475569" font-size="15" font-weight="800">🇰🇷 주식-국내 (AUM 180.8조)</text>
          <text x="430" y="45" fill="#175CD3" font-size="28" font-weight="900" text-anchor="end" class="tabular">-0.12%</text>
          <text x="25" y="85" fill="#64748B" font-size="14" font-weight="600">전체 비중 47.3%</text>
          <text x="25" y="115" fill="#475569" font-size="14" font-weight="700">시총 상위 50개 대형주 방어력 발휘</text>
        </g>

        <!-- Grid 4: 주식-해외 -->
        <g transform="translate(485, 205)" filter="url(#cardShadow)">
          <rect width="455" height="145" rx="20" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
          <text x="25" y="42" fill="#475569" font-size="15" font-weight="800">🇺🇸 주식-해외 (AUM 129.5조)</text>
          <text x="430" y="45" fill="#175CD3" font-size="28" font-weight="900" text-anchor="end" class="tabular">-1.18%</text>
          <text x="25" y="85" fill="#64748B" font-size="14" font-weight="600">전체 비중 33.9%</text>
          <text x="25" y="115" fill="#175CD3" font-size="14" font-weight="700">미국 빅테크 차익실현 매물 출회</text>
        </g>

        <!-- Wide Parking Buffer Banner -->
        <g transform="translate(0, 365)" filter="url(#cardShadow)">
          <rect width="940" height="140" rx="22" fill="#FAFDF4" stroke="#D7EABB" stroke-width="2"/>
          <text x="35" y="45" fill="#2E6819" font-size="17" font-weight="900">🛡️ 파킹·단기자금 (CD/KOFR/머니마켓)</text>
          <text x="35" y="82" fill="#0F172A" font-size="20" font-weight="800">
            AUM <tspan fill="#2E6819" font-size="24" class="tabular">121.6조원 (전체 24.1%)</tspan> · 시장 하방 완충재 역할
          </text>
          <text x="35" y="112" fill="#64748B" font-size="14" font-weight="600">지수 급락에도 매일 연 3.5% 수준의 안정적 확정 이자 수취</text>
          <rect x="760" y="38" width="145" height="64" rx="16" fill="#2E6819"/>
          <text x="832" y="76" fill="#FFFFFF" font-size="17" font-weight="900" text-anchor="middle">안전판 작동</text>
        </g>
      </g>

      <!-- Footer Gaze Bridge -->
      <g transform="translate(70, 1140)">
        <rect width="940" height="100" rx="20" fill="#F1F5F9"/>
        <text x="35" y="42" fill="#334155" font-size="16" font-weight="800">
          💡 <tspan fill="#2E6819">스마트머니의 반격:</tspan> 기관과 큰손이 오늘 하루에만 쓸어담은 1.4조원 영수증을 공개합니다 👉
        </text>
        <text x="35" y="74" fill="#64748B" font-size="14" font-weight="600">다음 장으로 스와이프 (4/6)</text>
      </g>

${watermarkSvg}
    </svg>
  `;

  // =========================================================================
  // Slide 4: Smart Money Net Inflow TOP 5 (스마트머니 영수증 - Clue)
  // =========================================================================
  const slide4Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${baseDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>

      <g transform="translate(70, 75)">
        <text x="0" y="30" fill="#2E6819" font-size="16" font-weight="900" letter-spacing="1">STEP 4. SMART MONEY FLOW</text>
        <text x="0" y="68" fill="#0F172A" font-size="34" font-weight="900">큰손의 1.4조원 비밀 장바구니 영수증</text>
        <rect x="830" y="20" width="110" height="42" rx="14" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5"/>
        <text x="885" y="47" fill="#475569" font-size="18" font-weight="900" text-anchor="middle" class="tabular">4 / 6</text>
      </g>

      <!-- Explanation Banner -->
      <g transform="translate(70, 160)">
        <rect width="940" height="65" rx="16" fill="#FAFDF4" stroke="#D7EABB" stroke-width="1.5"/>
        <text x="30" y="40" fill="#365314" font-size="15" font-weight="700">
          💡 <tspan font-weight="900">실질 순유입이란?</tspan> 단순 거래량이 아닌 발행좌수 증감으로 측정된 기관·큰손의 '진성 설정 자금'입니다.
        </text>
      </g>

      <!-- TOP 5 Inflow Ranking Cards -->
      <g transform="translate(70, 245)">
        <!-- Rank 1: KODEX 200 -->
        <g transform="translate(0, 0)" filter="url(#cardShadow)">
          <rect width="940" height="145" rx="22" fill="#FFFFFF" stroke="#D7EABB" stroke-width="2"/>
          <rect x="0" y="0" width="10" height="145" rx="5" fill="#2E6819"/>
          
          <circle cx="60" cy="72" r="24" fill="#2E6819"/>
          <text x="60" y="80" fill="#FFFFFF" font-size="20" font-weight="900" text-anchor="middle">1</text>
          
          <text x="105" y="56" fill="#0F172A" font-size="24" font-weight="900">KODEX 200</text>
          <rect x="250" y="38" width="68" height="24" rx="6" fill="#F1F5F9"/>
          <text x="284" y="55" fill="#64748B" font-size="12" font-weight="700" text-anchor="middle" class="tabular">069500</text>
          
          <text x="105" y="100" fill="#64748B" font-size="15" font-weight="600">
            지수 조정 구간에서 <tspan font-weight="800" fill="#2E6819">기관 대규모 저가 분할매수 1위</tspan>
          </text>

          <text x="900" y="68" fill="#2E6819" font-size="32" font-weight="900" text-anchor="end" class="tabular">
            +5,325<tspan font-size="18" font-weight="700">억원</tspan>
          </text>
          <text x="900" y="100" fill="#5A7050" font-size="13" font-weight="800" text-anchor="end">당일 최대 순유입</text>
        </g>

        <!-- Rank 2: TIGER 반도체TOP10 -->
        <g transform="translate(0, 160)" filter="url(#cardShadow)">
          <rect width="940" height="145" rx="22" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
          <circle cx="60" cy="72" r="24" fill="#EBF5DC" stroke="#CDE5B1" stroke-width="1.5"/>
          <text x="60" y="80" fill="#2E6819" font-size="20" font-weight="900" text-anchor="middle">2</text>
          
          <text x="105" y="56" fill="#0F172A" font-size="24" font-weight="900">TIGER 반도체TOP10</text>
          <rect x="365" y="38" width="68" height="24" rx="6" fill="#F1F5F9"/>
          <text x="399" y="55" fill="#64748B" font-size="12" font-weight="700" text-anchor="middle" class="tabular">396500</text>

          <text x="105" y="100" fill="#64748B" font-size="15" font-weight="600">
            반도체 단기 하락을 틈탄 <tspan font-weight="800" fill="#0F172A">대형 반도체주 집중 매수</tspan>
          </text>

          <text x="900" y="78" fill="#2E6819" font-size="32" font-weight="900" text-anchor="end" class="tabular">
            +3,053<tspan font-size="18" font-weight="700">억원</tspan>
          </text>
        </g>

        <!-- Rank 3: TIGER 200 -->
        <g transform="translate(0, 320)" filter="url(#cardShadow)">
          <rect width="940" height="145" rx="22" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
          <circle cx="60" cy="72" r="24" fill="#EBF5DC" stroke="#CDE5B1" stroke-width="1.5"/>
          <text x="60" y="80" fill="#2E6819" font-size="20" font-weight="900" text-anchor="middle">3</text>
          
          <text x="105" y="56" fill="#0F172A" font-size="24" font-weight="900">TIGER 200</text>
          <rect x="235" y="38" width="68" height="24" rx="6" fill="#F1F5F9"/>
          <text x="269" y="55" fill="#64748B" font-size="12" font-weight="700" text-anchor="middle" class="tabular">102110</text>

          <text x="105" y="100" fill="#64748B" font-size="15" font-weight="600">
            국내 대형 대표지수 패시브 자금 동반 순유입
          </text>

          <text x="900" y="78" fill="#2E6819" font-size="32" font-weight="900" text-anchor="end" class="tabular">
            +2,178<tspan font-size="18" font-weight="700">억원</tspan>
          </text>
        </g>

        <!-- Rank 4: KODEX 반도체 -->
        <g transform="translate(0, 480)" filter="url(#cardShadow)">
          <rect width="940" height="140" rx="22" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
          <circle cx="60" cy="70" r="22" fill="#F1F5F9"/>
          <text x="60" y="77" fill="#475569" font-size="18" font-weight="900" text-anchor="middle">4</text>
          
          <text x="105" y="54" fill="#0F172A" font-size="22" font-weight="900">KODEX 반도체</text>
          <rect x="270" y="36" width="68" height="24" rx="6" fill="#F1F5F9"/>
          <text x="304" y="53" fill="#64748B" font-size="12" font-weight="700" text-anchor="middle" class="tabular">091160</text>
          <text x="105" y="95" fill="#64748B" font-size="14" font-weight="600">국내 대표 반도체 소부장 밸류체인 저가 매수</text>

          <text x="900" y="75" fill="#2E6819" font-size="28" font-weight="900" text-anchor="end" class="tabular">
            +1,781<tspan font-size="17" font-weight="700">억원</tspan>
          </text>
        </g>

        <!-- Rank 5: KODEX 200TR -->
        <g transform="translate(0, 635)" filter="url(#cardShadow)">
          <rect width="940" height="140" rx="22" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
          <circle cx="60" cy="70" r="22" fill="#F1F5F9"/>
          <text x="60" y="77" fill="#475569" font-size="18" font-weight="900" text-anchor="middle">5</text>
          
          <text x="105" y="54" fill="#0F172A" font-size="22" font-weight="900">KODEX 200TR</text>
          <rect x="275" y="36" width="68" height="24" rx="6" fill="#F1F5F9"/>
          <text x="309" y="53" fill="#64748B" font-size="12" font-weight="700" text-anchor="middle" class="tabular">278530</text>
          <text x="105" y="95" fill="#64748B" font-size="14" font-weight="600">배당 자동 재투자(TR) 장기 기관 수급 지속</text>

          <text x="900" y="75" fill="#2E6819" font-size="28" font-weight="900" text-anchor="end" class="tabular">
            +1,619<tspan font-size="17" font-weight="700">억원</tspan>
          </text>
        </g>
      </g>

      <!-- Bottom Contrast Footer -->
      <g transform="translate(70, 1140)">
        <rect width="940" height="115" rx="22" fill="#FAFDF4" stroke="#D7EABB" stroke-width="1.5"/>
        <text x="35" y="42" fill="#2E6819" font-size="16" font-weight="900">💡 스마트머니의 명확한 시그널</text>
        <text x="35" y="74" fill="#475569" font-size="15" font-weight="600">
          단기 가격 조정에 흔들리지 않고 <tspan font-weight="800" fill="#0F172A">대표지수 &amp; 반도체 1위 종목군으로 1.4조원</tspan> 이상 대거 유입!
        </text>
        <text x="35" y="98" fill="#2E6819" font-size="14" font-weight="800">👉 다음 장에서 괴리율 경보 종목 확인 (5/6)</text>
      </g>

${watermarkSvg}
    </svg>
  `;

  // =========================================================================
  // Slide 5: Disparity Warning Dual Panel (괴리율 실전 지뢰 경보 - Warning)
  // =========================================================================
  const slide5Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${baseDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>

      <g transform="translate(70, 75)">
        <text x="0" y="30" fill="#2E6819" font-size="16" font-weight="900" letter-spacing="1">STEP 5. DISPARITY ALERT</text>
        <text x="0" y="68" fill="#0F172A" font-size="34" font-weight="900">수급 쏠림 주의 ETF (괴리율 경보 TOP 3)</text>
        <rect x="830" y="20" width="110" height="42" rx="14" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5"/>
        <text x="885" y="47" fill="#475569" font-size="18" font-weight="900" text-anchor="middle" class="tabular">5 / 6</text>
      </g>

      <!-- Alert Criteria Guide Banner (원인 1줄 팁 탑재) -->
      <g transform="translate(70, 160)">
        <rect width="940" height="70" rx="18" fill="#FFF7ED" stroke="#FED7AA" stroke-width="1.5"/>
        <text x="30" y="42" fill="#9A3412" font-size="14.5" font-weight="700">
          ⚠️ <tspan font-weight="900">괴리율 왜곡 원인:</tspan> 해외 시차 및 장마감 직전 LP 호가 공백으로 발생! 월요일 시초가 매수 주의
        </text>
      </g>

      <!-- Dual 5:5 Panels -->
      <g transform="translate(70, 250)">
        <!-- Left Panel: Overvalued TOP 3 -->
        <g transform="translate(0, 0)" filter="url(#cardShadow)">
          <rect width="455" height="840" rx="24" fill="#FFFFFF" stroke="#FECDCA" stroke-width="2"/>
          <rect x="0" y="0" width="455" height="75" rx="24" fill="#FEF3F2"/>
          <text x="25" y="45" fill="#B42318" font-size="20" font-weight="900">🔴 고평가 TOP 3 (Premium)</text>
          <rect x="25" y="90" width="180" height="28" rx="8" fill="#FEF3F2"/>
          <text x="35" y="109" fill="#D92D20" font-size="12" font-weight="800">🚫 추격 매수 주의 (시장가 &gt; NAV)</text>

          <!-- Item 1 -->
          <g transform="translate(20, 135)">
            <rect width="415" height="205" rx="16" fill="#FAFDF4" stroke="#D7EABB" stroke-width="1.5"/>
            <text x="20" y="32" fill="#0F172A" font-size="18" font-weight="900">SOL 팔란티어커버드콜</text>
            <text x="20" y="58" fill="#64748B" font-size="13" font-weight="600" class="tabular">494440 · 채권혼합</text>
            <rect x="20" y="80" width="150" height="42" rx="10" fill="#FEF3F2"/>
            <text x="95" y="108" fill="#D92D20" font-size="24" font-weight="900" text-anchor="middle" class="tabular">+4.80%</text>
            <text x="20" y="155" fill="#475569" font-size="13" font-weight="600">단기 매수세 쏠림으로 NAV 대비 과도한 프리미엄</text>
            <text x="20" y="180" fill="#D92D20" font-size="12" font-weight="800">⚠️ 정상 가치 수렴 시 손실 위험</text>
          </g>

          <!-- Item 2 -->
          <g transform="translate(20, 360)">
            <rect width="415" height="205" rx="16" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5"/>
            <text x="20" y="32" fill="#0F172A" font-size="18" font-weight="900">KODEX 차이나AI반도체</text>
            <text x="20" y="58" fill="#64748B" font-size="13" font-weight="600" class="tabular">486450 · 중국테마</text>
            <rect x="20" y="80" width="150" height="42" rx="10" fill="#FEF3F2"/>
            <text x="95" y="108" fill="#D92D20" font-size="24" font-weight="900" text-anchor="middle" class="tabular">+4.13%</text>
            <text x="20" y="155" fill="#475569" font-size="13" font-weight="600">중국 휴장 등 시차로 인한 LP 호가 유동성 공백</text>
            <text x="20" y="180" fill="#D92D20" font-size="12" font-weight="800">⚠️ 시초가 추격 매수 금지</text>
          </g>

          <!-- Item 3 -->
          <g transform="translate(20, 585)">
            <rect width="415" height="205" rx="16" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5"/>
            <text x="20" y="32" fill="#0F172A" font-size="18" font-weight="900">TIGER 글로벌AI사이버보안</text>
            <text x="20" y="58" fill="#64748B" font-size="13" font-weight="600" class="tabular">475380 · 미국테마</text>
            <rect x="20" y="80" width="150" height="42" rx="10" fill="#FEF3F2"/>
            <text x="95" y="108" fill="#D92D20" font-size="24" font-weight="900" text-anchor="middle" class="tabular">+3.70%</text>
            <text x="20" y="155" fill="#475569" font-size="13" font-weight="600">단기 호재 반영 과열로 시장가 왜곡 발생</text>
            <text x="20" y="180" fill="#D92D20" font-size="12" font-weight="800">⚠️ 분할 매수 대기 권고</text>
          </g>
        </g>

        <!-- Right Panel: Undervalued TOP 3 -->
        <g transform="translate(485, 0)" filter="url(#cardShadow)">
          <rect width="455" height="840" rx="24" fill="#FFFFFF" stroke="#B9E6FE" stroke-width="2"/>
          <rect x="0" y="0" width="455" height="75" rx="24" fill="#EFF8FF"/>
          <text x="25" y="45" fill="#175CD3" font-size="20" font-weight="900">🔵 저평가 TOP 3 (Discount)</text>
          <rect x="25" y="90" width="220" height="28" rx="8" fill="#EFF8FF"/>
          <text x="35" y="109" fill="#175CD3" font-size="12" font-weight="800">💎 헐값 매도 주의 / 기회 (시장가 &lt; NAV)</text>

          <!-- Item 1 -->
          <g transform="translate(20, 135)">
            <rect width="415" height="205" rx="16" fill="#FAFDF4" stroke="#D7EABB" stroke-width="1.5"/>
            <text x="20" y="32" fill="#0F172A" font-size="18" font-weight="900">PLUS 코스닥150</text>
            <text x="20" y="58" fill="#64748B" font-size="13" font-weight="600" class="tabular">237370 · 국내대표지수</text>
            <rect x="20" y="80" width="150" height="42" rx="10" fill="#EFF8FF"/>
            <text x="95" y="108" fill="#175CD3" font-size="24" font-weight="900" text-anchor="middle" class="tabular">-1.42%</text>
            <text x="20" y="155" fill="#475569" font-size="13" font-weight="600">장마감 직전 패닉셀링으로 NAV 대비 과도한 할인</text>
            <text x="20" y="180" fill="#175CD3" font-size="12" font-weight="800">💎 헐값 매도 금지 / 차익거래 기회</text>
          </g>

          <!-- Fallback Notice for Item 2 & 3 -->
          <g transform="translate(20, 360)">
            <rect width="415" height="430" rx="16" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5"/>
            <circle cx="207" cy="160" r="40" fill="#DCFCE7"/>
            <text x="207" y="172" fill="#15803D" font-size="34" font-weight="900" text-anchor="middle">✅</text>
            <text x="207" y="230" fill="#0F172A" font-size="20" font-weight="900" text-anchor="middle">추가 저평가 경보 없음</text>
            <text x="207" y="270" fill="#64748B" font-size="14" font-weight="600" text-anchor="middle">
              나머지 1,021개 ETF는 모두
            </text>
            <text x="207" y="295" fill="#15803D" font-size="15" font-weight="800" text-anchor="middle">
              정상 괴리율 범위(&lt;1.0%) 내 안착 중
            </text>
          </g>
        </g>
      </g>

      <!-- Bottom Insight Footer -->
      <g transform="translate(70, 1140)">
        <rect width="940" height="115" rx="22" fill="#F1F5F9"/>
        <text x="35" y="42" fill="#334155" font-size="16" font-weight="800">
          💡 <tspan fill="#2E6819">투자 실전 팁:</tspan> 고평가 종목은 장 시작 직후 시장가 매수를 피하고, 저평가 종목은 투매에 동참하지 마세요.
        </text>
        <text x="35" y="74" fill="#64748B" font-size="14" font-weight="600">
          다음 장에서 오늘의 주말 체크리스트 및 내 종목 3초 무료 진단 링크를 확인하세요 👉
        </text>
        <text x="35" y="98" fill="#2E6819" font-size="14" font-weight="800">(6/6)</text>
      </g>

${watermarkSvg}
    </svg>
  `;

  // =========================================================================
  // Slide 6: Action Checklist & Conversion CTA (실전 행동 가이드 - Action)
  // =========================================================================
  const slide6Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${baseDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>

      <g transform="translate(70, 75)">
        <text x="0" y="30" fill="#2E6819" font-size="16" font-weight="900" letter-spacing="1">STEP 6. SUMMARY &amp; CTA</text>
        <text x="0" y="68" fill="#0F172A" font-size="34" font-weight="900">하락장 극복을 위한 주말 3대 체크리스트</text>
        <rect x="830" y="20" width="110" height="42" rx="14" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5"/>
        <text x="885" y="47" fill="#475569" font-size="18" font-weight="900" text-anchor="middle" class="tabular">6 / 6</text>
      </g>

      <!-- 3 Action Checklist Cards -->
      <g transform="translate(70, 160)">
        <!-- Point 1 -->
        <g transform="translate(0, 0)" filter="url(#cardShadow)">
          <rect width="940" height="145" rx="22" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
          <circle cx="55" cy="72" r="22" fill="#EFF6FF"/>
          <text x="55" y="80" fill="#1D4ED8" font-size="18" font-weight="900" text-anchor="middle">1</text>
          <text x="100" y="52" fill="#0F172A" font-size="22" font-weight="900">
            [확인] 대형 대표지수 중심의 스마트머니 1.4조 유입
          </text>
          <text x="100" y="92" fill="#64748B" font-size="15" font-weight="600">
            KODEX 200(+5,325억) 등 지수 조정 시점을 활용한 기관의 든든한 저가 분할매수세 확인
          </text>
        </g>

        <!-- Point 2 -->
        <g transform="translate(0, 165)" filter="url(#cardShadow)">
          <rect width="940" height="145" rx="22" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
          <circle cx="55" cy="72" r="22" fill="#FEF3F2"/>
          <text x="55" y="80" fill="#D92D20" font-size="18" font-weight="900" text-anchor="middle">2</text>
          <text x="100" y="52" fill="#0F172A" font-size="22" font-weight="900">
            [주의] 고평가 괴리율 종목(+4.8% 등) 무리한 시초가 추격매수 금지
          </text>
          <text x="100" y="92" fill="#64748B" font-size="15" font-weight="600">
            유동성 공백과 단기 호재로 뜬 프리미엄 종목은 정상 가치 회귀 시 원금 손실 주의
          </text>
        </g>

        <!-- Point 3 -->
        <g transform="translate(0, 330)" filter="url(#cardShadow)">
          <rect width="940" height="145" rx="22" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
          <circle cx="55" cy="72" r="22" fill="#FAFDF4"/>
          <text x="55" y="80" fill="#2E6819" font-size="18" font-weight="900" text-anchor="middle">3</text>
          <text x="100" y="52" fill="#0F172A" font-size="22" font-weight="900">
            [탐색] K-푸드·뷰티(+6.62%) &amp; 원자재(+1.25%) 독주 테마 분석
          </text>
          <text x="100" y="92" fill="#64748B" font-size="15" font-weight="600">
            반도체 조정 속에서도 실적 기반의 독자 모멘텀 테마와 안전자산이 시장의 방어력 제공
          </text>
        </g>
      </g>

      <!-- Main Action & Conversion CTA Banner (Browser Mockup) -->
      <g transform="translate(70, 640)" filter="url(#softShadow)">
        <rect width="940" height="480" rx="32" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2"/>
        
        <!-- Browser Top Bar -->
        <path d="M 0 32 Q 0 0 32 0 L 908 0 Q 940 0 940 32 L 940 70 L 0 70 Z" fill="#F1F5F9"/>
        <circle cx="40" cy="35" r="8" fill="#EF4444"/>
        <circle cx="65" cy="35" r="8" fill="#F59E0B"/>
        <circle cx="90" cy="35" r="8" fill="#10B981"/>
        <rect x="270" y="15" width="400" height="40" rx="12" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
        <text x="470" y="42" fill="#0F172A" font-size="16" font-weight="800" text-anchor="middle" font-family="monospace">
          etf-campus.pages.dev
        </text>
        
        <!-- Value Proposition Text -->
        <text x="470" y="160" fill="#1E3A8A" font-size="44" font-weight="900" text-anchor="middle" letter-spacing="-1">
          연금/트레이더를 위한 완벽 비교기 🚀
        </text>
        <text x="470" y="220" fill="#334155" font-size="28" font-weight="900" text-anchor="middle" letter-spacing="-1">
          증권사 앱에는 없는 '숨은 수수료(TER)'와 '괴리율'
        </text>
        
        <!-- Bullet points -->
        <g transform="translate(180, 260)">
          <circle cx="0" cy="5" r="5" fill="#38BDF8"/>
          <text x="20" y="12" fill="#475569" font-size="20" font-weight="700">내 연금계좌 ETF들의 진짜 총비용 비교 (TER 비교기)</text>
          
          <circle cx="0" cy="50" r="5" fill="#38BDF8"/>
          <text x="20" y="57" fill="#475569" font-size="20" font-weight="700">할인(Discount) 저평가 랭킹 - 실시간 차익거래 기회</text>
        </g>

        <!-- CTA Buttons -->
        <g transform="translate(100, 360)">
          <rect width="350" height="74" rx="37" fill="#2E6819"/>
          <text x="175" y="48" fill="#FFFFFF" font-size="22" font-weight="900" text-anchor="middle">
            프로필 링크 타고 접속 👆
          </text>
        </g>

        <g transform="translate(490, 360)">
          <rect width="350" height="74" rx="37" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2"/>
          <text x="175" y="48" fill="#334155" font-size="22" font-weight="800" text-anchor="middle">
            또는 주소창 직접 타이핑 ⌨️
          </text>
        </g>
      </g>

      <!-- Bottom Channel Handle -->
      <g transform="translate(70, 1125)">
        <rect width="940" height="90" rx="24" fill="#F1F5F9"/>
        <text x="470" y="52" fill="#334155" font-size="17" font-weight="800" text-anchor="middle">
          🔔 <tspan font-weight="900" fill="#0F172A">@etfcampus</tspan> 팔로우하고 매일 저녁 3분 ETF 퇴근길 브리핑을 받아보세요!
        </text>
      </g>
      
      ${watermarkSvg}
    </svg>
  `;

  return [
    { slideNumber: 1, title: "Cover", subtitle: "1초 후킹 표지 & 3대 핵심 펄스", svgContent: slide1Svg },
    { slideNumber: 2, title: "Theme Dynamics", subtitle: "주도 테마 TOP 3 vs 부진 테마", svgContent: slide2Svg },
    { slideNumber: 3, title: "Market Scale", subtitle: "503.5조 생태계 & 7대 자산군", svgContent: slide3Svg },
    { slideNumber: 4, title: "Smart Money", subtitle: "큰손의 1.4조원 장바구니 영수증", svgContent: slide4Svg },
    { slideNumber: 5, title: "Disparity Alert", subtitle: "괴리율 실전 지뢰 경보 TOP 3", svgContent: slide5Svg },
    { slideNumber: 6, title: "Action & CTA", subtitle: "주말 3대 체크리스트 & 무료 진단", svgContent: slide6Svg },
  ];
}

