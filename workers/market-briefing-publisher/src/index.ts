import { warmLatestBriefingCache } from "./publication-cache";
import { materializeMarketSnapshot, type MarketSnapshotReadyEvent } from "./source-materializer";
import { ETF_TAXONOMY_MAP } from "./taxonomy-map";

export interface Env {
  ETF_PRICES: D1Database;
  BRIEFING_KV: KVNamespace;
  MANUAL_RUN_TOKEN?: string;
  FLAT_THRESHOLD_PCT: string;
  DISTRIBUTION_QUEUE?: Queue<any>;
}

type PublicationStatus = "queued" | "publishing" | "ready" | "failed" | "skipped_locked" | "skipped_no_new_data";
type ScheduleSlot = "first" | "retry_1" | "retry_2" | "final" | "manual";
type IndexCode = "KOSPI" | "KOSDAQ";

type ReadinessRow = {
  as_of_date: string;
  source_run_id: string;
  etf_as_of_date: string;
  kospi_as_of_date: string;
  kosdaq_as_of_date: string;
  etf_row_count: number;
  general_etf_count: number;
  aum_coverage_pct: number;
  validation_json: string;
};

type EtfSnapshot = {
  as_of_date: string;
  ticker: string;
  etf_name: string;
  close_value: number;
  change_pct: number;
  trade_value: number;
  aum_value: number | null;
  risk_type: "normal" | "leveraged" | "inverse" | "unknown";
  asset_class: string | null;
  asset_detail: string | null;
  nav_value: number | null;
  disparity_pct: number | null;
  is_general_etf: 0 | 1;
  shares?: string | number | null;
};

type IndexSnapshot = {
  as_of_date: string;
  index_code: IndexCode;
  index_name: string;
  close_value: number;
  change_points: number | null;
  change_pct: number;
  volume_value: number | null;
};

type Pulse = {
  generalEtfCount: number;
  upCount: number;
  flatCount: number;
  downCount: number;
  breadthRatioPct: number;
  marketTemperature: "상승 우세" | "완만한 상승" | "혼조" | "완만한 하락" | "하락 우세";
  generalTotalAum: number;
  generalTotalTradeValue: number;
  top10TradeSharePct: number;
  allTop10TradeSharePct: number;
  aumCoveragePct: number;
};

type AumWeightedReturn = {
  scope: "all" | "top_50" | "top_100" | "top_200";
  label: string;
  constituentCount: number;
  totalAum: number;
  aumCoveragePct: number;
  weightedReturnPct: number;
};

type AssetClassMetric = {
  assetClass: string;
  etfCount: number;
  upCount: number;
  flatCount: number;
  downCount: number;
  breadthRatioPct: number | null;
  aumWeightedReturnPct: number | null;
  totalAum: number;
  aumSharePct: number;
  totalTradeValue: number;
  tradeSharePct: number;
};

const KST_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const nowIso = (): string => new Date().toISOString();
const asJson = (value: unknown): string => JSON.stringify(value);
const kstDate = (date = new Date()): string => KST_FORMATTER.format(date);

function scheduleSlot(scheduledTime?: number): ScheduleSlot {
  if (scheduledTime === undefined) return "manual";
  const kstHour = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(new Date(scheduledTime)));
  if (kstHour === 6) return "first";
  if (kstHour === 7) return "retry_1";
  if (kstHour === 8) return "retry_2";
  return "final";
}

function temperature(breadthRatioPct: number): Pulse["marketTemperature"] {
  if (breadthRatioPct >= 60) return "상승 우세";
  if (breadthRatioPct >= 52) return "완만한 상승";
  if (breadthRatioPct > 48) return "혼조";
  if (breadthRatioPct > 40) return "완만한 하락";
  return "하락 우세";
}

