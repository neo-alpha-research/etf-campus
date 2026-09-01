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
  const formattedDate = dateStr.replace(/-/g, '.');
  const kospi = payload.kospiChangePct ?? 0.46;
  const etfReturn = payload.generalAumWeightedReturnPct ?? -0.28;
  const etfSign = etfReturn > 0 ? "+" : "";
  const sign = kospi > 0 ? "+" : "";

  const up = payload.upCount ?? 305;
  const down = payload.downCount ?? 670;
  const generalCount = payload.generalEtfCount ?? 1022;

  const sortedPeerGroups = [...(payload.peerGroups || [])].sort((a, b) => b.cappedAumWeightedReturnPct - a.cappedAumWeightedReturnPct);
  const winners = sortedPeerGroups.filter(p => p.cappedAumWeightedReturnPct > 0).slice(0, 2);
  const losers = [...sortedPeerGroups].reverse().filter(p => p.cappedAumWeightedReturnPct < 0).slice(0, 2);
  const topTheme = winners[0] || { peerGroup: "2차전지 셀 & 소재", cappedAumWeightedReturnPct: 2.71 };
  const bottomTheme = losers[0] || { peerGroup: "원자력 & SMR", cappedAumWeightedReturnPct: -4.78 };

  const topInflows = payload.periodicFlows?.dailyFundFlows?.topInflows || [];
  const topInflow = topInflows[0];
  const inflowText = topInflow 
    ? `3️⃣ [수급] ${topInflow.name}에 +${topInflow.inflow.toLocaleString()}억 순유입\n`
    : "";

  const disparityList = payload.disparityWarning || [];
  const topDisparity = disparityList[0];
  const disparityText = topDisparity 
    ? `4️⃣ [경보] ${topDisparity.etfName}(${topDisparity.disparityPct.toFixed(2)}%) 괴리율 주의\n`
    : "";

  const kospiAction = kospi >= 0 ? "상승" : "하락";
  const dominantText = up >= down ? `${up}개 상승(상승 우세)` : `${down}개 하락(하락 우세)`;

  const mainPost = `출근길 ETF 모닝 브리핑 ☕ (${formattedDate} 기준)

코스피는 ${sign}${kospi.toFixed(2)}% ${kospiAction}했지만, 일반 ETF 평균은 ${etfSign}${etfReturn.toFixed(2)}%로 숨고르기였습니다.

📊 핵심 시그널:
1️⃣ [체온] ${generalCount}개 중 ${dominantText}
2️⃣ [테마] ${topTheme.peerGroup}(+${topTheme.cappedAumWeightedReturnPct.toFixed(2)}%) 반등 vs ${bottomTheme.peerGroup}(${bottomTheme.cappedAumWeightedReturnPct.toFixed(2)}%) 조정
${inflowText}${disparityText}
💬 Q. 오늘 여러분의 포지션은?
1. 조정은 기회! (우량 ETF 분할매수)
2. 방어가 최선! (배당·안전자산)
3. 일단 관망! (현금 비중 확대)

(자세한 데이터는 아래 인포그래픽 1장과 프로필 링크 [마켓 브리핑]에서 확인하세요 👇)`;

  return [
    { sequence: 1, content: mainPost }
  ];
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

  // Disparity
  const disparityList = (payload.disparityWarning || []).slice(0, 2);

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

      <!-- Clean Minimal Header (Perfect Baseline Alignment) -->
      <g transform="translate(60, 55)">
        <text x="0" y="34" fill="#0F172A" font-size="34" font-weight="900">ETF 모닝 브리핑</text>
        <text x="0" y="62" fill="#64748B" font-size="16" font-weight="700">KRX 일반 ETF ${generalCount}개 전수 분석 요약</text>
        
        <rect x="735" y="10" width="225" height="46" rx="14" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5" filter="url(#cardShadow)"/>
        <text x="847" y="39" fill="#0F172A" font-size="17" font-weight="900" text-anchor="middle" class="tabular">📅 ${formattedDate}</text>
      </g>

      <!-- SECTION 1: 시장 체온 & 벤치마크 (Y: 140, H: 175) -->
      <g transform="translate(60, 140)" filter="url(#cardShadow)">
        <rect width="960" height="175" rx="22" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
        
        <text x="35" y="42" fill="#0F172A" font-size="22" font-weight="900">🌡️ 1. 시장 체온 &amp; 벤치마크 대비 성과</text>
        <rect x="605" y="15" width="320" height="38" rx="10" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
        <text x="765" y="39" fill="#1E293B" font-size="14" font-weight="800" text-anchor="middle">상승 ${up} · 보합 ${flat} · 하락 ${down} (${temp})</text>

        <!-- 3 Big Metric Boxes with Dynamic Status Tints -->
        <g transform="translate(35, 74)">
          <!-- KOSPI -->
          <rect x="0" y="0" width="275" height="74" rx="14" fill="${kospi >= 0 ? '#FEF2F2' : '#EFF6FF'}" stroke="${kospi >= 0 ? '#FECACA' : '#BFDBFE'}" stroke-width="1.2"/>
          <text x="25" y="46" fill="${kospi >= 0 ? '#991B1B' : '#1E40AF'}" font-size="18" font-weight="800">KOSPI</text>
          <text x="250" y="48" fill="${kospiColor}" font-size="30" font-weight="900" text-anchor="end" class="tabular">${kospiSign}${kospi.toFixed(2)}%</text>

          <!-- KOSDAQ -->
          <rect x="307" y="0" width="275" height="74" rx="14" fill="${kosdaq >= 0 ? '#FEF2F2' : '#EFF6FF'}" stroke="${kosdaq >= 0 ? '#FECACA' : '#BFDBFE'}" stroke-width="1.2"/>
          <text x="332" y="46" fill="${kosdaq >= 0 ? '#991B1B' : '#1E40AF'}" font-size="18" font-weight="800">KOSDAQ</text>
          <text x="557" y="48" fill="${kosdaqColor}" font-size="30" font-weight="900" text-anchor="end" class="tabular">${kosdaqSign}${kosdaq.toFixed(2)}%</text>

          <!-- 일반 ETF -->
          <rect x="615" y="0" width="275" height="74" rx="14" fill="#F0FDF4" stroke="#BBF7D0" stroke-width="1.5"/>
          <text x="640" y="46" fill="#15803D" font-size="18" font-weight="800">일반 ETF</text>
          <text x="865" y="48" fill="${etfColor}" font-size="30" font-weight="900" text-anchor="end" class="tabular">${etfSign}${etfReturn.toFixed(2)}%</text>
        </g>
      </g>

      <!-- SECTION 2: 주도 테마 vs 부진 테마 (Y: 335, H: 220) -->
      <g transform="translate(60, 335)" filter="url(#cardShadow)">
        <rect width="960" height="220" rx="22" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
        
        <text x="35" y="42" fill="#0F172A" font-size="22" font-weight="900">🔥 2. 극과 극 테마 (주도 vs 부진)</text>
        <rect x="735" y="16" width="190" height="38" rx="10" fill="#FFF7ED" stroke="#FED7AA" stroke-width="1.2"/>
        <text x="830" y="41" fill="#C2410C" font-size="15" font-weight="900" text-anchor="middle">테마 온도차 ${themeGap}%p ⚡</text>

        <!-- 2x2 Grid -->
        <g transform="translate(35, 72)">
          <!-- Top 1 Winner -->
          <rect x="0" y="0" width="430" height="58" rx="12" fill="#FEF2F2" stroke="#FECACA" stroke-width="1"/>
          <text x="20" y="37" fill="#B91C1C" font-size="16" font-weight="900">상승 1위</text>
          <text x="95" y="37" fill="#0F172A" font-size="18" font-weight="900">${escapeXml(winners[0]?.peerGroup || "2차전지 셀 & 소재")}</text>
          <text x="410" y="38" fill="#DC2626" font-size="22" font-weight="900" text-anchor="end" class="tabular">▲ +${winners[0]?.cappedAumWeightedReturnPct.toFixed(2) || "2.71"}%</text>

          <!-- Top 2 Winner -->
          <rect x="0" y="68" width="430" height="58" rx="12" fill="#FEF2F2" stroke="#FECACA" stroke-width="1"/>
          <text x="20" y="105" fill="#B91C1C" font-size="16" font-weight="900">상승 2위</text>
          <text x="95" y="105" fill="#0F172A" font-size="18" font-weight="900">${escapeXml(winners[1]?.peerGroup || "에너지 (원유·천연가스)")}</text>
          <text x="410" y="106" fill="#DC2626" font-size="22" font-weight="900" text-anchor="end" class="tabular">▲ +${winners[1]?.cappedAumWeightedReturnPct.toFixed(2) || "1.51"}%</text>

          <!-- Top 1 Loser -->
          <rect x="460" y="0" width="430" height="58" rx="12" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="1"/>
          <text x="480" y="37" fill="#1D4ED8" font-size="16" font-weight="900">하락 1위</text>
          <text x="555" y="37" fill="#0F172A" font-size="18" font-weight="900">${escapeXml(losers[0]?.peerGroup || "원자력 & SMR")}</text>
          <text x="870" y="38" fill="#2563EB" font-size="22" font-weight="900" text-anchor="end" class="tabular">▼ ${losers[0]?.cappedAumWeightedReturnPct.toFixed(2) || "-4.78"}%</text>

          <!-- Top 2 Loser -->
          <rect x="460" y="68" width="430" height="58" rx="12" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="1"/>
          <text x="480" y="105" fill="#1D4ED8" font-size="16" font-weight="900">하락 2위</text>
          <text x="555" y="105" fill="#0F172A" font-size="18" font-weight="900">${escapeXml(losers[1]?.peerGroup || "글로벌 원자력 & SMR")}</text>
          <text x="870" y="106" fill="#2563EB" font-size="22" font-weight="900" text-anchor="end" class="tabular">▼ ${losers[1]?.cappedAumWeightedReturnPct.toFixed(2) || "-4.60"}%</text>
        </g>
      </g>

      <!-- SECTION 3: 스마트머니 순유입 TOP 3 (Y: 575, H: 250) -->
      <g transform="translate(60, 575)" filter="url(#cardShadow)">
        <rect width="960" height="250" rx="22" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
        
        <text x="35" y="42" fill="#0F172A" font-size="22" font-weight="900">🏦 3. 스마트머니(외인/기관) 실질 순유입 TOP 3</text>
        <rect x="785" y="16" width="140" height="38" rx="10" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
        <text x="855" y="41" fill="#1E293B" font-size="15" font-weight="800" text-anchor="middle">기관·외국인 합산</text>

        <!-- 3 Inflow Rows (Full Name + Ticker Attached) -->
        <g transform="translate(35, 72)">
          ${topInflows.length > 0 ? topInflows.map((item, idx) => `
            <g transform="translate(0, ${idx * 54})">
              <rect width="890" height="46" rx="10" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1"/>
              <circle cx="28" cy="23" r="13" fill="${idx === 0 ? '#10B981' : '#E2E8F0'}"/>
              <text x="28" y="28" fill="${idx === 0 ? '#FFFFFF' : '#475569'}" font-size="12" font-weight="900" text-anchor="middle">${idx + 1}</text>
              
              <!-- Full ETF Name + Ticker right next to it -->
              <text x="56" y="29" fill="#0F172A" font-size="16.5" font-weight="900">
                ${escapeXml(item.name)} <tspan fill="#64748B" font-size="13.5" font-weight="700">(${escapeXml(item.ticker)})</tspan>
              </text>
              
              <text x="865" y="30" fill="#047857" font-size="20" font-weight="900" text-anchor="end" class="tabular">+${item.inflow?.toLocaleString() || "0"}억원</text>
            </g>
          `).join("") : `<text x="0" y="28" fill="#64748B" font-size="15" font-weight="600">특이동향 없음</text>`}
        </g>
      </g>

      <!-- SECTION 4: 괴리율 왜곡 경보 (Y: 845, H: 175) -->
      <g transform="translate(60, 845)" filter="url(#cardShadow)">
        <rect width="960" height="175" rx="22" fill="#FFF7ED" stroke="#FED7AA" stroke-width="1.5"/>
        
        <text x="35" y="42" fill="#C2410C" font-size="22" font-weight="900">⚠️ 4. 괴리율 왜곡 주의 종목 (지뢰 회피)</text>
        <rect x="740" y="16" width="185" height="38" rx="10" fill="#FFEDD5" stroke="#FDBA74" stroke-width="1.2"/>
        <text x="832" y="41" fill="#9A3412" font-size="15" font-weight="900" text-anchor="middle">NAV 대비 왜곡 경보</text>

        <!-- 2 Disparity Cards (Full Name + Ticker Subtitle) -->
        <g transform="translate(35, 72)">
          ${disparityList.length > 0 ? disparityList.map((d: any, idx: number) => `
            <g transform="translate(${idx * 460}, 0)">
              <rect width="430" height="64" rx="12" fill="#FFFFFF" stroke="#FDBA74" stroke-width="1.2"/>
              <text x="20" y="28" fill="#0F172A" font-size="15" font-weight="900">${escapeXml(d.etfName)}</text>
              <text x="20" y="48" fill="#64748B" font-size="12.5" font-weight="700">${escapeXml(d.ticker)} · ${escapeXml(d.assetClass || "해외주식")}</text>
              <text x="410" y="40" fill="#C2410C" font-size="22" font-weight="900" text-anchor="end" class="tabular">${d.disparityPct.toFixed(2)}%</text>
            </g>
          `).join("") : `<text x="0" y="28" fill="#64748B" font-size="15" font-weight="600">왜곡 경보 없음</text>`}
        </g>
      </g>

      <!-- Bottom Banner & CTA (Y: 1040, H: 75) -->
      <g transform="translate(60, 1040)" filter="url(#cardShadow)">
        <rect width="960" height="75" rx="18" fill="url(#brandGrad)"/>
        <text x="480" y="45" fill="#FFFFFF" font-size="21" font-weight="900" text-anchor="middle">
          👉 테마별 동향 &amp; 스마트머니 펀드 플로우는 '프로필 링크'에서 확인! 🔗
        </text>
      </g>

      <!-- Watermark & Disclaimer (Y: 1145 ~ 1210) -->
      <g transform="translate(540, 1150)">
        <text x="0" y="0" fill="#64748B" font-size="15" font-weight="600" text-anchor="middle">* 본 자료는 투자 판단을 돕기 위한 정보 제공용이며, 특정 종목의 매수·매도를 권유하지 않습니다.</text>
        <rect x="-200" y="14" width="400" height="36" rx="10" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
        <text x="0" y="38" fill="#1E293B" font-size="16" font-weight="900" text-anchor="middle" letter-spacing="0.5">ETF 캠퍼스 | https://etf-campus.pages.dev</text>
      </g>
    </svg>
  `;
}
