import { Etf } from "./etf-types";

export type FeeInputEtf = {
  fee?: Etf["fee"];
  listingDate?: string | Date | null;
  asOfDate?: string | Date | null;
};

/**
 * 합성 총보수(실부담 총비용) 산출: TER(명목보수+기타비용) + 매매중개수수료율
 */
export function getSyntheticFee(etf: FeeInputEtf): number | null {
  if (!etf.fee) return null;
  if (etf.fee.totalFeePct == null) return null;

  // Trading cost MUST be disclosed to determine total synthetic fee
  if (etf.fee.tradingCostPct == null) return null;

  // TER must be known, either directly via terPct or via totalFeePct + otherCostPct
  const ter = etf.fee.terPct ?? (etf.fee.otherCostPct != null ? etf.fee.totalFeePct + etf.fee.otherCostPct : null);
  if (ter == null) return null;

  return ter + etf.fee.tradingCostPct;
}

/**
 * 상장 1년 미만 신규 ETF 여부 판별 (비용 왜곡 마스킹 목적)
 * 기준 시점: ETF 데이터의 기준일 (asOfDate)
 */
export function isNewEtfForFeeMasking(etf: FeeInputEtf): boolean {
  if (!etf.listingDate || !etf.asOfDate) return false;

  const parseDate = (d: string | Date): Date => {
    if (d instanceof Date) return d;
    const str = String(d).trim();
    if (str.length === 8 && /^\d{8}$/.test(str)) {
      return new Date(`${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`);
    }
    return new Date(str);
  };

  const listingDate = parseDate(etf.listingDate);
  const asOfDate = parseDate(etf.asOfDate);

  if (isNaN(listingDate.getTime()) || isNaN(asOfDate.getTime())) return false;

  const oneYearAgo = new Date(asOfDate);
  oneYearAgo.setFullYear(asOfDate.getFullYear() - 1);

  return listingDate > oneYearAgo;
}

export type FeeDisplayContext = {
  type: "masked_new" | "synthetic" | "nominal_only" | "unknown";
  syntheticFee: number | null;
  nominalFee: number | null;
  hasHiddenCostWarning: boolean;
  isStale: boolean;
  staleMessage?: string;
};

/**
 * 데이터 지연 여부 판별 (90일 초과 시 Stale 처리)
 */
function checkIsStale(effectiveDate?: string | null): boolean {
  if (!effectiveDate) return false;
  // YYYYMM 형식 파싱 (예: "202607")
  let dateObj: Date;
  if (effectiveDate.length === 6 && /^\d{6}$/.test(effectiveDate)) {
    const year = parseInt(effectiveDate.slice(0, 4), 10);
    const month = parseInt(effectiveDate.slice(4, 6), 10);
    dateObj = new Date(year, month - 1, 1);
  } else {
    dateObj = new Date(effectiveDate);
  }

  if (isNaN(dateObj.getTime())) return false;

  const daysDiff = (Date.now() - dateObj.getTime()) / (1000 * 60 * 60 * 24);
  return daysDiff > 90;
}

/**
 * 컴플라이언스 및 마스킹 룰을 적용한 최종 UI 렌더링용 보수 컨텍스트 산출
 */
export function getFeeDisplayContext(etf: FeeInputEtf): FeeDisplayContext {
  const nominalFee = etf.fee?.totalFeePct ?? null;
  const syntheticFee = getSyntheticFee(etf);

  const isStale = checkIsStale(etf.fee?.effectiveDate);
  const staleMessage = isStale ? `협회 공시 지연으로 ${etf.fee?.effectiveDate} 기준 데이터를 표시 중입니다.` : undefined;

  if (nominalFee === null) {
    return { type: "unknown", syntheticFee: null, nominalFee: null, hasHiddenCostWarning: false, isStale: false };
  }

  if (isNewEtfForFeeMasking(etf)) {
    return { type: "masked_new", syntheticFee: null, nominalFee, hasHiddenCostWarning: false, isStale, staleMessage };
  }

  if (syntheticFee !== null) {
    // 경고 뱃지 조건: 명목 보수와 실질비용이 0.5%p 이상 차이 날 때 (숨은 비용 주의)
    const hasHiddenCostWarning = (syntheticFee - (nominalFee ?? 0)) >= 0.5;
    return { type: "synthetic", syntheticFee, nominalFee, hasHiddenCostWarning, isStale, staleMessage };
  }

  return { type: "nominal_only", syntheticFee: null, nominalFee, hasHiddenCostWarning: false, isStale, staleMessage };
}
