import { MARKET_BRIEFING_SERVICE_START_DATE } from "./_shared.js";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "public, max-age=300, stale-while-revalidate=300",
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
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

function withFreshness(payload) {
  const briefing = payload?.briefing;
  if (!briefing?.asOfDate) return null;
  const staleDays = getBusinessDaysDiff(briefing.asOfDate, toKstDate());
  const metrics = briefing.metrics || {};
  return {
    ...payload,
    briefing: {
      ...briefing,
      isStale: staleDays >= 3,
      staleDays,
      marketScaleSnapshot: briefing.marketScaleSnapshot || buildMarketScaleSnapshot(metrics, briefing),
      marketScaleTimeSeries: briefing.marketScaleTimeSeries || buildMarketScaleTimeSeries(metrics, briefing),
    },
  };
}

async function readKvBriefingByDate(kv, date) {
  if (!kv) return null;
  try {
    const pointer = await kv.get(LATEST_POINTER_KEY, "json");
    let payloadKey = null;
    if (pointer && typeof pointer === "object" && pointer.asOfDate === date && pointer.payloadKey) {
      payloadKey = pointer.payloadKey;
    } else {
      payloadKey = `market-briefing:v0:payload:${date}:v1`;
    }

    const payload = await kv.get(payloadKey, "json");
    if (!payload) return null;
    const decorated = withFreshness(payload);
    if (!decorated || decorated?.briefing?.asOfDate !== date) return null;

    // Defensive check: Ensure assetClasses is valid and doesn't contain structural category anomalies without return
    const ac = decorated?.briefing?.assetClasses || [];
    const hasStructuralAnomaly = ac.some((item) => {
      const name = item.asset_class || item.assetClass;
      return name === "일반 실물 ETF" && (item.aum_weighted_return_pct === null || item.aumWeightedReturnPct === null);
    });
    if (hasStructuralAnomaly) {
      return null;
    }

    return decorated;
  } catch {
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
      marketScaleSnapshot: briefing.marketScaleSnapshot || buildMarketScaleSnapshot(metrics, briefing),
      marketScaleTimeSeries: briefing.marketScaleTimeSeries || buildMarketScaleTimeSeries(metrics, briefing),
      weeklyFundFlows: metrics.weekly_fund_flows ?? metrics.weeklyFundFlows ?? [],
      monthlyFundFlows: metrics.monthly_fund_flows ?? metrics.monthlyFundFlows ?? [],
      assetClasses: ((assetClasses?.results && assetClasses.results.length > 0)
        ? assetClasses.results
        : (metrics.asset_classes || metrics.assetClasses || [])
      ).map((row) => ({
        asset_class: row.asset_class || row.assetClass || "기타",
        assetClass: row.asset_class || row.assetClass || "기타",
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
        total_aum: (row.total_aum || row.totalAum || 0) >= 10_000_000 ? (row.total_aum || row.totalAum) / 100_000_000 : (row.total_aum || row.totalAum || 0),
        totalAum: (row.total_aum || row.totalAum || 0) >= 10_000_000 ? (row.total_aum || row.totalAum) / 100_000_000 : (row.total_aum || row.totalAum || 0),
        aum_share_pct: row.aum_share_pct ?? row.aumSharePct ?? 0,
        aumSharePct: row.aum_share_pct ?? row.aumSharePct ?? 0,
        total_trade_value: (row.total_trade_value || row.totalTradeValue || 0) >= 10_000_000 ? (row.total_trade_value || row.totalTradeValue) / 100_000_000 : (row.total_trade_value || row.totalTradeValue || 0),
        totalTradeValue: (row.total_trade_value || row.totalTradeValue || 0) >= 10_000_000 ? (row.total_trade_value || row.totalTradeValue) / 100_000_000 : (row.total_trade_value || row.totalTradeValue || 0),
        trade_share_pct: row.trade_share_pct ?? row.tradeSharePct ?? 0,
        tradeSharePct: row.trade_share_pct ?? row.tradeSharePct ?? 0,
      })),
      peerGroupVersion: metrics.peer_group_version ?? null,
      peerGroups: metrics.peer_groups ?? metrics.peerGroups ?? [],
      fundFlow: metrics.fund_flow ?? metrics.fundFlow ?? { topInflows: [], topOutflows: [] },
      disparityWarning: metrics.disparity_warning ?? metrics.disparityWarning ?? [],
      focusEtfs: focusEtfs?.results ?? [],
      sourceDates: parseJson(briefing.source_dates_json, {}),
      validation: parseJson(briefing.validation_json, {}),
    },
  };
}

function buildMarketScaleSnapshot(metrics, briefing) {
  if (metrics.market_scale_snapshot) {
    const snap = metrics.market_scale_snapshot;
    let totalAum = snap.totalAum || 0;
    let totalTradeValue = snap.totalTradeValue || 0;
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

  if (metrics.market_scale) {
    const ms = metrics.market_scale;
    // categories가 이미 있으면 그대로 반환
    if (ms.categories && ms.categories.length > 0) return ms;

    // 하위호환: composition → categories 변환
    if (ms.composition && ms.composition.length > 0) {
      return {
        ...ms,
        categories: ms.composition.map((c) => ({
          category: c.type || c.category,
          label: c.label,
          aum: c.aum,
          aumSharePct: c.pct ?? c.aumSharePct ?? 0,
          tradeValue: c.tradeValue ?? 0,
          tradeSharePct: c.tradeSharePct ?? 0,
          turnoverPct: c.turnoverPct ?? 0,
          etfCount: c.count ?? c.etfCount ?? 0,
        })),
      };
    }
    return ms;
  }

  return { totalAum: 0, totalTradeValue: 0, categories: [] };
}


function buildMarketScaleTimeSeries(metrics, briefing) {
  if (metrics.market_scale_time_series) return metrics.market_scale_time_series;
  return {
    daily: [],
    weekly: [],
    monthly: [],
    yearly: []
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

  if (date < MARKET_BRIEFING_SERVICE_START_DATE) {
    return Response.json(
      { briefing: null, message: `마켓 브리핑은 ${MARKET_BRIEFING_SERVICE_START_DATE}부터 정식 제공됩니다.` },
      { status: 404, headers: { ...JSON_HEADERS, "cache-control": "no-store" } },
    );
  }

  // 1. KV 캐시 가속 계층 우선 확인 (D1 쿼리 한도 고갈 대비 및 초고속 에지 서빙)
  let cached = null;
  try {
    cached = await readKvBriefingByDate(context.env?.BRIEFING_KV, date);
  } catch (e) {}

  if (cached && cached.briefing?.asOfDate === date) {
    return Response.json(cached, { headers: JSON_HEADERS });
  }

  // 2. D1 정식 DB 조회 (KV 미스 시 안전 폴백)
  try {
    if (!context.env?.ETF_PRICES) {
      if (cached) return Response.json(cached, { headers: JSON_HEADERS });
      return Response.json({ error: "D1 database ETF_PRICES is not configured" }, { status: 503, headers: JSON_HEADERS });
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
  } catch (error) {
    try {
      if (context.env?.BRIEFING_KV) {
        const fallback = await readKvBriefingByDate(context.env.BRIEFING_KV, date);
        if (fallback) return Response.json(fallback, { headers: JSON_HEADERS });
      }
    } catch (e) {}
    if (cached) return Response.json(cached, { headers: JSON_HEADERS });
    return Response.json({ error: "Internal Server Error", message: String(error?.message || error), stack: String(error?.stack || '') }, { status: 500, headers: JSON_HEADERS });
  }
}

export async function onRequest(context) {
  return onRequestGet(context);
}
