import { cacheReadyBriefing, type ResilienceEnv } from "./resilience";

type BriefingRow = {
  as_of_date: string;
  publication_version: number;
  headline_text: string | null;
  headline_generation_status: string;
  kospi_close: number;
  kospi_change_pct: number;
  kosdaq_close: number;
  kosdaq_change_pct: number;
  general_aum_weighted_return_pct: number;
  top50_aum_weighted_return_pct: number;
  top100_aum_weighted_return_pct: number;
  top200_aum_weighted_return_pct: number;
  general_etf_count: number;
  up_count: number;
  flat_count: number;
  down_count: number;
  breadth_ratio_pct: number;
  market_temperature: string;
  general_total_aum: number;
  general_total_trade_value: number;
  top10_trade_share_pct: number;
  metrics_json: string;
  source_dates_json: string;
  validation_json: string;
  published_at: string;
  updated_at: string;
};

export async function warmLatestBriefingCache(env: ResilienceEnv, asOfDate: string): Promise<void> {
  const briefing = await env.ETF_PRICES
    .prepare(
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
       WHERE as_of_date = ?`,
    )
    .bind(asOfDate)
    .first<BriefingRow>();
  if (!briefing) throw new Error(`Ready briefing ${asOfDate} was not found for KV warm-up`);

  const [assetClasses, focusEtfs] = await Promise.all([
    env.ETF_PRICES
      .prepare(
        `SELECT asset_class, etf_count, up_count, flat_count, down_count,
                breadth_ratio_pct, aum_weighted_return_pct, total_aum, aum_share_pct,
                total_trade_value, trade_share_pct
         FROM market_briefing_asset_classes
         WHERE as_of_date = ?
         ORDER BY total_trade_value DESC, asset_class ASC`,
      )
      .bind(asOfDate)
      .all(),
    env.ETF_PRICES
      .prepare(
        `SELECT rank_no, ticker, etf_name, asset_class, close_value,
                change_pct, trade_value, trade_share_pct
         FROM market_briefing_focus_etfs
         WHERE as_of_date = ?
         ORDER BY rank_no ASC`,
      )
      .bind(asOfDate)
      .all(),
  ]);

  const metrics = JSON.parse(briefing.metrics_json) as {
    market_indices?: unknown[];
    etf_pulse?: { aum_weighted_returns?: unknown[] };
  };
  await cacheReadyBriefing(env, {
    asOfDate,
    publicationVersion: briefing.publication_version,
    payload: {
      briefing: {
        asOfDate: briefing.as_of_date,
        publicationVersion: briefing.publication_version,
        publishedAt: briefing.published_at,
        updatedAt: briefing.updated_at,
        isStale: false,
        staleDays: 0,
        headline: { text: briefing.headline_text, generationStatus: briefing.headline_generation_status },
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
        },
        assetClasses: assetClasses.results ?? [],
        focusEtfs: focusEtfs.results ?? [],
        sourceDates: JSON.parse(briefing.source_dates_json),
        validation: JSON.parse(briefing.validation_json),
      },
    },
  });
}

/**
 * [현재 미사용 — 이 상태가 정상입니다]
 *
 * 이 함수를 호출하는 큐 이벤트('market_briefing_editorial')를 발행하는 생산자가 없습니다.
 * publish.js / rollback.js / withdraw.js 는 outbox 테이블에 INSERT만 하고 큐로 쏘지 않습니다.
 * 향후 멀티채널 발행 팬아웃 구현 시 소비자 뼈대로 재사용할 예정이므로 코드를 남겨둡니다.
 *
 * 🔴 활성화 전에 반드시 해결해야 할 알려진 결함:
 *   1. `env: any` 타입 우회 → 이벤트 타입 유니온 정의 필요
 *   2. `console.log` 직접 호출 → 워커의 기존 로깅 방식(structured JSON)으로 교체 필요
 *   3. 캐시 갱신 실패 시에도 index.ts에서 message.ack()가 호출되어 이벤트가 재시도 없이 유실됨
 *      → 실패 경로에서 message.retry()로 위임하도록 수정 필요
 *   4. 이 경로를 덮는 테스트가 없음
 */
export async function updateEditorialPublicationCache(env: any, asOfDate: string, publishedVersion: number, action: string) {
  console.log(`Processing editorial cache update for ${asOfDate} v${publishedVersion} action=${action}`);
  await env.ETF_PRICES.prepare(`UPDATE market_briefing_editorial_cache_outbox SET delivery_status = 'sent', sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE as_of_date = ? AND published_version = ? AND action = ?`).bind(asOfDate, publishedVersion, action).run();
}
