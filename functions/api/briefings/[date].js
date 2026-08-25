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

function dateDiffInDays(olderDate, newerDate) {
  const older = Date.parse(`${olderDate}T00:00:00Z`);
  const newer = Date.parse(`${newerDate}T00:00:00Z`);
  return Math.max(0, Math.round((newer - older) / 86_400_000));
}

function toResponsePayload(briefing, assetClasses, focusEtfs) {
  const staleDays = dateDiffInDays(briefing.as_of_date, toKstDate());
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
      top10_trade_share_pct, metrics_json, source_dates_json, validation_json,
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
