import type { MarketBriefingPayload } from "../types";

export function generateNewsletterHtml(payload: MarketBriefingPayload, baseUrl: string): { subject: string; html: string } {
  const dateStr = payload.asOfDate || "2026-08-28";
  const formattedDate = dateStr.replace(/-/g, ".");
  const temp = payload.marketTemperature || "하락 우세";

  const kospiClose = payload.kospiClose || 2600.00;
  const kospiChangePct = payload.kospiChangePct ?? -1.79;
  const kospiColor = kospiChangePct > 0 ? "#EF4444" : kospiChangePct < 0 ? "#38BDF8" : "#94A3B8";
  const kospiSign = kospiChangePct > 0 ? "+" : "";

  const etfReturn = payload.generalAumWeightedReturnPct ?? -0.86;
  const etfSign = etfReturn > 0 ? "+" : "";
  const etfColor = etfReturn > 0 ? "#EF4444" : etfReturn < 0 ? "#38BDF8" : "#94A3B8";
  const spread = etfReturn - kospiChangePct;
  const spreadSign = spread > 0 ? "+" : "";

  const aumJo = ((payload.generalTotalAum || 3851607) / 10000).toFixed(1);
  const tradeJo = ((payload.generalTotalTradeValue || 87792) / 10000).toFixed(1);
  const turnoverPct = payload.marketTurnoverPct ?? 2.28;

  const up = payload.upCount || 350;
  const flat = payload.flatCount || 35;
  const down = payload.downCount || 637;
  
  const headline = payload.headlineText || `일반 ETF 1,022개 중 ${down}개가 하락한 냉각 장세입니다. 하지만 KOSPI ${kospiSign}${kospiChangePct.toFixed(2)}% 대비 일반 ETF는 ${etfSign}${etfReturn.toFixed(2)}%로 ${spreadSign}${spread.toFixed(2)}%p 초과 방어력을 보였습니다.`;
  
  const utmLink = `${baseUrl}/briefing?utm_source=newsletter&utm_medium=email&utm_campaign=daily_briefing_${dateStr.replace(/-/g, "")}`;

  const subject = `[마켓 브리핑] ${formattedDate} ETF 시장 핵심 요약`;

  // Use actual asset classes from payload, fallback if missing
  const assetClasses = payload.assetClasses && payload.assetClasses.length > 0 ? payload.assetClasses : [];
  
  // Use actual top inflows, fallback to fundFlow or empty array
  const topInflows: any[] = (payload.fundFlow?.general?.topInflows || payload.periodicFlows?.dailyFundFlows?.topInflows || []) as any[];

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Pretendard", "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #0F172A; color: #F8FAFC; -webkit-font-smoothing: antialiased; }
    .container { max-width: 600px; margin: 0 auto; background-color: #1E293B; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid #334155; }
    .header { background: #0B0F19; padding: 32px 24px; text-align: center; border-bottom: 1px solid #334155; }
    .badge { display: inline-block; background-color: #2563EB; color: #FFFFFF; padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 16px; }
    .title { font-size: 28px; font-weight: 900; margin: 0 0 8px; color: #F8FAFC; letter-spacing: -0.5px; }
    .subtitle { font-size: 14px; color: #94A3B8; font-weight: 500; }
    .content { padding: 32px 24px; }
    
    .quote-box { background-color: #0F172A; border-left: 4px solid #38BDF8; padding: 20px; border-radius: 0 8px 8px 0; margin-bottom: 32px; font-size: 16px; line-height: 1.6; font-weight: 600; color: #E2E8F0; }
    .tabular { font-variant-numeric: tabular-nums; }
    
    .quick-cta { display: block; text-align: center; background-color: #334155; color: #F8FAFC !important; text-decoration: none; padding: 14px; border-radius: 8px; font-size: 14px; font-weight: 700; margin-bottom: 32px; }
    
    .grid-2 { display: table; width: 100%; margin-bottom: 16px; }
    .grid-col { display: table-cell; width: 50%; padding: 0 8px; vertical-align: top; box-sizing: border-box; }
    
    .metric-card { background-color: #0F172A; border: 1px solid #334155; border-radius: 12px; padding: 20px; text-align: center; height: 100%; box-sizing: border-box; }
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
      <div class="header">
        <span class="badge">ETF CAMPUS · 18:30 DAILY BRIEFING</span>
        <div class="title">${formattedDate} 마켓 브리핑</div>
        <div class="subtitle">국내 상장 ETF 시장 7-STEP 정량 분석 뉴스레터</div>
      </div>

      <div class="content">
        <div class="quote-box">
          "${headline}"
        </div>

        <a href="${utmLink}" class="quick-cta">
          👉 1분 만에 오늘의 테마 롱숏 맵 & AUM 브릿지 분석하기 👈
        </a>

        <div class="grid-2">
          <div class="grid-col" style="padding-left: 0;">
            <div class="metric-card">
              <div class="metric-label">KOSPI vs 일반 ETF</div>
              <div class="metric-value tabular" style="font-size: 19px;">
                <span style="color: ${kospiColor};">${kospiSign}${kospiChangePct.toFixed(2)}%</span> / <span style="color: ${etfColor};">${etfSign}${etfReturn.toFixed(2)}%</span>
              </div>
              <div style="font-size: 12px; font-weight: 800; color: #10B981;" class="tabular">${spreadSign}${spread.toFixed(2)}%p 초과 방어력</div>
            </div>
          </div>
          <div class="grid-col" style="padding-right: 0;">
            <div class="metric-card">
              <div class="metric-label">시장 체온 (등락 분포)</div>
              <div class="metric-value" style="color: #38BDF8;">${temp}</div>
              <div style="font-size: 12px; color: #94A3B8;" class="tabular">상승 ${up} · 보합 ${flat} · 하락 ${down}</div>
            </div>
          </div>
        </div>

        <div class="grid-2">
          <div class="grid-col" style="padding-left: 0;">
            <div class="metric-card">
              <div class="metric-label">총 운용자산 (AUM)</div>
              <div class="metric-value tabular">${aumJo}조원</div>
              <div style="font-size: 12px; color: #94A3B8;">1,022개 일반 ETF 기준</div>
            </div>
          </div>
          <div class="grid-col" style="padding-right: 0;">
            <div class="metric-card">
              <div class="metric-label">일 거래대금 / 회전율</div>
              <div class="metric-value tabular">${tradeJo}조원</div>
              <div style="font-size: 12px; color: #94A3B8;" class="tabular">회전율 ${turnoverPct.toFixed(2)}%</div>
            </div>
          </div>
        </div>

        <div class="section-title" style="margin-top: 32px; margin-bottom: 12px; font-size: 16px; font-weight: 800;">📊 6대 자산군 성과 매트릭스</div>
        <table class="table-custom">
          <thead>
            <tr>
              <th>자산군</th>
              <th style="text-align: right;">AUM 비중</th>
              <th style="text-align: right;">당일 수익률</th>
              <th style="text-align: right;">연초후(YTD)</th>
            </tr>
          </thead>
          <tbody>
            ${assetClasses.map(ac => {
              const aumShare = ac.aumSharePct ?? 0;
              const ret = ac.aumWeightedReturnPct ?? 0;
              const ytd = ac.ytdReturnPct ?? 0;
              return `
              <tr>
                <td style="font-weight: 700;">${ac.assetClass}</td>
                <td style="text-align: right;" class="tabular">${aumShare.toFixed(1)}%</td>
                <td style="text-align: right; font-weight: 800; color: ${ret > 0 ? '#EF4444' : ret < 0 ? '#38BDF8' : '#94A3B8'};" class="tabular">${ret > 0 ? '+' : ''}${ret.toFixed(2)}%</td>
                <td style="text-align: right; font-weight: 800; color: ${ytd > 0 ? '#EF4444' : ytd < 0 ? '#38BDF8' : '#94A3B8'};" class="tabular">${ytd > 0 ? '+' : ''}${ytd.toFixed(1)}%</td>
              </tr>
            `;}).join("")}
          </tbody>
        </table>

        <div class="section-title" style="margin-top: 32px; margin-bottom: 12px; font-size: 16px; font-weight: 800;">💸 실질 순유입 TOP 5</div>
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
            ${topInflows.slice(0, 5).map((item, idx) => {
              const name = item.name || item.etfName || item.ticker || "";
              const ticker = item.ticker || "";
              const assetClass = item.assetClass || "주식";
              const inflowEok = item.inflow ? Math.round(item.inflow) : item.inflowAmount ? Math.round(item.inflowAmount / 100000000) : item.netInflowValue ? Math.round(item.netInflowValue / 100000000) : 0;
              const chg = item.changePct ?? item.change_pct ?? 0;
              return `
            <tr>
              <td style="font-weight: 900; color: #10B981;">${idx + 1}</td>
              <td><div style="font-weight: 700;">${name}</div><div style="font-size: 11px; color: #94A3B8;" class="tabular">${ticker} · ${assetClass}</div></td>
              <td style="text-align: right; font-weight: 900;" class="tabular">+${inflowEok.toLocaleString()}억원</td>
              <td style="text-align: right; font-weight: 800; color: ${chg > 0 ? '#EF4444' : chg < 0 ? '#38BDF8' : '#94A3B8'};" class="tabular">${chg > 0 ? '+' : ''}${chg.toFixed(2)}%</td>
            </tr>
            `;}).join("")}
          </tbody>
        </table>

        <a href="${utmLink}" class="btn-primary">
          👉 완벽 비교기 & 테마 롱숏 맵 풀버전 분석하기 👈
        </a>
      </div>

      <div class="footer">
        <div><strong>ETF CAMPUS (ETF 캠퍼스)</strong></div>
        <div style="margin: 6px 0 12px;">매일 아침 가장 정확한 정량 ETF 마켓 브리핑</div>
        <div style="font-size: 11px; color: #64748B;">
          본 뉴스레터는 정보 제공을 목적으로 발송되며, 특정 금융투자상품의 매수·매도를 권유하지 않습니다.<br>
          투자 원금의 손실 위험이 따를 수 있으며, 최종 투자 책임은 투자자 본인에게 있습니다.
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

  return { subject, html };
}
