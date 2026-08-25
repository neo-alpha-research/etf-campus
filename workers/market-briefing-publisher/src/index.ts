import { warmLatestBriefingCache } from "./publication-cache";
import { materializeMarketSnapshot, type MarketSnapshotReadyEvent } from "./source-materializer";

export interface Env {
  ETF_PRICES: D1Database;
  BRIEFING_KV: KVNamespace;
  MANUAL_RUN_TOKEN?: string;
  FLAT_THRESHOLD_PCT: string;
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
  const groups = new Map<string, { assetClass: string, rows: any[] }>();
  for (const quote of quotes) {
    if (quote.is_general_etf !== 1) continue;
    const detail = quote.asset_detail?.trim();
    if (!detail) continue;
    const existing = groups.get(detail);
    if (existing) {
      existing.rows.push(quote);
    } else {
      groups.set(detail, { assetClass: quote.asset_class?.trim() || "미분류", rows: [quote] });
    }
  }
  
  const results = [];
  for (const [peerGroup, data] of groups.entries()) {
    const rows = data.rows;
    if (rows.length < 5) continue; // 최소 5개 이상
    
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
      peerGroup,
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

function calculateFundFlow(quotes: any[], previousQuotes: any[]): any {
  const prevMap = new Map(previousQuotes.map(q => [q.ticker, q]));
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
  return { quotes: etfs.results ?? [], indices: indices.results ?? [] };
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
    // Daily reconciliation is a safety net for a manually repaired D1 snapshot;
    // ordinary publication is driven by the Queue consumer above.
    ctx.waitUntil((async () => {
      const result = await publishReadyBriefing(env, "scheduled", scheduleSlot(controller.scheduledTime));
      if (result.status === "failed") controller.noRetry();
    })());
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/internal/publish") {
      const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
      if (!env.MANUAL_RUN_TOKEN || token !== env.MANUAL_RUN_TOKEN) return new Response("Unauthorized", { status: 401 });
      const result = await publishReadyBriefing(env, "manual", "manual");
      return Response.json(result, { status: result.status === "ready" ? 200 : 202 });
    }
    return new Response("Not Found", { status: 404 });
  },
};
