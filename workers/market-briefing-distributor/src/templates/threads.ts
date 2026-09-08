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

  const topicTag = selectThreadsTopicTag();

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

${topicTag}
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

${topicTag}
${sourceNotice}`;
  }

  // Final hard ceiling safeguard: strictly bound within 480 chars
  if (mainPost.length > 480) {
    const footer = `\n\n${topicTag}\n${sourceNotice}`;
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
  if (len > 15) return 20.0;
  if (len > 11) return 22.5;
  return 25.0;
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

      <!-- Clean Header -->
      <g transform="translate(60, 52)">
        <text x="0" y="34" fill="#0F172A" font-size="34" font-weight="900">ETF 모닝 브리핑</text>
        <text x="0" y="64" fill="#475569" font-size="16.5" font-weight="700">KRX 일반 ETF ${generalCount.toLocaleString()}개 전수 분석 요약</text>
        
        <rect x="735" y="10" width="225" height="46" rx="14" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5" filter="url(#cardShadow)"/>
        <text x="847" y="39" fill="#0F172A" font-size="17.5" font-weight="900" text-anchor="middle" class="tabular">${formattedDate}</text>
      </g>

      <!-- SECTION 1: 시장 체온 & 3대 지수 비교 (Y: 140, H: 195) -->
      <g transform="translate(60, 140)" filter="url(#cardShadow)">
        <rect width="960" height="195" rx="24" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.6"/>
        
        <text x="35" y="44" fill="#0F172A" font-size="24" font-weight="900">1. 시장 체온 &amp; 3대 지수 비교</text>
        <rect x="620" y="16" width="305" height="40" rx="12" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.2"/>
        <text x="772" y="41" font-size="18" font-weight="900" text-anchor="middle">
          <tspan fill="#D92D20">상승 ${up}</tspan><tspan fill="#94A3B8"> · </tspan><tspan fill="#64748B">보합 ${flat}</tspan><tspan fill="#94A3B8"> · </tspan><tspan fill="#175CD3">하락 ${down}</tspan>
        </text>

        <!-- 3 Big Metric Boxes -->
        <g transform="translate(35, 78)">
          <!-- KOSPI -->
          <rect x="0" y="0" width="285" height="92" rx="16" fill="${kospi >= 0 ? '#FEF2F2' : '#EFF6FF'}" stroke="${kospi >= 0 ? '#FECACA' : '#BFDBFE'}" stroke-width="1.3"/>
          <text x="24" y="55" fill="${kospi >= 0 ? '#991B1B' : '#1E40AF'}" font-size="20" font-weight="900">KOSPI</text>
          <text x="261" y="57" fill="${kospiColor}" font-size="36" font-weight="900" text-anchor="end" class="tabular">${kospiSign}${kospi.toFixed(2)}%</text>

          <!-- KOSDAQ -->
          <rect x="302" y="0" width="285" height="92" rx="16" fill="${kosdaq >= 0 ? '#FEF2F2' : '#EFF6FF'}" stroke="${kosdaq >= 0 ? '#FECACA' : '#BFDBFE'}" stroke-width="1.3"/>
          <text x="326" y="55" fill="${kosdaq >= 0 ? '#991B1B' : '#1E40AF'}" font-size="20" font-weight="900">KOSDAQ</text>
          <text x="563" y="57" fill="${kosdaqColor}" font-size="36" font-weight="900" text-anchor="end" class="tabular">${kosdaqSign}${kosdaq.toFixed(2)}%</text>

          <!-- 일반 ETF -->
          <rect x="605" y="0" width="285" height="92" rx="16" fill="#F0FDF4" stroke="#BBF7D0" stroke-width="1.5"/>
          <text x="629" y="55" fill="#15803D" font-size="20" font-weight="900">일반 ETF</text>
          <text x="866" y="57" fill="${etfColor}" font-size="36" font-weight="900" text-anchor="end" class="tabular">${etfSign}${etfReturn.toFixed(2)}%</text>
        </g>
      </g>

      <!-- SECTION 2: 오늘의 극과 극 테마 (Y: 360, H: 195) -->
      <g transform="translate(60, 360)" filter="url(#cardShadow)">
        <rect width="960" height="195" rx="24" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.6"/>
        
        <text x="35" y="44" fill="#0F172A" font-size="24" font-weight="900">2. 오늘의 극과 극 테마</text>
        <rect x="725" y="16" width="200" height="40" rx="12" fill="#FFF7ED" stroke="#FED7AA" stroke-width="1.2"/>
        <text x="825" y="41" fill="#C2410C" font-size="16" font-weight="900" text-anchor="middle">테마 온도차 ${themeGap}%p</text>

        <!-- 2 Big Theme Cards -->
        <g transform="translate(35, 74)">
          <!-- Top 1 Winner (▲ 상위 1위) -->
          <rect x="0" y="0" width="435" height="96" rx="16" fill="#FEF2F2" stroke="#FCA5A5" stroke-width="1.3"/>
          <text x="22" y="34" fill="#B91C1C" font-size="15.5" font-weight="900">▲ 상위 1위</text>
          <text x="22" y="70" fill="#0F172A" font-size="${topThemeFontSize}" font-weight="900">${escapeXml(cleanTopTheme)}</text>
          <text x="415" y="65" fill="${topThemeColor}" font-size="36" font-weight="900" text-anchor="end" class="tabular">${topThemeSign}${topThemeRet.toFixed(2)}%</text>

          <!-- Top 1 Loser (▼ 하위 1위) -->
          <rect x="455" y="0" width="435" height="96" rx="16" fill="#EFF6FF" stroke="#93C5FD" stroke-width="1.3"/>
          <text x="477" y="34" fill="#1D4ED8" font-size="15.5" font-weight="900">▼ 하위 1위</text>
          <text x="477" y="70" fill="#0F172A" font-size="${bottomThemeFontSize}" font-weight="900">${escapeXml(cleanBottomTheme)}</text>
          <text x="870" y="65" fill="${bottomThemeColor}" font-size="36" font-weight="900" text-anchor="end" class="tabular">${bottomThemeSign}${bottomThemeRet.toFixed(2)}%</text>
        </g>
      </g>

      <!-- SECTION 3: 스마트머니 실질 순유입 TOP 2 (Y: 580, H: 260) -->
      <g transform="translate(60, 580)" filter="url(#cardShadow)">
        <rect width="960" height="260" rx="24" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.6"/>
        
        <text x="35" y="44" fill="#0F172A" font-size="24" font-weight="900">3. 스마트머니 실질 자금 순유입 TOP 2</text>
        <rect x="780" y="16" width="145" height="40" rx="12" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
        <text x="852" y="41" fill="#1E293B" font-size="15.5" font-weight="900" text-anchor="middle">기관·외국인 합산</text>

        <!-- Row 1: Top 1 Inflow Hero -->
        <g transform="translate(35, 74)">
          <rect width="890" height="74" rx="16" fill="#F0FDF4" stroke="#86EFAC" stroke-width="1.5"/>
          <circle cx="36" cy="37" r="18" fill="#10B981"/>
          <text x="36" y="44" fill="#FFFFFF" font-size="16" font-weight="900" text-anchor="middle">1</text>
          <text x="70" y="45" fill="#0F172A" font-size="24" font-weight="900">
            ${escapeXml(cleanTopInflow1Name)} <tspan fill="#64748B" font-size="16" font-weight="700">· ${escapeXml(topInflow1.ticker)}</tspan>
          </text>
          <text x="866" y="47" fill="#047857" font-size="36" font-weight="900" text-anchor="end" class="tabular">+${(topInflow1.inflow || 0).toLocaleString()}억원</text>
        </g>

        <!-- Row 2: Top 2 Inflow -->
        ${topInflow2 ? `
          <g transform="translate(35, 158)">
            <rect width="890" height="60" rx="14" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.2"/>
            <circle cx="36" cy="30" r="15" fill="#E2E8F0"/>
            <text x="36" y="36" fill="#475569" font-size="14" font-weight="900" text-anchor="middle">2</text>
            <text x="70" y="37" fill="#0F172A" font-size="21" font-weight="900">
              ${escapeXml(cleanTopInflow2Name)} <tspan fill="#64748B" font-size="15" font-weight="700">· ${escapeXml(topInflow2.ticker)}</tspan>
            </text>
            <text x="866" y="39" fill="#047857" font-size="28" font-weight="900" text-anchor="end" class="tabular">+${(topInflow2.inflow || 0).toLocaleString()}억원</text>
          </g>
        ` : ''}

        <text x="35" y="238" fill="#64748B" font-size="16" font-weight="700">
          상위 5종목 총 ${top5InflowSum.toLocaleString()}억원 실질 자금 순유입 집중
        </text>
      </g>

      <!-- SECTION 4: 오늘의 핵심 마켓 체크포인트 (Y: 865, H: 140) -->
      <g transform="translate(60, 865)" filter="url(#cardShadow)">
        <rect width="960" height="140" rx="22" fill="${hasDisparity ? '#FFFBEB' : '#F0FDF4'}" stroke="${hasDisparity ? '#FDE68A' : '#BBF7D0'}" stroke-width="1.6"/>
        
        <rect x="35" y="22" width="135" height="34" rx="10" fill="${hasDisparity ? '#FEF3C7' : '#DCFCE7'}" stroke="${hasDisparity ? '#FCD34D' : '#86EFAC'}" stroke-width="1.2"/>
        <text x="102" y="45" fill="${hasDisparity ? '#B45309' : '#15803D'}" font-size="16" font-weight="900" text-anchor="middle">
          ${hasDisparity ? '괴리율 점검' : '핵심 포인트'}
        </text>

        <text x="185" y="47" fill="#0F172A" font-size="23" font-weight="900">
          ${hasDisparity 
            ? `NAV 대비 가격 왜곡 주의 종목 점검 · ${escapeXml(cleanDisparityName)} ${(topDisparity?.disparityPct ?? 0).toFixed(2)}%`
            : `'${escapeXml(cleanTopTheme)}' 주도 속 스마트머니 '${escapeXml(cleanTopInflow1Name)}' 집중`
          }
        </text>

        <text x="35" y="98" fill="#334155" font-size="19" font-weight="700">
          ${hasDisparity
            ? '장 초반 무리한 시장가 매매를 지양하고, 실시간 순자산가치 iNAV 수렴 여부를 확인하세요.'
            : (regime.threadsWatchPoint || '단기 급등 테마 추격보다 자금 순유입 지속성과 방어적 자산 완충력을 확인하세요.')
          }
        </text>
      </g>

      <!-- Bottom Banner & Official Data Notice (Y: 1030, H: 76) -->
      <g transform="translate(60, 1030)" filter="url(#cardShadow)">
        <rect width="960" height="76" rx="18" fill="url(#brandGrad)"/>
        <text x="480" y="47" fill="#FFFFFF" font-size="22" font-weight="900" text-anchor="middle" letter-spacing="-0.3">
          한국거래소 KRX 전 거래일 마감 공시 데이터 전수 분석
        </text>
      </g>

      <!-- Watermark & Disclaimer (Y: 1140 ~ 1210) -->
      <g transform="translate(540, 1145)">
        <text x="0" y="0" fill="#64748B" font-size="15" font-weight="600" text-anchor="middle">* 본 자료는 순수 정보 제공용 시황 칼럼이며, 특정 종목의 매수·매도를 권유하지 않습니다.</text>
        <rect x="-200" y="18" width="400" height="40" rx="12" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
        <text x="0" y="44" fill="#1E293B" font-size="17" font-weight="900" text-anchor="middle" letter-spacing="0.5">ETF 캠퍼스 마켓 브리핑</text>
      </g>
    </svg>
  `;
}
