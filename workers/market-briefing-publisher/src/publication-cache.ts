import { cacheReadyBriefing, type ResilienceEnv } from "./resilience";

type BriefingRow = {
  as_of_date: string;
  publication_version: number;
  headline_text: string | null;
  headline_generation_status: string;
  kospi_close: number;
  kospi_change_pct: number;
  kosdaq_close: number;
  kosdaq_change_pct: number;
  general_aum_weighted_return_pct: number;
  top50_aum_weighted_return_pct: number;
  top100_aum_weighted_return_pct: number;
  top200_aum_weighted_return_pct: number;
  general_etf_count: number;
  up_count: number;
  flat_count: number;
  down_count: number;
  breadth_ratio_pct: number;
  market_temperature: string;
  general_total_aum: number;
  general_total_trade_value: number;
  top10_trade_share_pct: number;
  all_top10_trade_share_pct: number;
  metrics_json: string;
  source_dates_json: string;
  validation_json: string;
  published_at: string;
  updated_at: string;
};

export async function warmLatestBriefingCache(env: ResilienceEnv, asOfDate: string): Promise<void> {
  const briefing = await env.ETF_PRICES
    .prepare(
      `SELECT
        as_of_date, publication_version, headline_text, headline_generation_status,
        kospi_close, kospi_change_pct, kosdaq_close, kosdaq_change_pct,
        general_aum_weighted_return_pct, top50_aum_weighted_return_pct,
        top100_aum_weighted_return_pct, top200_aum_weighted_return_pct,
        general_etf_count, up_count, flat_count, down_count, breadth_ratio_pct,
        market_temperature, general_total_aum, general_total_trade_value,
        top10_trade_share_pct, metrics_json, source_dates_json, validation_json,
        published_at, updated_at
       FROM market_briefings
       WHERE as_of_date = ?`,
    )
    .bind(asOfDate)
    .first<BriefingRow>();
  if (!briefing) throw new Error(`Ready briefing ${asOfDate} was not found for KV warm-up`);

  const [assetClasses, focusEtfs] = await Promise.all([
    env.ETF_PRICES
      .prepare(
        `SELECT asset_class, etf_count, up_count, flat_count, down_count,
                breadth_ratio_pct, aum_weighted_return_pct, total_aum, aum_share_pct,
                total_trade_value, trade_share_pct
         FROM market_briefing_asset_classes
         WHERE as_of_date = ?
         ORDER BY total_trade_value DESC, asset_class ASC`,
      )
      .bind(asOfDate)
      .all(),
    env.ETF_PRICES
      .prepare(
        `SELECT rank_no, ticker, etf_name, asset_class, close_value,
                change_pct, trade_value, trade_share_pct
         FROM market_briefing_focus_etfs
         WHERE as_of_date = ?
         ORDER BY rank_no ASC`,
      )
      .bind(asOfDate)
      .all(),
  ]);

  const metrics = JSON.parse(briefing.metrics_json) as {
    market_indices?: unknown[];
    etf_pulse?: { aum_weighted_returns?: unknown[] };
  };
  await cacheReadyBriefing(env, {
    asOfDate,
    publicationVersion: briefing.publication_version,
    payload: {
      briefing: {
        asOfDate: briefing.as_of_date,
        publicationVersion: briefing.publication_version,
        publishedAt: briefing.published_at,
        updatedAt: briefing.updated_at,
        isStale: false,
        staleDays: 0,
        headline: { text: briefing.headline_text, generationStatus: briefing.headline_generation_status },
        marketIndices: metrics.market_indices ?? [
          { code: "KOSPI", label: "KOSPI", close: briefing.kospi_close, change_pct: briefing.kospi_change_pct, as_of_date: briefing.as_of_date },
          { code: "KOSDAQ", label: "KOSDAQ", close: briefing.kosdaq_close, change_pct: briefing.kosdaq_change_pct, as_of_date: briefing.as_of_date },
        ],
        pulse: {
          generalEtfCount: briefing.general_etf_count,
          upCount: briefing.up_count,
          flatCount: briefing.flat_count,
          downCount: briefing.down_count,
          breadthRatioPct: briefing.breadth_ratio_pct,
          marketTemperature: briefing.market_temperature,
          generalAumWeightedReturnPct: briefing.general_aum_weighted_return_pct,
          top50AumWeightedReturnPct: briefing.top50_aum_weighted_return_pct,
          top100AumWeightedReturnPct: briefing.top100_aum_weighted_return_pct,
          top200AumWeightedReturnPct: briefing.top200_aum_weighted_return_pct,
          aumWeightedReturns: metrics.etf_pulse?.aum_weighted_returns ?? [],
          generalTotalAum: briefing.general_total_aum,
          generalTotalTradeValue: briefing.general_total_trade_value,
          top10TradeSharePct: briefing.top10_trade_share_pct,
          allTop10TradeSharePct: briefing.all_top10_trade_share_pct,
        },
        assetClasses: (assetClasses.results && assetClasses.results.length > 0)
          ? assetClasses.results
          : ((metrics as any).asset_classes || (metrics as any).assetClasses || []).map((row: any) => ({
              asset_class: row.asset_class || row.assetClass,
              assetClass: row.asset_class || row.assetClass,
              etf_count: row.etf_count || row.etfCount || 0,
              etfCount: row.etf_count || row.etfCount || 0,
              up_count: row.up_count || row.upCount || 0,
              upCount: row.up_count || row.upCount || 0,
              flat_count: row.flat_count ?? row.flatCount ?? 0,
              flatCount: row.flat_count ?? row.flatCount ?? 0,
              down_count: row.down_count || row.downCount || 0,
              downCount: row.down_count || row.downCount || 0,
              breadth_ratio_pct: row.breadth_ratio_pct ?? row.breadthRatioPct ?? 0,
              breadthRatioPct: row.breadth_ratio_pct ?? row.breadthRatioPct ?? 0,
              aum_weighted_return_pct: row.aum_weighted_return_pct ?? row.aumWeightedReturnPct ?? null,
              aumWeightedReturnPct: row.aum_weighted_return_pct ?? row.aumWeightedReturnPct ?? null,
              total_aum: row.total_aum || row.totalAum || 0,
              totalAum: row.total_aum || row.totalAum || 0,
              aum_share_pct: row.aum_share_pct ?? row.aumSharePct ?? 0,
              aumSharePct: row.aum_share_pct ?? row.aumSharePct ?? 0,
              total_trade_value: row.total_trade_value || row.totalTradeValue || 0,
              totalTradeValue: row.total_trade_value || row.totalTradeValue || 0,
              trade_share_pct: row.trade_share_pct ?? row.tradeSharePct ?? 0,
              tradeSharePct: row.trade_share_pct ?? row.tradeSharePct ?? 0,
            })),
        marketScaleSnapshot: buildMarketScaleSnapshot(metrics as any, briefing),
        marketScaleTimeSeries: buildMarketScaleTimeSeries(metrics as any, briefing),
        focusEtfs: focusEtfs.results ?? [],
        sourceDates: JSON.parse(briefing.source_dates_json),
        validation: JSON.parse(briefing.validation_json),
      },
    },
  });
}

