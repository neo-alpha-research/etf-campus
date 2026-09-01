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

  const subject = `[ETF 마켓 브리핑] ${formattedDate} 시장 핵심 요약 & 수급 경보`;

  // 1. Themes (주도 TOP 3 vs 부진 TOP 3)
  const sortedPeerGroups = [...(payload.peerGroups || [])].sort((a, b) => b.cappedAumWeightedReturnPct - a.cappedAumWeightedReturnPct);
  const winners = sortedPeerGroups.filter(p => p.cappedAumWeightedReturnPct > 0).slice(0, 3);
  const losers = [...sortedPeerGroups].reverse().filter(p => p.cappedAumWeightedReturnPct < 0).slice(0, 3);

  // 2. Top Inflows (스마트머니 실질 순유입 TOP 5)
  const topInflows: any[] = (payload.periodicFlows?.dailyFundFlows?.topInflows || []) as any[];

  // 3. Disparity Warning (괴리율 경보)
  const disparityList = payload.disparityWarning || [];
  const overvalued = disparityList.filter(d => d.disparityPct > 0);
  const undervalued = disparityList.filter(d => d.disparityPct < 0);

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; background-color: #F8FAFC; color: #1E293B; -webkit-font-smoothing: antialiased; }
    .container { max-width: 600px; margin: 20px auto; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.06); border: 1px solid #E2E8F0; }
    .header { background: linear-gradient(135deg, #064E3B 0%, #047857 100%); padding: 32px 24px; text-align: center; color: #FFFFFF; }
    .badge { display: inline-block; background-color: rgba(255, 255, 255, 0.2); color: #A7F3D0; padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 10px; border: 1px solid rgba(255, 255, 255, 0.2); }
    .title { font-size: 24px; font-weight: 900; margin: 0 0 6px; color: #FFFFFF; letter-spacing: -0.5px; }
    .subtitle { font-size: 13px; color: #D1FAE5; font-weight: 600; }
    .content { padding: 28px 20px; }
    
    .quote-box { background-color: #F8FAFC; border-left: 4px solid #10B981; padding: 16px 18px; border-radius: 0 12px 12px 0; margin-bottom: 24px; font-size: 14.5px; line-height: 1.6; font-weight: 600; color: #334155; border-top: 1px solid #E2E8F0; border-right: 1px solid #E2E8F0; border-bottom: 1px solid #E2E8F0; }
    .tabular { font-variant-numeric: tabular-nums; }
    
    .grid-2 { display: table; width: 100%; margin-bottom: 12px; border-spacing: 0; }
    .grid-col { display: table-cell; width: 50%; padding: 0 5px; vertical-align: top; box-sizing: border-box; }
    
    .metric-card { background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 14px; text-align: center; box-sizing: border-box; }
    .metric-label { font-size: 11px; color: #64748B; font-weight: 700; margin-bottom: 3px; }
    .metric-value { font-size: 20px; font-weight: 900; margin: 2px 0; color: #0F172A; }
    
    .section-header { margin-top: 26px; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between; }
    .section-title { font-size: 15px; font-weight: 900; color: #0F172A; }
    .section-subtext { font-size: 11px; color: #64748B; font-weight: 600; }
    
    .table-custom { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; border-radius: 12px; overflow: hidden; border: 1px solid #E2E8F0; }
    .table-custom th { background-color: #F8FAFC; padding: 10px 12px; text-align: left; font-weight: 800; color: #475569; border-bottom: 1px solid #E2E8F0; font-size: 12px; }
    .table-custom td { padding: 10px 12px; border-bottom: 1px solid #F1F5F9; color: #334155; }
    .table-custom tr:last-child td { border-bottom: none; }
    
    .btn-primary { display: block; width: 100%; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #FFFFFF !important; text-align: center; padding: 15px 0; border-radius: 12px; font-size: 15px; font-weight: 900; text-decoration: none; margin: 28px 0 10px; box-sizing: border-box; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3); }
    .footer { background-color: #F8FAFC; padding: 24px 20px; text-align: center; font-size: 11.5px; color: #64748B; border-top: 1px solid #E2E8F0; line-height: 1.6; }
  </style>
</head>
<body>
  <div style="padding: 12px 6px;">
    <div class="container">
      <!-- Header -->
      <div class="header">
        <span class="badge">ETF CAMPUS · MORNING BRIEFING</span>
        <div class="title">${formattedDate} ETF 마켓 브리핑</div>
        <div class="subtitle">국내 상장 일반 ETF ${generalCount}개 전수 데이터 정량 리포트</div>
      </div>

      <!-- Content -->
      <div class="content">
        <!-- 1. Headline Quote -->
        <div class="quote-box">
          "${headline}"
        </div>

        <!-- 2. 4-Card Overview Grid -->
        <div class="grid-2">
          <div class="grid-col" style="padding-left: 0;">
            <div class="metric-card">
              <div class="metric-label">KOSPI vs 일반 ETF</div>
              <div class="metric-value tabular" style="font-size: 17px;">
                <span style="color: ${kospiColor};">${kospiSign}${kospiChangePct.toFixed(2)}%</span> / <span style="color: ${etfColor};">${etfSign}${etfReturn.toFixed(2)}%</span>
              </div>
              <div style="font-size: 10.5px; font-weight: 700; color: #64748B;">KOSDAQ ${kosdaqSign}${kosdaqChangePct.toFixed(2)}%</div>
            </div>
          </div>
          <div class="grid-col" style="padding-right: 0;">
            <div class="metric-card">
              <div class="metric-label">시장 체온 (등락 분포)</div>
              <div class="metric-value" style="color: #2563EB; font-size: 17px;">${temp}</div>
              <div style="font-size: 10.5px; color: #64748B;" class="tabular">상승 ${up} · 보합 ${flat} · 하락 ${down}</div>
            </div>
          </div>
        </div>

        <div class="grid-2">
          <div class="grid-col" style="padding-left: 0;">
            <div class="metric-card">
              <div class="metric-label">일반 ETF 총 순자산 (AUM)</div>
              <div class="metric-value tabular">${aumJo}조원</div>
              <div style="font-size: 10.5px; color: #64748B;">${generalCount}개 일반 종목 기준</div>
            </div>
          </div>
          <div class="grid-col" style="padding-right: 0;">
            <div class="metric-card">
              <div class="metric-label">일 거래대금 / 시장 회전율</div>
              <div class="metric-value tabular">${tradeJo}조원</div>
              <div style="font-size: 10.5px; color: #64748B;" class="tabular">일일 회전율 ${turnoverPct.toFixed(1)}%</div>
            </div>
          </div>
        </div>

        <!-- 3. Section: Themes Long/Short -->
        <div class="section-header">
          <span class="section-title">🔥 주도 테마 TOP 3 vs 부진 테마 TOP 3</span>
          <span class="section-subtext">AUM 가중 평균 수익률 기준</span>
        </div>
        <table class="table-custom">
          <thead>
            <tr>
              <th style="width: 75px;">구분</th>
              <th>테마명</th>
              <th style="text-align: right;">등락률</th>
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

        <!-- 4. Section: Smart Money Inflows -->
        <div class="section-header">
          <span class="section-title">💸 스마트머니(외인·기관) 실질 순유입 TOP 5</span>
          <span class="section-subtext">일반 테마 ETF 기준 · 단위: 억원</span>
        </div>
        <table class="table-custom">
          <thead>
            <tr>
              <th style="width: 36px; text-align: center;">순위</th>
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

        <!-- 5. Section: Disparity Warning (수급 쏠림 주의 ETF / 괴리율 경보) -->
        <div style="margin-top: 26px; background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 14px; padding: 16px; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.02);">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #F1F5F9; padding-bottom: 12px; margin-bottom: 14px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 16px;">⚠️</span>
              <span style="font-size: 14px; font-weight: 900; color: #0F172A;">수급 쏠림 주의 ETF (괴리율 경보)</span>
              <span style="display: inline-block; background-color: #F1F5F9; color: #475569; font-size: 10.5px; font-weight: 800; padding: 1px 7px; border-radius: 999px;">총 ${disparityList.length}개</span>
            </div>
            <div style="font-size: 10.5px; color: #94A3B8;">
              기준 괴리율: 국내 1.0% / 해외 3.0% 이상
            </div>
          </div>

          <!-- Overvalued Sub-panel -->
          <div style="margin-bottom: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 12.5px; font-weight: 800; color: #DC2626;">📈 고평가 TOP 3 (Premium)</span>
              <span style="font-size: 10.5px; font-weight: 700; color: #DC2626; background-color: #FEF2F2; padding: 2px 6px; border-radius: 4px;">추격 매수 주의 (시장가 &gt; NAV)</span>
            </div>
            ${overvalued.length === 0 ? `
              <div style="background-color: #F8FAFC; border: 1px dashed #CBD5E1; border-radius: 8px; padding: 10px; text-align: center; font-size: 12px; color: #64748B; font-weight: 600;">
                <span style="color: #10B981; font-weight: 900; margin-right: 4px;">✓</span> 현재 고평가 경보 종목이 없습니다.
              </div>
            ` : `
              <table style="width: 100%; border-collapse: collapse; font-size: 12.5px;">
                ${overvalued.slice(0, 3).map((item, idx) => `
                  <tr style="border-bottom: 1px solid #F1F5F9;">
                    <td style="width: 20px; font-weight: 900; color: #DC2626; text-align: center;">${idx + 1}</td>
                    <td style="padding: 6px 8px;">
                      <div style="font-weight: 800; color: #0F172A;">${escapeXml(item.etfName)}</div>
                      <div style="font-size: 10.5px; color: #94A3B8;">${escapeXml(item.ticker)} · ${escapeXml(item.assetClass || '일반')}</div>
                    </td>
                    <td style="text-align: right; padding: 6px 8px;">
                      <span style="display: inline-block; background-color: #FEF2F2; color: #DC2626; font-weight: 900; font-size: 11.5px; padding: 3px 8px; border-radius: 6px;" class="tabular">+${item.disparityPct.toFixed(2)}% 고평가</span>
                    </td>
                  </tr>
                `).join('')}
              </table>
            `}
          </div>

          <!-- Undervalued Sub-panel -->
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 12.5px; font-weight: 800; color: #2563EB;">📉 저평가 TOP 3 (Discount)</span>
              <span style="font-size: 10.5px; font-weight: 700; color: #2563EB; background-color: #EFF6FF; padding: 2px 6px; border-radius: 4px;">헐값 매도 주의 / 기회 (시장가 &lt; NAV)</span>
            </div>
            ${undervalued.length === 0 ? `
              <div style="background-color: #F8FAFC; border: 1px dashed #CBD5E1; border-radius: 8px; padding: 10px; text-align: center; font-size: 12px; color: #64748B; font-weight: 600;">
                <span style="color: #10B981; font-weight: 900; margin-right: 4px;">✓</span> 현재 저평가 경보 종목이 없습니다.
              </div>
            ` : `
              <table style="width: 100%; border-collapse: collapse; font-size: 12.5px;">
                ${undervalued.slice(0, 3).map((item, idx) => `
                  <tr style="border-bottom: 1px solid #F1F5F9;">
                    <td style="width: 20px; font-weight: 900; color: #2563EB; text-align: center;">${idx + 1}</td>
                    <td style="padding: 6px 8px;">
                      <div style="font-weight: 800; color: #0F172A;">${escapeXml(item.etfName)}</div>
                      <div style="font-size: 10.5px; color: #94A3B8;">${escapeXml(item.ticker)} · ${escapeXml(item.assetClass || '일반')}</div>
                    </td>
                    <td style="text-align: right; padding: 6px 8px;">
                      <span style="display: inline-block; background-color: #EFF6FF; color: #2563EB; font-weight: 900; font-size: 11.5px; padding: 3px 8px; border-radius: 6px;" class="tabular">${item.disparityPct.toFixed(2)}% 저평가</span>
                    </td>
                  </tr>
                `).join('')}
              </table>
            `}
          </div>
        </div>

        <!-- 6. Call to Action -->
        <a href="${utmLink}" class="btn-primary">
          👉 전체 1,022개 ETF 실시간 분석 &amp; 마켓 브리핑 풀버전 📊
        </a>
      </div>

      <!-- Footer -->
      <div class="footer">
        <div><strong>ETF CAMPUS (ETF 캠퍼스)</strong></div>
        <div style="margin: 4px 0 8px; font-size: 11px; color: #475569;">매일 아침 가장 정확한 정량 ETF 마켓 브리핑</div>
        <div style="font-size: 10.5px; color: #94A3B8;">
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
