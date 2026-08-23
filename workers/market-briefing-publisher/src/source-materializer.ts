export type MarketSnapshotReadyEvent = {
  event_id: string;
  event_type: "market_snapshot_ready";
  target_name: "market_briefing";
  as_of_date: string;
  source_version: string;
};

type SourceManifest = {
  as_of_date: string;
  source_version: string;
  etf_row_count: number;
  general_etf_count: number;
  aum_coverage_pct: number;
  validation_json: string;
};

type SourceEtf = {
  ticker: string;
  etf_name: string;
  close_value: number;
  change_pct: number;
  trade_value: number;
  aum_value: number | null;
  risk_type: "normal" | "leveraged" | "inverse" | "unknown";
  asset_class: string | null;
  asset_detail: string | null;
  nav_value: number | null;
  disparity_pct: number | null;
  is_general_etf: 0 | 1;
  source_hash: string;
};

type SourceIndex = {
  index_code: "KOSPI" | "KOSDAQ";
  index_name: string;
  close_value: number;
  change_points: number | null;
  change_pct: number;
  volume_value: number | null;
  source_hash: string;
};

const CONSUMER_NAME = "market_briefing";
const nowIso = () => new Date().toISOString();
const CHUNK_SIZE = 40;

function validEvent(value: unknown): value is MarketSnapshotReadyEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;
  return event.event_type === "market_snapshot_ready"
    && event.target_name === "market_briefing"
    && typeof event.event_id === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(String(event.as_of_date ?? ""))
    && typeof event.source_version === "string";
}

function chunks<T>(rows: T[]): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < rows.length; index += CHUNK_SIZE) result.push(rows.slice(index, index + CHUNK_SIZE));
  return result;
}

async function claimEvent(db: D1Database, event: MarketSnapshotReadyEvent): Promise<"claimed" | "done"> {
  const existing = await db.prepare(
    `SELECT status FROM market_source_consumer_runs WHERE consumer_name = ? AND event_id = ?`,
  ).bind(CONSUMER_NAME, event.event_id).first<{ status: string }>();
  if (existing?.status === "ready" || existing?.status === "skipped_duplicate") return "done";

  const now = nowIso();
  if (existing) {
    await db.prepare(
      `UPDATE market_source_consumer_runs
       SET status='processing', error_detail=NULL, started_at=?, finished_at=NULL, updated_at=?
       WHERE consumer_name=? AND event_id=?`,
    ).bind(now, now, CONSUMER_NAME, event.event_id).run();
  } else {
    await db.prepare(
      `INSERT INTO market_source_consumer_runs (
        consumer_name, event_id, as_of_date, source_version, status, started_at, updated_at
      ) VALUES (?, ?, ?, ?, 'processing', ?, ?)`,
    ).bind(CONSUMER_NAME, event.event_id, event.as_of_date, event.source_version, now, now).run();
  }
  return "claimed";
}

async function finishEvent(db: D1Database, eventId: string, status: "ready" | "failed" | "skipped_duplicate", errorDetail: string | null = null): Promise<void> {
  await db.prepare(
    `UPDATE market_source_consumer_runs
     SET status=?, error_detail=?, finished_at=?, updated_at=?
     WHERE consumer_name=? AND event_id=?`,
  ).bind(status, errorDetail, nowIso(), nowIso(), CONSUMER_NAME, eventId).run();
}

