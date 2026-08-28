/**
 * Market Briefing Narrative Engine
 * 
 * 2차원 정밀 시황 매트릭스 (수익률 규모 [7단계] × 종목 분산도 [3단계]) 기반
 * 동적 헤드라인(대제목) 및 3줄 요약 결론 문구 생성 엔진
 */

export type ReturnTier =
  | 'SURGE'        // 🚀 급등 (+1.5% 이상)
  | 'SOLID_GAIN'   // 📈 견조한 상승 (+0.5% ~ +1.5%)
  | 'MILD_GAIN'    // 🌱 소폭/강보합 (+0.1% ~ +0.5%)
  | 'FLAT'         // ⚖️ 팽팽한 보합 (-0.1% ~ +0.1%)
  | 'MILD_LOSS'    // 🍂 약보합 (-0.5% ~ -0.1%)
  | 'SOLID_LOSS'   // 📉 전반적 약세 (-1.5% ~ -0.5%)
  | 'PLUNGE';      // ⛈️ 급락/투매 (-1.5% 이하)

export type BreadthRegime =
  | 'BROAD_BASED'  // 전방위적 확산 (상승 또는 하락 비율 65% 이상)
  | 'BALANCED'     // 고른 균형 / 혼조 (상승 비율 40% ~ 65%)
  | 'DIVERGENT';   // 차별화 / 다이버전스 / 쏠림 (수익률 방향과 종목 수 상반 또는 소수 쏠림)

export type MarketRegimeKey = `${ReturnTier}_${BreadthRegime}`;

export interface RegimeTemplate {
  /** 메인 대제목 (이모지 포함, 시황의 핵심 심리 대변) */
  dynamicTitle: string;
  /** 3줄 요약 1번째 줄 결론 맺음말 (예: '전방위적인 상승 랠리를 펼치며 시장을 뜨겁게 달궜습니다.') */
  summaryConclusion: string;
  /** STEP 2 체온계 보조 설명문 (Breadth & Large vs Small Cap Dynamics) */
  breadthSentence: string;
  /** 직관적 상태 배지 라벨 */
  badgeLabel: string;
}

export interface MarketNarrativeInput {
  generalEtfCount: number;
  upCount: number;
  flatCount?: number;
  downCount: number;
  generalAumWeightedReturnPct: number;
  breadthRatioPct?: number;
  top50AumWeightedReturnPct?: number;
  top10TradeSharePct?: number;
  themeSentence?: string;
  concentrationSentence?: string;
}

export interface MarketNarrativeResult {
  returnTier: ReturnTier;
  breadthRegime: BreadthRegime;
  regimeKey: MarketRegimeKey;
  dynamicTitle: string;
  summaryConclusion: string;
  headline: string;
  breadthSentence: string;
  badgeLabel: string;
  upRatioPct: number;
  downRatioPct: number;
  flatRatioPct: number;
  isPositive: boolean;
}

/**
 * 21개 정밀 시황 매트릭스 템플릿 마스터 테이블 (7 × 3)
 */
