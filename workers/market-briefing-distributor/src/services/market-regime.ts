import type { MarketBriefingPayload } from "../types";

export type MarketRegimeCode =
  | "STRONG_BULL"
  | "MILD_BULL"
  | "SIDEWAYS_MIXED"
  | "MILD_BEAR"
  | "DEEP_BEAR"
  | "DECOUPLING_DEFENSE";

export type SmartMoneyCharacter =
  | "PARKING_SAFETY"
  | "GROWTH_BETA"
  | "DIVIDEND_INCOME"
  | "GLOBAL_MACRO"
  | "BALANCED_ROTATION";

export type DisparityStatus =
  | "PREMIUM_WARNING"
  | "DISCOUNT_OPPORTUNITY"
  | "PREMIUM_AND_DISCOUNT"
  | "STABLE_NORMAL";

export interface MarketRegime {
  code: MarketRegimeCode;
  statusName: string;
  badgeTag: string;
  flowCharacter: SmartMoneyCharacter;
  disparityStatus: DisparityStatus;

  // Slide 1 (Cover & 3 Pulses)
  slide1Subheadline: string;
  slide1Tip: string;

  // Slide 4 (Smart Money Flow Banner & Context)
  slide4BannerTitle: string;
  slide4BannerDesc: string;

  // Slide 5 (Disparity Warning & Actionable Tip)
  slide5BannerTitle: string;
  slide5BannerDesc: string;
  slide5ActionTip: string;

  // Slide 6 (Summary Blocks)
  slide6Block1Title: string;
  slide6Block1Desc: string;

  // Instagram Caption (5 Sections)
  captionOpening: string;
  captionMarketSummary: string;
  captionThemeAnalysis: string;
  captionWatchPoint: string;

  // Threads Post (5 Layers)
  threadsOpening: string;
  threadsMarketSummary: string;
  threadsWatchPoint: string;

  // First Comment
  firstComment: string;
}

// ---------------------------------------------------------------------------
// 1. 펀드 애널리스트 관점: 스마트머니 수급 성격 판별 함수
// ---------------------------------------------------------------------------
export function analyzeSmartMoneyCharacter(payload: MarketBriefingPayload): {
  character: SmartMoneyCharacter;
  characterName: string;
  topItemName: string;
  secondItemName: string;
  top5InflowSum: number;
} {
  const topInflows = payload.periodicFlows?.dailyFundFlows?.topInflows || [];
  const top5 = topInflows.slice(0, 5);
  const top5InflowSum = top5.reduce((sum, item) => sum + (item.inflow || 0), 0);
  const topItemName = top5[0]?.name || (top5[0] as any)?.etfName || "핵심 종목";
  const secondItemName = top5[1]?.name || (top5[1] as any)?.etfName || "";

  let parkingScore = 0;
  let growthScore = 0;
  let dividendScore = 0;
  let macroScore = 0;

  for (const item of top5) {
    const name = item.name || (item as any).etfName || "";
    const inflow = item.inflow || 1;

    if (/CD|KOFR|SOFR|단기채|머니마켓|MMF|파킹|초단기/i.test(name)) {
      parkingScore += inflow;
    } else if (/200|코스닥|나스닥|반도체|AI|테크|빅테크|2차전지|로봇|레버리지/i.test(name)) {
      growthScore += inflow;
    } else if (/배당|커버드콜|리츠|인컴|다우존스/i.test(name)) {
      dividendScore += inflow;
    } else if (/국채|미국채|금|골드|원유|원자재|달러/i.test(name)) {
      macroScore += inflow;
    }
  }

  const maxScore = Math.max(parkingScore, growthScore, dividendScore, macroScore);

  if (maxScore === parkingScore && parkingScore > 0) {
    return {
      character: "PARKING_SAFETY",
      characterName: "단기자금 및 금리형 안전자산",
      topItemName,
      secondItemName,
      top5InflowSum,
    };
  }
  if (maxScore === growthScore && growthScore > 0) {
    return {
      character: "GROWTH_BETA",
      characterName: "대표지수 및 주도 기술주",
      topItemName,
      secondItemName,
      top5InflowSum,
    };
  }
  if (maxScore === dividendScore && dividendScore > 0) {
    return {
      character: "DIVIDEND_INCOME",
      characterName: "고배당 및 월지급식 인컴 자산",
      topItemName,
      secondItemName,
      top5InflowSum,
    };
  }
  if (maxScore === macroScore && macroScore > 0) {
    return {
      character: "GLOBAL_MACRO",
      characterName: "글로벌 채권 및 원자재 분산 자산",
      topItemName,
      secondItemName,
      top5InflowSum,
    };
  }

  return {
    character: "BALANCED_ROTATION",
    characterName: "섹터 순환매 선별 자산",
    topItemName,
    secondItemName,
    top5InflowSum,
  };
}