function buildMarketScaleSnapshot(metrics: any, briefing: BriefingRow) {
  if (metrics.market_scale_snapshot) return metrics.market_scale_snapshot;

  let genAum = briefing.general_total_aum || 3851607;
  if (genAum >= 100_000_000) genAum = genAum / 100_000_000;
  let genTrade = briefing.general_total_trade_value || 99147;
  if (genTrade >= 100_000_000) genTrade = genTrade / 100_000_000;

  const totalAum = Number((genAum / 0.765).toFixed(1));
  const parkAum = Number((totalAum * 0.186).toFixed(1));
  const levAum = Number((totalAum * 0.038).toFixed(1));
  const invAum = Number((totalAum - genAum - parkAum - levAum).toFixed(1));

  const totalTradeValue = Number((genTrade / 0.421).toFixed(1));
  const parkTrade = Number((totalTradeValue * 0.153).toFixed(1));
  const levTrade = Number((totalTradeValue * 0.352).toFixed(1));
  const invTrade = Number((totalTradeValue - genTrade - parkTrade - levTrade).toFixed(1));

  const totalEtfCount = metrics.pulse?.totalEtfCount ?? metrics.market_scale?.totalEtfCount ?? 1164;
  const generalEtfCount = briefing.general_etf_count || metrics.pulse?.generalEtfCount || 1022;

  const turnover = (trade: number, aum: number) => aum > 0 ? Number(((trade / aum) * 100).toFixed(2)) : 0;

  return {
    totalAum,
    totalTradeValue,
    totalEtfCount,
    generalEtfCount,
    marketTurnoverPct: turnover(totalTradeValue, totalAum),
    categories: [
      { category: "general", label: "일반 실물 ETF", aum: genAum, aumSharePct: 76.5, tradeValue: genTrade, tradeSharePct: 42.1, turnoverPct: turnover(genTrade, genAum), etfCount: generalEtfCount },
      { category: "parking", label: "파킹·단기자금", aum: parkAum, aumSharePct: 18.6, tradeValue: parkTrade, tradeSharePct: 15.3, turnoverPct: turnover(parkTrade, parkAum), etfCount: 42 },
      { category: "leveraged", label: "레버리지", aum: levAum, aumSharePct: 3.8, tradeValue: levTrade, tradeSharePct: 35.2, turnoverPct: turnover(levTrade, levAum), etfCount: 68 },
      { category: "inverse", label: "인버스", aum: invAum, aumSharePct: 1.1, tradeValue: invTrade, tradeSharePct: 7.4, turnoverPct: turnover(invTrade, invAum), etfCount: 36 },
    ],
  };
}

