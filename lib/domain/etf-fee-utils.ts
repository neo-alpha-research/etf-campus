import { Etf } from "./etf-types";

/**
 * 합성 총보수(실부담 총비용) 산출: TER(명목보수+기타비용) + 매매중개수수료율
 */
export function getSyntheticFee(etf: Etf): number | null {
  if (!etf.fee) return null;
  if (etf.fee.totalFeePct === null) return null;

  const ter = etf.fee.terPct ?? ((etf.fee.totalFeePct ?? 0) + (etf.fee.otherCostPct ?? 0));
  const tradingCost = etf.fee.tradingCostPct ?? 0;
  
  return ter + tradingCost;
}

/**
 * 상장 1년 미만 신규 ETF 여부 판별 (비용 왜곡 마스킹 목적)
 * 기준 시점: ETF 데이터의 기준일 (asOfDate)
 */
export function isNewEtfForFeeMasking(etf: Etf): boolean {
  if (!etf.listingDate || !etf.asOfDate) return false;
  
  const listingDate = new Date(etf.listingDate);
  const asOfDate = new Date(etf.asOfDate);
  
  const oneYearAgo = new Date(asOfDate);
  oneYearAgo.setFullYear(asOfDate.getFullYear() - 1);
  
  return listingDate > oneYearAgo;
}

export type FeeDisplayContext = {
  type: "masked_new" | "synthetic" | "nominal_only" | "unknown";
  syntheticFee: number | null;
  nominalFee: number | null;
  hasHiddenCostWarning: boolean;
};

/**
 * 컴플라이언스 및 마스킹 룰을 적용한 최종 UI 렌더링용 보수 컨텍스트 산출
 */
export function getFeeDisplayContext(etf: Etf): FeeDisplayContext {
  const nominalFee = etf.fee?.totalFeePct ?? null;
  const syntheticFee = getSyntheticFee(etf);
  
  if (nominalFee === null) {
    return { type: "unknown", syntheticFee: null, nominalFee: null, hasHiddenCostWarning: false };
  }
  
  if (isNewEtfForFeeMasking(etf)) {
    return { type: "masked_new", syntheticFee: null, nominalFee, hasHiddenCostWarning: false };
  }
  
  if (syntheticFee !== null && syntheticFee > nominalFee) {
    // 경고 뱃지 조건: 명목 대비 실질비용이 0.5%p 이상 높을 때 (숨은 비용 폭탄)
    const hasHiddenCostWarning = (syntheticFee - nominalFee) >= 0.5;
    return { type: "synthetic", syntheticFee, nominalFee, hasHiddenCostWarning };
  }
  
  return { type: "nominal_only", syntheticFee: nominalFee, nominalFee, hasHiddenCostWarning: false };
}