// ---------------------------------------------------------------------------
// 2. 퀀트 트레이더 관점: 괴리율 왜곡 상태 및 실전 매매 조언 판별 함수
// ---------------------------------------------------------------------------
export function analyzeDisparityState(payload: MarketBriefingPayload): {
  status: DisparityStatus;
  bannerTitle: string;
  bannerDesc: string;
  actionTip: string;
  badgeText: string;
  premiumsCount: number;
  discountsCount: number;
} {
  const disparityList = payload.disparityWarning || [];
  const premiums = disparityList.filter((d) => (d.disparityPct ?? 0) > 0);
  const discounts = disparityList.filter((d) => (d.disparityPct ?? 0) < 0);

  if (premiums.length > 0 && discounts.length > 0) {
    return {
      status: "PREMIUM_AND_DISCOUNT",
      badgeText: "왜곡 주의",
      bannerTitle: `고평가 할증 ${premiums.length}개 vs 저평가 할인 ${discounts.length}개 괴리율 왜곡 동시 발생`,
      bannerDesc: `해외 시차 및 호가 공백에 따른 양방향 왜곡입니다. 장 시작 후 LP 호가 정상 복귀를 확인해야 합니다.`,
      actionTip: `종목별로 할증과 할인이 엇갈리는 국면에서는 일괄 매매를 피하고 개별 ETF의 실시간 괴리율 지표를 반드시 대조하십시오.`,
      premiumsCount: premiums.length,
      discountsCount: discounts.length,
    };
  }

  if (premiums.length > 0) {
    return {
      status: "PREMIUM_WARNING",
      badgeText: "할증 주의",
      bannerTitle: `고평가(할증) ${premiums.length}개 종목 괴리율 왜곡 발생`,
      bannerDesc: `순자산가치(NAV) 대비 시장가가 높게 형성되었습니다. 시초가 고점 추격 매수에 유의하십시오.`,
      actionTip: `고평가 상태에서는 순자산가치 대비 웃돈을 주고 매수하는 불리함이 있습니다. 개장 직후 5~10분간 LP 호가 스프레드가 좁혀질 때까지 분할 접근하는 것이 안전합니다.`,
      premiumsCount: premiums.length,
      discountsCount: 0,
    };
  }

  if (discounts.length > 0) {
    return {
      status: "DISCOUNT_OPPORTUNITY",
      badgeText: "할인 체크",
      bannerTitle: `저평가(할인) ${discounts.length}개 종목 괴리율 왜곡 발생`,
      bannerDesc: `순자산가치(NAV) 대비 시장가가 낮게 형성되었습니다. LP 호가 정상 공급 여부를 체크하십시오.`,
      actionTip: `저평가 상태는 시장 가격이 순자산가치보다 할인된 상태이나, 유동성이 부족한 일시적 호가 공백일 수 있으므로 매수 잔량의 호가 두께를 확인한 후 접근하십시오.`,
      premiumsCount: 0,
      discountsCount: discounts.length,
    };
  }

  return {
    status: "STABLE_NORMAL",
    badgeText: "시장 안정",
    bannerTitle: "국내 상장 일반 ETF 전 종목 정상 괴리율 범위 유지",
    bannerDesc: "전 종목이 법정 허용 범위 내에서 안정적으로 정상 거래 중입니다.",
    actionTip: "전 종목이 적정 호가 범위 내에서 효율적으로 거래되고 있어 가격 왜곡 없이 기초지수 추종이 원활합니다.",
    premiumsCount: 0,
    discountsCount: 0,
  };
}

