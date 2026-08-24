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
  return {
    ...payload,
    briefing: {
      ...briefing,
      isStale: staleDays > 1,
      staleDays,
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
      top10_trade_share_pct, metrics_json, source_dates_json, validation_json,
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
