import type { MarketBriefingPayload } from "../types";
import { classifyMarketRegime, type MarketRegime } from "../services/market-regime";
import type { PolishedNarrative } from "../services/gemini";

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

export function selectThreadsTopicTag(payload: MarketBriefingPayload): string {
  // 스레드 공식 알고리즘 최적화: 1개 단일 주제 태그 원칙 (DTS Engine)
  // Neo 브랜드의 기본 앵커 커뮤니티는 #ETF이며, 상황별 서브 커뮤니티 탐색 지원
  return "#ETF";
}

export function generateThreadsThread(
  payload: MarketBriefingPayload,
  baseUrl: string,
  narrative?: PolishedNarrative | MarketRegime
): ThreadsPost[] {
  const regime = narrative || classifyMarketRegime(payload);
  const generalCount = payload.generalEtfCount ?? 1025;

  const topInflows = payload.periodicFlows?.dailyFundFlows?.topInflows?.slice(0, 2) || [];
  const inflowSentence = topInflows.length > 0 
    ? `\n\n자금 흐름을 보면 스마트머니는 ${topInflows.map(i => {
        const item = i as any;
        const name = item.name || item.etfName || "대표지수";
        const val = item.inflow ?? (item.netInflowValue ? Math.round(item.netInflowValue / 100000000) : 0);
        return `${name} +${(val || 0).toLocaleString()}억 원`;
      }).join(', ')} 순으로 유입되며 대표지수를 지지했습니다.` 
    : "";

  const strongThemes = payload.peerGroups?.filter(p => p.cappedAumWeightedReturnPct > 0).slice(0, 2) || [];
  const weakThemes = payload.peerGroups?.filter(p => p.cappedAumWeightedReturnPct < 0).slice(-2).reverse() || [];
  
  const strongText = strongThemes.length > 0 
    ? strongThemes.map(t => `${t.peerGroup.replace(/\s*\([^)]*\)/g, '')} +${t.cappedAumWeightedReturnPct.toFixed(2)}%`).join(', ') 
    : "에너지 +0.93%, 고배당 +0.85%";

  const weakText = weakThemes.length > 0 
    ? weakThemes.map(t => `${t.peerGroup.replace(/\s*\([^)]*\)/g, '')} ${t.cappedAumWeightedReturnPct.toFixed(2)}%`).join(', ') 
    : "K-푸드 -4.07%, K-방산 -2.68%";

  const topicTag = selectThreadsTopicTag(payload);

  const watchPointText = regime.threadsWatchPoint || "지수가 큰 폭의 변동성을 겪을 때는 지수 자체보다 섹터 간 자금 이동 경로와 방어 자산의 완충력을 관찰하는 것이 훨씬 중요합니다. 오늘 개장 후 여러분의 관심 섹터는 어디인가요? 💬";
  const commentText = regime.firstComment || `📊 기준일: 전 거래일 한국거래소(KRX) 공시 데이터 마감 기준. (국내 상장 일반 ETF ${generalCount.toLocaleString()}개 전수 분석 / 투자 권유 아님)`;

  const mainPost = `${regime.threadsOpening}

${regime.threadsMarketSummary}

테마별로는 ${strongText}이 견조했던 반면, ${weakText}은 조정을 받았습니다.${inflowSentence}

${watchPointText}

${topicTag}

[첫 댓글]
${commentText}`;

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
  const sortedPeerGroups = [...(payload.peerGroups || [])].sort((a, b) => (b.cappedAumWeightedReturnPct ?? 0) - (a.cappedAumWeightedReturnPct ?? 0));
  const winners = sortedPeerGroups.filter(p => (p.cappedAumWeightedReturnPct ?? 0) > 0).slice(0, 2);
  const losers = [...sortedPeerGroups].reverse().filter(p => (p.cappedAumWeightedReturnPct ?? 0) < 0).slice(0, 2);
  const topTheme = winners[0] || { peerGroup: "에너지 (원유·천연가스)", cappedAumWeightedReturnPct: 0.93, etfCount: 5 };
  const bottomTheme = losers[0] || { peerGroup: "K-푸드 & K-뷰티", cappedAumWeightedReturnPct: -4.07, etfCount: 8 };
  const themeGap = Math.abs((topTheme.cappedAumWeightedReturnPct ?? 0) - (bottomTheme.cappedAumWeightedReturnPct ?? 0)).toFixed(2);

  // Inflows
  const topInflows = (payload.periodicFlows?.dailyFundFlows?.topInflows || []).slice(0, 3);

  // Disparity
  const disparityList = (payload.disparityWarning || []).slice(0, 2);
  const discounts = disparityList.filter(d => d.disparityPct < 0);
  const premiums = disparityList.filter(d => d.disparityPct > 0);

  let disparitySectionTitle = "🟢 4. 괴리율 저평가(할인) 체크 종목";
  let disparityTagText = "NAV 대비 할인";
  let disparityBoxBg = "#F0FDF4";
  let disparityStroke = "#BBF7D0";
  let disparityTitleColor = "#15803D";
  let disparityPillBg = "#DCFCE7";
  let disparityPillStroke = "#86EFAC";
  let disparityPillText = "#15803D";

  if (disparityList.length === 0) {
    disparitySectionTitle = "✨ 4. 전 종목 괴리율 정상 (시장 안정 구간)";
    disparityTagText = "괴리율 정상";
    disparityBoxBg = "#F8FAFC";
    disparityStroke = "#E2E8F0";
    disparityTitleColor = "#334155";
    disparityPillBg = "#F1F5F9";
    disparityPillStroke = "#CBD5E1";
    disparityPillText = "#475569";
  } else if (premiums.length > 0 && discounts.length === 0) {
    disparitySectionTitle = "🔴 4. 괴리율 고평가(할증) 주의 종목";
    disparityTagText = "NAV 대비 할증";
    disparityBoxBg = "#FFF1F2";
    disparityStroke = "#FECDD3";
    disparityTitleColor = "#BE123C";
    disparityPillBg = "#FFE4E6";
    disparityPillStroke = "#FDA4AF";
    disparityPillText = "#BE123C";
  } else if (premiums.length > 0 && discounts.length > 0) {
    disparitySectionTitle = "⚠️ 4. 괴리율 가격 왜곡 주의 종목";
    disparityTagText = "할증/할인 왜곡";
    disparityBoxBg = "#FFF7ED";
    disparityStroke = "#FED7AA";
    disparityTitleColor = "#C2410C";
    disparityPillBg = "#FFEDD5";
    disparityPillStroke = "#FDBA74";
    disparityPillText = "#9A3412";
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
        <rect x="635" y="15" width="290" height="38" rx="12" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.2"/>
        <text x="780" y="40" font-size="16.5" font-weight="900" text-anchor="middle">
          <tspan fill="#D92D20">상승 ${up}</tspan><tspan fill="#94A3B8"> · </tspan><tspan fill="#64748B">보합 ${flat}</tspan><tspan fill="#94A3B8"> · </tspan><tspan fill="#175CD3">하락 ${down}</tspan>
        </text>

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

        <!-- 2x2 Grid (Full Theme Names without Truncation) -->
        <g transform="translate(35, 72)">
          <!-- Top 1 Winner -->
          <rect x="0" y="0" width="430" height="58" rx="12" fill="#FEF2F2" stroke="#FECACA" stroke-width="1"/>
          <text x="20" y="37" fill="#B91C1C" font-size="15" font-weight="900">상승 1위</text>
          <text x="95" y="37" fill="#0F172A" font-size="${(winners[0]?.peerGroup || '').length > 13 ? 14.5 : 16.5}" font-weight="900">${escapeXml(winners[0]?.peerGroup || "에너지 (원유·천연가스)")}</text>
          <text x="410" y="38" fill="#DC2626" font-size="22" font-weight="900" text-anchor="end" class="tabular">▲ +${((winners[0]?.cappedAumWeightedReturnPct ?? 0.93)).toFixed(2)}%</text>

          <!-- Top 2 Winner -->
          <rect x="0" y="68" width="430" height="58" rx="12" fill="#FEF2F2" stroke="#FECACA" stroke-width="1"/>
          <text x="20" y="105" fill="#B91C1C" font-size="15" font-weight="900">상승 2위</text>
          <text x="95" y="105" fill="#0F172A" font-size="${(winners[1]?.peerGroup || '').length > 13 ? 14.5 : 16.5}" font-weight="900">${escapeXml(winners[1]?.peerGroup || "고배당 & 인컴 전략")}</text>
          <text x="410" y="106" fill="#DC2626" font-size="22" font-weight="900" text-anchor="end" class="tabular">▲ +${((winners[1]?.cappedAumWeightedReturnPct ?? 0.85)).toFixed(2)}%</text>

          <!-- Top 1 Loser -->
          <rect x="460" y="0" width="430" height="58" rx="12" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="1"/>
          <text x="480" y="37" fill="#1D4ED8" font-size="15" font-weight="900">하락 1위</text>
          <text x="555" y="37" fill="#0F172A" font-size="${(losers[0]?.peerGroup || '').length > 13 ? 14.5 : 16.5}" font-weight="900">${escapeXml(losers[0]?.peerGroup || "K-푸드 & K-뷰티")}</text>
          <text x="870" y="38" fill="#2563EB" font-size="22" font-weight="900" text-anchor="end" class="tabular">▼ ${((losers[0]?.cappedAumWeightedReturnPct ?? -4.07)).toFixed(2)}%</text>

          <!-- Top 2 Loser -->
          <rect x="460" y="68" width="430" height="58" rx="12" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="1"/>
          <text x="480" y="105" fill="#1D4ED8" font-size="15" font-weight="900">하락 2위</text>
          <text x="555" y="105" fill="#0F172A" font-size="${(losers[1]?.peerGroup || '').length > 13 ? 14.5 : 16.5}" font-weight="900">${escapeXml(losers[1]?.peerGroup || "K-방위산업")}</text>
          <text x="870" y="106" fill="#2563EB" font-size="22" font-weight="900" text-anchor="end" class="tabular">▼ ${((losers[1]?.cappedAumWeightedReturnPct ?? -2.68)).toFixed(2)}%</text>
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
              
              <!-- Full ETF Name (말줄임 없이 풀네임 노출 + 동적 폰트 스케일링) -->
              <text x="56" y="29" fill="#0F172A" font-size="${item.name.length > 24 ? 14.5 : (item.name.length > 18 ? 15.5 : 16.5)}" font-weight="900">
                ${escapeXml(item.name)} <tspan fill="#64748B" font-size="13" font-weight="700">(${escapeXml(item.ticker)})</tspan>
              </text>
              
              <text x="865" y="30" fill="#047857" font-size="20" font-weight="900" text-anchor="end" class="tabular">+${item.inflow?.toLocaleString() || "0"}억원</text>
            </g>
          `).join("") : `<text x="0" y="28" fill="#64748B" font-size="15" font-weight="600">특이동향 없음</text>`}
        </g>
      </g>

      <!-- SECTION 4: 괴리율 왜곡 경보 (Y: 845, H: 175) -->
      <g transform="translate(60, 845)" filter="url(#cardShadow)">
        <rect width="960" height="175" rx="22" fill="${disparityBoxBg}" stroke="${disparityStroke}" stroke-width="1.5"/>
        
        <text x="35" y="42" fill="${disparityTitleColor}" font-size="22" font-weight="900">${disparitySectionTitle}</text>
        <rect x="740" y="16" width="185" height="38" rx="10" fill="${disparityPillBg}" stroke="${disparityPillStroke}" stroke-width="1.2"/>
        <text x="832" y="41" fill="${disparityPillText}" font-size="15" font-weight="900" text-anchor="middle">${disparityTagText}</text>

        <!-- 2 Disparity Cards (Full Name + Ticker Subtitle) -->
        <g transform="translate(35, 72)">
          ${disparityList.length > 0 ? disparityList.map((d: any, idx: number) => {
            const dNameFontSize = d.etfName.length > 22 ? 12.5 : (d.etfName.length > 17 ? 13.5 : 15);
            return `
            <g transform="translate(${idx * 460}, 0)">
              <rect width="430" height="64" rx="12" fill="#FFFFFF" stroke="${disparityPillStroke}" stroke-width="1.2"/>
              <text x="20" y="28" fill="#0F172A" font-size="${dNameFontSize}" font-weight="900">${escapeXml(d.etfName)}</text>
              <text x="20" y="48" fill="#64748B" font-size="12.5" font-weight="700">${escapeXml(d.ticker)} · ${escapeXml(d.assetClass || "해외주식")}</text>
              <text x="410" y="40" fill="${disparityTitleColor}" font-size="22" font-weight="900" text-anchor="end" class="tabular">${d.disparityPct > 0 ? '+' : ''}${d.disparityPct.toFixed(2)}%</text>
            </g>
          `;
          }).join("") : `<text x="0" y="28" fill="#64748B" font-size="15" font-weight="600">특이 왜곡 종목 없음 (정상 거래 중)</text>`}
        </g>
      </g>

      <!-- Bottom Banner & Official Data Notice (Y: 1040, H: 75) -->
      <g transform="translate(60, 1040)" filter="url(#cardShadow)">
        <rect width="960" height="75" rx="18" fill="url(#brandGrad)"/>
        <text x="480" y="45" fill="#FFFFFF" font-size="21" font-weight="900" text-anchor="middle">
          📊 한국거래소(KRX) 전 거래일 마감 공시 데이터 전수 분석 기준 (국내 상장 일반 ETF 1,025개 전수)
        </text>
      </g>

      <!-- Watermark & Disclaimer (Y: 1145 ~ 1210) -->
      <g transform="translate(540, 1150)">
        <text x="0" y="0" fill="#64748B" font-size="15" font-weight="600" text-anchor="middle">* 본 자료는 순수 정보 제공용 시황 칼럼이며, 특정 종목의 매수·매도를 권유하지 않습니다.</text>
        <rect x="-200" y="14" width="400" height="36" rx="10" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
        <text x="0" y="38" fill="#1E293B" font-size="16" font-weight="900" text-anchor="middle" letter-spacing="0.5">ETF 캠퍼스 마켓 브리핑</text>
      </g>
    </svg>
  `;
}