function formatSigned(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

function calculatePulse(quotes: EtfSnapshot[], flatThreshold: number): Pulse {
  const general = quotes.filter((quote) => quote.is_general_etf === 1);
  const withAum = general.filter((quote) => quote.aum_value !== null && quote.aum_value > 0);
  let upCount = 0;
  let flatCount = 0;
  let downCount = 0;
  for (const quote of general) {
    if (quote.change_pct >= flatThreshold) upCount += 1;
    else if (quote.change_pct <= -flatThreshold) downCount += 1;
    else flatCount += 1;
  }
  const generalTotalTradeValue = general.reduce((sum, quote) => sum + quote.trade_value, 0);
  const top10TradeValue = [...general]
    .sort((left, right) => right.trade_value - left.trade_value)
    .slice(0, 10)
    .reduce((sum, quote) => sum + quote.trade_value, 0);

  const allTotalTradeValue = quotes.reduce((sum, quote) => sum + quote.trade_value, 0);
  const allTop10TradeValue = [...quotes]
    .sort((left, right) => right.trade_value - left.trade_value)
    .slice(0, 10)
    .reduce((sum, quote) => sum + quote.trade_value, 0);

  return {
    generalEtfCount: general.length,
    upCount,
    flatCount,
    downCount,
    breadthRatioPct: general.length ? (upCount / general.length) * 100 : 0,
    marketTemperature: temperature(general.length ? (upCount / general.length) * 100 : 0),
    generalTotalAum: withAum.reduce((sum, quote) => sum + (quote.aum_value ?? 0), 0),
    generalTotalTradeValue,
    top10TradeSharePct: generalTotalTradeValue === 0 ? 0 : (top10TradeValue / generalTotalTradeValue) * 100,
    allTop10TradeSharePct: allTotalTradeValue === 0 ? 0 : (allTop10TradeValue / allTotalTradeValue) * 100,
    aumCoveragePct: general.length ? (withAum.length / general.length) * 100 : 0,
  };
}

function calculateAumWeightedReturns(quotes: EtfSnapshot[]): AumWeightedReturn[] {
  const eligible = quotes
    .filter((quote) => quote.is_general_etf === 1 && quote.aum_value !== null && quote.aum_value > 0)
    .sort((left, right) => (right.aum_value ?? 0) - (left.aum_value ?? 0));
  const fullAum = eligible.reduce((sum, quote) => sum + (quote.aum_value ?? 0), 0);
  if (!eligible.length || fullAum <= 0) throw new Error("Cannot calculate AUM-weighted returns without positive AUM");

  const scopes: Array<{ scope: AumWeightedReturn["scope"]; label: string; limit?: number }> = [
    { scope: "all", label: "일반 ETF 전체" },
    { scope: "top_50", label: "순자산 Top 50", limit: 50 },
    { scope: "top_100", label: "순자산 Top 100", limit: 100 },
    { scope: "top_200", label: "순자산 Top 200", limit: 200 },
  ];
  return scopes.map(({ scope, label, limit }) => {
    const constituents = limit ? eligible.slice(0, limit) : eligible;
    const totalAum = constituents.reduce((sum, quote) => sum + (quote.aum_value ?? 0), 0);
    return {
      scope,
      label,
      constituentCount: constituents.length,
      totalAum,
      aumCoveragePct: (totalAum / fullAum) * 100,
      weightedReturnPct: constituents.reduce((sum, quote) => sum + ((quote.aum_value ?? 0) / totalAum) * quote.change_pct, 0),
    };
  });
}


function calculatePeerGroups(quotes: any[]): any {
  const groups = new Map<string, { peerGroup: string; assetClass: string; rows: any[] }>();
  for (const quote of quotes) {
    if (quote.is_general_etf !== 1) continue;
    const detail = quote.asset_detail?.trim();
    if (!detail) continue;
    const assetClass = quote.asset_class?.trim() || "미분류";
    const groupKey = `${assetClass}::${detail}`;
    const existing = groups.get(groupKey);
    if (existing) {
      existing.rows.push(quote);
    } else {
      groups.set(groupKey, { peerGroup: detail, assetClass, rows: [quote] });
    }
  }
  
  const results = [];
  for (const [, data] of groups.entries()) {
    const rows = data.rows;
    if (rows.length < 3) continue; // 최소 3개 이상
    
    // 동일가중 평균
    const equalWeightReturn = rows.reduce((sum, r) => sum + r.change_pct, 0) / rows.length;
    
    // 시총가중 평균 (30% 상한)
    const totalAum = rows.reduce((sum, r) => sum + (r.aum_value ?? 0), 0);
    let cappedReturn = 0;
    if (totalAum > 0) {
      let sumReturn = 0;
      let sumWeight = 0;
      for (const r of rows) {
        if (!r.aum_value) continue;
        let weight = r.aum_value / totalAum;
        if (weight > 0.3) weight = 0.3; // 30% cap
        sumReturn += r.change_pct * weight;
        sumWeight += weight;
      }
      cappedReturn = sumWeight > 0 ? sumReturn / sumWeight : 0;
    }
    
    results.push({
      peerGroup: data.peerGroup,
      assetClass: data.assetClass,
      etfCount: rows.length,
      equalWeightReturnPct: equalWeightReturn,
      cappedAumWeightedReturnPct: cappedReturn,
    });
  }
  
  results.sort((a, b) => b.cappedAumWeightedReturnPct - a.cappedAumWeightedReturnPct);
  return results;
}


function calculateDisparityWarning(quotes: any[]): any {
  const warnings = [];
  for (const q of quotes) {
    if (q.is_general_etf !== 1 || q.disparity_pct == null || !q.trade_value) continue;
    // 저유동성 종목 제외 (거래대금 1천만원 미만)
    if (q.trade_value < 10000000) continue;
    
    let threshold = 3.0; // Default or Overseas
    const assetClass = q.asset_class?.trim() || "";
    if (assetClass.includes("국내")) {
      threshold = 1.0;
    }
    
    if (Math.abs(q.disparity_pct) >= threshold) {
      warnings.push({
        ticker: q.ticker,
        etfName: q.etf_name,
        assetClass,
        disparityPct: q.disparity_pct,
      });
    }
  }
  
  return warnings.sort((a, b) => Math.abs(b.disparityPct) - Math.abs(a.disparityPct));
}

function calculateFundFlow(quotes: any[], previousQuotes: any[] = []): any {
  const prevMap = new Map((previousQuotes || []).map(q => [q.ticker, q]));
  const allResults = [];
  const generalResults = [];
  
  let skippedDueToNav = 0;
  
  for (const q of quotes) {
    if (!q.aum_value || !q.nav_value) {
      skippedDueToNav++;
      continue;
    }
    const prev = prevMap.get(q.ticker);
    if (!prev || !prev.aum_value || !prev.nav_value) {
      skippedDueToNav++;
      continue;
    }
    
    // Shares Outstanding = AUM / NAV (To avoid disparity distortion)
    const currentShares = q.aum_value / q.nav_value;
    const prevShares = prev.aum_value / prev.nav_value;
    
    // Net Inflow = (Current Shares - Prev Shares) * Current NAV
    const netInflow = (currentShares - prevShares) * q.nav_value;
    
    const row = {
      ticker: q.ticker,
      etfName: q.etf_name,
      netInflowValue: netInflow,
    };
    allResults.push(row);
    if (q.is_general_etf === 1) {
      generalResults.push(row);
    }
  }
  if (skippedDueToNav > 0) {
    console.warn(`[calculateFundFlow] Skipped ${skippedDueToNav} ETFs due to missing NAV or AUM data.`);
  }

  // Sorting
  allResults.sort((a, b) => b.netInflowValue - a.netInflowValue);
  generalResults.sort((a, b) => b.netInflowValue - a.netInflowValue);
  
  return {
    general: {
      topInflows: generalResults.slice(0, 5),
      topOutflows: generalResults.slice().reverse().slice(0, 5)
    },
    all: {
      topInflows: allResults.slice(0, 5),
      topOutflows: allResults.slice().reverse().slice(0, 5)
    }
  };
}

async function calculatePeriodicFundFlows(
  db: D1Database,
  quotes: EtfSnapshot[],
  asOfDate: string
): Promise<{ weeklyFundFlows: any; monthlyFundFlows: any }> {
  const general = quotes.filter((q) => q.is_general_etf === 1);

  // Fetch past distinct dates from briefing_etf_daily for true creation/redemption fund flow
  const distinctBriefingDates = await db
    .prepare("SELECT DISTINCT as_of_date FROM briefing_etf_daily WHERE as_of_date <= ? ORDER BY as_of_date DESC LIMIT 25")
    .bind(asOfDate)
    .all<{ as_of_date: string }>();

  const briefingDates = (distinctBriefingDates.results || []).map((r) => r.as_of_date);
  const t5Date = briefingDates[5] || briefingDates[briefingDates.length - 1];
  const t20Date = briefingDates[20] || briefingDates[briefingDates.length - 1];

  let quotesT5 = new Map<string, { aum_value: number; nav_value: number; shares?: number; close_value: number }>();
  let quotesT20 = new Map<string, { aum_value: number; nav_value: number; shares?: number; close_value: number }>();

  if (t5Date && t5Date !== asOfDate) {
    const res5 = await db
      .prepare("SELECT ticker, aum_value, nav_value, close_value, shares FROM briefing_etf_daily WHERE as_of_date = ?")
      .bind(t5Date)
      .all<any>();
    quotesT5 = new Map((res5.results || []).map((r) => [r.ticker, r]));
  }
  if (t20Date && t20Date !== asOfDate) {
    const res20 = await db
      .prepare("SELECT ticker, aum_value, nav_value, close_value, shares FROM briefing_etf_daily WHERE as_of_date = ?")
      .bind(t20Date)
      .all<any>();
    quotesT20 = new Map((res20.results || []).map((r) => [r.ticker, r]));
  }

  // Also query price table for fallback returns if needed
  const distinctPriceDates = await db
    .prepare("SELECT DISTINCT date FROM etf_prices WHERE date <= ? ORDER BY date DESC LIMIT 25")
    .bind(asOfDate)
    .all<{ date: string }>();
  const priceDates = (distinctPriceDates.results || []).map((r) => r.date);
  const p5Date = priceDates[5] || priceDates[priceDates.length - 1];
  const p20Date = priceDates[20] || priceDates[priceDates.length - 1];

  let pricesT5 = new Map<string, number>();
  let pricesT20 = new Map<string, number>();
  if (p5Date) {
    const pRes5 = await db.prepare("SELECT ticker, close FROM etf_prices WHERE date = ?").bind(p5Date).all<{ ticker: string; close: number }>();
    pricesT5 = new Map((pRes5.results || []).map((r) => [r.ticker, r.close]));
  }
  if (p20Date) {
    const pRes20 = await db.prepare("SELECT ticker, close FROM etf_prices WHERE date = ?").bind(p20Date).all<{ ticker: string; close: number }>();
    pricesT20 = new Map((pRes20.results || []).map((r) => [r.ticker, r.close]));
  }

  const groups = new Map<string, { peerGroup: string; assetClass: string; members: EtfSnapshot[] }>();
  for (const q of general) {
    const detail = q.asset_detail?.trim();
    if (!detail || detail === "미확인 주식전략" || detail === "미분류") continue;
    const assetClass = q.asset_class?.trim() || "미분류";
    if (!groups.has(detail)) {
      groups.set(detail, { peerGroup: detail, assetClass, members: [] });
    }
    groups.get(detail)!.members.push(q);
  }

  const weeklyAll: any[] = [];
  const monthlyAll: any[] = [];

  for (const [, g] of groups.entries()) {
    if (g.members.length < 3) continue;

    const ret5List: number[] = [];
    const ret20List: number[] = [];
    let groupFlow5Won = 0;
    let groupFlow20Won = 0;

    for (const m of g.members) {
      const c0 = m.close_value || 0;
      const nav0 = m.nav_value || c0;
      const aum0 = m.aum_value || 0;
      const shares0 = m.shares ? Number(m.shares) : (nav0 > 0 ? aum0 / nav0 : 0);

      // T-5
      const q5 = quotesT5.get(m.ticker);
      const c5 = q5?.close_value || pricesT5.get(m.ticker) || c0;
      const nav5 = q5?.nav_value || c5;
      const aum5 = q5?.aum_value || (q5 ? 0 : aum0);
      const shares5 = q5 ? (q5.shares ? Number(q5.shares) : (nav5 > 0 ? aum5 / nav5 : 0)) : shares0;

      const r5 = c5 > 0 ? ((c0 - c5) / c5) * 100 : (m.change_pct || 0);
      ret5List.push(r5);
      groupFlow5Won += (shares0 - shares5) * nav0;

      // T-20
      const q20 = quotesT20.get(m.ticker);
      const c20 = q20?.close_value || pricesT20.get(m.ticker) || c0;
      const nav20 = q20?.nav_value || c20;
      const aum20 = q20?.aum_value || (q20 ? 0 : aum0);
      const shares20 = q20 ? (q20.shares ? Number(q20.shares) : (nav20 > 0 ? aum20 / nav20 : 0)) : shares0;

      const r20 = c20 > 0 ? ((c0 - c20) / c20) * 100 : (m.change_pct || 0);
      ret20List.push(r20);
      groupFlow20Won += (shares0 - shares20) * nav0;
    }

    const avgRet5 = ret5List.length > 0 ? ret5List.reduce((a, b) => a + b, 0) / ret5List.length : 0;
    const avgRet20 = ret20List.length > 0 ? ret20List.reduce((a, b) => a + b, 0) / ret20List.length : 0;

    const netInflow5Ok = Math.round(groupFlow5Won / 100000000);
    const netInflow20Ok = Math.round(groupFlow20Won / 100000000);

    weeklyAll.push({
      peerGroup: g.peerGroup,
      assetClass: g.assetClass,
      etfCount: g.members.length,
      netInflow: netInflow5Ok,
      returnPct: Number(avgRet5.toFixed(2)),
    });

    monthlyAll.push({
      peerGroup: g.peerGroup,
      assetClass: g.assetClass,
      etfCount: g.members.length,
      netInflow: netInflow20Ok,
      returnPct: Number(avgRet20.toFixed(2)),
    });
  }

  const weeklyInflows = weeklyAll.filter((x) => x.netInflow > 0).sort((a, b) => b.netInflow - a.netInflow).slice(0, 5).map((x, i) => ({ ...x, rank: i + 1 }));
  const weeklyOutflows = weeklyAll.filter((x) => x.netInflow < 0).sort((a, b) => a.netInflow - b.netInflow).slice(0, 5).map((x, i) => ({ ...x, rank: i + 1 }));

  const monthlyInflows = monthlyAll.filter((x) => x.netInflow > 0).sort((a, b) => b.netInflow - a.netInflow).slice(0, 5).map((x, i) => ({ ...x, rank: i + 1 }));
  const monthlyOutflows = monthlyAll.filter((x) => x.netInflow < 0).sort((a, b) => a.netInflow - b.netInflow).slice(0, 5).map((x, i) => ({ ...x, rank: i + 1 }));

  return {
    weeklyFundFlows: { topInflows: weeklyInflows, topOutflows: weeklyOutflows },
    monthlyFundFlows: { topInflows: monthlyInflows, topOutflows: monthlyOutflows },
  };
}

function calculateMarketScale(quotes: EtfSnapshot[]): any {
  const totalEtfs = quotes.length;
  const general = quotes.filter((q) => q.is_general_etf === 1);
  const parking = quotes.filter((q) => q.is_general_etf === 0 && (q.asset_class?.includes("단기") || q.etf_name?.includes("CD") || q.etf_name?.includes("KOFR") || q.etf_name?.includes("머니마켓")));
  const leveraged = quotes.filter((q) => q.risk_type === "leveraged");
  const inverse = quotes.filter((q) => q.risk_type === "inverse");

  const totalAumOk = quotes.reduce((sum, q) => sum + (q.aum_value || 0), 0) / 100000000;
  const totalTradeOk = quotes.reduce((sum, q) => sum + (q.trade_value || 0), 0) / 100000000;

  const generalAum = general.reduce((sum, q) => sum + (q.aum_value || 0), 0) / 100000000;
  const parkingAum = parking.reduce((sum, q) => sum + (q.aum_value || 0), 0) / 100000000;
  const leveragedAum = leveraged.reduce((sum, q) => sum + (q.aum_value || 0), 0) / 100000000;
  const inverseAum = inverse.reduce((sum, q) => sum + (q.aum_value || 0), 0) / 100000000;

  return {
    totalEtfCount: totalEtfs,
    generalEtfCount: general.length,
    totalAum: totalAumOk,
    totalTradeValue: totalTradeOk,
    composition: [
      { type: "general", label: "일반 ETF", aum: Math.round(generalAum), pct: Number(((generalAum / (totalAumOk || 1)) * 100).toFixed(1)), count: general.length },
      { type: "parking", label: "파킹·단기자금", aum: Math.round(parkingAum), pct: Number(((parkingAum / (totalAumOk || 1)) * 100).toFixed(1)), count: parking.length },
      { type: "leveraged", label: "레버리지", aum: Math.round(leveragedAum), pct: Number(((leveragedAum / (totalAumOk || 1)) * 100).toFixed(1)), count: leveraged.length },
      { type: "inverse", label: "인버스", aum: Math.round(inverseAum), pct: Number(((inverseAum / (totalAumOk || 1)) * 100).toFixed(1)), count: inverse.length },
    ],
    daily: { aumChange: 0, aumChangePct: 0, netInflow: 0 },
    weekly: { aumChange: 0, netInflow: 0 },
    monthly: { aumChange: 0, netInflow: 0 },
  };
}

async function calculateMarketScaleTimeSeries(db: D1Database, asOfDate: string): Promise<any> {
  const pastDates = await db
    .prepare("SELECT DISTINCT as_of_date FROM briefing_etf_daily WHERE as_of_date <= ? ORDER BY as_of_date DESC LIMIT 6")
    .bind(asOfDate)
    .all<{ as_of_date: string }>();

  const dateList = (pastDates.results || []).map((r) => r.as_of_date).reverse();
  if (!dateList.length) {
    return { daily: [], weekly: [], monthly: [], yearly: [] };
  }

  const placeholders = dateList.map(() => "?").join(",");
  const allQuotesRes = await db
    .prepare(`SELECT as_of_date, ticker, aum_value, trade_value, change_pct FROM briefing_etf_daily WHERE as_of_date IN (${placeholders}) ORDER BY as_of_date ASC`)
    .bind(...dateList)
    .all<{ as_of_date: string; ticker: string; aum_value: number; trade_value: number; change_pct: number }>();

  const byDate = new Map<string, Map<string, { aum_value: number; trade_value: number; change_pct: number }>>();
  for (const d of dateList) {
    byDate.set(d, new Map());
  }
  for (const q of allQuotesRes.results || []) {
    const m = byDate.get(q.as_of_date);
    if (m) {
      m.set(q.ticker, { aum_value: q.aum_value || 0, trade_value: q.trade_value || 0, change_pct: q.change_pct || 0 });
    }
  }

  const displayDates = dateList.length > 5 ? dateList.slice(-5) : dateList;
  const dailyTs = displayDates.map((d, idx) => {
    const curMap = byDate.get(d) || new Map();
    let totalAumVal = 0;
    let totalTradeVal = 0;
    for (const item of curMap.values()) {
      totalAumVal += item.aum_value;
      totalTradeVal += item.trade_value;
    }

    const aum = Math.round(totalAumVal / 100000000);
    const adtv = Math.round(totalTradeVal / 100000000);
    const turnoverPct = aum > 0 ? Number(((adtv / aum) * 100).toFixed(2)) : 0;

    const origIdx = dateList.indexOf(d);
    let aumChange = 0;
    let aumChangePct = 0;
    let priceEffect = 0;
    let netInflow = 0;

    if (origIdx > 0) {
      const prevD = dateList[origIdx - 1];
      const prevMap = byDate.get(prevD) || new Map();
      let prevTotalAum = 0;
      for (const item of prevMap.values()) {
        prevTotalAum += item.aum_value;
      }
      const aumDiffVal = totalAumVal - prevTotalAum;
      aumChange = Math.round(aumDiffVal / 100000000);
      aumChangePct = prevTotalAum > 0 ? Number(((aumDiffVal / prevTotalAum) * 100).toFixed(2)) : 0;

      let rawPriceEffect = 0;
      for (const [ticker, curItem] of curMap.entries()) {
        const prevItem = prevMap.get(ticker);
        if (prevItem) {
          rawPriceEffect += prevItem.aum_value * (curItem.change_pct / 100.0);
        }
      }
      priceEffect = Math.round(rawPriceEffect / 100000000);
      netInflow = aumChange - priceEffect;
    }

    const relKey = idx === displayDates.length - 1 ? "T" : `T-${displayDates.length - 1 - idx}`;

    return {
      key: relKey,
      label: d.slice(5),
      date: d,
      aum,
      adtv,
      turnoverPct,
      aumChange,
      aumChangePct,
      priceEffect,
      netInflow,
    };
  });

  return {
    daily: dailyTs,
    weekly: [],
    monthly: [],
    yearly: [],
  };
}

function calculateAssetClasses(quotes: EtfSnapshot[], flatThreshold: number): AssetClassMetric[] {
  const general = quotes.filter((quote) => quote.is_general_etf === 1);
  const totalAum = general.reduce((sum, quote) => sum + (quote.aum_value ?? 0), 0);
  const totalTrade = general.reduce((sum, quote) => sum + quote.trade_value, 0);
  const groups = new Map<string, EtfSnapshot[]>();
  for (const quote of general) {
    const assetClass = quote.asset_class?.trim() || "미분류";
    groups.set(assetClass, [...(groups.get(assetClass) ?? []), quote]);
  }
  return [...groups.entries()].map(([assetClass, rows]) => {
    const upCount = rows.filter((row) => row.change_pct >= flatThreshold).length;
    const flatCount = rows.filter((row) => Math.abs(row.change_pct) < flatThreshold).length;
    const downCount = rows.length - upCount - flatCount;
    const aum = rows.reduce((sum, row) => sum + (row.aum_value ?? 0), 0);
    const trade = rows.reduce((sum, row) => sum + row.trade_value, 0);
    return {
      assetClass,
      etfCount: rows.length,
      upCount,
      flatCount,
      downCount,
      breadthRatioPct: rows.length ? (upCount / rows.length) * 100 : null,
      aumWeightedReturnPct: aum > 0 ? rows.reduce((sum, row) => sum + (row.aum_value ?? 0) * row.change_pct, 0) / aum : null,
      totalAum: aum,
      aumSharePct: totalAum ? (aum / totalAum) * 100 : 0,
      totalTradeValue: trade,
      tradeSharePct: totalTrade ? (trade / totalTrade) * 100 : 0,
    };
  });
}

function buildHeadline(pulse: Pulse, indices: IndexSnapshot[]): string {
  const kospi = indices.find((index) => index.index_code === "KOSPI");
  const kosdaq = indices.find((index) => index.index_code === "KOSDAQ");
  if (!kospi || !kosdaq) throw new Error("Missing KOSPI or KOSDAQ snapshot for headline");
  return `일반 ETF ${pulse.generalEtfCount.toLocaleString("ko-KR")}개 중 ${pulse.upCount.toLocaleString("ko-KR")}개가 상승해 ${pulse.marketTemperature} 흐름을 보였습니다. KOSPI는 ${formatSigned(kospi.change_pct)}%, KOSDAQ은 ${formatSigned(kosdaq.change_pct)}%였습니다.`;
}

async function acquirePublicationLock(db: D1Database, runId: string): Promise<boolean> {
  const acquiredAt = nowIso();
  const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
  const result = await db
    .prepare(
      `INSERT INTO briefing_publication_locks (lock_name, owner_run_id, acquired_at, expires_at)
       VALUES ('market_briefing_publish', ?, ?, ?)
       ON CONFLICT(lock_name) DO UPDATE SET owner_run_id=excluded.owner_run_id, acquired_at=excluded.acquired_at, expires_at=excluded.expires_at
       WHERE briefing_publication_locks.expires_at <= excluded.acquired_at`,
    )
    .bind(runId, acquiredAt, expiresAt)
    .run();
  return result.meta.changes === 1;
}

async function releasePublicationLock(db: D1Database, runId: string): Promise<void> {
  await db
    .prepare(`DELETE FROM briefing_publication_locks WHERE lock_name = 'market_briefing_publish' AND owner_run_id = ?`)
    .bind(runId)
    .run();
}

async function updatePublicationRun(
  db: D1Database,
  publicationRunId: string,
  status: PublicationStatus,
  extra: Record<string, unknown> = {},
): Promise<void> {
  const fields = ["status = ?", "updated_at = ?"];
  const values: unknown[] = [status, nowIso()];
  for (const [key, value] of Object.entries(extra)) {
    fields.push(`${key} = ?`);
    values.push(value);
  }
  values.push(publicationRunId);
  await db.prepare(`UPDATE briefing_publication_runs SET ${fields.join(", ")} WHERE publication_run_id = ?`).bind(...values).run();
}

async function getUnpublishedReadiness(db: D1Database, asOfDate?: string): Promise<ReadinessRow | null> {
  const query = asOfDate
    ? `SELECT r.as_of_date, r.source_run_id, r.etf_as_of_date, r.kospi_as_of_date, r.kosdaq_as_of_date,
              r.etf_row_count, r.general_etf_count, r.aum_coverage_pct, r.validation_json
       FROM market_data_readiness r
       LEFT JOIN market_briefings b ON b.as_of_date = r.as_of_date
       WHERE r.status = 'ready' AND b.as_of_date IS NULL AND r.as_of_date = ?
       LIMIT 1`
    : `SELECT r.as_of_date, r.source_run_id, r.etf_as_of_date, r.kospi_as_of_date, r.kosdaq_as_of_date,
              r.etf_row_count, r.general_etf_count, r.aum_coverage_pct, r.validation_json
       FROM market_data_readiness r
       LEFT JOIN market_briefings b ON b.as_of_date = r.as_of_date
       WHERE r.status = 'ready' AND b.as_of_date IS NULL
       ORDER BY r.as_of_date DESC
       LIMIT 1`;
  const statement = db.prepare(query);
  return (asOfDate ? statement.bind(asOfDate) : statement).first<ReadinessRow>();
}

async function loadSnapshots(db: D1Database, asOfDate: string): Promise<{ quotes: EtfSnapshot[]; indices: IndexSnapshot[] }> {
  const [etfs, indices] = await Promise.all([
    db
      .prepare(
        `SELECT as_of_date, ticker, etf_name, close_value, change_pct, trade_value, aum_value, risk_type, asset_class, is_general_etf, asset_detail, nav_value, disparity_pct
         FROM briefing_etf_daily
         WHERE as_of_date = ?`,
      )
      .bind(asOfDate)
      .all<EtfSnapshot>(),
    db
      .prepare(
        `SELECT as_of_date, index_code, index_name, close_value, change_points, change_pct, volume_value
         FROM market_index_daily
         WHERE as_of_date = ?
         ORDER BY index_code ASC`,
      )
      .bind(asOfDate)
      .all<IndexSnapshot>(),
  ]);
  const quotes = (etfs.results ?? []).map((q) => {
    const tax = ETF_TAXONOMY_MAP[q.ticker];
    return {
      ...q,
      asset_class: tax?.assetClass || q.asset_class,
      asset_detail: tax?.peerGroup || q.asset_detail,
    };
  });
  return { quotes, indices: indices.results ?? [] };
}

async function publishSnapshot(
  db: D1Database,
  publicationRunId: string,
  readiness: ReadinessRow,
  quotes: EtfSnapshot[],
  indices: IndexSnapshot[],
  flatThreshold: number,
): Promise<void> {
  const pulse = calculatePulse(quotes, flatThreshold);
  if (quotes.length !== readiness.etf_row_count) throw new Error("ETF snapshot row count does not match the ready hand-off");
  if (pulse.generalEtfCount !== readiness.general_etf_count) throw new Error("General ETF count does not match the ready hand-off");
  if (Math.abs(pulse.aumCoveragePct - readiness.aum_coverage_pct) > 0.000001) throw new Error("AUM coverage does not match the ready hand-off");
  if (!indices.some((index) => index.index_code === "KOSPI") || !indices.some((index) => index.index_code === "KOSDAQ")) {
    throw new Error("Validated snapshot does not contain both KOSPI and KOSDAQ");
  }
  if (readiness.etf_as_of_date !== readiness.as_of_date || readiness.kospi_as_of_date !== readiness.as_of_date || readiness.kosdaq_as_of_date !== readiness.as_of_date) {
    throw new Error("Readiness row has unaligned source dates");
  }

  const aumWeightedReturns = calculateAumWeightedReturns(quotes);
  const valuesByScope = new Map(aumWeightedReturns.map((item) => [item.scope, item]));
  const all = valuesByScope.get("all");
  const top50 = valuesByScope.get("top_50");
  const top100 = valuesByScope.get("top_100");
  const top200 = valuesByScope.get("top_200");
  if (!all || !top50 || !top100 || !top200) throw new Error("AUM-weighted return scopes are incomplete");

  const kospi = indices.find((index) => index.index_code === "KOSPI")!;
  const kosdaq = indices.find((index) => index.index_code === "KOSDAQ")!;
  const assetClasses = calculateAssetClasses(quotes, flatThreshold);
  const focusEtfs = quotes
    .filter((quote) => quote.is_general_etf === 1)
    .sort((left, right) => right.trade_value - left.trade_value)
    .slice(0, 3);
  const previous = await db.prepare(`SELECT as_of_date FROM market_briefings ORDER BY as_of_date DESC LIMIT 1`).first<{ as_of_date: string }>();
    const previousQuotes = previous ? await db.prepare("SELECT * FROM briefing_etf_daily WHERE as_of_date = ?").bind(previous.as_of_date).all() : { results: [] };
    const peerGroups = calculatePeerGroups(quotes);
    const fundFlow = calculateFundFlow(quotes, previousQuotes.results || []);
    const disparityWarning = calculateDisparityWarning(quotes);
    const periodicFlows = await calculatePeriodicFundFlows(db, quotes, readiness.as_of_date);
    const marketScale = calculateMarketScale(quotes);
    const marketScaleTimeSeries = await calculateMarketScaleTimeSeries(db, readiness.as_of_date);

    const publishedAt = nowIso();
    const metrics = {
    market_indices: indices.map((index) => ({
      code: index.index_code,
      label: index.index_name,
      close: index.close_value,
      change_points: index.change_points,
      change_pct: index.change_pct,
      as_of_date: index.as_of_date,
    })),
    etf_pulse: {
      general_etf_count: pulse.generalEtfCount,
      up_count: pulse.upCount,
      flat_count: pulse.flatCount,
      down_count: pulse.downCount,
      breadth_ratio_pct: pulse.breadthRatioPct,
      market_temperature: pulse.marketTemperature,
      general_aum_weighted_return_pct: all.weightedReturnPct,
      top50_aum_weighted_return_pct: top50.weightedReturnPct,
      top100_aum_weighted_return_pct: top100.weightedReturnPct,
      top200_aum_weighted_return_pct: top200.weightedReturnPct,
      aum_weighted_returns: aumWeightedReturns.map((item) => ({
        scope: item.scope,
        label: item.label,
        constituent_count: item.constituentCount,
        total_aum: item.totalAum,
        aum_coverage_pct: item.aumCoveragePct,
        weighted_return_pct: item.weightedReturnPct,
      })),
      general_total_aum: pulse.generalTotalAum,
      general_total_trade_value: pulse.generalTotalTradeValue,
      top10_trade_share_pct: pulse.top10TradeSharePct,
      all_top10_trade_share_pct: pulse.allTop10TradeSharePct,
      aum_coverage_pct: pulse.aumCoveragePct,
    },
    peer_groups: peerGroups,
    peer_group_version: "v1",
    fund_flow: fundFlow,
    disparity_warning: disparityWarning,
    weekly_fund_flows: periodicFlows.weeklyFundFlows,
    monthly_fund_flows: periodicFlows.monthlyFundFlows,
    market_scale: marketScale,
    market_scale_time_series: marketScaleTimeSeries,
  };
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO market_briefings (
          as_of_date, calculation_version, source_run_id, previous_ready_date,
          kospi_close, kospi_change_pct, kosdaq_close, kosdaq_change_pct,
          general_aum_weighted_return_pct, top50_aum_weighted_return_pct, top100_aum_weighted_return_pct, top200_aum_weighted_return_pct,
          general_etf_count, up_count, flat_count, down_count, breadth_ratio_pct, market_temperature,
          general_total_aum, general_total_trade_value, top10_trade_share_pct, all_top10_trade_share_pct,
          headline_text, headline_generation_status, metrics_json, source_dates_json, validation_json, published_at
        ) VALUES (?, 'v1', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'validated', ?, ?, ?, ?)`,
      )
      .bind(
        readiness.as_of_date, readiness.source_run_id, previous?.as_of_date ?? null,
        kospi.close_value, kospi.change_pct, kosdaq.close_value, kosdaq.change_pct,
        all.weightedReturnPct, top50.weightedReturnPct, top100.weightedReturnPct, top200.weightedReturnPct,
        pulse.generalEtfCount, pulse.upCount, pulse.flatCount, pulse.downCount, pulse.breadthRatioPct, pulse.marketTemperature,
        pulse.generalTotalAum, pulse.generalTotalTradeValue, pulse.top10TradeSharePct, pulse.allTop10TradeSharePct,
        buildHeadline(pulse, indices), asJson(metrics),
        asJson({ etf: readiness.etf_as_of_date, kospi: readiness.kospi_as_of_date, kosdaq: readiness.kosdaq_as_of_date }),
        asJson({ readiness: JSON.parse(readiness.validation_json), aum_coverage_pct: pulse.aumCoveragePct, flat_threshold_pct: flatThreshold, publication_run_id: publicationRunId }),
        publishedAt,
      ),
    db.prepare(`DELETE FROM market_briefing_asset_classes WHERE as_of_date = ?`).bind(readiness.as_of_date),
    db.prepare(`DELETE FROM market_briefing_focus_etfs WHERE as_of_date = ?`).bind(readiness.as_of_date),
    ...assetClasses.map((row) => db
      .prepare(
        `INSERT INTO market_briefing_asset_classes (
          as_of_date, asset_class, etf_count, up_count, flat_count, down_count,
          breadth_ratio_pct, aum_weighted_return_pct, total_aum, aum_share_pct, total_trade_value, trade_share_pct
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(readiness.as_of_date, row.assetClass, row.etfCount, row.upCount, row.flatCount, row.downCount, row.breadthRatioPct, row.aumWeightedReturnPct, row.totalAum, row.aumSharePct, row.totalTradeValue, row.tradeSharePct)),
    ...focusEtfs.map((quote, index) => db
      .prepare(
        `INSERT INTO market_briefing_focus_etfs (
          as_of_date, rank_no, ticker, etf_name, asset_class, close_value, change_pct, trade_value, trade_share_pct
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(readiness.as_of_date, index + 1, quote.ticker, quote.etf_name, quote.asset_class, quote.close_value, quote.change_pct, quote.trade_value, pulse.generalTotalTradeValue === 0 ? 0 : (quote.trade_value / pulse.generalTotalTradeValue) * 100)),
  ];
  await db.batch(statements);
}

async function publishReadyBriefing(env: Env, triggerType: "scheduled" | "manual", slot: ScheduleSlot, requestedAsOfDate?: string): Promise<{ status: PublicationStatus; publicationRunId: string; asOfDate?: string }> {
  const publicationRunId = crypto.randomUUID();
  await env.ETF_PRICES
    .prepare(`INSERT INTO briefing_publication_runs (publication_run_id, trigger_type, schedule_slot, target_date, status, started_at) VALUES (?, ?, ?, ?, 'queued', ?)`)
    .bind(publicationRunId, triggerType, slot, kstDate(), nowIso())
    .run();

  const locked = await acquirePublicationLock(env.ETF_PRICES, publicationRunId);
  if (!locked) {
    await updatePublicationRun(env.ETF_PRICES, publicationRunId, "skipped_locked", { finished_at: nowIso() });
    return { status: "skipped_locked", publicationRunId };
  }

  try {
    const readiness = await getUnpublishedReadiness(env.ETF_PRICES, requestedAsOfDate);
    if (!readiness) {
      await updatePublicationRun(env.ETF_PRICES, publicationRunId, "skipped_no_new_data", { finished_at: nowIso() });
      return { status: "skipped_no_new_data", publicationRunId };
    }
    await updatePublicationRun(env.ETF_PRICES, publicationRunId, "publishing", {
      source_as_of_date: readiness.as_of_date,
      source_run_id: readiness.source_run_id,
    });

    const existing = await env.ETF_PRICES
      .prepare(`SELECT as_of_date FROM market_briefings WHERE as_of_date = ?`)
      .bind(readiness.as_of_date)
      .first<{ as_of_date: string }>();
    if (existing) {
      await updatePublicationRun(env.ETF_PRICES, publicationRunId, "skipped_no_new_data", { finished_at: nowIso() });
      return { status: "skipped_no_new_data", publicationRunId, asOfDate: readiness.as_of_date };
    }

    const { quotes, indices } = await loadSnapshots(env.ETF_PRICES, readiness.as_of_date);
    await publishSnapshot(env.ETF_PRICES, publicationRunId, readiness, quotes, indices, Number(env.FLAT_THRESHOLD_PCT || "0.01"));
    try {
      await warmLatestBriefingCache(env, readiness.as_of_date);
    } catch (cacheError) {
      console.warn(JSON.stringify({ publicationRunId, asOfDate: readiness.as_of_date, event: "kv_warm_failed", message: String(cacheError) }));
    }
    await updatePublicationRun(env.ETF_PRICES, publicationRunId, "ready", { finished_at: nowIso() });

    if (env.DISTRIBUTION_QUEUE) {
      try {
        await env.DISTRIBUTION_QUEUE.send({
          event_id: crypto.randomUUID(),
          as_of_date: readiness.as_of_date,
          publication_version: 1,
          trigger_type: "queue",
        });
        console.log(JSON.stringify({ publicationRunId, asOfDate: readiness.as_of_date, event: "distribution_queue_dispatched" }));
      } catch (distErr) {
        console.warn(JSON.stringify({ publicationRunId, asOfDate: readiness.as_of_date, event: "distribution_queue_failed", message: String(distErr) }));
      }
    }

    return { status: "ready", publicationRunId, asOfDate: readiness.as_of_date };
  } catch (error) {
    await updatePublicationRun(env.ETF_PRICES, publicationRunId, "failed", {
      error_code: "publication_failed",
      error_detail: String(error).slice(0, 1000),
      finished_at: nowIso(),
    });
    console.error(JSON.stringify({ publicationRunId, status: "failed", message: String(error) }));
    return { status: "failed", publicationRunId };
  } finally {
    await releasePublicationLock(env.ETF_PRICES, publicationRunId);
  }
}

async function recomputeAndSaveBriefing(env: Env, asOfDate: string): Promise<any> {
  const { quotes, indices } = await loadSnapshots(env.ETF_PRICES, asOfDate);
  if (!quotes.length) throw new Error(`No quotes found in briefing_etf_daily for ${asOfDate}`);

  // Fetch previous date quotes for fundFlow
  const prevDateRow = await env.ETF_PRICES
    .prepare(`SELECT DISTINCT as_of_date FROM briefing_etf_daily WHERE as_of_date < ? ORDER BY as_of_date DESC LIMIT 1`)
    .bind(asOfDate)
    .first<{ as_of_date: string }>();

  let previousQuotes: any[] = [];
  if (prevDateRow?.as_of_date) {
    const prevRes = await env.ETF_PRICES
      .prepare(`SELECT ticker, etf_name, aum_value, nav_value, is_general_etf FROM briefing_etf_daily WHERE as_of_date = ?`)
      .bind(prevDateRow.as_of_date)
      .all();
    previousQuotes = prevRes.results || [];
  }

  const flatThreshold = Number(env.FLAT_THRESHOLD_PCT || "0.01");
  const pulse = calculatePulse(quotes, flatThreshold);
  const aumWeightedReturns = calculateAumWeightedReturns(quotes);
  const assetClasses = calculateAssetClasses(quotes, flatThreshold);
  const peerGroups = calculatePeerGroups(quotes);
  const fundFlow = calculateFundFlow(quotes, previousQuotes);
  const disparityWarning = calculateDisparityWarning(quotes);
  const periodicFlows = await calculatePeriodicFundFlows(env.ETF_PRICES, quotes, asOfDate);
  const marketScale = calculateMarketScale(quotes);
  const marketScaleTimeSeries = await calculateMarketScaleTimeSeries(env.ETF_PRICES, asOfDate);

  const metrics = {
    pulse,
    aum_weighted_returns: aumWeightedReturns,
    asset_classes: assetClasses,
    peer_groups: peerGroups,
    fund_flow: fundFlow,
    disparity_warning: disparityWarning,
    weekly_fund_flows: periodicFlows.weeklyFundFlows,
    monthly_fund_flows: periodicFlows.monthlyFundFlows,
    market_scale: marketScale,
    market_scale_time_series: marketScaleTimeSeries,
  };

  const metricsJson = JSON.stringify(metrics);

  const focusEtfs = quotes
    .filter((q) => q.is_general_etf === 1)
    .sort((a, b) => (b.trade_value || 0) - (a.trade_value || 0))
    .slice(0, 3)
    .map((q, idx) => ({
      rank_no: idx + 1,
      ticker: q.ticker,
      etf_name: q.etf_name,
      asset_class: q.asset_class,
      close_value: q.close_value,
      change_pct: q.change_pct,
      trade_value: q.trade_value,
      trade_share_pct: pulse.generalTotalTradeValue === 0 ? 0 : Number((((q.trade_value || 0) / pulse.generalTotalTradeValue) * 100).toFixed(2)),
    }));

  const statements: any[] = [
    env.ETF_PRICES.prepare(`UPDATE market_briefings SET metrics_json = ?, updated_at = ? WHERE as_of_date = ?`).bind(metricsJson, nowIso(), asOfDate),
    env.ETF_PRICES.prepare(`DELETE FROM market_briefing_asset_classes WHERE as_of_date = ?`).bind(asOfDate),
    env.ETF_PRICES.prepare(`DELETE FROM market_briefing_focus_etfs WHERE as_of_date = ?`).bind(asOfDate),
    ...assetClasses.map((row) => env.ETF_PRICES
      .prepare(
        `INSERT INTO market_briefing_asset_classes (
          as_of_date, asset_class, etf_count, up_count, flat_count, down_count,
          breadth_ratio_pct, aum_weighted_return_pct, total_aum, aum_share_pct, total_trade_value, trade_share_pct
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(asOfDate, row.assetClass, row.etfCount, row.upCount, row.flatCount, row.downCount, row.breadthRatioPct, row.aumWeightedReturnPct, row.totalAum, row.aumSharePct, row.totalTradeValue, row.tradeSharePct)),
    ...focusEtfs.map((row) => env.ETF_PRICES
      .prepare(
        `INSERT INTO market_briefing_focus_etfs (
          as_of_date, rank_no, ticker, etf_name, asset_class, close_value, change_pct, trade_value, trade_share_pct
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(asOfDate, row.rank_no, row.ticker, row.etf_name, row.asset_class, row.close_value, row.change_pct, row.trade_value, row.trade_share_pct)),
  ];

  await env.ETF_PRICES.batch(statements);

  await warmLatestBriefingCache(env, asOfDate);

  if (env.DISTRIBUTION_QUEUE) {
    try {
      await env.DISTRIBUTION_QUEUE.send({
        event_id: crypto.randomUUID(),
        as_of_date: asOfDate,
        publication_version: 1,
        trigger_type: "manual",
      });
      console.log(JSON.stringify({ asOfDate, event: "distribution_queue_dispatched_from_recompute" }));
    } catch (distErr) {
      console.warn(JSON.stringify({ asOfDate, event: "distribution_queue_failed_from_recompute", message: String(distErr) }));
    }
  }

  return {
    asOfDate,
    peerGroupsCount: peerGroups.length,
    peerGroupsByClass: peerGroups.reduce((acc: any, p: any) => {
      acc[p.assetClass] = (acc[p.assetClass] || 0) + 1;
      return acc;
    }, {}),
    peerGroups: peerGroups.map((p: any) => `${p.assetClass}::${p.peerGroup} (${p.etfCount}개, ${p.cappedAumWeightedReturnPct}%)`),
    weeklyInflowsCount: periodicFlows.weeklyFundFlows.topInflows.length,
  };
}

export default {
  async queue(batch: MessageBatch<MarketSnapshotReadyEvent>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        const event = message.body;
        const materialized = await materializeMarketSnapshot(env.ETF_PRICES, event);
        const result = await publishReadyBriefing(env, "manual", "manual", event.as_of_date);
        if (result.status === "failed") {
          message.retry({ delaySeconds: Math.min(3600, 60 * 2 ** Math.min(message.attempts, 5)) });
          continue;
        }
        console.log(JSON.stringify({ event: "market_snapshot_consumed", eventId: event.event_id, asOfDate: event.as_of_date, materialized: materialized.status, publication: result.status }));
        message.ack();
      } catch (error) {
        console.error(JSON.stringify({ event: "market_snapshot_consume_failed", attempt: message.attempts, message: String(error) }));
        message.retry({ delaySeconds: Math.min(3600, 60 * 2 ** Math.min(message.attempts, 5)) });
      }
    }
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil((async () => {
      const result = await publishReadyBriefing(env, "scheduled", scheduleSlot(controller.scheduledTime));
      if (result.status === "failed") controller.noRetry();
    })());
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/internal/publish-date" || url.pathname === "/api/publish-date") {
      const targetDate = url.searchParams.get("date") || "2026-08-28";
      try {
        const manifest = await env.ETF_PRICES.prepare(
          `SELECT as_of_date, source_version FROM market_source_snapshot_manifest WHERE as_of_date = ? AND status = 'ready' ORDER BY ready_at DESC LIMIT 1`
        ).bind(targetDate).first<{ as_of_date: string; source_version: string }>();

        let matResult = null;
        if (manifest) {
          const event: MarketSnapshotReadyEvent = {
            event_id: `market_snapshot_ready:${manifest.as_of_date}:${manifest.source_version}:market_briefing`,
            event_type: "market_snapshot_ready",
            target_name: "market_briefing",
            as_of_date: manifest.as_of_date,
            source_version: manifest.source_version,
          };
          matResult = await materializeMarketSnapshot(env.ETF_PRICES, event);
        }

        const pubResult = await publishReadyBriefing(env, "manual", "manual", targetDate);
        return Response.json({ success: true, manifest, matResult, pubResult });
      } catch (err: any) {
        return Response.json({ success: false, error: String(err), stack: err.stack }, { status: 500 });
      }
    }
    if (url.pathname === "/internal/republish" || url.pathname === "/api/republish") {
      const targetDate = url.searchParams.get("date") || "2026-08-26";
      try {
        const result = await recomputeAndSaveBriefing(env, targetDate);
        return Response.json({ success: true, result });
      } catch (err) {
        return Response.json({ success: false, error: String(err) }, { status: 500 });
      }
    }
    if (request.method === "POST" && url.pathname === "/internal/publish") {
      const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
      if (!env.MANUAL_RUN_TOKEN || token !== env.MANUAL_RUN_TOKEN) return new Response("Unauthorized", { status: 401 });
      const result = await publishReadyBriefing(env, "manual", "manual");
      return Response.json(result, { status: result.status === "ready" ? 200 : 202 });
    }
    return new Response("Not Found", { status: 404 });
  },
};
