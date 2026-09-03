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
  captionThemeAnalysis: string;
  captionWatchPoint: string;
  // Threads Opening & Ending
  threadsOpening: string;
  threadsMarketSummary: string;
  threadsWatchPoint: string;
  // Common Clean First Comment
  firstComment: string;
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
      captionMarketSummary: `국내 대형주를 중심으로 매도세가 출회되었으나, 글로벌 자산배분 및 금리형 ETF가 지수 대비 하락폭을 일부 방어하며 충격을 흡수했습니다. 📊`,
      captionThemeAnalysis: `원자재·에너지 및 배당형 등 방어적 자산군이 플러스 수익률을 기록하며 선방한 반면, 조선·해운 및 설비 인프라 등 고베타 경기민감 섹터는 지수 낙폭을 웃도는 차익 매물이 집중되었습니다.`,
      captionWatchPoint: `지수 급락 국면에서는 낙폭 과대 종목의 섣부른 물타기보다, 글로벌 분산 자산의 방어력과 미 국채금리·환율 변동성 안착 여부를 먼저 확인하는 것이 안전합니다.`,
      threadsOpening: `어제 코스피가 ${kospiSign}${kospi.toFixed(2)}% 급락하면서 계좌 열어보기 무서우셨을 텐데요. 📉`,
      threadsMarketSummary: `국내 상장 일반 ETF 1,025개 중 ${down}개가 하락하며 전방위 약세를 보였지만, ETF 전체 수익률은 ${etfSign}${etfRet.toFixed(2)}%로 지수보다는 덜 빠졌어요. 글로벌 분산과 원자재·금리형 ETF가 방어벽 역할을 해준 덕분입니다. 🛡️`,
      threadsWatchPoint: `지수가 큰 폭의 조정을 겪을 때는 지수 자체보다 섹터 간 자금 이동 경로와 방어 자산의 완충력을 관찰하는 것이 훨씬 중요합니다. 오늘 개장 후 여러분의 관심 섹터는 어디인가요? 💬`,
      firstComment: `📊 기준일: 전 거래일 한국거래소(KRX) 공시 데이터 마감 기준. (순자산 500억 원 이상, 상장 3개월 이상 일반 ETF 대상 요약 / 투자 권유 아님)`,
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
      captionThemeAnalysis: `지수 횡보 조정 속에서 방산 및 고배당 테마로 자금이 이동하는 순환매가 뚜렷했던 반면, 단기 급등했던 테크 및 성장 테마는 숨고르기 매물이 출회되었습니다.`,
      captionWatchPoint: `숨고르기 장세에서는 지수 추종보다 섹터 간 자금 로테이션과 외국인 수급이 유입되는 테마군의 지속성을 점검하는 것이 유효합니다.`,
      threadsOpening: `어제 코스피는 ${kospiSign}${kospi.toFixed(2)}% 조정을 받으며 숨고르기에 들어갔어요. ☕`,
      threadsMarketSummary: `일반 ETF 시장도 하락 ${down}개로 약세 흐름이었지만, 주도 테마군으로는 스마트머니의 분할 매수세가 꾸준히 유입되는 차별화 장세였습니다. 🧭`,
      threadsWatchPoint: `지수가 숨을 고를 때는 지수 등락보다 테마 간 자금 이동과 순환매 길목을 지키는 관찰이 필요합니다. 오늘 개장 후 여러분은 어떤 지표를 가장 눈여겨보고 계신가요? 💬`,
      firstComment: `📊 기준일: 전 거래일 한국거래소(KRX) 공시 데이터 마감 기준. (순자산 500억 원 이상, 상장 3개월 이상 일반 ETF 대상 요약 / 투자 권유 아님)`,
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
      captionThemeAnalysis: `외인·기관의 적극적인 동반 매수에 힘입어 대표지수 및 핵심 성장 테마군으로 강한 수급이 유입되었으며, 하락 테마는 소수의 경기방어형에 국한되었습니다.`,
      captionWatchPoint: `상승 랠리 국면에서는 추격 매수보다 주도 테마의 거래대금 유지 여부와 스마트머니의 지속적인 순유입 강도를 확인하는 것이 바람직합니다.`,
      threadsOpening: `어제 코스피가 ${kospiSign}${kospi.toFixed(2)}% 시원하게 쏘아 올리며 반등에 성공했어요! 🚀`,
      threadsMarketSummary: `일반 ETF 1,025개 중 ${up}개가 오르며 시장 전반에 온기가 돌았고, 스마트머니도 지수형 ETF로 강력하게 순유입되었습니다. 🔥`,
      threadsWatchPoint: `강한 반등장일수록 테마의 거래대금과 실질 자금 순유입 지속성을 차분히 분별하는 태도가 중요합니다. 오늘 개장 후 여러분이 주목하는 랠리 주도주는 어디인가요? 💬`,
      firstComment: `📊 기준일: 전 거래일 한국거래소(KRX) 공시 데이터 마감 기준. (순자산 500억 원 이상, 상장 3개월 이상 일반 ETF 대상 요약 / 투자 권유 아님)`,
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
    captionThemeAnalysis: `지수 횡보 속에서 뚜렷한 주도주 없이 개별 이슈에 따른 테마별 각개전투가 이어졌으며, 자금은 단기 모멘텀 테마와 안전자산으로 양분되는 흐름을 나타냈습니다.`,
    captionWatchPoint: `방향성이 부재한 횡보장에서는 무리한 방향성 베팅보다 자산배분 관점의 리밸런싱 기회를 점검하는 것이 유리합니다.`,
    threadsOpening: `어제 코스피는 ${kospiSign}${kospi.toFixed(2)}% 보합권에서 숨을 골랐어요. ☕`,
    threadsMarketSummary: `상승 ${up}개, 하락 ${down}개로 팽팽하게 맞서며 뚜렷한 지수 방향성보다는 개별 테마별로 실속을 챙기는 각개전투 장세였습니다. 🧭`,
    threadsWatchPoint: `지수가 박스권에 갇혀 있을 때는 지수 등락보다 실물 경기 지표와 스마트머니의 바닥 다지기 흐름을 살피는 것이 좋습니다. 오늘 여러분의 포트폴리오 전략은 무엇인가요? 💬`,
    firstComment: `📊 기준일: 전 거래일 한국거래소(KRX) 공시 데이터 마감 기준. (순자산 500억 원 이상, 상장 3개월 이상 일반 ETF 대상 요약 / 투자 권유 아님)`,
  };
}
