import type { MarketBriefingPayload } from "../types";
import { classifyMarketRegime, type MarketRegime } from "../services/market-regime";
import type { PolishedNarrative } from "../services/gemini";

function normalizeToEok(val: number | string | undefined | null): number {
  if (!val) return 0;
  const num = typeof val === "string" ? parseFloat(val.replace(/,/g, "")) : val;
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

export function generateNewsletterHtml(
  payload: MarketBriefingPayload,
  baseUrl: string,
  narrative?: PolishedNarrative | MarketRegime
): { subject: string; preheader: string; html: string } {
  const regime = narrative || classifyMarketRegime(payload);
  const dateStr = payload.asOfDate || new Date().toISOString().slice(0, 10);
  const formattedDate = dateStr.replace(/-/g, ".");

  // 1. 3대 지표 및 3축 시장 매트릭스
  const kospiChangePct = payload.kospiChangePct ?? 0;
  const kospiColor = kospiChangePct >= 0 ? "#DC2626" : "#2563EB";
  const kospiSign = kospiChangePct > 0 ? "+" : "";

  const kosdaqChangePct = payload.kosdaqChangePct ?? 0;
  const kosdaqSign = kosdaqChangePct > 0 ? "+" : "";

  const etfReturn = payload.generalAumWeightedReturnPct ?? 0;
  const etfSign = etfReturn > 0 ? "+" : "";
  const etfColor = etfReturn >= 0 ? "#DC2626" : "#2563EB";

  const capSpread = (regime as any).capSpread ?? Number((kospiChangePct - kosdaqChangePct).toFixed(2));
  const etfDivergence = (regime as any).etfDivergence ?? Number((kospiChangePct - etfReturn).toFixed(2));
  const capSpreadSign = capSpread > 0 ? "+" : "";
  const etfDivergenceSign = etfDivergence > 0 ? "+" : "";

  // 2. 전체 ETF 총 순자산 & 거래대금
  const totalAumEok = normalizeToEok(payload.marketScaleSnapshot?.totalAum || payload.pulse?.generalTotalAum || payload.generalTotalAum || 0);
  const totalTradeEok = normalizeToEok(payload.marketScaleSnapshot?.totalTradeValue || payload.pulse?.generalTotalTradeValue || payload.generalTotalTradeValue || 0);
  const aumJo = (totalAumEok / 10000).toFixed(1);
  const tradeJo = (totalTradeEok / 10000).toFixed(1);
  const turnoverPct = totalAumEok > 0 ? ((totalTradeEok / totalAumEok) * 100) : (payload.marketScaleSnapshot?.marketTurnoverPct ?? payload.marketTurnoverPct ?? 0);
  const totalEtfCount = payload.pulse?.totalEtfCount || 0;

  // 3. 등락 분포
  const up = payload.upCount ?? payload.pulse?.upCount ?? 0;
  const flat = payload.flatCount ?? payload.pulse?.flatCount ?? 0;
  const down = payload.downCount ?? payload.pulse?.downCount ?? 0;
  const generalCount = payload.generalEtfCount ?? payload.pulse?.generalEtfCount ?? (up + flat + down);
  const upRatioPct = generalCount > 0 ? (up / generalCount) * 100 : 0;

  // 4. 전일 대비 증감
  const dailyTs = payload.marketScaleTimeSeries?.daily || [];
  const latestTs = dailyTs.length > 0 ? dailyTs[dailyTs.length - 1] : null;
  const prevTs = dailyTs.length > 1 ? dailyTs[dailyTs.length - 2] : null;

  let totalAumChangeStr = "";
  let totalAdtvChangeStr = "";
  if (latestTs) {
    const aumChangeJo = latestTs.aumChange / 10000;
    const signAum = aumChangeJo > 0 ? "+" : "";
    const colorAum = aumChangeJo >= 0 ? "#DC2626" : "#2563EB";
    totalAumChangeStr = `<span style="color: ${colorAum};" class="tabular">${signAum}${aumChangeJo.toFixed(1)}조원</span>`;

    if (prevTs) {
      const adtvChangeJo = (latestTs.adtv - prevTs.adtv) / 10000;
      const signAdtv = adtvChangeJo > 0 ? "+" : "";
      const colorAdtv = adtvChangeJo >= 0 ? "#DC2626" : "#2563EB";
      totalAdtvChangeStr = `<span style="color: ${colorAdtv};" class="tabular">${signAdtv}${adtvChangeJo.toFixed(1)}조원</span>`;
    }
  }

  // 5. 테마 랭킹 (괄호 완전 제거 규칙 준수)
  const sortedPeerGroups = [...(payload.peerGroups || [])].sort(
    (a, b) => b.cappedAumWeightedReturnPct - a.cappedAumWeightedReturnPct
  );
  const winners = sortedPeerGroups.slice(0, 3);
  const losers = [...sortedPeerGroups].reverse().slice(0, 3);

  const topTheme = sortedPeerGroups[0] || { peerGroup: "데이터 없음", cappedAumWeightedReturnPct: 0 };
  const bottomTheme = sortedPeerGroups.length > 1 ? sortedPeerGroups[sortedPeerGroups.length - 1] : { peerGroup: "데이터 없음", cappedAumWeightedReturnPct: 0 };
  const cleanTopThemeName = (topTheme.peerGroup || "").replace(/\s*\([^)]*\)/g, "").trim();
  const cleanBottomThemeName = (bottomTheme.peerGroup || "").replace(/\s*\([^)]*\)/g, "").trim();
  const topThemeRet = topTheme.cappedAumWeightedReturnPct ?? 0;
  const bottomThemeRet = bottomTheme.cappedAumWeightedReturnPct ?? 0;
  const topThemeSign = topThemeRet > 0 ? "+" : "";
  const bottomThemeSign = bottomThemeRet > 0 ? "+" : "";
  const topThemeVerb = topThemeRet > 0 ? "상승 주도" : "선방";
  const themeSpread = Math.abs(topThemeRet - bottomThemeRet);

  // 6. 스마트머니 수급
  const topInflows: any[] = (payload.periodicFlows?.dailyFundFlows?.topInflows || []) as any[];
  const topInflowName = topInflows[0]?.name || topInflows[0]?.etfName || "핵심 ETF";
  const topInflowInflow = topInflows[0]?.inflow
    ? Math.round(topInflows[0].inflow)
    : topInflows[0]?.netInflowValue
    ? Math.round(topInflows[0].netInflowValue / 100000000)
    : 0;
  const topInflowAmountStr = topInflowInflow > 0 ? ` +${topInflowInflow.toLocaleString()}억원 등` : " 중심";

  // 7. 괴리율 경보
  const disparityList = payload.disparityWarning || [];
  const overvalued = disparityList.filter((d) => d.disparityPct > 0);
  const undervalued = disparityList.filter((d) => d.disparityPct < 0);

  // 8. 3축 매트릭스 진단 텍스트
  let divergenceDiagnosis = "대표 지수와 대다수 ETF의 체감 수익률이 고르게 일치했습니다.";
  if (etfDivergence >= 1.5) {
    divergenceDiagnosis = "대형주 쏠림으로 인한 지수 착시가 관측되었으며 일반 ETF 상승폭은 차별화되었습니다.";
  } else if (etfDivergence <= -1.0) {
    divergenceDiagnosis = "지수 약세 속에서도 분산 ETF의 자산배분 방어력이 우수하게 작동했습니다.";
  }

  const utmLink = `${baseUrl}/briefing?utm_source=newsletter&utm_medium=email&utm_campaign=daily_briefing_${dateStr.replace(/-/g, "")}`;
  const subject = `[ETF 마켓 브리핑] ${formattedDate} ${regime.statusName} 속 '${cleanTopThemeName}' 강세 및 스마트머니 순유입`;
  const preheader = `[${formattedDate} 마켓 브리핑] KOSPI ${kospiSign}${kospiChangePct.toFixed(2)}% · 일반 ETF ${etfSign}${etfReturn.toFixed(2)}% | 주도 테마 '${cleanTopThemeName}' ${topThemeSign}${topThemeRet.toFixed(2)}% 및 스마트머니 순유입 집중 종목`;

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <title>${escapeXml(subject)}</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Pretendard Variable", "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; background-color: #F8FAFC; color: #0F172A; -webkit-font-smoothing: antialiased; }
    .container { max-width: 620px; margin: 24px auto; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08); border: 1px solid #E2E8F0; }
    .header { background: linear-gradient(135deg, #064E3B 0%, #047857 100%); padding: 32px 24px; text-align: center; color: #FFFFFF; }
    .badge { display: inline-block; background-color: rgba(255, 255, 255, 0.2); color: #A7F3D0; padding: 5px 14px; border-radius: 999px; font-size: 12px; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 10px; border: 1px solid rgba(255, 255, 255, 0.3); }
    .title { font-size: 26px; font-weight: 900; margin: 0; color: #FFFFFF; letter-spacing: -0.6px; line-height: 1.25; }
    .content { padding: 30px 22px; }
    
    .tabular { font-variant-numeric: tabular-nums; }
    .metric-card { background-color: #F8FAFC; border: 1.5px solid #E2E8F0; border-radius: 14px; padding: 16px 12px; text-align: center; box-sizing: border-box; }
    .metric-label { font-size: 13px; color: #475569; font-weight: 800; margin-bottom: 5px; }
    .metric-value { font-size: 22px; font-weight: 900; margin: 4px 0; color: #0F172A; }
    
    .table-custom { width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 14px; border-radius: 12px; overflow: hidden; border: 1.5px solid #E2E8F0; }
    .table-custom th { background-color: #F1F5F9; padding: 11px 12px; text-align: left; font-weight: 800; color: #334155; border-bottom: 1.5px solid #E2E8F0; font-size: 13px; }
    .table-custom td { padding: 11px 12px; border-bottom: 1px solid #F1F5F9; color: #1E293B; }
    .table-custom tr:last-child td { border-bottom: none; }
    
    .btn-primary { display: block; width: 100%; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #FFFFFF !important; text-align: center; padding: 17px 0; border-radius: 12px; font-size: 16.5px; font-weight: 800; text-decoration: none; margin: 28px 0 10px; box-sizing: border-box; box-shadow: 0 4px 14px rgba(5, 150, 105, 0.3); letter-spacing: -0.3px; }
    .footer { background-color: #F8FAFC; padding: 22px 20px 24px; border-top: 1px solid #E2E8F0; font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif; }
    
    @media only screen and (max-width: 480px) {
      .container { margin: 6px auto !important; border-radius: 12px !important; width: 100% !important; max-width: 100% !important; }
      .header { padding: 20px 16px !important; }
      .title { font-size: 20px !important; margin: 0 !important; }
      .content { padding: 16px 12px !important; }
      
      .exec-box { padding: 14px 12px !important; margin-bottom: 18px !important; border-radius: 0 10px 10px 0 !important; }
      .exec-headline { font-size: 14.5px !important; line-height: 1.55 !important; }
      .bullet-card { padding: 10px 12px !important; }
      
      .metric-col { display: block !important; width: 100% !important; margin-bottom: 10px !important; }
      .metric-spacer { display: none !important; width: 0 !important; height: 0 !important; }
      .metric-card { padding: 12px 10px !important; border-radius: 10px !important; }
      .metric-label { font-size: 12px !important; }
      .metric-value { font-size: 18px !important; margin: 2px 0 !important; }
      
      .table-custom th, .table-custom td { padding: 9px 6px !important; }
      .theme-col-rank { width: 66px !important; font-size: 12px !important; }
      .theme-col-name { font-size: 13px !important; }
      .theme-col-ret { font-size: 13.5px !important; min-width: 72px !important; }
      
      .smart-col-rank { width: 32px !important; font-size: 13px !important; }
      .smart-col-name { font-size: 13px !important; }
      .smart-col-inflow { font-size: 13.5px !important; min-width: 85px !important; }
      
      .disparity-box { padding: 14px 12px !important; margin-top: 20px !important; }
      .disparity-badge { font-size: 12px !important; padding: 3px 6px !important; }
      
      .btn-primary { padding: 15px 0 !important; font-size: 15px !important; margin: 22px 0 10px !important; }
      .footer-banner { padding: 12px 10px !important; }
      .footer-banner-text { font-size: 12px !important; }
      .footer-banner-block { display: block !important; margin: 3px 0 !important; }
      .footer-banner-sep { display: none !important; }
      .footer { padding: 18px 14px !important; }
    }
  </style>
</head>
<body bgcolor="#F8FAFC" style="margin: 0; padding: 0; background-color: #F8FAFC;">
  <!-- Hidden Preheader for Inbox Preview -->
  <div style="display: none; max-height: 0px; overflow: hidden; font-size: 1px; line-height: 1px; color: #FFFFFF; opacity: 0;">
    ${escapeXml(preheader)}
    &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <div style="padding: 12px 6px;">
    <div class="container" style="background-color: #FFFFFF;">
      <!-- Header -->
      <div class="header">
        <span class="badge">ETF CAMPUS · DAILY BRIEFING</span>
        <div class="title">${formattedDate} ETF 마켓 브리핑</div>
      </div>

      <!-- Content -->
      <div class="content">
        <!-- 1. Executive Summary (3-Axis Market Matrix Diagnosis Box) -->
        <div class="exec-box" style="background-color: #F8FAFC; border-left: 5px solid #059669; padding: 18px; border-radius: 0 14px 14px 0; margin-bottom: 24px; border-top: 1.5px solid #E2E8F0; border-right: 1.5px solid #E2E8F0; border-bottom: 1.5px solid #E2E8F0;">
          <!-- Top Row: Section Title & Analysis Base (Stacked for 100% Zero-Overflow Consistency) -->
          <div style="border-bottom: 1.5px dashed #CBD5E1; padding-bottom: 8px; margin-bottom: 12px;">
            <div style="font-size: 16.5px; font-weight: 900; color: #065F46; letter-spacing: -0.4px;">오늘의 30초 핵심 진단</div>
            <div style="font-size: 11.5px; font-weight: 700; color: #64748B; margin-top: 3px;">※ 일반 ETF ${generalCount.toLocaleString()}개 전수 분석</div>
          </div>

          <div style="margin-bottom: 8px;">
            <span style="display: inline-block; background-color: #ECFDF5; color: #047857; font-size: 12px; font-weight: 800; padding: 3px 9px; border-radius: 6px; border: 1px solid #A7F3D0; white-space: nowrap;">
              ${escapeXml(regime.statusName)}
            </span>
          </div>

          <div class="exec-headline" style="font-size: 15.5px; font-weight: 800; color: #0F172A; line-height: 1.55; margin-bottom: 14px; letter-spacing: -0.3px; word-break: keep-all;">
            ${escapeXml(regime.slide1Subheadline || `코스피 ${kospiSign}${kospiChangePct.toFixed(2)}% 등락 속 일반 ETF 시장은 상승 ${up}개 vs 하락 ${down}개로 ${regime.statusName} 흐름을 시현했습니다.`)}
          </div>

          <!-- 3-Bullet Strategic Insight Box (Zero Parentheses & Zero Emojis) -->
          <div class="bullet-card" style="background-color: #FFFFFF; border-radius: 12px; padding: 12px 14px; border: 1.5px solid #E2E8F0;">
            <!-- Bullet 1: 3-Axis Market Pulse -->
            <div style="margin-bottom: 10px; border-bottom: 1px solid #F1F5F9; padding-bottom: 9px;">
              <div style="margin-bottom: 4px;">
                <span style="display: inline-block; background-color: #F1F5F9; color: #334155; font-size: 12px; font-weight: 800; padding: 2px 7px; border-radius: 6px; border: 1px solid #E2E8F0;">시장 체온</span>
              </div>
              <div style="font-size: 14px; font-weight: 700; color: #1E293B; line-height: 1.6; word-break: keep-all;">
                KOSPI ${kospiSign}${kospiChangePct.toFixed(2)}% 대비 일반 ETF 가중수익률 ${etfSign}${etfReturn.toFixed(2)}%, 괴리 ${etfDivergenceSign}${etfDivergence.toFixed(2)}%p 수준. ${divergenceDiagnosis}
              </div>
            </div>
            <!-- Bullet 2: Leading & Lagging Theme Spread -->
            <div style="margin-bottom: 10px; border-bottom: 1px solid #F1F5F9; padding-bottom: 9px;">
              <div style="margin-bottom: 4px;">
                <span style="display: inline-block; background-color: #FEF2F2; color: #DC2626; font-size: 12px; font-weight: 800; padding: 2px 7px; border-radius: 6px; border: 1px solid #FECACA;">주도 테마</span>
              </div>
              <div style="font-size: 14px; font-weight: 700; color: #1E293B; line-height: 1.6; word-break: keep-all;">
                <strong style="color: #DC2626;">'${escapeXml(cleanTopThemeName)}'</strong> ${topThemeSign}${topThemeRet.toFixed(2)}% ${topThemeVerb}, 최하위 '${escapeXml(cleanBottomThemeName)}' ${bottomThemeSign}${bottomThemeRet.toFixed(2)}% 대비 테마 스프레드 <span style="white-space: nowrap;">${themeSpread.toFixed(2)}%p</span>
              </div>
            </div>
            <!-- Bullet 3: Smart Money Flow Focus -->
            <div>
              <div style="margin-bottom: 4px;">
                <span style="display: inline-block; background-color: #ECFDF5; color: #047857; font-size: 12px; font-weight: 800; padding: 2px 7px; border-radius: 6px; border: 1px solid #A7F3D0;">스마트머니</span>
              </div>
              <div style="font-size: 14px; font-weight: 700; color: #1E293B; line-height: 1.6; word-break: keep-all;">
                <strong style="color: #047857;">'${escapeXml(topInflowName)}'</strong>${topInflowAmountStr} 실질 자금 순유입 집중
              </div>
            </div>
          </div>
        </div>

        <!-- 2. 4-Card Overview Grid (Email-Safe Standard Table) -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin-bottom: 10px; border-collapse: collapse;">
          <tr>
            <td class="metric-col" width="48.5%" style="vertical-align: top;">
              <div class="metric-card">
                <div class="metric-label">KOSPI vs 일반 ETF</div>
                <div class="metric-value tabular" style="font-size: 19px;">
                  <span style="color: ${kospiColor}; white-space: nowrap;">${kospiSign}${kospiChangePct.toFixed(2)}%</span>
                  <span style="color: #94A3B8; font-size: 14px;"> / </span>
                  <span style="color: ${etfColor}; white-space: nowrap;">${etfSign}${etfReturn.toFixed(2)}%</span>
                </div>
                <div style="font-size: 12px; font-weight: 700; color: #475569;" class="tabular">
                  KOSDAQ ${kosdaqSign}${kosdaqChangePct.toFixed(2)}% · 스프레드 <span style="white-space: nowrap;">${capSpreadSign}${capSpread.toFixed(2)}%p</span>
                </div>
              </div>
            </td>
            <td class="metric-spacer" width="3%"></td>
            <td class="metric-col" width="48.5%" style="vertical-align: top;">
              <div class="metric-card">
                <div class="metric-label">시장 체온 · 등락 분포</div>
                <div class="metric-value tabular" style="font-size: 17px; margin: 5px 0;">
                  <span style="color: #DC2626; white-space: nowrap;">상승 ${up}</span>
                  <span style="color: #CBD5E1; font-size: 13px;"> · </span>
                  <span style="color: #64748B; white-space: nowrap;">보합 ${flat}</span>
                  <span style="color: #CBD5E1; font-size: 13px;"> · </span>
                  <span style="color: #2563EB; white-space: nowrap;">하락 ${down}</span>
                </div>
                <div style="font-size: 12px; font-weight: 700; color: #475569;" class="tabular">
                  상승 비율 <span style="white-space: nowrap;">${upRatioPct.toFixed(1)}%</span> · 일반 ${generalCount.toLocaleString()}개 기준
                </div>
              </div>
            </td>
          </tr>
        </table>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin-bottom: 22px; border-collapse: collapse;">
          <tr>
            <td class="metric-col" width="48.5%" style="vertical-align: top;">
              <div class="metric-card">
                <div class="metric-label">전체 ETF 총 순자산 AUM</div>
                <div class="metric-value tabular">${aumJo}조원</div>
                <div style="font-size: 12px; font-weight: 700; color: #64748B; margin-bottom: 4px;">
                  ${totalEtfCount > 0 ? `${totalEtfCount.toLocaleString()}개 전체 종목 기준` : `${generalCount.toLocaleString()}개 일반 종목 포함`}
                </div>
                ${totalAumChangeStr ? `<div style="font-size: 12px; font-weight: 800; color: #1E293B; margin-top: 5px; border-top: 1.5px dashed #CBD5E1; padding-top: 4px; white-space: nowrap;">전체 ETF 기준 전일비 ${totalAumChangeStr}</div>` : ""}
              </div>
            </td>
            <td class="metric-spacer" width="3%"></td>
            <td class="metric-col" width="48.5%" style="vertical-align: top;">
              <div class="metric-card">
                <div class="metric-label">전체 ETF 일 거래대금 · 회전율</div>
                <div class="metric-value tabular">${tradeJo}조원</div>
                <div style="font-size: 12px; font-weight: 700; color: #64748B; margin-bottom: 4px;" class="tabular">
                  일일 회전율 <span style="white-space: nowrap;">${turnoverPct.toFixed(1)}%</span>
                </div>
                ${totalAdtvChangeStr ? `<div style="font-size: 12px; font-weight: 800; color: #1E293B; margin-top: 5px; border-top: 1.5px dashed #CBD5E1; padding-top: 4px; white-space: nowrap;">전체 ETF 기준 전일비 ${totalAdtvChangeStr}</div>` : ""}
              </div>
            </td>
          </tr>
        </table>

        <!-- 3. Section: Leading & Lagging Themes (Top 3 vs Worst 3) -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin-top: 24px; margin-bottom: 8px;">
          <tr>
            <td style="text-align: left; vertical-align: middle;">
              <div style="font-size: 16.5px; font-weight: 900; color: #0F172A; letter-spacing: -0.4px;">▲ 상위 Top 3 vs ▼ 하위 Worst 3 테마</div>
              <div style="font-size: 11.5px; color: #64748B; font-weight: 700; margin-top: 3px;">※ AUM 가중 평균 수익률 기준</div>
            </td>
          </tr>
        </table>
        <table class="table-custom">
          <thead>
            <tr>
              <th class="theme-col-rank" style="width: 72px; white-space: nowrap;">구분</th>
              <th class="theme-col-name" style="word-break: keep-all;">테마명</th>
              <th class="theme-col-ret" style="text-align: right; white-space: nowrap; min-width: 76px;">등락률</th>
            </tr>
          </thead>
          <tbody>
            ${winners.map((w, idx) => {
              const cleanName = (w.peerGroup || "").replace(/\s*\([^)]*\)/g, "").trim();
              const ret = w.cappedAumWeightedReturnPct ?? 0;
              const retSign = ret > 0 ? "▲ +" : ret < 0 ? "▼ " : "";
              const retColor = ret >= 0 ? "#DC2626" : "#2563EB";
              return `
              <tr>
                <td class="theme-col-rank" style="font-weight: 800; color: #DC2626; font-size: 13px; white-space: nowrap;">▲ 상위 ${idx + 1}위</td>
                <td class="theme-col-name" style="font-weight: 800; color: #0F172A; font-size: 14px; word-break: keep-all;">${escapeXml(cleanName)}</td>
                <td class="theme-col-ret tabular" style="text-align: right; font-weight: 900; color: ${retColor}; font-size: 14.5px; white-space: nowrap;">${retSign}${ret.toFixed(2)}%</td>
              </tr>
            `;}).join("")}
            ${losers.map((l, idx) => {
              const cleanName = (l.peerGroup || "").replace(/\s*\([^)]*\)/g, "").trim();
              const ret = l.cappedAumWeightedReturnPct ?? 0;
              const retSign = ret > 0 ? "▲ +" : ret < 0 ? "▼ " : "";
              const retColor = ret >= 0 ? "#DC2626" : "#2563EB";
              return `
              <tr>
                <td class="theme-col-rank" style="font-weight: 800; color: #2563EB; font-size: 13px; white-space: nowrap;">▼ 하위 ${idx + 1}위</td>
                <td class="theme-col-name" style="font-weight: 800; color: #0F172A; font-size: 14px; word-break: keep-all;">${escapeXml(cleanName)}</td>
                <td class="theme-col-ret tabular" style="text-align: right; font-weight: 900; color: ${retColor}; font-size: 14.5px; white-space: nowrap;">${retSign}${ret.toFixed(2)}%</td>
              </tr>
            `;}).join("")}
          </tbody>
        </table>

        <!-- Theme Spread Footnote / Summary Card -->
        <div style="margin-top: 8px; margin-bottom: 22px; padding: 11px 14px; background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; text-align: left; line-height: 1.6; word-break: keep-all;">
          <span style="font-size: 12.5px; color: #475569; font-weight: 600;">
            💡 <strong style="color: #0F172A;">테마 스프레드 분석:</strong> 1위 <strong style="color: #0F172A;">'${escapeXml(cleanTopThemeName)}'</strong> 대비 최하위 <strong style="color: #0F172A;">'${escapeXml(cleanBottomThemeName)}'</strong> 간 테마 수익률 격차는 <strong style="color: #059669; font-weight: 800; white-space: nowrap;" class="tabular">${themeSpread.toFixed(2)}%p</strong>입니다.
          </span>
        </div>

        <!-- 4. Section: Smart Money Net Inflows TOP 5 (Clickable Links) -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin-top: 24px; margin-bottom: 8px;">
          <tr>
            <td style="text-align: left; vertical-align: middle;">
              <div style="font-size: 16.5px; font-weight: 900; color: #0F172A; letter-spacing: -0.4px;">스마트머니 외인·기관 실질 순유입 TOP 5</div>
              <div style="font-size: 11.5px; color: #64748B; font-weight: 700; margin-top: 3px;">※ 일반 테마 ETF · 단위: 억원</div>
            </td>
          </tr>
        </table>
        <table class="table-custom">
          <thead>
            <tr>
              <th class="smart-col-rank" style="width: 36px; text-align: center; white-space: nowrap;">순위</th>
              <th class="smart-col-name" style="word-break: keep-all;">종목명 / 티커</th>
              <th class="smart-col-inflow" style="text-align: right; white-space: nowrap; min-width: 90px;">실질 순유입액</th>
            </tr>
          </thead>
          <tbody>
            ${topInflows.slice(0, 5).map((item, idx) => {
              const name = item.name || item.etfName || item.ticker || "";
              const ticker = item.ticker || "";
              const inflowEok = item.inflow ? Math.round(item.inflow) : item.netInflowValue ? Math.round(item.netInflowValue / 100000000) : 0;
              const etfDetailUrl = `${baseUrl}/etf/${ticker}?utm_source=newsletter&utm_medium=email&utm_campaign=smart_money_${dateStr.replace(/-/g, "")}`;
              return `
              <tr>
                <td class="smart-col-rank" style="font-weight: 800; color: ${idx === 0 ? "#059669" : "#64748B"}; text-align: center; font-size: 14px; white-space: nowrap;">${idx + 1}</td>
                <td class="smart-col-name" style="word-break: keep-all;">
                  <a href="${etfDetailUrl}" target="_blank" style="text-decoration: none; color: #0F172A; display: block;">
                    <div style="font-weight: 800; font-size: 14px; color: #0F172A; line-height: 1.4; word-break: keep-all;">${escapeXml(name)}</div>
                    <div style="font-size: 12px; font-weight: 700; color: #059669; margin-top: 3px;" class="tabular">${escapeXml(ticker)} · 종목 상세 분석 ↗</div>
                  </a>
                </td>
                <td class="smart-col-inflow tabular" style="text-align: right; font-weight: 900; color: #047857; font-size: 15px; white-space: nowrap;">+${inflowEok.toLocaleString()}억원</td>
              </tr>
              `;
            }).join("")}
          </tbody>
        </table>

        <!-- 5. Section: Disparity Warning (수급 쏠림 주의 ETF · 괴리율 경보) -->
        <div class="disparity-box" style="margin-top: 24px; background-color: #FFFFFF; border: 1.5px solid #E2E8F0; border-radius: 14px; padding: 16px; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.03);">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-bottom: 1.5px solid #F1F5F9; padding-bottom: 8px; margin-bottom: 12px;">
            <tr>
              <td style="text-align: left; vertical-align: middle;">
                <span style="font-size: 15.5px; font-weight: 900; color: #0F172A; margin-right: 6px;">수급 쏠림 주의 ETF · 괴리율 경보</span>
                <span style="display: inline-block; background-color: #F1F5F9; color: #334155; font-size: 12px; font-weight: 800; padding: 2px 7px; border-radius: 999px; white-space: nowrap;">총 ${disparityList.length}개</span>
              </td>
            </tr>
            <tr>
              <td style="text-align: left; padding-top: 4px;">
                <span style="font-size: 11.5px; font-weight: 700; color: #64748B;">기준: 국내 1.0% / 해외 3.0% 이상 괴리 발생 종목</span>
              </td>
            </tr>
          </table>

          <!-- Overvalued Sub-panel (Stacked for 100% Zero-Overflow) -->
          <div style="margin-bottom: 16px;">
            <div style="margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1.5px solid #FEE2E2;">
              <div style="font-size: 14px; font-weight: 800; color: #DC2626;">고평가 TOP 3 · 할증 주의</div>
              <div style="font-size: 11.5px; font-weight: 700; color: #991B1B; margin-top: 3px;">
                ※ 시장가 &gt; NAV (추격 매수 주의 · 실시간 괴리율 확인)
              </div>
            </div>
            ${overvalued.length === 0 ? `
              <div style="background-color: #F8FAFC; border: 1.5px dashed #CBD5E1; border-radius: 10px; padding: 11px; text-align: center; font-size: 13px; color: #475569; font-weight: 700;">
                <span style="color: #10B981; font-weight: 800; margin-right: 5px;">[정상]</span> 현재 고평가 경보 종목이 없습니다.
              </div>
            ` : `
              <table style="width: 100%; border-collapse: collapse; font-size: 13.5px;">
                ${overvalued.slice(0, 3).map((item, idx) => `
                  <tr style="border-bottom: 1px solid #F1F5F9;">
                    <td style="width: 24px; font-weight: 800; color: #DC2626; text-align: center; font-size: 13.5px; white-space: nowrap;">${idx + 1}</td>
                    <td style="padding: 8px 6px; word-break: keep-all;">
                      <a href="${baseUrl}/etf/${item.ticker}?utm_source=newsletter&utm_medium=email&utm_campaign=disparity_${dateStr.replace(/-/g, "")}" target="_blank" style="text-decoration: none; color: #0F172A; display: block;">
                        <div style="font-weight: 800; color: #0F172A; font-size: 14px; line-height: 1.4; word-break: keep-all;">${escapeXml(item.etfName)}</div>
                        <div style="font-size: 12px; font-weight: 700; color: #64748B; margin-top: 2px;">${escapeXml(item.ticker)} · ${escapeXml(item.assetClass || "일반")} · 종목 보기 ↗</div>
                      </a>
                    </td>
                    <td style="text-align: right; padding: 8px 4px; white-space: nowrap;">
                      <span class="disparity-badge tabular" style="display: inline-block; background-color: #FEF2F2; color: #DC2626; font-weight: 800; font-size: 12.5px; padding: 4px 8px; border-radius: 6px; white-space: nowrap;">+${item.disparityPct.toFixed(2)}% 고평가</span>
                    </td>
                  </tr>
                `).join("")}
              </table>
            `}
          </div>

          <!-- Undervalued Sub-panel (Stacked for 100% Zero-Overflow) -->
          <div>
            <div style="margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1.5px solid #DBEAFE;">
              <div style="font-size: 14px; font-weight: 800; color: #2563EB;">저평가 TOP 3 · 할인 체크</div>
              <div style="font-size: 11.5px; font-weight: 700; color: #1E40AF; margin-top: 3px;">
                ※ 시장가 &lt; NAV (헐값 매도 유의 및 시차 확인)
              </div>
            </div>
            ${undervalued.length === 0 ? `
              <div style="background-color: #F8FAFC; border: 1.5px dashed #CBD5E1; border-radius: 10px; padding: 11px; text-align: center; font-size: 13px; color: #475569; font-weight: 700;">
                <span style="color: #10B981; font-weight: 800; margin-right: 5px;">[정상]</span> 현재 저평가 경보 종목이 없습니다.
              </div>
            ` : `
              <table style="width: 100%; border-collapse: collapse; font-size: 13.5px;">
                ${undervalued.slice(0, 3).map((item, idx) => `
                  <tr style="border-bottom: 1px solid #F1F5F9;">
                    <td style="width: 24px; font-weight: 800; color: #2563EB; text-align: center; font-size: 13.5px; white-space: nowrap;">${idx + 1}</td>
                    <td style="padding: 8px 6px; word-break: keep-all;">
                      <a href="${baseUrl}/etf/${item.ticker}?utm_source=newsletter&utm_medium=email&utm_campaign=disparity_${dateStr.replace(/-/g, "")}" target="_blank" style="text-decoration: none; color: #0F172A; display: block;">
                        <div style="font-weight: 800; color: #0F172A; font-size: 14px; line-height: 1.4; word-break: keep-all;">${escapeXml(item.etfName)}</div>
                        <div style="font-size: 12px; font-weight: 700; color: #64748B; margin-top: 2px;">${escapeXml(item.ticker)} · ${escapeXml(item.assetClass || "일반")} · 종목 보기 ↗</div>
                      </a>
                    </td>
                    <td style="text-align: right; padding: 8px 4px; white-space: nowrap;">
                      <span class="disparity-badge tabular" style="display: inline-block; background-color: #EFF6FF; color: #2563EB; font-weight: 800; font-size: 12.5px; padding: 4px 8px; border-radius: 6px; white-space: nowrap;">${item.disparityPct.toFixed(2)}% 저평가</span>
                    </td>
                  </tr>
                `).join("")}
              </table>
            `}
          </div>
        </div>

        <!-- 6. Call to Action Button -->
        <a href="${utmLink}" class="btn-primary" target="_blank">
          전체 ${generalCount.toLocaleString()}개 ETF 분석 &amp; 마켓 브리핑 풀버전 확인하기 ↗
        </a>

        <!-- ETF 캠퍼스 공식 최신 표준 풋터 밴드 (텍스트 + 이모지 기반 라운드 배너) -->
        <div class="footer-banner" style="margin-top: 24px; background-color: #F8FAFC; border: 1.2px solid #E2E8F0; border-radius: 8px; padding: 12px 14px; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif;">
          <span class="footer-banner-text footer-banner-block" style="color: #059669; font-size: 13px; font-weight: 800; letter-spacing: -0.2px; display: inline-block;">
            🔍 DC/IRP, 연금저축, ISA 계좌별 ETF 비교 분석 최적화
          </span>
          <span class="footer-banner-sep" style="color: #CBD5E1; margin: 0 6px; font-size: 12px; display: inline-block;">|</span>
          <span class="footer-banner-text footer-banner-block" style="color: #0F172A; font-size: 13px; font-weight: 900; display: inline-block;">
            📊 ETF 캠퍼스 <a href="${baseUrl}" target="_blank" style="color: #0F172A; text-decoration: none;">etf-campus.pages.dev</a>
          </span>
        </div>
      </div>

      <!-- 7. Compliance & Regulatory Disclaimers (Capital Markets Act Art. 101 - Minimal Flat) -->
      <div class="footer">
        <div style="font-size: 11.5px; color: #64748B; line-height: 1.65; text-align: left; word-break: keep-all; font-weight: 500;">
          본 뉴스레터는 공공 데이터 및 한국거래소(KRX) 공시 데이터를 기반으로 시장 동향을 객관적으로 집계·정리한 정보 제공용 콘텐츠이며, 특정 금융투자상품에 대한 매수·매도를 추천하거나 수익률을 보장하는 투자 권유가 아닙니다. 과거의 운용 실적이 미래의 수익을 보장하지 않습니다.
        </div>
        <div style="margin-top: 10px; font-size: 11.5px; color: #64748B; line-height: 1.65; text-align: left; word-break: keep-all; font-weight: 500;">
          기준일자: ${formattedDate} 장 마감 기준 · 데이터 출처: 한국거래소(KRX)
        </div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin-top: 14px; padding-top: 12px; border-top: 1px solid #E2E8F0;">
          <tr>
            <td style="font-size: 11px; color: #94A3B8; text-align: left; vertical-align: middle;">
              © 2026 ETF Campus. All rights reserved.
            </td>
            <td style="font-size: 11px; color: #64748B; text-align: right; vertical-align: middle; white-space: nowrap;">
              <a href="${baseUrl}" target="_blank" style="color: #64748B; text-decoration: none; font-weight: 700;">홈페이지</a>
              <span style="margin: 0 5px; color: #CBD5E1;">·</span>
              <a href="${baseUrl}/unsubscribe" style="color: #64748B; text-decoration: underline;">수신거부 (Unsubscribe)</a>
            </td>
          </tr>
        </table>
      </div>
    </div>
  </div>
</body>
</html>`;

  return { subject, preheader, html };
}