// ---------------------------------------------------------------------------
// 3. 메인 시나리오 매트릭스 엔진 (하드코딩 배제, 펀드 애널리스트 로직)
// ---------------------------------------------------------------------------
export function classifyMarketRegime(payload: MarketBriefingPayload): MarketRegime {
  const kospi = payload.kospiChangePct ?? 0;
  const etfRet = payload.generalAumWeightedReturnPct ?? 0;
  const up = payload.upCount ?? 0;
  const down = payload.downCount ?? 0;
  const flat = payload.flatCount ?? 0;
  const total = up + down + flat || 1025;
  const upRatio = up / total;
  const downRatio = down / total;

  const topThemeObj = payload.peerGroups?.find((p) => (p.cappedAumWeightedReturnPct ?? 0) > 0) || payload.peerGroups?.[0];
  const bottomThemeObj = payload.peerGroups?.slice().reverse().find((p) => (p.cappedAumWeightedReturnPct ?? 0) < 0) || payload.peerGroups?.[payload.peerGroups.length - 1];
  const topThemeName = topThemeObj ? topThemeObj.peerGroup.replace(/\s*\([^)]*\)/g, "").trim() : "주요 섹터";
  const bottomThemeName = bottomThemeObj ? bottomThemeObj.peerGroup.replace(/\s*\([^)]*\)/g, "").trim() : "소외 섹터";
  const topThemeRet = topThemeObj?.cappedAumWeightedReturnPct ?? 0;
  const bottomThemeRet = bottomThemeObj?.cappedAumWeightedReturnPct ?? 0;

  const kospiSign = kospi > 0 ? "+" : "";
  const etfSign = etfRet > 0 ? "+" : "";

  // 1. 수급 성격 분석
  const flow = analyzeSmartMoneyCharacter(payload);
  // 2. 괴리율 왜곡 분석
  const disparity = analyzeDisparityState(payload);

  // 3. 시장 국면 판별 (6대 시나리오)
  let code: MarketRegimeCode = "SIDEWAYS_MIXED";
  let statusName = "보합 / 횡보 혼조세";
  let badgeTag = "보합 혼조세";

  if (kospi <= -0.5 && etfRet >= 0.0) {
    code = "DECOUPLING_DEFENSE";
    statusName = "지수 약세 속 ETF 방어 선방";
    badgeTag = "자산배분 선방";
  } else if (kospi <= -1.8 || downRatio >= 0.70) {
    code = "DEEP_BEAR";
    statusName = "급락 / 전방위 약세";
    badgeTag = "전방위 약세";
  } else if (kospi <= -0.5 || downRatio > 0.55) {
    code = "MILD_BEAR";
    statusName = "조정 / 하락 우세";
    badgeTag = "조정 장세";
  } else if (kospi >= 1.5 || upRatio >= 0.65) {
    code = "STRONG_BULL";
    statusName = "급등 / 광범위 랠리";
    badgeTag = "강한 랠리";
  } else if (kospi >= 0.5 || upRatio > 0.55) {
    code = "MILD_BULL";
    statusName = "반등 / 상승 우세";
    badgeTag = "반등 장세";
  } else {
    code = "SIDEWAYS_MIXED";
    statusName = "보합 / 횡보 혼조세";
    badgeTag = "보합 혼조세";
  }

  // 4. 시나리오별 전문가 텍스트 조립 매트릭스 (하드코딩 배제, 이모지 0개 엄수)
  let slide1Subheadline = "";
  let slide1Tip = "";
  let slide4BannerTitle = "";
  let slide4BannerDesc = "";
  let slide6Block1Title = "";
  let slide6Block1Desc = "";
  let captionOpening = "";
  let captionMarketSummary = "";
  let captionThemeAnalysis = "";
  let captionWatchPoint = "";
  let threadsOpening = "";
  let threadsMarketSummary = "";
  let threadsWatchPoint = "";

  // Slide 4 수급 배너 기본 조립
  if (flow.character === "PARKING_SAFETY") {
    slide4BannerTitle = `스마트머니, 단기자금 및 금리형 안전자산 집중 순유입`;
    slide4BannerDesc = `시장 변동성 경계감 속에서 상위 5종목으로 총 ${flow.top5InflowSum.toLocaleString()}억원 실질 자금 순유입`;
  } else if (flow.character === "GROWTH_BETA") {
    slide4BannerTitle = `스마트머니, 대표지수 및 핵심 성장 테마로 공격적 순유입`;
    slide4BannerDesc = `상방 모멘텀 확산 흐름 속에서 상위 5종목으로 총 ${flow.top5InflowSum.toLocaleString()}억원 실질 자금 순유입`;
  } else if (flow.character === "DIVIDEND_INCOME") {
    slide4BannerTitle = `스마트머니, 고배당 및 월지급식 인컴 ETF 선별 순유입`;
    slide4BannerDesc = `방어적 현금흐름 확보 흐름 속에서 상위 5종목으로 총 ${flow.top5InflowSum.toLocaleString()}억원 실질 자금 순유입`;
  } else if (flow.character === "GLOBAL_MACRO") {
    slide4BannerTitle = `스마트머니, 글로벌 채권 및 원자재 분산 자산 집중 순유입`;
    slide4BannerDesc = `글로벌 거시 리스크 분산 속에서 상위 5종목으로 총 ${flow.top5InflowSum.toLocaleString()}억원 실질 자금 순유입`;
  } else {
    slide4BannerTitle = flow.secondItemName
      ? `스마트머니, '${flow.topItemName}' 및 '${flow.secondItemName}' 중심 순유입`
      : `스마트머니, '${flow.topItemName}' 등 상위 자산 중심 순유입`;
    slide4BannerDesc = `선별적 분할 매수세 속에서 상위 5종목으로 총 ${flow.top5InflowSum.toLocaleString()}억원 실질 자금 순유입`;
  }

  // 시나리오 분기
  switch (code) {
    case "DECOUPLING_DEFENSE":
      slide1Subheadline = `'${topThemeName}' 테마 선방 속 ${flow.characterName} 순유입 지속`;
      slide1Tip = `KOSPI ${kospiSign}${kospi.toFixed(2)}% vs 일반 ETF ${etfSign}${etfRet.toFixed(2)}% · 국내 증시 약세 속 글로벌 분산 및 채권 자산의 방어벽 작동`;
      slide6Block1Title = `코스피 ${kospiSign}${kospi.toFixed(2)}% 약세 속 일반 ETF ${etfSign}${etfRet.toFixed(2)}% 자산배분 선방`;
      slide6Block1Desc = `국내 대형주 조정으로 하락 종목(${down}개)이 우세했으나, 글로벌 환노출 및 금리형 ETF가 지수 하락폭을 완충하며 계좌 손실을 방어.`;
      captionOpening = `어제 국내 증시는 코스피가 ${kospiSign}${kospi.toFixed(2)}% 하락하며 조정을 겪었으나, 일반 ETF 시장은 ${etfSign}${etfRet.toFixed(2)}%로 선방하며 자산배분의 위력을 입증했습니다.`;
      captionMarketSummary = `국내 지수 추종 종목에 매물이 출회되었음에도, 글로벌 자산과 채권형 ETF로 스마트머니가 유입되며 지수 낙폭을 효과적으로 흡수했습니다.`;
      captionThemeAnalysis = `${topThemeName}(${topThemeRet > 0 ? "+" : ""}${topThemeRet.toFixed(2)}%) 테마가 지수 대비 뚜렷한 상대적 강세를 보인 반면, ${bottomThemeName}(${bottomThemeRet.toFixed(2)}%) 섹터는 매도 압력을 받았습니다.`;
      captionWatchPoint = `국내 주식 시장의 단기 흔들림에 흔들리지 않고, 글로벌 자산과 금리형 ETF를 고르게 배분하는 포트폴리오의 방어력을 점검할 시점입니다.`;
      threadsOpening = `어제 코스피는 ${kospiSign}${kospi.toFixed(2)}% 조정을 받았지만, 일반 ETF 시장은 ${etfSign}${etfRet.toFixed(2)}%로 든든하게 버텨주었습니다.`;
      threadsMarketSummary = `국내 단일 지수만 보면 하락 ${down}개로 불안할 수 있었지만, 해외 분산과 채권형 ETF가 충격을 온전히 완충해주었어요.`;
      threadsWatchPoint = `지수가 빠질 때 포트폴리오의 실질 방어력이 어떻게 발휘되는지 확인하는 것이 진짜 자산배분의 묘미입니다. 오늘 개장 후 여러분의 방어선은 어디에 두고 계신가요?`;
      break;

    case "DEEP_BEAR":
      slide1Subheadline = `'${topThemeName}' 테마 방어 속 ${flow.characterName} 유입`;
      slide1Tip = `KOSPI ${kospiSign}${kospi.toFixed(2)}% vs 일반 ETF ${etfSign}${etfRet.toFixed(2)}% · 전방위 하락 속 안전자산 및 방어 섹터로 수급 이동`;
      slide6Block1Title = `코스피 ${kospiSign}${kospi.toFixed(2)}% 급락 속 일반 ETF ${etfSign}${etfRet.toFixed(2)}% 전방위 약세`;
      slide6Block1Desc = `거센 시장 매도세로 하락 종목(${down}개)이 쏟아졌으나, 금리형 및 방어적 자산군이 지수 충격을 완충.`;
      captionOpening = `어제 국내 증시는 코스피가 ${kospiSign}${kospi.toFixed(2)}% 급락하며 거센 하락 압력을 받았습니다. 일반 ETF 시장 역시 ${down}개 종목이 하락하며 전방위 약세를 나타냈습니다.`;
      captionMarketSummary = `국내 대형주 전반에 걸쳐 매물이 출회되었으나, 초단기 파킹형 및 금리형 ETF로 자금이 집중되며 시스템 전반의 리스크 완충 역할을 수행했습니다.`;
      captionThemeAnalysis = `${topThemeName}(${topThemeRet > 0 ? "+" : ""}${topThemeRet.toFixed(2)}%) 등 소수의 방어적 테마가 플러스 권역을 지켰으며, ${bottomThemeName}(${bottomThemeRet.toFixed(2)}%) 등 경기민감 섹터는 낙폭을 확대했습니다.`;
      captionWatchPoint = `지수 급락 국면에서는 낙폭 과대 종목의 성급한 추가 매수보다, 실질 자금 순유입 지표와 환율 변동성 안착 여부를 먼저 점검하는 것이 유리합니다.`;
      threadsOpening = `어제 코스피가 ${kospiSign}${kospi.toFixed(2)}% 급락하며 시장 전반에 큰 하락 압력이 가해졌어요.`;
      threadsMarketSummary = `일반 ETF 1,025개 중 ${down}개가 하락하며 약세가 짙었지만, ETF 전체 가중수익률은 ${etfSign}${etfRet.toFixed(2)}%로 지수보다 충격을 덜 받았습니다. 안전자산이 든든한 방파제가 되어주었어요.`;
      threadsWatchPoint = `지수가 크게 출렁일 때는 지수 자체보다 스마트머니가 이동하는 길목과 방어 자산의 버팀력을 관찰하는 것이 중요합니다. 오늘 여러분의 관심 섹터는 어디인가요?`;
      break;

    case "MILD_BEAR":
      slide1Subheadline = `'${topThemeName}' 테마 반등 속 ${flow.characterName} 유입`;
      slide1Tip = `KOSPI ${kospiSign}${kospi.toFixed(2)}% vs 일반 ETF ${etfSign}${etfRet.toFixed(2)}% · 지수 조정 속 주도 섹터와 소외 섹터 간 온도차`;
      slide6Block1Title = `코스피 ${kospiSign}${kospi.toFixed(2)}% 조정 속 일반 ETF ${etfSign}${etfRet.toFixed(2)}% 차별화 장세`;
      slide6Block1Desc = `단기 매물 출회로 하락 종목(${down}개) 우세 흐름 속에서도 주도 테마군으로 선별적 수급 유입 전개.`;
      captionOpening = `어제 코스피는 ${kospiSign}${kospi.toFixed(2)}% 조정을 받으며 숨고르기에 들어갔습니다. 일반 ETF 시장에서도 하락 종목이 ${down}개로 집계되며 매물 소화 과정이 이어졌습니다.`;
      captionMarketSummary = `지수 전반의 조정 국면 속에서도 주도 테마와 소외 테마 간 수익률 격차가 뚜렷하게 벌어지는 섹터 로테이션이 전개되었습니다.`;
      captionThemeAnalysis = `${topThemeName}(${topThemeRet > 0 ? "+" : ""}${topThemeRet.toFixed(2)}%) 테마가 플러스 수익률로 중심을 잡은 반면, ${bottomThemeName}(${bottomThemeRet.toFixed(2)}%) 섹터는 차익 매물이 집중되었습니다.`;
      captionWatchPoint = `숨고르기 장세에서는 지수 추종보다 섹터 간 자금 이동 경로와 실질 순유입 상위 종목의 지속성을 확인하는 전략이 적합합니다.`;
      threadsOpening = `어제 코스피는 ${kospiSign}${kospi.toFixed(2)}% 조정을 받으며 숨고르기에 들어갔어요.`;
      threadsMarketSummary = `일반 ETF 시장도 하락 ${down}개로 조정 흐름이었지만, 주도 테마군으로는 스마트머니의 분할 매수세가 꾸준히 유입되는 차별화 장세였습니다.`;
      threadsWatchPoint = `지수가 숨을 고를 때는 지수 등락보다 테마 간 자금 이동과 순환매 길목을 지키는 관찰이 필요합니다. 오늘 개장 후 여러분은 어떤 지표를 눈여겨보시나요?`;
      break;

    case "STRONG_BULL":
      slide1Subheadline = `'${topThemeName}' 테마 주도 속 ${flow.characterName} 유입 확산`;
      slide1Tip = `KOSPI ${kospiSign}${kospi.toFixed(2)}% vs 일반 ETF ${etfSign}${etfRet.toFixed(2)}% · 대형주 및 성장 테마 전반으로 온기 확산`;
      slide6Block1Title = `코스피 ${kospiSign}${kospi.toFixed(2)}% 급등 속 일반 ETF ${etfSign}${etfRet.toFixed(2)}% 동반 랠리`;
      slide6Block1Desc = `외인·기관의 적극적인 순매수 유입으로 상승 종목(${up}개)이 시장 전반의 상승 열기를 견인.`;
      captionOpening = `어제 국내 증시는 코스피가 ${kospiSign}${kospi.toFixed(2)}% 급등하며 강력한 반등 랠리를 펼쳤습니다. 일반 ETF 시장 역시 상승 ${up}개로 시장 전반에 광범위한 온기가 돌았습니다.`;
      captionMarketSummary = `외인과 기관의 동반 순매수가 유입되며 핵심 성장 테마 및 대표지수 전반으로 강한 수급 모멘텀이 이어졌습니다.`;
      captionThemeAnalysis = `${topThemeName}(${topThemeRet > 0 ? "+" : ""}${topThemeRet.toFixed(2)}%) 테마가 강한 거래대금을 동반하며 상승을 이끌었고, ${bottomThemeName}(${bottomThemeRet.toFixed(2)}%) 등 일부 소외 섹터만 제한적인 조정을 받았습니다.`;
      captionWatchPoint = `상승 랠리 국면에서는 무리한 추격 매수보다 주도 테마의 거래대금 유지 여부와 스마트머니의 실질 순유입 연속성을 분별하는 것이 바람직합니다.`;
      threadsOpening = `어제 코스피가 ${kospiSign}${kospi.toFixed(2)}% 시원하게 오르며 강한 반등에 성공했어요.`;
      threadsMarketSummary = `일반 ETF 1,025개 중 ${up}개가 오르며 시장 전반에 훈풍이 불었고, 스마트머니도 지수형 및 주도 테마로 힘차게 유입되었습니다.`;
      threadsWatchPoint = `강한 반등장일수록 테마의 거래대금과 실질 자금 순유입 지속성을 차분히 분별하는 태도가 중요합니다. 오늘 개장 후 여러분이 주목하는 주도주는 어디인가요?`;
      break;

    case "MILD_BULL":
      slide1Subheadline = `'${topThemeName}' 테마 중심 반등 속 ${flow.characterName} 수급 안정`;
      slide1Tip = `KOSPI ${kospiSign}${kospi.toFixed(2)}% vs 일반 ETF ${etfSign}${etfRet.toFixed(2)}% · 주도 섹터 중심의 선별적 반등과 하방 경직성 확보`;
      slide6Block1Title = `코스피 ${kospiSign}${kospi.toFixed(2)}% 반등 속 일반 ETF ${etfSign}${etfRet.toFixed(2)}% 완만한 상승`;
      slide6Block1Desc = `상승 종목(${up}개)이 우위를 보이며 주도 테마를 중심으로 지수 하방 경직성을 다지는 안정적 흐름 전개.`;
      captionOpening = `어제 코스피는 ${kospiSign}${kospi.toFixed(2)}% 상승하며 긍정적인 흐름을 나타냈습니다. 일반 ETF 시장에서도 상승 ${up}개로 매수 우위의 온기가 감돌았습니다.`;
      captionMarketSummary = `주도 섹터를 중심으로 선별적 매수세가 이어지며 시장 전반의 변동성을 낮추고 안정적인 반등 흐름을 이어갔습니다.`;
      captionThemeAnalysis = `${topThemeName}(${topThemeRet > 0 ? "+" : ""}${topThemeRet.toFixed(2)}%) 섹터가 견조한 오름세를 보인 가운데, ${bottomThemeName}(${bottomThemeRet.toFixed(2)}%) 테마는 보합권에서 매물을 소화했습니다.`;
      captionWatchPoint = `점진적 반등 국면에서는 지수 추종과 함께 주도 테마의 이익 모멘텀 및 수급 강도를 함께 점검하는 것이 유리합니다.`;
      threadsOpening = `어제 코스피는 ${kospiSign}${kospi.toFixed(2)}% 상승하며 차분한 반등세를 이어갔어요.`;
      threadsMarketSummary = `일반 ETF 시장도 상승 ${up}개로 매수세가 우위를 점하며 주도 섹터를 중심으로 하방 경직성을 단단히 다지는 하루였습니다.`;
      threadsWatchPoint = `완만한 반등 장세에서는 시장 전체의 지수 등락과 함께 실질 자금이 집중되는 주도 테마의 연속성을 확인하는 것이 좋습니다. 오늘 여러분의 시선은 어디로 향하고 계신가요?`;
      break;

    default: // SIDEWAYS_MIXED
      slide1Subheadline = `'${topThemeName}' 테마 선별 상승 속 ${flow.characterName} 유입`;
      slide1Tip = `KOSPI ${kospiSign}${kospi.toFixed(2)}% vs 일반 ETF ${etfSign}${etfRet.toFixed(2)}% · 뚜렷한 방향성 탐색 속 테마별 각개전투`;
      slide6Block1Title = `코스피 ${kospiSign}${kospi.toFixed(2)}% vs 일반 ETF ${etfSign}${etfRet.toFixed(2)}% 팽팽한 보합세`;
      slide6Block1Desc = `상승 ${up}개 · 보합 ${flat}개 · 하락 ${down}개로 맞서며 뚜렷한 지수 방향성 없이 테마 압축 매매 전개.`;
      captionOpening = `어제 국내 증시는 코스피가 ${kospiSign}${kospi.toFixed(2)}%로 보합권에 머물며 방향성 탐색 국면을 이어갔습니다.`;
      captionMarketSummary = `상승 종목(${up}개)과 하락 종목(${down}개)이 팽팽하게 맞서며, 지수의 겉모습보다 개별 테마의 실속 있는 압축 매매가 두드러진 하루였습니다.`;
      captionThemeAnalysis = `지수 횡보 속에서 ${topThemeName}(${topThemeRet > 0 ? "+" : ""}${topThemeRet.toFixed(2)}%) 테마가 선방한 반면, ${bottomThemeName}(${bottomThemeRet.toFixed(2)}%) 섹터는 숨고르기 흐름을 보였습니다.`;
      captionWatchPoint = `방향성이 부재한 횡보장에서는 성급한 방향성 베팅보다 자산배분 관점의 리밸런싱 기회와 스마트머니의 바닥 다지기를 점검하는 것이 유리합니다.`;
      threadsOpening = `어제 코스피는 ${kospiSign}${kospi.toFixed(2)}% 보합권에서 숨을 골랐어요.`;
      threadsMarketSummary = `상승 ${up}개, 하락 ${down}개로 팽팽하게 맞서며 지수 방향성보다는 개별 테마별로 실속을 챙기는 각개전투 장세였습니다.`;
      threadsWatchPoint = `지수가 박스권에 갇혀 있을 때는 지수 등락보다 실물 경기 지표와 스마트머니의 바닥 다지기 흐름을 살피는 것이 좋습니다. 오늘 여러분의 포트폴리오 전략은 무엇인가요?`;
      break;
  }

  const firstComment = `기준일: 전 거래일 한국거래소(KRX) 공시 데이터 마감 기준. (국내 상장 일반 ETF 1,025개 전수 분석 / 투자 권유 아님)`;

  return {
    code,
    statusName,
    badgeTag,
    flowCharacter: flow.character,
    disparityStatus: disparity.status,
    slide1Subheadline,
    slide1Tip,
    slide4BannerTitle,
    slide4BannerDesc,
    slide5BannerTitle: disparity.bannerTitle,
    slide5BannerDesc: disparity.bannerDesc,
    slide5ActionTip: disparity.actionTip,
    slide6Block1Title,
    slide6Block1Desc,
    captionOpening,
    captionMarketSummary,
    captionThemeAnalysis,
    captionWatchPoint,
    threadsOpening,
    threadsMarketSummary,
    threadsWatchPoint,
    firstComment,
  };
}
