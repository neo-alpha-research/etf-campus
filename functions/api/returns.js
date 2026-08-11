/**
 * Cloudflare Pages Function: GET /api/returns
 *
 * Query params:
 *   ticker  (string)  ETF ticker, e.g. "069500"
 *   start   (string)  YYYY-MM-DD
 *   end     (string)  YYYY-MM-DD
 *
 * Binding: D1 database named ETF_PRICES
 */

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const ticker = url.searchParams.get("ticker")?.trim();
  const start  = url.searchParams.get("start")?.trim();
  const end    = url.searchParams.get("end")?.trim();

  if (!ticker || !start || !end)
    return json({ error: "ticker, start, end are required" }, 400);

  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRe.test(start) || !dateRe.test(end))
    return json({ error: "Dates must be YYYY-MM-DD" }, 400);

  if (start >= end)
    return json({ error: "start must be before end" }, 400);

  const db = env.ETF_PRICES;
  if (!db)
    return json({ error: "D1 binding ETF_PRICES not configured" }, 503);

  try {
    // Nearest close on or before start (handles pre-listing: falls back to IPO date)
    const startRow = await db
      .prepare("SELECT date, close FROM etf_prices WHERE ticker = ? AND date <= ? ORDER BY date DESC LIMIT 1")
      .bind(ticker, start).first();

    // Nearest close on or before end
    const endRow = await db
      .prepare("SELECT date, close FROM etf_prices WHERE ticker = ? AND date <= ? ORDER BY date DESC LIMIT 1")
      .bind(ticker, end).first();

    if (!startRow || !endRow)
      return json({ ticker, start, end, return: null, reason: "데이터 없음" }, 200);

    const ret = ((endRow.close / startRow.close) - 1) * 100;
    return json({
      ticker,
      start,
      end,
      startClose: startRow.close,
      endClose: endRow.close,
      return: Math.round(ret * 100) / 100,
      actualStart: startRow.date,
      actualEnd: endRow.date,
    }, 200);
  } catch (err) {
    console.error("D1 query error:", err);
    return json({ error: "데이터베이스 조회 오류" }, 500);
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300",
    },
  });
}
