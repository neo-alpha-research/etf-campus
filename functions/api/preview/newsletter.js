export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const targetDate = url.searchParams.get("date") || "2026-08-27";
  const formattedDate = targetDate.replace(/-/g, ".");

  let briefing = null;
  if (env.ETF_PRICES) {
    briefing = await env.ETF_PRICES.prepare(
      `SELECT * FROM market_briefings WHERE as_of_date = ? OR as_of_date <= ? ORDER BY as_of_date DESC LIMIT 1`
    ).bind(targetDate, targetDate).first();
  }

  const temp = briefing?.market_temperature || "상승 우세";
  const kospiClose = briefing?.kospi_close || 3185.42;
  const kospiChangePct = briefing?.kospi_change_pct ?? 1.07;
  const kosdaqClose = briefing?.kosdaq_close || 837.65;
  const kosdaqChangePct = briefing?.kosdaq_change_pct ?? 1.30;

  const kospiColor = kospiChangePct > 0 ? "#EF4444" : kospiChangePct < 0 ? "#38BDF8" : "#94A3B8";
  const kospiSign = kospiChangePct > 0 ? "+" : "";

  const aumEok = briefing?.general_total_aum ? Math.round(briefing.general_total_aum / 100000000) : 3851607;
  const tradeEok = briefing?.general_total_trade_value ? Math.round(briefing.general_total_trade_value / 100000000) : 99147;
  const aumJo = (aumEok / 10000).toFixed(1);
  const tradeJo = (tradeEok / 10000).toFixed(1);

  const up = briefing?.up_count || 642;
  const flat = briefing?.flat_count || 88;
  const down = briefing?.down_count || 288;
  const headline = briefing?.headline_text || "대형 지수형 ETF의 안정적 방어 속 기관의 2.3조원 규모 실질 진성수급이 유입되었습니다.";
  const utmLink = `https://etf-campus.pages.dev/briefing?utm_source=newsletter&utm_medium=email&utm_campaign=daily_briefing_${targetDate.replace(/-/g, "")}`;

  const defaultAssetClasses = [
    { assetClass: "국내주식", aumSharePct: 48.0, aumWeightedReturnPct: 1.45, ytd: 18.2 },
    { assetClass: "해외주식", aumSharePct: 29.1, aumWeightedReturnPct: 1.12, ytd: 24.5 },
    { assetClass: "채권", aumSharePct: 13.5, aumWeightedReturnPct: 0.15, ytd: 4.8 },
    { assetClass: "파생형(레버리지/인버스)", aumSharePct: 3.8, aumWeightedReturnPct: -0.42, ytd: -8.5 },
    { assetClass: "원자재", aumSharePct: 2.1, aumWeightedReturnPct: 0.85, ytd: 11.2 },
    { assetClass: "부동산/리츠", aumSharePct: 1.7, aumWeightedReturnPct: 0.35, ytd: 6.4 },
    { assetClass: "통화/기타", aumSharePct: 1.8, aumWeightedReturnPct: -0.65, ytd: -3.2 },
  ];

  const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🚨 [ETF 브리핑] ${formattedDate} 시장 체온 '${temp}' · AUM ${aumJo}조원 돌파</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0B0F19; font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #E2E8F0; }
    .container { max-width: 620px; margin: 0 auto; background-color: #0F172A; border-radius: 16px; overflow: hidden; border: 1px solid #1E293B; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .tabular { font-variant-numeric: tabular-nums; letter-spacing: -0.5px; }
    .header { background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%); padding: 36px 24px; text-align: center; color: #FFFFFF; border-bottom: 1px solid #334155; }
    .badge { display: inline-block; padding: 5px 14px; background-color: #10B981; color: #022C22; font-size: 12px; font-weight: 900; border-radius: 9999px; letter-spacing: 1px; }
    .title { font-size: 26px; font-weight: 900; margin: 16px 0 8px; color: #FFFFFF; letter-spacing: -0.5px; }
    .subtitle { font-size: 14px; color: #94A3B8; }
    .content { padding: 28px 24px; }
    .section-title { font-size: 18px; font-weight: 800; color: #F8FAFC; margin: 32px 0 14px; display: flex; align-items: center; }
    .quote-box { background-color: #1E293B; border-left: 4px solid #10B981; padding: 18px; border-radius: 0 12px 12px 0; margin-bottom: 24px; font-size: 16px; font-weight: 600; line-height: 1.6; color: #F1F5F9; }
    
    /* Above the fold Primary CTA */
    .quick-cta { display: block; background: linear-gradient(90deg, #10B981 0%, #059669 100%); color: #FFFFFF !important; text-align: center; padding: 14px 0; border-radius: 10px; font-size: 15px; font-weight: 800; text-decoration: none; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); }

    .grid-2 { display: table; width: 100%; margin-bottom: 16px; }
    .grid-col { display: table-cell; width: 50%; padding: 6px; box-sizing: border-box; }
    .metric-card { background-color: #111827; border: 1px solid #1F2937; border-radius: 12px; padding: 16px; text-align: center; }
    .metric-label { font-size: 12px; color: #94A3B8; font-weight: 700; }
    .metric-value { font-size: 22px; font-weight: 900; margin: 6px 0 4px; color: #F8FAFC; }
    
    .table-custom { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px; }
    .table-custom th { background-color: #1E293B; padding: 12px 10px; text-align: left; font-weight: 700; color: #94A3B8; border-bottom: 2px solid #334155; }
    .table-custom td { padding: 12px 10px; border-bottom: 1px solid #1E293B; color: #E2E8F0; }
    
    .btn-primary { display: block; width: 100%; background-color: #2563EB; color: #FFFFFF !important; text-align: center; padding: 16px 0; border-radius: 10px; font-size: 16px; font-weight: 800; text-decoration: none; margin: 32px 0 16px; box-sizing: border-box; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4); }
    .footer { background-color: #0B0F19; padding: 28px 24px; text-align: center; font-size: 12px; color: #64748B; border-top: 1px solid #1E293B; line-height: 1.7; }

    @media (prefers-color-scheme: light) {
      body { background-color: #F8FAFC; color: #1E293B; }
      .container { background-color: #FFFFFF; border-color: #E2E8F0; }
      .header { background: #0F172A; }
      .quote-box { background-color: #F1F5F9; color: #334155; }
      .metric-card { background-color: #F8FAFC; border-color: #E2E8F0; }
      .metric-value { color: #0F172A; }
      .table-custom th { background-color: #F1F5F9; color: #475569; border-color: #E2E8F0; }
      .table-custom td { border-color: #F1F5F9; color: #334155; }
      .section-title { color: #0F172A; }
      .footer { background-color: #F8FAFC; border-color: #E2E8F0; color: #64748B; }
    }
  </style>
</head>
<body>
  <div style="padding: 24px 12px;">
    <div class="container">
      <!-- Header -->
      <div class="header">
        <span class="badge">ETF CAMPUS · 18:30 DAILY BRIEFING</span>
        <div class="title">${formattedDate} 마켓 브리핑</div>
        <div class="subtitle">대한민국 ETF 시장 7-STEP 정량 분석 뉴스레터</div>
      </div>

      <!-- Content -->
      <div class="content">
        <!-- 1. Narrative Quote Box -->
        <div class="quote-box">
          "${headline}"
        </div>

        <!-- Above-the-fold Quick CTA -->
        <a href="${utmLink}" class="quick-cta">
          📊 1분 만에 오늘의 테마 롱숏 맵 &amp; AUM 브릿지 분석하기 →
        </a>

        <!-- Metric Grid -->
        <div class="grid-2">
          <div class="grid-col" style="padding-left: 0;">
            <div class="metric-card">
              <div class="metric-label">KOSPI 지수</div>
              <div class="metric-value tabular">${kospiClose.toLocaleString()}</div>
              <div style="font-size: 13px; font-weight: 800; color: ${kospiColor};" class="tabular">${kospiSign}${kospiChangePct.toFixed(2)}%</div>
            </div>
          </div>
          <div class="grid-col" style="padding-right: 0;">
            <div class="metric-card">
              <div class="metric-label">시장 체온 (등락폭)</div>
              <div class="metric-value" style="color: #10B981;">${temp}</div>
              <div style="font-size: 12px; color: #94A3B8;" class="tabular">상승 ${up} · 보합 ${flat} · 하락 ${down}</div>
            </div>
          </div>
        </div>

        <div class="grid-2">
          <div class="grid-col" style="padding-left: 0;">
            <div class="metric-card">
              <div class="metric-label">총 운용자산 (AUM)</div>
              <div class="metric-value tabular">${aumJo}조원</div>
              <div style="font-size: 12px; color: #94A3B8;">1,164개 상장 ETF</div>
            </div>
          </div>
          <div class="grid-col" style="padding-right: 0;">
            <div class="metric-card">
              <div class="metric-label">일 거래대금 / 회전율</div>
              <div class="metric-value tabular">${tradeJo}조원</div>
              <div style="font-size: 12px; color: #94A3B8;" class="tabular">회전율 2.57%</div>
            </div>
          </div>
        </div>

        <!-- 2. Asset Classes & YTD Matrix -->
        <div class="section-title">📊 7대 자산군 성과 매트릭스 (연초 대비 YTD 비교)</div>
        <table class="table-custom">
          <thead>
            <tr>
              <th>자산군</th>
              <th style="text-align: right;">AUM 비중</th>
              <th style="text-align: right;">당일 수익률</th>
              <th style="text-align: right;">연초대비(YTD)</th>
            </tr>
          </thead>
          <tbody>
            ${defaultAssetClasses.map(ac => `
              <tr>
                <td style="font-weight: 700;">${ac.assetClass}</td>
                <td style="text-align: right;" class="tabular">${ac.aumSharePct.toFixed(1)}%</td>
                <td style="text-align: right; font-weight: 800; color: ${ac.aumWeightedReturnPct > 0 ? '#EF4444' : '#38BDF8'};" class="tabular">${ac.aumWeightedReturnPct > 0 ? '+' : ''}${ac.aumWeightedReturnPct.toFixed(2)}%</td>
                <td style="text-align: right; font-weight: 800; color: ${ac.ytd > 0 ? '#EF4444' : '#38BDF8'};" class="tabular">${ac.ytd > 0 ? '+' : ''}${ac.ytd.toFixed(1)}%</td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        <!-- 3. Smart Money TOP 5 -->
        <div class="section-title">💰 스마트머니 당일 실질 순유입 TOP 5 (진성수급)</div>
        <table class="table-custom">
          <thead>
            <tr>
              <th>순위</th>
              <th>종목명 / 티커</th>
              <th style="text-align: right;">실질 순유입액</th>
              <th style="text-align: right;">당일 등락률</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="font-weight: 900; color: #10B981;">1</td>
              <td><div style="font-weight: 700;">KODEX 200</div><div style="font-size: 11px; color: #94A3B8;" class="tabular">069500 · 국내대표지수</div></td>
              <td style="text-align: right; font-weight: 900;" class="tabular">+4,250억원</td>
              <td style="text-align: right; font-weight: 800; color: #EF4444;" class="tabular">+1.25%</td>
            </tr>
            <tr>
              <td style="font-weight: 900; color: #10B981;">2</td>
              <td><div style="font-weight: 700;">KODEX 미국S&amp;P500TR</div><div style="font-size: 11px; color: #94A3B8;" class="tabular">379800 · 해외대표지수</div></td>
              <td style="text-align: right; font-weight: 900;" class="tabular">+3,120억원</td>
              <td style="text-align: right; font-weight: 800; color: #EF4444;" class="tabular">+0.95%</td>
            </tr>
            <tr>
              <td style="font-weight: 900; color: #10B981;">3</td>
              <td><div style="font-weight: 700;">TIGER 미국나스닥100</div><div style="font-size: 11px; color: #94A3B8;" class="tabular">133690 · 해외빅테크</div></td>
              <td style="text-align: right; font-weight: 900;" class="tabular">+2,850억원</td>
              <td style="text-align: right; font-weight: 800; color: #EF4444;" class="tabular">+1.65%</td>
            </tr>
            <tr>
              <td style="font-weight: 900; color: #10B981;">4</td>
              <td><div style="font-weight: 700;">PLUS 고배당주</div><div style="font-size: 11px; color: #94A3B8;" class="tabular">448290 · 국내고배당</div></td>
              <td style="text-align: right; font-weight: 900;" class="tabular">+1,950억원</td>
              <td style="text-align: right; font-weight: 800; color: #EF4444;" class="tabular">+0.45%</td>
            </tr>
            <tr>
              <td style="font-weight: 900; color: #10B981;">5</td>
              <td><div style="font-weight: 700;">ACE 미국30년국채액티브</div><div style="font-size: 11px; color: #94A3B8;" class="tabular">396500 · 미국장기채</div></td>
              <td style="text-align: right; font-weight: 900;" class="tabular">+1,650억원</td>
              <td style="text-align: right; font-weight: 800; color: #38BDF8;" class="tabular">-0.15%</td>
            </tr>
          </tbody>
        </table>

        <!-- Primary Full View CTA -->
        <a href="${utmLink}" class="btn-primary">
          🌐 62개 테마 롱숏 맵 &amp; AUM 브릿지 풀버전 분석하기 →
        </a>
      </div>

      <!-- Footer -->
      <div class="footer">
        <div><strong>ETF CAMPUS (ETF 캠퍼스)</strong></div>
        <div style="margin: 6px 0 12px;">퇴근길 18:30에 받아보는 가장 정확한 정량 ETF 마켓 브리핑</div>
        <div style="font-size: 11px; color: #64748B;">
          본 뉴스레터는 정보 제공을 목적으로 발송되며, 특정 금융투자상품의 매수·매도를 권유하지 않습니다.<br>
          투자 원금의 손실 위험이 따를 수 있으며, 최종 투자 책임은 투자자 본인에게 있습니다.
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-cache",
    },
  });
}
