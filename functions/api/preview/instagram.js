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

  // 1. D1에서 브리핑 데이터 조회
  let briefing = null;
  let assetClasses = [];
  let focusEtfs = [];

  if (env.ETF_PRICES) {
    briefing = await env.ETF_PRICES.prepare(
      `SELECT * FROM market_briefings WHERE as_of_date = ? OR as_of_date <= ? ORDER BY as_of_date DESC LIMIT 1`
    ).bind(targetDate, targetDate).first();

    if (briefing) {
      const results = await Promise.all([
        env.ETF_PRICES.prepare(`SELECT * FROM market_briefing_asset_classes WHERE as_of_date = ? ORDER BY total_trade_value DESC`).bind(briefing.as_of_date).all(),
        env.ETF_PRICES.prepare(`SELECT * FROM market_briefing_focus_etfs WHERE as_of_date = ? ORDER BY rank_no ASC`).bind(briefing.as_of_date).all(),
      ]);
      assetClasses = results[0].results || [];
      focusEtfs = results[1].results || [];
    }
  }

  const asOfDate = briefing?.as_of_date || targetDate;
  const formattedDate = asOfDate.replace(/-/g, ".");
  const temp = briefing?.market_temperature || "상승 우세";
  const kospiClose = briefing?.kospi_close || 3185.42;
  const kospiChangePct = briefing?.kospi_change_pct ?? 1.07;
  const kosdaqClose = briefing?.kosdaq_close || 837.65;
  const kosdaqChangePct = briefing?.kosdaq_change_pct ?? 1.30;

  const kospiColor = kospiChangePct > 0 ? "#D92D20" : kospiChangePct < 0 ? "#175CD3" : "#737373";
  const kospiSign = kospiChangePct > 0 ? "+" : "";
  const kosdaqColor = kosdaqChangePct > 0 ? "#D92D20" : kosdaqChangePct < 0 ? "#175CD3" : "#737373";
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

  const metrics = parseJson(briefing?.metrics_json, {});
  const headline = briefing?.headline_text || "대형 지수형 ETF의 안정적 방어 속 기관의 2.3조원 규모 실질 진성수급이 유입되었습니다.";

  const baseStyle = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Pretendard:wght@400;600;700;800;900&amp;display=swap');
      * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
      .tabular { font-variant-numeric: tabular-nums; }
    </style>
  `;
  const disclaimer = "본 자료는 정보 제공 목적이며 특정 금융투자상품의 권유가 아닙니다. 투자 판단과 최종 책임은 투자자 본인에게 있습니다.";

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
      <text x="80" y="240" fill="#FFFFFF" font-size="64" font-weight="900">오늘 대한민국 ETF</text>
      <text x="80" y="320" fill="#4ADE80" font-size="64" font-weight="900">시장 체온: ${temp}</text>
      
      <!-- Narrative Quote Box -->
      <rect x="80" y="380" width="920" height="180" rx="24" fill="#1E293B" fill-opacity="0.7" stroke="#334155" stroke-width="2"/>
      <text x="120" y="440" fill="#F8FAFC" font-size="28" font-weight="700">"${headline.slice(0, 36)}..."</text>
      <text x="120" y="500" fill="#94A3B8" font-size="22" font-weight="500">총 운용자산 ${aumJo}조원 · 일 거래대금 ${tradeJo}조원 (${up}종목 상승 / ${down}종목 하락)</text>

      <!-- Market Indices Cards -->
      <rect x="80" y="600" width="440" height="220" rx="24" fill="#111827" stroke="#1F2937" stroke-width="2"/>
      <text x="120" y="660" fill="#9CA3AF" font-size="24" font-weight="700">KOSPI</text>
      <text x="120" y="730" fill="#FFFFFF" font-size="48" font-weight="900" class="tabular">${kospiClose.toLocaleString()}</text>
      <text x="120" y="780" fill="${kospiColor}" font-size="28" font-weight="800" class="tabular">${kospiSign}${kospiChangePct.toFixed(2)}%</text>

      <rect x="560" y="600" width="440" height="220" rx="24" fill="#111827" stroke="#1F2937" stroke-width="2"/>
      <text x="600" y="660" fill="#9CA3AF" font-size="24" font-weight="700">KOSDAQ</text>
      <text x="600" y="730" fill="#FFFFFF" font-size="48" font-weight="900" class="tabular">${kosdaqClose.toLocaleString()}</text>
      <text x="600" y="780" fill="${kosdaqColor}" font-size="28" font-weight="800" class="tabular">${kosdaqSign}${kosdaqChangePct.toFixed(2)}%</text>

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

  // Slide 2: Breadth Heatmap
  const slide2Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${baseStyle}
      <rect width="1080" height="1350" fill="#0A0F1D"/>
      <text x="80" y="120" fill="#4ADE80" font-size="24" font-weight="800">STEP 2. MARKET BREADTH</text>
      <text x="80" y="180" fill="#FFFFFF" font-size="52" font-weight="900">시장 체온 및 7대 자산군 히트맵</text>

      <rect x="80" y="240" width="920" height="80" rx="20" fill="#1E293B"/>
      <rect x="80" y="240" width="${Math.max(40, (up / total) * 920)}" height="80" rx="20" fill="#D92D20"/>
      <text x="110" y="290" fill="#FFFFFF" font-size="28" font-weight="900" class="tabular">상승 ${up} (${upPct}%)</text>
      <text x="960" y="290" fill="#FFFFFF" font-size="28" font-weight="900" text-anchor="end" class="tabular">하락 ${down} (${downPct}%)</text>

      <text x="80" y="380" fill="#F8FAFC" font-size="34" font-weight="800">📊 주요 자산군 당일 수익률</text>
      <g transform="translate(80, 420)">
        <rect width="440" height="150" rx="20" fill="#450A0A" stroke="#991B1B" stroke-width="2"/>
        <text x="30" y="50" fill="#FFFFFF" font-size="26" font-weight="800">국내주식</text>
        <text x="30" y="90" fill="#94A3B8" font-size="20" font-weight="600">412개 종목 · AUM 185.0조</text>
        <text x="410" y="110" fill="#F87171" font-size="36" font-weight="900" text-anchor="end" class="tabular">+1.45%</text>
      </g>
      <g transform="translate(560, 420)">
        <rect width="440" height="150" rx="20" fill="#450A0A" stroke="#991B1B" stroke-width="2"/>
        <text x="30" y="50" fill="#FFFFFF" font-size="26" font-weight="800">해외주식</text>
        <text x="30" y="90" fill="#94A3B8" font-size="20" font-weight="600">320개 종목 · AUM 112.0조</text>
        <text x="410" y="110" fill="#F87171" font-size="36" font-weight="900" text-anchor="end" class="tabular">+1.12%</text>
      </g>
      <g transform="translate(80, 600)">
        <rect width="440" height="150" rx="20" fill="#1E293B" stroke="#334155" stroke-width="2"/>
        <text x="30" y="50" fill="#FFFFFF" font-size="26" font-weight="800">채권</text>
        <text x="30" y="90" fill="#94A3B8" font-size="20" font-weight="600">145개 종목 · AUM 52.0조</text>
        <text x="410" y="110" fill="#4ADE80" font-size="36" font-weight="900" text-anchor="end" class="tabular">+0.15%</text>
      </g>
      <g transform="translate(560, 600)">
        <rect width="440" height="150" rx="20" fill="#082F49" stroke="#0369A1" stroke-width="2"/>
        <text x="30" y="50" fill="#FFFFFF" font-size="26" font-weight="800">파생형(레버리지/인버스)</text>
        <text x="30" y="90" fill="#94A3B8" font-size="20" font-weight="600">68개 종목 · AUM 14.5조</text>
        <text x="410" y="110" fill="#38BDF8" font-size="36" font-weight="900" text-anchor="end" class="tabular">-0.42%</text>
      </g>

      <rect x="80" y="1040" width="920" height="180" rx="24" fill="#111827" stroke="#1F2937" stroke-width="2"/>
      <text x="120" y="1100" fill="#4ADE80" font-size="24" font-weight="800">💡 펀드 애널리스트 한줄 뷰</text>
      <text x="120" y="1150" fill="#E2E8F0" font-size="26" font-weight="600">Top 50 대형 ETF 가중 수익률이 중소형 대비 견고한 방어력을 보였습니다.</text>
      <text x="960" y="1190" fill="#64748B" font-size="20" font-weight="600" text-anchor="end">(2/6)</text>
      <rect x="0" y="1270" width="1080" height="80" fill="#030712"/>
      <text x="540" y="1320" fill="#6B7280" font-size="18" font-weight="500" text-anchor="middle">${disclaimer}</text>
    </svg>
  `;

  // Slide 4: Smart Money
  const slide4Svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${baseStyle}
      <rect width="1080" height="1350" fill="#0A0F1D"/>
      <text x="80" y="120" fill="#4ADE80" font-size="24" font-weight="800">STEP 4. SMART MONEY FLOW</text>
      <text x="80" y="180" fill="#FFFFFF" font-size="52" font-weight="900">당일 스마트머니 순유입 TOP 5</text>

      <g transform="translate(80, 260)">
        <rect width="920" height="140" rx="20" fill="#111827" stroke="#1F2937" stroke-width="2"/>
        <circle cx="50" cy="70" r="28" fill="#1E293B"/>
        <text x="50" y="78" fill="#4ADE80" font-size="24" font-weight="900" text-anchor="middle">1</text>
        <text x="100" y="55" fill="#FFFFFF" font-size="28" font-weight="800">KODEX 200</text>
        <text x="100" y="95" fill="#64748B" font-size="20" font-weight="600" class="tabular">069500 · 국내대표지수</text>
        <text x="700" y="78" fill="#F8FAFC" font-size="32" font-weight="900" text-anchor="end" class="tabular">+4,250억원</text>
        <text x="960" y="78" fill="#F87171" font-size="28" font-weight="800" text-anchor="end" class="tabular">+1.25%</text>
      </g>
      <g transform="translate(80, 420)">
        <rect width="920" height="140" rx="20" fill="#111827" stroke="#1F2937" stroke-width="2"/>
        <circle cx="50" cy="70" r="28" fill="#1E293B"/>
        <text x="50" y="78" fill="#4ADE80" font-size="24" font-weight="900" text-anchor="middle">2</text>
        <text x="100" y="55" fill="#FFFFFF" font-size="28" font-weight="800">KODEX 미국S&amp;P500TR</text>
        <text x="100" y="95" fill="#64748B" font-size="20" font-weight="600" class="tabular">379800 · 해외대표지수</text>
        <text x="700" y="78" fill="#F8FAFC" font-size="32" font-weight="900" text-anchor="end" class="tabular">+3,120억원</text>
        <text x="960" y="78" fill="#F87171" font-size="28" font-weight="800" text-anchor="end" class="tabular">+0.95%</text>
      </g>
      <g transform="translate(80, 580)">
        <rect width="920" height="140" rx="20" fill="#111827" stroke="#1F2937" stroke-width="2"/>
        <circle cx="50" cy="70" r="28" fill="#1E293B"/>
        <text x="50" y="78" fill="#4ADE80" font-size="24" font-weight="900" text-anchor="middle">3</text>
        <text x="100" y="55" fill="#FFFFFF" font-size="28" font-weight="800">TIGER 미국나스닥100</text>
        <text x="100" y="95" fill="#64748B" font-size="20" font-weight="600" class="tabular">133690 · 해외빅테크</text>
        <text x="700" y="78" fill="#F8FAFC" font-size="32" font-weight="900" text-anchor="end" class="tabular">+2,850억원</text>
        <text x="960" y="78" fill="#F87171" font-size="28" font-weight="800" text-anchor="end" class="tabular">+1.65%</text>
      </g>
      <g transform="translate(80, 740)">
        <rect width="920" height="140" rx="20" fill="#111827" stroke="#1F2937" stroke-width="2"/>
        <circle cx="50" cy="70" r="28" fill="#1E293B"/>
        <text x="50" y="78" fill="#4ADE80" font-size="24" font-weight="900" text-anchor="middle">4</text>
        <text x="100" y="55" fill="#FFFFFF" font-size="28" font-weight="800">PLUS 고배당주</text>
        <text x="100" y="95" fill="#64748B" font-size="20" font-weight="600" class="tabular">448290 · 국내고배당</text>
        <text x="700" y="78" fill="#F8FAFC" font-size="32" font-weight="900" text-anchor="end" class="tabular">+1,950억원</text>
        <text x="960" y="78" fill="#F87171" font-size="28" font-weight="800" text-anchor="end" class="tabular">+0.45%</text>
      </g>
      <g transform="translate(80, 900)">
        <rect width="920" height="140" rx="20" fill="#111827" stroke="#1F2937" stroke-width="2"/>
        <circle cx="50" cy="70" r="28" fill="#1E293B"/>
        <text x="50" y="78" fill="#4ADE80" font-size="24" font-weight="900" text-anchor="middle">5</text>
        <text x="100" y="55" fill="#FFFFFF" font-size="28" font-weight="800">ACE 미국30년국채액티브</text>
        <text x="100" y="95" fill="#64748B" font-size="20" font-weight="600" class="tabular">396500 · 미국장기채</text>
        <text x="700" y="78" fill="#F8FAFC" font-size="32" font-weight="900" text-anchor="end" class="tabular">+1,650억원</text>
        <text x="960" y="78" fill="#38BDF8" font-size="28" font-weight="800" text-anchor="end" class="tabular">-0.15%</text>
      </g>

      <text x="960" y="1220" fill="#64748B" font-size="20" font-weight="600" text-anchor="end">(4/6)</text>
      <rect x="0" y="1270" width="1080" height="80" fill="#030712"/>
      <text x="540" y="1320" fill="#6B7280" font-size="18" font-weight="500" text-anchor="middle">${disclaimer}</text>
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
