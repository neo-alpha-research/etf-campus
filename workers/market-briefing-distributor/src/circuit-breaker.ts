import type { Env, MarketBriefingPayload } from "./types";

export interface CircuitBreakerResult {
  isSafe: boolean;
  reasons: string[];
}

export function validateBriefingPayload(payload: MarketBriefingPayload, env: Env): CircuitBreakerResult {
  const reasons: string[] = [];
  const maxDisparity = Number(env.MAX_ALLOWED_DISPARITY_PCT || "5.0");
  const maxSpike = Number(env.MAX_ALLOWED_DAILY_SPIKE_PCT || "15.0");

  const pulse = payload.pulse || {};
  const generalEtfCount = payload.generalEtfCount ?? pulse.generalEtfCount;
  const generalTotalAum = payload.generalTotalAum ?? pulse.generalTotalAum;
  const upCount = payload.upCount ?? pulse.upCount ?? 0;
  const flatCount = payload.flatCount ?? pulse.flatCount ?? 0;
  const downCount = payload.downCount ?? pulse.downCount ?? 0;

  const kospiChangePct = payload.kospiChangePct ?? payload.marketIndices?.find(i => i.code === "KOSPI")?.change_pct;
  const kosdaqChangePct = payload.kosdaqChangePct ?? payload.marketIndices?.find(i => i.code === "KOSDAQ")?.change_pct;
  const generalAumWeightedReturnPct = pulse.generalAumWeightedReturnPct;

  // 1. 기본 데이터 존재 및 종목 수 검증
  if (!payload.asOfDate) {
    reasons.push("asOfDate(기준일자) 누락");
  }
  if (!generalEtfCount || generalEtfCount < 800) {
    reasons.push(`ETF 종목 수 부족(현재: ${generalEtfCount}개, 최소 기준: 800개)`);
  }
  if (!generalTotalAum || generalTotalAum <= 0) {
    reasons.push("총 AUM 수치 이상 (0 또는 음수)");
  }

  // 2. 시장 등락 수 합계 검증
  const totalCount = upCount + flatCount + downCount;
  if (totalCount === 0) {
    reasons.push("시장 체온 등락 종목 수(상승/보합/하락) 합계 0");
  }

  // 3. 지수 등락률 비정상 스파이크 및 누락 검증
  if (kospiChangePct === undefined || kospiChangePct === null) {
    reasons.push("KOSPI 등락률 데이터 누락");
  } else if (Math.abs(kospiChangePct) > maxSpike) {
    reasons.push(`KOSPI 일간 등락률 이상 스파이크 감지 (${kospiChangePct}%, 허용 한계: ±${maxSpike}%)`);
  }

  if (kosdaqChangePct === undefined || kosdaqChangePct === null) {
    reasons.push("KOSDAQ 등락률 데이터 누락");
  } else if (Math.abs(kosdaqChangePct) > maxSpike) {
    reasons.push(`KOSDAQ 일간 등락률 이상 스파이크 감지 (${kosdaqChangePct}%, 허용 한계: ±${maxSpike}%)`);
  }

  if (generalAumWeightedReturnPct === undefined || generalAumWeightedReturnPct === null) {
    reasons.push("ETF 평균 등락률 데이터 누락");
  } else if (Math.abs(generalAumWeightedReturnPct) > maxSpike) {
    reasons.push(`ETF 평균 일간 등락률 이상 스파이크 감지 (${generalAumWeightedReturnPct}%, 허용 한계: ±${maxSpike}%)`);
  }

  // 4. 합산 데이터 결측 검증
  if (!payload.assetClasses && !payload.peerGroups) {
    reasons.push("자산군별/테마별 집계 데이터(assetClasses/peerGroups) 누락");
  }

  return {
    isSafe: reasons.length === 0,
    reasons,
  };
}
