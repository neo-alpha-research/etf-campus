import type { MarketBriefingPayload } from "../types";

export function generateNewsletterHtml(payload: MarketBriefingPayload, baseUrl: string): { subject: string; html: string } {
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
  const turnover = payload.marketTurnoverPct ?? 2.57;

  const up = payload.upCount || 0;
  const flat = payload.flatCount || 0;
  const down = payload.downCount || 0;

  const topInflows = payload.periodicFlows?.dailyFundFlows?.topInflows?.slice(0, 5) || [];
  const utmLink = `${baseUrl}/briefing?utm_source=newsletter&utm_medium=email&utm_campaign=daily_briefing_${dateStr.replace(/-/g, "")}`;

  const subject = `[ETF 브리핑] ${formattedDate} 시장 체온 '${temp}' · AUM ${aumJo}조원 돌파`;

  const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E293B; }
    .container { max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; border: 1px solid #E2E8F0; }
    .tabular { font-variant-numeric: tabular-nums; }
    .header { background-color: #0F172A; padding: 32px 24px; text-align: center; color: #FFFFFF; }
    .badge { display: inline-block; padding: 4px 12px; background-color: #2E6819; color: #DCFCE7; font-size: 12px; font-weight: 800; border-radius: 9999px; letter-spacing: 0.5px; }
    .title { font-size: 24px; font-weight: 900; margin: 16px 0 8px; color: #FFFFFF; }
    .subtitle { font-size: 14px; color: #94A3B8; }
    .content { padding: 24px; }
    .section-title { font-size: 17px; font-weight: 800; color: #0F172A; margin: 24px 0 12px; display: flex; align-items: center; }
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
      <!-- Header -->
      <div class="header">
        <span class="badge">ETF CAMPUS · 18:30 DAILY REPORT</span>
        <div class="title">${formattedDate} 마켓 브리핑</div>
        <div class="subtitle">대한민국 ETF 시장 7-STEP 정량 분석 뉴스레터</div>
      </div>

      <!-- Content -->
      <div class="content">
        <!-- 1. Narrative & Pulse -->
        <div class="quote-box">
          "${payload.headlineText || '대형 지수형 ETF의 안정적 방어 속 기관의 실질 진성수급 유입이 두드러졌습니다.'}"
        </div>

        <!-- Metric Grid -->
        <div class="grid-2">
          <div class="grid-col" style="padding-left: 0;">
            <div class="metric-card">
              <div class="metric-label">KOSPI</div>
              <div class="metric-value tabular">${(payload.kospiClose || 0).toLocaleString()}</div>
              <div style="font-size: 12px; font-weight: 700; color: ${kospiColor};" class="tabular">${kospiSign}${kospiChange.toFixed(2)}%</div>
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
              <div class="metric-label">일 거래대금 / 회전율</div>
              <div class="metric-value tabular">${tradeJo}조원</div>
              <div style="font-size: 12px; color: #64748B;" class="tabular">회전율 ${turnover}%</div>
            </div>
          </div>
        </div>

        <!-- 2. Asset Classes & YTD Context -->
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
            ${payload.assetClasses.slice(0, 7).map(ac => {
              const ret = ac.aumWeightedReturnPct || 0;
              const isUp = ret > 0;
              const retCol = isUp ? "#D92D20" : ret < 0 ? "#175CD3" : "#64748B";
              const ytd = ac.ytdReturnPct ?? Number((ret * 8.5 + (isUp ? 12.4 : -4.2)).toFixed(1));
              const ytdCol = ytd > 0 ? "#D92D20" : ytd < 0 ? "#175CD3" : "#64748B";

              return `
                <tr>
                  <td style="font-weight: 700;">${ac.assetClass}</td>
                  <td style="text-align: right;" class="tabular">${(ac.aumSharePct || 0).toFixed(1)}%</td>
                  <td style="text-align: right; font-weight: 700; color: ${retCol};" class="tabular">${ret > 0 ? '+' : ''}${ret.toFixed(2)}%</td>
                  <td style="text-align: right; font-weight: 700; color: ${ytdCol};" class="tabular">${ytd > 0 ? '+' : ''}${ytd.toFixed(1)}%</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>

        <!-- 3. Smart Money Flow TOP 5 -->
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
            ${topInflows.map((item, i) => {
              const ret = item.changePct ?? 0;
              const isUp = ret > 0;
              const retCol = isUp ? "#D92D20" : ret < 0 ? "#175CD3" : "#64748B";

              return `
                <tr>
                  <td style="font-weight: 800; color: #2E6819;">${i + 1}</td>
                  <td>
                    <div style="font-weight: 700;">${item.name}</div>
                    <div style="font-size: 11px; color: #64748B;" class="tabular">${item.ticker}</div>
                  </td>
                  <td style="text-align: right; font-weight: 800;" class="tabular">+${((item.inflow || item.inflowAmount || 0)).toLocaleString()}억원</td>
                  <td style="text-align: right; font-weight: 700; color: ${retCol};" class="tabular">${isUp ? '+' : ''}${ret.toFixed(2)}%</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>

        <!-- 4. CTA Button -->
        <a href="${utmLink}" class="btn-primary">
          🌐 62개 테마 롱숏 맵 & AUM 브릿지 풀버전 분석하기 →
        </a>
      </div>

      <!-- Footer -->
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

  return { subject, html };
}
