import type { MarketBriefingPayload } from "../types";
import { classifyMarketRegime, type MarketRegime } from "../services/market-regime";
import type { PolishedNarrative } from "../services/gemini";

export interface ThreadsPost {
  sequence: number;
  content: string;
}

function formatDateWithDay(dateStr?: string): string {
  if (!dateStr) return "2026.09.04 (금)";
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const dayName = days[date.getDay()] || "금";
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

  const topicTag = selectThreadsTopicTag(payload);

  let watchPointText = regime.threadsWatchPoint || "반등장일수록 테마의 거래대금과 자금 순유입 지속성을 분별하는 태도가 중요합니다. 오늘 주목하는 섹터는 어디인가요?";
  const sourceNotice = `* KRX 공시 마감 국내 일반 ETF ${generalCount.toLocaleString()}개 전수 분석 (투자 권유 아님)`;

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
  if (len > 18) return 18.0;
  if (len > 14) return 20.0;
  if (len > 10) return 22.0;
  return 24.0;
}

function calcInflowFontSize(name?: string, isFirst?: boolean): number {
  const len = name ? name.length : 0;
  if (isFirst) {
    if (len > 22) return 20.0;
    if (len > 16) return 22.0;
    return 24.0;
  }
  if (len > 22) return 16.5;
  if (len > 16) return 18.0;
  return 19.5;
}

function calcDisparityFontSize(name?: string): number {
  const len = name ? name.length : 0;
  if (len > 17) return 17.5;
  if (len > 13) return 19.5;
  return 21.5;
}

