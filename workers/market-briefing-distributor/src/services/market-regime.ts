import type { MarketBriefingPayload } from "../types";

export interface MarketRegime {
  code: "CRASH_OR_HEAVY_DROP" | "MODERATE_PULLBACK" | "SIDEWAYS_MIXED" | "BROAD_RALLY";
  statusName: string;
  badgeTag: string;
  // Slide 1
  slide1Subheadline: string;
  slide1Tip: string;
  // Slide 6 Block 1
  slide6Block1Title: string;
  slide6Block1Desc: string;
  // Instagram Caption
  captionOpening: string;
  captionMarketSummary: string;
  // Threads Opening
  threadsOpening: string;
  threadsMarketSummary: string;
}

export function classifyMarketRegime(payload: MarketBriefingPayload): MarketRegime {
  const kospi = payload.kospiChangePct ?? 0;
  const etfRet = payload.generalAumWeightedReturnPct ?? 0;
  const up = payload.upCount ?? 0;
  const down = payload.downCount ?? 0;
  const flat = payload.flatCount ?? 0;
  const total = (up + down + flat) || 1025;
  const downRatio = down / total;
  const upRatio = up / total;

  const topTheme = payload.peerGroups?.find(p => (p.cappedAumWeightedReturnPct ?? 0) > 0) || payload.peerGroups?.[0];
  const topThemeName = topTheme ? topTheme.peerGroup.replace(/\s*\([^)]*\)/g, '') : "에너지";
  const topInflows = payload.periodicFlows?.dailyFundFlows?.topInflows;
  const topInflowName = (topInflows && topInflows[0]) ? (topInflows[0].name || (topInflows[0] as any).etfName || "KODEX 200") : "KODEX 200";

  const kospiSign = kospi > 0 ? "+" : "";
  const etfSign = etfRet > 0 ? "+" : "";

  // 1. 급락 / 전방위 약세 (Severe Drop / Market-wide Downturn)
  if (kospi <= -1.8 || downRatio >= 0.70) {
    return {
      code: "CRASH_OR_HEAVY_DROP",
      statusName: "급락 / 전방위 약세",
      badgeTag: "⚠️ 전방위 약세",
      slide1Subheadline: `'${topThemeName}' 테마 선방 속 '${topInflowName}' 중심 방어 수급 유입 🔍`,
      slide1Tip: `💡 KOSPI ${kospiSign}${kospi.toFixed(2)}% vs 일반 ETF ${etfSign}${etfRet.toFixed(2)}% · 국내 증시 급락 속 해외·금리형 ETF가 충격 완충`,
      slide6Block1Title: `코스피 ${kospiSign}${kospi.toFixed(2)}% 급락 속 일반 ETF ${etfSign}${etfRet.toFixed(2)}% 전방위 약세`,
      slide6Block1Desc: `국내 증시의 거센 하락 압력으로 하락 ${down}개가 쏟아졌으나, 글로벌 분산 및 방어 테마가 지수 대비 충격을 완충.`,
      captionOpening: `어제 국내 증시는 코스피가 ${kospiSign}${kospi.toFixed(2)}% 급락하며 거센 하락 압력을 받았습니다. 일반 ETF 시장 역시 1,025개 중 ${down}개 종목이 하락하며 전방위 약세를 나타냈습니다. 📉`,
      captionMarketSummary: `국내 대형주를 중심으로 투매가 출회되었으나, 글로벌 자산배분 및 금리형 ETF가 지수 대비 하락폭을 일부 방어하며 충격을 흡수했습니다. 📊`,
      threadsOpening: `어제 코스피가 ${kospiSign}${kospi.toFixed(2)}% 급락하면서 계좌 열어보기 무서우셨을 텐데요. 📉`,
      threadsMarketSummary: `국내 상장 일반 ETF 1,025개 중 ${down}개가 하락하며 전방위 약세를 보였지만, ETF 전체 수익률은 ${etfSign}${etfRet.toFixed(2)}%로 지수보다는 덜 빠졌어요. 글로벌 분산과 원자재·금리형 ETF가 방어벽 역할을 해준 덕분입니다. 🛡️`,
    };
  }

  // 2. 조정 / 하락 우세 (Moderate Pullback / Bear Dominant)
  if (kospi <= -0.5 || downRatio > 0.55) {
    return {
      code: "MODERATE_PULLBACK",
      statusName: "조정 / 하락 우세",
      badgeTag: "❄️ 조정 장세",
      slide1Subheadline: `'${topThemeName}' 테마 반등 속 '${topInflowName}' 저가 매수세 유입 🔍`,
      slide1Tip: `💡 KOSPI ${kospiSign}${kospi.toFixed(2)}% vs 일반 ETF ${etfSign}${etfRet.toFixed(2)}% · 지수 조정 속 주도 섹터와 소외 섹터 간 온도차`,
      slide6Block1Title: `코스피 ${kospiSign}${kospi.toFixed(2)}% 조정 속 일반 ETF ${etfSign}${etfRet.toFixed(2)}% 차별화 장세`,
      slide6Block1Desc: `단기 매물 출회로 하락 ${down}개 우세 흐름 속에서도 주도 테마군으로 선별적 저가 매수세 유입.`,
      captionOpening: `어제 코스피는 ${kospiSign}${kospi.toFixed(2)}% 조정을 받으며 숨고르기에 들어갔습니다. 일반 ETF 시장에서도 하락 ${down}개로 매물 출회가 우세했습니다. ☕`,
      captionMarketSummary: `지수 전반의 조정 속에서도 주도 테마와 소외 테마 간 수익률 격차가 뚜렷하게 벌어지는 섹터 로테이션이 전개되었습니다. 📊`,
      threadsOpening: `어제 코스피는 ${kospiSign}${kospi.toFixed(2)}% 조정을 받으며 숨고르기에 들어갔어요. ☕`,
      threadsMarketSummary: `일반 ETF 시장도 하락 ${down}개로 약세 흐름이었지만, 주도 테마군으로는 스마트머니의 분할 매수세가 꾸준히 유입되는 차별화 장세였습니다. 🧭`,
    };
  }

  // 3. 급등 / 광범위 랠리 (Rally / Bull Dominant)
  if (kospi >= 1.5 || upRatio >= 0.65) {
    return {
      code: "BROAD_RALLY",
      statusName: "급등 / 광범위 랠리",
      badgeTag: "🔥 강한 랠리",
      slide1Subheadline: `'${topThemeName}' 테마 주도 속 '${topInflowName}' 동반 순매수 확산 🔍`,
      slide1Tip: `💡 KOSPI ${kospiSign}${kospi.toFixed(2)}% vs 일반 ETF ${etfSign}${etfRet.toFixed(2)}% · 대형주 및 성장 테마 전반으로 온기 확산`,
      slide6Block1Title: `코스피 ${kospiSign}${kospi.toFixed(2)}% 급등 속 일반 ETF ${etfSign}${etfRet.toFixed(2)}% 동반 랠리`,
      slide6Block1Desc: `외인·기관의 강력한 순매수 유입으로 상승 ${up}개 종목이 시장 전반의 상승 열기를 견인.`,
      captionOpening: `어제 국내 증시는 코스피가 ${kospiSign}${kospi.toFixed(2)}% 급등하며 강력한 반등 랠리를 펼쳤습니다! 일반 ETF 시장 역시 상승 ${up}개로 광범위한 훈풍이 불었습니다. 🚀`,
      captionMarketSummary: `외인·기관의 적극적인 동반 매수세가 유입되며 주도 성장 테마 전반으로 온기가 빠르게 확산되었습니다. 📊`,
      threadsOpening: `어제 코스피가 ${kospiSign}${kospi.toFixed(2)}% 시원하게 쏘아 올리며 반등에 성공했어요! 🚀`,
      threadsMarketSummary: `일반 ETF 1,025개 중 ${up}개가 오르며 시장 전반에 온기가 돌았고, 스마트머니도 지수형 ETF로 강력하게 순유입되었습니다. 🔥`,
    };
  }

  // 4. 보합 / 혼조세 (Sideways / Mixed - Default)
  return {
    code: "SIDEWAYS_MIXED",
    statusName: "보합 / 횡보 혼조세",
    badgeTag: "⚖️ 보합 혼조세",
    slide1Subheadline: `'${topThemeName}' 테마 상승 속 '${topInflowName}' 스마트머니 유입 🔍`,
    slide1Tip: `💡 KOSPI ${kospiSign}${kospi.toFixed(2)}% vs 일반 ETF ${etfSign}${etfRet.toFixed(2)}% · 뚜렷한 방향성 탐색 속 테마별 각개전투`,
    slide6Block1Title: `코스피 ${kospiSign}${kospi.toFixed(2)}% vs 일반 ETF ${etfSign}${etfRet.toFixed(2)}% 팽팽한 보합세`,
    slide6Block1Desc: `상승 ${up}개 · 보합 ${flat}개 · 하락 ${down}개로 맞서며 뚜렷한 지수 방향성 없이 테마 압축 매매 전개.`,
    captionOpening: `어제 국내 증시는 코스피가 ${kospiSign}${kospi.toFixed(2)}%로 보합권에 머물며 방향성 탐색 국면을 이어갔습니다. ☕`,
    captionMarketSummary: `상승 ${up}개 대비 하락 ${down}개로 팽팽하게 맞서며, 지수의 겉모습보다 개별 테마 압축 매매가 두드러진 하루였습니다. 📊`,
    threadsOpening: `어제 코스피는 ${kospiSign}${kospi.toFixed(2)}% 보합권에서 숨을 골랐어요. ☕`,
    threadsMarketSummary: `상승 ${up}개, 하락 ${down}개로 팽팽하게 맞서며 뚜렷한 지수 방향성보다는 개별 테마별로 실속을 챙기는 각개전투 장세였습니다. 🧭`,
  };
}