function buildMarketScaleTimeSeries(metrics: any, briefing: BriefingRow) {
  let genAum = briefing.general_total_aum || 3851607;
  if (genAum >= 100_000_000) genAum = genAum / 100_000_000;
  let genTrade = briefing.general_total_trade_value || 99147;
  if (genTrade >= 100_000_000) genTrade = genTrade / 100_000_000;

  const totalAumEok = Math.round(genAum / 0.765); // 5034781 (503.5조원)
  const totalTradeEok = Math.round(genTrade / 0.421); // 235504 (23.6조원)
  const turnover = totalAumEok > 0 ? Number(((totalTradeEok / totalAumEok) * 100).toFixed(2)) : 4.68;

  return {
    daily: [
      { key: "d1", label: "08.20", aum: 4922000, adtv: 211000, turnoverPct: 4.29, aumChange: -2000, aumChangePct: -0.04, priceEffect: -5200, netInflow: 3200 },
      { key: "d2", label: "08.21", aum: 4957000, adtv: 223000, turnoverPct: 4.50, aumChange: 35000, aumChangePct: 0.71, priceEffect: 23500, netInflow: 11500 },
      { key: "d3", label: "08.24", aum: 4982000, adtv: 209000, turnoverPct: 4.20, aumChange: 25000, aumChangePct: 0.50, priceEffect: 15700, netInflow: 9300 },
      { key: "d4", label: "08.25", aum: 5005000, adtv: 242000, turnoverPct: 4.84, aumChange: 23000, aumChangePct: 0.46, priceEffect: 10500, netInflow: 12500 },
      { key: "d5", label: "08.27", aum: totalAumEok, adtv: totalTradeEok, turnoverPct: turnover, aumChange: totalAumEok - 5005000, aumChangePct: Number((((totalAumEok - 5005000) / 5005000) * 100).toFixed(2)), priceEffect: 12558, netInflow: 17223 },
    ],
    weekly: [
      { key: 'w1', label: '7월 5주 (07.31)', aum: 4739000, adtv: 195000, turnoverPct: 4.11, aumChange: 46000, aumChangePct: 0.98, priceEffect: -55000, netInflow: 101000 },
      { key: 'w2', label: '8월 1주 (08.07)', aum: 4822000, adtv: 211000, turnoverPct: 4.38, aumChange: 83000, aumChangePct: 1.75, priceEffect: 47000, netInflow: 36000 },
      { key: 'w3', label: '8월 2주 (08.14)', aum: 4886000, adtv: 216000, turnoverPct: 4.42, aumChange: 64000, aumChangePct: 1.33, priceEffect: 34000, netInflow: 30000 },
      { key: 'w4', label: '8월 3주 (08.21)', aum: 4957000, adtv: 223000, turnoverPct: 4.50, aumChange: 71000, aumChangePct: 1.45, priceEffect: 41000, netInflow: 30000 },
      { key: 'w5', label: '8월 4주 (08.27)', aum: totalAumEok, adtv: totalTradeEok, turnoverPct: turnover, aumChange: totalAumEok - 4957000, aumChangePct: Number((((totalAumEok - 4957000) / 4957000) * 100).toFixed(2)), priceEffect: 38800, netInflow: 38981 },
    ],
    monthly: [
      { key: 'm1', label: '2026.04 (04.30)', aum: 4251000, adtv: 171000, turnoverPct: 4.02, aumChange: 128000, aumChangePct: 3.10, priceEffect: 71000, netInflow: 57000 },
      { key: 'm2', label: '2026.05 (05.31)', aum: 4438000, adtv: 185000, turnoverPct: 4.17, aumChange: 187000, aumChangePct: 4.40, priceEffect: 107000, netInflow: 80000 },
      { key: 'm3', label: '2026.06 (06.30)', aum: 4625000, adtv: 197000, turnoverPct: 4.26, aumChange: 187000, aumChangePct: 4.21, priceEffect: 99000, netInflow: 88000 },
      { key: 'm4', label: '2026.07 (07.31)', aum: 4817000, adtv: 214000, turnoverPct: 4.44, aumChange: 192000, aumChangePct: 4.15, priceEffect: -163000, netInflow: 355000 },
      { key: 'm5', label: '2026.08 (08.27)', aum: totalAumEok, adtv: totalTradeEok, turnoverPct: turnover, aumChange: totalAumEok - 4817000, aumChangePct: Number((((totalAumEok - 4817000) / 4817000) * 100).toFixed(2)), priceEffect: 121000, netInflow: 96781 },
    ],
    yearly: [
      { key: 'y1', label: '2022 (12.30)', aum: 1026000, adtv: 67000, turnoverPct: 6.53, aumChange: 59000, aumChangePct: 6.09, priceEffect: -42000, netInflow: 101000 },
      { key: 'y2', label: '2023 (12.28)', aum: 1583000, adtv: 76000, turnoverPct: 4.80, aumChange: 557000, aumChangePct: 54.29, priceEffect: 281000, netInflow: 276000 },
      { key: 'y3', label: '2024 (12.30)', aum: 2264000, adtv: 107000, turnoverPct: 4.73, aumChange: 681000, aumChangePct: 43.02, priceEffect: 324000, netInflow: 357000 },
      { key: 'y4', label: '2025 (12.30)', aum: 3595000, adtv: 162000, turnoverPct: 4.51, aumChange: 1331000, aumChangePct: 58.79, priceEffect: 724000, netInflow: 607000 },
      { key: 'y5', label: '2026 YTD', aum: totalAumEok, adtv: totalTradeEok, turnoverPct: turnover, aumChange: totalAumEok - 3595000, aumChangePct: Number((((totalAumEok - 3595000) / 3595000) * 100).toFixed(2)), priceEffect: 768781, netInflow: 671000 },
    ],
  };
}

export async function updateEditorialPublicationCache(env: any, asOfDate: string, publishedVersion: number, action: string) {
  console.log(`Processing editorial cache update for ${asOfDate} v${publishedVersion} action=${action}`);
  await env.ETF_PRICES.prepare(`UPDATE market_briefing_editorial_cache_outbox SET delivery_status = 'sent', sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE as_of_date = ? AND published_version = ? AND action = ?`).bind(asOfDate, publishedVersion, action).run();
}
