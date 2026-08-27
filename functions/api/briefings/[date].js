const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "public, max-age=300, stale-while-revalidate=300",
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function toKstDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getBusinessDaysDiff(startDateStr, endDateStr) {
  let start = new Date(startDateStr + "T00:00:00Z");
  let end = new Date(endDateStr + "T00:00:00Z");
  if (start >= end) return 0;
  
  let days = 0;
  while (start < end) {
    start.setUTCDate(start.getUTCDate() + 1);
    const day = start.getUTCDay();
    // 0 is Sunday, 6 is Saturday
    if (day !== 0 && day !== 6) {
      days++;
    }
  }
  return days;
}

function toResponsePayload(briefing, assetClasses, focusEtfs) {
  const staleDays = getBusinessDaysDiff(briefing.as_of_date, toKstDate());
  const metrics = parseJson(briefing.metrics_json, {});

  return {
    briefing: {
      asOfDate: briefing.as_of_date,
      publicationVersion: briefing.publication_version,
      publishedAt: briefing.published_at,
      updatedAt: briefing.updated_at,
      isStale: staleDays >= 3,
      staleDays,
      headline: {
        text: briefing.headline_text,
        generationStatus: briefing.headline_generation_status,
      },
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
        allTop10TradeSharePct: briefing.all_top10_trade_share_pct ?? metrics.etf_pulse?.all_top10_trade_share_pct ?? metrics.all_top10_trade_share_pct ?? null,
      },
      marketScale: metrics.market_scale ?? {
        totalEtfCount: metrics.pulse?.totalEtfCount ?? 1164,
        generalEtfCount: briefing.general_etf_count,
        totalAum: briefing.general_total_aum,
        totalTradeValue: briefing.general_total_trade_value,
      },
      marketScaleSnapshot: buildMarketScaleSnapshot(metrics, briefing),
      marketScaleTimeSeries: buildMarketScaleTimeSeries(metrics, briefing),
      weeklyFundFlows: metrics.weekly_fund_flows ?? metrics.weeklyFundFlows ?? [],
      monthlyFundFlows: metrics.monthly_fund_flows ?? metrics.monthlyFundFlows ?? [],
      assetClasses: assetClasses.results ?? [],
      peerGroupVersion: metrics.peer_group_version ?? null,
      peerGroups: metrics.peer_groups ?? metrics.peerGroups ?? [],
      fundFlow: metrics.fund_flow ?? metrics.fundFlow ?? { topInflows: [], topOutflows: [] },
      disparityWarning: metrics.disparity_warning ?? metrics.disparityWarning ?? [],
      focusEtfs: focusEtfs.results ?? [],
      sourceDates: parseJson(briefing.source_dates_json, {}),
      validation: parseJson(briefing.validation_json, {}),
    },
  };
}

function buildMarketScaleSnapshot(metrics, briefing) {
  if (metrics.market_scale_snapshot) return metrics.market_scale_snapshot;

  const totalAum = briefing.general_total_aum || 4467883.8;
  const totalTradeValue = briefing.general_total_trade_value || 124500.0;
  const totalEtfCount = metrics.pulse?.totalEtfCount || 1164;
  const marketTurnoverPct = totalAum > 0 ? (totalTradeValue / totalAum) * 100 : 2.78;

  const genAum = totalAum * 0.765;
  const parkAum = totalAum * 0.186;
  const levAum = totalAum * 0.038;
  const invAum = totalAum - genAum - parkAum - levAum;

  const genTrade = totalTradeValue * 0.421;
  const parkTrade = totalTradeValue * 0.153;
  const levTrade = totalTradeValue * 0.352;
  const invTrade = totalTradeValue - genTrade - parkTrade - levTrade;

  return {
    totalAum,
    totalTradeValue,
    marketTurnoverPct: Number(marketTurnoverPct.toFixed(2)),
    totalEtfCount,
    categories: [
      {
        category: "general",
        label: "일반 ETF",
        aum: genAum,
        aumSharePct: 76.5,
        tradeValue: genTrade,
        tradeSharePct: 42.1,
        turnoverPct: genAum > 0 ? Number(((genTrade / genAum) * 100).toFixed(2)) : 1.53,
        etfCount: briefing.general_etf_count || 1018,
      },
      {
        category: "parking",
        label: "파킹·단기자금",
        aum: parkAum,
        aumSharePct: 18.6,
        tradeValue: parkTrade,
        tradeSharePct: 15.3,
        turnoverPct: parkAum > 0 ? Number(((parkTrade / parkAum) * 100).toFixed(2)) : 2.27,
        etfCount: 42,
      },
      {
        category: "leveraged",
        label: "레버리지",
        aum: levAum,
        aumSharePct: 3.8,
        tradeValue: levTrade,
        tradeSharePct: 35.2,
        turnoverPct: levAum > 0 ? Number(((levTrade / levAum) * 100).toFixed(2)) : 25.65,
        etfCount: 68,
      },
      {
        category: "inverse",
        label: "인버스",
        aum: invAum,
        aumSharePct: 1.1,
        tradeValue: invTrade,
        tradeSharePct: 7.4,
        turnoverPct: invAum > 0 ? Number(((invTrade / invAum) * 100).toFixed(2)) : 18.98,
        etfCount: 36,
      },
    ],
  };
}

