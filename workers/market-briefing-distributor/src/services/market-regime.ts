import type { MarketBriefingPayload } from "../types";

export type MarketRegimeCode =
  | "INDEX_ILLUSION_SURGE" // 대형주 쏠림 및 지수 착시형 랠리 (KOSPI 급등 vs 분산 ETF 괴리)
  | "BROAD_RALLY_SURGE"    // 전방위 동반 폭등 / 유동성 서지 (KOSPI & KOSDAQ & ETF 동반 폭등)
  | "GROWTH_BETA_RALLY"    // 중소형·성장 테마 주도 랠리 (KOSDAQ 대폭 아웃퍼폼)
  | "KOSPI_FALL_KOSDAQ_UP" // 대형주 조정 속 코스닥 개별 장세 (지수 엇갈림)
  | "DECOUPLING_DEFENSE"   // 지수 약세 속 ETF 자산배분 선방 (KOSPI 하락 vs ETF 플러스 방어)
  | "EXTREME_SURGE"
  | "SUPER_BULL"
  | "STRONG_BULL_HIGH"
  | "STRONG_BULL"
  | "MODERATE_BULL"
  | "MILD_BULL"
  | "TIGHT_BULL_SIDEWAYS"
  | "TIGHT_BEAR_SIDEWAYS"
  | "MILD_BEAR"
  | "MODERATE_BEAR"
  | "DEEP_BEAR"
  | "HEAVY_DROP"
  | "PANIC_CRASH";

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
  flowCharacterName: string;
  disparityStatus: DisparityStatus;

  // 3대 지표 및 펀드애널리스트 분석 메트릭
  kospiChangePct: number;
  kosdaqChangePct: number;
  etfWeightedReturnPct: number;
  capSpread: number;        // kospi - kosdaq (%p)
  etfDivergence: number;    // kospi - etfRet (%p)

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
      bannerTitle: `고평가 할증 ${premiums.length}개 종목 괴리율 왜곡 발생`,
      bannerDesc: `순자산가치 NAV 대비 시장가가 높게 형성되었습니다. 시초가 고점 추격 매수에 유의하십시오.`,
      actionTip: `고평가 상태에서는 순자산가치 대비 웃돈을 주고 매수하는 불리함이 있습니다. 개장 직후 LP 호가 스프레드가 좁혀질 때까지 분할 접근하는 것이 안전합니다.`,
      premiumsCount: premiums.length,
      discountsCount: 0,
    };
  }

  if (discounts.length > 0) {
    return {
      status: "DISCOUNT_OPPORTUNITY",
      badgeText: "할인 체크",
      bannerTitle: `저평가 할인 ${discounts.length}개 종목 괴리율 왜곡 발생`,
      bannerDesc: `순자산가치 NAV 대비 시장가가 낮게 형성되었습니다. LP 호가 정상 공급 여부를 체크하십시오.`,
      actionTip: `저평가 상태는 시장 가격이 순자산가치보다 할인된 상태이나, 유동성이 부족한 일시적 호가 공백일 수 있으므로 호가 두께를 확인한 후 접근하십시오.`,
      premiumsCount: 0,
      discountsCount: discounts.length,
    };
  }

  return {
    status: "STABLE_NORMAL",
    badgeText: "정상 유지",
    bannerTitle: "국내 상장 일반 ETF 전 종목 정상 괴리율 범위 유지",
    bannerDesc: "전 종목이 법정 허용 범위 내에서 안정적으로 정상 거래 중입니다.",
    actionTip: "해외 ETF 괴리율은 개장 직후 LP 호가가 공급되며 정상 범위로 수렴합니다. 장 초반 무리한 시장가 매수를 피하고 실시간 순자산가치 iNAV를 확인하세요.",
    premiumsCount: 0,
    discountsCount: 0,
  };
}

