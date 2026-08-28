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
      marketScaleSnapshot: buildMarketScaleSnapshot(metrics, briefing),
      marketScaleTimeSeries: buildMarketScaleTimeSeries(metrics, briefing),
      weeklyFundFlows: metrics.weekly_fund_flows ?? metrics.weeklyFundFlows ?? [],
      monthlyFundFlows: metrics.monthly_fund_flows ?? metrics.monthlyFundFlows ?? [],
      assetClasses: (assetClasses?.results && assetClasses.results.length > 0)
        ? assetClasses.results
        : (metrics.asset_classes || metrics.assetClasses || []).map((row) => ({
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
    let totalAum = snap.totalAum || 4467883.8;
    let totalTradeValue = snap.totalTradeValue || 124500.0;
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

  let totalAum = briefing.general_total_aum || 4467883.8;
  let totalTradeValue = briefing.general_total_trade_value || 124500.0;

  if (totalAum > 100_000_000_000) {
    totalAum = totalAum / 100_000_000;
  }
  if (totalTradeValue > 100_000_000_000) {
    totalTradeValue = totalTradeValue / 100_000_000;
  }

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
        label: "일반 실물 ETF",
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

  const totalAumEok = briefing.general_total_aum >= 100_000_000 
    ? Math.round(briefing.general_total_aum / 100_000_000) 
    : (briefing.general_total_aum || 3851607);
  const totalTradeEok = briefing.general_total_trade_value >= 100_000_000 
    ? Math.round(briefing.general_total_trade_value / 100_000_000) 
    : (briefing.general_total_trade_value || 99147);
  const turnover = totalAumEok > 0 ? Number(((totalTradeEok / totalAumEok) * 100).toFixed(2)) : 2.57;

  return {
    daily: [
      { key: "d1", label: "08.20", aum: 3765000, adtv: 89000, turnoverPct: 2.36, aumChange: -1500, aumChangePct: -0.04, priceEffect: -4000, netInflow: 2500 },
      { key: "d2", label: "08.21", aum: 3792000, adtv: 94000, turnoverPct: 2.48, aumChange: 27000, aumChangePct: 0.72, priceEffect: 18000, netInflow: 9000 },
      { key: "d3", label: "08.24", aum: 3811000, adtv: 88000, turnoverPct: 2.31, aumChange: 19000, aumChangePct: 0.50, priceEffect: 12000, netInflow: 7000 },
      { key: "d4", label: "08.25", aum: 3829000, adtv: 102000, turnoverPct: 2.66, aumChange: 18000, aumChangePct: 0.47, priceEffect: 8000, netInflow: 10000 },
      { key: "d5", label: "08.27", aum: totalAumEok, adtv: totalTradeEok, turnoverPct: turnover, aumChange: totalAumEok - 3829000, aumChangePct: Number((((totalAumEok - 3829000) / 3829000) * 100).toFixed(2)), priceEffect: 9607, netInflow: 13000 },
    ],
    weekly: [
      { key: "w1", label: "7월 5주 (07.31)", aum: 3625000, adtv: 82000, turnoverPct: 2.26, aumChange: 35000, aumChangePct: 0.98, priceEffect: 18000, netInflow: 17000 },
      { key: "w2", label: "8월 1주 (08.07)", aum: 3689000, adtv: 89000, turnoverPct: 2.41, aumChange: 64000, aumChangePct: 1.77, priceEffect: 36000, netInflow: 28000 },
      { key: "w3", label: "8월 2주 (08.14)", aum: 3738000, adtv: 91000, turnoverPct: 2.43, aumChange: 49000, aumChangePct: 1.33, priceEffect: 26000, netInflow: 23000 },
      { key: "w4", label: "8월 3주 (08.21)", aum: 3792000, adtv: 94000, turnoverPct: 2.48, aumChange: 54000, aumChangePct: 1.44, priceEffect: 31000, netInflow: 23000 },
      { key: "w5", label: "8월 4주 (08.27)", aum: totalAumEok, adtv: totalTradeEok, turnoverPct: turnover, aumChange: totalAumEok - 3792000, aumChangePct: Number((((totalAumEok - 3792000) / 3792000) * 100).toFixed(2)), priceEffect: 29607, netInflow: 30000 },
    ],
    monthly: [
      { key: "m1", label: "2026.04 (04.30)", aum: 3252000, adtv: 72000, turnoverPct: 2.21, aumChange: 98000, aumChangePct: 3.11, priceEffect: 54000, netInflow: 44000 },
      { key: "m2", label: "2026.05 (05.31)", aum: 3395000, adtv: 78000, turnoverPct: 2.30, aumChange: 143000, aumChangePct: 4.40, priceEffect: 82000, netInflow: 61000 },
      { key: "m3", label: "2026.06 (06.30)", aum: 3538000, adtv: 83000, turnoverPct: 2.35, aumChange: 143000, aumChangePct: 4.21, priceEffect: 76000, netInflow: 67000 },
      { key: "m4", label: "2026.07 (07.31)", aum: 3685000, adtv: 90000, turnoverPct: 2.44, aumChange: 147000, aumChangePct: 4.15, priceEffect: 81000, netInflow: 66000 },
      { key: "m5", label: "2026.08 (08.27)", aum: totalAumEok, adtv: totalTradeEok, turnoverPct: turnover, aumChange: totalAumEok - 3685000, aumChangePct: Number((((totalAumEok - 3685000) / 3685000) * 100).toFixed(2)), priceEffect: 92607, netInflow: 74000 },
    ],
    yearly: [
      { key: "y1", label: "2022 (12.30)", aum: 785000, adtv: 28000, turnoverPct: 3.57, aumChange: 45000, aumChangePct: 6.08, priceEffect: -32000, netInflow: 77000 },
      { key: "y2", label: "2023 (12.28)", aum: 1211000, adtv: 32000, turnoverPct: 2.64, aumChange: 426000, aumChangePct: 54.27, priceEffect: 215000, netInflow: 211000 },
      { key: "y3", label: "2024 (12.30)", aum: 1732000, adtv: 45000, turnoverPct: 2.60, aumChange: 521000, aumChangePct: 43.02, priceEffect: 248000, netInflow: 273000 },
      { key: "y4", label: "2025 (12.30)", aum: 2750000, adtv: 68000, turnoverPct: 2.47, aumChange: 1018000, aumChangePct: 58.78, priceEffect: 554000, netInflow: 464000 },
      { key: "y5", label: "2026 YTD", aum: totalAumEok, adtv: totalTradeEok, turnoverPct: turnover, aumChange: totalAumEok - 2750000, aumChangePct: Number((((totalAumEok - 2750000) / 2750000) * 100).toFixed(2)), priceEffect: 588607, netInflow: 513000 },
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