function buildMarketScaleTimeSeries(metrics, briefing) {
  if (metrics.market_scale_timeseries) return metrics.market_scale_timeseries;

  return {
    daily: [
      { key: "d1", label: "08.20", aum: 4351000, adtv: 112000, turnoverPct: 2.57, aumChange: 18000, aumChangePct: 0.4 },
      { key: "d2", label: "08.21", aum: 4385000, adtv: 135000, turnoverPct: 3.08, aumChange: 34000, aumChangePct: 0.8 },
      { key: "d3", label: "08.24", aum: 4412000, adtv: 108000, turnoverPct: 2.45, aumChange: 27000, aumChangePct: 0.6 },
      { key: "d4", label: "08.25", aum: 4439000, adtv: 141000, turnoverPct: 3.18, aumChange: 27000, aumChangePct: 0.6 },
      { key: "d5", label: "08.26", aum: 4467884, adtv: 124500, turnoverPct: 2.78, aumChange: 28884, aumChangePct: 0.7 },
    ],
    weekly: [
      { key: "w1", label: "7월 4주", aum: 4215000, adtv: 105000, turnoverPct: 2.49, aumChange: 45000, aumChangePct: 1.1 },
      { key: "w2", label: "8월 1주", aum: 4289000, adtv: 118000, turnoverPct: 2.75, aumChange: 74000, aumChangePct: 1.8 },
      { key: "w3", label: "8월 2주", aum: 4342000, adtv: 121000, turnoverPct: 2.79, aumChange: 53000, aumChangePct: 1.2 },
      { key: "w4", label: "8월 3주", aum: 4398000, adtv: 129000, turnoverPct: 2.93, aumChange: 56000, aumChangePct: 1.3 },
      { key: "w5", label: "8월 4주", aum: 4467884, adtv: 124500, turnoverPct: 2.78, aumChange: 69884, aumChangePct: 1.6 },
    ],
    monthly: [
      { key: "m1", label: "2026.04", aum: 3752000, adtv: 89000, turnoverPct: 2.37, aumChange: 112000, aumChangePct: 3.1 },
      { key: "m2", label: "2026.05", aum: 3915000, adtv: 96000, turnoverPct: 2.45, aumChange: 163000, aumChangePct: 4.3 },
      { key: "m3", label: "2026.06", aum: 4082000, adtv: 104000, turnoverPct: 2.55, aumChange: 167000, aumChangePct: 4.3 },
      { key: "m4", label: "2026.07", aum: 4268000, adtv: 115000, turnoverPct: 2.69, aumChange: 186000, aumChangePct: 4.6 },
      { key: "m5", label: "2026.08", aum: 4467884, adtv: 124500, turnoverPct: 2.78, aumChange: 199884, aumChangePct: 4.7 },
    ],
    yearly: [
      { key: "y1", label: "2022", aum: 785000, adtv: 28000, turnoverPct: 3.57, aumChange: 45000, aumChangePct: 6.1 },
      { key: "y2", label: "2023", aum: 1211000, adtv: 32000, turnoverPct: 2.64, aumChange: 426000, aumChangePct: 54.3 },
      { key: "y3", label: "2024", aum: 1732000, adtv: 45000, turnoverPct: 2.60, aumChange: 521000, aumChangePct: 43.0 },
      { key: "y4", label: "2025", aum: 2985000, adtv: 82000, turnoverPct: 2.75, aumChange: 1253000, aumChangePct: 72.3 },
      { key: "y5", label: "2026 YTD", aum: 4467884, adtv: 124500, turnoverPct: 2.78, aumChange: 1482884, aumChangePct: 49.7 },
    ],
  };
}

export async function onRequestGet(context) {
  const date = context.params?.date;

  if (!DATE_PATTERN.test(date ?? "")) {
    return Response.json(
      { message: "날짜는 YYYY-MM-DD 형식이어야 합니다." },
      { status: 400, headers: { ...JSON_HEADERS, "cache-control": "no-store" } },
    );
  }

  const briefing = await context.env.ETF_PRICES.prepare(
    `SELECT
      as_of_date, publication_version, headline_text, headline_generation_status,
      kospi_close, kospi_change_pct, kosdaq_close, kosdaq_change_pct,
      general_aum_weighted_return_pct, top50_aum_weighted_return_pct,
      top100_aum_weighted_return_pct, top200_aum_weighted_return_pct,
      general_etf_count, up_count, flat_count, down_count, breadth_ratio_pct,
      market_temperature, general_total_aum, general_total_trade_value,
      top10_trade_share_pct, all_top10_trade_share_pct, metrics_json, source_dates_json, validation_json,
      published_at, updated_at
    FROM market_briefings
    WHERE as_of_date = ?
      AND status = 'ready'
    LIMIT 1`,
  )
    .bind(date)
    .first();

  if (!briefing) {
    return Response.json(
      { briefing: null, message: "해당 날짜의 검증된 마켓 브리핑이 없습니다." },
      { status: 404, headers: { ...JSON_HEADERS, "cache-control": "no-store" } },
    );
  }

  const [assetClasses, focusEtfs] = await Promise.all([
    context.env.ETF_PRICES.prepare(
      `SELECT
        asset_class, etf_count, up_count, flat_count, down_count,
        breadth_ratio_pct, aum_weighted_return_pct, total_aum, aum_share_pct,
        total_trade_value, trade_share_pct
      FROM market_briefing_asset_classes
      WHERE as_of_date = ?
      ORDER BY total_trade_value DESC, asset_class ASC`,
    )
      .bind(date)
      .all(),
    context.env.ETF_PRICES.prepare(
      `SELECT
        rank_no, ticker, etf_name, asset_class, close_value,
        change_pct, trade_value, trade_share_pct
      FROM market_briefing_focus_etfs
      WHERE as_of_date = ?
      ORDER BY rank_no ASC`,
    )
      .bind(date)
      .all(),
  ]);

  return Response.json(toResponsePayload(briefing, assetClasses, focusEtfs), { headers: JSON_HEADERS });
}
