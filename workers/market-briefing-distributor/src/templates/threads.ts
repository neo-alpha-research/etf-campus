import type { MarketBriefingPayload } from "../types";
import { classifyMarketRegime, type MarketRegime } from "../services/market-regime";
import type { PolishedNarrative } from "../services/gemini";

export interface ThreadsPost {
  sequence: number;
  content: string;
}

function formatDateWithDay(dateStr?: string): string {
  if (!dateStr) return "2026.09.04 · 금요일";
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const days = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
  const dayName = days[date.getDay()] || "금요일";
  return `${dateStr.replace(/-/g, ".")} · ${dayName}`;
}

export function selectThreadsTopicTag(): string {
  // Threads 상단 헤더에 이미 토픽/커뮤니티(etf)가 노출되므로 본문 하단 단독 'ETF' 줄은 중복 제거
  return "";
}

export function generateThreadsThread(
  payload: MarketBriefingPayload,
  baseUrl: string,
  narrative?: PolishedNarrative | MarketRegime
): ThreadsPost[] {
  const regime = narrative || classifyMarketRegime(payload);
  const generalCount = payload.generalEtfCount ?? 1025;

  const cleanThemeName = (name: string): string => {
    return name
      .replace(/\s*\([^)]*\)/g, "")
      .replace(/피지컬\s*AI\s*&\s*지능형\s*로봇/g, "피지컬 AI & 로봇")
      .replace(/전통\s*반도체\s*소부장/g, "반도체 소부장")
      .replace(/K-푸드\s*&\s*K-뷰티/g, "K-푸드 & 뷰티")
      .replace(/글로벌\s*럭셔리\s*&\s*소비재/g, "글로벌 럭셔리")
      .trim();
  };

  const cleanEtfName = (rawName: string): string => {
    return rawName
      .replace(/\s*\([^)]*\)/g, "")
      .replace(/플러스/g, "")
      .trim();
  };

  const topInflows = payload.periodicFlows?.dailyFundFlows?.topInflows?.slice(0, 2) || [];
  const inflowSentence = topInflows.length > 0 
    ? `\n\n스마트머니는 ${topInflows.map(i => {
        const item = i as any;
        const name = cleanEtfName(item.name || item.etfName || "대표지수");
        const val = item.inflow ?? (item.netInflowValue ? Math.round(item.netInflowValue / 100000000) : 0);
        return `${name} +${(val || 0).toLocaleString()}억`;
      }).join(', ')} 순으로 유입됐습니다.` 
    : "";

  const sortedPeerGroups = [...(payload.peerGroups || [])].sort((a, b) => (b.cappedAumWeightedReturnPct ?? 0) - (a.cappedAumWeightedReturnPct ?? 0));
  const strongThemes = sortedPeerGroups.slice(0, 2);
  const weakThemes = [...sortedPeerGroups].reverse().slice(0, 2);
  
  const strongText = strongThemes.length > 0 
    ? strongThemes.map(t => `${cleanThemeName(t.peerGroup)} ${t.cappedAumWeightedReturnPct > 0 ? '+' : ''}${t.cappedAumWeightedReturnPct.toFixed(2)}%`).join(', ') 
    : "상위 테마 안정";

  const weakText = weakThemes.length > 0 
    ? weakThemes.map(t => `${cleanThemeName(t.peerGroup)} ${t.cappedAumWeightedReturnPct > 0 ? '+' : ''}${t.cappedAumWeightedReturnPct.toFixed(2)}%`).join(', ') 
    : "하위 테마 조정";

  let watchPointText = regime.threadsWatchPoint || "반등장일수록 테마의 거래대금과 자금 순유입 지속성을 분별하는 태도가 중요합니다. 오늘 주목하는 섹터는 어디인가요?";
  const sourceNotice = `* KRX 공시 마감 국내 일반 ETF ${generalCount.toLocaleString()}개 전수 분석 · 투자 참고용`;

  const formattedDate = formatDateWithDay(payload.asOfDate);
  const opening = (regime.threadsOpening || "").replace(/어제\s*/g, "").trim();
  let summary = (regime.threadsMarketSummary || "").replace(/어제\s*/g, "").trim();

  // Build draft post with explicit date header (Instagram caption alignment)
  let mainPost = `${formattedDate} ETF 마켓 동향

${opening}

${summary}

테마별로는 ${strongText}이 견조했던 반면, ${weakText}은 조정을 받았습니다.${inflowSentence}

${watchPointText}

${sourceNotice}`;

  // Enforce strict character safety guard (Meta Threads API hard limit: 500 chars, safe target <= 460 chars)
  const MAX_SAFE_CHARS = 460;
  if (mainPost.length > MAX_SAFE_CHARS) {
    // 1. If summary has secondary decorative sentences, keep the core sentence
    if (summary.includes(". ")) {
      summary = summary.split(". ")[0].trim() + ".";
    }
    // 2. Shorten watchPointText if it exceeds 60 chars
    if (watchPointText.length > 60) {
      const matchQuestion = watchPointText.match(/오늘[^?]+\?/);
      watchPointText = matchQuestion 
        ? `주도 테마의 수급 지속성을 점검할 때입니다. ${matchQuestion[0]}` 
        : "주도 테마의 수급 지속성을 점검할 때입니다. 오늘 주목하는 섹터는 어디인가요?";
    }
    mainPost = `${formattedDate} ETF 마켓 동향

${opening}

${summary}

테마별로는 ${strongText}이 견조했던 반면, ${weakText}은 조정을 받았습니다.${inflowSentence}

${watchPointText}

${sourceNotice}`;
  }

  // Final hard ceiling safeguard: strictly bound within 480 chars
  if (mainPost.length > 480) {
    const footer = `\n\n${sourceNotice}`;
    const budget = 480 - footer.length;
    mainPost = mainPost.slice(0, budget).trim() + "..." + footer;
  }

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

