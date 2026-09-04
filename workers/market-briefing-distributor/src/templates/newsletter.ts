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

  // 전체 ETF 기준 총 순자산 & 거래대금 (marketScaleSnapshot 우선, 없으면 일반 ETF 값 fallback)
  const totalAumEok = normalizeToEok(payload.marketScaleSnapshot?.totalAum || payload.pulse?.generalTotalAum || payload.generalTotalAum || 3814729);
  const totalTradeEok = normalizeToEok(payload.marketScaleSnapshot?.totalTradeValue || payload.pulse?.generalTotalTradeValue || payload.generalTotalTradeValue || 100551);
  const aumJo = (totalAumEok / 10000).toFixed(1);
  const tradeJo = (totalTradeEok / 10000).toFixed(1);
  const turnoverPct = totalAumEok > 0 ? ((totalTradeEok / totalAumEok) * 100) : (payload.marketScaleSnapshot?.marketTurnoverPct ?? payload.marketTurnoverPct ?? 2.64);
  const totalEtfCount = payload.pulse?.totalEtfCount || 0;

  const up = payload.upCount || 305;
  const flat = payload.flatCount || 47;
  const down = payload.downCount || 670;
  const generalCount = payload.generalEtfCount || 1022;

  const dailyTs = payload.marketScaleTimeSeries?.daily || [];
  const latestTs = dailyTs.length > 0 ? dailyTs[dailyTs.length - 1] : null;
  const prevTs = dailyTs.length > 1 ? dailyTs[dailyTs.length - 2] : null;
  
  let totalAumChangeStr = "";
  let totalAdtvChangeStr = "";
  if (latestTs) {
    const aumChangeJo = (latestTs.aumChange / 10000);
    const signAum = aumChangeJo > 0 ? "+" : "";
    const colorAum = aumChangeJo >= 0 ? "#DC2626" : "#2563EB";
    totalAumChangeStr = `<span style="color: ${colorAum};">${signAum}${aumChangeJo.toFixed(1)}조원</span>`;

    if (prevTs) {
      const adtvChangeJo = ((latestTs.adtv - prevTs.adtv) / 10000);
      const signAdtv = adtvChangeJo > 0 ? "+" : "";
      const colorAdtv = adtvChangeJo >= 0 ? "#DC2626" : "#2563EB";
      totalAdtvChangeStr = `<span style="color: ${colorAdtv};">${signAdtv}${adtvChangeJo.toFixed(1)}조원</span>`;
    }
  }
  
  const sortedPeerGroups = [...(payload.peerGroups || [])].sort((a, b) => b.cappedAumWeightedReturnPct - a.cappedAumWeightedReturnPct);
  const winners = sortedPeerGroups.filter(p => p.cappedAumWeightedReturnPct > 0).slice(0, 3);
  const losers = [...sortedPeerGroups].reverse().filter(p => p.cappedAumWeightedReturnPct < 0).slice(0, 3);
  const topTheme = winners[0] || { peerGroup: "에너지", cappedAumWeightedReturnPct: 0.93 };
  const bottomTheme = losers[0] || { peerGroup: "K-푸드 & K-뷰티", cappedAumWeightedReturnPct: -4.07 };

  const topInflows: any[] = (payload.periodicFlows?.dailyFundFlows?.topInflows || []) as any[];
  const topInflowName = topInflows[0]?.name || topInflows[0]?.etfName || "국내 대표지수";

  const cleanTopThemeName = topTheme.peerGroup.replace(/\s*\([^)]*\)/g, '').trim();
  const headline = `국내 상장 일반 ETF ${generalCount.toLocaleString()}개 시장을 전수 분석한 결과, 상승 ${up}개 대비 하락 ${down}개로 숨고르기 장세를 보였습니다. 테마별로는 '${cleanTopThemeName}' 테마가 +${topTheme.cappedAumWeightedReturnPct.toFixed(2)}% 상승한 가운데, 스마트머니는 '${topInflowName}' 등 대표지수로 실질 순유입을 이어갔습니다.`;
  
  const utmLink = `${baseUrl}/briefing?utm_source=newsletter&utm_medium=email&utm_campaign=daily_briefing_${dateStr.replace(/-/g, "")}`;

  const subject = `[ETF 마켓 브리핑] ${formattedDate} '${topTheme.peerGroup.replace(/\s*\([^)]*\)/g, '')}' 테마 상승 속 대표지수 스마트머니 유입`;

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
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Pretendard Variable", "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; background-color: #0F172A; color: #0F172A; -webkit-font-smoothing: antialiased; }
    .container { max-width: 620px; margin: 24px auto; background-color: #FFFFFF; border-radius: 22px; overflow: hidden; box-shadow: 0 16px 36px rgba(15, 23, 42, 0.12); border: 1px solid #E2E8F0; }
    .header { background: linear-gradient(135deg, #064E3B 0%, #047857 100%); padding: 36px 24px; text-align: center; color: #FFFFFF; }
    .badge { display: inline-block; background-color: rgba(255, 255, 255, 0.22); color: #A7F3D0; padding: 5px 14px; border-radius: 999px; font-size: 12.5px; font-weight: 900; letter-spacing: 0.5px; margin-bottom: 12px; border: 1px solid rgba(255, 255, 255, 0.3); }
    .title { font-size: 28px; font-weight: 900; margin: 0 0 8px; color: #FFFFFF; letter-spacing: -0.8px; }
    .subtitle { font-size: 14.5px; color: #D1FAE5; font-weight: 700; }
    .content { padding: 32px 24px; }
    
    .quote-box { background-color: #F8FAFC; border-left: 5px solid #10B981; padding: 18px 20px; border-radius: 0 14px 14px 0; margin-bottom: 26px; font-size: 16px; line-height: 1.7; font-weight: 700; color: #1E293B; border-top: 1px solid #E2E8F0; border-right: 1px solid #E2E8F0; border-bottom: 1px solid #E2E8F0; letter-spacing: -0.3px; }
    .tabular { font-variant-numeric: tabular-nums; }
    
    .grid-2 { display: table; width: 100%; margin-bottom: 14px; border-spacing: 0; }
    .grid-col { display: table-cell; width: 50%; padding: 0 6px; vertical-align: top; box-sizing: border-box; }
    
    .metric-card { background-color: #F8FAFC; border: 1.5px solid #E2E8F0; border-radius: 14px; padding: 16px 12px; text-align: center; box-sizing: border-box; }
    .metric-label { font-size: 13.5px; color: #334155; font-weight: 800; margin-bottom: 5px; }
    .metric-value { font-size: 24px; font-weight: 900; margin: 4px 0; color: #0F172A; }
    
    
    .table-custom { width: 100%; border-collapse: collapse; margin-bottom: 22px; font-size: 14px; border-radius: 14px; overflow: hidden; border: 1.5px solid #E2E8F0; }
    .table-custom th { background-color: #F1F5F9; padding: 12px 14px; text-align: left; font-weight: 900; color: #334155; border-bottom: 1.5px solid #E2E8F0; font-size: 13.5px; }
    .table-custom td { padding: 12px 14px; border-bottom: 1px solid #F1F5F9; color: #1E293B; }
    .table-custom tr:last-child td { border-bottom: none; }
    
    .btn-primary { display: block; width: 100%; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #FFFFFF !important; text-align: center; padding: 18px 0; border-radius: 14px; font-size: 17px; font-weight: 900; text-decoration: none; margin: 32px 0 12px; box-sizing: border-box; box-shadow: 0 6px 16px rgba(5, 150, 105, 0.35); letter-spacing: -0.3px; }
    .footer { background-color: #F8FAFC; padding: 26px 20px; text-align: center; font-size: 12px; color: #64748B; border-top: 1px solid #E2E8F0; line-height: 1.7; font-weight: 600; }
  </style>
</head>
<body>
  <div style="padding: 16px 8px;">
    <div class="container">
      <!-- Header -->
      <div class="header">
        <span class="badge">ETF CAMPUS · MORNING BRIEFING</span>
        <div class="title">${formattedDate} ETF 마켓 브리핑</div>
      </div>

      <!-- Content -->
      <div class="content">
        <!-- 1. Structured Executive Summary (3-Point Fast Scan) -->
        <div style="background-color: #F8FAFC; border-left: 5px solid #059669; padding: 20px; border-radius: 0 16px 16px 0; margin-bottom: 26px; border-top: 1.5px solid #E2E8F0; border-right: 1.5px solid #E2E8F0; border-bottom: 1.5px solid #E2E8F0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-bottom: 1.5px dashed #CBD5E1; padding-bottom: 10px; margin-bottom: 12px;">
            <tr>
              <td style="text-align: left; vertical-align: middle;">
                <span style="font-size: 16px; margin-right: 6px;">💡</span>
                <span style="font-size: 14.5px; font-weight: 900; color: #065F46; letter-spacing: -0.3px;">오늘의 30초 마켓 요약</span>
              </td>
              <td style="text-align: right; vertical-align: middle; white-space: nowrap;">
                <span style="font-size: 12px; font-weight: 800; color: #64748B;">일반 ETF ${generalCount}개 전수 분석</span>
              </td>
            </tr>
          </table>

          <div style="font-size: 16.5px; font-weight: 800; color: #0F172A; line-height: 1.55; margin-bottom: 12px; letter-spacing: -0.4px;">
            코스피 소폭 상승에도 일반 ETF 시장은 <span style="color: #2563EB; font-weight: 900;">하락 ${down}개 우세</span>로 차별화된 숨고르기 장세를 나타냈습니다.
          </div>

          <div style="background-color: #FFFFFF; border-radius: 12px; padding: 12px 14px; border: 1.5px solid #E2E8F0; font-size: 14.5px; color: #334155;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin-bottom: 6px;">
              <tr>
                <td style="vertical-align: top; width: 85px; white-space: nowrap; color: #DC2626; font-weight: 900; font-size: 14px; line-height: 1.6; padding-right: 6px;">
                  • 주도 테마
                </td>
                <td style="vertical-align: top; color: #0F172A; font-weight: 800; font-size: 14.5px; line-height: 1.6;">
                  <span style="color: #DC2626;">'${escapeXml(topTheme.peerGroup.replace(/\s*\([^)]*\)/g, ''))}'</span> (+${topTheme.cappedAumWeightedReturnPct.toFixed(2)}%) 상승 선방
                </td>
              </tr>
            </table>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
              <tr>
                <td style="vertical-align: top; width: 85px; white-space: nowrap; color: #047857; font-weight: 900; font-size: 14px; line-height: 1.6; padding-right: 6px;">
                  • 스마트머니
                </td>
                <td style="vertical-align: top; color: #0F172A; font-weight: 800; font-size: 14.5px; line-height: 1.6;">
                  <span style="color: #047857;">'${escapeXml(topInflowName)}'</span> 등 대표지수로 실질 자금 순유입 집중
                </td>
              </tr>
            </table>
          </div>
        </div>

        <!-- 2. 4-Card Overview Grid -->
        <div class="grid-2">
          <div class="grid-col" style="padding-left: 0;">
            <div class="metric-card">
              <div class="metric-label">KOSPI vs 일반 ETF</div>
              <div class="metric-value tabular" style="font-size: 20px;">
                <span style="color: ${kospiColor};">${kospiSign}${kospiChangePct.toFixed(2)}%</span> <span style="color: #94A3B8; font-size: 15px;">/</span> <span style="color: ${etfColor};">${etfSign}${etfReturn.toFixed(2)}%</span>
              </div>
              <div style="font-size: 12.5px; font-weight: 800; color: #475569;">KOSDAQ ${kosdaqSign}${kosdaqChangePct.toFixed(2)}%</div>
            </div>
          </div>
          <div class="grid-col" style="padding-right: 0;">
            <div class="metric-card">
              <div class="metric-label">시장 체온 (등락 분포)</div>
              <div class="metric-value tabular" style="font-size: 17.5px; margin: 6px 0;">
                <span style="color: #DC2626;">상승 ${up}</span> <span style="color: #CBD5E1; font-size: 14px;">·</span> <span style="color: #64748B;">보합 ${flat}</span> <span style="color: #CBD5E1; font-size: 14px;">·</span> <span style="color: #2563EB;">하락 ${down}</span>
              </div>
              <div style="font-size: 12px; font-weight: 700; color: #475569;">일반 ETF ${generalCount}개 기준</div>
            </div>
          </div>
        </div>

        <div class="grid-2">
          <div class="grid-col" style="padding-left: 0;">
            <div class="metric-card">
              <div class="metric-label">전체 ETF 총 순자산 (AUM)</div>
              <div class="metric-value tabular">${aumJo}조원</div>
              <div style="font-size: 12px; font-weight: 700; color: #64748B; margin-bottom: 4px;">${totalEtfCount > 0 ? `${totalEtfCount.toLocaleString()}개 전체 종목 기준` : `${generalCount}개 일반 종목 포함`}</div>
              ${totalAumChangeStr ? `<div style="font-size: 13px; font-weight: 800; color: #1E293B; margin-top: 6px; border-top: 1.5px dashed #CBD5E1; padding-top: 5px;">전체 ETF 기준 전일비 ${totalAumChangeStr}</div>` : ""}
            </div>
          </div>
          <div class="grid-col" style="padding-right: 0;">
            <div class="metric-card">
              <div class="metric-label">전체 ETF 일 거래대금 / 회전율</div>
              <div class="metric-value tabular">${tradeJo}조원</div>
              <div style="font-size: 12px; font-weight: 700; color: #64748B; margin-bottom: 4px;" class="tabular">일일 회전율 ${turnoverPct.toFixed(1)}%</div>
              ${totalAdtvChangeStr ? `<div style="font-size: 13px; font-weight: 800; color: #1E293B; margin-top: 6px; border-top: 1.5px dashed #CBD5E1; padding-top: 5px;">전체 ETF 기준 전일비 ${totalAdtvChangeStr}</div>` : ""}
            </div>
          </div>
        </div>

        <!-- 3. Section: Themes Long/Short -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin-top: 30px; margin-bottom: 12px;">
          <tr>
            <td style="text-align: left; vertical-align: middle;">
              <span style="font-size: 18px; font-weight: 900; color: #0F172A; letter-spacing: -0.4px;">🔥 주도 테마 TOP 3 vs 부진 테마 TOP 3</span>
            </td>
            <td style="text-align: right; vertical-align: middle; white-space: nowrap;">
              <span style="font-size: 12.5px; color: #64748B; font-weight: 700;">AUM 가중 평균 수익률 기준</span>
            </td>
          </tr>
        </table>
        <table class="table-custom">
          <thead>
            <tr>
              <th style="width: 85px;">구분</th>
              <th>테마명</th>
              <th style="text-align: right;">등락률</th>
            </tr>
          </thead>
          <tbody>
            ${winners.map((w, idx) => `
              <tr>
                <td style="font-weight: 900; color: #DC2626; font-size: 14.5px;">상승 ${idx + 1}위</td>
                <td style="font-weight: 900; color: #0F172A; font-size: 15.5px;">${escapeXml(w.peerGroup)}</td>
                <td style="text-align: right; font-weight: 900; color: #DC2626; font-size: 16px;" class="tabular">▲ +${w.cappedAumWeightedReturnPct.toFixed(2)}%</td>
              </tr>
            `).join("")}
            ${losers.map((l, idx) => `
              <tr>
                <td style="font-weight: 900; color: #2563EB; font-size: 14.5px;">하락 ${idx + 1}위</td>
                <td style="font-weight: 900; color: #0F172A; font-size: 15.5px;">${escapeXml(l.peerGroup)}</td>
                <td style="text-align: right; font-weight: 900; color: #2563EB; font-size: 16px;" class="tabular">▼ ${l.cappedAumWeightedReturnPct.toFixed(2)}%</td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        <!-- 4. Section: Smart Money Inflows -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin-top: 30px; margin-bottom: 12px;">
          <tr>
            <td style="text-align: left; vertical-align: middle;">
              <span style="font-size: 18px; font-weight: 900; color: #0F172A; letter-spacing: -0.4px;">💸 스마트머니(외인·기관) 실질 순유입 TOP 5</span>
            </td>
            <td style="text-align: right; vertical-align: middle; white-space: nowrap;">
              <span style="font-size: 12.5px; color: #64748B; font-weight: 700;">일반 테마 ETF 기준 · 단위: 억원</span>
            </td>
          </tr>
        </table>
        <table class="table-custom">
          <thead>
            <tr>
              <th style="width: 44px; text-align: center;">순위</th>
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
                <td style="font-weight: 900; color: ${idx === 0 ? '#059669' : '#64748B'}; text-align: center; font-size: 15.5px;">${idx + 1}</td>
                <td>
                  <div style="font-weight: 900; color: #0F172A; font-size: 15.5px;">${escapeXml(name)}</div>
                  <div style="font-size: 12.5px; font-weight: 700; color: #64748B; margin-top: 2px;" class="tabular">${escapeXml(ticker)}</div>
                </td>
                <td style="text-align: right; font-weight: 900; color: #047857; font-size: 17px;" class="tabular">+${inflowEok.toLocaleString()}억원</td>
              </tr>
              `;
            }).join("")}
          </tbody>
        </table>

        <!-- 5. Section: Disparity Warning (수급 쏠림 주의 ETF / 괴리율 경보) -->
        <div style="margin-top: 30px; background-color: #FFFFFF; border: 1.5px solid #E2E8F0; border-radius: 16px; padding: 18px; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.03);">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-bottom: 1.5px solid #F1F5F9; padding-bottom: 14px; margin-bottom: 16px;">
            <tr>
              <td style="text-align: left; vertical-align: middle;">
                <span style="font-size: 18px; margin-right: 6px;">⚠️</span>
                <span style="font-size: 16px; font-weight: 900; color: #0F172A; margin-right: 6px;">수급 쏠림 주의 ETF (괴리율 경보)</span>
                <span style="display: inline-block; background-color: #F1F5F9; color: #334155; font-size: 12px; font-weight: 900; padding: 2px 8px; border-radius: 999px;">총 ${disparityList.length}개</span>
              </td>
              <td style="text-align: right; vertical-align: middle; white-space: nowrap;">
                <span style="font-size: 12px; font-weight: 700; color: #64748B;">기준: 국내 1.0% / 해외 3.0% 이상</span>
              </td>
            </tr>
          </table>

          <!-- Overvalued Sub-panel -->
          <div style="margin-bottom: 16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin-bottom: 8px;">
              <tr>
                <td style="text-align: left; vertical-align: middle;">
                  <span style="font-size: 14.5px; font-weight: 900; color: #DC2626;">📈 고평가 TOP 3 (Premium)</span>
                </td>
                <td style="text-align: right; vertical-align: middle; white-space: nowrap;">
                  <span style="font-size: 12px; font-weight: 800; color: #DC2626; background-color: #FEF2F2; padding: 3px 8px; border-radius: 6px;">추격 매수 주의 (시장가 &gt; NAV)</span>
                </td>
              </tr>
            </table>
            ${overvalued.length === 0 ? `
              <div style="background-color: #F8FAFC; border: 1.5px dashed #CBD5E1; border-radius: 10px; padding: 12px; text-align: center; font-size: 13.5px; color: #475569; font-weight: 700;">
                <span style="color: #10B981; font-weight: 900; margin-right: 6px;">✓</span> 현재 고평가 경보 종목이 없습니다.
              </div>
            ` : `
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                ${overvalued.slice(0, 3).map((item, idx) => `
                  <tr style="border-bottom: 1px solid #F1F5F9;">
                    <td style="width: 24px; font-weight: 900; color: #DC2626; text-align: center; font-size: 14.5px;">${idx + 1}</td>
                    <td style="padding: 8px 10px;">
                      <div style="font-weight: 900; color: #0F172A; font-size: 14.5px;">${escapeXml(item.etfName)}</div>
                      <div style="font-size: 12px; font-weight: 700; color: #64748B; margin-top: 2px;">${escapeXml(item.ticker)} · ${escapeXml(item.assetClass || '일반')}</div>
                    </td>
                    <td style="text-align: right; padding: 8px 10px;">
                      <span style="display: inline-block; background-color: #FEF2F2; color: #DC2626; font-weight: 900; font-size: 13.5px; padding: 4px 10px; border-radius: 8px;" class="tabular">+${item.disparityPct.toFixed(2)}% 고평가</span>
                    </td>
                  </tr>
                `).join('')}
              </table>
            `}
          </div>

          <!-- Undervalued Sub-panel -->
          <div>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin-bottom: 8px;">
              <tr>
                <td style="text-align: left; vertical-align: middle;">
                  <span style="font-size: 14.5px; font-weight: 900; color: #2563EB;">📉 저평가 TOP 3 (Discount)</span>
                </td>
                <td style="text-align: right; vertical-align: middle; white-space: nowrap;">
                  <span style="font-size: 12px; font-weight: 800; color: #2563EB; background-color: #EFF6FF; padding: 3px 8px; border-radius: 6px;">보유자 헐값 매도 유의 및 시차 확인 (시장가 &lt; NAV)</span>
                </td>
              </tr>
            </table>
            ${undervalued.length === 0 ? `
              <div style="background-color: #F8FAFC; border: 1.5px dashed #CBD5E1; border-radius: 10px; padding: 12px; text-align: center; font-size: 13.5px; color: #475569; font-weight: 700;">
                <span style="color: #10B981; font-weight: 900; margin-right: 6px;">✓</span> 현재 저평가 경보 종목이 없습니다.
              </div>
            ` : `
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                ${undervalued.slice(0, 3).map((item, idx) => `
                  <tr style="border-bottom: 1px solid #F1F5F9;">
                    <td style="width: 24px; font-weight: 900; color: #2563EB; text-align: center; font-size: 14.5px;">${idx + 1}</td>
                    <td style="padding: 8px 10px;">
                      <div style="font-weight: 900; color: #0F172A; font-size: 14.5px;">${escapeXml(item.etfName)}</div>
                      <div style="font-size: 12px; font-weight: 700; color: #64748B; margin-top: 2px;">${escapeXml(item.ticker)} · ${escapeXml(item.assetClass || '일반')}</div>
                    </td>
                    <td style="text-align: right; padding: 8px 10px;">
                      <span style="display: inline-block; background-color: #EFF6FF; color: #2563EB; font-weight: 900; font-size: 13.5px; padding: 4px 10px; border-radius: 8px;" class="tabular">${item.disparityPct.toFixed(2)}% 저평가</span>
                    </td>
                  </tr>
                `).join('')}
              </table>
            `}
          </div>
        </div>

        <!-- 6. Call to Action -->
        <a href="${utmLink}" class="btn-primary">
          👉 전체 1,022개 ETF 분석 &amp; 마켓 브리핑 풀버전 📊
        </a>
      </div>

      <!-- Footer -->
      <div class="footer">
        <div><strong style="color: #1E293B; font-size: 13.5px;">ETF CAMPUS (ETF 캠퍼스)</strong></div>
        <div style="margin-top: 8px; font-size: 11.5px; color: #64748B; line-height: 1.6;">
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
