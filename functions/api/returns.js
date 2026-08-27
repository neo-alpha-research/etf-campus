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
    if (ticker === "ALL") {
      const cacheKey = `returns:ALL:${start}:${end}`;
      if (env.BRIEFING_KV) {
        const cached = await env.BRIEFING_KV.get(cacheKey, "json");
        if (cached) {
          return json(cached, 200);
        }
      }

      // Bulk query for all ETFs
      const startRows = await db.prepare(
        "SELECT ticker, MAX(date) as date, close FROM etf_prices WHERE date <= ? GROUP BY ticker"
      ).bind(start).all();

      const endRows = await db.prepare(
        "SELECT ticker, MAX(date) as date, close FROM etf_prices WHERE date <= ? GROUP BY ticker"
      ).bind(end).all();

      const startMap = new Map(startRows.results.map(r => [r.ticker, r]));
      
      const results = {};
      for (const endRow of endRows.results) {
        const startRow = startMap.get(endRow.ticker);
        if (!startRow) continue;
        
        let ret = null;
        if (startRow.date === endRow.date) {
          ret = 0;
        } else {
          ret = ((endRow.close / startRow.close) - 1) * 100;
          ret = Math.round(ret * 100) / 100;
        }
        results[endRow.ticker] = ret;
      }
      
      const responseData = { start, end, returns: results };
      if (env.BRIEFING_KV) {
        await env.BRIEFING_KV.put(cacheKey, JSON.stringify(responseData), { expirationTtl: 86400 });
      }
      
      return json(responseData, 200);
    }

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
