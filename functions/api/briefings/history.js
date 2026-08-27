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

  const query = context.env.ETF_PRICES.prepare(
    `SELECT
      as_of_date, publication_version, published_at, headline_text,
      market_temperature, general_aum_weighted_return_pct,
      top100_aum_weighted_return_pct, breadth_ratio_pct, general_etf_count
    FROM market_briefings
    WHERE (? IS NULL OR as_of_date < ?)
    ORDER BY as_of_date DESC
    LIMIT ?`,
  );

  const rows = await query
    .bind(cursor ?? null, cursor ?? null, limit + 1)
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
}
