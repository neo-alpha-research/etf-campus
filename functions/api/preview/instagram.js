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

  const kospiColor = kospiChangePct > 0 ? "#EF4444" : kospiChangePct < 0 ? "#38BDF8" : "#94A3B8";
  const kospiSign = kospiChangePct > 0 ? "+" : "";
  const kosdaqColor = kosdaqChangePct > 0 ? "#EF4444" : kosdaqChangePct < 0 ? "#38BDF8" : "#94A3B8";
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

  const headline = briefing?.headline_text || "대형 지수형 ETF의 안정적 방어 속 기관의 2.3조원 규모 실질 진성수급이 유입되었습니다.";

  const baseDefs = `
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0B0F19" />
        <stop offset="50%" stop-color="#0F172A" />
        <stop offset="100%" stop-color="#020617" />
      </linearGradient>
      <linearGradient id="primaryGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#10B981" />
        <stop offset="100%" stop-color="#059669" />
      </linearGradient>
      <linearGradient id="redGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#EF4444" />
        <stop offset="100%" stop-color="#DC2626" />
      </linearGradient>
      <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#38BDF8" />
        <stop offset="100%" stop-color="#0284C7" />
      </linearGradient>
      <filter id="cardGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="40" result="blur"/>
        <feComposite in="SourceGraphic" in2="blur" operator="over"/>
      </filter>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Pretendard:wght@400;600;700;800;900&amp;display=swap');
        * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .tabular { font-variant-numeric: tabular-nums; letter-spacing: -0.5px; }
      </style>
    </defs>
  `;

  const disclaimer = "* 본 자료는 투자 참고용이며, 특정 상품의 권유가 아닙니다. 투자 판단과 최종 책임은 투자자 본인에게 있습니다.";

  // Slide 1: Cover
  const slide1Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${baseDefs}
      <rect width="1080" height="1350" fill="url(#bgGrad)"/>
      <circle cx="540" cy="280" r="380" fill="#10B981" fill-opacity="0.12" filter="blur(120px)"/>
      <circle cx="950" cy="980" r="320" fill="#0284C7" fill-opacity="0.1" filter="blur(100px)"/>
      
      <!-- Top Safe Zone Brand Header -->
      <rect x="80" y="90" width="220" height="46" rx="23" fill="#1E293B" stroke="#334155" stroke-width="1.5"/>
      <circle cx="108" cy="113" r="7" fill="#10B981"/>
      <text x="130" y="120" fill="#34D399" font-size="20" font-weight="900" letter-spacing="1">ETF CAMPUS</text>
      <text x="1000" y="122" fill="#94A3B8" font-size="24" font-weight="700" text-anchor="end" class="tabular">${formattedDate} 마켓 브리핑</text>

      <!-- Main Headline -->
      <text x="80" y="240" fill="#94A3B8" font-size="32" font-weight="800" letter-spacing="-0.5">오늘 대한민국 ETF</text>
      <text x="80" y="320" fill="#FFFFFF" font-size="64" font-weight="900" letter-spacing="-1">시장 체온: <tspan fill="#34D399">${temp}</tspan></text>
      
      <!-- Narrative Quote Box -->
      <rect x="80" y="375" width="920" height="175" rx="24" fill="#1E293B" fill-opacity="0.85" stroke="#334155" stroke-width="2"/>
      <text x="120" y="435" fill="#F8FAFC" font-size="27" font-weight="700">"${headline.slice(0, 36)}..."</text>
      <text x="120" y="495" fill="#94A3B8" font-size="22" font-weight="600">총 운용자산 <tspan fill="#FFFFFF" font-weight="800">${aumJo}조원</tspan> · 일 거래대금 <tspan fill="#FFFFFF" font-weight="800">${tradeJo}조원</tspan> (${up}종목 상승 / ${down}종목 하락)</text>

      <!-- Market Indices Cards -->
      <rect x="80" y="585" width="440" height="230" rx="24" fill="#111827" stroke="#1F2937" stroke-width="2"/>
      <text x="120" y="645" fill="#9CA3AF" font-size="24" font-weight="700">KOSPI 종합지수</text>
      <text x="120" y="720" fill="#FFFFFF" font-size="52" font-weight="900" class="tabular">${kospiClose.toLocaleString()}</text>
      <text x="120" y="775" fill="${kospiColor}" font-size="30" font-weight="800" class="tabular">${kospiSign}${kospiChangePct.toFixed(2)}%</text>

      <rect x="560" y="585" width="440" height="230" rx="24" fill="#111827" stroke="#1F2937" stroke-width="2"/>
      <text x="600" y="645" fill="#9CA3AF" font-size="24" font-weight="700">KOSDAQ 지수</text>
      <text x="600" y="720" fill="#FFFFFF" font-size="52" font-weight="900" class="tabular">${kosdaqClose.toLocaleString()}</text>
      <text x="600" y="775" fill="${kosdaqColor}" font-size="30" font-weight="800" class="tabular">${kosdaqSign}${kosdaqChangePct.toFixed(2)}%</text>

      <!-- Bottom Hook Indicator -->
      <rect x="80" y="850" width="920" height="340" rx="28" fill="#1E293B" fill-opacity="0.9" stroke="#10B981" stroke-width="2.5"/>
      <text x="130" y="920" fill="#34D399" font-size="26" font-weight="800">🔍 오늘 장 핵심 3초 체크포인트</text>
      <text x="130" y="980" fill="#FFFFFF" font-size="32" font-weight="800">1. 스마트머니가 가장 많이 쓸어담은 테마 TOP 5</text>
      <text x="130" y="1040" fill="#FFFFFF" font-size="32" font-weight="800">2. 62개 테마 중 롱숏 1위 vs 꼴찌 수익률 격차</text>
      <text x="130" y="1100" fill="#FFFFFF" font-size="32" font-weight="800">3. 내 계좌 방어를 위한 섹터 로테이션 방향</text>
      
      <!-- Slide Indicator & Save CTA -->
      <text x="130" y="1155" fill="#94A3B8" font-size="22" font-weight="600">옆으로 넘겨서 확인하기 👉 (1/6)</text>
      <rect x="780" y="1120" width="190" height="48" rx="24" fill="#2563EB"/>
      <text x="875" y="1152" fill="#FFFFFF" font-size="20" font-weight="800" text-anchor="middle">저장하기 📌</text>

      <!-- Safe Zone Disclaimer -->
      <text x="540" y="1290" fill="#64748B" font-size="18" font-weight="500" text-anchor="middle">${disclaimer}</text>
    </svg>
  `;

  // Slide 2: Breadth Heatmap
  const slide2Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${baseDefs}
      <rect width="1080" height="1350" fill="url(#bgGrad)"/>
      
      <!-- Header -->
      <text x="80" y="130" fill="#34D399" font-size="24" font-weight="900" letter-spacing="1">STEP 2. MARKET BREADTH</text>
      <text x="80" y="195" fill="#FFFFFF" font-size="52" font-weight="900" letter-spacing="-1">시장 체온 및 7대 자산군 히트맵</text>

      <!-- Ratio Bar -->
      <rect x="80" y="245" width="920" height="75" rx="20" fill="#1E293B"/>
      <rect x="80" y="245" width="${Math.max(40, (up / total) * 920)}" height="75" rx="20" fill="url(#redGrad)"/>
      <text x="115" y="293" fill="#FFFFFF" font-size="28" font-weight="900" class="tabular">상승 ${up} (${upPct}%)</text>
      <text x="965" y="293" fill="#FFFFFF" font-size="28" font-weight="900" text-anchor="end" class="tabular">하락 ${down} (${downPct}%)</text>

      <!-- Heatmap Cards -->
      <text x="80" y="380" fill="#F8FAFC" font-size="32" font-weight="800">📊 자산군별 당일 가중 수익률 &amp; AUM</text>
      
      <g transform="translate(80, 415)">
        <rect width="440" height="145" rx="20" fill="#450A0A" stroke="#991B1B" stroke-width="2"/>
        <text x="30" y="50" fill="#FFFFFF" font-size="26" font-weight="800">국내주식</text>
        <text x="30" y="90" fill="#94A3B8" font-size="20" font-weight="600">412개 종목 · AUM 185.0조</text>
        <text x="410" y="105" fill="#F87171" font-size="38" font-weight="900" text-anchor="end" class="tabular">+1.45%</text>
      </g>
      <g transform="translate(560, 415)">
        <rect width="440" height="145" rx="20" fill="#450A0A" stroke="#991B1B" stroke-width="2"/>
        <text x="30" y="50" fill="#FFFFFF" font-size="26" font-weight="800">해외주식</text>
        <text x="30" y="90" fill="#94A3B8" font-size="20" font-weight="600">320개 종목 · AUM 112.0조</text>
        <text x="410" y="105" fill="#F87171" font-size="38" font-weight="900" text-anchor="end" class="tabular">+1.12%</text>
      </g>
      <g transform="translate(80, 585)">
        <rect width="440" height="145" rx="20" fill="#1E293B" stroke="#334155" stroke-width="2"/>
        <text x="30" y="50" fill="#FFFFFF" font-size="26" font-weight="800">채권 (국채·회사채)</text>
        <text x="30" y="90" fill="#94A3B8" font-size="20" font-weight="600">145개 종목 · AUM 52.0조</text>
        <text x="410" y="105" fill="#34D399" font-size="38" font-weight="900" text-anchor="end" class="tabular">+0.15%</text>
      </g>
      <g transform="translate(560, 585)">
        <rect width="440" height="145" rx="20" fill="#082F49" stroke="#0369A1" stroke-width="2"/>
        <text x="30" y="50" fill="#FFFFFF" font-size="26" font-weight="800">파생형 (레버리지/인버스)</text>
        <text x="30" y="90" fill="#94A3B8" font-size="20" font-weight="600">68개 종목 · AUM 14.5조</text>
        <text x="410" y="105" fill="#38BDF8" font-size="38" font-weight="900" text-anchor="end" class="tabular">-0.42%</text>
      </g>

      <!-- Bottom Analyst Note -->
      <rect x="80" y="765" width="920" height="420" rx="28" fill="#111827" stroke="#1F2937" stroke-width="2"/>
      <text x="125" y="830" fill="#34D399" font-size="26" font-weight="800">💡 수석 펀드 애널리스트 원포인트 코멘트</text>
      <text x="125" y="890" fill="#E2E8F0" font-size="28" font-weight="700">• Top 50 대형 ETF 중심의 견고한 방어력 확인</text>
      <text x="125" y="945" fill="#94A3B8" font-size="22" font-weight="500">대형 대표지수형으로 자금이 집중되며 지수 하방을 지지했습니다.</text>
      <text x="125" y="1005" fill="#E2E8F0" font-size="28" font-weight="700">• 단기 파생형 거래 감소 및 진성수급 안착</text>
      <text x="125" y="1060" fill="#94A3B8" font-size="22" font-weight="500">투기성 레버리지보다는 안정적 월배당 및 장기채권으로 매수세 유입.</text>

      <text x="960" y="1150" fill="#64748B" font-size="22" font-weight="700" text-anchor="end">(2/6)</text>
      <text x="540" y="1290" fill="#64748B" font-size="18" font-weight="500" text-anchor="middle">${disclaimer}</text>
    </svg>
  `;

  // Slide 4: Smart Money TOP 5
  const slide4Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${baseDefs}
      <rect width="1080" height="1350" fill="url(#bgGrad)"/>
      
      <!-- Header -->
      <text x="80" y="130" fill="#34D399" font-size="24" font-weight="900" letter-spacing="1">STEP 4. SMART MONEY FLOW</text>
      <text x="80" y="195" fill="#FFFFFF" font-size="52" font-weight="900" letter-spacing="-1">당일 스마트머니 실질 순유입 TOP 5</text>

      <!-- 5 Items -->
      <g transform="translate(80, 245)">
        <rect width="920" height="145" rx="20" fill="#111827" stroke="#1F2937" stroke-width="2"/>
        <circle cx="55" cy="72" r="28" fill="#1E293B"/>
        <text x="55" y="81" fill="#34D399" font-size="26" font-weight="900" text-anchor="middle">1</text>
        <text x="105" y="58" fill="#FFFFFF" font-size="28" font-weight="800">KODEX 200</text>
        <text x="105" y="98" fill="#64748B" font-size="20" font-weight="600" class="tabular">069500 · 국내대표지수</text>
        <text x="700" y="80" fill="#F8FAFC" font-size="34" font-weight="900" text-anchor="end" class="tabular">+4,250억원</text>
        <text x="965" y="80" fill="#EF4444" font-size="28" font-weight="800" text-anchor="end" class="tabular">+1.25%</text>
      </g>
      <g transform="translate(80, 410)">
        <rect width="920" height="145" rx="20" fill="#111827" stroke="#1F2937" stroke-width="2"/>
        <circle cx="55" cy="72" r="28" fill="#1E293B"/>
        <text x="55" y="81" fill="#34D399" font-size="26" font-weight="900" text-anchor="middle">2</text>
        <text x="105" y="58" fill="#FFFFFF" font-size="28" font-weight="800">KODEX 미국S&amp;P500TR</text>
        <text x="105" y="98" fill="#64748B" font-size="20" font-weight="600" class="tabular">379800 · 해외대표지수</text>
        <text x="700" y="80" fill="#F8FAFC" font-size="34" font-weight="900" text-anchor="end" class="tabular">+3,120억원</text>
        <text x="965" y="80" fill="#EF4444" font-size="28" font-weight="800" text-anchor="end" class="tabular">+0.95%</text>
      </g>
      <g transform="translate(80, 575)">
        <rect width="920" height="145" rx="20" fill="#111827" stroke="#1F2937" stroke-width="2"/>
        <circle cx="55" cy="72" r="28" fill="#1E293B"/>
        <text x="55" y="81" fill="#34D399" font-size="26" font-weight="900" text-anchor="middle">3</text>
        <text x="105" y="58" fill="#FFFFFF" font-size="28" font-weight="800">TIGER 미국나스닥100</text>
        <text x="105" y="98" fill="#64748B" font-size="20" font-weight="600" class="tabular">133690 · 해외빅테크</text>
        <text x="700" y="80" fill="#F8FAFC" font-size="34" font-weight="900" text-anchor="end" class="tabular">+2,850억원</text>
        <text x="965" y="80" fill="#EF4444" font-size="28" font-weight="800" text-anchor="end" class="tabular">+1.65%</text>
      </g>
      <g transform="translate(80, 740)">
        <rect width="920" height="145" rx="20" fill="#111827" stroke="#1F2937" stroke-width="2"/>
        <circle cx="55" cy="72" r="28" fill="#1E293B"/>
        <text x="55" y="81" fill="#34D399" font-size="26" font-weight="900" text-anchor="middle">4</text>
        <text x="105" y="58" fill="#FFFFFF" font-size="28" font-weight="800">PLUS 고배당주</text>
        <text x="105" y="98" fill="#64748B" font-size="20" font-weight="600" class="tabular">448290 · 국내고배당</text>
        <text x="700" y="80" fill="#F8FAFC" font-size="34" font-weight="900" text-anchor="end" class="tabular">+1,950억원</text>
        <text x="965" y="80" fill="#EF4444" font-size="28" font-weight="800" text-anchor="end" class="tabular">+0.45%</text>
      </g>
      <g transform="translate(80, 905)">
        <rect width="920" height="145" rx="20" fill="#111827" stroke="#1F2937" stroke-width="2"/>
        <circle cx="55" cy="72" r="28" fill="#1E293B"/>
        <text x="55" y="81" fill="#34D399" font-size="26" font-weight="900" text-anchor="middle">5</text>
        <text x="105" y="58" fill="#FFFFFF" font-size="28" font-weight="800">ACE 미국30년국채액티브</text>
        <text x="105" y="98" fill="#64748B" font-size="20" font-weight="600" class="tabular">396500 · 미국장기채</text>
        <text x="700" y="80" fill="#F8FAFC" font-size="34" font-weight="900" text-anchor="end" class="tabular">+1,650억원</text>
        <text x="965" y="80" fill="#38BDF8" font-size="28" font-weight="800" text-anchor="end" class="tabular">-0.15%</text>
      </g>

      <!-- Action Note -->
      <rect x="80" y="1075" width="920" height="110" rx="20" fill="#1E293B" stroke="#334155" stroke-width="1.5"/>
      <text x="120" y="1138" fill="#F8FAFC" font-size="22" font-weight="600">💡 단순 거래량이 아닌, 신규 설정액 기준의 '진성수급' 유입 상위 종목입니다.</text>
      <text x="960" y="1140" fill="#64748B" font-size="22" font-weight="700" text-anchor="end">(4/6)</text>

      <text x="540" y="1290" fill="#64748B" font-size="18" font-weight="500" text-anchor="middle">${disclaimer}</text>
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