export const REGIME_MATRIX: Record<MarketRegimeKey, RegimeTemplate> = {
  // =========================================================================
  // 1. 🚀 급등 (+1.5% 이상)
  // =========================================================================
  SURGE_BROAD_BASED: {
    dynamicTitle: '시장 전반에 강력한 매수세가 폭발하며 압도적인 랠리를 펼친 하루였습니다 🚀',
    summaryConclusion: '전방위적인 상승 랠리를 펼치며 시장을 뜨겁게 달궜습니다.',
    breadthSentence: '대다수 ETF가 일제히 급등세를 타며 시장 전반의 투자 심리가 극도로 고조된 전형적인 불마켓(Bull Market) 양상이었습니다.',
    badgeLabel: '전방위 급등 랠리',
  },
  SURGE_BALANCED: {
    dynamicTitle: '주도 테마의 폭발적 상승세가 시장 전체의 강한 랠리를 견인한 하루였습니다 📈',
    summaryConclusion: '주도 섹터의 폭발적인 시세 분출에 힘입어 강력한 상승 탄력을 기록했습니다.',
    breadthSentence: '지수 대표주와 핵심 주도 테마군으로 매수세가 집중되며 전체 시장의 강한 상승세를 주도했습니다.',
    badgeLabel: '주도 테마 급등',
  },
  SURGE_DIVERGENT: {
    dynamicTitle: '소수 대형 주도주의 독주 속에 지수 착시가 나타난 강세장이었습니다 ⚡',
    summaryConclusion: '하락 종목이 더 많았음에도 초대형주의 독보적 급등에 힘입어 지수 착시형 급등을 기록했습니다.',
    breadthSentence: '시가총액 최상위 소수 종목으로만 수급이 극단적으로 쏠려, 지수 급등세 대비 일반 투자자의 체감 온도는 엇갈린 하루였습니다.',
    badgeLabel: '대형주 쏠림 급등',
  },

  // =========================================================================
  // 2. 📈 견조한 상승 (+0.5% ~ +1.5%)
  // =========================================================================
  SOLID_GAIN_BROAD_BASED: {
    dynamicTitle: '시장 전반에 훈훈한 온기가 퍼지며 고른 동반 상승세를 나타낸 하루였습니다 ☀️',
    summaryConclusion: '다수 종목으로 온기가 확산되며 견조한 동반 상승 흐름을 보였습니다.',
    breadthSentence: '특정 종목에 편중되지 않고 다양한 자산군과 섹터로 매수세가 고르게 유입되며 건강한 상승 구조를 형성했습니다.',
    badgeLabel: '고른 동반 상승',
  },
  SOLID_GAIN_BALANCED: {
    dynamicTitle: '선별적 매수세가 유입되며 주도 섹터 중심의 견조한 상승 마감한 하루였습니다 🌿',
    summaryConclusion: '테마별 차별화 흐름 속에서도 주도 종목군의 선방으로 견고한 상승세를 이어갔습니다.',
    breadthSentence: '상승과 하락 종목이 공존하는 가운데, 성장 테마와 대표 지수 ETF들이 시장의 무게중심을 든든히 지탱했습니다.',
    badgeLabel: '견조한 선별 상승',
  },
  SOLID_GAIN_DIVERGENT: {
    dynamicTitle: '지수는 견조하게 올랐으나 하락 종목이 우세해 체감 온도가 엇갈린 하루였습니다 ⛅',
    summaryConclusion: '하락 종목 비중이 높았으나 시총 상위 대형 ETF들의 방어력으로 견조한 지수 상승을 나타냈습니다.',
    breadthSentence: '시총 상위 대형주가 지수를 방어·견인했으나, 중소형 테마 ETF 다수가 조정을 받아 실제 시장 체감은 다소 차분했습니다.',
    badgeLabel: '대형주 착시 상승',
  },

  // =========================================================================
  // 3. 🌱 소폭/강보합 (+0.1% ~ +0.5%)
  // =========================================================================
  MILD_GAIN_BROAD_BASED: {
    dynamicTitle: '대다수 종목이 고르게 오르며 지수 대비 양호한 체감 장세를 보인 하루였습니다 🌱',
    summaryConclusion: '지수 상승폭은 완만했으나 다수 종목이 고르게 오르며 우호적인 투자 심리를 반영했습니다.',
    breadthSentence: '대형주의 상승폭은 제한적이었으나 광범위한 중소형 및 테마 ETF로 온기가 확산되며 실질 체감 지수는 탄탄했습니다.',
    badgeLabel: '저변 확산 강보합',
  },
  MILD_GAIN_BALANCED: {
    dynamicTitle: '상승과 하락이 팽팽히 맞서는 가운데 소폭 강보합으로 마감한 하루였습니다 ⚖️',
    summaryConclusion: '뚜렷한 쏠림 없이 매수와 매도가 균형을 이루며 완만한 강보합세를 기록했습니다.',
    breadthSentence: '주요 테마 간 순환매가 빠르게 전개되며 지수 전반이 안정적인 보합권 완만한 상승세를 유지했습니다.',
    badgeLabel: '균형 강보합',
  },
  MILD_GAIN_DIVERGENT: {
    dynamicTitle: '소수 종목의 국지적 상승으로 지수만 소폭 플러스권을 지켜낸 하루였습니다 🌦️',
    summaryConclusion: '다수 종목이 약세를 보였으나 소수 방어주 및 대형주 상승에 힘입어 턱걸이 강보합을 나타냈습니다.',
    breadthSentence: '시장 전반의 하락 압력 속에서도 일부 대형주가 지수 하단을 지지하며 지수와 종목 간 다이버전스가 관찰되었습니다.',
    badgeLabel: '차별화 강보합',
  },

  // =========================================================================
  // 4. ⚖️ 팽팽한 보합 (-0.1% ~ +0.1%)
  // =========================================================================
  FLAT_BROAD_BASED: {
    dynamicTitle: '지수는 멈춰 섰으나 시장 저변에는 활발한 중소형주 온기가 감돈 하루였습니다 🌤️',
    summaryConclusion: '지수는 제자리걸음을 했으나 상승 종목이 우세하여 내면의 투자 심리는 견조했습니다.',
    breadthSentence: '대형주의 숨고르기로 지수 변동은 미미했으나, 광범위한 개별 테마 ETF로 매수세가 확산되며 체감 지수는 양호했습니다.',
    badgeLabel: '온기 품은 보합',
  },
  FLAT_BALANCED: {
    dynamicTitle: '방향성 탐색 속 팽팽한 힘겨루기를 펼치며 보합세로 마감한 하루였습니다 ⚖️',
    summaryConclusion: '상승과 하락 종목 수가 팽팽하게 맞서며 뚜렷한 방향성 없이 횡보 마감했습니다.',
    breadthSentence: '매수세와 매도세가 팽팽한 균형을 이루며 주요 지표들이 차분한 숨고르기 국면을 이어갔습니다.',
    badgeLabel: '팽팽한 횡보',
  },
  FLAT_DIVERGENT: {
    dynamicTitle: '대형주의 지수 방어에도 불구하고 대다수 종목은 조정을 겪은 하루였습니다 🌥️',
    summaryConclusion: '소수 대형주의 방어로 지수는 보합을 지켰으나 하락 종목이 우세해 체감 심리는 차분했습니다.',
    breadthSentence: '지수는 보합권에 묶였으나 다수 테마 ETF가 약세를 보이며 시장 내부적으로는 선별적 차익 실현이 진행되었습니다.',
    badgeLabel: '체감 부진 보합',
  },

  // =========================================================================
  // 5. 🍂 약보합 (-0.5% ~ -0.1%)
  // =========================================================================
  MILD_LOSS_BROAD_BASED: {
    dynamicTitle: '시장 전반에 걸쳐 완만한 매도세가 출회되며 약보합으로 마감한 하루였습니다 🍂',
    summaryConclusion: '대다수 종목이 동반 하락하며 완만한 약보합세를 나타냈습니다.',
    breadthSentence: '급격한 투매는 없었으나 다수 ETF로 차익 실현 및 관망 매물이 고르게 출회되며 완만한 숨고르기를 보였습니다.',
    badgeLabel: '완만한 약보합',
  },
  MILD_LOSS_BALANCED: {
    dynamicTitle: '테마별 엇갈린 등락 속에 시장 전반이 소폭 약보합세를 나타낸 하루였습니다 🌫️',
    summaryConclusion: '종목별 공방 속에 일부 테마의 부진으로 소폭 약보합을 기록했습니다.',
    breadthSentence: '방어적 성격의 일부 섹터가 선방했으나 전체적인 매수세가 제한되며 소폭 밀려 마감했습니다.',
    badgeLabel: '혼조 약보합',
  },
  MILD_LOSS_DIVERGENT: {
    dynamicTitle: '대형주의 일시적 조정으로 지수는 내렸으나 종목별 온기는 살아있던 하루였습니다 ⛅',
    summaryConclusion: '시총 상위주의 약세로 지수는 소폭 하락했으나 상승 종목이 더 많아 양호한 체감 장세를 보였습니다.',
    breadthSentence: '지수 견인력이 큰 소수 대형주가 쉬어간 반면, 다양한 중소형 및 개별 테마 ETF에는 반발 매수세가 유입되었습니다.',
    badgeLabel: '체감 선방 약보합',
  },

  // =========================================================================
  // 6. 📉 전반적 약세 (-1.5% ~ -0.5%)
  // =========================================================================
  SOLID_LOSS_BROAD_BASED: {
    dynamicTitle: '대다수 섹터로 매도세가 확산되며 시장 전반이 뚜렷한 조정을 받은 하루였습니다 🌧️',
    summaryConclusion: '광범위한 매도 압력 속에 다수 종목이 동반 약세를 기록했습니다.',
    breadthSentence: '위험자산 회피 심리가 작용하며 대부분의 자산군과 섹터 ETF가 일제히 하락 압력을 받았습니다.',
    badgeLabel: '전방위 약세 조정',
  },
  SOLID_LOSS_BALANCED: {
    dynamicTitle: '주요 주도주의 차익 실현 출회로 시장 전반이 약세 흐름을 보인 하루였습니다 📉',
    summaryConclusion: '일부 방어 섹터의 분전에도 불구하고 주도주 조정으로 전반적인 약세를 면치 못했습니다.',
    breadthSentence: '배당·채권 등 방어형 ETF가 하단을 지지했으나, 주도 성장 테마의 낙폭이 커지며 시장 전체가 약세를 나타냈습니다.',
    badgeLabel: '주도주 조정 약세',
  },
  SOLID_LOSS_DIVERGENT: {
    dynamicTitle: '초대형주의 급락 충격으로 지수는 후퇴했으나 개별 테마는 분전한 하루였습니다 ☂️',
    summaryConclusion: '상승 종목 수가 더 많았음에도 초대형주의 가파른 하락 충격으로 지수 약세가 두드러졌습니다.',
    breadthSentence: '시총 상위 대형주의 부진이 지수를 끌어내렸으나, 시장 내부에서는 개별 테마주를 중심으로 활발한 틈새 매수세가 이어졌습니다.',
    badgeLabel: '대형주 쇼크 약세',
  },

  // =========================================================================
  // 7. ⛈️ 급락/투매 (-1.5% 이하)
  // =========================================================================
  PLUNGE_BROAD_BASED: {
    dynamicTitle: '거센 매도 폭풍 속에 시장 전반의 투자 심리가 급격히 얼어붙은 하루였습니다 ⛈️',
    summaryConclusion: '전방위적인 패닉셀이 출회되며 시장 전반이 가파른 급락세를 기록했습니다.',
    breadthSentence: '안전자산과 인버스 상품을 제외한 시장 전반의 ETF가 무차별적인 매도세에 직면하며 극심한 투심 위축을 겪었습니다.',
    badgeLabel: '전방위 패닉셀',
  },
  PLUNGE_BALANCED: {
    dynamicTitle: '고평가 주도 섹터의 급격한 매물 폭탄으로 시장 충격이 집중된 하루였습니다 ⚡',
    summaryConclusion: '일부 방어 테마가 버텼으나 주도 섹터의 투매로 전체 시장이 큰 폭의 하락을 기록했습니다.',
    breadthSentence: '시장 전반의 무차별 매도라기보다는 특정 핵심 테마와 대형 기술주 상품군에 급격한 차익 실현이 집중된 충격 장세였습니다.',
    badgeLabel: '주도 테마 급락',
  },
  PLUNGE_DIVERGENT: {
    dynamicTitle: '소수 초대형주의 기습적 충격 하락이 전체 지수 급락을 야기한 하루였습니다 🌪️',
    summaryConclusion: '다수 종목의 방어에도 불구하고 초대형주의 이례적 급락이 전체 가중수익률을 끌어내렸습니다.',
    breadthSentence: '중소형 종목들의 낙폭은 제한적이었으나 시가총액 최상위 초대형 ETF의 돌발 쇼크로 인해 가중평균 수익률이 급락한 착시 장세였습니다.',
    badgeLabel: '초대형주 급락 쇼크',
  },
};

