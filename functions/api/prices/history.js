/**
 * Cloudflare Pages Function: GET /api/prices/history
 *
 * Query params:
 *   ticker  (string)  ETF ticker, 6 alphanumeric chars
 *   start   (string)  YYYY-MM-DD
 *   end     (string)  YYYY-MM-DD
 *   basis   (string)  pr (default), estimated, or tr
 *
 * Binding: D1 database named ETF_PRICES
 */

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const ticker = url.searchParams.get("ticker")?.trim().toUpperCase();
  const start = url.searchParams.get("start")?.trim();
  const end = url.searchParams.get("end")?.trim();
  const basis = (url.searchParams.get("basis")?.trim().toLowerCase() || "pr");

  // Validate ticker (6 alphanumeric chars)
  if (!ticker || !/^[A-Z0-9]{6}$/.test(ticker)) {
    return json({ error: "invalid_ticker" }, 400);
  }

  if (!["pr", "estimated", "tr"].includes(basis)) {
    return json({ error: "invalid_basis" }, 400);
  }
  // TR must never silently fall back to the PR price series. The static display
  // gate will enable this request only after a verified TR history is published.
  // Until then, fail closed rather than returning misleading data.
  if (basis === "tr") {
    return json({ error: "tr_history_not_configured", basis: "tr", distributionIncluded: true, qualityStatus: "검증된 TR 시계열 준비 중" }, 503);
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
  // The 5-year guard protects only alternate series that can delegate to an
  // external provider. The default PR series is a bounded D1 read and must
  // serve a genuine MAX range from the ETF's listing/first-trading date.
  const diffDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
  if (basis !== "pr" && diffDays > 1826) {
    return json({ error: "range_too_large", scope: "external_series" }, 400);
  }
  if (basis === "estimated") {
    return estimatedDistributionHistory(url, ticker, start, end);
  }

  const db = env.ETF_PRICES;
  if (!db) {
    return json({ error: "database_not_configured" }, 503);
  }

  try {
    // Fixed-period returns use the latest trading close on or before the
    // calendar target. Include that anchor before returning the visible
    // window so the chart and the precomputed return table share one basis.
    const { results } = await db.prepare(`
      SELECT date, close
      FROM (
        SELECT date, close
        FROM etf_prices
        WHERE ticker = ? AND date <= ?
        ORDER BY date DESC
        LIMIT 1
      ) AS anchor
      UNION ALL
      SELECT date, close
      FROM etf_prices
      WHERE ticker = ? AND date > ? AND date <= ?
      ORDER BY date ASC
    `).bind(ticker, start, ticker, start, end).all();

    if (!results || results.length === 0) {
      return json({
        ticker,
        requestedStart: start,
        requestedEnd: end,
        actualStart: null,
        actualEnd: null,
        anchorPolicy: "latest_trading_close_on_or_before_requested_start",
        basis: "시장가격 수익률(PR)",
        distributionIncluded: false,
        returnBasis: "pr",
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
      anchorPolicy: "latest_trading_close_on_or_before_requested_start",
      basis: "시장가격 수익률(PR)",
      distributionIncluded: false,
      returnBasis: "pr",
      source: "금융위원회 증권상품시세정보 API 등",
      qualityStatus: "시장 종가 추이",
      points
    });

  } catch (err) {
    console.error("D1 query error:", err);
    return json({ error: "database_query_error" }, 500);
  }
}

async function estimatedDistributionHistory(url, ticker, start, end) {
  try {
    const historyUrl = new URL("/data/returns/estimated_distribution_return_history.json", url.origin);
    const response = await fetch(historyUrl);
    if (!response.ok) {
      return json({ error: "estimated_history_not_configured", basis: "estimated", distributionIncluded: true, qualityStatus: "운용사 공지 기반 추정 수익률 준비 중" }, 503);
    }
    const payload = await response.json();
    const records = Array.isArray(payload?.records) ? payload.records : [];
    const tickerRows = records.filter((row) => row.ticker === ticker).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const visible = tickerRows.filter((row) => row.date >= start && row.date <= end);
    const anchor = tickerRows.filter((row) => row.date <= start).at(-1);
    const rows = anchor && !visible.some((row) => row.date === anchor.date) ? [anchor, ...visible] : visible;
    if (rows.length === 0) {
      return json({ ticker, requestedStart: start, requestedEnd: end, actualStart: null, actualEnd: null, basis: "분배금 반영 수익률(추정)", distributionIncluded: true, returnBasis: "estimated", qualityStatus: "운용사 공식 공지 기반 · 확인된 커버리지 범위", points: [] });
    }
    const firstIndex = Number(rows[0].estimated_distribution_index);
    const points = rows.map((row) => ({
      date: row.date,
      close: Number(row.estimated_distribution_index),
      returnPct: firstIndex > 0 ? Math.round(((Number(row.estimated_distribution_index) / firstIndex - 1) * 100) * 100) / 100 : 0,
    }));
    return json({
      ticker, requestedStart: start, requestedEnd: end, actualStart: rows[0].date, actualEnd: rows.at(-1).date,
      anchorPolicy: "latest_confirmed_estimated_return_index_on_or_before_requested_start",
      basis: "분배금 반영 수익률(추정)", distributionIncluded: true, returnBasis: "estimated",
      source: "운용사 공식 분배금 공지", qualityStatus: "운용사 공지 기반 · KIND 개별 검증 전", points,
    });
  } catch (err) {
    console.error("Estimated distribution history error:", err);
    return json({ error: "estimated_history_unavailable" }, 503);
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
