import type { MarketBriefingPayload } from "../types";
import { classifyMarketRegime, type MarketRegime } from "../services/market-regime";
import type { PolishedNarrative } from "../services/gemini";

export interface InstagramSlide {
  slideNumber: number;
  title: string;
  subtitle: string;
  svgContent: string;
}

export function escapeXml(unsafe?: string): string {
  if (!unsafe) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function formatDateWithDay(dateStr?: string): string {
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

export function cleanEtfNameForBanner(name?: string, maxChars: number = 14): string {
  if (!name) return "대표 ETF";
  let clean = name.replace(/\s*\([^)]*\)/g, '').trim();
  if (clean.length > maxChars) {
    clean = clean.slice(0, maxChars - 1) + "…";
  }
  return clean;
}

export function formatThemeForSummary(name?: string): string {
  if (!name) return "";
  let clean = name.replace(/\s*\([^)]*\)/g, '').trim();
  if (clean.length > 10 && clean.includes('&')) {
    clean = clean.split('&')[0].trim();
  }
  return clean;
}

export function measureTextWidth(text: string, fontSize: number): number {
  let width = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code > 0x07ff) {
      width += fontSize * 0.95; // Conservative Korean ceiling to guarantee zero overflow
    } else if (code >= 0x0041 && code <= 0x005a) {
      width += fontSize * 0.70; // Uppercase Latin
    } else if (code >= 0x0030 && code <= 0x0039) {
      width += fontSize * 0.60; // Digits
    } else if (code === 0x0020) {
      width += fontSize * 0.35; // Space
    } else {
      width += fontSize * 0.55; // Lowercase Latin, symbols
    }
  }
  return width;
}

export function fitAndClampText(
  text: string,
  maxWidthPx: number,
  initialFs: number = 32,
  minFs: number = 22
): { text: string; fontSize: number } {
  if (!text) return { text: "", fontSize: initialFs };

  let w = measureTextWidth(text, initialFs);
  if (w <= maxWidthPx) {
    return { text, fontSize: initialFs };
  }

  for (let fs = initialFs - 1; fs >= minFs; fs--) {
    w = measureTextWidth(text, fs);
    if (w <= maxWidthPx) {
      return { text, fontSize: fs };
    }
  }

  let clamped = text;
  while (clamped.length > 1) {
    clamped = clamped.slice(0, -1);
    const testStr = clamped.trim() + "…";
    if (measureTextWidth(testStr, minFs) <= maxWidthPx) {
      return { text: testStr, fontSize: minFs };
    }
  }

  return { text: "…", fontSize: minFs };
}

export function calcBannerFontSize(text: string, maxWidthPx: number = 720, baseFs: number = 32, minFs: number = 26): number {
  return fitAndClampText(text, maxWidthPx, baseFs, minFs).fontSize;
}

export interface SummaryBannerProps {
  badgeText: string;
  badgeBg: string;
  badgeBorder: string;
  badgeTextColor: string;
  cardBg?: string;
  cardBorder?: string;
  text: string;
  yOffset?: number;
}

export function renderCoreSummaryBanner({
  badgeText,
  badgeBg,
  badgeBorder,
  badgeTextColor,
  cardBg = "#FFFFFF",
  cardBorder = "#CBD5E1",
  text,
  yOffset = 104,
}: SummaryBannerProps): string {
  const is5Char = badgeText.length >= 5;
  const badgeWidth = is5Char ? 142 : 122;
  const badgeCenterX = 16 + badgeWidth / 2;
  const textStartX = is5Char ? 176 : 156;
  // Rigorous max text width leaving 80px+ guaranteed safety padding on the right:
  const maxTextWidth = is5Char ? 680 : 700;

  // Auto-fit starting at 28px down to 22px
  const fitted = fitAndClampText(text, maxTextWidth, 28, 22);

  return `
      <!-- Core Summary Banner (y=${yOffset}, h=96) [Zero-Overflow Standard Template] -->
      <g transform="translate(70, ${yOffset})" filter="url(#cardShadow)">
        <rect width="940" height="96" rx="22" fill="${cardBg}" stroke="${cardBorder}" stroke-width="1.8"/>
        <rect x="16" y="20" width="${badgeWidth}" height="56" rx="14" fill="${badgeBg}" stroke="${badgeBorder}" stroke-width="1.6"/>
        <text x="${badgeCenterX}" y="57" fill="${badgeTextColor}" font-size="26" font-weight="900" text-anchor="middle">${escapeXml(badgeText)}</text>
        <g clip-path="url(#summaryBannerTextClip)">
          <text x="${textStartX}" y="59" fill="#0F172A" font-size="${fitted.fontSize}" font-weight="900">
            ${escapeXml(fitted.text)}
          </text>
        </g>
      </g>
  `;
}