function calcThemeFontSize(themeName?: string): number {
  const len = themeName ? themeName.length : 0;
  if (len > 15) return 22.0;
  if (len > 11) return 24.5;
  return 27.0;
}

export function generateThreadsImageSvg(
  payload: MarketBriefingPayload,
  narrative?: PolishedNarrative | MarketRegime
): string {
  const regime = narrative || classifyMarketRegime(payload);
  const dateStr = payload.asOfDate || "2026-09-04";
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
  const topThemeFontSize = calcThemeFontSize(cleanTopTheme);
  const bottomThemeFontSize = calcThemeFontSize(cleanBottomTheme);

  const topThemeRet = topTheme.cappedAumWeightedReturnPct ?? 0;
  const bottomThemeRet = bottomTheme.cappedAumWeightedReturnPct ?? 0;
  const topThemeSign = topThemeRet > 0 ? "▲ +" : topThemeRet < 0 ? "▼ " : "";
  const bottomThemeSign = bottomThemeRet > 0 ? "▲ +" : bottomThemeRet < 0 ? "▼ " : "";
  const topThemeColor = topThemeRet >= 0 ? "#D92D20" : "#175CD3";
  const bottomThemeColor = bottomThemeRet >= 0 ? "#D92D20" : "#175CD3";

  // Inflows: Focus on Top 2 with clear contrast
  const allInflows = payload.periodicFlows?.dailyFundFlows?.topInflows || [];
  const topInflow1 = allInflows[0] || { name: "데이터 수집 중", ticker: "-", inflow: 0 };
  const topInflow2 = allInflows[1];
  const cleanTopInflow1Name = (topInflow1.name || "데이터 수집 중").replace(/\s*\([^)]*\)/g, '').trim();
  const cleanTopInflow2Name = topInflow2 ? (topInflow2.name || "").replace(/\s*\([^)]*\)/g, '').trim() : "";
  const top5InflowSum = allInflows.slice(0, 5).reduce((acc, curr) => acc + (curr.inflow || 0), 0);

  // Disparity
  const disparityList = payload.disparityWarning || [];
  const hasDisparity = disparityList.length > 0;
  const topDisparity = disparityList[0];
  const cleanDisparityName = topDisparity ? (topDisparity.etfName || "주요 종목").replace(/\s*\([^)]*\)/g, '').trim() : "주요 종목";

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
          @import url('https://fonts.googleapis.com/css2?family=Pretendard:wght@400;500;600;700;800;900&amp;display=swap');
          * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .tabular { font-variant-numeric: tabular-nums; letter-spacing: -0.5px; }
        </style>
      </defs>

      <!-- Background -->
      <rect width="1080" height="1350" fill="#F8FAFC"/>
      <circle cx="980" cy="120" r="280" fill="#10B981" fill-opacity="0.05"/>
      <circle cx="100" cy="1200" r="240" fill="#3B82F6" fill-opacity="0.04"/>

      <!-- Clean Minimal Header (Scaled Up) -->
      <g transform="translate(60, 46)">
        <rect x="0" y="0" width="230" height="32" rx="8" fill="#ECFDF5" stroke="#A7F3D0" stroke-width="1.2"/>
        <text x="115" y="21" fill="#047857" font-size="15" font-weight="900" letter-spacing="1" text-anchor="middle">ETF CAMPUS · BRIEFING</text>
        <text x="0" y="78" fill="#0F172A" font-size="52" font-weight="900" letter-spacing="-0.8">ETF 모닝 브리핑</text>
        <text x="0" y="116" fill="#475569" font-size="23" font-weight="700">KRX 일반 ETF ${generalCount.toLocaleString()}개 전수 분석 요약</text>
        
        <rect x="685" y="16" width="275" height="62" rx="18" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.8" filter="url(#cardShadow)"/>
        <text x="822" y="55" fill="#0F172A" font-size="24" font-weight="900" text-anchor="middle" class="tabular">${formattedDate}</text>
      </g>

      <!-- SECTION 1: 시장 체온 & 3대 지수 스코어보드 (Y: 168, H: 268) [Spacious & Bold] -->
      <g transform="translate(60, 168)" filter="url(#cardShadow)">
        <rect width="960" height="268" rx="28" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.6"/>
        
        <text x="35" y="52" fill="#0F172A" font-size="32" font-weight="900">1. 시장 체온 &amp; 3대 지수 스코어보드</text>
        <rect x="525" y="16" width="400" height="52" rx="15" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.4"/>
        <text x="725" y="48" font-size="21" font-weight="900" text-anchor="middle">
          <tspan fill="#D92D20">상승 ${up}</tspan><tspan fill="#94A3B8"> · </tspan><tspan fill="#64748B">보합 ${flat}</tspan><tspan fill="#94A3B8"> · </tspan><tspan fill="#175CD3">하락 ${down}</tspan>
        </text>

        <!-- 3 Big Metric Boxes (H: 150) -->
        <g transform="translate(35, 86)">
          <!-- KOSPI -->
          <rect x="0" y="0" width="280" height="150" rx="20" fill="${kospi >= 0 ? '#FEF2F2' : '#EFF6FF'}" stroke="${kospi >= 0 ? '#FECACA' : '#BFDBFE'}" stroke-width="1.5"/>
          <text x="24" y="52" fill="${kospi >= 0 ? '#991B1B' : '#1E40AF'}" font-size="30" font-weight="900">KOSPI</text>
          <text x="256" y="122" fill="${kospiColor}" font-size="56" font-weight="900" text-anchor="end" class="tabular">${kospiSign}${kospi.toFixed(2)}%</text>

          <!-- KOSDAQ -->
          <rect x="305" y="0" width="280" height="150" rx="20" fill="${kosdaq >= 0 ? '#FEF2F2' : '#EFF6FF'}" stroke="${kosdaq >= 0 ? '#FECACA' : '#BFDBFE'}" stroke-width="1.5"/>
          <text x="329" y="52" fill="${kosdaq >= 0 ? '#991B1B' : '#1E40AF'}" font-size="30" font-weight="900">KOSDAQ</text>
          <text x="561" y="122" fill="${kosdaqColor}" font-size="56" font-weight="900" text-anchor="end" class="tabular">${kosdaqSign}${kosdaq.toFixed(2)}%</text>

          <!-- 일반 ETF -->
          <rect x="610" y="0" width="280" height="150" rx="20" fill="#F0FDF4" stroke="#BBF7D0" stroke-width="1.6"/>
          <text x="634" y="52" fill="#15803D" font-size="30" font-weight="900">일반 ETF</text>
          <text x="866" y="122" fill="${etfColor}" font-size="56" font-weight="900" text-anchor="end" class="tabular">${etfSign}${etfReturn.toFixed(2)}%</text>
        </g>
      </g>

      <!-- SECTION 2: 오늘의 극과 극 테마 (Y: 466, H: 460) [Mega Bold & Ultra Spacious] -->
      <g transform="translate(60, 466)" filter="url(#cardShadow)">
        <rect width="960" height="460" rx="28" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.6"/>
        
        <text x="35" y="52" fill="#0F172A" font-size="32" font-weight="900">2. 오늘의 극과 극 테마 (주도 vs 부진)</text>
        <rect x="685" y="16" width="240" height="50" rx="14" fill="#FFF7ED" stroke="#FED7AA" stroke-width="1.4"/>
        <text x="805" y="48" fill="#C2410C" font-size="22" font-weight="900" text-anchor="middle">테마 온도차 ${themeGap}%p</text>

        <!-- Top 1 Winner (▲ 상위 1위 주도 테마, H: 160) -->
        <g transform="translate(35, 84)">
          <rect width="890" height="160" rx="22" fill="#FFF5F5" stroke="#FCA5A5" stroke-width="1.6"/>
          
          <!-- Row 1: Badge & ETF Count -->
          <rect x="24" y="22" width="135" height="40" rx="10" fill="#FEE2E2"/>
          <text x="91" y="48" fill="#DC2626" font-size="20" font-weight="900" text-anchor="middle">▲ 상위 1위</text>
          <text x="180" y="48" fill="#475569" font-size="21" font-weight="700">총 ${topTheme.etfCount || 5}개 ETF 구성</text>
          
          <!-- Row 2: Large Theme Name & Huge Return -->
          <text x="24" y="124" fill="#0F172A" font-size="${topThemeFontSize > 36 ? topThemeFontSize : 40}" font-weight="900">${escapeXml(cleanTopTheme)}</text>
          <text x="866" y="114" fill="${topThemeColor}" font-size="66" font-weight="900" text-anchor="end" class="tabular">${topThemeSign}${topThemeRet.toFixed(2)}%</text>
        </g>

        <!-- Bottom 1 Loser (▼ 하위 1위 부진 테마, H: 160) -->
        <g transform="translate(35, 268)">
          <rect width="890" height="160" rx="22" fill="#EFF6FF" stroke="#93C5FD" stroke-width="1.6"/>
          
          <!-- Row 1: Badge & ETF Count -->
          <rect x="24" y="22" width="135" height="40" rx="10" fill="#DBEAFE"/>
          <text x="91" y="48" fill="#1D4ED8" font-size="20" font-weight="900" text-anchor="middle">▼ 하위 1위</text>
          <text x="180" y="48" fill="#475569" font-size="21" font-weight="700">총 ${bottomTheme.etfCount || 8}개 ETF 구성</text>
          
          <!-- Row 2: Large Theme Name & Huge Return -->
          <text x="24" y="124" fill="#0F172A" font-size="${bottomThemeFontSize > 36 ? bottomThemeFontSize : 40}" font-weight="900">${escapeXml(cleanBottomTheme)}</text>
          <text x="866" y="114" fill="${bottomThemeColor}" font-size="66" font-weight="900" text-anchor="end" class="tabular">${bottomThemeSign}${bottomThemeRet.toFixed(2)}%</text>
        </g>
      </g>

      <!-- SECTION 3: 스마트머니 순유입 1위 (Y: 954, H: 240) [Enhanced Legibility] -->
      <g transform="translate(60, 954)" filter="url(#cardShadow)">
        <rect width="960" height="240" rx="28" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.6"/>
        
        <text x="35" y="46" fill="#0F172A" font-size="27" font-weight="900">3. 스마트머니(외인/기관) 실질 순유입 1위</text>
        <rect x="770" y="15" width="155" height="42" rx="12" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.3"/>
        <text x="847" y="42" fill="#1E293B" font-size="17.5" font-weight="800" text-anchor="middle">기관·외국인 합산</text>

        <!-- Enhanced Hero Card (H: 142) -->
        <g transform="translate(35, 72)">
          <rect width="890" height="142" rx="20" fill="#F0FDF4" stroke="#86EFAC" stroke-width="1.8"/>
          <circle cx="42" cy="42" r="20" fill="#10B981"/>
          <text x="42" y="49" fill="#FFFFFF" font-size="18" font-weight="900" text-anchor="middle">1</text>
          
          <text x="78" y="50" fill="#0F172A" font-size="30" font-weight="900">${escapeXml(cleanTopInflow1Name)}</text>
          
          <rect x="42" y="86" width="96" height="32" rx="8" fill="#DCFCE7" stroke="#BBF7D0" stroke-width="1"/>
          <text x="90" y="108" fill="#15803D" font-size="16.5" font-weight="800" text-anchor="middle" class="tabular">${escapeXml(topInflow1.ticker)}</text>
          
          <rect x="148" y="86" width="145" height="32" rx="8" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1"/>
          <text x="220.5" y="108" fill="#475569" font-size="16.5" font-weight="700" text-anchor="middle">핵심ETF</text>

          <text x="866" y="76" fill="#047857" font-size="54" font-weight="900" text-anchor="end" class="tabular">+${(topInflow1.inflow || 0).toLocaleString()}<tspan font-size="26" font-weight="700">억원</tspan></text>
          <text x="866" y="110" fill="#15803D" font-size="17" font-weight="800" text-anchor="end">당일 기관·외인 최대 순유입</text>
        </g>
      </g>

      <!-- Disclaimer & Watermark (Y: 1242 ~ 1312) [Brand Green Accent] -->
      <g transform="translate(540, 1242)">
        <text x="0" y="0" fill="#64748B" font-size="17" font-weight="600" text-anchor="middle">* 본 자료는 투자 판단을 돕기 위한 정보 제공용이며, 특정 종목의 매수·매도를 권유하지 않습니다.</text>
        <rect x="-230" y="20" width="460" height="50" rx="15" fill="#ECFDF5" stroke="#A7F3D0" stroke-width="1.4"/>
        <text x="0" y="52" fill="#047857" font-size="22" font-weight="900" text-anchor="middle" letter-spacing="0.5">ETF 캠퍼스 | https://etf-campus.pages.dev</text>
      </g>
    </svg>
  `;
}
