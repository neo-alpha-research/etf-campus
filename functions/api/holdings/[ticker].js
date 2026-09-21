/**
 * Cloudflare Pages Function: GET /api/holdings/:ticker
 *
 * Query params / URL path:
 *   ticker (string) 6-character ETF ticker code, e.g. "069500", "0000D0"
 *
 * Binding: D1 database named ETF_PRICES
 * Cache: Edge CDN cached for 24 hours (86400s)
 */

function validTicker(ticker) {
  return typeof ticker === "string" && /^[0-9A-Za-z]{6}$/.test(ticker);
}

export async function onRequestGet(context) {
  const rawTicker = context.params?.ticker;
  const ticker = typeof rawTicker === "string" ? rawTicker.trim().toUpperCase() : "";

  if (!validTicker(ticker)) {
    return jsonResponse(
      { error: "Invalid ticker format. Expected 6 alphanumeric characters.", ticker },
      400
    );
  }

  const db = context.env?.ETF_PRICES;
  if (!db) {
    return jsonResponse(
      { error: "D1 database ETF_PRICES is not configured", ticker },
      503
    );
  }

  try {
    const row = await db
      .prepare(
        "SELECT ticker, as_of_date, holdings_json, holding_count, top1_weight FROM etf_holdings WHERE ticker = ?"
      )
      .bind(ticker)
      .first();

    if (!row) {
      return jsonResponse({ error: "Holdings not found", ticker }, 404);
    }

    let rawHoldings = [];
    try {
      rawHoldings = JSON.parse(row.holdings_json);
    } catch {
      rawHoldings = [];
    }

    let holdings = [];
    if (Array.isArray(rawHoldings) && rawHoldings.length > 0) {
      if (Array.isArray(rawHoldings[0])) {
        // Unpack compact tuple format: [name, weight_pct, shares, item_code]
        holdings = rawHoldings.map(([name, weight_pct, shares, item_code]) => ({
          name,
          weight_pct,
          shares,
          item_code: item_code ?? null,
        }));
      } else {
        // Standard object format (backward compatible)
        holdings = rawHoldings;
      }
    }

    return jsonResponse(
      {
        ticker: row.ticker,
        as_of_date: row.as_of_date,
        holding_count: row.holding_count,
        top1_weight: row.top1_weight,
        holdings,
      },
      200
    );
  } catch (err) {
    console.error("D1 etf_holdings query error:", err);
    return jsonResponse({ error: "Failed to retrieve holdings data", ticker }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control":
        status === 200
          ? "public, max-age=86400, s-maxage=86400"
          : "no-store",
    },
  });
}
