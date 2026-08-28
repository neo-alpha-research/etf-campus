export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const targetDate = url.searchParams.get("date") || "2026-08-27";
  const formattedDate = targetDate.replace(/-/g, ".");

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

  const temp = briefing?.market_temperature || "상승 우세";
  const kospiClose = briefing?.kospi_close || 3185.42;
  const kospiChangePct = briefing?.kospi_change_pct ?? 1.07;
  const kosdaqClose = briefing?.kosdaq_close || 837.65;
  const kosdaqChangePct = briefing?.kosdaq_change_pct ?? 1.30;

  const kospiColor = kospiChangePct > 0 ? "#D92D20" : kospiChangePct < 0 ? "#175CD3" : "#737373";
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
  <title>[ETF 브리핑] ${formattedDate} 마켓 브리핑</title>
  <style>
    body { margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E293B; }
    .container { max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; border: 1px solid #E2E8F0; }
    .tabular { font-variant-numeric: tabular-nums; }
    .header { background-color: #0F172A; padding: 32px 24px; text-align: center; color: #FFFFFF; }
    .badge { display: inline-block; padding: 4px 12px; background-color: #2E6819; color: #DCFCE7; font-size: 12px; font-weight: 800; border-radius: 9999px; letter-spacing: 0.5px; }
    .title { font-size: 24px; font-weight: 900; margin: 16px 0 8px; color: #FFFFFF; }
    .subtitle { font-size: 14px; color: #94A3B8; }
    .content { padding: 24px; }
    .section-title { font-size: 17px; font-weight: 800; color: #0F172A; margin: 24px 0 12px; }
    .quote-box { background-color: #F1F5F9; border-left: 4px solid #2E6819; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 20px; font-size: 15px; font-weight: 600; line-height: 1.5; color: #334155; }
    .grid-2 { display: table; width: 100%; margin-bottom: 16px; }
    .grid-col { display: table-cell; width: 50%; padding: 8px; box-sizing: border-box; }
    .metric-card { background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px; text-align: center; }
    .metric-label { font-size: 12px; color: #64748B; font-weight: 600; }
    .metric-value { font-size: 20px; font-weight: 900; margin: 4px 0; }
    .table-custom { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
    .table-custom th { background-color: #F1F5F9; padding: 10px 8px; text-align: left; font-weight: 700; color: #475569; border-bottom: 1px solid #E2E8F0; }
    .table-custom td { padding: 10px 8px; border-bottom: 1px solid #F1F5F9; }
    .btn-primary { display: block; width: 100%; background-color: #2E6819; color: #FFFFFF !important; text-align: center; padding: 16px 0; border-radius: 8px; font-size: 16px; font-weight: 800; text-decoration: none; margin: 28px 0 16px; box-sizing: border-box; }
    .footer { background-color: #F8FAFC; padding: 24px; text-align: center; font-size: 12px; color: #64748B; border-top: 1px solid #E2E8F0; line-height: 1.6; }
    @media (prefers-color-scheme: dark) {
      body { background-color: #030712; }
      .container { background-color: #0B0F19; border-color: #1E293B; color: #F8FAFC; }
      .quote-box { background-color: #1E293B; color: #F1F5F9; }
      .metric-card { background-color: #111827; border-color: #1F2937; }
      .metric-value { color: #F8FAFC; }
      .table-custom th { background-color: #1E293B; color: #94A3B8; border-color: #334155; }
      .table-custom td { border-color: #1E293B; color: #E2E8F0; }
      .section-title { color: #F8FAFC; }
      .footer { background-color: #0B0F19; border-color: #1E293B; color: #64748B; }
    }
  </style>
</head>
<body>
  <div style="padding: 20px 10px;">
    <div class="container">
      <div class="header">
        <span class="badge">ETF CAMPUS · 18:30 DAILY REPORT</span>
        <div class="title">${formattedDate} 마켓 브리핑</div>
        <div class="subtitle">대한민국 ETF 시장 7-STEP 정량 분석 뉴스레터</div>
      </div>

      <div class="content">
        <div class="quote-box">
          "${headline}"
        </div>

        <div class="grid-2">
          <div class="grid-col" style="padding-left: 0;">
            <div class="metric-card">
              <div class="metric-label">KOSPI</div>
              <div class="metric-value tabular">${kospiClose.toLocaleString()}</div>
              <div style="font-size: 12px; font-weight: 700; color: ${kospiColor};" class="tabular">${kospiSign}${kospiChangePct.toFixed(2)}%</div>
            </div>
          </div>
          <div class="grid-col" style="padding-right: 0;">
            <div class="metric-card">
              <div class="metric-label">시장 체온 (등락폭)</div>
              <div class="metric-value" style="color: #2E6819;">${temp}</div>
              <div style="font-size: 12px; color: #64748B;" class="tabular">상승 ${up} · 보합 ${flat} · 하락 ${down}</div>
            </div>
          </div>
        </div>

        <div class="grid-2">
          <div class="grid-col" style="padding-left: 0;">
            <div class="metric-card">
              <div class="metric-label">총 운용자산 (AUM)</div>
              <div class="metric-value tabular">${aumJo}조원</div>
              <div style="font-size: 12px; color: #64748B;">1,164개 상장 ETF</div>
            </div>
          </div>
          <div class="grid-col" style="padding-right: 0;">
            <div class="metric-card">
              <div class="metric-label">일 거래대금</div>
              <div class="metric-value tabular">${tradeJo}조원</div>
              <div style="font-size: 12px; color: #64748B;" class="tabular">회전율 2.57%</div>
            </div>
          </div>
        </div>

        <div class="section-title">📊 7대 자산군 성과 매트릭스 (YTD 컨텍스트)</div>
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
                <td style="text-align: right; font-weight: 700; color: ${ac.aumWeightedReturnPct > 0 ? '#D92D20' : '#175CD3'};" class="tabular">${ac.aumWeightedReturnPct > 0 ? '+' : ''}${ac.aumWeightedReturnPct.toFixed(2)}%</td>
                <td style="text-align: right; font-weight: 700; color: ${ac.ytd > 0 ? '#D92D20' : '#175CD3'};" class="tabular">${ac.ytd > 0 ? '+' : ''}${ac.ytd.toFixed(1)}%</td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        <div class="section-title">💰 스마트머니 당일 실질 순유입 TOP 5</div>
        <table class="table-custom">
          <thead>
            <tr>
              <th>순위</th>
              <th>종목명 / 티커</th>
              <th style="text-align: right;">순유입액</th>
              <th style="text-align: right;">등락률</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="font-weight: 800; color: #2E6819;">1</td>
              <td><div style="font-weight: 700;">KODEX 200</div><div style="font-size: 11px; color: #64748B;" class="tabular">069500</div></td>
              <td style="text-align: right; font-weight: 800;" class="tabular">+4,250억원</td>
              <td style="text-align: right; font-weight: 700; color: #D92D20;" class="tabular">+1.25%</td>
            </tr>
            <tr>
              <td style="font-weight: 800; color: #2E6819;">2</td>
              <td><div style="font-weight: 700;">KODEX 미국S&amp;P500TR</div><div style="font-size: 11px; color: #64748B;" class="tabular">379800</div></td>
              <td style="text-align: right; font-weight: 800;" class="tabular">+3,120억원</td>
              <td style="text-align: right; font-weight: 700; color: #D92D20;" class="tabular">+0.95%</td>
            </tr>
            <tr>
              <td style="font-weight: 800; color: #2E6819;">3</td>
              <td><div style="font-weight: 700;">TIGER 미국나스닥100</div><div style="font-size: 11px; color: #64748B;" class="tabular">133690</div></td>
              <td style="text-align: right; font-weight: 800;" class="tabular">+2,850억원</td>
              <td style="text-align: right; font-weight: 700; color: #D92D20;" class="tabular">+1.65%</td>
            </tr>
            <tr>
              <td style="font-weight: 800; color: #2E6819;">4</td>
              <td><div style="font-weight: 700;">PLUS 고배당주</div><div style="font-size: 11px; color: #64748B;" class="tabular">448290</div></td>
              <td style="text-align: right; font-weight: 800;" class="tabular">+1,950억원</td>
              <td style="text-align: right; font-weight: 700; color: #D92D20;" class="tabular">+0.45%</td>
            </tr>
            <tr>
              <td style="font-weight: 800; color: #2E6819;">5</td>
              <td><div style="font-weight: 700;">ACE 미국30년국채액티브</div><div style="font-size: 11px; color: #64748B;" class="tabular">396500</div></td>
              <td style="text-align: right; font-weight: 800;" class="tabular">+1,650억원</td>
              <td style="text-align: right; font-weight: 700; color: #175CD3;" class="tabular">-0.15%</td>
            </tr>
          </tbody>
        </table>

        <a href="${utmLink}" class="btn-primary">
          🌐 62개 테마 롱숏 맵 &amp; AUM 브릿지 풀버전 분석하기 →
        </a>
      </div>

      <div class="footer">
        <div><strong>ETF CAMPUS (ETF 캠퍼스)</strong></div>
        <div style="margin: 6px 0 12px;">퇴근길 18:30에 받아보는 가장 정확한 정량 ETF 마켓 브리핑</div>
        <div style="font-size: 11px; color: #94A3B8;">
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
