import { describe, expect, it } from 'vitest';
import {
  classifyReturnTier,
  classifyBreadthRegime,
  generateMarketNarrative,
  REGIME_MATRIX,
  MarketRegimeKey,
} from '../market-briefing-narrative';

describe('Market Briefing Narrative Engine (2차원 정밀 시황 매트릭스)', () => {
  describe('1. 21개 전 매트릭스 셀 완성도 및 템플릿 검증', () => {
    const returnTiers = ['SURGE', 'SOLID_GAIN', 'MILD_GAIN', 'FLAT', 'MILD_LOSS', 'SOLID_LOSS', 'PLUNGE'] as const;
    const breadthRegimes = ['BROAD_BASED', 'BALANCED', 'DIVERGENT'] as const;

    it('21개 모든 시황 조합 키에 대해 템플릿과 멘트가 누락 없이 정의되어 있다', () => {
      let count = 0;
      for (const tier of returnTiers) {
        for (const breadth of breadthRegimes) {
          const key = (tier + '_' + breadth) as MarketRegimeKey;
          const t = REGIME_MATRIX[key];
          expect(t, 'Missing template for ' + key).toBeDefined();
          expect(t.dynamicTitle.length).toBeGreaterThan(10);
          expect(t.summaryConclusion.length).toBeGreaterThan(5);
          expect(t.breadthSentence.length).toBeGreaterThan(10);
          expect(t.badgeLabel.length).toBeGreaterThan(2);
          count++;
        }
      }
      expect(count).toBe(21);
    });
  });

  describe('2. 가중수익률 7단계 분류 (classifyReturnTier)', () => {
    it('+1.5% 이상은 SURGE(급등)', () => {
      expect(classifyReturnTier(1.50)).toBe('SURGE');
      expect(classifyReturnTier(2.85)).toBe('SURGE');
    });

    it('+0.5% ~ +1.5%는 SOLID_GAIN(견조한 상승)', () => {
      expect(classifyReturnTier(0.50)).toBe('SOLID_GAIN');
      expect(classifyReturnTier(1.49)).toBe('SOLID_GAIN');
    });

    it('+0.1% ~ +0.5%는 MILD_GAIN(소폭/강보합)', () => {
      expect(classifyReturnTier(0.10)).toBe('MILD_GAIN');
      expect(classifyReturnTier(0.49)).toBe('MILD_GAIN');
    });

    it('-0.1% ~ +0.1%는 FLAT(팽팽한 보합)', () => {
      expect(classifyReturnTier(0.09)).toBe('FLAT');
      expect(classifyReturnTier(0.00)).toBe('FLAT');
      expect(classifyReturnTier(-0.09)).toBe('FLAT');
    });

    it('-0.5% ~ -0.1%는 MILD_LOSS(약보합)', () => {
      expect(classifyReturnTier(-0.10)).toBe('MILD_LOSS');
      expect(classifyReturnTier(-0.49)).toBe('MILD_LOSS');
    });

    it('-1.5% ~ -0.5%는 SOLID_LOSS(전반적 약세)', () => {
      expect(classifyReturnTier(-0.50)).toBe('SOLID_LOSS');
      expect(classifyReturnTier(-1.49)).toBe('SOLID_LOSS');
    });

    it('-1.5% 이하는 PLUNGE(급락/투매)', () => {
      expect(classifyReturnTier(-1.50)).toBe('PLUNGE');
      expect(classifyReturnTier(-3.20)).toBe('PLUNGE');
    });
  });

  describe('3. 종목 분산도 3단계 분류 (classifyBreadthRegime)', () => {
    it('상승장(+0.8%)에서 상승 종목이 70%면 BROAD_BASED (전방위 확산)', () => {
      expect(classifyBreadthRegime('SOLID_GAIN', 700, 250, 1000)).toBe('BROAD_BASED');
    });

    it('상승장(+0.8%)에서 상승 종목 30%, 하락 종목 65%면 DIVERGENT (대형주 착시)', () => {
      expect(classifyBreadthRegime('SOLID_GAIN', 300, 650, 1000)).toBe('DIVERGENT');
    });

    it('상승장(+0.8%)에서 상승 종목 55%, 하락 종목 40%면 BALANCED (고른 균형)', () => {
      expect(classifyBreadthRegime('SOLID_GAIN', 550, 400, 1000)).toBe('BALANCED');
    });

    it('하락장(-0.8%)에서 하락 종목이 70%면 BROAD_BASED (전방위 약세)', () => {
      expect(classifyBreadthRegime('SOLID_LOSS', 250, 700, 1000)).toBe('BROAD_BASED');
    });

    it('하락장(-0.8%)에서 상승 종목 60%, 하락 종목 35%면 DIVERGENT (대형주 주도 하락/체감 선방)', () => {
      expect(classifyBreadthRegime('SOLID_LOSS', 600, 350, 1000)).toBe('DIVERGENT');
    });

    it('보합장(0.0%)에서 상승 종목 65%면 BROAD_BASED (온기 품은 보합)', () => {
      expect(classifyBreadthRegime('FLAT', 650, 300, 1000)).toBe('BROAD_BASED');
    });
  });

  describe('4. 실제 시황 문장 생성 및 품질 검증 (generateMarketNarrative)', () => {
    it('사용자 예시 1: 견조한 상승 + 고른 확산 (+1.07%, 상승 673 / 하락 323)', () => {
      const res = generateMarketNarrative({
        generalEtfCount: 1022,
        upCount: 673,
        flatCount: 26,
        downCount: 323,
        generalAumWeightedReturnPct: 1.07,
      });

      expect(res.regimeKey).toBe('SOLID_GAIN_BROAD_BASED');
      expect(res.dynamicTitle).toContain('훈훈한 온기');
      expect(res.headline).toContain('일반 ETF 1,022개 중 상승 673개, 보합 26개, 하락 323개로 평균 +1.07% 상승하며 다수 종목으로 온기가 확산되며 견조한 동반 상승 흐름을 보였습니다.');
    });

    it('사용자 예시 2 (결함 방지): 지수는 +0.8% 올랐으나 하락이 65%인 대형주 착시 장세', () => {
      const res = generateMarketNarrative({
        generalEtfCount: 1000,
        upCount: 300,
        flatCount: 50,
        downCount: 650,
        generalAumWeightedReturnPct: 0.8,
      });

      expect(res.regimeKey).toBe('SOLID_GAIN_DIVERGENT');
      // 착시 장세에 맞게 온기가 아닌 체감 온도 괴리를 정확히 지적해야 함
      expect(res.dynamicTitle).toContain('체감 온도가 엇갈린');
      expect(res.summaryConclusion).toContain('하락 종목 비중이 높았으나 시총 상위 대형 ETF들의 방어력으로');
    });

    it('사용자 예시 3: 폭락 장세 (-2.1%, 하락 850개)', () => {
      const res = generateMarketNarrative({
        generalEtfCount: 1000,
        upCount: 100,
        flatCount: 50,
        downCount: 850,
        generalAumWeightedReturnPct: -2.1,
      });

      expect(res.regimeKey).toBe('PLUNGE_BROAD_BASED');
      expect(res.dynamicTitle).toContain('거센 매도 폭풍');
      expect(res.summaryConclusion).toContain('전방위적인 패닉셀이 출회되며');
    });

    it('테마 및 거래대금 쏠림 문장이 있을 때 headline 뒤에 자연스럽게 결합된다', () => {
      const res = generateMarketNarrative({
        generalEtfCount: 1000,
        upCount: 700,
        flatCount: 50,
        downCount: 250,
        generalAumWeightedReturnPct: 1.8,
        themeSentence: '오늘 시장을 이끈 주도 테마는 2차전지(+3.5%)였습니다.',
        concentrationSentence: '또한 상위 10개 종목이 전체 거래대금의 65.2%를 차지할 만큼 쏠림 현상이 뚜렷했습니다.',
      });

      expect(res.regimeKey).toBe('SURGE_BROAD_BASED');
      expect(res.headline).toContain('오늘 시장을 이끈 주도 테마는 2차전지(+3.5%)였습니다.');
      expect(res.headline).toContain('쏠림 현상이 뚜렷했습니다.');
    });

    it('ETF 개수가 0개이거나 flatCount가 undefined일 때도 에러 없이 fallback을 반환한다', () => {
      const res = generateMarketNarrative({
        generalEtfCount: 0,
        upCount: 0,
        downCount: 0,
        generalAumWeightedReturnPct: 0,
      });

      expect(res.regimeKey).toBe('FLAT_BALANCED');
      expect(res.dynamicTitle).toBeDefined();
      expect(res.headline).toContain('일반 ETF 0개');
    });
  });
});
