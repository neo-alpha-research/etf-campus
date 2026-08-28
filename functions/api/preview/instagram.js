const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-cache",
};

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const targetDate = url.searchParams.get("date") || "2026-08-27";
  const slideParam = url.searchParams.get("slide") || "1";

  let briefing = null;
  if (env.ETF_PRICES) {
    briefing = await env.ETF_PRICES.prepare(
      `SELECT * FROM market_briefings WHERE as_of_date = ? OR as_of_date <= ? ORDER BY as_of_date DESC LIMIT 1`
    ).bind(targetDate, targetDate).first();
  }

  const asOfDate = briefing?.as_of_date || targetDate;
  const formattedDate = asOfDate.replace(/-/g, ".");
  const temp = briefing?.market_temperature || "상승 우세";
  const kospiClose = briefing?.kospi_close || 3185.42;
  const kospiChangePct = briefing?.kospi_change_pct ?? 1.07;
  const kosdaqClose = briefing?.kosdaq_close || 837.65;
  const kosdaqChangePct = briefing?.kosdaq_change_pct ?? 1.30;

  const kospiColor = kospiChangePct > 0 ? "#D92D20" : kospiChangePct < 0 ? "#175CD3" : "#64748B";
  const kospiSign = kospiChangePct > 0 ? "+" : "";
  const kosdaqColor = kosdaqChangePct > 0 ? "#D92D20" : kosdaqChangePct < 0 ? "#175CD3" : "#64748B";
  const kosdaqSign = kosdaqChangePct > 0 ? "+" : "";

  const aumEok = briefing?.general_total_aum ? Math.round(briefing.general_total_aum / 100000000) : 3851607;
  const tradeEok = briefing?.general_total_trade_value ? Math.round(briefing.general_total_trade_value / 100000000) : 99147;
  const aumJo = (aumEok / 10000).toFixed(1);
  const tradeJo = (tradeEok / 10000).toFixed(1);

  const up = briefing?.up_count || 642;
  const flat = briefing?.flat_count || 88;
  const down = briefing?.down_count || 288;
  const total = up + flat + down || 1018;
  const upPct = ((up / total) * 100).toFixed(1);
  const downPct = ((down / total) * 100).toFixed(1);

  // 1. Premium Editorial Light Theme Defs (토스/애플 스타일 오프화이트 & 클린 섀도우)
  const baseDefs = `
    <defs>
      <filter id="softShadow" x="-10%" y="-10%" width="120%" height="125%">
        <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#0F172A" flood-opacity="0.06"/>
      </filter>
      <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="125%">
        <feDropShadow dx="0" dy="4" stdDeviation="10" flood-color="#0F172A" flood-opacity="0.04"/>
      </filter>
      <linearGradient id="blueBadgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#EFF6FF"/>
        <stop offset="100%" stop-color="#DBEAFE"/>
      </linearGradient>
      <linearGradient id="primaryCtaGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#1D4ED8"/>
        <stop offset="100%" stop-color="#2563EB"/>
      </linearGradient>
      <linearGradient id="redBadgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FEF2F2"/>
        <stop offset="100%" stop-color="#FEE2E2"/>
      </linearGradient>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Pretendard:wght@400;500;600;700;800;900&amp;display=swap');
        * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .tabular { font-variant-numeric: tabular-nums; letter-spacing: -0.5px; }
      </style>
    </defs>
  `;

  const disclaimer = "* 본 자료는 투자 판단을 돕기 위한 정보 제공용이며, 특정 종목의 매수·매도를 권유하지 않습니다.";

  // Slide 1: Cover (스크롤을 0.7초 만에 멈추는 강력한 대조/호기심 훅)
  const slide1Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${baseDefs}
      <!-- Background: Clean Premium Off-White -->
      <rect width="1080" height="1350" fill="#F8FAFC"/>
      
      <!-- Subtle Decorative Top-Right Blob -->
      <circle cx="950" cy="180" r="280" fill="#E2E8F0" fill-opacity="0.5" filter="blur(60px)"/>
      <circle cx="150" cy="1150" r="320" fill="#DBEAFE" fill-opacity="0.4" filter="blur(80px)"/>

      <!-- Header Badge & Date -->
      <g transform="translate(80, 90)">
        <rect width="310" height="48" rx="24" fill="url(#blueBadgeGrad)" stroke="#BFDBFE" stroke-width="1.5"/>
        <circle cx="26" cy="24" r="6" fill="#1D4ED8"/>
        <text x="44" y="31" fill="#1D4ED8" font-size="20" font-weight="800" letter-spacing="0.5">DAILY MARKET PULSE</text>
        <text x="920" y="32" fill="#64748B" font-size="24" font-weight="700" text-anchor="end" class="tabular">${formattedDate} 마켓 브리핑</text>
      </g>

      <!-- 1초 스크롤 스토퍼 메인 헤드라인 (대형 타이포그래피 위계) -->
      <g transform="translate(80, 230)">
        <text x="0" y="50" fill="#475569" font-size="34" font-weight="700" letter-spacing="-0.5">8월 27일 반도체 조정장,</text>
        <text x="0" y="145" fill="#0F172A" font-size="72" font-weight="900" letter-spacing="-1.5">개미는 던지고 기관이</text>
        <text x="0" y="240" fill="#1D4ED8" font-size="72" font-weight="900" letter-spacing="-1.5">4,250억 쓸어담은 ETF</text>
        <text x="0" y="320" fill="#0F172A" font-size="72" font-weight="900" letter-spacing="-1.5">의 정체는? 🔍</text>
      </g>

      <!-- Main Focus Card (화이트 카드 레이어 & 섀도우) -->
      <g transform="translate(80, 640)" filter="url(#softShadow)">
        <rect width="920" height="340" rx="28" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
        
        <!-- Market Pulse Tag -->
        <rect x="40" y="40" width="160" height="38" rx="19" fill="#DCFCE7"/>
        <text x="120" y="65" fill="#15803D" font-size="19" font-weight="800" text-anchor="middle">오늘 시장 체온</text>
        <text x="220" y="68" fill="#0F172A" font-size="28" font-weight="900">${temp} <tspan font-size="22" font-weight="600" fill="#64748B">(${up}종목 상승 / ${down}종목 하락)</tspan></text>

        <!-- 2 Metric Pills -->
        <g transform="translate(40, 110)">
          <rect width="400" height="180" rx="20" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1"/>
          <text x="30" y="45" fill="#64748B" font-size="20" font-weight="700">KOSPI 대표지수</text>
          <text x="30" y="110" fill="#0F172A" font-size="44" font-weight="900" class="tabular">${kospiClose.toLocaleString()}</text>
          <text x="30" y="150" fill="${kospiColor}" font-size="24" font-weight="800" class="tabular">${kospiSign}${kospiChangePct.toFixed(2)}% (상승 견인)</text>
        </g>

        <g transform="translate(480, 110)">
          <rect width="400" height="180" rx="20" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1"/>
          <text x="30" y="45" fill="#64748B" font-size="20" font-weight="700">시장 순자산총액 (AUM)</text>
          <text x="30" y="110" fill="#0F172A" font-size="44" font-weight="900" class="tabular">${aumJo}조원</text>
          <text x="30" y="150" fill="#15803D" font-size="22" font-weight="700">일 거래대금 ${tradeJo}조원</text>
        </g>
      </g>

      <!-- Bottom Swipe Hook & Save CTA -->
      <g transform="translate(80, 1030)">
        <rect width="920" height="160" rx="24" fill="#0F172A" filter="url(#cardShadow)"/>
        <text x="45" y="70" fill="#F8FAFC" font-size="28" font-weight="800">💡 3초 만에 확인하는 오늘 ETF 핵심 뷰</text>
        <text x="45" y="115" fill="#94A3B8" font-size="22" font-weight="500">스마트머니 1위 종목과 62개 롱숏 테마를 넘겨보세요 👉</text>
        
        <!-- Save Badge -->
        <rect x="730" y="48" width="150" height="64" rx="32" fill="#1D4ED8"/>
        <text x="805" y="88" fill="#FFFFFF" font-size="22" font-weight="800" text-anchor="middle">저장하기 📌</text>
      </g>

      <!-- Safe Zone Legal Disclaimer -->
      <text x="540" y="1290" fill="#94A3B8" font-size="18" font-weight="500" text-anchor="middle">${disclaimer}</text>
    </svg>
  `;

  // Slide 2: Market Breadth & Heatmap (화이트 카드 & 직관적인 파스텔 틴트)
  const slide2Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${baseDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>

      <!-- Header -->
      <g transform="translate(80, 100)">
        <text x="0" y="30" fill="#1D4ED8" font-size="22" font-weight="800" letter-spacing="1">STEP 2. MARKET BREADTH</text>
        <text x="0" y="90" fill="#0F172A" font-size="52" font-weight="900" letter-spacing="-1">시장 체온 및 7대 자산군 히트맵</text>
      </g>

      <!-- Ratio Bar Card -->
      <g transform="translate(80, 230)" filter="url(#cardShadow)">
        <rect width="920" height="90" rx="20" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
        <rect x="10" y="10" width="${Math.max(60, (up / total) * 900)}" height="70" rx="14" fill="#D92D20"/>
        <rect x="${Math.max(60, (up / total) * 900) + 15}" y="10" width="${Math.max(60, (down / total) * 900) - 15}" height="70" rx="14" fill="#175CD3"/>
        <text x="35" y="53" fill="#FFFFFF" font-size="26" font-weight="900" class="tabular">상승 ${up} (${upPct}%)</text>
        <text x="895" y="53" fill="#FFFFFF" font-size="26" font-weight="900" text-anchor="end" class="tabular">하락 ${down} (${downPct}%)</text>
      </g>

      <!-- 4 Key Asset Classes Heatmap Cards -->
      <text x="80" y="375" fill="#0F172A" font-size="30" font-weight="800">📊 주요 자산군 당일 가중 수익률</text>
      
      <g transform="translate(80, 405)" filter="url(#cardShadow)">
        <rect width="440" height="150" rx="20" fill="#FEF2F2" stroke="#FECACA" stroke-width="1.5"/>
        <text x="30" y="50" fill="#0F172A" font-size="26" font-weight="800">국내주식</text>
        <text x="30" y="90" fill="#64748B" font-size="20" font-weight="600">412개 종목 · AUM 185조</text>
        <text x="410" y="105" fill="#D92D20" font-size="40" font-weight="900" text-anchor="end" class="tabular">+1.45%</text>
      </g>

      <g transform="translate(560, 405)" filter="url(#cardShadow)">
        <rect width="440" height="150" rx="20" fill="#FEF2F2" stroke="#FECACA" stroke-width="1.5"/>
        <text x="30" y="50" fill="#0F172A" font-size="26" font-weight="800">해외주식</text>
        <text x="30" y="90" fill="#64748B" font-size="20" font-weight="600">320개 종목 · AUM 112조</text>
        <text x="410" y="105" fill="#D92D20" font-size="40" font-weight="900" text-anchor="end" class="tabular">+1.12%</text>
      </g>

      <g transform="translate(80, 580)" filter="url(#cardShadow)">
        <rect width="440" height="150" rx="20" fill="#F0FDF4" stroke="#BBF7D0" stroke-width="1.5"/>
        <text x="30" y="50" fill="#0F172A" font-size="26" font-weight="800">채권 (국채·회사채)</text>
        <text x="30" y="90" fill="#64748B" font-size="20" font-weight="600">145개 종목 · AUM 52조</text>
        <text x="410" y="105" fill="#15803D" font-size="40" font-weight="900" text-anchor="end" class="tabular">+0.15%</text>
      </g>

      <g transform="translate(560, 580)" filter="url(#cardShadow)">
        <rect width="440" height="150" rx="20" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="1.5"/>
        <text x="30" y="50" fill="#0F172A" font-size="26" font-weight="800">파생형 (레버리지/인버스)</text>
        <text x="30" y="90" fill="#64748B" font-size="20" font-weight="600">68개 종목 · AUM 14.5조</text>
        <text x="410" y="105" fill="#175CD3" font-size="40" font-weight="900" text-anchor="end" class="tabular">-0.42%</text>
      </g>

      <!-- Bottom Analyst Insight Box -->
      <g transform="translate(80, 765)" filter="url(#softShadow)">
        <rect width="920" height="420" rx="28" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
        <rect x="40" y="40" width="220" height="40" rx="20" fill="#EFF6FF"/>
        <text x="150" y="66" fill="#1D4ED8" font-size="20" font-weight="800" text-anchor="middle">💡 펀드 애널리스트 뷰</text>
        
        <text x="40" y="130" fill="#0F172A" font-size="28" font-weight="800">• 대형 지수형 중심의 든든한 하방 지지력 확인</text>
        <text x="40" y="175" fill="#64748B" font-size="22" font-weight="500">KOSPI 200 등 대형 대표지수형으로 기관 자금이 쏠리며 방어력 발휘.</text>

        <text x="40" y="245" fill="#0F172A" font-size="28" font-weight="800">• 파생형 거래 축소 및 안정적 배당주 선호</text>
        <text x="40" y="290" fill="#64748B" font-size="22" font-weight="500">단기 투기성 레버리지 비중이 낮아지고 월배당/채권형으로 실질 안착.</text>

        <text x="880" y="375" fill="#94A3B8" font-size="22" font-weight="700" text-anchor="end">(2/6)</text>
      </g>

      <text x="540" y="1290" fill="#94A3B8" font-size="18" font-weight="500" text-anchor="middle">${disclaimer}</text>
    </svg>
  `;

  // Slide 4: Smart Money Inflow TOP 5 (클린 화이트 리스트 & 등폭 칼정렬)
  const slide4Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${baseDefs}
      <rect width="1080" height="1350" fill="#F8FAFC"/>

      <!-- Header -->
      <g transform="translate(80, 100)">
        <text x="0" y="30" fill="#1D4ED8" font-size="22" font-weight="800" letter-spacing="1">STEP 4. SMART MONEY FLOW</text>
        <text x="0" y="90" fill="#0F172A" font-size="52" font-weight="900" letter-spacing="-1">당일 스마트머니 실질 순유입 TOP 5</text>
      </g>

      <!-- 5 Items -->
      <g transform="translate(80, 240)" filter="url(#cardShadow)">
        <rect width="920" height="145" rx="20" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
        <circle cx="55" cy="72" r="28" fill="#EFF6FF"/>
        <text x="55" y="82" fill="#1D4ED8" font-size="28" font-weight="900" text-anchor="middle">1</text>
        <text x="105" y="58" fill="#0F172A" font-size="28" font-weight="800">KODEX 200</text>
        <text x="105" y="98" fill="#64748B" font-size="20" font-weight="600" class="tabular">069500 · 국내대표지수</text>
        <text x="700" y="80" fill="#0F172A" font-size="36" font-weight="900" text-anchor="end" class="tabular">+4,250억원</text>
        <text x="965" y="80" fill="#D92D20" font-size="28" font-weight="800" text-anchor="end" class="tabular">+1.25%</text>
      </g>

      <g transform="translate(80, 405)" filter="url(#cardShadow)">
        <rect width="920" height="145" rx="20" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
        <circle cx="55" cy="72" r="28" fill="#EFF6FF"/>
        <text x="55" y="82" fill="#1D4ED8" font-size="28" font-weight="900" text-anchor="middle">2</text>
        <text x="105" y="58" fill="#0F172A" font-size="28" font-weight="800">KODEX 미국S&amp;P500TR</text>
        <text x="105" y="98" fill="#64748B" font-size="20" font-weight="600" class="tabular">379800 · 해외대표지수</text>
        <text x="700" y="80" fill="#0F172A" font-size="36" font-weight="900" text-anchor="end" class="tabular">+3,120억원</text>
        <text x="965" y="80" fill="#D92D20" font-size="28" font-weight="800" text-anchor="end" class="tabular">+0.95%</text>
      </g>

      <g transform="translate(80, 570)" filter="url(#cardShadow)">
        <rect width="920" height="145" rx="20" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
        <circle cx="55" cy="72" r="28" fill="#EFF6FF"/>
        <text x="55" y="82" fill="#1D4ED8" font-size="28" font-weight="900" text-anchor="middle">3</text>
        <text x="105" y="58" fill="#0F172A" font-size="28" font-weight="800">TIGER 미국나스닥100</text>
        <text x="105" y="98" fill="#64748B" font-size="20" font-weight="600" class="tabular">133690 · 해외빅테크</text>
        <text x="700" y="80" fill="#0F172A" font-size="36" font-weight="900" text-anchor="end" class="tabular">+2,850억원</text>
        <text x="965" y="80" fill="#D92D20" font-size="28" font-weight="800" text-anchor="end" class="tabular">+1.65%</text>
      </g>

      <g transform="translate(80, 735)" filter="url(#cardShadow)">
        <rect width="920" height="145" rx="20" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
        <circle cx="55" cy="72" r="28" fill="#EFF6FF"/>
        <text x="55" y="82" fill="#1D4ED8" font-size="28" font-weight="900" text-anchor="middle">4</text>
        <text x="105" y="58" fill="#0F172A" font-size="28" font-weight="800">PLUS 고배당주</text>
        <text x="105" y="98" fill="#64748B" font-size="20" font-weight="600" class="tabular">448290 · 국내고배당</text>
        <text x="700" y="80" fill="#0F172A" font-size="36" font-weight="900" text-anchor="end" class="tabular">+1,950억원</text>
        <text x="965" y="80" fill="#D92D20" font-size="28" font-weight="800" text-anchor="end" class="tabular">+0.45%</text>
      </g>

      <g transform="translate(80, 900)" filter="url(#cardShadow)">
        <rect width="920" height="145" rx="20" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
        <circle cx="55" cy="72" r="28" fill="#EFF6FF"/>
        <text x="55" y="82" fill="#1D4ED8" font-size="28" font-weight="900" text-anchor="middle">5</text>
        <text x="105" y="58" fill="#0F172A" font-size="28" font-weight="800">ACE 미국30년국채액티브</text>
        <text x="105" y="98" fill="#64748B" font-size="20" font-weight="600" class="tabular">396500 · 미국장기채</text>
        <text x="700" y="80" fill="#0F172A" font-size="36" font-weight="900" text-anchor="end" class="tabular">+1,650억원</text>
        <text x="965" y="80" fill="#175CD3" font-size="28" font-weight="800" text-anchor="end" class="tabular">-0.15%</text>
      </g>

      <!-- Bottom Insight -->
      <g transform="translate(80, 1075)">
        <rect width="920" height="110" rx="20" fill="#0F172A"/>
        <text x="40" y="65" fill="#F8FAFC" font-size="22" font-weight="600">💡 단순 거래량이 아닌, 신규 설정액 기준의 '실질 진성수급' 유입 랭킹입니다.</text>
        <text x="880" y="65" fill="#94A3B8" font-size="22" font-weight="700" text-anchor="end">(4/6)</text>
      </g>

      <text x="540" y="1290" fill="#94A3B8" font-size="18" font-weight="500" text-anchor="middle">${disclaimer}</text>
    </svg>
  `;

  const slides = {
    "1": slide1Svg,
    "2": slide2Svg,
    "4": slide4Svg,
  };

  const selectedSvg = slides[slideParam] || slide1Svg;

  return new Response(selectedSvg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "no-cache",
    },
  });
}