/**
 * 가중평균 수익률을 7단계 ReturnTier로 정밀 분류
 */
export function classifyReturnTier(ret: number): ReturnTier {
  if (ret >= 1.5) return 'SURGE';
  if (ret >= 0.5) return 'SOLID_GAIN';
  if (ret >= 0.1) return 'MILD_GAIN';
  if (ret > -0.1) return 'FLAT';
  if (ret > -0.5) return 'MILD_LOSS';
  if (ret > -1.5) return 'SOLID_LOSS';
  return 'PLUNGE';
}

/**
 * 상승/하락 종목 비율 및 시장 내부 다이버전스를 3단계 BreadthRegime으로 정밀 분류
 */
export function classifyBreadthRegime(
  tier: ReturnTier,
  upCount: number,
  downCount: number,
  totalCount: number
): BreadthRegime {
  if (totalCount <= 0) return 'BALANCED';

  const upRatio = upCount / totalCount;
  const downRatio = downCount / totalCount;

  switch (tier) {
    case 'SURGE':
    case 'SOLID_GAIN':
    case 'MILD_GAIN':
      // 상승 장세
      if (upRatio >= 0.65) return 'BROAD_BASED';
      if (downRatio > upRatio || upRatio < 0.40) return 'DIVERGENT';
      return 'BALANCED';

    case 'PLUNGE':
    case 'SOLID_LOSS':
    case 'MILD_LOSS':
      // 하락 장세
      if (downRatio >= 0.65) return 'BROAD_BASED';
      if (upRatio > downRatio || downRatio < 0.40) return 'DIVERGENT';
      return 'BALANCED';

    case 'FLAT':
    default:
      // 보합 장세
      if (upRatio >= 0.60) return 'BROAD_BASED';      // 온기 확산 (상승 우세)
      if (downRatio >= 0.60) return 'DIVERGENT';     // 체감 부진 (하락 우세)
      return 'BALANCED';                             // 팽팽한 균형
  }
}