// ---------------------------------------------------------------------------
// 3. 메인 시나리오 매트릭스 엔진 (하드코딩 배제, 펀드 애널리스트 로직)
// ---------------------------------------------------------------------------
export function classifyMarketRegime(payload: MarketBriefingPayload): MarketRegime {
  const kospi = payload.kospiChangePct ?? 0;
  const kosdaq = payload.kosdaqChangePct ?? 0;
  const etfRet = payload.generalAumWeightedReturnPct ?? 0;
  const capSpread = Number((kospi - kosdaq).toFixed(2));
  const etfDivergence = Number((kospi - etfRet).toFixed(2));

  const up = payload.upCount ?? 0;
  const down = payload.downCount ?? 0;
  const flat = payload.flatCount ?? 0;
  const total = up + down + flat || 1025;
  const upRatio = up / total;
  const downRatio = down / total;

  const sortedPeerGroups = [...(payload.peerGroups || [])].sort(
    (a, b) => (b.cappedAumWeightedReturnPct ?? 0) - (a.cappedAumWeightedReturnPct ?? 0)
  );
  const topThemeObj = sortedPeerGroups[0];
  const bottomThemeObj = sortedPeerGroups.length > 1 ? sortedPeerGroups[sortedPeerGroups.length - 1] : undefined;
  const topThemeName = topThemeObj ? topThemeObj.peerGroup.replace(/\s*\([^)]*\)/g, "").trim() : "주요 섹터";
  const bottomThemeName = bottomThemeObj ? bottomThemeObj.peerGroup.replace(/\s*\([^)]*\)/g, "").trim() : "소외 섹터";
  const topThemeRet = topThemeObj?.cappedAumWeightedReturnPct ?? 0;
  const bottomThemeRet = bottomThemeObj?.cappedAumWeightedReturnPct ?? 0;

  const kospiSign = kospi > 0 ? "+" : "";
  const kosdaqSign = kosdaq > 0 ? "+" : "";
  const etfSign = etfRet > 0 ? "+" : "";

  // 1. 수급 성격 분석
  const flow = analyzeSmartMoneyCharacter(payload);
  // 2. 괴리율 왜곡 분석
  const disparity = analyzeDisparityState(payload);

  // 3. 3대 지표 결합 시장 국면 판별 (KOSPI × KOSDAQ × 일반 ETF 3축 매트릭스)
  let code: MarketRegimeCode = "TIGHT_BULL_SIDEWAYS";
  let statusName = "강보합 탐색 / 매물 소화";
  let badgeTag = "강보합 탐색";

  // [특수 국면 1]: 지수 약세에도 불구하고 ETF 전체 가중수익률이 플러스 선방할 때 (자산배분 방어벽)
  if (kospi <= -0.5 && etfRet >= 0.0) {
    code = "DECOUPLING_DEFENSE";
    statusName = "지수 약세 속 ETF 방어 선방";
    badgeTag = "자산배분 선방";
  }
  // [특수 국면 2]: 대형주 쏠림 및 지수 착시형 랠리 (KOSPI 폭등 vs 코스닥/일반 ETF 괴리 확대)
  else if (kospi >= 2.0 && (etfDivergence >= 1.5 || capSpread >= 2.0)) {
    code = "INDEX_ILLUSION_SURGE";
    statusName = "대형주 쏠림 및 지수 착시형 랠리";
    badgeTag = "대형주 쏠림";
  }
  // [특수 국면 3]: 전방위 동반 폭등 / 유동성 초과열 서지
  else if (kospi >= 3.0 && upRatio >= 0.75 && etfRet >= 2.0) {
    code = "BROAD_RALLY_SURGE";
    statusName = "전방위 동반 폭등 / 유동성 서지";
    badgeTag = "전방위 서지";
  }
  // [특수 국면 4]: 중소형·성장 테마 주도 랠리 (코스닥 대폭 아웃퍼폼)
  else if (kosdaq >= 1.5 && capSpread <= -1.5) {
    code = "GROWTH_BETA_RALLY";
    statusName = "중소형·성장 테마 주도 랠리";
    badgeTag = "성장 테마 주도";
  }
  // [특수 국면 5]: 대형주 조정 속 코스닥 개별 장세 (지수 엇갈림)
  else if (kospi <= -0.3 && kosdaq >= 0.5) {
    code = "KOSPI_FALL_KOSDAQ_UP";
    statusName = "대형주 조정 속 코스닥 개별 장세";
    badgeTag = "코스닥 개별장세";
  }
  // [일반 구간별 단계적 장세]
  else if (kospi >= 3.0 || upRatio >= 0.85) {
    code = "EXTREME_SURGE";
    statusName = "초급등 / 과열 서지";
    badgeTag = "초급등 서지";
  } else if (kospi >= 2.5) {
    code = "SUPER_BULL";
    statusName = "슈퍼 랠리 / 강력한 폭등";
    badgeTag = "슈퍼 랠리";
  } else if (kospi >= 2.0) {
    code = "STRONG_BULL_HIGH";
    statusName = "강한 랠리 / 온기 확산";
    badgeTag = "강한 랠리";
  } else if (kospi >= 1.5 || upRatio >= 0.65) {
    code = "STRONG_BULL";
    statusName = "반등 랠리 / 상방 탄력";
    badgeTag = "반등 랠리";
  } else if (kospi >= 1.0) {
    code = "MODERATE_BULL";
    statusName = "견조한 상승 / 매수 우위";
    badgeTag = "견조한 상승";
  } else if (kospi >= 0.5) {
    code = "MILD_BULL";
    statusName = "완만한 반등 / 선별 매수";
    badgeTag = "완만한 반등";
  } else if (kospi >= 0.0) {
    code = "TIGHT_BULL_SIDEWAYS";
    statusName = "강보합 탐색 / 매물 소화";
    badgeTag = "강보합 탐색";
  } else if (kospi <= -2.5 || downRatio >= 0.85) {
    code = "PANIC_CRASH";
    statusName = "극단적 변동성 / 패닉 투매 경계";
    badgeTag = "패닉 투매 경계";
  } else if (kospi <= -2.0) {
    code = "HEAVY_DROP";
    statusName = "거센 하락 충격 / 지지선 위협";
    badgeTag = "거센 하락 충격";
  } else if (kospi <= -1.5 || downRatio >= 0.70) {
    code = "DEEP_BEAR";
    statusName = "급락 약세 / 전방위 매물 출회";
    badgeTag = "급락 약세";
  } else if (kospi <= -1.0) {
    code = "MODERATE_BEAR";
    statusName = "본격 조정 / 하방 압력";
    badgeTag = "본격 조정";
  } else if (kospi <= -0.5) {
    code = "MILD_BEAR";
    statusName = "완만한 조정 / 단기 매물 출회";
    badgeTag = "완만한 조정";
  } else {
    code = "TIGHT_BEAR_SIDEWAYS";
    statusName = "약보합 혼조 / 횡보 숨고르기";
    badgeTag = "약보합 혼조";
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

  // Slide 4 수급 배너 기본 조립 (수급 성격에 따라 동적 생성)
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

  // 14대 시나리오 정밀 분기
  switch (code) {
    case "DECOUPLING_DEFENSE":
      slide1Subheadline = `'${topThemeName}' 테마 선방 속 ${flow.characterName} 순유입 지속`;
      slide1Tip = `KOSPI ${kospiSign}${kospi.toFixed(2)}% vs 일반 ETF ${etfSign}${etfRet.toFixed(2)}% · 국내 증시 약세 속 글로벌 분산 및 채권 자산의 방어벽 작동`;
      slide6Block1Title = `코스피 ${kospiSign}${kospi.toFixed(2)}% 약세 속 일반 ETF ${etfSign}${etfRet.toFixed(2)}% 자산배분 선방`;
      slide6Block1Desc = `국내 대형주 조정으로 하락 종목 ${down}개이 우세했으나, 글로벌 환노출 및 금리형 ETF가 지수 하락폭을 완충하며 계좌 손실을 방어.`;
      captionOpening = `국내 증시는 코스피가 ${kospiSign}${kospi.toFixed(2)}% 하락하며 조정을 겪었으나, 일반 ETF 시장은 ${etfSign}${etfRet.toFixed(2)}%로 선방하며 자산배분의 위력을 입증했습니다.`;
      captionMarketSummary = `국내 지수 추종 종목에 매물이 출회되었음에도, 글로벌 자산과 채권형 ETF로 스마트머니가 유입되며 지수 낙폭을 효과적으로 흡수했습니다.`;
      captionThemeAnalysis = `${topThemeName} ${topThemeRet > 0 ? "+" : ""}${topThemeRet.toFixed(2)}% 테마가 지수 대비 뚜렷한 상대적 강세를 보인 반면, ${bottomThemeName} ${bottomThemeRet > 0 ? "+" : ""}${bottomThemeRet.toFixed(2)}% 섹터는 매도 압력을 받았습니다.`;
      captionWatchPoint = `국내 주식 시장의 단기 흔들림에 흔들리지 않고, 글로벌 자산과 금리형 ETF를 고르게 배분하는 포트폴리오의 방어력을 점검할 시점입니다.`;
      threadsOpening = `코스피는 ${kospiSign}${kospi.toFixed(2)}% 조정을 받았지만, 일반 ETF 시장은 ${etfSign}${etfRet.toFixed(2)}%로 든든하게 버텨주었습니다.`;
      threadsMarketSummary = `국내 단일 지수만 보면 하락 ${down}개로 불안할 수 있었지만, 해외 분산과 채권형 ETF가 충격을 온전히 완충해주었어요.`;
      threadsWatchPoint = `지수가 빠질 때 포트폴리오의 실질 방어력이 어떻게 발휘되는지 확인하는 것이 진짜 자산배분의 묘미입니다. 오늘 개장 후 여러분의 방어선은 어디에 두고 계신가요?`;
      break;

    case "INDEX_ILLUSION_SURGE":
      slide1Subheadline = `'${topThemeName}' 독주 속 대형주 쏠림 심화`;
      slide1Tip = `KOSPI ${kospiSign}${kospi.toFixed(2)}% vs 일반 ETF ${etfSign}${etfRet.toFixed(2)}% · 대형주 쏠림에 따른 지수 착시 속 분산 ETF 차별화`;
      slide6Block1Title = `코스피 ${kospiSign}${kospi.toFixed(2)}% 급등 속 대형주 쏠림`;
      slide6Block1Desc = `코스피와 분산 ETF 간 +${etfDivergence.toFixed(2)}%p 격차 발생. 시총 상위주 위주 지수 착시 장세.`;
      captionOpening = `국내 증시는 코스피가 ${kospiSign}${kospi.toFixed(2)}% 급등했으나 코스닥은 ${kosdaqSign}${kosdaq.toFixed(2)}%, 일반 ETF 가중수익률은 ${etfSign}${etfRet.toFixed(2)}%에 머물며 대형주 쏠림에 따른 지수 착시가 뚜렷했습니다.`;
      captionMarketSummary = `시총 최상위 대형주로 수급이 집중되며 코스피 지수 상승폭 대비 분산 ETF 포트폴리오의 체감 수익률은 상대적으로 차분한 흐름을 나타냈습니다.`;
      captionThemeAnalysis = `${topThemeName} ${topThemeRet > 0 ? "+" : ""}${topThemeRet.toFixed(2)}% 섹터가 강세를 보이며 지수 상승을 견인한 반면, ${bottomThemeName} ${bottomThemeRet > 0 ? "+" : ""}${bottomThemeRet.toFixed(2)}% 테마는 상대적으로 소외되었습니다.`;
      captionWatchPoint = `대형주 집중 랠리 이후 온기가 중소형주와 다양한 테마로 확산되는지, 또는 차익 실현 매물이 출회되는지 수급의 분산 여부를 확인하는 것이 중요합니다.`;
      threadsOpening = `코스피는 ${kospiSign}${kospi.toFixed(2)}% 급등했지만, 일반 ETF는 ${etfSign}${etfRet.toFixed(2)}%로 대형주 중심의 지수 착시가 나타났어요.`;
      threadsMarketSummary = `코스피와 분산 ETF 수익률 격차가 +${etfDivergence.toFixed(2)}%p에 달해 시총 상위주 위주로 매수세가 집중된 전형적인 차별화 장세였습니다.`;
      threadsWatchPoint = `대형주 랠리 이후 온기가 중소형 테마로 고르게 확산되는지 관찰할 때입니다. 오늘 여러분의 관심 섹터는 어디인가요?`;
      break;

    case "BROAD_RALLY_SURGE":
      slide1Subheadline = `'${topThemeName}' 폭등 속 전방위 동반 서지`;
      slide1Tip = `KOSPI ${kospiSign}${kospi.toFixed(2)}% vs 일반 ETF ${etfSign}${etfRet.toFixed(2)}% · 대형주와 코스닥 동반 급등 속 시장 전반 유동성 폭발`;
      slide6Block1Title = `코스피 ${kospiSign}${kospi.toFixed(2)}% 초급등 속 전방위 서지`;
      slide6Block1Desc = `상승 종목 ${up}개이 75% 이상을 차지하며 전 섹터로 유동성이 확산되는 강력한 랠리 전개.`;
      captionOpening = `국내 증시는 코스피가 ${kospiSign}${kospi.toFixed(2)}%, 코스닥이 ${kosdaqSign}${kosdaq.toFixed(2)}% 동반 급등하며 시장 전반에 걸친 강력한 유동성 서지 국면을 연출했습니다.`;
      captionMarketSummary = `특정 대형주에 국한되지 않고 일반 ETF 시장 전체로 폭넓은 순매수가 유입되며 상승 종목 ${up}개가 시장을 장악했습니다.`;
      captionThemeAnalysis = `${topThemeName} ${topThemeRet > 0 ? "+" : ""}${topThemeRet.toFixed(2)}% 테마가 폭등세를 견인했고, 대부분의 섹터가 동반 상승 탄력을 이어갔습니다.`;
      captionWatchPoint = `전방위 랠리 국면에서는 추격 매수보다 과열권에 진입한 섹터의 이격도를 점검하며 차분히 포트폴리오 비중을 조절하는 것이 바람직합니다.`;
      threadsOpening = `코스피와 코스닥이 함께 시원하게 오르며 시장 전체에 강한 유동성 랠리가 펼쳐졌어요.`;
      threadsMarketSummary = `일반 ETF 시장도 ${up}개 종목이 상승하며 전 섹터로 온기가 고르게 퍼졌습니다.`;
      threadsWatchPoint = `전방위 상승장일수록 단기 과열에 휩쓸리지 않고 포트폴리오의 균형을 점검하는 여유가 필요합니다. 오늘 주목하시는 테마는 무엇인가요?`;
      break;

    case "GROWTH_BETA_RALLY":
      slide1Subheadline = `'${topThemeName}' 주도 속 중소형 성장주 랠리`;
      slide1Tip = `코스닥 ${kosdaqSign}${kosdaq.toFixed(2)}% 아웃퍼폼 · 코스피 대비 +${Math.abs(capSpread).toFixed(2)}%p 성장 테마 우위`;
      slide6Block1Title = `코스닥 ${kosdaqSign}${kosdaq.toFixed(2)}% 급등 속 성장 테마 주도`;
      slide6Block1Desc = `코스닥이 코스피 대비 +${Math.abs(capSpread).toFixed(2)}%p 아웃퍼폼하며 고베타 성장 테마 중심 강한 탄력.`;
      captionOpening = `국내 증시는 코스닥이 ${kosdaqSign}${kosdaq.toFixed(2)}% 급등하며 코스피(${kospiSign}${kospi.toFixed(2)}%) 대비 +${Math.abs(capSpread).toFixed(2)}%p 앞서는 성장 테마 주도 장세를 기록했습니다.`;
      captionMarketSummary = `대형주가 숨을 고르는 동안 중소형 기술주와 모멘텀 테마군으로 스마트머니가 집중되며 시장의 온기를 이끌었습니다.`;
      captionThemeAnalysis = `${topThemeName} ${topThemeRet > 0 ? "+" : ""}${topThemeRet.toFixed(2)}% 등 고베타 성장 섹터가 시장을 견인하며 활발한 테마 랠리가 펼쳐졌습니다.`;
      captionWatchPoint = `중소형 성장주 주도 국면에서는 테마별 변동성이 빠르게 확대될 수 있으므로 거래대금의 지속성을 점검하는 것이 유리합니다.`;
      threadsOpening = `코스닥이 ${kosdaqSign}${kosdaq.toFixed(2)}% 오르며 대형주보다 훨씬 강한 성장 테마 장세를 연출했어요.`;
      threadsMarketSummary = `코스피 대비 +${Math.abs(capSpread).toFixed(2)}%p 아웃퍼폼하며 기술주와 핵심 테마 ETF로 자금이 힘차게 유입되었습니다.`;
      threadsWatchPoint = `성장 테마가 탄력을 받을 때는 개별 섹터의 체력과 스마트머니의 지속성을 잘 분별해보세요. 오늘 가장 기대되는 섹터는 어디인가요?`;
      break;

    case "KOSPI_FALL_KOSDAQ_UP":
      slide1Subheadline = `'${topThemeName}' 선방 속 코스닥 개별 장세`;
      slide1Tip = `대형주 조정 속 코스닥 ${kosdaqSign}${kosdaq.toFixed(2)}% 반등 · 개별 테마 중심 순환매 분할 유입`;
      slide6Block1Title = `대형주 조정 속 코스닥 개별 테마 선방`;
      slide6Block1Desc = `코스피 ${kospiSign}${kospi.toFixed(2)}% 하락에도 코스닥 ${kosdaqSign}${kosdaq.toFixed(2)}% 선방하며 테마별 뚜렷한 각개전투 전개.`;
      captionOpening = `국내 증시는 대형주 중심의 코스피가 ${kospiSign}${kospi.toFixed(2)}% 밀렸으나, 코스닥은 ${kosdaqSign}${kosdaq.toFixed(2)}% 상승하며 뚜렷한 지수 엇갈림과 개별 장세가 연출되었습니다.`;
      captionMarketSummary = `대형주 매물 출회에 따른 지수 하락 압력을 중소형 성장 테마군이 흡수하며 선별적 종목 장세가 전개되었습니다.`;
      captionThemeAnalysis = `${topThemeName} ${topThemeRet > 0 ? "+" : ""}${topThemeRet.toFixed(2)}% 테마가 지수 부진을 딛고 선방한 반면, 대형주 비중이 높은 섹터는 조정을 받았습니다.`;
      captionWatchPoint = `지수 간 엇갈림이 나타날 때는 벤치마크 지수보다 개별 섹터의 수급과 이익 모멘텀을 선별하는 전략이 요구됩니다.`;
      threadsOpening = `코스피는 ${kospiSign}${kospi.toFixed(2)}% 밀렸지만, 코스닥은 ${kosdaqSign}${kosdaq.toFixed(2)}% 오르며 시장 분위기가 엇갈렸어요.`;
      threadsMarketSummary = `대형주가 숨을 고르는 사이 중소형 테마와 선별 ETF로 자금이 유입되며 알찬 개별 장세가 펼쳐졌습니다.`;
      threadsWatchPoint = `지수가 엇갈릴 때는 지수 자체보다 섹터 간 자금 이동의 길목을 지키는 것이 유효합니다. 오늘 여러분의 관심 지표는 무엇인가요?`;
      break;

    case "EXTREME_SURGE":
      slide1Subheadline = `'${topThemeName}' 폭등 속 ${flow.characterName} 숏스퀴즈 및 매수 폭발`;
      slide1Tip = `KOSPI ${kospiSign}${kospi.toFixed(2)}% vs 일반 ETF ${etfSign}${etfRet.toFixed(2)}% · 역사적 서지 속 과열 지표 점검 및 분할 차익실현 관점`;
      slide6Block1Title = `코스피 ${kospiSign}${kospi.toFixed(2)}% 초급등 속 일반 ETF ${etfSign}${etfRet.toFixed(2)}% 전방위 폭등`;
      slide6Block1Desc = `상승 종목 ${up}개이 압도적인 서지 랠리를 기록하며 시장 전반에 폭발적인 자금 유입 전개. 단기 이격 과열에 따른 차익실현 물량 점검 필요.`;
      captionOpening = `국내 증시는 코스피가 무려 ${kospiSign}${kospi.toFixed(2)}% 폭등하며 이례적인 초급등 서지 국면을 연출했습니다. 일반 ETF 시장에서도 상승 ${up}개로 폭발적인 매수세가 시장을 장악했습니다.`;
      captionMarketSummary = `기관과 외인의 강력한 숏스퀴즈와 패시브 매수세가 맞물리며 지수 대형주와 주도 테마 전반으로 폭발적인 수급 쏠림이 나타났습니다.`;
      captionThemeAnalysis = `${topThemeName} ${topThemeRet > 0 ? "+" : ""}${topThemeRet.toFixed(2)}% 섹터가 폭등세를 견인하며 지수 상승을 주도한 반면, ${bottomThemeName} ${bottomThemeRet > 0 ? "+" : ""}${bottomThemeRet.toFixed(2)}% 테마조차 하방 경직성을 유지했습니다.`;
      captionWatchPoint = `초급등 국면에서는 추격 매수의 실익보다 단기 이격 과열에 따른 변동성에 유의하며, 보유 비중의 일부를 분할 익절하거나 리밸런싱하는 전략이 유효합니다.`;
      threadsOpening = `코스피가 ${kospiSign}${kospi.toFixed(2)}% 폭등하며 시장이 엄청난 상승 서지를 기록했어요.`;
      threadsMarketSummary = `일반 ETF 시장도 상승 종목이 ${up}개에 달하며 전례 없는 강한 매수 폭발이 일어났습니다. 스마트머니도 주도주로 공격적으로 유입되었어요.`;
      threadsWatchPoint = `역대급 폭등장일수록 흥분을 가라앉히고 기술적 과열 지표와 분할 차익실현 타이밍을 침착하게 점검하는 것이 중요합니다. 오늘 여러분의 대응 전략은 무엇인가요?`;
      break;

    case "SUPER_BULL":
      slide1Subheadline = `'${topThemeName}' 랠리 주도 속 ${flow.characterName} 공격적 유입`;
      slide1Tip = `KOSPI ${kospiSign}${kospi.toFixed(2)}% vs 일반 ETF ${etfSign}${etfRet.toFixed(2)}% · 대형 성장주 및 고베타 자산 중심으로 광범위한 상승 폭발`;
      slide6Block1Title = `코스피 ${kospiSign}${kospi.toFixed(2)}% 슈퍼 랠리 속 일반 ETF ${etfSign}${etfRet.toFixed(2)}% 동반 급등`;
      slide6Block1Desc = `상승 종목 ${up}개이 압도적인 우위를 점하며 지수 레버리지와 고베타 테마 전반으로 상방 모멘텀 급격히 가속화.`;
      captionOpening = `국내 증시는 코스피가 ${kospiSign}${kospi.toFixed(2)}% 급등하며 시장 전반에 강력한 슈퍼 랠리가 펼쳐졌습니다. 일반 ETF 시장 역시 ${up}개 종목이 상승하며 뜨거운 열기를 뿜어냈습니다.`;
      captionMarketSummary = `대형 성장주와 대표지수 ETF로 대규모 외인·기관 동반 순매수가 집중되며 지수의 상방 탄력이 급격히 확대되었습니다.`;
      captionThemeAnalysis = `${topThemeName} ${topThemeRet > 0 ? "+" : ""}${topThemeRet.toFixed(2)}% 테마가 시장 전반의 상승 랠리를 주도했고, ${bottomThemeName} ${bottomThemeRet > 0 ? "+" : ""}${bottomThemeRet.toFixed(2)}% 섹터는 소폭 숨을 고르는 데 그쳤습니다.`;
      captionWatchPoint = `슈퍼 랠리에서는 상방 모멘텀의 지속성을 살피되, 고베타 종목의 변동성 확대에 대비한 분산 포트폴리오 유지가 현명합니다.`;
      threadsOpening = `코스피가 ${kospiSign}${kospi.toFixed(2)}% 시원하게 뻗어나가며 강력한 슈퍼 랠리를 완성했어요.`;
      threadsMarketSummary = `일반 ETF 1,025개 중 ${up}개가 오르며 시장 전반에 강한 훈풍이 불었습니다. 대표지수와 핵심 성장 테마로 자금이 집중되었어요.`;
      threadsWatchPoint = `상방 모멘텀이 거세게 분출될 때는 단기 수익률에 매몰되기보다 포트폴리오의 균형을 점검하는 여유가 필요합니다. 오늘 시장에서 가장 기대되는 섹터는 어디인가요?`;
      break;

    case "STRONG_BULL_HIGH":
      slide1Subheadline = `'${topThemeName}' 테마 견인 속 ${flow.characterName} 전방위 매수세`;
      slide1Tip = `KOSPI ${kospiSign}${kospi.toFixed(2)}% vs 일반 ETF ${etfSign}${etfRet.toFixed(2)}% · 외인·기관 양매수 주도로 대형주 및 중소형 테마 전반 온기 확산`;
      slide6Block1Title = `코스피 ${kospiSign}${kospi.toFixed(2)}% 강한 랠리 속 일반 ETF ${etfSign}${etfRet.toFixed(2)}% 동반 상승`;
      slide6Block1Desc = `상승 종목 ${up}개이 75% 이상을 차지하며 주도 성장주부터 낙폭과대 섹터까지 폭넓은 매수세 유입.`;
      captionOpening = `국내 증시는 코스피가 ${kospiSign}${kospi.toFixed(2)}% 큰 폭으로 오르며 시장 전반으로 온기가 빠르게 확산되었습니다. 일반 ETF 시장에서도 상승 ${up}개로 확고한 매수 우위가 나타났습니다.`;
      captionMarketSummary = `외인과 기관의 강력한 동반 순매수가 유입되며 대형주뿐만 아니라 중소형 성장 테마군까지 폭넓은 수급 유입이 전개되었습니다.`;
      captionThemeAnalysis = `${topThemeName} ${topThemeRet > 0 ? "+" : ""}${topThemeRet.toFixed(2)}% 섹터가 견조한 매수세를 흡수하며 강세를 보였고, ${bottomThemeName} ${bottomThemeRet > 0 ? "+" : ""}${bottomThemeRet.toFixed(2)}% 테마는 상대적으로 제한된 움직임을 나타냈습니다.`;
      captionWatchPoint = `광범위한 상승장에서는 주도 테마의 거래대금 회전율과 실질 자금 유입의 연속성을 체크하는 것이 유리합니다.`;
      threadsOpening = `코스피가 ${kospiSign}${kospi.toFixed(2)}% 상승하며 시장 곳곳으로 따뜻한 온기가 확산되었어요.`;
      threadsMarketSummary = `일반 ETF 시장도 ${up}개 종목이 상승하며 전방위 매수세가 지수를 든든하게 받쳤습니다. 스마트머니의 유입도 매우 활발했어요.`;
      threadsWatchPoint = `온기가 시장 전체로 퍼질 때 주도 섹터와 후발 섹터의 순환매 흐름을 유심히 관찰해보세요. 오늘 여러분이 주목하는 테마는 무엇인가요?`;
      break;

    case "STRONG_BULL":
      slide1Subheadline = `'${topThemeName}' 테마 주도 속 ${flow.characterName} 유입 확산`;
      slide1Tip = `KOSPI ${kospiSign}${kospi.toFixed(2)}% vs 일반 ETF ${etfSign}${etfRet.toFixed(2)}% · 핵심 성장 섹터 중심의 견조한 오름세 및 상방 모멘텀 탄력`;
      slide6Block1Title = `코스피 ${kospiSign}${kospi.toFixed(2)}% 급등 속 일반 ETF ${etfSign}${etfRet.toFixed(2)}% 동반 랠리`;
      slide6Block1Desc = `외인·기관의 적극적인 순매수 유입으로 상승 종목 ${up}개이 시장 전반의 상승 열기를 견인.`;
      captionOpening = `국내 증시는 코스피가 ${kospiSign}${kospi.toFixed(2)}% 급등하며 강력한 반등 랠리를 펼쳤습니다. 일반 ETF 시장 역시 상승 ${up}개로 시장 전반에 광범위한 온기가 돌았습니다.`;
      captionMarketSummary = `외인과 기관의 동반 순매수가 유입되며 핵심 성장 테마 및 대표지수 전반으로 강한 수급 모멘텀이 이어졌습니다.`;
      captionThemeAnalysis = `${topThemeName} ${topThemeRet > 0 ? "+" : ""}${topThemeRet.toFixed(2)}% 테마가 강한 거래대금을 동반하며 상승을 이끌었고, ${bottomThemeName} ${bottomThemeRet > 0 ? "+" : ""}${bottomThemeRet.toFixed(2)}% 등 일부 소외 섹터만 제한적인 조정을 받았습니다.`;
      captionWatchPoint = `상승 랠리 국면에서는 무리한 추격 매수보다 주도 테마의 거래대금 유지 여부와 스마트머니의 실질 순유입 연속성을 분별하는 것이 바람직합니다.`;
      threadsOpening = `코스피가 ${kospiSign}${kospi.toFixed(2)}% 시원하게 오르며 강한 반등에 성공했어요.`;
      threadsMarketSummary = `일반 ETF 1,025개 중 ${up}개가 오르며 시장 전반에 훈풍이 불었고, 스마트머니도 지수형 및 주도 테마로 힘차게 유입되었습니다.`;
      threadsWatchPoint = `강한 반등장일수록 테마의 거래대금과 실질 자금 순유입 지속성을 차분히 분별하는 태도가 중요합니다. 오늘 개장 후 여러분이 주목하는 주도주는 어디인가요?`;
      break;

    case "MODERATE_BULL":
      slide1Subheadline = `'${topThemeName}' 테마 상승 주도 속 ${flow.characterName} 안정적 유입`;
      slide1Tip = `KOSPI ${kospiSign}${kospi.toFixed(2)}% vs 일반 ETF ${etfSign}${etfRet.toFixed(2)}% · 주도 섹터 견인 및 양호한 시장 폭으로 지수 상승 탄력 유지`;
      slide6Block1Title = `코스피 ${kospiSign}${kospi.toFixed(2)}% 견조한 상승 속 일반 ETF ${etfSign}${etfRet.toFixed(2)}% 매수 우위`;
      slide6Block1Desc = `상승 종목 ${up}개이 우위를 유지하며 주도 테마를 중심으로 지수 상방 탄력이 안정적으로 이어지는 흐름 전개.`;
      captionOpening = `국내 증시는 코스피가 ${kospiSign}${kospi.toFixed(2)}% 오르며 견조한 상승세를 이어갔습니다. 일반 ETF 시장에서도 상승 ${up}개로 안정적인 매수 우위 장세가 펼쳐졌습니다.`;
      captionMarketSummary = `주도 테마와 대표지수 ETF로 꾸준한 자금 유입이 지속되며 시장 전반의 상승 탄력이 탄탄하게 유지되었습니다.`;
      captionThemeAnalysis = `${topThemeName} ${topThemeRet > 0 ? "+" : ""}${topThemeRet.toFixed(2)}% 섹터가 안정적인 오름세로 시장을 이끌었고, ${bottomThemeName} ${bottomThemeRet > 0 ? "+" : ""}${bottomThemeRet.toFixed(2)}% 테마는 보합권에서 매물을 소화했습니다.`;
      captionWatchPoint = `견조한 상승 국면에서는 시장의 지수 상승폭과 더불어 자금이 집중되는 주도 테마의 이익 모멘텀을 확인하는 것이 좋습니다.`;
      threadsOpening = `코스피는 ${kospiSign}${kospi.toFixed(2)}% 견조하게 오르며 안정적인 매수세를 유지했어요.`;
      threadsMarketSummary = `일반 ETF 시장도 ${up}개 종목이 상승하며 주도 테마를 중심으로 탄탄한 상방 탄력을 보여주었습니다.`;
      threadsWatchPoint = `안정적인 상승 흐름 속에서 스마트머니가 어떤 섹터를 다음 타깃으로 삼고 있는지 관찰해보세요. 오늘 여러분의 포트폴리오 핵심은 어디인가요?`;
      break;

    case "MILD_BULL":
      slide1Subheadline = `'${topThemeName}' 테마 중심 반등 속 ${flow.characterName} 수급 안정`;
      slide1Tip = `KOSPI ${kospiSign}${kospi.toFixed(2)}% vs 일반 ETF ${etfSign}${etfRet.toFixed(2)}% · 주도 섹터 중심의 선별적 반등과 하방 경직성 확보`;
      slide6Block1Title = `코스피 ${kospiSign}${kospi.toFixed(2)}% 반등 속 일반 ETF ${etfSign}${etfRet.toFixed(2)}% 완만한 상승`;
      slide6Block1Desc = `상승 종목 ${up}개이 우위를 보이며 주도 테마를 중심으로 지수 하방 경직성을 다지는 안정적 흐름 전개.`;
      captionOpening = `코스피는 ${kospiSign}${kospi.toFixed(2)}% 상승하며 긍정적인 흐름을 나타냈습니다. 일반 ETF 시장에서도 상승 ${up}개로 매수 우위의 온기가 감돌았습니다.`;
      captionMarketSummary = `주도 섹터를 중심으로 선별적 매수세가 이어지며 시장 전반의 변동성을 낮추고 안정적인 반등 흐름을 이어갔습니다.`;
      captionThemeAnalysis = `${topThemeName} ${topThemeRet > 0 ? "+" : ""}${topThemeRet.toFixed(2)}% 섹터가 견조한 오름세를 보인 가운데, ${bottomThemeName} ${bottomThemeRet > 0 ? "+" : ""}${bottomThemeRet.toFixed(2)}% 테마는 보합권에서 매물을 소화했습니다.`;
      captionWatchPoint = `점진적 반등 국면에서는 지수 추종과 함께 주도 테마의 이익 모멘텀 및 수급 강도를 함께 점검하는 것이 유리합니다.`;
      threadsOpening = `코스피는 ${kospiSign}${kospi.toFixed(2)}% 상승하며 차분한 반등세를 이어갔어요.`;
      threadsMarketSummary = `일반 ETF 시장도 상승 ${up}개로 매수세가 우위를 점하며 주도 섹터를 중심으로 하방 경직성을 단단히 다지는 하루였습니다.`;
      threadsWatchPoint = `완만한 반등 장세에서는 시장 전체의 지수 등락과 함께 실질 자금이 집중되는 주도 테마의 연속성을 확인하는 것이 좋습니다. 오늘 여러분의 시선은 어디로 향하고 계신가요?`;
      break;

    case "TIGHT_BULL_SIDEWAYS":
      slide1Subheadline = `'${topThemeName}' 테마 선별 상승 속 ${flow.characterName} 분할 유입`;
      slide1Tip = `KOSPI ${kospiSign}${kospi.toFixed(2)}% vs 일반 ETF ${etfSign}${etfRet.toFixed(2)}% · 방향성 탐색 속 미세 매수 우위 및 개별 테마 압축 매매`;
      slide6Block1Title = `코스피 ${kospiSign}${kospi.toFixed(2)}% 강보합 속 일반 ETF ${etfSign}${etfRet.toFixed(2)}% 방향성 탐색`;
      slide6Block1Desc = `상승 ${up}개 · 보합 ${flat}개 · 하락 ${down}개로 맞서며 뚜렷한 지수 모멘텀 없이 주도 테마 중심의 압축 매매 전개.`;
      captionOpening = `국내 증시는 코스피가 ${kospiSign}${kospi.toFixed(2)}% 소폭 오르며 강보합권에서 방향성을 탐색했습니다. 일반 ETF 시장은 상승 ${up}개, 하락 ${down}개로 팽팽한 힘겨루기가 이어졌습니다.`;
      captionMarketSummary = `지수 자체의 등락은 제한적이었으나, 뚜렷한 모멘텀을 가진 개별 테마로 스마트머니의 선별적 분할 매수가 유입되었습니다.`;
      captionThemeAnalysis = `${topThemeName} ${topThemeRet > 0 ? "+" : ""}${topThemeRet.toFixed(2)}% 테마가 선별적인 매수세를 이끌어낸 반면, ${bottomThemeName} ${bottomThemeRet > 0 ? "+" : ""}${bottomThemeRet.toFixed(2)}% 섹터는 매물 소화 과정을 거쳤습니다.`;
      captionWatchPoint = `강보합 국면에서는 섣부른 방향성 추종보다 거래대금이 유지되는 핵심 테마와 실질 순유입 종목의 수급을 확인하는 전략이 적합합니다.`;
      threadsOpening = `코스피는 ${kospiSign}${kospi.toFixed(2)}% 소폭 오르며 강보합권에서 방향성을 모색했어요.`;
      threadsMarketSummary = `상승 ${up}개와 하락 ${down}개가 맞서며 지수 등락보다는 개별 테마별로 실속을 챙기는 장세였습니다.`;
      threadsWatchPoint = `지수가 좁은 박스권에 머물 때는 개별 섹터의 체력과 스마트머니의 분할 매수 궤적을 확인해보세요. 오늘 주목하시는 테마는 무엇인가요?`;
      break;

    case "TIGHT_BEAR_SIDEWAYS":
      slide1Subheadline = `'${topThemeName}' 테마 방어 속 ${flow.characterName} 유입`;
      slide1Tip = `KOSPI ${kospiSign}${kospi.toFixed(2)}% vs 일반 ETF ${etfSign}${etfRet.toFixed(2)}% · 제한적 숨고르기 속 개별 종목 장세 및 차익 매물 소화`;
      slide6Block1Title = `코스피 ${kospiSign}${kospi.toFixed(2)}% 약보합 속 일반 ETF ${etfSign}${etfRet.toFixed(2)}% 숨고르기`;
      slide6Block1Desc = `하락 종목 ${down}개이 미세하게 우세했으나 전반적으로 횡보권에서 개별 테마 중심의 차별화 장세 형성.`;
      captionOpening = `국내 증시는 코스피가 ${kospiSign}${kospi.toFixed(2)}% 약보합권에 머물며 차분한 숨고르기 양상을 보였습니다. 일반 ETF 시장에서도 하락 ${down}개로 소폭 매물이 우세했습니다.`;
      captionMarketSummary = `지수의 하방 압력은 제한적인 가운데, 단기 급등 테마의 차익 매물 출회와 방어 섹터로의 순환매가 엇갈렸습니다.`;
      captionThemeAnalysis = `${topThemeName} ${topThemeRet > 0 ? "+" : ""}${topThemeRet.toFixed(2)}% 테마가 지수 약세에도 플러스를 지켰으며, ${bottomThemeName} ${bottomThemeRet > 0 ? "+" : ""}${bottomThemeRet.toFixed(2)}% 섹터는 소폭 조정을 받았습니다.`;
      captionWatchPoint = `약보합 횡보장에서는 무리한 매매를 줄이고, 자산배분 차원에서 포트폴리오의 변동성 노출을 점검하는 것이 유리합니다.`;
      threadsOpening = `코스피는 ${kospiSign}${kospi.toFixed(2)}% 약보합권에서 차분하게 숨을 골랐어요.`;
      threadsMarketSummary = `일반 ETF 시장도 하락 ${down}개로 미세한 조정이었지만, 방어 테마와 선별 종목으로 스마트머니가 유입되며 균형을 맞췄습니다.`;
      threadsWatchPoint = `숨고르기 장세에서는 지수 변동보다 섹터 간 자금 이동의 길목을 관찰하는 것이 현명합니다. 오늘 여러분의 관심 지표는 무엇인가요?`;
      break;

    case "MILD_BEAR":
      slide1Subheadline = `'${topThemeName}' 테마 반등 속 ${flow.characterName} 유입`;
      slide1Tip = `KOSPI ${kospiSign}${kospi.toFixed(2)}% vs 일반 ETF ${etfSign}${etfRet.toFixed(2)}% · 단기 매물 출회 속 주도 섹터와 소외 섹터 간 뚜렷한 온도차`;
      slide6Block1Title = `코스피 ${kospiSign}${kospi.toFixed(2)}% 조정 속 일반 ETF ${etfSign}${etfRet.toFixed(2)}% 차별화 장세`;
      slide6Block1Desc = `단기 매물 출회로 하락 종목 ${down}개 우세 흐름 속에서도 주도 테마군으로 선별적 수급 유입 전개.`;
      captionOpening = `코스피는 ${kospiSign}${kospi.toFixed(2)}% 조정을 받으며 숨고르기에 들어갔습니다. 일반 ETF 시장에서도 하락 종목이 ${down}개로 집계되며 매물 소화 과정이 이어졌습니다.`;
      captionMarketSummary = `지수 전반의 조정 국면 속에서도 주도 테마와 소외 테마 간 수익률 격차가 뚜렷하게 벌어지는 섹터 로테이션이 전개되었습니다.`;
      captionThemeAnalysis = `${topThemeName} ${topThemeRet > 0 ? "+" : ""}${topThemeRet.toFixed(2)}% 테마가 플러스 수익률로 중심을 잡은 반면, ${bottomThemeName} ${bottomThemeRet > 0 ? "+" : ""}${bottomThemeRet.toFixed(2)}% 섹터는 차익 매물이 집중되었습니다.`;
      captionWatchPoint = `숨고르기 장세에서는 지수 추종보다 섹터 간 자금 이동 경로와 실질 순유입 상위 종목의 지속성을 확인하는 전략이 적합합니다.`;
      threadsOpening = `코스피는 ${kospiSign}${kospi.toFixed(2)}% 조정을 받으며 숨고르기에 들어갔어요.`;
      threadsMarketSummary = `일반 ETF 시장도 하락 ${down}개로 조정 흐름이었지만, 주도 테마군으로는 스마트머니의 분할 매수세가 꾸준히 유입되는 차별화 장세였습니다.`;
      threadsWatchPoint = `지수가 숨을 고를 때는 지수 등락보다 테마 간 자금 이동과 순환매 길목을 지키는 관찰이 필요합니다. 오늘 개장 후 여러분은 어떤 지표를 눈여겨보시나요?`;
      break;

    case "MODERATE_BEAR":
      slide1Subheadline = `'${topThemeName}' 테마 방어 속 ${flow.characterName} 피신 수급`;
      slide1Tip = `KOSPI ${kospiSign}${kospi.toFixed(2)}% vs 일반 ETF ${etfSign}${etfRet.toFixed(2)}% · 경기민감 섹터 매물 출회 및 방어 자산으로 자금 이동`;
      slide6Block1Title = `코스피 ${kospiSign}${kospi.toFixed(2)}% 하락 속 일반 ETF ${etfSign}${etfRet.toFixed(2)}% 방어벽 가동`;
      slide6Block1Desc = `경기민감 대형주 중심으로 하락 종목 ${down}개이 확대되었으나, 배당·채권형 ETF가 지수 대비 하방 충격을 완충.`;
      captionOpening = `국내 증시는 코스피가 ${kospiSign}${kospi.toFixed(2)}% 하락하며 본격적인 조정 국면에 진입했습니다. 일반 ETF 시장에서도 ${down}개 종목에 매물이 출회되었습니다.`;
      captionMarketSummary = `경기민감 대형주를 중심으로 매도 압력이 가중되었으나, 고배당 및 채권형 등 방어적 자산군으로 피신성 자금이 유입되며 지수 낙폭을 완충했습니다.`;
      captionThemeAnalysis = `${topThemeName} ${topThemeRet > 0 ? "+" : ""}${topThemeRet.toFixed(2)}% 등 방어 테마가 선방한 반면, ${bottomThemeName} ${bottomThemeRet > 0 ? "+" : ""}${bottomThemeRet.toFixed(2)}% 섹터는 매도세가 확대되었습니다.`;
      captionWatchPoint = `본격 조정 국면에서는 단기 저가 매수보다 경기 방어 자산의 비중과 주요 수급 주체의 이탈 여부를 면밀히 관찰하는 것이 안전합니다.`;
      threadsOpening = `코스피가 ${kospiSign}${kospi.toFixed(2)}% 하락하며 시장 전반에 조정의 골이 깊어졌어요.`;
      threadsMarketSummary = `일반 ETF 시장도 하락 종목이 ${down}개로 늘었지만, 인컴형 및 채권형 ETF가 지수 대비 하락폭을 든든하게 지켜주었습니다.`;
      threadsWatchPoint = `조정이 이어질 때는 계좌의 방어력이 얼마나 유지되는지 점검하는 것이 중요합니다. 오늘 여러분의 리스크 관리 기준은 무엇인가요?`;
      break;

    case "DEEP_BEAR":
      slide1Subheadline = `'${topThemeName}' 테마 방어 속 ${flow.characterName} 유입`;
      slide1Tip = `KOSPI ${kospiSign}${kospi.toFixed(2)}% vs 일반 ETF ${etfSign}${etfRet.toFixed(2)}% · 전방위 하락 속 안전자산 및 파킹형 ETF로 수급 이동`;
      slide6Block1Title = `코스피 ${kospiSign}${kospi.toFixed(2)}% 급락 속 일반 ETF ${etfSign}${etfRet.toFixed(2)}% 전방위 약세`;
      slide6Block1Desc = `거센 시장 매도세로 하락 종목 ${down}개이 쏟아졌으나, 금리형 및 방어적 자산군이 지수 충격을 완충.`;
      captionOpening = `국내 증시는 코스피가 ${kospiSign}${kospi.toFixed(2)}% 급락하며 거센 하락 압력을 받았습니다. 일반 ETF 시장 역시 ${down}개 종목이 하락하며 전방위 약세를 나타냈습니다.`;
      captionMarketSummary = `국내 대형주 전반에 걸쳐 매물이 출회되었으나, 초단기 파킹형 및 금리형 ETF로 자금이 집중되며 시스템 전반의 리스크 완충 역할을 수행했습니다.`;
      captionThemeAnalysis = `${topThemeName} ${topThemeRet > 0 ? "+" : ""}${topThemeRet.toFixed(2)}% 등 소수의 방어적 테마가 플러스 권역을 지켰으며, ${bottomThemeName} ${bottomThemeRet > 0 ? "+" : ""}${bottomThemeRet.toFixed(2)}% 등 경기민감 섹터는 낙폭을 확대했습니다.`;
      captionWatchPoint = `지수 급락 국면에서는 낙폭 과대 종목의 성급한 추가 매수보다, 실질 자금 순유입 지표와 환율 변동성 안착 여부를 먼저 점검하는 것이 유리합니다.`;
      threadsOpening = `코스피가 ${kospiSign}${kospi.toFixed(2)}% 급락하며 시장 전반에 큰 하락 압력이 가해졌어요.`;
      threadsMarketSummary = `일반 ETF 1,025개 중 ${down}개가 하락하며 약세가 짙었지만, ETF 전체 가중수익률은 ${etfSign}${etfRet.toFixed(2)}%로 지수보다 충격을 덜 받았습니다. 안전자산이 든든한 방파제가 되어주었어요.`;
      threadsWatchPoint = `지수가 크게 출렁일 때는 지수 자체보다 스마트머니가 이동하는 길목과 방어 자산의 버팀력을 관찰하는 것이 중요합니다. 오늘 여러분의 관심 섹터는 어디인가요?`;
      break;

    case "HEAVY_DROP":
      slide1Subheadline = `'${topThemeName}' 방어 분투 속 ${flow.characterName} 피신 집중`;
      slide1Tip = `KOSPI ${kospiSign}${kospi.toFixed(2)}% vs 일반 ETF ${etfSign}${etfRet.toFixed(2)}% · 시장 변동성 급격 확대 및 주요 지지선 시험 국면`;
      slide6Block1Title = `코스피 ${kospiSign}${kospi.toFixed(2)}% 거센 충격 속 일반 ETF ${etfSign}${etfRet.toFixed(2)}% 방어 총력`;
      slide6Block1Desc = `전방위적인 매도 공세로 하락 종목 ${down}개이 속출하는 가운데, 초단기 채권 및 인버스형 자산으로의 피신성 자금 이동 가속화.`;
      captionOpening = `국내 증시는 코스피가 ${kospiSign}${kospi.toFixed(2)}% 급락하며 시장 주요 지지선을 위협하는 거센 하락 충격을 겪었습니다. 일반 ETF 시장에서도 ${down}개 종목이 일제히 하락세를 면치 못했습니다.`;
      captionMarketSummary = `외인과 기관의 동반 매도가 쏟아지며 대부분의 섹터가 약세를 보였으며, 극히 일부의 초단기 파킹형 ETF만이 피신처 역할을 수행했습니다.`;
      captionThemeAnalysis = `${topThemeName} ${topThemeRet > 0 ? "+" : ""}${topThemeRet.toFixed(2)}% 등 극소수 테마만 버텨냈을 뿐, ${bottomThemeName} ${bottomThemeRet > 0 ? "+" : ""}${bottomThemeRet.toFixed(2)}% 섹터를 비롯한 대다수 종목이 큰 폭의 조정을 받았습니다.`;
      captionWatchPoint = `하락 충격이 거센 구간에서는 섣부른 물타기나 저가 매수를 지양하고, 변동성 지수와 외국인 수급의 매도세 진정 여부를 차분히 확인해야 합니다.`;
      threadsOpening = `코스피가 ${kospiSign}${kospi.toFixed(2)}% 크게 밀리며 시장 전반에 거센 하락 충격이 전해졌어요.`;
      threadsMarketSummary = `일반 ETF 시장도 ${down}개 종목이 하락하며 힘겨운 하루를 보냈습니다. 자금은 극단적인 안전자산과 초단기 금리형으로 급격히 이동했습니다.`;
      threadsWatchPoint = `거센 충격 속에서는 계좌를 지키는 보수적인 현금 관리가 최우선입니다. 오늘 개장 후 여러분이 가장 주시하는 지표는 무엇인가요?`;
      break;

    case "PANIC_CRASH":
    default:
      slide1Subheadline = `'${topThemeName}' 방어 한계 속 ${flow.characterName} 긴급 대피`;
      slide1Tip = `KOSPI ${kospiSign}${kospi.toFixed(2)}% vs 일반 ETF ${etfSign}${etfRet.toFixed(2)}% · 투매성 매물 집중 및 극단적 변동성 속 환율·유동성 점검`;
      slide6Block1Title = `코스피 ${kospiSign}${kospi.toFixed(2)}% 극단적 급락 속 일반 ETF ${etfSign}${etfRet.toFixed(2)}% 투매 충격`;
      slide6Block1Desc = `하락 종목 ${down}개이 시장의 85% 이상을 차지하며 전방위 패닉 투매 발생. 무리한 포지션 진입을 금지하고 리스크 방어선 점검 필수.`;
      captionOpening = `국내 증시는 코스피가 ${kospiSign}${kospi.toFixed(2)}% 폭락하며 시장 전반에 걸쳐 극단적인 변동성과 패닉성 투매가 출회되었습니다. 일반 ETF 시장 역시 ${down}개 종목이 하락하며 거센 충격을 받았습니다.`;
      captionMarketSummary = `시스템 리스크 우려로 전 섹터에 걸쳐 무차별적인 매물이 쏟아졌으며, 자금은 초단기 현금성 MMF 및 파킹형 ETF로 긴급 대피하는 모습을 나타냈습니다.`;
      captionThemeAnalysis = `${topThemeName} ${topThemeRet > 0 ? "+" : ""}${topThemeRet.toFixed(2)}% 등 일부 헷지형 자산을 제외한 전 섹터가 급락세를 보였으며, ${bottomThemeName} ${bottomThemeRet > 0 ? "+" : ""}${bottomThemeRet.toFixed(2)}% 테마는 극심한 낙폭을 기록했습니다.`;
      captionWatchPoint = `극단적 패닉 장세에서는 심리적 공포에 의한 투매 동참도, 성급한 바닥 낚시도 모두 위험합니다. 환율 급등세 진정과 매도 호가 공백 해소를 기다리는 보수적 관망이 필수적입니다.`;
      threadsOpening = `코스피가 ${kospiSign}${kospi.toFixed(2)}% 폭락하며 시장이 극단적인 패닉 투매를 겪었습니다.`;
      threadsMarketSummary = `일반 ETF 1,025개 중 ${down}개가 하락하며 전방위적인 매도 폭풍이 몰아쳤어요. 스마트머니조차 모든 위험자산을 피하고 파킹형으로 대피했습니다.`;
      threadsWatchPoint = `극단적인 변동성 장세에서는 자산을 지키는 리스크 관리가 최고의 수익률입니다. 무리한 행동을 멈추고 시장이 안정을 찾을 때까지 호흡을 가다듬으세요.`;
      break;
  }

  const countText = payload.generalEtfCount ? `${payload.generalEtfCount.toLocaleString()}개 ` : "";
  const firstComment = `한국거래소(KRX) 공시 데이터 마감 기준 · 국내 상장 일반 ETF ${countText}전수 분석`;

  return {
    code,
    statusName,
    badgeTag,
    flowCharacter: flow.character,
    flowCharacterName: flow.characterName,
    disparityStatus: disparity.status,
    kospiChangePct: kospi,
    kosdaqChangePct: kosdaq,
    etfWeightedReturnPct: etfRet,
    capSpread,
    etfDivergence,
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
