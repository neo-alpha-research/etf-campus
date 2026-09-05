import type { Env, MarketBriefingPayload } from "./types";

export interface CircuitBreakerResult {
  isSafe: boolean;
  reasons: string[];
}

export interface ValidationOptions {
  latestTradingDate?: string;
  now?: Date;
}

const KST_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function getKstDateString(date = new Date()): string {
  return KST_FORMATTER.format(date);
}

export async function validateBriefingPayload(
  payload: MarketBriefingPayload,
  env: Env,
  options?: ValidationOptions
): Promise<CircuitBreakerResult> {
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
  const generalAumWeightedReturnPct = pulse.generalAumWeightedReturnPct ?? payload.generalAumWeightedReturnPct;

  // 1. 기본 데이터 존재 및 종목 수 검증
  if (!payload.asOfDate) {
    reasons.push("asOfDate(기준일자) 누락");
  } else {
    // [P0] 신선도(freshness) 검증 (Step 2)
    const nowKst = getKstDateString(options?.now ?? new Date());
    const targetTime = Date.parse(`${payload.asOfDate}T00:00:00Z`);
    const nowTime = Date.parse(`${nowKst}T00:00:00Z`);

    if (isNaN(targetTime)) {
      reasons.push(`asOfDate 형식 오류 (${payload.asOfDate})`);
    } else {
      const diffDays = Math.round((nowTime - targetTime) / (24 * 60 * 60 * 1000));
      // (1) 절대 상한: KST 기준 3일 이상 과거이면 무조건 차단
      if (diffDays >= 3) {
        reasons.push(`기준일자 신선도 초과: 브리핑 기준일(${payload.asOfDate})이 현재 KST(${nowKst}) 기준 ${diffDays}일 전 데이터입니다 (최대 허용: 2일 전)`);
      } else if (diffDays < 0) {
        reasons.push(`기준일자 오류: 미래 일자(${payload.asOfDate})는 허용되지 않습니다 (현재 KST: ${nowKst})`);
      }

      // (2) D1 적재 시세 데이터의 최신 거래일과 불일치 차단
      let latestDbTradingDate = options?.latestTradingDate;
      if (!latestDbTradingDate && env.ETF_PRICES && typeof env.ETF_PRICES.prepare === "function") {
        try {
          const row: any = await env.ETF_PRICES.prepare(
            "SELECT as_of_date FROM briefing_etf_daily ORDER BY as_of_date DESC LIMIT 1"
          ).first();
          if (row?.as_of_date) {
            latestDbTradingDate = row.as_of_date;
          }
        } catch (dbErr) {
          console.warn("[CircuitBreaker] Failed to query latest trading date from D1:", dbErr);
        }
      }

      if (latestDbTradingDate && payload.asOfDate !== latestDbTradingDate) {
        reasons.push(`기대 기준일 불일치: 브리핑 기준일(${payload.asOfDate})이 D1 최신 거래일(${latestDbTradingDate})과 다릅니다`);
      }
    }
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
