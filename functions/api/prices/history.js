/**
 * Cloudflare Pages Function: GET /api/prices/history
 *
 * Query params:
 *   ticker  (string)  ETF ticker, 6 alphanumeric chars
 *   start   (string)  YYYY-MM-DD
 *   end     (string)  YYYY-MM-DD
 *
 * Binding: D1 database named ETF_PRICES
 */

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const ticker = url.searchParams.get("ticker")?.trim().toUpperCase();
  const start = url.searchParams.get("start")?.trim();
  const end = url.searchParams.get("end")?.trim();

  // Validate ticker (6 alphanumeric chars)
  if (!ticker || !/^[A-Z0-9]{6}$/.test(ticker)) {
    return json({ error: "invalid_ticker" }, 400);
  }

  // Validate dates
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!start || !end || !dateRe.test(start) || !dateRe.test(end)) {
    return json({ error: "invalid_date_format" }, 400);
  }

  const startDate = new Date(start);
  const endDate = new Date(end);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return json({ error: "invalid_date" }, 400);
  }
  if (startDate > endDate) {
    return json({ error: "start_after_end" }, 400);
  }

  // Max duration check: 5 years (approx 1826 days)
  const diffDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays > 1826) {
    return json({ error: "range_too_large" }, 400);
  }

  const db = env.ETF_PRICES;
  if (!db) {
    return json({ error: "database_not_configured" }, 503);
  }

  try {
    const { results } = await db.prepare(
      "SELECT date, close FROM etf_prices WHERE ticker = ? AND date >= ? AND date <= ? ORDER BY date ASC"
    ).bind(ticker, start, end).all();

    if (!results || results.length === 0) {
      return json({
        ticker,
        requestedStart: start,
        requestedEnd: end,
        actualStart: null,
        actualEnd: null,
        basis: "가격수익률",
        distributionIncluded: false,
        source: "금융위원회 증권상품시세정보 API 등",
        qualityStatus: "시장 종가 추이",
        points: []
      });
    }

    const firstClose = results[0].close;
    const points = results.map(row => {
      let returnPct = 0;
      if (firstClose > 0) {
        returnPct = ((row.close / firstClose) - 1) * 100;
      }
      return {
        date: row.date,
        close: row.close,
        returnPct: Math.round(returnPct * 100) / 100
      };
    });

    return json({
      ticker,
      requestedStart: start,
      requestedEnd: end,
      actualStart: results[0].date,
      actualEnd: results[results.length - 1].date,
      basis: "가격수익률",
      distributionIncluded: false,
      source: "금융위원회 증권상품시세정보 API 등",
      qualityStatus: "시장 종가 추이",
      points
    });

  } catch (err) {
    console.error("D1 query error:", err);
    return json({ error: "database_query_error" }, 500);
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
    },
  });
}