/**
 * 부호 포맷터 (+1.23%, -0.45%, 0.00%)
 */
function formatSignedPct(value: number): string {
  const formatted = Math.abs(value).toFixed(2);
  if (value > 0) return `+${formatted}%`;
  if (value < 0) return `-${formatted}%`;
  return '0.00%';
}

/**
 * 정밀 시황 매트릭스를 기반으로 동적 헤드라인 및 3줄 요약 문장을 생성하는 메인 엔진 함수
 */
export function generateMarketNarrative(input: MarketNarrativeInput): MarketNarrativeResult {
  const generalCount = Math.max(input.generalEtfCount, 0);
  const up = Math.max(input.upCount, 0);
  const flat = Math.max(input.flatCount ?? 0, 0);
  const down = Math.max(input.downCount, 0);
  const total = generalCount || (up + flat + down) || 1;

  const ret = input.generalAumWeightedReturnPct ?? 0;
  const isPositive = ret >= 0;

  const returnTier = classifyReturnTier(ret);
  const breadthRegime = classifyBreadthRegime(returnTier, up, down, total);
  const regimeKey: MarketRegimeKey = `${returnTier}_${breadthRegime}`;

  const template = REGIME_MATRIX[regimeKey] || REGIME_MATRIX.FLAT_BALANCED;

  const upRatioPct = Number(((up / total) * 100).toFixed(1));
  const downRatioPct = Number(((down / total) * 100).toFixed(1));
  const flatRatioPct = Number(((flat / total) * 100).toFixed(1));

  const signedRetStr = formatSignedPct(ret);
  const countStr = generalCount.toLocaleString('ko-KR');
  const upStr = up.toLocaleString('ko-KR');
  const flatStr = flat.toLocaleString('ko-KR');
  const downStr = down.toLocaleString('ko-KR');

  const directionVerb = ret > 0 ? '상승하며' : ret < 0 ? '하락하며' : '보합을 기록하며';
  const themePart = input.themeSentence ? ` ${input.themeSentence}` : '';
  const concPart = input.concentrationSentence ? ` ${input.concentrationSentence}` : '';

  // 3줄 요약 1번째 줄 완성 문장
  const firstSentence = `일반 ETF ${countStr}개 중 상승 ${upStr}개, 보합 ${flatStr}개, 하락 ${downStr}개로 평균 ${signedRetStr} ${directionVerb} ${template.summaryConclusion}`;
  const headline = `${firstSentence}${themePart}${concPart}`.trim();

  return {
    returnTier,
    breadthRegime,
    regimeKey,
    dynamicTitle: template.dynamicTitle,
    summaryConclusion: template.summaryConclusion,
    headline,
    breadthSentence: template.breadthSentence,
    badgeLabel: template.badgeLabel,
    upRatioPct,
    downRatioPct,
    flatRatioPct,
    isPositive,
  };
}
