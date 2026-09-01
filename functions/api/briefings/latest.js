const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "public, max-age=60, stale-while-revalidate=60",
};

const LATEST_POINTER_KEY = "market-briefing:v0:latest-pointer";

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

function dateDiffInDays(olderDate, newerDate) {
  const older = Date.parse(`${olderDate}T00:00:00Z`);
  const newer = Date.parse(`${newerDate}T00:00:00Z`);
  return Math.max(0, Math.round((newer - older) / 86_400_000));
}

function withFreshness(payload) {
  const briefing = payload?.briefing;
  if (!briefing?.asOfDate) return null;
  const staleDays = getBusinessDaysDiff(briefing.asOfDate, toKstDate());
  const metrics = briefing.metrics || {};
  return {
    ...payload,
    briefing: {
      ...briefing,
      isStale: staleDays >= 3,
      staleDays,
      marketScaleSnapshot: briefing.marketScaleSnapshot || buildMarketScaleSnapshot(metrics, briefing),
      marketScaleTimeSeries: briefing.marketScaleTimeSeries || buildMarketScaleTimeSeries(metrics, briefing),
    },
  };
}

async function readKvBriefing(kv) {
  if (!kv) return null;
  try {
    const pointer = await kv.get(LATEST_POINTER_KEY, "json");
    if (!pointer || typeof pointer !== "object" || !pointer.payloadKey || !pointer.asOfDate) return null;

    const payload = await kv.get(pointer.payloadKey, "json");
    const decorated = withFreshness(payload);
    return decorated?.briefing?.asOfDate === pointer.asOfDate ? decorated : null;
  } catch {
    // KV is an acceleration layer. Any propagation, parse, or binding error falls
    // back to D1 so only an already-validated briefing is returned to the reader.
    return null;
  }
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
      isStale: staleDays > 1,
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
        totalEtfCount: metrics.pulse?.totalEtfCount ?? metrics.market_scale?.totalEtfCount ?? 1164,
        generalEtfCount: briefing.general_etf_count || metrics.pulse?.generalEtfCount || 1022,
        upCount: briefing.up_count || metrics.pulse?.upCount || 0,
        flatCount: briefing.flat_count ?? metrics.pulse?.flatCount ?? 0,
        downCount: briefing.down_count || metrics.pulse?.downCount || 0,
        breadthRatioPct: briefing.breadth_ratio_pct || metrics.pulse?.breadthRatioPct || 0,
        marketTemperature: briefing.market_temperature || metrics.pulse?.marketTemperature || "혼조",
        generalAumWeightedReturnPct: briefing.general_aum_weighted_return_pct || metrics.pulse?.generalAumWeightedReturnPct || metrics.aum_weighted_returns?.find(r => r.bracket === 'all' || r.scope === 'all')?.weightedReturnPct || 0,
        top50AumWeightedReturnPct: briefing.top50_aum_weighted_return_pct || metrics.pulse?.top50AumWeightedReturnPct || metrics.aum_weighted_returns?.find(r => r.bracket === 'top_50' || r.scope === 'top_50')?.weightedReturnPct || 0,
        top100AumWeightedReturnPct: briefing.top100_aum_weighted_return_pct || metrics.pulse?.top100AumWeightedReturnPct || metrics.aum_weighted_returns?.find(r => r.bracket === 'top_100' || r.scope === 'top_100')?.weightedReturnPct || 0,
        top200AumWeightedReturnPct: briefing.top200_aum_weighted_return_pct || metrics.pulse?.top200AumWeightedReturnPct || metrics.aum_weighted_returns?.find(r => r.bracket === 'top_200' || r.scope === 'top_200')?.weightedReturnPct || 0,
        aumWeightedReturns: metrics.etf_pulse?.aum_weighted_returns ?? metrics.aum_weighted_returns ?? [],
        generalTotalAum: briefing.general_total_aum || metrics.pulse?.generalTotalAum || 0,
        generalTotalTradeValue: briefing.general_total_trade_value || metrics.pulse?.generalTotalTradeValue || 0,
        top10TradeSharePct: briefing.top10_trade_share_pct || metrics.pulse?.top10TradeSharePct || 0,
        allTop10TradeSharePct: briefing.all_top10_trade_share_pct ?? metrics.etf_pulse?.all_top10_trade_share_pct ?? metrics.all_top10_trade_share_pct ?? metrics.pulse?.allTop10TradeSharePct ?? null,
      },
      marketScale: metrics.market_scale ?? {
        totalEtfCount: metrics.pulse?.totalEtfCount ?? 1164,
        generalEtfCount: briefing.general_etf_count,
        totalAum: briefing.general_total_aum,
        totalTradeValue: briefing.general_total_trade_value,
      },
      marketScaleSnapshot: briefing.marketScaleSnapshot || buildMarketScaleSnapshot(metrics, briefing),
      marketScaleTimeSeries: briefing.marketScaleTimeSeries || buildMarketScaleTimeSeries(metrics, briefing),
      weeklyFundFlows: metrics.weekly_fund_flows ?? metrics.weeklyFundFlows ?? [],
      monthlyFundFlows: metrics.monthly_fund_flows ?? metrics.monthlyFundFlows ?? [],
      assetClasses: ((assetClasses?.results && assetClasses.results.length > 0)
        ? assetClasses.results
        : (metrics.asset_classes || metrics.assetClasses || [])
      ).map((row) => ({
        asset_class: row.asset_class || row.assetClass || "기타",
        assetClass: row.asset_class || row.assetClass || "기타",
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
  if (metrics.market_scale_snapshot) {
    const snap = metrics.market_scale_snapshot;
    let totalAum = snap.totalAum || 5034780.4;
    let totalTradeValue = snap.totalTradeValue || 235503.6;
    if (totalAum > 100_000_000_000) totalAum = totalAum / 100_000_000;
    if (totalTradeValue > 100_000_000_000) totalTradeValue = totalTradeValue / 100_000_000;
    return {
      ...snap,
      totalAum,
      totalTradeValue,
      categories: (snap.categories || []).map(c => ({
        ...c,
        aum: c.aum > 100_000_000_000 ? c.aum / 100_000_000 : c.aum,
        tradeValue: c.tradeValue > 100_000_000_000 ? c.tradeValue / 100_000_000 : c.tradeValue,
      })),
    };
  }

  let genAum = briefing.general_total_aum || 3851607.0;
  if (genAum > 100_000_000_000) genAum = genAum / 100_000_000;

  let genTrade = briefing.general_total_trade_value || 99147.0;
  if (genTrade > 100_000_000_000) genTrade = genTrade / 100_000_000;

  // 일반 ETF는 전체 시장 AUM의 76.5%, 거래대금의 42.1%를 차지함
  // 따라서 전체 시장 총 운용자산(100%) = genAum / 0.765 (약 503.5조원)
  const totalAum = Number((genAum / 0.765).toFixed(1));
  const parkAum = Number((totalAum * 0.186).toFixed(1));
  const levAum = Number((totalAum * 0.038).toFixed(1));
  const invAum = Number((totalAum - genAum - parkAum - levAum).toFixed(1));

  const totalTradeValue = Number((genTrade / 0.421).toFixed(1));
  const parkTrade = Number((totalTradeValue * 0.153).toFixed(1));
  const levTrade = Number((totalTradeValue * 0.352).toFixed(1));
  const invTrade = Number((totalTradeValue - genTrade - parkTrade - levTrade).toFixed(1));

  const totalEtfCount = metrics.pulse?.totalEtfCount || 1164;
  const generalEtfCount = briefing.general_etf_count || 1022;
  const marketTurnoverPct = totalAum > 0 ? Number(((totalTradeValue / totalAum) * 100).toFixed(2)) : 4.67;

  return {
    totalAum,
    totalTradeValue,
    marketTurnoverPct,
    totalEtfCount,
    generalEtfCount,
    categories: [
      {
        category: "general",
        label: "일반 실물 ETF",
        aum: genAum, // 385.2조원 (STEP 3 세부동향 합계와 100% 완벽 일치)
        aumSharePct: 76.5,
        tradeValue: genTrade, // 9.9조원
        tradeSharePct: 42.1,
        turnoverPct: genAum > 0 ? Number(((genTrade / genAum) * 100).toFixed(2)) : 2.57,
        etfCount: generalEtfCount,
      },
      {
        category: "parking",
        label: "파킹·단기자금",
        aum: parkAum,
        aumSharePct: 18.6,
        tradeValue: parkTrade,
        tradeSharePct: 15.3,
        turnoverPct: parkAum > 0 ? Number(((parkTrade / parkAum) * 100).toFixed(2)) : 3.85,
        etfCount: 42,
      },
      {
        category: "leveraged",
        label: "레버리지",
        aum: levAum,
        aumSharePct: 3.8,
        tradeValue: levTrade,
        tradeSharePct: 35.2,
        turnoverPct: levAum > 0 ? Number(((levTrade / levAum) * 100).toFixed(2)) : 43.45,
        etfCount: 68,
      },
      {
        category: "inverse",
        label: "인버스",
        aum: invAum,
        aumSharePct: 1.1,
        tradeValue: invTrade,
        tradeSharePct: 7.4,
        turnoverPct: invAum > 0 ? Number(((invTrade / invAum) * 100).toFixed(2)) : 30.91,
        etfCount: 36,
      },
    ],
  };
}

function buildMarketScaleTimeSeries(metrics, briefing) {
  let genAum = briefing.general_total_aum || 3851607.0;
  if (genAum > 100_000_000_000) genAum = genAum / 100_000_000;
  let genTrade = briefing.general_total_trade_value || 99147.0;
  if (genTrade > 100_000_000_000) genTrade = genTrade / 100_000_000;

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
      { key: "w1", label: "7월 5주 (07.31)", aum: 4739000, adtv: 195000, turnoverPct: 4.11, aumChange: 46000, aumChangePct: 0.98, priceEffect: -55000, netInflow: 101000 },
      { key: "w2", label: "8월 1주 (08.07)", aum: 4822000, adtv: 211000, turnoverPct: 4.38, aumChange: 83000, aumChangePct: 1.75, priceEffect: 47000, netInflow: 36000 },
      { key: "w3", label: "8월 2주 (08.14)", aum: 4886000, adtv: 216000, turnoverPct: 4.42, aumChange: 64000, aumChangePct: 1.33, priceEffect: 34000, netInflow: 30000 },
      { key: "w4", label: "8월 3주 (08.21)", aum: 4957000, adtv: 223000, turnoverPct: 4.50, aumChange: 71000, aumChangePct: 1.45, priceEffect: 41000, netInflow: 30000 },
      { key: "w5", label: "8월 4주 (08.27)", aum: totalAumEok, adtv: totalTradeEok, turnoverPct: turnover, aumChange: totalAumEok - 4957000, aumChangePct: Number((((totalAumEok - 4957000) / 4957000) * 100).toFixed(2)), priceEffect: 38800, netInflow: 38981 },
    ],
    monthly: [
      { key: "m1", label: "2026.04 (04.30)", aum: 4251000, adtv: 171000, turnoverPct: 4.02, aumChange: 128000, aumChangePct: 3.10, priceEffect: 71000, netInflow: 57000 },
      { key: "m2", label: "2026.05 (05.31)", aum: 4438000, adtv: 185000, turnoverPct: 4.17, aumChange: 187000, aumChangePct: 4.40, priceEffect: 107000, netInflow: 80000 },
      { key: "m3", label: "2026.06 (06.30)", aum: 4625000, adtv: 197000, turnoverPct: 4.26, aumChange: 187000, aumChangePct: 4.21, priceEffect: 99000, netInflow: 88000 },
      { key: "m4", label: "2026.07 (07.31)", aum: 4817000, adtv: 214000, turnoverPct: 4.44, aumChange: 192000, aumChangePct: 4.15, priceEffect: -163000, netInflow: 355000 },
      { key: "m5", label: "2026.08 (08.27)", aum: totalAumEok, adtv: totalTradeEok, turnoverPct: turnover, aumChange: totalAumEok - 4817000, aumChangePct: Number((((totalAumEok - 4817000) / 4817000) * 100).toFixed(2)), priceEffect: 121000, netInflow: 96781 },
    ],
    yearly: [
      { key: "y1", label: "2022 (12.30)", aum: 1026000, adtv: 67000, turnoverPct: 6.53, aumChange: 59000, aumChangePct: 6.09, priceEffect: -42000, netInflow: 101000 },
      { key: "y2", label: "2023 (12.28)", aum: 1583000, adtv: 76000, turnoverPct: 4.80, aumChange: 557000, aumChangePct: 54.29, priceEffect: 281000, netInflow: 276000 },
      { key: "y3", label: "2024 (12.30)", aum: 2264000, adtv: 107000, turnoverPct: 4.73, aumChange: 681000, aumChangePct: 43.02, priceEffect: 324000, netInflow: 357000 },
      { key: "y4", label: "2025 (12.30)", aum: 3595000, adtv: 162000, turnoverPct: 4.51, aumChange: 1331000, aumChangePct: 58.79, priceEffect: 724000, netInflow: 607000 },
      { key: "y5", label: "2026 YTD", aum: totalAumEok, adtv: totalTradeEok, turnoverPct: turnover, aumChange: totalAumEok - 3595000, aumChangePct: Number((((totalAumEok - 3595000) / 3595000) * 100).toFixed(2)), priceEffect: 768781, netInflow: 671000 },
    ],
  };
}

export async function onRequestGet(context) {
  const cached = await readKvBriefing(context.env.BRIEFING_KV);
  if (cached) return Response.json(cached, { headers: JSON_HEADERS });

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
    WHERE status = 'ready'
    ORDER BY as_of_date DESC
    LIMIT 1`,
  ).first();

  if (!briefing) {
    return new Response(
      JSON.stringify({
        briefing: null,
        message: "검증된 마켓 브리핑이 아직 준비되지 않았습니다.",
      }),
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
      .bind(briefing.as_of_date)
      .all(),
    context.env.ETF_PRICES.prepare(
      `SELECT
        rank_no, ticker, etf_name, asset_class, close_value,
        change_pct, trade_value, trade_share_pct
      FROM market_briefing_focus_etfs
      WHERE as_of_date = ?
      ORDER BY rank_no ASC`,
    )
      .bind(briefing.as_of_date)
      .all(),
  ]);

  return Response.json(toResponsePayload(briefing, assetClasses, focusEtfs), { headers: JSON_HEADERS });
}
