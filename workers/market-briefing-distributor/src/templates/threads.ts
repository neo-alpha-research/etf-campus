import type { MarketBriefingPayload } from "../types";
import type { MarketRegime } from "../services/market-regime";
import type { PolishedNarrative } from "../services/gemini";
import { fitAndClampText } from "./instagram";

export interface ThreadsPost {
  sequence: number;
  content: string;
}

function formatDateWithDay(dateStr?: string): string {
  if (!dateStr) {
    const today = new Date();
    const days = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
    return `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")} · ${days[today.getDay()]}`;
  }
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const days = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
  const dayName = days[date.getDay()] || "월요일";
  return `${dateStr.replace(/-/g, ".")} · ${dayName}`;
}

export function selectThreadsTopicTag(): string {
  return "#ETFCampus";
}

export function generateThreadsThread(
  payload: MarketBriefingPayload,
  baseUrl: string,
  narrative?: PolishedNarrative | MarketRegime
): ThreadsPost[] {
  void baseUrl;
  void narrative;
  const generalCount = payload.generalEtfCount ?? payload.pulse?.generalEtfCount ?? 0;
  const dateStr = payload.asOfDate || new Date().toISOString().slice(0, 10);
  const formattedDate = formatDateWithDay(dateStr);

  // 1. [지표 1행] 코스피 | 코스닥 (20자 내외, 최대 28자)
  const kospi = payload.kospiChangePct ?? 0;
  const kosdaq = payload.kosdaqChangePct ?? 0;
  const kospiSign = kospi > 0 ? "+" : "";
  const kosdaqSign = kosdaq > 0 ? "+" : "";
  const indexRow = `코스피 ${kospiSign}${kospi.toFixed(2)}% | 코스닥 ${kosdaqSign}${kosdaq.toFixed(2)}%`;

  // 2. [지표 2행] 상위 테마 | 하위 테마 (28자 이내 1행 완결)
  const sortedPeerGroups = [...(payload.peerGroups || [])].sort(
    (a, b) => (b.cappedAumWeightedReturnPct ?? 0) - (a.cappedAumWeightedReturnPct ?? 0)
  );
  const topTheme = sortedPeerGroups[0];
  const bottomTheme = sortedPeerGroups[sortedPeerGroups.length - 1];
  const topThemeRet = topTheme?.cappedAumWeightedReturnPct ?? 0;
  const botThemeRet = bottomTheme?.cappedAumWeightedReturnPct ?? 0;
  const topSign = topThemeRet > 0 ? "+" : "";
  const botSign = botThemeRet > 0 ? "+" : "";

  const cleanThemeName = (name: string): string => {
    return name
      .replace(/\s*\([^)]*\)/g, "")
      .replace(/피지컬\s*AI\s*&\s*지능형\s*로봇/g, "피지컬AI")
      .replace(/전통\s*반도체\s*소부장/g, "반도체소부장")
      .replace(/K-푸드\s*&\s*K-뷰티/g, "K-푸드뷰티")
      .replace(/글로벌\s*럭셔리\s*&\s*소비재/g, "글로벌럭셔리")
      .replace(/2차전지\s*셀\s*&\s*소재/g, "2차전지")
      .replace(/원자력\s*&\s*SMR/g, "원자력")
      .replace(/전력\s*인프라\s*&\s*변압기/g, "전력인프라")
      .trim();
  };

  const cleanEtfName = (rawName: string): string => {
    return rawName
      .replace(/\s*\([^)]*\)/g, "")
      .replace(/플러스/g, "")
      .replace(/액티브/g, "")
      .replace(/타겟위클리커버드콜/g, "위클리")
      .replace(/커버드콜/g, "")
      .trim();
  };

  const shortTheme = (name?: string, maxLen = 6): string => {
    if (!name) return "테마";
    const cleaned = cleanThemeName(name);
    return cleaned.length > maxLen ? cleaned.slice(0, maxLen).trim() : cleaned;
  };
  let themeRow = "상위 테마 안정 | 하위 테마 조정";
  if (topTheme && bottomTheme && topTheme !== bottomTheme) {
    const s1 = `${topSign}${topThemeRet.toFixed(1)}%`;
    const s2 = `${botSign}${botThemeRet.toFixed(1)}%`;
    const nameBudget = 23 - s1.length - s2.length;
    const maxT1 = Math.max(3, Math.floor(nameBudget / 2));
    const maxT2 = Math.max(3, nameBudget - maxT1);
    const t1 = shortTheme(topTheme.peerGroup, maxT1);
    const t2 = shortTheme(bottomTheme.peerGroup, maxT2);
    themeRow = `${t1} ${s1} | ${t2} ${s2}`;
    if (themeRow.length > 28) {
      themeRow = `상위 테마: ${shortTheme(topTheme.peerGroup, 8)} ${s1}`;
    }
  }

  // 3. [지표 3행] 스마트머니 실질 순유입 1위 | 2위 (28자 이내 1행 완결)
  const topInflows = payload.periodicFlows?.dailyFundFlows?.topInflows?.slice(0, 2) || [];
  const shortEtf = (name?: string, maxLen = 7): string => {
    if (!name) return "대표지수";
    const cleaned = cleanEtfName(name);
    return cleaned.length > maxLen ? cleaned.slice(0, maxLen).trim() : cleaned;
  };
  const getFlowVal = (item: any): number => {
    if (!item) return 0;
    if (typeof item.inflow === "number" && !isNaN(item.inflow)) return Math.round(item.inflow);
    if (typeof item.inflowAmount === "number" && !isNaN(item.inflowAmount)) return Math.round(item.inflowAmount);
    if (typeof item.netInflowValue === "number" && !isNaN(item.netInflowValue)) return Math.round(item.netInflowValue / 100000000);
    if (typeof item.net_flow === "number" && !isNaN(item.net_flow)) return Math.round(item.net_flow / 100000000);
    return 0;
  };

  let flowRow = "스마트머니 집계 중";
  if (topInflows.length >= 2) {
    const v1 = getFlowVal(topInflows[0]);
    const v2 = getFlowVal(topInflows[1]);
    const s1 = `+${v1.toLocaleString()}억`;
    const s2 = `+${v2.toLocaleString()}억`;
    const nameBudget = 23 - s1.length - s2.length;
    const maxN1 = Math.max(3, Math.floor(nameBudget / 2));
    const maxN2 = Math.max(3, nameBudget - maxN1);
    const n1 = shortEtf(topInflows[0].name || (topInflows[0] as any).etfName, maxN1);
    const n2 = shortEtf(topInflows[1].name || (topInflows[1] as any).etfName, maxN2);
    flowRow = `${n1} ${s1} | ${n2} ${s2}`;
    if (flowRow.length > 28) {
      flowRow = `순유입 1위: ${shortEtf(topInflows[0].name || (topInflows[0] as any).etfName, 8)} ${s1}`;
    }
  } else if (topInflows.length === 1) {
    const v1 = getFlowVal(topInflows[0]);
    const s1 = `+${v1.toLocaleString()}억`;
    const n1 = shortEtf(topInflows[0].name || (topInflows[0] as any).etfName, 10);
    flowRow = `순유입 1위: ${n1} ${s1}`;
  }

  // 4. [분석 불릿 3개] 40~48자 단문 규격 (섹션 간 공백 1행 의무)
  const etfReturn = payload.generalAumWeightedReturnPct ?? 0;
  const themeGap = Math.abs(topThemeRet - botThemeRet).toFixed(1);

  const bullet1 = (kospi >= 0 && etfReturn >= 0)
    ? "1. 코스피와 일반 ETF가 동반 상승하며 견조한 반등을 기록했어."
    : (kospi < 0 && etfReturn > kospi)
    ? "1. 코스피 대비 일반 ETF 수익률이 선방하며 지수 방어력을 보였어."
    : "1. 시장 변동성 확대 속 주요 대표 지수군이 단기 조정을 거쳤어.";

  const bullet2 = topTheme
    ? `2. 주도 테마와 하위 테마 간 수익률 격차는 ${themeGap}%p까지 벌어졌어.`
    : "2. 업종별 자금 순환매가 빠르게 이어지며 테마별 편차가 지속됐어.";

  const bullet3 = topInflows.length > 0
    ? "3. 기관과 외인은 채권 및 대표 지수형 ETF로 자금을 집중했어."
    : "3. 주요 섹터 및 안전자산 ETF로 실질 자금 유출입이 이어졌어.";

  // 5. [마감 CTA] 3층 구조 고밀도 2줄 단문 (기계적 1 vs 2 투표 배제)
  const ctaLine = `장기 적립 관점과 단기 모멘텀 관점의 해석이 엇갈리는 구간이야.\n다들은 이번 주 수급 흐름을 어떻게 보고 있어?`;

  // 6. [법정 출처 및 단일 니치 태그]
  const sourceNotice = `* 기준: ${dateStr} 한국거래소 KRX 공시 · 일반 ETF ${generalCount.toLocaleString()}개 전수 분석`;
  const topicTag = selectThreadsTopicTag();

  // 조립: 섹션 간 공백 1행(\n\n) 유지 와이어프레임
  const mainPost = `${formattedDate} ETF 마켓 동향

${indexRow}
${themeRow}
${flowRow}

${bullet1}

${bullet2}

${bullet3}

${ctaLine}

${sourceNotice}

${topicTag}`;

  return [
    { sequence: 1, content: mainPost.trim() }
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

export function generateThreadsImageSvg(
  payload: MarketBriefingPayload
): string {
  const dateStr = payload.asOfDate || new Date().toISOString().slice(0, 10);
  const formattedDate = formatDateWithDay(dateStr);

  const kospi = payload.kospiChangePct ?? 0;
  const kosdaq = payload.kosdaqChangePct ?? 0;
  const etfReturn = payload.generalAumWeightedReturnPct ?? 0;
  const kospiSign = kospi > 0 ? "+" : "";
  const kosdaqSign = kosdaq > 0 ? "+" : "";
  const etfSign = etfReturn > 0 ? "+" : "";
  const kospiColor = kospi >= 0 ? "#D92D20" : "#175CD3";
  const kosdaqColor = kosdaq >= 0 ? "#D92D20" : "#175CD3";
  const etfColor = etfReturn >= 0 ? "#D92D20" : "#175CD3";

  const up = payload.upCount ?? payload.pulse?.upCount ?? 0;
  const down = payload.downCount ?? payload.pulse?.downCount ?? 0;
  const flat = payload.flatCount ?? payload.pulse?.flatCount ?? 0;
  const generalCount = payload.generalEtfCount ?? payload.pulse?.generalEtfCount ?? 0;

  // Peer Groups (상위/하위 랭킹 SSOT)
  const sortedPeerGroups = [...(payload.peerGroups || [])].sort((a, b) => (b.cappedAumWeightedReturnPct ?? 0) - (a.cappedAumWeightedReturnPct ?? 0));
  const topTheme = sortedPeerGroups[0] || { peerGroup: "데이터 없음", cappedAumWeightedReturnPct: 0, etfCount: 0 };
  const bottomTheme = sortedPeerGroups[sortedPeerGroups.length - 1] || topTheme;
  const themeGap = Math.abs((topTheme.cappedAumWeightedReturnPct ?? 0) - (bottomTheme.cappedAumWeightedReturnPct ?? 0)).toFixed(2);

  const cleanTopTheme = topTheme.peerGroup.replace(/\s*\([^)]*\)/g, '').trim();
  const cleanBottomTheme = bottomTheme.peerGroup.replace(/\s*\([^)]*\)/g, '').trim();

  const topThemeRet = topTheme.cappedAumWeightedReturnPct ?? 0;
  const bottomThemeRet = bottomTheme.cappedAumWeightedReturnPct ?? 0;
  const topThemeSign = topThemeRet > 0 ? "▲ +" : topThemeRet < 0 ? "▼ " : "";
  const bottomThemeSign = bottomThemeRet > 0 ? "▲ +" : bottomThemeRet < 0 ? "▼ " : "";
  const topThemeColor = topThemeRet >= 0 ? "#D92D20" : "#175CD3";
  const bottomThemeColor = bottomThemeRet >= 0 ? "#D92D20" : "#175CD3";

  // Inflows: Focus on Top 1
  const allInflows = payload.periodicFlows?.dailyFundFlows?.topInflows || [];
  const getInflowVal = (item: any): number => {
    if (!item) return 0;
    if (typeof item.inflow === "number" && !isNaN(item.inflow)) return Math.round(item.inflow);
    if (typeof item.inflowAmount === "number" && !isNaN(item.inflowAmount)) return Math.round(item.inflowAmount);
    if (typeof item.netInflowValue === "number" && !isNaN(item.netInflowValue)) return Math.round(item.netInflowValue / 100000000);
    if (typeof item.net_flow === "number" && !isNaN(item.net_flow)) return Math.round(item.net_flow / 100000000);
    return 0;
  };
  const topInflow1 = allInflows[0] || { name: "데이터 수집 중", ticker: "-", inflow: 0 };
  const topInflow1Val = getInflowVal(topInflow1);
  const cleanTopInflow1Name = (topInflow1.name || (topInflow1 as any).etfName || "데이터 수집 중").replace(/\s*\([^)]*\)/g, '').trim();

  return `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ETF 모닝 브리핑 인포그래픽 - ${formattedDate}">
      <title>ETF 모닝 브리핑 인포그래픽 - ${formattedDate}</title>
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
          @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css');
          * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', '맑은 고딕', 'Noto Sans KR', 'Segoe UI', sans-serif, 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji'; }
          .tabular { font-variant-numeric: tabular-nums; letter-spacing: -0.5px; }
        </style>
      </defs>

      <!-- Background -->
      <rect width="1080" height="1350" fill="#F8FAFC"/>
      <circle cx="980" cy="120" r="280" fill="#10B981" fill-opacity="0.05"/>
      <circle cx="100" cy="1200" r="240" fill="#3B82F6" fill-opacity="0.04"/>

      <!-- Clean Minimal Header (Scaled Up & Rebalanced) -->
      <g transform="translate(60, 48)">
        <text x="0" y="56" fill="#0F172A" font-size="52" font-weight="900" letter-spacing="-0.8">ETF 모닝 브리핑</text>
        <text x="0" y="100" fill="#334155" font-size="24" font-weight="800">KRX 일반 ETF ${generalCount.toLocaleString()}개 전수 분석 요약</text>
        
        <rect x="685" y="18" width="275" height="60" rx="18" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.8" filter="url(#cardShadow)"/>
        <text x="822.5" y="56" fill="#0F172A" font-size="24" font-weight="900" text-anchor="middle" class="tabular">${formattedDate}</text>
      </g>

      <!-- SECTION 1: 시장 체온 & 3대 지수 스코어보드 (Y: 168, H: 268) [Spacious & Bold] -->
      <g transform="translate(60, 168)" filter="url(#cardShadow)">
        <rect width="960" height="268" rx="28" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.6"/>
        
        <text x="35" y="52" fill="#0F172A" font-size="30" font-weight="900">1. 시장 체온 &amp; 3대 지수 비교</text>
        <rect x="525" y="16" width="400" height="52" rx="15" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.4"/>
        <text x="725" y="48" font-size="22" font-weight="900" text-anchor="middle">
          <tspan fill="#D92D20">상승 ${up}</tspan><tspan fill="#64748B"> · </tspan><tspan fill="#334155">보합 ${flat}</tspan><tspan fill="#64748B"> · </tspan><tspan fill="#175CD3">하락 ${down}</tspan>
        </text>

        <!-- 3 Big Metric Boxes (H: 150) -->
        <g transform="translate(35, 86)">
          <!-- KOSPI -->
          <rect x="0" y="0" width="280" height="150" rx="20" fill="${kospi >= 0 ? '#FEF2F2' : '#EFF6FF'}" stroke="${kospi >= 0 ? '#FECACA' : '#BFDBFE'}" stroke-width="1.5"/>
          <text x="24" y="52" fill="${kospi >= 0 ? '#991B1B' : '#1E40AF'}" font-size="32" font-weight="900">KOSPI</text>
          <text x="256" y="122" fill="${kospiColor}" font-size="58" font-weight="900" text-anchor="end" class="tabular">${kospiSign}${kospi.toFixed(2)}%</text>

          <!-- KOSDAQ -->
          <rect x="305" y="0" width="280" height="150" rx="20" fill="${kosdaq >= 0 ? '#FEF2F2' : '#EFF6FF'}" stroke="${kosdaq >= 0 ? '#FECACA' : '#BFDBFE'}" stroke-width="1.5"/>
          <text x="329" y="52" fill="${kosdaq >= 0 ? '#991B1B' : '#1E40AF'}" font-size="32" font-weight="900">KOSDAQ</text>
          <text x="561" y="122" fill="${kosdaqColor}" font-size="58" font-weight="900" text-anchor="end" class="tabular">${kosdaqSign}${kosdaq.toFixed(2)}%</text>

          <!-- 일반 ETF -->
          <rect x="610" y="0" width="280" height="150" rx="20" fill="#F0FDF4" stroke="#BBF7D0" stroke-width="1.6"/>
          <text x="634" y="52" fill="#15803D" font-size="32" font-weight="900">일반 ETF</text>
          <text x="866" y="122" fill="${etfColor}" font-size="58" font-weight="900" text-anchor="end" class="tabular">${etfSign}${etfReturn.toFixed(2)}%</text>
        </g>
      </g>

      <!-- SECTION 2: 오늘의 극과 극 테마 (Y: 466, H: 460) [Mega Bold & Ultra Spacious] -->
      <g transform="translate(60, 466)" filter="url(#cardShadow)">
        <rect width="960" height="460" rx="28" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.6"/>
        
        <text x="35" y="52" fill="#0F172A" font-size="34" font-weight="900">2. 오늘의 극과 극 테마 (주도 vs 부진)</text>
        <rect x="680" y="16" width="245" height="50" rx="14" fill="#FFF7ED" stroke="#FED7AA" stroke-width="1.4"/>
        <text x="802" y="48" fill="#C2410C" font-size="23" font-weight="900" text-anchor="middle">테마 온도차 ${themeGap}%p</text>

        <!-- Top 1 Winner (▲ 상위 1위 주도 테마, H: 160) -->
        <g transform="translate(35, 84)">
          <rect width="890" height="160" rx="22" fill="#FFF5F5" stroke="#FCA5A5" stroke-width="1.6"/>
          
          <!-- Row 1: Badge & ETF Count -->
          <rect x="24" y="22" width="145" height="42" rx="12" fill="#FEE2E2"/>
          <text x="96" y="49" fill="#DC2626" font-size="22" font-weight="900" text-anchor="middle">▲ 상위 1위</text>
          <text x="190" y="50" fill="#475569" font-size="23" font-weight="800">총 ${topTheme.etfCount || 5}개 ETF 구성</text>
          
          <!-- Row 2: Large Theme Name & Huge Return -->
          <text x="24" y="126" fill="#0F172A" font-size="${fitAndClampText(cleanTopTheme, 550, 42, 28).fontSize}" font-weight="900">${escapeXml(fitAndClampText(cleanTopTheme, 550, 42, 28).text)}</text>
          <text x="866" y="116" fill="${topThemeColor}" font-size="68" font-weight="900" text-anchor="end" class="tabular">${topThemeSign}${topThemeRet.toFixed(2)}%</text>
        </g>

        <!-- Bottom 1 Loser (▼ 하위 1위 부진 테마, H: 160) -->
        <g transform="translate(35, 268)">
          <rect width="890" height="160" rx="22" fill="#EFF6FF" stroke="#93C5FD" stroke-width="1.6"/>
          
          <!-- Row 1: Badge & ETF Count -->
          <rect x="24" y="22" width="145" height="42" rx="12" fill="#DBEAFE"/>
          <text x="96" y="49" fill="#1D4ED8" font-size="22" font-weight="900" text-anchor="middle">▼ 하위 1위</text>
          <text x="190" y="50" fill="#475569" font-size="23" font-weight="800">총 ${bottomTheme.etfCount || 8}개 ETF 구성</text>
          
          <!-- Row 2: Large Theme Name & Huge Return -->
          <text x="24" y="126" fill="#0F172A" font-size="${fitAndClampText(cleanBottomTheme, 550, 42, 28).fontSize}" font-weight="900">${escapeXml(fitAndClampText(cleanBottomTheme, 550, 42, 28).text)}</text>
          <text x="866" y="116" fill="${bottomThemeColor}" font-size="68" font-weight="900" text-anchor="end" class="tabular">${bottomThemeSign}${bottomThemeRet.toFixed(2)}%</text>
        </g>
      </g>

      <!-- SECTION 3: 스마트머니 순유입 1위 (Y: 954, H: 240) [Enhanced Legibility] -->
      <g transform="translate(60, 954)" filter="url(#cardShadow)">
        <rect width="960" height="240" rx="28" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.6"/>
        
        <text x="35" y="46" fill="#0F172A" font-size="30" font-weight="900">3. 스마트머니(외인/기관) 실질 순유입 1위</text>
        <rect x="760" y="15" width="165" height="42" rx="12" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.4"/>
        <text x="842" y="43" fill="#1E293B" font-size="21" font-weight="900" text-anchor="middle">기관·외국인 합산</text>

        <!-- Enhanced Hero Card (H: 142) -->
        <g transform="translate(35, 72)">
          <rect width="890" height="142" rx="20" fill="#F0FDF4" stroke="#86EFAC" stroke-width="1.8"/>
          <circle cx="42" cy="42" r="22" fill="#10B981"/>
          <text x="42" y="50" fill="#FFFFFF" font-size="22" font-weight="900" text-anchor="middle">1</text>
          
          <text x="82" y="52" fill="#0F172A" font-size="${fitAndClampText(cleanTopInflow1Name, 450, 34, 26).fontSize}" font-weight="900">${escapeXml(fitAndClampText(cleanTopInflow1Name, 450, 34, 26).text)}</text>
          
          <rect x="42" y="86" width="105" height="36" rx="10" fill="#DCFCE7" stroke="#BBF7D0" stroke-width="1.2"/>
          <text x="94" y="111" fill="#15803D" font-size="21" font-weight="900" text-anchor="middle" class="tabular">${escapeXml(topInflow1.ticker)}</text>
          
          <rect x="158" y="86" width="150" height="36" rx="10" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.2"/>
          <text x="233" y="111" fill="#475569" font-size="21" font-weight="900" text-anchor="middle">${escapeXml(topInflow1.theme || "핵심ETF")}</text>

          <text x="866" y="78" fill="#047857" font-size="58" font-weight="900" text-anchor="end" class="tabular">+${topInflow1Val.toLocaleString()}<tspan font-size="30" font-weight="900">억원</tspan></text>
          <text x="866" y="112" fill="#15803D" font-size="22" font-weight="900" text-anchor="end">당일 기관·외인 최대 순유입</text>
        </g>
      </g>

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
    </svg>
  `.trim();
}