export function generateThreadsImageSvg(payload: MarketBriefingPayload): string {
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
  const topThemeColor = topThemeRet >= 0 ? "#DC2626" : "#2563EB";
  const bottomThemeColor = bottomThemeRet >= 0 ? "#DC2626" : "#2563EB";

  // Inflows
  const topInflows = (payload.periodicFlows?.dailyFundFlows?.topInflows || []).slice(0, 3);

  // Disparity
  const disparityList = (payload.disparityWarning || []).slice(0, 2);
  const discounts = disparityList.filter(d => d.disparityPct < 0);
  const premiums = disparityList.filter(d => d.disparityPct > 0);

  let disparitySectionTitle = "4. 괴리율 저평가(할인) 체크 종목";
  let disparityTagText = "NAV 대비 할인";
  let disparityBoxBg = "#F0FDF4";
  let disparityStroke = "#BBF7D0";
  let disparityTitleColor = "#15803D";
  let disparityPillBg = "#DCFCE7";
  let disparityPillStroke = "#86EFAC";
  let disparityPillText = "#15803D";

  if (disparityList.length === 0) {
    disparitySectionTitle = "4. 전 종목 괴리율 정상 (시장 안정 구간)";
    disparityTagText = "괴리율 정상";
    disparityBoxBg = "#F8FAFC";
    disparityStroke = "#E2E8F0";
    disparityTitleColor = "#334155";
    disparityPillBg = "#F1F5F9";
    disparityPillStroke = "#CBD5E1";
    disparityPillText = "#475569";
  } else if (premiums.length > 0 && discounts.length === 0) {
    disparitySectionTitle = "4. 괴리율 고평가(할증) 주의 종목";
    disparityTagText = "NAV 대비 할증";
    disparityBoxBg = "#FFF1F2";
    disparityStroke = "#FECDD3";
    disparityTitleColor = "#BE123C";
    disparityPillBg = "#FFE4E6";
    disparityPillStroke = "#FDA4AF";
    disparityPillText = "#BE123C";
  } else if (discounts.length > 0 && premiums.length === 0) {
    disparitySectionTitle = "4. 괴리율 저평가(할인) 체크 종목";
    disparityTagText = "NAV 대비 할인";
    disparityBoxBg = "#F0FDF4";
    disparityStroke = "#BBF7D0";
    disparityTitleColor = "#15803D";
    disparityPillBg = "#DCFCE7";
    disparityPillStroke = "#86EFAC";
    disparityPillText = "#15803D";
  } else if (premiums.length > 0 && discounts.length > 0) {
    disparitySectionTitle = "4. 괴리율 가격 왜곡 주의 종목";
    disparityTagText = "할증/할인 왜곡";
    disparityBoxBg = "#FFF7ED";
    disparityStroke = "#FED7AA";
    disparityTitleColor = "#C2410C";
    disparityPillBg = "#FFEDD5";
    disparityPillStroke = "#FDBA74";
    disparityPillText = "#9A3412";
  }

  const inflowItemsSvg = topInflows.length > 0 ? topInflows.map((item, idx) => {
    const isFirst = idx === 0;
    const fs = calcInflowFontSize(item.name, isFirst);
    const yOffset = isFirst ? 0 : (idx === 1 ? 72 : 128);
    const boxHeight = isFirst ? 62 : 48;
    const boxBg = isFirst ? "#F0FDF4" : "#F8FAFC";
    const boxStroke = isFirst ? "#86EFAC" : "#E2E8F0";
    const badgeColor = isFirst ? "#10B981" : "#E2E8F0";
    const badgeText = isFirst ? "#FFFFFF" : "#475569";
    const amountFs = isFirst ? 30 : 22;
    const circleY = isFirst ? 31 : 24;
    const textY = isFirst ? 38 : 31;

    return `
      <g transform="translate(0, ${yOffset})">
        <rect width="890" height="${boxHeight}" rx="13" fill="${boxBg}" stroke="${boxStroke}" stroke-width="${isFirst ? 1.5 : 1.2}"/>
        <circle cx="32" cy="${circleY}" r="${isFirst ? 15 : 13}" fill="${badgeColor}"/>
        <text x="32" y="${circleY + 5}" fill="${badgeText}" font-size="${isFirst ? 14 : 12.5}" font-weight="900" text-anchor="middle">${idx + 1}</text>
        <text x="64" y="${textY}" fill="#0F172A" font-size="${fs}" font-weight="900">
          ${escapeXml(item.name)} <tspan fill="#64748B" font-size="${isFirst ? 15 : 13}" font-weight="700">(${escapeXml(item.ticker)})</tspan>
        </text>
        <text x="866" y="${textY}" fill="#047857" font-size="${amountFs}" font-weight="900" text-anchor="end" class="tabular">+${(item.inflow || 0).toLocaleString()}억원</text>
      </g>
    `;
  }).join("") : `<text x="0" y="28" fill="#64748B" font-size="16" font-weight="600">특이동향 없음</text>`;

  const disparityItemsSvg = disparityList.length > 0 ? disparityList.map((d: any, idx: number) => {
    const fs = calcDisparityFontSize(d.etfName);
    const dispSign = d.disparityPct > 0 ? "+" : "";
    return `
      <g transform="translate(${idx * 455}, 0)">
        <rect width="435" height="74" rx="14" fill="#FFFFFF" stroke="${disparityPillStroke}" stroke-width="1.3"/>
        <text x="20" y="32" fill="#0F172A" font-size="${fs}" font-weight="900">${escapeXml(d.etfName)}</text>
        <text x="20" y="55" fill="#64748B" font-size="13.5" font-weight="700">${escapeXml(d.ticker)} · ${escapeXml(d.assetClass || "해외주식")}</text>
        <text x="415" y="47" fill="${disparityTitleColor}" font-size="28" font-weight="900" text-anchor="end" class="tabular">${dispSign}${(d.disparityPct ?? 0).toFixed(2)}%</text>
      </g>
    `;
  }).join("") : `<text x="0" y="28" fill="#64748B" font-size="16" font-weight="600">특이 왜곡 종목 없음 (정상 거래 중)</text>`;

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

      <!-- Clean Minimal Header (Perfect Baseline Alignment) -->
      <g transform="translate(60, 52)">
        <text x="0" y="34" fill="#0F172A" font-size="34" font-weight="900">ETF 모닝 브리핑</text>
        <text x="0" y="64" fill="#475569" font-size="16.5" font-weight="700">KRX 일반 ETF ${generalCount}개 전수 분석 요약</text>
        
        <rect x="735" y="10" width="225" height="46" rx="14" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5" filter="url(#cardShadow)"/>
        <text x="847" y="39" fill="#0F172A" font-size="17.5" font-weight="900" text-anchor="middle" class="tabular">${formattedDate}</text>
      </g>

      <!-- SECTION 1: 시장 체온 & 벤치마크 (Y: 138, H: 182) -->
      <g transform="translate(60, 138)" filter="url(#cardShadow)">
        <rect width="960" height="182" rx="22" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
        
        <text x="35" y="42" fill="#0F172A" font-size="23" font-weight="900">1. 시장 체온 &amp; 벤치마크 대비 성과</text>
        <rect x="630" y="14" width="295" height="40" rx="12" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.2"/>
        <text x="777" y="39" font-size="17" font-weight="900" text-anchor="middle">
          <tspan fill="#D92D20">상승 ${up}</tspan><tspan fill="#94A3B8"> · </tspan><tspan fill="#64748B">보합 ${flat}</tspan><tspan fill="#94A3B8"> · </tspan><tspan fill="#175CD3">하락 ${down}</tspan>
        </text>

        <!-- 3 Big Metric Boxes with Dynamic Status Tints -->
        <g transform="translate(35, 74)">
          <!-- KOSPI -->
          <rect x="0" y="0" width="275" height="80" rx="14" fill="${kospi >= 0 ? '#FEF2F2' : '#EFF6FF'}" stroke="${kospi >= 0 ? '#FECACA' : '#BFDBFE'}" stroke-width="1.2"/>
          <text x="24" y="49" fill="${kospi >= 0 ? '#991B1B' : '#1E40AF'}" font-size="19" font-weight="800">KOSPI</text>
          <text x="252" y="51" fill="${kospiColor}" font-size="32" font-weight="900" text-anchor="end" class="tabular">${kospiSign}${kospi.toFixed(2)}%</text>

          <!-- KOSDAQ -->
          <rect x="307" y="0" width="275" height="80" rx="14" fill="${kosdaq >= 0 ? '#FEF2F2' : '#EFF6FF'}" stroke="${kosdaq >= 0 ? '#FECACA' : '#BFDBFE'}" stroke-width="1.2"/>
          <text x="331" y="49" fill="${kosdaq >= 0 ? '#991B1B' : '#1E40AF'}" font-size="19" font-weight="800">KOSDAQ</text>
          <text x="559" y="51" fill="${kosdaqColor}" font-size="32" font-weight="900" text-anchor="end" class="tabular">${kosdaqSign}${kosdaq.toFixed(2)}%</text>

          <!-- 일반 ETF -->
          <rect x="615" y="0" width="275" height="80" rx="14" fill="#F0FDF4" stroke="#BBF7D0" stroke-width="1.5"/>
          <text x="639" y="49" fill="#15803D" font-size="19" font-weight="900">일반 ETF</text>
          <text x="867" y="51" fill="${etfColor}" font-size="32" font-weight="900" text-anchor="end" class="tabular">${etfSign}${etfReturn.toFixed(2)}%</text>
        </g>
      </g>

      <!-- SECTION 2: 주도 테마 vs 부진 테마 (Y: 338, H: 175) -->
      <g transform="translate(60, 338)" filter="url(#cardShadow)">
        <rect width="960" height="175" rx="22" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
        
        <text x="35" y="40" fill="#0F172A" font-size="23" font-weight="900">2. 극과 극 테마 (주도 vs 부진)</text>
        <rect x="735" y="14" width="190" height="38" rx="10" fill="#FFF7ED" stroke="#FED7AA" stroke-width="1.2"/>
        <text x="830" y="39" fill="#C2410C" font-size="15.5" font-weight="900" text-anchor="middle">테마 온도차 ${themeGap}%p</text>

        <!-- 1x2 Big Hero Cards (▲ 상위 1위 vs ▼ 하위 1위 대형화) -->
        <g transform="translate(35, 62)">
          <!-- Top 1 Winner (▲ 상위 1위) -->
          <rect x="0" y="0" width="435" height="92" rx="14" fill="#FEF2F2" stroke="#FCA5A5" stroke-width="1.2"/>
          <text x="20" y="32" fill="#B91C1C" font-size="15" font-weight="900">▲ 상위 1위</text>
          <text x="20" y="66" fill="#0F172A" font-size="${topThemeFontSize}" font-weight="900">${escapeXml(cleanTopTheme)}</text>
          <text x="415" y="62" fill="${topThemeColor}" font-size="36" font-weight="900" text-anchor="end" class="tabular">${topThemeSign}${topThemeRet.toFixed(2)}%</text>

          <!-- Top 1 Loser (▼ 하위 1위) -->
          <rect x="455" y="0" width="435" height="92" rx="14" fill="#EFF6FF" stroke="#93C5FD" stroke-width="1.2"/>
          <text x="475" y="32" fill="#1D4ED8" font-size="15" font-weight="900">▼ 하위 1위</text>
          <text x="475" y="66" fill="#0F172A" font-size="${bottomThemeFontSize}" font-weight="900">${escapeXml(cleanBottomTheme)}</text>
          <text x="870" y="62" fill="${bottomThemeColor}" font-size="36" font-weight="900" text-anchor="end" class="tabular">${bottomThemeSign}${bottomThemeRet.toFixed(2)}%</text>
        </g>
      </g>

      <!-- SECTION 3: 스마트머니 순유입 TOP 3 (Y: 531, H: 270) -->
      <g transform="translate(60, 531)" filter="url(#cardShadow)">
        <rect width="960" height="270" rx="22" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
        
        <text x="35" y="42" fill="#0F172A" font-size="23" font-weight="900">3. 스마트머니(외인/기관) 실질 순유입 TOP 3</text>
        <rect x="785" y="15" width="140" height="38" rx="10" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
        <text x="855" y="40" fill="#1E293B" font-size="15" font-weight="800" text-anchor="middle">기관·외국인 합산</text>

        <!-- 3 Inflow Rows (1위 대형화 + 2/3위 깔끔 배치) -->
        <g transform="translate(35, 68)">
          ${inflowItemsSvg}
        </g>
      </g>

      <!-- SECTION 4: 괴리율 왜곡 경보 (Y: 819, H: 175) -->
      <g transform="translate(60, 819)" filter="url(#cardShadow)">
        <rect width="960" height="175" rx="22" fill="${disparityBoxBg}" stroke="${disparityStroke}" stroke-width="1.5"/>
        
        <text x="35" y="42" fill="${disparityTitleColor}" font-size="23" font-weight="900">${disparitySectionTitle}</text>
        <rect x="740" y="15" width="185" height="38" rx="10" fill="${disparityPillBg}" stroke="${disparityPillStroke}" stroke-width="1.2"/>
        <text x="832" y="40" fill="${disparityPillText}" font-size="15" font-weight="900" text-anchor="middle">${disparityTagText}</text>

        <!-- 2 Disparity Cards (Full Name + Ticker Subtitle & Dynamic Sizing) -->
        <g transform="translate(35, 68)">
          ${disparityItemsSvg}
        </g>
      </g>

      <!-- Bottom Banner & Official Data Notice (Y: 1014, H: 76) -->
      <g transform="translate(60, 1014)" filter="url(#cardShadow)">
        <rect width="960" height="76" rx="18" fill="url(#brandGrad)"/>
        <text x="480" y="47" fill="#FFFFFF" font-size="21" font-weight="900" text-anchor="middle" letter-spacing="-0.3">
          한국거래소(KRX) 전 거래일 마감 공시 데이터 전수 분석
        </text>
      </g>

      <!-- Watermark & Disclaimer (Y: 1120 ~ 1200) -->
      <g transform="translate(540, 1135)">
        <text x="0" y="0" fill="#64748B" font-size="15" font-weight="600" text-anchor="middle">* 본 자료는 순수 정보 제공용 시황 칼럼이며, 특정 종목의 매수·매도를 권유하지 않습니다.</text>
        <rect x="-200" y="18" width="400" height="40" rx="12" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
        <text x="0" y="44" fill="#1E293B" font-size="17" font-weight="900" text-anchor="middle" letter-spacing="0.5">ETF 캠퍼스 마켓 브리핑</text>
      </g>
    </svg>
  `;
}