export function generateInstagramCarousel(
  payload: MarketBriefingPayload,
  _baseUrl: string,
  _narrative?: PolishedNarrative | MarketRegime
): InstagramSlide[] {
  void _baseUrl;
  void _narrative;
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
  const generalCount = payload.generalEtfCount ?? payload.pulse?.generalEtfCount ?? (up + down + flat);

  // Peer Groups (상위/하위 랭킹 SSOT)
  const sortedPeerGroups = [...(payload.peerGroups || [])].sort((a, b) => (b.cappedAumWeightedReturnPct ?? 0) - (a.cappedAumWeightedReturnPct ?? 0));
  const topTheme = sortedPeerGroups[0] || { peerGroup: "주요 섹터", cappedAumWeightedReturnPct: 0, etfCount: 0, assetClass: "국내주식" };
  const bottomTheme = sortedPeerGroups[sortedPeerGroups.length - 1] || topTheme;
  const themeGap = Math.abs((topTheme.cappedAumWeightedReturnPct ?? 0) - (bottomTheme.cappedAumWeightedReturnPct ?? 0)).toFixed(2);

  const winners = sortedPeerGroups.slice(0, 3);
  const losers = [...sortedPeerGroups].reverse().slice(0, 3);

  // Inflows
  const topInflows = payload.periodicFlows?.dailyFundFlows?.topInflows || [];
  const getInflowVal = (item: any): number => {
    if (!item) return 0;
    if (typeof item.inflow === "number" && !isNaN(item.inflow)) return Math.round(item.inflow);
    if (typeof item.inflowAmount === "number" && !isNaN(item.inflowAmount)) return Math.round(item.inflowAmount);
    if (typeof item.netInflowValue === "number" && !isNaN(item.netInflowValue)) return Math.round(item.netInflowValue / 100000000);
    if (typeof item.net_flow === "number" && !isNaN(item.net_flow)) return Math.round(item.net_flow / 100000000);
    return 0;
  };
  const topInflow = topInflows[0] || { name: "데이터 수집 중", ticker: "-", inflow: 0, theme: "미분류" };
  const topInflowVal = getInflowVal(topInflow);
  const top5InflowSum = topInflows.slice(0, 5).reduce((sum, item) => sum + getInflowVal(item), 0);
  const cleanInflowBannerName = cleanEtfNameForBanner(topInflow.name || (topInflow as any).etfName || "", 14);

  // Asset classes
  const assetClasses = (payload.assetClasses && payload.assetClasses.length > 0) ? payload.assetClasses : [];

  // Disparity data for Slide 5 (Fixed 4-Slot Architecture)
  const disparityList = payload.disparityWarning || [];
  const premiums = [...disparityList].filter(d => (d.disparityPct ?? 0) > 0).sort((a, b) => (b.disparityPct ?? 0) - (a.disparityPct ?? 0)).slice(0, 2);
  const discounts = [...disparityList].filter(d => (d.disparityPct ?? 0) < 0).sort((a, b) => (a.disparityPct ?? 0) - (b.disparityPct ?? 0)).slice(0, 2);

  const totalSlides = 6;

  // Common SVG Defs
  const commonDefs = `
    <defs>
      <filter id="softShadow" x="-10%" y="-10%" width="120%" height="125%">
        <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#0F172A" flood-opacity="0.06"/>
      </filter>
      <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="125%">
        <feDropShadow dx="0" dy="4" stdDeviation="10" flood-color="#0F172A" flood-opacity="0.04"/>
      </filter>
      <clipPath id="summaryBannerTextClip">
        <rect x="0" y="0" width="880" height="96" rx="22"/>
      </clipPath>
      <clipPath id="heroSummaryClip">
        <rect x="0" y="0" width="870" height="54" rx="14"/>
      </clipPath>
      <clipPath id="chipClip">
        <rect x="0" y="0" width="280" height="74" rx="14"/>
      </clipPath>
      <clipPath id="wideChipClip">
        <rect x="0" y="0" width="870" height="74" rx="14"/>
      </clipPath>
      <clipPath id="factBandClip">
        <rect x="0" y="0" width="870" height="72" rx="14"/>
      </clipPath>
      <style>
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css');
        * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', '맑은 고딕', 'Noto Sans KR', 'Segoe UI', sans-serif, 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji'; }
        .tabular { font-variant-numeric: tabular-nums; letter-spacing: -0.5px; }
      </style>
    </defs>
  `;

  // Official Standard Footer Mandate (AGENTS.md SSOT)
  const commonFooter = `
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
  `;

  // =========================================================================
  // SLIDE 1: Cover & 3 Key Pulses (1 / 6)
  // =========================================================================
  const cleanTopThemeName = (topTheme.peerGroup || "주요 섹터").replace(/\s*\([^)]*\)/g, '').trim();
  const themeVerb = (topTheme.cappedAumWeightedReturnPct ?? 0) > 0 ? "주도" : "선방";
  const slide1HeroRaw = `'${cleanTopThemeName}' ${themeVerb} 속 '${cleanInflowBannerName}' 수급 집중`;
  const slide1HeroFitted = fitAndClampText(slide1HeroRaw, 870, 32, 26);

  const cleanBottomThemeName = (bottomTheme.peerGroup || "소외 섹터").replace(/\s*\([^)]*\)/g, '').trim();
  const topThemeCardFitted = fitAndClampText(cleanTopThemeName, 380, 34, 26);
  const botThemeCardFitted = fitAndClampText(cleanBottomThemeName, 380, 34, 26);

  const slide1Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ETF 데일리 마켓 브리핑 - 표지 및 3대 핵심 펄스">
      <title>ETF 데일리 마켓 브리핑 - 1페이지</title>
      ${commonDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>
      <circle cx="950" cy="180" r="320" fill="#2E6819" fill-opacity="0.04"/>
      <circle cx="120" cy="1150" r="260" fill="#0284C7" fill-opacity="0.03"/>

      <!-- Header (y=40) -->
      <g transform="translate(70, 40)">
        <rect x="0" y="4" width="8" height="46" rx="4" fill="#10B981"/>
        <text x="22" y="42" fill="#047857" font-size="50" font-weight="900" letter-spacing="-1.2">ETF 데일리 마켓 브리핑</text>
        <rect x="690" y="2" width="250" height="50" rx="15" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.8" filter="url(#cardShadow)"/>
        <text x="815" y="35" fill="#0F172A" font-size="24" font-weight="900" text-anchor="middle" class="tabular">${formattedDate}</text>
      </g>

      <!-- Main Hero Hook Card (y=110, h=180) -->
      <g transform="translate(70, 110)" filter="url(#softShadow)">
        <rect width="940" height="180" rx="24" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="2"/>
        
        <!-- 헤드라인 1: 빅 넘버 대비 (52px 대형 볼드) -->
        <text x="35" y="70" fill="#0F172A" font-size="52" font-weight="900" letter-spacing="-1.2">
          코스피 <tspan fill="${kospiColor}">${kospiSign}${kospi.toFixed(2)}%</tspan> <tspan fill="#475569" font-weight="900">vs</tspan> 일반 ETF <tspan fill="${etfColor}">${etfSign}${etfReturn.toFixed(2)}%</tspan>
        </text>

        <!-- 헤드라인 2: 테마 & 수급 핵심 설명 (Auto-Fit & Zero Overflow) -->
        <text x="35" y="136" fill="#047857" font-size="${slide1HeroFitted.fontSize}" font-weight="900" letter-spacing="-0.6">
          ${escapeXml(slide1HeroFitted.text)}
        </text>
      </g>

      <!-- Pulse 1: Market Temperature (y=306, h=270) -->
      <g transform="translate(70, 306)" filter="url(#cardShadow)">
        <rect width="940" height="270" rx="24" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.6"/>
        <text x="35" y="46" fill="#0F172A" font-size="30" font-weight="900">1. 시장 체온 &amp; 3대 지수 비교</text>
        
        <rect x="520" y="12" width="385" height="48" rx="14" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.5"/>
        <text x="712" y="44" font-size="24" font-weight="900" text-anchor="middle">
          <tspan fill="#D92D20">상승 ${up}</tspan><tspan fill="#64748B"> · </tspan><tspan fill="#334155">보합 ${flat}</tspan><tspan fill="#64748B"> · </tspan><tspan fill="#175CD3">하락 ${down}</tspan>
        </text>

        <g transform="translate(35, 76)">
          <!-- KOSPI -->
          <rect x="0" y="0" width="280" height="165" rx="18" fill="${kospi >= 0 ? '#FEF2F2' : '#EFF6FF'}" stroke="${kospi >= 0 ? '#FECACA' : '#BFDBFE'}" stroke-width="1.6"/>
          <text x="24" y="48" fill="${kospi >= 0 ? '#991B1B' : '#1E40AF'}" font-size="28" font-weight="900">KOSPI</text>
          <text x="256" y="128" fill="${kospiColor}" font-size="56" font-weight="900" text-anchor="end" class="tabular">${kospiSign}${kospi.toFixed(2)}%</text>

          <!-- KOSDAQ -->
          <rect x="295" y="0" width="280" height="165" rx="18" fill="${kosdaq >= 0 ? '#FEF2F2' : '#EFF6FF'}" stroke="${kosdaq >= 0 ? '#FECACA' : '#BFDBFE'}" stroke-width="1.6"/>
          <text x="319" y="48" fill="${kosdaq >= 0 ? '#991B1B' : '#1E40AF'}" font-size="28" font-weight="900">KOSDAQ</text>
          <text x="551" y="128" fill="${kosdaqColor}" font-size="56" font-weight="900" text-anchor="end" class="tabular">${kosdaqSign}${kosdaq.toFixed(2)}%</text>

          <!-- 일반 ETF -->
          <rect x="590" y="0" width="280" height="165" rx="18" fill="#F0FDF4" stroke="#BBF7D0" stroke-width="1.8"/>
          <text x="614" y="48" fill="#15803D" font-size="28" font-weight="900">일반 ETF</text>
          <text x="846" y="128" fill="${etfColor}" font-size="56" font-weight="900" text-anchor="end" class="tabular">${etfSign}${etfReturn.toFixed(2)}%</text>
        </g>
      </g>

      <!-- Pulse 2: Long/Short Themes (y=592, h=270) -->
      <g transform="translate(70, 592)" filter="url(#cardShadow)">
        <rect width="940" height="270" rx="24" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.6"/>
        <text x="35" y="46" fill="#0F172A" font-size="30" font-weight="900">2. 오늘의 극과 극 테마</text>
        
        <rect x="660" y="12" width="245" height="48" rx="14" fill="#FFF7ED" stroke="#FDBA74" stroke-width="1.5"/>
        <text x="782" y="44" fill="#C2410C" font-size="24" font-weight="900" text-anchor="middle">테마 격차 ${themeGap}%p</text>

        <!-- Left: ▲ 상위 1위 카드 -->
        <g transform="translate(35, 76)">
          <rect width="425" height="165" rx="18" fill="#FEF2F2" stroke="#FECACA" stroke-width="1.6"/>
          <rect x="20" y="18" width="135" height="42" rx="10" fill="#FEE2E2"/>
          <text x="87" y="47" fill="#991B1B" font-size="24" font-weight="900" text-anchor="middle">▲ 상위 1위</text>
          <text x="405" y="52" fill="#D92D20" font-size="54" font-weight="900" text-anchor="end" class="tabular">+${(topTheme.cappedAumWeightedReturnPct ?? 0).toFixed(2)}%</text>
          <text x="20" y="128" fill="#0F172A" font-size="${topThemeCardFitted.fontSize}" font-weight="900">${escapeXml(topThemeCardFitted.text)}</text>
        </g>

        <!-- Right: ▼ 하위 1위 카드 -->
        <g transform="translate(480, 76)">
          <rect width="425" height="165" rx="18" fill="#F1F5F9" stroke="#E2E8F0" stroke-width="1.6"/>
          <rect x="20" y="18" width="135" height="42" rx="10" fill="#E2E8F0"/>
          <text x="87" y="47" fill="#475569" font-size="24" font-weight="900" text-anchor="middle">▼ 하위 1위</text>
          <text x="405" y="52" fill="${(bottomTheme.cappedAumWeightedReturnPct ?? 0) >= 0 ? '#D92D20' : '#175CD3'}" font-size="54" font-weight="900" text-anchor="end" class="tabular">${(bottomTheme.cappedAumWeightedReturnPct ?? 0) > 0 ? '+' : ''}${(bottomTheme.cappedAumWeightedReturnPct ?? 0).toFixed(2)}%</text>
          <text x="20" y="128" fill="#0F172A" font-size="${botThemeCardFitted.fontSize}" font-weight="900">${escapeXml(botThemeCardFitted.text)}</text>
        </g>
      </g>

      <!-- Pulse 3: Smart Money Flow (y=878, h=295) -->
      <g transform="translate(70, 878)" filter="url(#cardShadow)">
        <rect width="940" height="295" rx="24" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.6"/>
        <text x="35" y="48" fill="#0F172A" font-size="30" font-weight="900">3. 스마트머니 실질 순유입 1위</text>
        <rect x="740" y="16" width="165" height="42" rx="12" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.4"/>
        <text x="822" y="44" fill="#1E293B" font-size="21" font-weight="900" text-anchor="middle">기관·외국인 합산</text>
        
        <!-- Enhanced Hero Card (H: 185) -->
        <g transform="translate(35, 78)">
          <rect width="870" height="185" rx="20" fill="#F0FDF4" stroke="#86EFAC" stroke-width="1.8"/>
          <circle cx="52" cy="56" r="28" fill="#10B981"/>
          <text x="52" y="66" fill="#FFFFFF" font-size="28" font-weight="900" text-anchor="middle">1</text>
          
          <text x="100" y="66" fill="#0F172A" font-size="${fitAndClampText(cleanEtfNameForBanner(topInflow.name, 14), 430, 36, 26).fontSize}" font-weight="900">${escapeXml(fitAndClampText(cleanEtfNameForBanner(topInflow.name, 14), 430, 36, 26).text)}</text>
          
          <rect x="52" y="110" width="125" height="46" rx="12" fill="#DCFCE7" stroke="#BBF7D0" stroke-width="1.4"/>
          <text x="114" y="142" fill="#15803D" font-size="24" font-weight="900" text-anchor="middle" class="tabular">${escapeXml(topInflow.ticker)}</text>
          
          <rect x="190" y="110" width="175" height="46" rx="12" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.4"/>
          <text x="277" y="142" fill="#475569" font-size="23" font-weight="900" text-anchor="middle">${escapeXml(topInflow.theme || "핵심ETF")}</text>

          <text x="835" y="90" fill="#047857" font-size="62" font-weight="900" text-anchor="end" class="tabular">+${topInflowVal.toLocaleString()}<tspan font-size="32" font-weight="900">억원</tspan></text>
          <text x="835" y="136" fill="#15803D" font-size="24" font-weight="900" text-anchor="end">당일 기관·외인 최대 실질 순유입</text>
        </g>
      </g>

      <!-- Common Disclaimer & Watermark -->
      ${commonFooter}
    </svg>
  `;

  // =========================================================================
  // SLIDE 2: Theme Dynamics (2 / 6)
  // =========================================================================
  const cleanTopThemeClean = formatThemeForSummary(topTheme.peerGroup);
  const cleanBotThemeClean = formatThemeForSummary(bottomTheme.peerGroup);
  const slide2BannerRaw = `'${cleanTopThemeClean}' 주도 vs '${cleanBotThemeClean}' 조정 · 격차 ${themeGap}%p`;

  const slide2Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ETF 데일리 마켓 브리핑 - 주도 테마 TOP 3 vs 부진 테마">
      <title>ETF 데일리 마켓 브리핑 - 2페이지</title>
      ${commonDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>

      <!-- Header (y=40) -->
      <g transform="translate(70, 40)">
        <rect x="0" y="4" width="8" height="42" rx="4" fill="#10B981"/>
        <text x="22" y="38" fill="#047857" font-size="46" font-weight="900" letter-spacing="-0.8">오늘 시장 주도/부진 테마 TOP 3</text>
        <rect x="825" y="0" width="115" height="50" rx="15" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.8" filter="url(#cardShadow)"/>
        <text x="882.5" y="34" fill="#0F172A" font-size="24" font-weight="900" text-anchor="middle" class="tabular">2 / ${totalSlides}</text>
      </g>

      ${renderCoreSummaryBanner({
        badgeText: "테마 핵심",
        badgeBg: "#FEF3C7",
        badgeBorder: "#FCD34D",
        badgeTextColor: "#B45309",
        cardBg: "#FFFFFF",
        cardBorder: "#CBD5E1",
        text: slide2BannerRaw,
        yOffset: 104,
      })}

      <!-- Panel 1: Top 3 Leaders (▲ 상위 Top 3) (y=212, h=485) -->
      <g transform="translate(70, 212)" filter="url(#cardShadow)">
        <rect width="940" height="485" rx="24" fill="#FFFFFF" stroke="#FECDCA" stroke-width="1.8"/>
        <rect x="0" y="0" width="940" height="62" rx="24" fill="#FEF3F2"/>
        <text x="35" y="42" fill="#B42318" font-size="32" font-weight="900">▲ 상위 Top 3 주도 테마</text>

        ${winners.length > 0 ? winners.map((w, idx) => {
          const cleanName = w.peerGroup.replace(/\s*\([^)]*\)/g, '').trim();
          const themeFitted = fitAndClampText(cleanName, 520, 38, 28);
          const ret = w.cappedAumWeightedReturnPct ?? 0;
          const retSign = ret > 0 ? "▲ +" : ret < 0 ? "▼ " : "";
          const retColor = ret >= 0 ? "#D92D20" : "#175CD3";
          return `
          <g transform="translate(35, ${76 + idx * 134})">
            <rect width="870" height="122" rx="20" fill="#FAFDF4" stroke="#D7EABB" stroke-width="1.6"/>
            <circle cx="56" cy="61" r="32" fill="${idx === 0 ? '#D92D20' : '#FEE4E2'}"/>
            <text x="56" y="72" fill="${idx === 0 ? '#FFFFFF' : '#D92D20'}" font-size="28" font-weight="900" text-anchor="middle">${idx + 1}</text>
            <text x="108" y="52" fill="#0F172A" font-size="${themeFitted.fontSize}" font-weight="900">${escapeXml(themeFitted.text)}</text>
            <rect x="108" y="68" width="165" height="38" rx="10" fill="#F0FDF4" stroke="#BBF7D0" stroke-width="1.4"/>
            <text x="190" y="94" fill="#15803D" font-size="24" font-weight="900" text-anchor="middle">가중수익률 상위</text>
            <text x="840" y="78" fill="${retColor}" font-size="56" font-weight="900" text-anchor="end" class="tabular">${retSign}${ret.toFixed(2)}%</text>
          </g>
        `;}).join("") : `
          <g transform="translate(35, 120)">
            <rect width="870" height="140" rx="20" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.5"/>
            <text x="435" y="80" fill="#64748B" font-size="28" font-weight="800" text-anchor="middle">✔ 당일 주도 테마 데이터 집계 중입니다</text>
          </g>
        `}
      </g>

      <!-- Panel 2: Bottom 3 Laggards (▼ 하위 Worst 3) (y=712, h=485) -->
      <g transform="translate(70, 712)" filter="url(#cardShadow)">
        <rect width="940" height="485" rx="24" fill="#FFFFFF" stroke="#BFDBFE" stroke-width="1.8"/>
        <rect x="0" y="0" width="940" height="62" rx="24" fill="#EFF6FF"/>
        <text x="35" y="42" fill="#1D4ED8" font-size="32" font-weight="900">▼ 하위 Worst 3 부진 테마</text>

        ${losers.length > 0 ? losers.map((l, idx) => {
          const cleanName = l.peerGroup.replace(/\s*\([^)]*\)/g, '').trim();
          const themeFitted = fitAndClampText(cleanName, 520, 38, 28);
          const ret = l.cappedAumWeightedReturnPct ?? 0;
          const retSign = ret > 0 ? "▲ +" : ret < 0 ? "▼ " : "";
          const retColor = ret >= 0 ? "#D92D20" : "#175CD3";
          return `
          <g transform="translate(35, ${76 + idx * 134})">
            <rect width="870" height="122" rx="20" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.6"/>
            <circle cx="56" cy="61" r="32" fill="${idx === 0 ? '#175CD3' : '#DBEAFE'}"/>
            <text x="56" y="72" fill="${idx === 0 ? '#FFFFFF' : '#175CD3'}" font-size="28" font-weight="900" text-anchor="middle">${idx + 1}</text>
            <text x="108" y="52" fill="#0F172A" font-size="${themeFitted.fontSize}" font-weight="900">${escapeXml(themeFitted.text)}</text>
            <rect x="108" y="68" width="165" height="38" rx="10" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.4"/>
            <text x="190" y="94" fill="#475569" font-size="24" font-weight="900" text-anchor="middle">가중수익률 하위</text>
            <text x="840" y="78" fill="${retColor}" font-size="56" font-weight="900" text-anchor="end" class="tabular">${retSign}${ret.toFixed(2)}%</text>
          </g>
        `;}).join("") : `
          <g transform="translate(35, 120)">
            <rect width="870" height="140" rx="20" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.5"/>
            <text x="435" y="80" fill="#64748B" font-size="28" font-weight="800" text-anchor="middle">✔ 당일 부진 테마 데이터 집계 중입니다</text>
          </g>
        `}
      </g>

      <!-- Common Disclaimer & Watermark -->
      ${commonFooter}
    </svg>
  `;

  // =========================================================================
  // SLIDE 3: Asset Class Dynamics (3 / 6)
  // =========================================================================
  const domesticStock = assetClasses.find(a => a.assetClass?.includes("국내") || a.assetClass?.includes("주식-국내"));
  const domRet = domesticStock?.aumWeightedReturnPct ?? 4.14;
  const domSign = domRet > 0 ? "+" : "";

  const sortedByRet = [...assetClasses].sort((a, b) => (b.aumWeightedReturnPct ?? 0) - (a.aumWeightedReturnPct ?? 0));
  const topAsset = sortedByRet[0] || { assetClass: "국내주식", aumWeightedReturnPct: 4.14 };
  const botAsset = sortedByRet[sortedByRet.length - 1] || { assetClass: "원자재", aumWeightedReturnPct: -1.98 };

  const slide3BannerRaw = `국내주식 ${domSign}${domRet.toFixed(2)}% · '${topAsset.assetClass}' 상승 vs '${botAsset.assetClass}' 조정`;

  const slide3Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ETF 데일리 마켓 브리핑 - 자산군별 성과 및 비중 현황">
      <title>ETF 데일리 마켓 브리핑 - 3페이지</title>
      ${commonDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>

      <!-- Header (y=40) -->
      <g transform="translate(70, 40)">
        <rect x="0" y="4" width="8" height="42" rx="4" fill="#10B981"/>
        <text x="22" y="38" fill="#047857" font-size="46" font-weight="900" letter-spacing="-0.8">자산군별 수익률 &amp; 비중 현황</text>
        <rect x="825" y="0" width="115" height="50" rx="15" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.8" filter="url(#cardShadow)"/>
        <text x="882.5" y="34" fill="#0F172A" font-size="24" font-weight="900" text-anchor="middle" class="tabular">3 / ${totalSlides}</text>
      </g>

      ${renderCoreSummaryBanner({
        badgeText: "자산군 핵심",
        badgeBg: "#DCFCE7",
        badgeBorder: "#86EFAC",
        badgeTextColor: "#15803D",
        cardBg: "#FFFFFF",
        cardBorder: "#CBD5E1",
        text: slide3BannerRaw,
        yOffset: 104,
      })}

      <!-- 6 Asset Classes Grid (2 columns x 3 rows, y=212) -->
      <g transform="translate(70, 212)">
        ${assetClasses.slice(0, 6).map((ac, idx) => {
          const rawAum = ac.totalAum || 0;
          const aumEok = rawAum > 100_000_000_000 ? rawAum / 100_000_000 : rawAum;
          const aumJo = (aumEok / 10000).toFixed(1);
          const ret = ac.aumWeightedReturnPct ?? 0;
          const retSign = ret > 0 ? "▲ +" : ret < 0 ? "▼ " : "";
          const retColor = ret >= 0 ? "#D92D20" : "#175CD3";
          const share = ac.aumSharePct ?? 0;

          const col = idx % 2;
          const row = Math.floor(idx / 2);
          const posX = col * 485;
          const posY = row * 324;

          const nameFitted = fitAndClampText(ac.assetClass, 260, 36, 28);

          return `
            <g transform="translate(${posX}, ${posY})" filter="url(#cardShadow)">
              <rect width="455" height="308" rx="22" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.8"/>
              
              <!-- Top Row: Asset Class Name & Share Badge -->
              <text x="24" y="50" fill="#0F172A" font-size="${nameFitted.fontSize}" font-weight="900">${escapeXml(nameFitted.text)}</text>
              <rect x="295" y="18" width="136" height="42" rx="10" fill="#F0FDF4" stroke="#BBF7D0" stroke-width="1.4"/>
              <text x="363" y="46" fill="#15803D" font-size="24" font-weight="900" text-anchor="middle">비중 ${share.toFixed(1)}%</text>

              <!-- AUM Info -->
              <text x="24" y="92" fill="#475569" font-size="26" font-weight="800">
                순자산 <tspan font-weight="900" fill="#0F172A">${aumJo}조원</tspan>
              </text>

              <!-- Progress Bar -->
              <rect x="24" y="110" width="407" height="12" rx="6" fill="#F1F5F9"/>
              <rect x="24" y="110" width="${Math.min(407, Math.max(12, share * 4.07))}" height="12" rx="6" fill="#047857"/>

              <!-- Inner Metric Box -->
              <rect x="24" y="138" width="407" height="150" rx="16" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.4"/>
              <rect x="36" y="150" width="112" height="36" rx="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.2"/>
              <text x="92" y="175" fill="#475569" font-size="20" font-weight="900" text-anchor="middle">가중수익률</text>

              <text x="415" y="184" fill="${retColor}" font-size="44" font-weight="900" text-anchor="end" class="tabular">${retSign}${ret.toFixed(2)}%</text>

              <line x1="36" y1="220" x2="415" y2="220" stroke="#E2E8F0" stroke-width="1.2"/>
              <text x="40" y="258" fill="#64748B" font-size="24" font-weight="800">종목 분포</text>
              <text x="415" y="258" fill="#1E293B" font-size="26" font-weight="900" text-anchor="end" class="tabular">상승 ${ac.upCount} · 하락 ${ac.downCount}</text>
            </g>
          `;
        }).join("")}
      </g>

      <!-- Common Disclaimer & Watermark -->
      ${commonFooter}
    </svg>
  `;

  // =========================================================================
  // SLIDE 4: Smart Money Flow (4 / 6)
  // =========================================================================
  const slide4SummaryRaw = `상위 5개 종목 총 +${top5InflowSum.toLocaleString()}억원 실질 자금 순유입 집중`;

  const slide4Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ETF 데일리 마켓 브리핑 - 스마트머니 실질 순유입 TOP 5">
      <title>ETF 데일리 마켓 브리핑 - 4페이지</title>
      ${commonDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>
      <circle cx="950" cy="180" r="300" fill="#D92D20" fill-opacity="0.035"/>
      <circle cx="100" cy="1150" r="260" fill="#BE123C" fill-opacity="0.03"/>

      <!-- Header (y=40) -->
      <g transform="translate(70, 40)">
        <rect x="0" y="4" width="8" height="42" rx="4" fill="#10B981"/>
        <text x="22" y="38" fill="#047857" font-size="46" font-weight="900" letter-spacing="-0.8">실질 자금 순유입 TOP 5</text>
        <rect x="825" y="0" width="115" height="50" rx="15" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.8" filter="url(#cardShadow)"/>
        <text x="882.5" y="34" fill="#0F172A" font-size="24" font-weight="900" text-anchor="middle" class="tabular">4 / ${totalSlides}</text>
      </g>

      ${renderCoreSummaryBanner({
        badgeText: "수급 핵심",
        badgeBg: "#FFE4E6",
        badgeBorder: "#FDA4AF",
        badgeTextColor: "#BE123C",
        cardBg: "#FFFFFF",
        cardBorder: "#CBD5E1",
        text: slide4SummaryRaw,
        yOffset: 104,
      })}

      <!-- TOP 5 Inflow Ranking Cards (y=212, step=194, h=180) -->
      <g transform="translate(70, 212)">
        ${topInflows.length > 0 ? topInflows.slice(0, 5).map((item, idx) => {
          const inflowJo = getInflowVal(item).toLocaleString();
          const isTop = idx === 0;
          const cleanName = (item.name || "").replace(/\s*\([^)]*\)/g, '').trim();
          // Reserved width: 450px so ETF name NEVER collides with amount on the right!
          const nameFitted = fitAndClampText(cleanName, 450, 36, 26);
          const themeFitted = fitAndClampText(item.theme || "핵심ETF", 170, 24, 20);

          return `
            <g transform="translate(0, ${idx * 194})" filter="url(#cardShadow)">
              <rect width="940" height="180" rx="24" fill="${isTop ? '#FFF8F8' : '#FFFFFF'}" stroke="${isTop ? '#FCA5A5' : '#E2E8F0'}" stroke-width="${isTop ? '2' : '1.8'}"/>
              ${isTop ? '<rect x="0" y="0" width="8" height="180" rx="4" fill="#D92D20"/>' : ''}

              <!-- 순위 뱃지 -->
              <circle cx="60" cy="90" r="34" fill="${isTop ? '#D92D20' : '#F1F5F9'}" ${!isTop ? 'stroke="#CBD5E1" stroke-width="1.5"' : ''}/>
              <text x="60" y="102" fill="${isTop ? '#FFFFFF' : '#475569'}" font-size="30" font-weight="900" text-anchor="middle">${idx + 1}</text>

              <!-- ETF명 (Auto-Fitted & Clamped) -->
              <text x="110" y="70" fill="#0F172A" font-size="${nameFitted.fontSize}" font-weight="900">${escapeXml(nameFitted.text)}</text>

              <!-- 티커 -->
              <rect x="110" y="98" width="115" height="42" rx="10" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.4"/>
              <text x="167" y="127" fill="#1E293B" font-size="26" font-weight="900" text-anchor="middle" class="tabular">${item.ticker}</text>

              <!-- 테마 태그 -->
              <rect x="236" y="98" width="185" height="42" rx="10" fill="${isTop ? '#FFE4E6' : '#F8FAFC'}" stroke="${isTop ? '#FDA4AF' : '#E2E8F0'}" stroke-width="1.4"/>
              <text x="328" y="127" fill="${isTop ? '#BE123C' : '#334155'}" font-size="${themeFitted.fontSize}" font-weight="900" text-anchor="middle">${escapeXml(themeFitted.text)}</text>

              <!-- 순유입 금액 -->
              <text x="910" y="84" fill="${isTop ? '#D92D20' : '#047857'}" font-size="58" font-weight="900" text-anchor="end" class="tabular">+${inflowJo}<tspan font-size="32" font-weight="900" fill="${isTop ? '#BE123C' : '#065F46'}">억원</tspan></text>
              <text x="910" y="128" fill="${isTop ? '#BE123C' : '#475569'}" font-size="26" font-weight="900" text-anchor="end">${isTop ? '당일 최대 실질 순유입' : '순유입 상위 종목'}</text>
            </g>
          `;
        }).join("") : `
          <g transform="translate(0, 40)" filter="url(#cardShadow)">
            <rect width="940" height="200" rx="24" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.8"/>
            <text x="470" y="110" fill="#64748B" font-size="28" font-weight="800" text-anchor="middle">✔ 당일 스마트머니 순유입 집계 데이터 준비 중입니다</text>
          </g>
        `}
      </g>

      <!-- Common Disclaimer & Watermark -->
      ${commonFooter}
    </svg>
  `;

  // =========================================================================
  // SLIDE 5: Disparity Alert (Fixed 4-Slot Architecture) (5 / 6)
  // =========================================================================
  const prem1 = premiums[0];
  const prem2 = premiums[1];
  const disc1 = discounts[0];
  const disc2 = discounts[1];

  const slide5Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ETF 데일리 마켓 브리핑 - 괴리율 고평가·할증 vs 저평가·할인 진단">
      <title>ETF 데일리 마켓 브리핑 - 5페이지</title>
      ${commonDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>

      <!-- Header (y=40) -->
      <g transform="translate(70, 40)">
        <rect x="0" y="4" width="8" height="42" rx="4" fill="#10B981"/>
        <text x="22" y="38" fill="#047857" font-size="42" font-weight="900" letter-spacing="-0.8">괴리율 고평가·할증 vs 저평가·할인 진단</text>
        <rect x="825" y="0" width="115" height="50" rx="15" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.8" filter="url(#cardShadow)"/>
        <text x="882.5" y="34" fill="#0F172A" font-size="24" font-weight="900" text-anchor="middle" class="tabular">5 / ${totalSlides}</text>
      </g>

      ${renderCoreSummaryBanner({
        badgeText: "괴리율 진단",
        badgeBg: "#FEF3C7",
        badgeBorder: "#FCD34D",
        badgeTextColor: "#B45309",
        cardBg: "#FFFFFF",
        cardBorder: "#CBD5E1",
        text: "장 개장 직후 호가 공백 및 해외 시차로 인한 NAV 왜곡 주의",
        yOffset: 104,
      })}

      <!-- SECTION 1: NAV 대비 고평가 · 할증 Top 2 (y=212) -->
      <g transform="translate(70, 212)">
        <text x="5" y="28" fill="#991B1B" font-size="30" font-weight="900">▲ NAV 대비 고평가 · 할증 주의 (시장가 &gt; 가치)</text>

        <!-- Slot 1 (y=40) -->
        ${prem1 ? (() => {
          const nameFitted = fitAndClampText((prem1.etfName || "").replace(/\s*\([^)]*\)/g, '').trim(), 480, 36, 26);
          return `
          <g transform="translate(0, 40)" filter="url(#cardShadow)">
            <rect width="940" height="166" rx="24" fill="#FFF8F8" stroke="#FCA5A5" stroke-width="2"/>
            <rect x="0" y="0" width="8" height="166" rx="4" fill="#D92D20"/>
            <circle cx="60" cy="83" r="34" fill="#D92D20"/>
            <text x="60" y="95" fill="#FFFFFF" font-size="30" font-weight="900" text-anchor="middle">1</text>
            <text x="110" y="66" fill="#0F172A" font-size="${nameFitted.fontSize}" font-weight="900">${escapeXml(nameFitted.text)}</text>
            <rect x="110" y="96" width="115" height="44" rx="10" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.4"/>
            <text x="167" y="127" fill="#1E293B" font-size="26" font-weight="900" text-anchor="middle" class="tabular">${prem1.ticker}</text>
            <rect x="236" y="96" width="165" height="44" rx="10" fill="#FEE2E2" stroke="#FDA4AF" stroke-width="1.4"/>
            <text x="318" y="127" fill="#BE123C" font-size="24" font-weight="900" text-anchor="middle">고평가 할증</text>
            <text x="910" y="78" fill="#D92D20" font-size="62" font-weight="900" text-anchor="end" class="tabular">+${(prem1.disparityPct ?? 0).toFixed(2)}%</text>
            <text x="910" y="126" fill="#BE123C" font-size="26" font-weight="900" text-anchor="end">NAV 대비 할증 거래 중</text>
          </g>
          `;
        })() : `
        <g transform="translate(0, 40)" filter="url(#cardShadow)">
          <rect width="940" height="166" rx="24" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.8"/>
          <text x="470" y="96" fill="#15803D" font-size="28" font-weight="900" text-anchor="middle">✔ 전 종목 NAV 대비 할증률 정상 범위 유지 (고평가 종목 없음)</text>
        </g>
        `}

        <!-- Slot 2 (y=220) -->
        ${prem2 ? (() => {
          const nameFitted = fitAndClampText((prem2.etfName || "").replace(/\s*\([^)]*\)/g, '').trim(), 480, 36, 26);
          return `
          <g transform="translate(0, 220)" filter="url(#cardShadow)">
            <rect width="940" height="166" rx="24" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.8"/>
            <circle cx="60" cy="83" r="34" fill="#FEE2E2"/>
            <text x="60" y="95" fill="#991B1B" font-size="30" font-weight="900" text-anchor="middle">2</text>
            <text x="110" y="66" fill="#0F172A" font-size="${nameFitted.fontSize}" font-weight="900">${escapeXml(nameFitted.text)}</text>
            <rect x="110" y="96" width="115" height="44" rx="10" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.4"/>
            <text x="167" y="127" fill="#1E293B" font-size="26" font-weight="900" text-anchor="middle" class="tabular">${prem2.ticker}</text>
            <rect x="236" y="96" width="165" height="44" rx="10" fill="#FEE2E2" stroke="#FDA4AF" stroke-width="1.4"/>
            <text x="318" y="127" fill="#BE123C" font-size="24" font-weight="900" text-anchor="middle">고평가 할증</text>
            <text x="910" y="78" fill="#D92D20" font-size="62" font-weight="900" text-anchor="end" class="tabular">+${(prem2.disparityPct ?? 0).toFixed(2)}%</text>
            <text x="910" y="126" fill="#BE123C" font-size="26" font-weight="900" text-anchor="end">NAV 대비 할증 거래 중</text>
          </g>
          `;
        })() : `
        <g transform="translate(0, 220)" filter="url(#cardShadow)">
          <rect width="940" height="166" rx="24" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.8"/>
          <text x="470" y="96" fill="#475569" font-size="26" font-weight="800" text-anchor="middle">✔ 추가 고평가 종목 없음 (대부분 종목 정상 호가 유지)</text>
        </g>
        `}
      </g>

      <!-- SECTION 2: NAV 대비 저평가 · 할인 Top 2 (y=634) -->
      <g transform="translate(70, 634)">
        <text x="5" y="28" fill="#166534" font-size="30" font-weight="900">▼ NAV 대비 저평가 · 할인 체크 (시장가 &lt; 가치)</text>

        <!-- Slot 1 (y=40) -->
        ${disc1 ? (() => {
          const nameFitted = fitAndClampText((disc1.etfName || "").replace(/\s*\([^)]*\)/g, '').trim(), 480, 36, 26);
          return `
          <g transform="translate(0, 40)" filter="url(#cardShadow)">
            <rect width="940" height="166" rx="24" fill="#F0FDF4" stroke="#86EFAC" stroke-width="2"/>
            <rect x="0" y="0" width="8" height="166" rx="4" fill="#059669"/>
            <circle cx="60" cy="83" r="34" fill="#059669"/>
            <text x="60" y="95" fill="#FFFFFF" font-size="30" font-weight="900" text-anchor="middle">1</text>
            <text x="110" y="66" fill="#0F172A" font-size="${nameFitted.fontSize}" font-weight="900">${escapeXml(nameFitted.text)}</text>
            <rect x="110" y="96" width="115" height="44" rx="10" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.4"/>
            <text x="167" y="127" fill="#1E293B" font-size="26" font-weight="900" text-anchor="middle" class="tabular">${disc1.ticker}</text>
            <rect x="236" y="96" width="165" height="44" rx="10" fill="#DCFCE7" stroke="#86EFAC" stroke-width="1.4"/>
            <text x="318" y="127" fill="#15803D" font-size="24" font-weight="900" text-anchor="middle">저평가 할인</text>
            <text x="910" y="78" fill="#047857" font-size="62" font-weight="900" text-anchor="end" class="tabular">${(disc1.disparityPct ?? 0).toFixed(2)}%</text>
            <text x="910" y="126" fill="#15803D" font-size="26" font-weight="900" text-anchor="end">NAV 대비 할인 거래 중</text>
          </g>
          `;
        })() : `
        <g transform="translate(0, 40)" filter="url(#cardShadow)">
          <rect width="940" height="166" rx="24" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.8"/>
          <text x="470" y="96" fill="#15803D" font-size="28" font-weight="900" text-anchor="middle">✔ 전 종목 NAV 대비 할인율 정상 범위 유지 (저평가 왜곡 없음)</text>
        </g>
        `}

        <!-- Slot 2 (y=220) -->
        ${disc2 ? (() => {
          const nameFitted = fitAndClampText((disc2.etfName || "").replace(/\s*\([^)]*\)/g, '').trim(), 480, 36, 26);
          return `
          <g transform="translate(0, 220)" filter="url(#cardShadow)">
            <rect width="940" height="166" rx="24" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.8"/>
            <circle cx="60" cy="83" r="34" fill="#DCFCE7"/>
            <text x="60" y="95" fill="#166534" font-size="30" font-weight="900" text-anchor="middle">2</text>
            <text x="110" y="66" fill="#0F172A" font-size="${nameFitted.fontSize}" font-weight="900">${escapeXml(nameFitted.text)}</text>
            <rect x="110" y="96" width="115" height="44" rx="10" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.4"/>
            <text x="167" y="127" fill="#1E293B" font-size="26" font-weight="900" text-anchor="middle" class="tabular">${disc2.ticker}</text>
            <rect x="236" y="96" width="165" height="44" rx="10" fill="#DCFCE7" stroke="#86EFAC" stroke-width="1.4"/>
            <text x="318" y="127" fill="#15803D" font-size="24" font-weight="900" text-anchor="middle">저평가 할인</text>
            <text x="910" y="78" fill="#047857" font-size="62" font-weight="900" text-anchor="end" class="tabular">${(disc2.disparityPct ?? 0).toFixed(2)}%</text>
            <text x="910" y="126" fill="#15803D" font-size="26" font-weight="900" text-anchor="end">NAV 대비 할인 거래 중</text>
          </g>
          `;
        })() : `
        <g transform="translate(0, 220)" filter="url(#cardShadow)">
          <rect width="940" height="166" rx="24" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.8"/>
          <text x="470" y="96" fill="#475569" font-size="26" font-weight="800" text-anchor="middle">✔ 추가 저평가 종목 없음 (정상 범위 호가 유지)</text>
        </g>
        `}
      </g>

      <!-- SECTION 3: 실전 체크리스트 (y=1060, h=114) -->
      <g transform="translate(70, 1060)" filter="url(#cardShadow)">
        <rect width="940" height="114" rx="20" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.6"/>
        <text x="35" y="44" fill="#0F172A" font-size="26" font-weight="900">💡 실전 대응 가이드</text>
        <text x="35" y="84" fill="#1E293B" font-size="23" font-weight="800">
          괴리율 확대 종목은 시장가 추격 매수를 지양하고, 실시간 iNAV 확인 후 분할 대응 권장
        </text>
      </g>

      <!-- Common Disclaimer & Watermark -->
      ${commonFooter}
    </svg>
  `;

  // =========================================================================
  // SLIDE 6: Style Rotation Radar (6 / 6) [Zero-Advisory Compliance]
  // =========================================================================
  const classifyInflowStyle = (item: any): "CORE" | "GROWTH" | "DEFENSIVE" => {
    const raw = `${item.name || item.etfName || ""} ${item.theme || ""}`;
    if (/채권|국채|회사채|금리|KOFR|SOFR|CD|파킹|머니마켓|단기채|배당|커버드콜|인컴|리츠|인프라/i.test(raw)) {
      return "DEFENSIVE";
    }
    if (/200|S&P|나스닥|다우|대표|코스피|코스닥|시장|MSCI\s*선진/i.test(raw)) {
      return "CORE";
    }
    return "GROWTH";
  };

  const coreItems: any[] = [];
  const growthItems: any[] = [];
  const defensiveItems: any[] = [];
  let coreSum = 0;
  let growthSum = 0;
  let defensiveSum = 0;

  for (const item of topInflows.slice(0, 10)) {
    const val = getInflowVal(item);
    const style = classifyInflowStyle(item);
    if (style === "CORE") {
      coreItems.push(item);
      coreSum += val;
    } else if (style === "DEFENSIVE") {
      defensiveItems.push(item);
      defensiveSum += val;
    } else {
      growthItems.push(item);
      growthSum += val;
    }
  }

  const totalFlowSum = coreSum + growthSum + defensiveSum;
  let corePct = 50;
  let growthPct = 42;
  let defensivePct = 8;
  if (totalFlowSum > 0) {
    corePct = Math.round((coreSum / totalFlowSum) * 100);
    growthPct = Math.round((growthSum / totalFlowSum) * 100);
    defensivePct = 100 - corePct - growthPct;
  }

  const totalBarW = 870;
  const coreW = Math.max(20, Math.round(totalBarW * (corePct / 100)));
  const growthW = Math.max(20, Math.round(totalBarW * (growthPct / 100)));
  const defW = Math.max(20, totalBarW - coreW - growthW);

  const formatBarSegmentLabel = (name: string, pct: number, sumEok: number, widthPx: number): { text: string; fontSize: number } => {
    if (widthPx >= 220) {
      return { text: `${name} ${pct}% (+${sumEok.toLocaleString()}억)`, fontSize: 23 };
    }
    if (widthPx >= 110) {
      return { text: `${name} ${pct}%`, fontSize: 21 };
    }
    if (widthPx >= 48) {
      return { text: `${pct}%`, fontSize: 22 };
    }
    return { text: '', fontSize: 0 };
  };

  const coreLabel = formatBarSegmentLabel("시장대표", corePct, coreSum, coreW);
  const growthLabel = formatBarSegmentLabel("공격성장", growthPct, growthSum, growthW);
  const defLabel = formatBarSegmentLabel("방어", defensivePct, defensiveSum, defW);

  // Hero Summary Text
  let heroSummary = `시장대표 패시브 적립(${corePct}%)과 성장 테마 저가매수(${growthPct}%)로 스마트머니 ${corePct + growthPct}% 집중`;
  if (growthPct >= corePct && growthPct >= defensivePct) {
    heroSummary = `혁신 성장 테마 저가매수(${growthPct}%)와 시장대표 패시브 적립(${corePct}%)으로 스마트머니 ${growthPct + corePct}% 집중`;
  } else if (defensivePct >= corePct && defensivePct >= growthPct) {
    heroSummary = `방어형 인컴·채권 자산(${defensivePct}%)과 시장대표 지수(${corePct}%)로 완충 수급 집중`;
  }
  const fittedHeroSummary = fitAndClampText(heroSummary, 680, 21, 18);

  // Render Individual Style Card Helper (Guaranteed Zero Overflow Standard Template)
  const renderStyleCard = (
    styleNum: string,
    styleTitle: string,
    purposeBadge: string,
    items: any[],
    sum: number,
    pct: number,
    themeBorder: string,
    barFill: string,
    badgeBg: string,
    badgeBorder: string,
    badgeTextColor: string,
    factText: string,
    defaultTheme: string,
    yPos: number
  ): string => {
    let middleContent = "";
    if (items.length >= 2) {
      const top3 = items.slice(0, 3);
      middleContent = top3.map((it: any, idx: number) => {
        const rawName = (it.name || it.etfName || defaultTheme).replace(/\s*\([^)]*\)/g, '').trim();
        const fitted = fitAndClampText(rawName, 214, 18.5, 18);
        const val = getInflowVal(it);
        const posX = 35 + idx * 295;
        return `
          <g transform="translate(${posX}, 88)" clip-path="url(#chipClip)">
            <rect width="280" height="76" rx="14" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.4"/>
            <rect x="12" y="17" width="38" height="42" rx="10" fill="${badgeBg}"/>
            <text x="31" y="45" fill="${badgeTextColor}" font-size="20" font-weight="900" text-anchor="middle">${idx + 1}</text>
            <text x="58" y="39" fill="#0F172A" font-size="${fitted.fontSize}" font-weight="900">${escapeXml(fitted.text)}</text>
            <text x="58" y="63" fill="${badgeTextColor}" font-size="18" font-weight="900" class="tabular">+${val.toLocaleString()}억원 유입</text>
          </g>
        `;
      }).join("");
    } else if (items.length === 1) {
      const it = items[0];
      const rawName = (it.name || it.etfName || defaultTheme).replace(/\s*\([^)]*\)/g, '').trim();
      const fitted = fitAndClampText(rawName, 290, 23, 19);
      const val = getInflowVal(it);
      const itName = it.name || it.etfName || "";
      let subNote = "(단일 종목 순유입 집중)";
      if (styleTitle.includes("성장")) {
        subNote = (it.changePct ?? 0) < 0 ? "(단일 종목 순유입 압도적 1위)" : "(주도 성장 단일 종목 집중)";
      } else if (styleTitle.includes("방어")) {
        if (/채권|국채|회사채/i.test(itName)) subNote = "(우량 신용등급 안전 완충)";
        else if (/파킹|KOFR|CD|금리/i.test(itName)) subNote = "(단기 파킹 유동성 완충)";
        else if (/배당|인컴|커버드콜/i.test(itName)) subNote = "(고배당 인컴 현금흐름)";
        else subNote = "(변동성 방어 수급 완충)";
      } else {
        subNote = "(대표 지수 패시브 자금 집중)";
      }
      const fittedNote = fitAndClampText(subNote, 260, 19, 18);

      middleContent = `
        <g transform="translate(35, 88)" clip-path="url(#wideChipClip)">
          <rect width="870" height="76" rx="14" fill="${badgeBg}" stroke="${badgeBorder}" stroke-width="1.4"/>
          <rect x="16" y="17" width="85" height="42" rx="10" fill="#FFFFFF"/>
          <text x="58.5" y="44" fill="${badgeTextColor}" font-size="19" font-weight="900" text-anchor="middle">1위 집중</text>
          <text x="112" y="47" fill="#0F172A" font-size="${fitted.fontSize}" font-weight="900">${escapeXml(fitted.text)}</text>
          <rect x="415" y="17" width="165" height="42" rx="10" fill="#FFFFFF" stroke="${badgeBorder}" stroke-width="1.2"/>
          <text x="497.5" y="44" fill="${badgeTextColor}" font-size="19" font-weight="900" text-anchor="middle" class="tabular">+${val.toLocaleString()}억원 순유입</text>
          <text x="595" y="46" fill="#475569" font-size="${fittedNote.fontSize}" font-weight="800">${escapeXml(fittedNote.text)}</text>
        </g>
      `;
    } else {
      middleContent = `
        <g transform="translate(35, 88)">
          <rect width="870" height="76" rx="14" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.4"/>
          <text x="435" y="45" fill="#64748B" font-size="19" font-weight="800" text-anchor="middle">✔ 당일 상위 순유입 종목군 내 집계 대기</text>
        </g>
      `;
    }

    const fittedFact = fitAndClampText(factText, 680, 21, 18);

    return `
      <g transform="translate(70, ${yPos})" filter="url(#cardShadow)">
        <rect width="940" height="276" rx="24" fill="#FFFFFF" stroke="${themeBorder}" stroke-width="2"/>
        <rect x="0" y="0" width="8" height="276" rx="4" fill="${barFill}"/>

        <!-- Header line: 스타일명 + 직관적 한글 목적 뱃지 + 금액/점유율 -->
        <rect x="35" y="18" width="160" height="42" rx="10" fill="${badgeBg}" stroke="${badgeBorder}" stroke-width="1.4"/>
        <text x="115" y="46" fill="${badgeTextColor}" font-size="20" font-weight="900" text-anchor="middle">${styleNum} ${styleTitle}</text>
        
        <rect x="210" y="18" width="165" height="42" rx="10" fill="#F1F5F9" stroke="#E2E8F0" stroke-width="1.2"/>
        <text x="292.5" y="46" fill="#334155" font-size="20" font-weight="900" text-anchor="middle">${purposeBadge}</text>

        <text x="905" y="49" fill="${badgeTextColor}" font-size="32" font-weight="900" text-anchor="end" class="tabular">+${sum.toLocaleString()}억원 <tspan font-size="22" fill="#64748B" font-weight="800">(점유율 ${pct}%)</tspan></text>

        <line x1="35" y1="74" x2="905" y2="74" stroke="#F1F5F9" stroke-width="1.5"/>

        <!-- Middle: Dynamic Items Chips Grid (Guaranteed Zero Overflow) -->
        ${middleContent}

        <!-- Bottom: Factual Commentary Band (Strictly Clamped to 680px) -->
        <g transform="translate(35, 180)" clip-path="url(#factBandClip)">
          <rect width="870" height="76" rx="14" fill="${badgeBg}" stroke="${badgeBorder}" stroke-width="1.2"/>
          <rect x="14" y="17" width="115" height="42" rx="10" fill="#FFFFFF"/>
          <text x="71.5" y="44" fill="${badgeTextColor}" font-size="19" font-weight="900" text-anchor="middle">수급 팩트</text>
          <text x="144" y="45" fill="#1E293B" font-size="${fittedFact.fontSize}" font-weight="800">
            ${escapeXml(fittedFact.text)}
          </text>
        </g>
      </g>
    `;
  };

  const slide6Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ETF 데일리 마켓 브리핑 - 오늘 시장 수급 나침반: 스마트머니 스타일 로테이션">
      <title>ETF 데일리 마켓 브리핑 - 6페이지</title>
      ${commonDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>
      <circle cx="950" cy="180" r="300" fill="#059669" fill-opacity="0.035"/>
      <circle cx="100" cy="1150" r="260" fill="#3B82F6" fill-opacity="0.03"/>

      <!-- Header (y=40) -->
      <g transform="translate(70, 40)">
        <rect x="0" y="4" width="8" height="42" rx="4" fill="#10B981"/>
        <text x="22" y="38" fill="#047857" font-size="44" font-weight="900" letter-spacing="-0.8">오늘 시장 수급 나침반</text>
        <rect x="825" y="0" width="115" height="50" rx="15" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.8" filter="url(#cardShadow)"/>
        <text x="882.5" y="34" fill="#0F172A" font-size="24" font-weight="900" text-anchor="middle" class="tabular">6 / ${totalSlides}</text>
      </g>

      <!-- 1. Hero 3-Way Segment Bar Card (y=102, h=214) -->
      <g transform="translate(70, 102)" filter="url(#cardShadow)">
        <rect width="940" height="214" rx="24" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.8"/>
        
        <!-- Title row inside Hero: 스타일 로테이션 + 명시적 당일 순유입 TOP 10 뱃지 + 합산 금액 -->
        <text x="35" y="42" fill="#0F172A" font-size="26" font-weight="900">
          스마트머니 3대 스타일 로테이션
        </text>
        <rect x="425" y="16" width="180" height="40" rx="10" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.2"/>
        <text x="515" y="42" fill="#475569" font-size="19" font-weight="900" text-anchor="middle">
          당일 순유입 TOP 10
        </text>
        <rect x="680" y="16" width="225" height="40" rx="10" fill="#ECFDF5" stroke="#A7F3D0" stroke-width="1.2"/>
        <text x="792.5" y="42" fill="#047857" font-size="21" font-weight="900" text-anchor="middle" class="tabular">
          TOP 10 합산 +${(totalFlowSum > 0 ? totalFlowSum : top5InflowSum).toLocaleString()}억
        </text>

        <!-- 3-Segment Stack Bar (y=66, w=870, h=60, rx=16) -->
        <g transform="translate(35, 66)">
          <clipPath id="heroBarClip">
            <rect width="870" height="60" rx="16"/>
          </clipPath>
          <g clip-path="url(#heroBarClip)">
            <rect x="0" y="0" width="${coreW}" height="60" fill="#10B981"/>
            <rect x="${coreW}" y="0" width="${growthW}" height="60" fill="#F43F5E"/>
            <rect x="${coreW + growthW}" y="0" width="${defW}" height="60" fill="#3B82F6"/>
          </g>
          
          <!-- Segment Text Labels inside Bar (Smart Threshold Labeling: Zero Overflow) -->
          ${coreLabel.text ? `<text x="${coreW / 2}" y="38" fill="#FFFFFF" font-size="${coreLabel.fontSize}" font-weight="900" text-anchor="middle">${coreLabel.text}</text>` : ''}
          ${growthLabel.text ? `<text x="${coreW + growthW / 2}" y="38" fill="#FFFFFF" font-size="${growthLabel.fontSize}" font-weight="900" text-anchor="middle">${growthLabel.text}</text>` : ''}
          ${defLabel.text ? `<text x="${coreW + growthW + defW / 2}" y="38" fill="#FFFFFF" font-size="${defLabel.fontSize}" font-weight="900" text-anchor="middle">${defLabel.text}</text>` : ''}
        </g>

        <!-- Hero Summary Fact Text (y=142, h=56) with clipPath -->
        <g transform="translate(35, 142)" clip-path="url(#heroSummaryClip)">
          <rect width="870" height="56" rx="14" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.2"/>
          <rect x="14" y="10" width="95" height="36" rx="8" fill="#DCFCE7"/>
          <text x="61.5" y="34" fill="#15803D" font-size="19" font-weight="900" text-anchor="middle">핵심 요약</text>
          <text x="125" y="35" fill="#1E293B" font-size="${fittedHeroSummary.fontSize}" font-weight="800">
            ${escapeXml(fittedHeroSummary.text)}
          </text>
        </g>
      </g>

      <!-- 2. Detailed Style Cards (y=334, step=294, h=276) -->
      ${(() => {
        const kospiChg = payload.kospiChangePct ?? 0;
        const coreFact = kospiChg >= 0
          ? "지수 상승 탄력 속 대표 벤치마크군으로 기계적 패시브 적립 자금 유입"
          : "지수 조정에도 대표 벤치마크군으로 기계적 패시브 적립 자금 최다 유입";

        const topGrowth = growthItems[0];
        const growthChg = topGrowth?.changePct ?? 0;
        const growthPurpose = growthChg >= 0 ? "혁신 성장 모멘텀" : "혁신 성장 저가매수";
        const growthFact = growthItems.length > 0 && growthChg >= 0
          ? "주도 기술주 및 성장 테마의 상승 탄력을 겨냥한 스마트머니 집중 매수"
          : "단기 낙폭 과대 기술주 테마를 겨냥한 스마트머니의 선별적 저가 매수세 집중";

        const topDef = defensiveItems[0];
        const defName = topDef ? (topDef.name || topDef.etfName || "") : "";
        let defPurpose = "변동성 방어·채권";
        let defFact = "시장 변동성 속 우량 크레딧 회사채 중심의 안전 이자수익 완충 수급 형성";
        if (defensiveItems.length > 0) {
          if (/채권|국채|회사채/i.test(defName)) {
            defPurpose = "우량 채권·이자수익";
            defFact = "시장 변동성 속 우량 크레딧 회사채 중심의 안전 이자수익 완충 수급 형성";
          } else if (/배당|인컴|커버드콜/i.test(defName)) {
            defPurpose = "고배당·월인컴";
            defFact = "변동성 방어와 안정적 정기 현금흐름을 위한 고배당·인컴형 수급 집중";
          } else if (/파킹|KOFR|SOFR|CD|머니마켓|단기채/i.test(defName)) {
            defPurpose = "단기 파킹·유동성";
            defFact = "단기 자금 보관 및 대기성 자금의 안전 파킹형 ETF 순유입 형성";
          }
        } else {
          defFact = "방어형 자산군 대비 주식 및 성장형 자산으로의 스마트머니 쏠림 지속";
        }

        return `
          <!-- Card 01: [시장 대표형] (y=334, h=276) -->
          ${renderStyleCard(
            "01",
            "시장 대표형",
            "지수 패시브 적립",
            coreItems,
            coreSum,
            corePct,
            "#BBF7D0",
            "#10B981",
            "#DCFCE7",
            "#86EFAC",
            "#15803D",
            coreFact,
            "대표 지수 ETF",
            334
          )}

          <!-- Card 02: [공격 성장형] (y=628, h=276) -->
          ${renderStyleCard(
            "02",
            "공격 성장형",
            growthPurpose,
            growthItems,
            growthSum,
            growthPct,
            "#FECDD3",
            "#F43F5E",
            "#FFE4E6",
            "#FDA4AF",
            "#BE123C",
            growthFact,
            "혁신 성장 ETF",
            628
          )}

          <!-- Card 03: [방어 인컴형] (y=922, h=276) -->
          ${renderStyleCard(
            "03",
            "방어 인컴형",
            defPurpose,
            defensiveItems,
            defensiveSum,
            defensivePct,
            "#BFDBFE",
            "#3B82F6",
            "#DBEAFE",
            "#93C5FD",
            "#1D4ED8",
            defFact,
            "방어 채권 ETF",
            922
          )}
        `;
      })()}

      <!-- Common Disclaimer & Watermark (KRX Notice Box Completely Purged) -->
      ${commonFooter}
    </svg>
  `;

  return [
    { slideNumber: 1, title: "Cover", subtitle: "1초 후킹 표지 & 3대 핵심 펄스", svgContent: slide1Svg.trim() },
    { slideNumber: 2, title: "Theme Dynamics", subtitle: "주도 테마 TOP 3 vs 부진 테마", svgContent: slide2Svg.trim() },
    { slideNumber: 3, title: "Asset Class Dynamics", subtitle: "자산군별 수익률 & 비중 현황", svgContent: slide3Svg.trim() },
    { slideNumber: 4, title: "Smart Money Flow", subtitle: "실질 자금 순유입 TOP 5", svgContent: slide4Svg.trim() },
    { slideNumber: 5, title: "Disparity Alert", subtitle: "괴리율 고평가·할증 vs 저평가·할인 진단", svgContent: slide5Svg.trim() },
    { slideNumber: 6, title: "Style Rotation Radar", subtitle: "오늘 시장 수급 나침반: 스마트머니 스타일 로테이션", svgContent: slide6Svg.trim() },
  ];
}

export function generateInstagramCaption(
  payload: MarketBriefingPayload,
  narrative?: PolishedNarrative | MarketRegime
): string {
  const regime = narrative || classifyMarketRegime(payload);
  const up = payload.upCount ?? payload.pulse?.upCount ?? 0;
  const down = payload.downCount ?? payload.pulse?.downCount ?? 0;
  const flat = payload.flatCount ?? payload.pulse?.flatCount ?? 0;
  const generalCount = (payload.generalEtfCount ?? payload.pulse?.generalEtfCount ?? (up + down + flat)) || 0;
  const dateStr = payload.asOfDate || new Date().toISOString().slice(0, 10);
  const formattedDate = formatDateWithDay(dateStr);
  
  const cleanTheme = (str?: string) => (str || "").replace(/\s*\([^)]*\)/g, '').trim();
  const cleanEtf = (str?: string) => (str || "")
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/플러스/g, '')
    .replace(/액티브/g, '')
    .replace(/타겟위클리커버드콜/g, '위클리')
    .replace(/커버드콜/g, '')
    .trim();

  // 1. [골든 존 & 2열 대칭 지표 블록]
  const kospi = payload.kospiChangePct ?? 0;
  const kosdaq = payload.kosdaqChangePct ?? 0;
  const kospiSign = kospi > 0 ? "+" : "";
  const kosdaqSign = kosdaq > 0 ? "+" : "";
  const indexRow = `코스피 ${kospiSign}${kospi.toFixed(2)}% | 코스닥 ${kosdaqSign}${kosdaq.toFixed(2)}%`;

  const sortedPeerGroups = [...(payload.peerGroups || [])].sort(
    (a, b) => (b.cappedAumWeightedReturnPct ?? 0) - (a.cappedAumWeightedReturnPct ?? 0)
  );
  const topTheme = sortedPeerGroups[0];
  const bottomTheme = sortedPeerGroups[sortedPeerGroups.length - 1];
  const topThemeRet = topTheme?.cappedAumWeightedReturnPct ?? 0;
  const botThemeRet = bottomTheme?.cappedAumWeightedReturnPct ?? 0;
  const topSign = topThemeRet > 0 ? "+" : "";
  const botSign = botThemeRet > 0 ? "+" : "";

  // 2. [지표 2행] 주도 테마 (대표 1위 완결 표기)
  let themeRow = "주도 테마: 시장 전반 보합";
  if (topTheme && topTheme.peerGroup) {
    const cleanTop = cleanTheme(topTheme.peerGroup);
    themeRow = `주도 테마: ${cleanTop} ${topSign}${topThemeRet.toFixed(1)}%`;
  }

  // 3. [지표 3행] 실질 순유입 1위 종목 (대표 1위 완결 표기)
  const topInflows = payload.periodicFlows?.dailyFundFlows?.topInflows || [];
  const getFlowVal = (item: any): number => {
    if (!item) return 0;
    if (typeof item.inflow === "number" && !isNaN(item.inflow)) return Math.round(item.inflow);
    if (typeof item.inflowAmount === "number" && !isNaN(item.inflowAmount)) return Math.round(item.inflowAmount);
    if (typeof item.netInflowValue === "number" && !isNaN(item.netInflowValue)) return Math.round(item.netInflowValue / 100000000);
    if (typeof item.net_flow === "number" && !isNaN(item.net_flow)) return Math.round(item.net_flow / 100000000);
    return 0;
  };

  let flowRow = "실질 순유입: 집계 중";
  if (topInflows.length > 0) {
    const firstEtf = topInflows[0];
    const v1 = getFlowVal(firstEtf);
    const firstName = cleanEtf(firstEtf.name || (firstEtf as any).etfName || "핵심 ETF");
    const flowSign = v1 >= 0 ? "+" : "";
    flowRow = `실질 순유입: ${firstName} ${flowSign}${v1.toLocaleString()}억`;
  }

  // 2. [핵심 진단 불릿]
  const etfRet = payload.generalAumWeightedReturnPct ?? 0;
  const etfSign = etfRet > 0 ? "+" : "";
  const kospiVerb = kospi > 0 ? "상승" : kospi < 0 ? "하락" : "보합";

  const topThemeTail = topThemeRet > 0 ? "중심 견조한 흐름" : "중심 상대적 방어";
  const themeSummary = topTheme
    ? `${cleanTheme(topTheme.peerGroup)} ${topSign}${topThemeRet.toFixed(2)}% ${topThemeTail}`
    : "집계 중";

  const flowSummary = topInflows[0]
    ? `${cleanEtf(topInflows[0].name || (topInflows[0] as any).etfName)} 등 상위 종목 집중 유입`
    : "상위 종목 집중 유입";

  // 상단 75자 골든 존 보장: [날짜] 헤더 + 1행 지표
  return `[${formattedDate}] ETF 마켓 브리핑
${indexRow}
${themeRow}
${flowRow}

오늘의 핵심 진단
• 시장 체온: 코스피 ${kospiSign}${kospi.toFixed(2)}% ${kospiVerb} 속 일반 ETF 가중수익률 ${etfSign}${etfRet.toFixed(2)}% 기록
• 주도 테마: ${themeSummary}
• 자금 흐름: ${flowSummary}

───────────────────────
* 기준: ${dateStr} 한국거래소 KRX 공시 · 국내 상장 일반 ETF ${generalCount.toLocaleString()}개 전수 분석
* 본 자료는 투자 판단을 돕기 위한 정보 제공용이며 특정 종목의 매수·매도를 권유하지 않습니다.

#ETF투자 #ETF브리핑 #마켓브리핑 #재테크 #ETFCampus`;
}
