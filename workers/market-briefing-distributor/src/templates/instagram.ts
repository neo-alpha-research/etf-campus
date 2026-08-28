import type { MarketBriefingPayload } from "../types";

export interface InstagramSlide {
  slideNumber: number;
  title: string;
  subtitle: string;
  svgContent: string;
}

export function generateInstagramCarousel(payload: MarketBriefingPayload, baseUrl: string): InstagramSlide[] {
  const dateStr = payload.asOfDate || "2026-08-27";
  const formattedDate = dateStr.replace(/-/g, ".");
  const temp = payload.marketTemperature || "혼조";
  const kospiChange = payload.kospiChangePct ?? 0;
  const kospiColor = kospiChange > 0 ? "#D92D20" : kospiChange < 0 ? "#175CD3" : "#737373";
  const kospiSign = kospiChange > 0 ? "+" : "";
  const kosdaqChange = payload.kosdaqChangePct ?? 0;
  const kosdaqColor = kosdaqChange > 0 ? "#D92D20" : kosdaqChange < 0 ? "#175CD3" : "#737373";
  const kosdaqSign = kosdaqChange > 0 ? "+" : "";

  const aumJo = ((payload.generalTotalAum || 3851607) / 10000).toFixed(1);
  const tradeJo = ((payload.generalTotalTradeValue || 99147) / 10000).toFixed(1);

  const up = payload.upCount || 0;
  const flat = payload.flatCount || 0;
  const down = payload.downCount || 0;
  const total = up + flat + down || 1;
  const upPct = ((up / total) * 100).toFixed(1);
  const downPct = ((down / total) * 100).toFixed(1);

  const topInflows = payload.periodicFlows?.dailyFundFlows?.topInflows?.slice(0, 5) || [];
  const weeklyInflows = payload.periodicFlows?.weeklyFundFlows?.topInflows?.slice(0, 5) || [];
  const peerGroups = payload.peerGroups || [];
  const sortedPeers = [...peerGroups].sort((a, b) => b.cappedAumWeightedReturnPct - a.cappedAumWeightedReturnPct);
  const bestPeers = sortedPeers.slice(0, 3);
  const worstPeers = sortedPeers.slice(-3).reverse();

  // SVG Base Style
  const baseStyle = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Pretendard:wght@400;600;700;800;900&amp;display=swap');
      * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
      .tabular { font-variant-numeric: tabular-nums; }
    </style>
  `;

  const disclaimer = "본 자료는 정보 제공 목적이며 투자 권유가 아닙니다. 투자 원금 손실 위험이 있으며 최종 책임은 투자자 본인에게 있습니다.";

  // Slide 1: Cover
  const slide1Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${baseStyle}
      <rect width="1080" height="1350" fill="#0A0F1D"/>
      <circle cx="540" cy="300" r="400" fill="#2E6819" fill-opacity="0.15" filter="blur(100px)"/>
      <circle cx="900" cy="1000" r="350" fill="#0284C7" fill-opacity="0.1" filter="blur(90px)"/>
      
      <!-- Top Brand -->
      <rect x="80" y="80" width="220" height="44" rx="22" fill="#1E293B"/>
      <text x="190" y="108" fill="#4ADE80" font-size="20" font-weight="800" text-anchor="middle" letter-spacing="1">ETF CAMPUS</text>
      <text x="1000" y="108" fill="#94A3B8" font-size="24" font-weight="700" text-anchor="end" class="tabular">${formattedDate} 마켓 브리핑</text>

      <!-- Main Headline -->
      <text x="80" y="240" fill="#FFFFFF" font-size="64" font-weight="900" line-height="1.2">오늘 대한민국 ETF</text>
      <text x="80" y="320" fill="#4ADE80" font-size="64" font-weight="900">시장 체온: ${temp}</text>
      
      <!-- Narrative Quote Box -->
      <rect x="80" y="380" width="920" height="180" rx="24" fill="#1E293B" fill-opacity="0.7" stroke="#334155" stroke-width="2"/>
      <text x="120" y="440" fill="#F8FAFC" font-size="30" font-weight="700">" ${payload.headlineText ? payload.headlineText.slice(0, 36) + '...' : '지수 방어력 우위 속 실질 진성수급 유입 지속'} "</text>
      <text x="120" y="500" fill="#94A3B8" font-size="22" font-weight="500">총 운용자산 ${aumJo}조원 · 일 거래대금 ${tradeJo}조원 (${up}종목 상승 / ${down}종목 하락)</text>

      <!-- Market Indices Cards -->
      <rect x="80" y="600" width="440" height="220" rx="24" fill="#111827" stroke="#1F2937" stroke-width="2"/>
      <text x="120" y="660" fill="#9CA3AF" font-size="24" font-weight="700">KOSPI</text>
      <text x="120" y="730" fill="#FFFFFF" font-size="48" font-weight="900" class="tabular">${(payload.kospiClose || 0).toLocaleString()}</text>
      <text x="120" y="780" fill="${kospiColor}" font-size="28" font-weight="800" class="tabular">${kospiSign}${(payload.kospiChangePct || 0).toFixed(2)}%</text>

      <rect x="560" y="600" width="440" height="220" rx="24" fill="#111827" stroke="#1F2937" stroke-width="2"/>
      <text x="600" y="660" fill="#9CA3AF" font-size="24" font-weight="700">KOSDAQ</text>
      <text x="600" y="730" fill="#FFFFFF" font-size="48" font-weight="900" class="tabular">${(payload.kosdaqClose || 0).toLocaleString()}</text>
      <text x="600" y="780" fill="${kosdaqColor}" font-size="28" font-weight="800" class="tabular">${kosdaqSign}${(payload.kosdaqChangePct || 0).toFixed(2)}%</text>

      <!-- Bottom Hook Indicator -->
      <rect x="80" y="860" width="920" height="340" rx="28" fill="#1E293B" stroke="#2E6819" stroke-width="3"/>
      <text x="130" y="930" fill="#4ADE80" font-size="26" font-weight="800">🔍 오늘 장 핵심 관전 포인트</text>
      <text x="130" y="990" fill="#FFFFFF" font-size="32" font-weight="800">• 스마트머니가 가장 많이 쓸어담은 테마는?</text>
      <text x="130" y="1050" fill="#FFFFFF" font-size="32" font-weight="800">• 62개 세부 테마 중 롱숏 1위 vs 꼴찌 격차</text>
      <text x="130" y="1110" fill="#FFFFFF" font-size="32" font-weight="800">• AUM 브릿지: 주가 하락 vs 신규 자금 유입</text>
      <text x="540" y="1160" fill="#94A3B8" font-size="22" font-weight="600" text-anchor="middle">옆으로 넘겨서 3초 만에 확인하기 👉 (1/6)</text>

      <!-- Hardcoded Disclaimer -->
      <rect x="0" y="1270" width="1080" height="80" fill="#030712"/>
      <text x="540" y="1320" fill="#6B7280" font-size="18" font-weight="500" text-anchor="middle">${disclaimer}</text>
    </svg>
  `;

  // Slide 2: Market Breadth Heatmap
  const slide2Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${baseStyle}
      <rect width="1080" height="1350" fill="#0A0F1D"/>
      
      <!-- Header -->
      <text x="80" y="120" fill="#4ADE80" font-size="24" font-weight="800">STEP 2. MARKET BREADTH</text>
      <text x="80" y="180" fill="#FFFFFF" font-size="52" font-weight="900">시장 체온 및 상승/하락 비율</text>

      <!-- Ratio Bar -->
      <rect x="80" y="240" width="920" height="80" rx="20" fill="#1E293B"/>
      <rect x="80" y="240" width="${Math.max(40, (up / total) * 920)}" height="80" rx="20" fill="#D92D20"/>
      <text x="110" y="290" fill="#FFFFFF" font-size="28" font-weight="900" class="tabular">상승 ${up} (${upPct}%)</text>
      <text x="960" y="290" fill="#FFFFFF" font-size="28" font-weight="900" text-anchor="end" class="tabular">하락 ${down} (${downPct}%)</text>

      <!-- Heatmap Summary Matrix -->
      <text x="80" y="380" fill="#F8FAFC" font-size="34" font-weight="800">📊 7대 자산군 당일 성과 히트맵</text>
      
      ${payload.assetClasses.slice(0, 6).map((ac, i) => {
        const row = Math.floor(i / 2);
        const col = i % 2;
        const x = 80 + col * 480;
        const y = 420 + row * 180;
        const ret = ac.aumWeightedReturnPct || 0;
        const isUp = ret > 0;
        const cardBg = isUp ? "#450A0A" : ret < 0 ? "#082F49" : "#1E293B";
        const strokeCol = isUp ? "#991B1B" : ret < 0 ? "#0369A1" : "#334155";
        const valCol = isUp ? "#F87171" : ret < 0 ? "#38BDF8" : "#94A3B8";

        return `
          <g transform="translate(${x}, ${y})">
            <rect width="440" height="150" rx="20" fill="${cardBg}" stroke="${strokeCol}" stroke-width="2"/>
            <text x="30" y="50" fill="#FFFFFF" font-size="26" font-weight="800">${ac.assetClass}</text>
            <text x="30" y="90" fill="#94A3B8" font-size="20" font-weight="600">${ac.etfCount}개 종목 · AUM ${((ac.totalAum || 0)/10000).toFixed(1)}조</text>
            <text x="410" y="110" fill="${valCol}" font-size="36" font-weight="900" text-anchor="end" class="tabular">${ret > 0 ? '+' : ''}${ret.toFixed(2)}%</text>
          </g>
        `;
      }).join("")}

      <!-- Bottom Tip -->
      <rect x="80" y="1040" width="920" height="180" rx="24" fill="#111827" stroke="#1F2937" stroke-width="2"/>
      <text x="120" y="1100" fill="#4ADE80" font-size="24" font-weight="800">💡 펀드 애널리스트 한줄 뷰</text>
      <text x="120" y="1150" fill="#E2E8F0" font-size="26" font-weight="600">Top 50 대형 ETF 가중 수익률이 중소형 대비 견고한 방어력을 보였습니다.</text>
      <text x="960" y="1190" fill="#64748B" font-size="20" font-weight="600" text-anchor="end">(2/6)</text>

      <rect x="0" y="1270" width="1080" height="80" fill="#030712"/>
      <text x="540" y="1320" fill="#6B7280" font-size="18" font-weight="500" text-anchor="middle">${disclaimer}</text>
    </svg>
  `;

  // Slide 3: Theme Long/Short Battle
  const slide3Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${baseStyle}
      <rect width="1080" height="1350" fill="#0A0F1D"/>
      
      <!-- Header -->
      <text x="80" y="120" fill="#4ADE80" font-size="24" font-weight="800">STEP 3. THEME BATTLE</text>
      <text x="80" y="180" fill="#FFFFFF" font-size="52" font-weight="900">오늘의 롱숏 테마 랭킹</text>

      <!-- TOP 3 Best Themes -->
      <text x="80" y="260" fill="#F87171" font-size="30" font-weight="900">🔥 당일 최고 상승 테마 TOP 3</text>
      ${bestPeers.map((p, i) => `
        <g transform="translate(80, ${300 + i * 130})">
          <rect width="920" height="110" rx="20" fill="#18181B" stroke="#7F1D1D" stroke-width="2"/>
          <text x="30" y="65" fill="#EF4444" font-size="32" font-weight="900">0${i + 1}</text>
          <text x="90" y="55" fill="#FFFFFF" font-size="28" font-weight="800">${p.peerGroup}</text>
          <text x="90" y="90" fill="#9CA3AF" font-size="20" font-weight="600">${p.assetClass} · ${p.etfCount}개 종목</text>
          <text x="880" y="70" fill="#EF4444" font-size="36" font-weight="900" text-anchor="end" class="tabular">+${p.cappedAumWeightedReturnPct.toFixed(2)}%</text>
        </g>
      `).join("")}

      <!-- TOP 3 Worst Themes -->
      <text x="80" y="740" fill="#38BDF8" font-size="30" font-weight="900">❄️ 당일 최다 하락 테마 TOP 3</text>
      ${worstPeers.map((p, i) => `
        <g transform="translate(80, ${780 + i * 130})">
          <rect width="920" height="110" rx="20" fill="#18181B" stroke="#0C4A6E" stroke-width="2"/>
          <text x="30" y="65" fill="#38BDF8" font-size="32" font-weight="900">0${i + 1}</text>
          <text x="90" y="55" fill="#FFFFFF" font-size="28" font-weight="800">${p.peerGroup}</text>
          <text x="90" y="90" fill="#9CA3AF" font-size="20" font-weight="600">${p.assetClass} · ${p.etfCount}개 종목</text>
          <text x="880" y="70" fill="#38BDF8" font-size="36" font-weight="900" text-anchor="end" class="tabular">${p.cappedAumWeightedReturnPct.toFixed(2)}%</text>
        </g>
      `).join("")}

      <text x="960" y="1220" fill="#64748B" font-size="20" font-weight="600" text-anchor="end">(3/6)</text>
      <rect x="0" y="1270" width="1080" height="80" fill="#030712"/>
      <text x="540" y="1320" fill="#6B7280" font-size="18" font-weight="500" text-anchor="middle">${disclaimer}</text>
    </svg>
  `;

  // Slide 4: Smart Money Inflow TOP 5
  const slide4Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${baseStyle}
      <rect width="1080" height="1350" fill="#0A0F1D"/>
      
      <!-- Header -->
      <text x="80" y="120" fill="#4ADE80" font-size="24" font-weight="800">STEP 4. SMART MONEY FLOW</text>
      <text x="80" y="180" fill="#FFFFFF" font-size="52" font-weight="900">당일 스마트머니 순유입 TOP 5</text>

      <!-- Table Header -->
      <rect x="80" y="240" width="920" height="50" rx="12" fill="#1E293B"/>
      <text x="120" y="272" fill="#94A3B8" font-size="20" font-weight="700">순위 / 종목명</text>
      <text x="700" y="272" fill="#94A3B8" font-size="20" font-weight="700" text-anchor="end">실질 순유입액</text>
      <text x="960" y="272" fill="#94A3B8" font-size="20" font-weight="700" text-anchor="end">당일 등락률</text>

      <!-- Top 5 List -->
      ${topInflows.map((item, i) => {
        const ret = item.changePct ?? 0;
        const isUp = ret > 0;
        const retCol = isUp ? "#F87171" : ret < 0 ? "#38BDF8" : "#94A3B8";

        return `
          <g transform="translate(80, ${310 + i * 160})">
            <rect width="920" height="140" rx="20" fill="#111827" stroke="#1F2937" stroke-width="2"/>
            <circle cx="50" cy="70" r="28" fill="#1E293B"/>
            <text x="50" y="78" fill="#4ADE80" font-size="24" font-weight="900" text-anchor="middle">${i + 1}</text>
            <text x="100" y="55" fill="#FFFFFF" font-size="28" font-weight="800">${item.name?.slice(0, 18)}</text>
            <text x="100" y="95" fill="#64748B" font-size="20" font-weight="600" class="tabular">${item.ticker} · ${item.theme || item.assetClass || '일반'}</text>
            <text x="700" y="78" fill="#F8FAFC" font-size="32" font-weight="900" text-anchor="end" class="tabular">+${((item.inflow || item.inflowAmount || 0)).toLocaleString()}억원</text>
            <text x="960" y="78" fill="${retCol}" font-size="28" font-weight="800" text-anchor="end" class="tabular">${isUp ? '+' : ''}${ret.toFixed(2)}%</text>
          </g>
        `;
      }).join("")}

      <text x="960" y="1220" fill="#64748B" font-size="20" font-weight="600" text-anchor="end">(4/6)</text>
      <rect x="0" y="1270" width="1080" height="80" fill="#030712"/>
      <text x="540" y="1320" fill="#6B7280" font-size="18" font-weight="500" text-anchor="middle">${disclaimer}</text>
    </svg>
  `;

  // Slide 5: 5-Day Cumulative Inflow Trend
  const slide5Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${baseStyle}
      <rect width="1080" height="1350" fill="#0A0F1D"/>
      
      <!-- Header -->
      <text x="80" y="120" fill="#4ADE80" font-size="24" font-weight="800">STEP 5. 5-DAY CUMULATIVE FLOW</text>
      <text x="80" y="180" fill="#FFFFFF" font-size="52" font-weight="900">최근 5일간 누적 순유입 TOP 5</text>

      ${weeklyInflows.map((item, i) => `
        <g transform="translate(80, ${260 + i * 170})">
          <rect width="920" height="145" rx="20" fill="#18181B" stroke="#27272A" stroke-width="2"/>
          <text x="40" y="60" fill="#38BDF8" font-size="32" font-weight="900">TOP 0${i + 1}</text>
          <text x="180" y="55" fill="#FFFFFF" font-size="28" font-weight="800">${item.name?.slice(0, 18)}</text>
          <text x="180" y="95" fill="#71717A" font-size="20" font-weight="600" class="tabular">${item.ticker} · 5일간 지속 순매수</text>
          <text x="880" y="80" fill="#38BDF8" font-size="34" font-weight="900" text-anchor="end" class="tabular">+${((item.inflow || item.inflowAmount || 0)).toLocaleString()}억원</text>
        </g>
      `).join("")}

      <!-- Narrative callout -->
      <rect x="80" y="1130" width="920" height="90" rx="20" fill="#1E293B"/>
      <text x="120" y="1185" fill="#E2E8F0" font-size="22" font-weight="600">💡 1회성 반짝 매수가 아닌, 기관의 연속 매집 테마를 주목하세요.</text>
      <text x="960" y="1220" fill="#64748B" font-size="20" font-weight="600" text-anchor="end">(5/6)</text>

      <rect x="0" y="1270" width="1080" height="80" fill="#030712"/>
      <text x="540" y="1320" fill="#6B7280" font-size="18" font-weight="500" text-anchor="middle">${disclaimer}</text>
    </svg>
  `;

  // Slide 6: Outro & Call to Action
  const slide6Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${baseStyle}
      <rect width="1080" height="1350" fill="#0A0F1D"/>
      <circle cx="540" cy="500" r="350" fill="#2E6819" fill-opacity="0.2" filter="blur(120px)"/>
      
      <!-- Logo & Title -->
      <rect x="440" y="150" width="200" height="48" rx="24" fill="#1E293B"/>
      <text x="540" y="182" fill="#4ADE80" font-size="22" font-weight="800" text-anchor="middle">ETF CAMPUS</text>
      
      <text x="540" y="320" fill="#FFFFFF" font-size="56" font-weight="900" text-anchor="middle">내 보유 ETF는</text>
      <text x="540" y="390" fill="#FFFFFF" font-size="56" font-weight="900" text-anchor="middle">오늘 시장을 이겼을까?</text>

      <!-- Feature Grid -->
      <rect x="80" y="470" width="920" height="420" rx="32" fill="#111827" stroke="#1F2937" stroke-width="2"/>
      <text x="140" y="550" fill="#4ADE80" font-size="30" font-weight="800">🌐 ETF 캠퍼스 웹 풀버전에서 무료 확인</text>
      <text x="140" y="620" fill="#E2E8F0" font-size="28" font-weight="600">✓ 62개 피어그룹 인터랙티브 롱숏 맵</text>
      <text x="140" y="680" fill="#E2E8F0" font-size="28" font-weight="600">✓ 5개 시점(일/주/월/연) AUM 브릿지 주가/수급 분해</text>
      <text x="140" y="740" fill="#E2E8F0" font-size="28" font-weight="600">✓ 1,164개 전 종목 실시간 괴리율 & 거래대금 랭킹</text>
      <text x="140" y="820" fill="#38BDF8" font-size="24" font-weight="700">👉 프로필 링크 클릭: etf-campus.pages.dev/briefing</text>

      <!-- Save & Share Action Box -->
      <rect x="80" y="930" width="920" height="240" rx="28" fill="#1E293B" stroke="#334155" stroke-width="2"/>
      <text x="540" y="1010" fill="#F8FAFC" font-size="32" font-weight="800" text-anchor="middle">📌 매일 장마감 후 15:40 업데이트</text>
      <text x="540" y="1060" fill="#94A3B8" font-size="24" font-weight="600" text-anchor="middle">피드를 [저장(Save)]해 두고 퇴근길에 꺼내보세요!</text>
      <text x="540" y="1120" fill="#4ADE80" font-size="26" font-weight="800" text-anchor="middle">@etf.campus 팔로우하고 매일 시황 받아보기</text>

      <text x="960" y="1220" fill="#64748B" font-size="20" font-weight="600" text-anchor="end">(6/6)</text>
      <rect x="0" y="1270" width="1080" height="80" fill="#030712"/>
      <text x="540" y="1320" fill="#6B7280" font-size="18" font-weight="500" text-anchor="middle">${disclaimer}</text>
    </svg>
  `;

  return [
    { slideNumber: 1, title: "Cover", subtitle: "오늘의 시장 체온계", svgContent: slide1Svg },
    { slideNumber: 2, title: "Market Breadth", subtitle: "상승/하락 및 7대 자산군", svgContent: slide2Svg },
    { slideNumber: 3, title: "Theme Battle", subtitle: "테마 롱숏 랭킹", svgContent: slide3Svg },
    { slideNumber: 4, title: "Smart Money", subtitle: "당일 순유입 TOP 5", svgContent: slide4Svg },
    { slideNumber: 5, title: "5-Day Flow", subtitle: "5일 누적 순유입 상위", svgContent: slide5Svg },
    { slideNumber: 6, title: "Outro & CTA", subtitle: "풀버전 브리핑 확인", svgContent: slide6Svg },
  ];
}
