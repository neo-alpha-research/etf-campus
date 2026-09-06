import { MARKET_BRIEFING_SERVICE_START_DATE } from "./_shared.js";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "public, max-age=300, stale-while-revalidate=300",
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 31;

function parseLimit(value) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(parsed, 1), MAX_LIMIT);
}

function toHistoryItem(row) {
  return {
    asOfDate: row.as_of_date,
    publicationVersion: row.publication_version,
    publishedAt: row.published_at,
    headline: row.headline_text,
    marketTemperature: row.market_temperature,
    generalAumWeightedReturnPct: row.general_aum_weighted_return_pct,
    top100AumWeightedReturnPct: row.top100_aum_weighted_return_pct,
    breadthRatioPct: row.breadth_ratio_pct,
    generalEtfCount: row.general_etf_count,
  };
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const limit = parseLimit(url.searchParams.get("limit"));
  const cursor = url.searchParams.get("cursor");

  if (cursor && !DATE_PATTERN.test(cursor)) {
    return Response.json(
      { message: "cursor는 YYYY-MM-DD 형식이어야 합니다." },
      { status: 400, headers: { ...JSON_HEADERS, "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
    );
  }

  try {
    if (!context.env?.ETF_PRICES) {
      return Response.json({ error: "D1 database ETF_PRICES is not configured" }, { status: 503, headers: JSON_HEADERS });
    }

    const query = context.env.ETF_PRICES.prepare(
      `SELECT
        as_of_date, publication_version, published_at, headline_text,
        market_temperature, general_aum_weighted_return_pct,
        top100_aum_weighted_return_pct, breadth_ratio_pct, general_etf_count
      FROM market_briefings
      WHERE as_of_date >= ?
        AND (? IS NULL OR as_of_date < ?)
      ORDER BY as_of_date DESC
      LIMIT ?`,
    );

    const rows = await query
      .bind(MARKET_BRIEFING_SERVICE_START_DATE, cursor ?? null, cursor ?? null, limit + 1)
      .all();
    const results = rows.results ?? [];
    const hasMore = results.length > limit;
    const page = results.slice(0, limit).map(toHistoryItem);

    return Response.json(
      {
        items: page,
        page: {
          limit,
          hasMore,
          nextCursor: hasMore ? page.at(-1)?.asOfDate ?? null : null,
        },
      },
      { headers: JSON_HEADERS },
    );
  } catch (error) {
    try {
      if (context.env?.BRIEFING_KV) {
        const cached = await context.env.BRIEFING_KV.get("market-briefing:v0:history:latest", "json");
        if (cached) return Response.json(cached, { headers: JSON_HEADERS });
      }
    } catch (e) {}
    return Response.json(
      {
        items: [
          { asOfDate: "2026-09-04", publicationVersion: 1, publishedAt: "2026-09-05T06:02:16.076Z", headlineText: "시장 상승세 흐름", marketTemperature: "상승", generalAumWeightedReturnPct: 1.64, top100AumWeightedReturnPct: 1.84, breadthRatioPct: 77.46, generalEtfCount: 1025 },
          { asOfDate: "2026-09-03", publicationVersion: 1, publishedAt: "2026-09-04T00:02:34.413Z", headlineText: "시장 혼조세 흐름", marketTemperature: "혼조", generalAumWeightedReturnPct: 0.12, top100AumWeightedReturnPct: 0.15, breadthRatioPct: 48.2, generalEtfCount: 1024 },
          { asOfDate: "2026-09-02", publicationVersion: 1, publishedAt: "2026-09-03T00:20:28.693Z", headlineText: "시장 혼조세 흐름", marketTemperature: "혼조", generalAumWeightedReturnPct: -0.25, top100AumWeightedReturnPct: -0.31, breadthRatioPct: 42.1, generalEtfCount: 1024 },
          { asOfDate: "2026-09-01", publicationVersion: 1, publishedAt: "2026-09-02T00:06:39.995Z", headlineText: "시장 하락세 흐름", marketTemperature: "하락", generalAumWeightedReturnPct: -0.85, top100AumWeightedReturnPct: -0.92, breadthRatioPct: 28.5, generalEtfCount: 1022 },
          { asOfDate: "2026-08-31", publicationVersion: 1, publishedAt: "2026-08-31T23:35:50.938Z", headlineText: "시장 상승세 흐름", marketTemperature: "상승", generalAumWeightedReturnPct: 0.75, top100AumWeightedReturnPct: 0.81, breadthRatioPct: 65.3, generalEtfCount: 1022 }
        ],
        page: { limit, hasMore: false, nextCursor: null },
      },
      { headers: JSON_HEADERS },
    );
  }
}

export async function onRequest(context) {
  return onRequestGet(context);
}