export async function materializeMarketSnapshot(db: D1Database, event: MarketSnapshotReadyEvent): Promise<{ status: "ready" | "skipped_duplicate" }> {
  if (!validEvent(event)) throw new Error("invalid_market_snapshot_event");
  if ((await claimEvent(db, event)) === "done") return { status: "skipped_duplicate" };

  try {
    const alreadyPublished = await db.prepare(`SELECT as_of_date FROM market_briefings WHERE as_of_date = ?`).bind(event.as_of_date).first();
    if (alreadyPublished) {
      await finishEvent(db, event.event_id, "skipped_duplicate");
      return { status: "skipped_duplicate" };
    }

    const manifest = await db.prepare(
      `SELECT as_of_date, source_version, etf_row_count, general_etf_count, aum_coverage_pct, validation_json
       FROM market_source_snapshot_manifest
       WHERE as_of_date=? AND source_version=? AND status='ready'`,
    ).bind(event.as_of_date, event.source_version).first<SourceManifest>();
    if (!manifest) throw new Error("source_manifest_not_ready");

    const [etfsResult, indicesResult] = await Promise.all([
      db.prepare(
        `SELECT ticker, etf_name, close_value, change_pct, trade_value, aum_value, risk_type, asset_class, is_general_etf, source_hash, asset_detail, nav_value, disparity_pct
         FROM market_source_etf_daily WHERE as_of_date=? AND source_version=? ORDER BY ticker ASC`,
      ).bind(event.as_of_date, event.source_version).all<SourceEtf>(),
      db.prepare(
        `SELECT index_code, index_name, close_value, change_points, change_pct, volume_value, source_hash
         FROM market_source_index_daily WHERE as_of_date=? AND source_version=? ORDER BY index_code ASC`,
      ).bind(event.as_of_date, event.source_version).all<SourceIndex>(),
    ]);
    const etfs = etfsResult.results ?? [];
    const indices = indicesResult.results ?? [];
    const generalCount = etfs.filter((row) => row.is_general_etf === 1).length;
    const coverage = generalCount ? (etfs.filter((row) => row.is_general_etf === 1 && row.aum_value !== null && row.aum_value > 0).length / generalCount) * 100 : 0;
    if (etfs.length !== manifest.etf_row_count || generalCount !== manifest.general_etf_count || Math.abs(coverage - manifest.aum_coverage_pct) > 0.000001) throw new Error("source_manifest_metrics_mismatch");
    if (indices.length !== 2 || !indices.some((row) => row.index_code === "KOSPI") || !indices.some((row) => row.index_code === "KOSDAQ")) throw new Error("source_indices_incomplete");

    const runId = crypto.randomUUID();
    const start = nowIso();
    await db.prepare(
      `INSERT INTO briefing_runs (
        run_id, trigger_type, schedule_slot, target_date, status, etf_as_of_date, kospi_as_of_date, kosdaq_as_of_date,
        source_summary_json, validation_json, started_at, updated_at
      ) VALUES (?, 'replay', 'manual', ?, 'collecting', ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      runId, event.as_of_date, event.as_of_date, event.as_of_date, event.as_of_date,
      JSON.stringify({ source: "market_source_snapshot_hub", source_version: event.source_version, event_id: event.event_id }),
      manifest.validation_json, start, start,
    ).run();

      for (const batch of chunks(etfs)) {
        await db.batch(batch.map((etf) => db.prepare(
          `INSERT INTO briefing_etf_daily (
            as_of_date, ticker, etf_name, close_value, change_pct, trade_value, aum_value,
            risk_type, asset_class, is_general_etf, source_run_id, source_hash, asset_detail, nav_value, disparity_pct
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(as_of_date, ticker) DO UPDATE SET
            etf_name=excluded.etf_name, close_value=excluded.close_value, change_pct=excluded.change_pct,
            trade_value=excluded.trade_value, aum_value=excluded.aum_value, risk_type=excluded.risk_type,
            asset_class=excluded.asset_class, is_general_etf=excluded.is_general_etf,
            source_run_id=excluded.source_run_id, source_hash=excluded.source_hash,
            asset_detail=excluded.asset_detail, nav_value=excluded.nav_value, disparity_pct=excluded.disparity_pct`,
        ).bind(
          event.as_of_date, etf.ticker, etf.etf_name, etf.close_value, etf.change_pct, etf.trade_value,
          etf.aum_value, etf.risk_type, etf.asset_class, etf.is_general_etf, runId, etf.source_hash,
          etf.asset_detail, etf.nav_value, etf.disparity_pct
        )));
      }

    const indexHash = indices.map((index) => index.source_hash).sort().join(":");
    const statements: D1PreparedStatement[] = [
      ...indices.map((index) => db.prepare(
        `INSERT INTO market_index_daily (
          as_of_date, index_code, index_name, close_value, change_points, change_pct, volume_value,
          source_org, source_service, source_hash, source_run_id, fetched_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ETF Campus', 'market_source_snapshot_hub', ?, ?, ?)
        ON CONFLICT(as_of_date, index_code) DO UPDATE SET
          index_name=excluded.index_name, close_value=excluded.close_value, change_points=excluded.change_points,
          change_pct=excluded.change_pct, volume_value=excluded.volume_value, source_org=excluded.source_org,
          source_service=excluded.source_service, source_hash=excluded.source_hash,
          source_run_id=excluded.source_run_id, fetched_at=excluded.fetched_at`,
      ).bind(event.as_of_date, index.index_code, index.index_name, index.close_value, index.change_points, index.change_pct, index.volume_value, index.source_hash, runId, nowIso())),
      db.prepare(
        `INSERT INTO market_data_readiness (
          as_of_date, status, source_run_id, etf_as_of_date, kospi_as_of_date, kosdaq_as_of_date,
          etf_row_count, general_etf_count, aum_coverage_pct, etf_source_hash, index_source_hash,
          validation_json, collected_at, ready_at, updated_at
        ) VALUES (?, 'ready', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(as_of_date) DO UPDATE SET
          status='ready', source_run_id=excluded.source_run_id, etf_as_of_date=excluded.etf_as_of_date,
          kospi_as_of_date=excluded.kospi_as_of_date, kosdaq_as_of_date=excluded.kosdaq_as_of_date,
          etf_row_count=excluded.etf_row_count, general_etf_count=excluded.general_etf_count,
          aum_coverage_pct=excluded.aum_coverage_pct, etf_source_hash=excluded.etf_source_hash,
          index_source_hash=excluded.index_source_hash, validation_json=excluded.validation_json,
          collected_at=excluded.collected_at, ready_at=excluded.ready_at, updated_at=excluded.updated_at`,
      ).bind(
        event.as_of_date, runId, event.as_of_date, event.as_of_date, event.as_of_date,
        manifest.etf_row_count, manifest.general_etf_count, manifest.aum_coverage_pct,
        etfs[0]?.source_hash ?? "", indexHash, manifest.validation_json, nowIso(), nowIso(), nowIso(),
      ),
      db.prepare(
        `UPDATE briefing_runs SET status='ready', published_as_of_date=?, finished_at=?, updated_at=? WHERE run_id=?`,
      ).bind(event.as_of_date, nowIso(), nowIso(), runId),
    ];
    await db.batch(statements);
    await finishEvent(db, event.event_id, "ready");
    return { status: "ready" };
  } catch (error) {
    await finishEvent(db, event.event_id, "failed", String(error).slice(0, 1000));
    throw error;
  }
}

export const __testables = { validEvent };
