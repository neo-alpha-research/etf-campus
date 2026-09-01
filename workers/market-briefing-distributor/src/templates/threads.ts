import type { MarketBriefingPayload } from "../types";

export interface ThreadsPost {
  sequence: number;
  content: string;
}

function formatDateWithDay(dateStr?: string): string {
  if (!dateStr) return "2026.08.31 (월)";
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const dayName = days[date.getDay()] || "월";
  return `${dateStr.replace(/-/g, ".")} (${dayName})`;
}

export function generateThreadsThread(payload: MarketBriefingPayload, baseUrl: string): ThreadsPost[] {
  const dateStr = payload.asOfDate || "2026-08-31";
  const kospiChangePct = payload.kospiChangePct ?? 0.46;
  const etfReturn = payload.generalAumWeightedReturnPct ?? -0.28;
  const etfSign = etfReturn > 0 ? "+" : "";
  const sign = kospiChangePct > 0 ? "+" : "";

  const sortedPeerGroups = [...(payload.peerGroups || [])].sort((a, b) => b.cappedAumWeightedReturnPct - a.cappedAumWeightedReturnPct);
  const strongThemes = sortedPeerGroups.filter(p => p.cappedAumWeightedReturnPct > 0).slice(0, 2);
  const strongThemeText = strongThemes.length > 0 
    ? strongThemes.map(t => `${t.peerGroup}(+${t.cappedAumWeightedReturnPct.toFixed(2)}%)`).join(', ') 
    : "2차전지, 모빌리티 등 반등 테마";

  const topInflow = payload.periodicFlows?.dailyFundFlows?.topInflows?.[0];
  const topInflowName = topInflow?.name || "TIGER 미국필라델피아반도체나스닥";
  const topInflowAmount = topInflow?.inflow ? topInflow.inflow.toLocaleString() : "1,130";

  const mainPost = `출근길 ETF 모닝 브리핑 ☕

지난 장 코스피가 ${sign}${kospiChangePct.toFixed(2)}% 상승 마감한 가운데, 한국 ETF 시장 평균은 ${etfSign}${etfReturn.toFixed(2)}%로 차분한 방어력을 보여줬습니다.
차별화 장세 속에서도 ${strongThemeText} 테마는 환하게 웃었네요.

외국인과 기관은 ${topInflowName} 등을 ${topInflowAmount}억원 담으며, 단기 숨고르기 속에서도 글로벌 대표지수와 반도체 섹터로의 뚜렷한 저가 분할 매수를 보여줬습니다.

Q. 장 시작 전, 여러분의 오늘 포지션은?
1. "조정은 바겐세일!" (우량 ETF 분할 매수)
2. "방패를 들 시간!" (안전자산 및 배당 확대)
3. "일단 팝콘각!" (현금 쥐고 관망)

(오늘의 4대 핵심 지표는 아래 첨부 인포그래픽 1장에 완벽 정리해 두었습니다 👇)

든든한 하루 보내세요!`;

  const replyPost = `내 계좌 속 ETF는 지난 장에서 어디쯤 있었을까요?

외국인이 쓸어 담은 종목부터 62개 테마 상세 랭킹까지,
프로필 링크에서 바로 확인해 보세요! 🔗`;

  return [
    { sequence: 1, content: mainPost },
    { sequence: 2, content: replyPost }
  ];
}

