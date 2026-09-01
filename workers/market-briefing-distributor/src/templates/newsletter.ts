import type { MarketBriefingPayload } from "../types";

function normalizeToEok(val: number | string | undefined | null): number {
  if (!val) return 0;
  const num = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : val;
  if (isNaN(num)) return 0;
  if (num > 10_000_000_000) {
    return Math.round(num / 100_000_000);
  }
  return Math.round(num);
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

export function generateNewsletterHtml(payload: MarketBriefingPayload, baseUrl: string): { subject: string; html: string } {
  const dateStr = payload.asOfDate || "2026-08-31";
  const formattedDate = dateStr.replace(/-/g, ".");
  const temp = payload.marketTemperature || "하락 우세";

  const kospiClose = payload.kospiClose || 2600.00;
  const kospiChangePct = payload.kospiChangePct ?? 0.46;
  const kospiColor = kospiChangePct >= 0 ? "#DC2626" : "#2563EB";
  const kospiSign = kospiChangePct > 0 ? "+" : "";

  const kosdaqChangePct = payload.kosdaqChangePct ?? -0.49;
  const kosdaqColor = kosdaqChangePct >= 0 ? "#DC2626" : "#2563EB";
  const kosdaqSign = kosdaqChangePct > 0 ? "+" : "";

  const etfReturn = payload.generalAumWeightedReturnPct ?? -0.28;
  const etfSign = etfReturn > 0 ? "+" : "";
  const etfColor = etfReturn >= 0 ? "#DC2626" : "#2563EB";

  const genAumEok = normalizeToEok(payload.pulse?.generalTotalAum || payload.generalTotalAum || 3814729);
  const genTradeEok = normalizeToEok(payload.pulse?.generalTotalTradeValue || payload.generalTotalTradeValue || 100551);
  const aumJo = (genAumEok / 10000).toFixed(1);
  const tradeJo = (genTradeEok / 10000).toFixed(1);
  const turnoverPct = genAumEok > 0 ? ((genTradeEok / genAumEok) * 100) : (payload.marketTurnoverPct ?? 2.64);

  const up = payload.upCount || 305;
  const flat = payload.flatCount || 47;
  const down = payload.downCount || 670;
  const generalCount = payload.generalEtfCount || 1022;
  
  const headline = payload.headlineText || `국내 상장 일반 ETF ${generalCount.toLocaleString()}개 중 ${down}개가 하락한 숨고르기 장세입니다. 코스피(+0.46%) 대비 일반 ETF 시장 평균은 ${etfSign}${etfReturn.toFixed(2)}%를 기록했으나, 2차전지(+2.71%)와 스마트머니(+1,130억원)의 반도체 저가 분할 매수세가 돋보였습니다.`;
  
  const utmLink = `${baseUrl}/briefing?utm_source=newsletter&utm_medium=email&utm_campaign=daily_briefing_${dateStr.replace(/-/g, "")}`;

  const subject = `[ETF 마켓 브리핑] ${formattedDate} 시장 핵심 요약 & 수급 분석`;

  // Themes
  const sortedPeerGroups = [...(payload.peerGroups || [])].sort((a, b) => b.cappedAumWeightedReturnPct - a.cappedAumWeightedReturnPct);
  const winners = sortedPeerGroups.filter(p => p.cappedAumWeightedReturnPct > 0).slice(0, 3);
  const losers = [...sortedPeerGroups].reverse().filter(p => p.cappedAumWeightedReturnPct < 0).slice(0, 3);

  // Asset classes
  const assetClasses = payload.assetClasses && payload.assetClasses.length > 0 ? payload.assetClasses : [];
  
  // Top inflows
  const topInflows: any[] = (payload.periodicFlows?.dailyFundFlows?.topInflows || []) as any[];

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; background-color: #F1F5F9; color: #1E293B; -webkit-font-smoothing: antialiased; }
    .container { max-width: 620px; margin: 24px auto; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08); border: 1px solid #E2E8F0; }
    .header { background: linear-gradient(135deg, #064E3B 0%, #047857 100%); padding: 36px 28px; text-align: center; color: #FFFFFF; }
    .badge { display: inline-block; background-color: rgba(255, 255, 255, 0.2); color: #A7F3D0; padding: 5px 14px; border-radius: 999px; font-size: 11.5px; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 12px; border: 1px solid rgba(255, 255, 255, 0.25); }
    .title { font-size: 26px; font-weight: 900; margin: 0 0 6px; color: #FFFFFF; letter-spacing: -0.5px; }
    .subtitle { font-size: 13.5px; color: #D1FAE5; font-weight: 600; }
    .content { padding: 32px 24px; }
    
    .quote-box { background-color: #F8FAFC; border-left: 4px solid #10B981; padding: 18px 20px; border-radius: 0 12px 12px 0; margin-bottom: 26px; font-size: 15px; line-height: 1.65; font-weight: 600; color: #334155; border-top: 1px solid #E2E8F0; border-right: 1px solid #E2E8F0; border-bottom: 1px solid #E2E8F0; }
    .tabular { font-variant-numeric: tabular-nums; }
    
    .grid-2 { display: table; width: 100%; margin-bottom: 14px; border-spacing: 0; }
    .grid-col { display: table-cell; width: 50%; padding: 0 6px; vertical-align: top; box-sizing: border-box; }
    
    .metric-card { background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 14px; padding: 16px; text-align: center; box-sizing: border-box; }
    .metric-label { font-size: 11.5px; color: #64748B; font-weight: 700; margin-bottom: 4px; }
    .metric-value { font-size: 22px; font-weight: 900; margin: 4px 0; color: #0F172A; }
    
    .section-title { margin-top: 30px; margin-bottom: 12px; font-size: 16px; font-weight: 900; color: #0F172A; }
    
    .table-custom { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13.5px; border-radius: 12px; overflow: hidden; border: 1px solid #E2E8F0; }
    .table-custom th { background-color: #F8FAFC; padding: 11px 12px; text-align: left; font-weight: 800; color: #475569; border-bottom: 1px solid #E2E8F0; font-size: 12.5px; }
    .table-custom td { padding: 11px 12px; border-bottom: 1px solid #F1F5F9; color: #334155; }
    .table-custom tr:last-child td { border-bottom: none; }
    
    .btn-primary { display: block; width: 100%; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #FFFFFF !important; text-align: center; padding: 16px 0; border-radius: 12px; font-size: 16px; font-weight: 900; text-decoration: none; margin: 30px 0 10px; box-sizing: border-box; box-shadow: 0 4px 14px rgba(5, 150, 105, 0.35); }
    .footer { background-color: #F8FAFC; padding: 26px 24px; text-align: center; font-size: 12px; color: #64748B; border-top: 1px solid #E2E8F0; line-height: 1.65; }
  </style>
</head>
<body>
  <div style="padding: 16px 8px;">
    <div class="container">
      <!-- Header -->
      <div class="header">
        <span class="badge">ETF CAMPUS · DAILY BRIEFING</span>
        <div class="title">${formattedDate} ETF 마켓 브리핑</div>
        <div class="subtitle">국내 상장 일반 ETF ${generalCount}개 전수 데이터 분석 뉴스레터</div>
      </div>

      <!-- Content -->
      <div class="content">
        <!-- Headline Quote -->
        <div class="quote-box">
          "${headline}"
        </div>

        <!-- 4-Card Overview Grid -->
        <div class="grid-2">
          <div class="grid-col" style="padding-left: 0;">
            <div class="metric-card">
              <div class="metric-label">KOSPI vs 일반 ETF</div>
              <div class="metric-value tabular" style="font-size: 18px;">
                <span style="color: ${kospiColor};">${kospiSign}${kospiChangePct.toFixed(2)}%</span> / <span style="color: ${etfColor};">${etfSign}${etfReturn.toFixed(2)}%</span>
              </div>
              <div style="font-size: 11px; font-weight: 700; color: #64748B;">KOSDAQ ${kosdaqSign}${kosdaqChangePct.toFixed(2)}%</div>
            </div>
          </div>
          <div class="grid-col" style="padding-right: 0;">
            <div class="metric-card">
              <div class="metric-label">시장 체온 (등락 분포)</div>
              <div class="metric-value" style="color: #2563EB; font-size: 18px;">${temp}</div>
              <div style="font-size: 11px; color: #64748B;" class="tabular">상승 ${up} · 보합 ${flat} · 하락 ${down}</div>
            </div>
          </div>
        </div>

        <div class="grid-2">
          <div class="grid-col" style="padding-left: 0;">
            <div class="metric-card">
              <div class="metric-label">일반 ETF 총 순자산 (AUM)</div>
              <div class="metric-value tabular">${aumJo}조원</div>
              <div style="font-size: 11px; color: #64748B;">${generalCount}개 일반 종목 기준</div>
            </div>
          </div>
          <div class="grid-col" style="padding-right: 0;">
            <div class="metric-card">
              <div class="metric-label">일 거래대금 / 시장 회전율</div>
              <div class="metric-value tabular">${tradeJo}조원</div>
              <div style="font-size: 11px; color: #64748B;" class="tabular">일일 회전율 ${turnoverPct.toFixed(1)}%</div>
            </div>
          </div>
        </div>

        <!-- Section 1: Themes Long/Short -->
        <div class="section-title">🔥 주도 테마 TOP 3 vs 부진 테마 TOP 3</div>
        <table class="table-custom">
          <thead>
            <tr>
              <th>구분</th>
              <th>테마명</th>
              <th style="text-align: right;">AUM 가중수익률</th>
            </tr>
          </thead>
          <tbody>
            ${winners.map((w, idx) => `
              <tr>
                <td style="font-weight: 900; color: #DC2626;">상승 ${idx + 1}위</td>
                <td style="font-weight: 800; color: #0F172A;">${escapeXml(w.peerGroup)}</td>
                <td style="text-align: right; font-weight: 900; color: #DC2626;" class="tabular">▲ +${w.cappedAumWeightedReturnPct.toFixed(2)}%</td>
              </tr>
            `).join("")}
            ${losers.map((l, idx) => `
              <tr>
                <td style="font-weight: 900; color: #2563EB;">하락 ${idx + 1}위</td>
                <td style="font-weight: 800; color: #0F172A;">${escapeXml(l.peerGroup)}</td>
                <td style="text-align: right; font-weight: 900; color: #2563EB;" class="tabular">▼ ${l.cappedAumWeightedReturnPct.toFixed(2)}%</td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        <!-- Section 2: Top Inflows -->
        <div class="section-title">💸 스마트머니(기관·외인) 실질 순유입 TOP 5</div>
        <table class="table-custom">
          <thead>
            <tr>
              <th style="width: 40px;">순위</th>
              <th>종목명 / 티커</th>
              <th style="text-align: right;">실질 순유입액</th>
            </tr>
          </thead>
          <tbody>
            ${topInflows.slice(0, 5).map((item, idx) => {
              const name = item.name || item.etfName || item.ticker || "";
              const ticker = item.ticker || "";
              const inflowEok = item.inflow ? Math.round(item.inflow) : item.netInflowValue ? Math.round(item.netInflowValue / 100000000) : 0;
              return `
              <tr>
                <td style="font-weight: 900; color: ${idx === 0 ? '#059669' : '#64748B'}; text-align: center;">${idx + 1}</td>
                <td>
                  <div style="font-weight: 800; color: #0F172A;">${escapeXml(name)}</div>
                  <div style="font-size: 11px; color: #64748B;" class="tabular">${escapeXml(ticker)}</div>
                </td>
                <td style="text-align: right; font-weight: 900; color: #047857;" class="tabular">+${inflowEok.toLocaleString()}억원</td>
              </tr>
              `;
            }).join("")}
          </tbody>
        </table>

        <!-- Section 3: Asset Classes -->
        <div class="section-title">📊 6대 자산군 성과 & 비중</div>
        <table class="table-custom">
          <thead>
            <tr>
              <th>자산군</th>
              <th style="text-align: right;">AUM 비중</th>
              <th style="text-align: right;">당일 가중수익률</th>
            </tr>
          </thead>
          <tbody>
            ${assetClasses.map(ac => {
              const aumShare = ac.aumSharePct ?? 0;
              const ret = ac.aumWeightedReturnPct ?? 0;
              return `
              <tr>
                <td style="font-weight: 800; color: #0F172A;">${escapeXml(ac.assetClass)}</td>
                <td style="text-align: right;" class="tabular">${aumShare.toFixed(1)}%</td>
                <td style="text-align: right; font-weight: 900; color: ${ret >= 0 ? '#DC2626' : '#2563EB'};" class="tabular">${ret >= 0 ? '+' : ''}${ret.toFixed(2)}%</td>
              </tr>
            `;}).join("")}
          </tbody>
        </table>

        <!-- Call to Action -->
        <a href="${utmLink}" class="btn-primary">
          👉 전체 ETF 괴리율 & 완벽 비교 리포트 보러가기 📊
        </a>
      </div>

      <!-- Footer -->
      <div class="footer">
        <div><strong>ETF CAMPUS (ETF 캠퍼스)</strong></div>
        <div style="margin: 4px 0 10px; font-size: 11px; color: #475569;">매일 아침 가장 정확한 정량 ETF 마켓 브리핑</div>
        <div style="font-size: 11px; color: #94A3B8;">
          본 메일은 정보 제공을 목적으로 발송되며, 특정 종목에 대한 투자 권유가 아닙니다.<br>
          © 2026 ETF Campus. All rights reserved.
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

  return { subject, html };
}