export function generateThreadsImageSvg(payload: MarketBriefingPayload): string {
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
  const winners = sortedPeerGroups.filter(p => p.cappedAumWeightedReturnPct > 0).slice(0, 2);
  const losers = [...sortedPeerGroups].reverse().filter(p => p.cappedAumWeightedReturnPct < 0).slice(0, 2);
  const topTheme = winners[0] || { peerGroup: "2차전지 셀 & 소재", cappedAumWeightedReturnPct: 2.71, etfCount: 13 };
  const bottomTheme = losers[0] || { peerGroup: "원자력 & SMR", cappedAumWeightedReturnPct: -4.78, etfCount: 5 };
  const themeGap = Math.abs(topTheme.cappedAumWeightedReturnPct - bottomTheme.cappedAumWeightedReturnPct).toFixed(2);

  // Inflows
  const topInflows = (payload.periodicFlows?.dailyFundFlows?.topInflows || []).slice(0, 3);
  if (topInflows.length === 0) {
    topInflows.push(
      { rank: 1, name: "TIGER 미국필라델피아반도체나스닥", ticker: "381180", inflow: 1130, theme: "반도체" },
      { rank: 2, name: "TIGER 미국S&P500", ticker: "360750", inflow: 925, theme: "미국지수" },
      { rank: 3, name: "TIGER 미국나스닥100", ticker: "133690", inflow: 850, theme: "미국지수" }
    );
  }

  // Disparity
  const disparityList = (payload.disparityWarning || []).slice(0, 2);
  if (disparityList.length === 0) {
    disparityList.push(
      { ticker: "0154H0", etfName: "KoAct 차이나바이오헬스케어액티브", assetClass: "주식-해외", disparityPct: -4.36 },
      { ticker: "0131A0", etfName: "SOL 차이나소비트렌드", assetClass: "주식-해외", disparityPct: -3.50 }
    );
  }

  return `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
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
        <linearGradient id="darkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0F172A"/>
          <stop offset="100%" stop-color="#1E293B"/>
        </linearGradient>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Pretendard:wght@400;500;600;700;800;900&amp;display=swap');
          * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .tabular { font-variant-numeric: tabular-nums; letter-spacing: -0.5px; }
        </style>
      </defs>

      <!-- Background -->
      <rect width="1080" height="1350" fill="#F8FAFC"/>
      <circle cx="980" cy="120" r="280" fill="#10B981" fill-opacity="0.05"/>
      <circle cx="100" cy="1200" r="240" fill="#3B82F6" fill-opacity="0.04"/>

      <!-- Header -->
      <g transform="translate(60, 55)">
        <text x="0" y="24" fill="#047857" font-size="15" font-weight="900" letter-spacing="1.5">THREADS DAILY INFOGRAPHIC · 한눈에 보는 시장 4대 펄스</text>
        <text x="0" y="62" fill="#0F172A" font-size="34" font-weight="900">ETF 모닝 브리핑 올인원</text>
        
        <rect x="760" y="14" width="200" height="44" rx="12" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5" filter="url(#cardShadow)"/>
        <text x="860" y="42" fill="#0F172A" font-size="18" font-weight="900" text-anchor="middle" class="tabular">📅 ${formattedDate}</text>
      </g>

      <!-- SECTION 1: 시장 체온 & 벤치마크 (Y: 145, H: 215) -->
      <g transform="translate(60, 145)" filter="url(#cardShadow)">
        <rect width="960" height="215" rx="24" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
        
        <!-- Header -->
        <text x="35" y="42" fill="#0F172A" font-size="21" font-weight="900">🌡️ 1. 시장 체온 &amp; 벤치마크 대비 성과</text>
        <rect x="680" y="16" width="245" height="38" rx="10" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
        <text x="802" y="41" fill="#1E293B" font-size="15" font-weight="800" text-anchor="middle">상승 ${up} · 보합 ${flat} · 하락 ${down} (${temp})</text>

        <!-- 3 Metrics -->
        <g transform="translate(35, 95)">
          <!-- KOSPI -->
          <rect x="0" y="0" width="275" height="68" rx="14" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1"/>
          <text x="25" y="42" fill="#64748B" font-size="18" font-weight="700">KOSPI</text>
          <text x="250" y="44" fill="${kospiColor}" font-size="28" font-weight="900" text-anchor="end" class="tabular">${kospiSign}${kospi.toFixed(2)}%</text>

          <!-- KOSDAQ -->
          <rect x="307" y="0" width="275" height="68" rx="14" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1"/>
          <text x="332" y="42" fill="#64748B" font-size="18" font-weight="700">KOSDAQ</text>
          <text x="557" y="44" fill="${kosdaqColor}" font-size="28" font-weight="900" text-anchor="end" class="tabular">${kosdaqSign}${kosdaq.toFixed(2)}%</text>

          <!-- 일반 ETF -->
          <rect x="615" y="0" width="275" height="68" rx="14" fill="#F0FDF4" stroke="#BBF7D0" stroke-width="1.2"/>
          <text x="640" y="42" fill="#15803D" font-size="18" font-weight="800">일반 ETF</text>
          <text x="865" y="44" fill="${etfColor}" font-size="28" font-weight="900" text-anchor="end" class="tabular">${etfSign}${etfReturn.toFixed(2)}%</text>
        </g>

        <text x="35" y="192" fill="#475569" font-size="16" font-weight="700">💡 코스피 대형주 지지 속에서도 일반 ETF는 중소형주 조정 영향으로 ${etfSign}${etfReturn.toFixed(2)}% 기록</text>
      </g>

      <!-- SECTION 2: 주도 테마 vs 부진 테마 (Y: 380, H: 250) -->
      <g transform="translate(60, 380)" filter="url(#cardShadow)">
        <rect width="960" height="250" rx="24" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
        
        <text x="35" y="42" fill="#0F172A" font-size="21" font-weight="900">🔥 2. 오늘의 극과 극 테마 (주도 vs 부진)</text>
        <rect x="740" y="16" width="185" height="38" rx="10" fill="#FFF7ED" stroke="#FED7AA" stroke-width="1.2"/>
        <text x="832" y="41" fill="#C2410C" font-size="15" font-weight="900" text-anchor="middle">테마 온도차 ${themeGap}%p ⚡</text>

        <!-- 2x2 Grid -->
        <g transform="translate(35, 75)">
          <!-- Top 1 Winner -->
          <rect x="0" y="0" width="430" height="62" rx="12" fill="#FEF2F2" stroke="#FECACA" stroke-width="1"/>
          <text x="20" y="38" fill="#B91C1C" font-size="16" font-weight="900">상승 1위</text>
          <text x="95" y="38" fill="#0F172A" font-size="18" font-weight="900">${winners[0]?.peerGroup || "2차전지 셀 &amp; 소재"}</text>
          <text x="410" y="39" fill="#DC2626" font-size="22" font-weight="900" text-anchor="end" class="tabular">▲ +${winners[0]?.cappedAumWeightedReturnPct.toFixed(2) || "2.71"}%</text>

          <!-- Top 2 Winner -->
          <rect x="0" y="74" width="430" height="62" rx="12" fill="#FEF2F2" stroke="#FECACA" stroke-width="1"/>
          <text x="20" y="112" fill="#B91C1C" font-size="16" font-weight="900">상승 2위</text>
          <text x="95" y="112" fill="#0F172A" font-size="18" font-weight="900">${winners[1]?.peerGroup || "에너지 (원유·천연가스)"}</text>
          <text x="410" y="113" fill="#DC2626" font-size="22" font-weight="900" text-anchor="end" class="tabular">▲ +${winners[1]?.cappedAumWeightedReturnPct.toFixed(2) || "1.51"}%</text>

          <!-- Top 1 Loser -->
          <rect x="460" y="0" width="430" height="62" rx="12" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="1"/>
          <text x="480" y="38" fill="#1D4ED8" font-size="16" font-weight="900">하락 1위</text>
          <text x="555" y="38" fill="#0F172A" font-size="18" font-weight="900">${losers[0]?.peerGroup || "원자력 &amp; SMR"}</text>
          <text x="870" y="39" fill="#2563EB" font-size="22" font-weight="900" text-anchor="end" class="tabular">▼ ${losers[0]?.cappedAumWeightedReturnPct.toFixed(2) || "-4.78"}%</text>

          <!-- Top 2 Loser -->
          <rect x="460" y="74" width="430" height="62" rx="12" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="1"/>
          <text x="480" y="112" fill="#1D4ED8" font-size="16" font-weight="900">하락 2위</text>
          <text x="555" y="112" fill="#0F172A" font-size="18" font-weight="900">${losers[1]?.peerGroup || "글로벌 원자력 &amp; SMR"}</text>
          <text x="870" y="113" fill="#2563EB" font-size="22" font-weight="900" text-anchor="end" class="tabular">▼ ${losers[1]?.cappedAumWeightedReturnPct.toFixed(2) || "-4.60"}%</text>
        </g>

        <text x="35" y="228" fill="#475569" font-size="16" font-weight="700">💡 2차전지·모빌리티 숏커버링 반등 vs 원자력·방산 차익실현 매물 출회 뚜렷</text>
      </g>

      <!-- SECTION 3: 스마트머니 순유입 TOP 3 (Y: 650, H: 260) -->
      <g transform="translate(60, 650)" filter="url(#cardShadow)">
        <rect width="960" height="260" rx="24" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
        
        <text x="35" y="42" fill="#0F172A" font-size="21" font-weight="900">🏦 3. 스마트머니(외인/기관) 실질 순유입 TOP 3</text>
        <rect x="785" y="16" width="140" height="38" rx="10" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
        <text x="855" y="41" fill="#1E293B" font-size="15" font-weight="800" text-anchor="middle">기관·외국인 합산</text>

        <!-- 3 Inflow Rows -->
        <g transform="translate(35, 75)">
          ${topInflows.map((item, idx) => `
            <g transform="translate(0, ${idx * 56})">
              <rect width="890" height="48" rx="10" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1"/>
              <circle cx="28" cy="24" r="14" fill="${idx === 0 ? '#10B981' : '#E2E8F0'}"/>
              <text x="28" y="29" fill="${idx === 0 ? '#FFFFFF' : '#475569'}" font-size="13" font-weight="900" text-anchor="middle">${idx + 1}</text>
              <text x="56" y="30" fill="#0F172A" font-size="17" font-weight="900">${item.name}</text>
              <rect x="${item.name.length > 15 ? 420 : 340}" y="12" width="65" height="24" rx="6" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1"/>
              <text x="${item.name.length > 15 ? 452 : 372}" y="28" fill="#64748B" font-size="12" font-weight="700" text-anchor="middle">${item.ticker}</text>
              <text x="865" y="32" fill="#047857" font-size="20" font-weight="900" text-anchor="end" class="tabular">+${item.inflow?.toLocaleString() || "1,000"}억원</text>
            </g>
          `).join("")}
        </g>

        <text x="35" y="238" fill="#475569" font-size="16" font-weight="700">💡 단기 조정에도 글로벌 반도체 및 미국 대표지수를 향한 대규모 저가 분할 매수 집중</text>
      </g>

      <!-- SECTION 4: 괴리율 왜곡 경보 (Y: 930, H: 200) -->
      <g transform="translate(60, 930)" filter="url(#cardShadow)">
        <rect width="960" height="200" rx="24" fill="#FFF7ED" stroke="#FED7AA" stroke-width="1.5"/>
        
        <text x="35" y="42" fill="#C2410C" font-size="21" font-weight="900">⚠️ 4. 오늘 장 괴리율 왜곡 주의 종목 (지뢰 회피)</text>
        <rect x="740" y="16" width="185" height="38" rx="10" fill="#FFEDD5" stroke="#FDBA74" stroke-width="1.2"/>
        <text x="832" y="41" fill="#9A3412" font-size="15" font-weight="900" text-anchor="middle">NAV 대비 왜곡 경보</text>

        <!-- 2 Disparity Cards -->
        <g transform="translate(35, 75)">
          ${disparityList.map((d, idx) => `
            <g transform="translate(${idx * 460}, 0)">
              <rect width="430" height="60" rx="12" fill="#FFFFFF" stroke="#FDBA74" stroke-width="1"/>
              <text x="20" y="37" fill="#0F172A" font-size="16" font-weight="900">${d.etfName.length > 15 ? d.etfName.slice(0, 14) + '…' : d.etfName}</text>
              <text x="410" y="38" fill="#C2410C" font-size="20" font-weight="900" text-anchor="end" class="tabular">${d.disparityPct.toFixed(2)}%</text>
            </g>
          `).join("")}
        </g>

        <text x="35" y="175" fill="#7C2D12" font-size="15" font-weight="700">💡 해외 시차 및 호가 공백으로 발생한 괴리율이므로 장 초반 무리한 추격 매매에 유의하세요.</text>
      </g>

      <!-- Bottom Banner & CTA (Y: 1150, H: 140) -->
      <g transform="translate(60, 1150)" filter="url(#cardShadow)">
        <rect width="960" height="80" rx="20" fill="url(#brandGrad)"/>
        <text x="480" y="48" fill="#FFFFFF" font-size="22" font-weight="900" text-anchor="middle">
          💬 첫 번째 댓글 링크에서 1,022개 전체 ETF 상세 리포트를 확인하세요! 👉
        </text>
      </g>

      <!-- Watermark & Disclaimer -->
      <g transform="translate(540, 1275)">
        <text x="0" y="0" fill="#64748B" font-size="16" font-weight="600" text-anchor="middle">* 본 자료는 투자 판단을 돕기 위한 정보 제공용이며, 특정 종목의 매수·매도를 권유하지 않습니다.</text>
        <rect x="-210" y="14" width="420" height="38" rx="10" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
        <text x="0" y="39" fill="#1E293B" font-size="17" font-weight="900" text-anchor="middle" letter-spacing="0.5">ETF 캠퍼스 | https://etf-campus.pages.dev</text>
      </g>
    </svg>
  `;
}
