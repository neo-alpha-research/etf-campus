const MAX_BODY_BYTES = 1_500_000;
const MAX_ETFS_PER_BATCH = 100;
const MAX_SIGNATURE_AGE_SECONDS = 300;
const textEncoder = new TextEncoder();

const RISK_TYPES = new Set(["normal", "leverage", "leveraged", "inverse", "parking", "unknown"]);
const INDEX_CODES = new Set(["KOSPI", "KOSDAQ", "^KS11", "^KQ11", "^GSPC", "^IXIC", "^N225", "KRW=X", "CL=F", "GC=F", "SI=F", "DGS10", "VIXCLS", "^TNX", "^VIX", "T10Y2Y"]);

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, { Allow: "POST" });
  if (!env.ETF_PRICES || !env.PRICE_INGEST_HMAC_SECRET) return json({ error: "service_unavailable" }, 503);

  const rawBody = await request.text().catch(() => "");
  if (!rawBody || textEncoder.encode(rawBody).byteLength > MAX_BODY_BYTES) return json({ error: "payload_too_large" }, 413);

  const timestamp = request.headers.get("x-etf-ingest-timestamp");
  const signature = request.headers.get("x-etf-ingest-signature");
  if (!isFreshTimestamp(timestamp) || !signature) return json({ error: "invalid_signature" }, 401);
  const message = `POST\n${timestamp}\n${rawBody}`;
  if (!(await verifySignature(env.PRICE_INGEST_HMAC_SECRET, message, signature))) return json({ error: "invalid_signature" }, 401);

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const common = validateCommon(payload);
  if (!common.ok) return json({ error: common.error }, 400);

  try {
    if (payload.action === "start") return json(await startSnapshot(env.ETF_PRICES, common.value), 202);
    if (payload.action === "batch") {
      const batch = validateBatch(payload, common.value);
      if (!batch.ok) return json({ error: batch.error }, 400);
      return json(await ingestBatch(env.ETF_PRICES, common.value, batch.value), 202);
    }
    if (payload.action === "finalize") {
      const finalization = validateFinalization(payload, common.value);
      if (!finalization.ok) return json({ error: finalization.error }, 400);
      return json(await finalizeSnapshot(env, common.value, finalization.value), 202);
    }
    return json({ error: "invalid_action" }, 400);
  } catch (error) {
    console.error("Market source ingest failed", { action: payload?.action, asOfDate: common.value.asOfDate, sourceVersion: common.value.sourceVersion, message: String(error) });
    return json({ error: "ingestion_failed" }, 500);
  }
}

function validateCommon(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return { ok: false, error: "invalid_payload" };
  const { action, asOfDate, sourceVersion } = payload;
  if (!["start", "batch", "finalize"].includes(action)) return { ok: false, error: "invalid_action" };
  if (!isValidIsoDate(asOfDate)) return { ok: false, error: "invalid_as_of_date" };
  if (typeof sourceVersion !== "string" || !/^[A-Za-z0-9._:-]{8,180}$/.test(sourceVersion)) return { ok: false, error: "invalid_source_version" };
  return { ok: true, value: { asOfDate, sourceVersion, rawPayload: payload } };
}

function validateStart(payload, common) {
  const numericFields = ["expectedEtfCount", "generalEtfCount", "aumCoveragePct"];
  if (!numericFields.every((field) => Number.isFinite(payload[field]))) return { ok: false, error: "invalid_snapshot_stats" };
  if (!Number.isInteger(payload.expectedEtfCount) || payload.expectedEtfCount <= 0 || !Number.isInteger(payload.generalEtfCount) || payload.generalEtfCount <= 0 || payload.generalEtfCount > payload.expectedEtfCount) return { ok: false, error: "invalid_snapshot_counts" };
  if (payload.aumCoveragePct < 0 || payload.aumCoveragePct > 100) return { ok: false, error: "invalid_aum_coverage" };
  if (!isHash(payload.etfSourceHash) || !isHash(payload.indexSourceHash)) return { ok: false, error: "invalid_source_hash" };
  if (!payload.validation || typeof payload.validation !== "object" || Array.isArray(payload.validation)) return { ok: false, error: "invalid_validation" };
  const gitCommitSha = typeof payload.gitCommitSha === "string" && /^[0-9a-f]{7,64}$/i.test(payload.gitCommitSha) ? payload.gitCommitSha : null;
  return { ok: true, value: { ...common, expectedEtfCount: payload.expectedEtfCount, generalEtfCount: payload.generalEtfCount, aumCoveragePct: payload.aumCoveragePct, etfSourceHash: payload.etfSourceHash, indexSourceHash: payload.indexSourceHash, validation: payload.validation, gitCommitSha } };
}

function validateBatch(payload) {
  if (!Array.isArray(payload.etfs) || payload.etfs.length < 1 || payload.etfs.length > MAX_ETFS_PER_BATCH) return { ok: false, error: "invalid_batch_size" };
  const seen = new Set();
  const etfs = [];
  for (const item of payload.etfs) {
    const normalized = normalizeEtf(item);
    if (!normalized) return { ok: false, error: "invalid_etf_row" };
    if (seen.has(normalized.ticker)) return { ok: false, error: "duplicate_ticker" };
    seen.add(normalized.ticker);
    etfs.push(normalized);
  }
  return { ok: true, value: etfs };
}

function validateFinalization(payload) {
  if (!Array.isArray(payload.indices) || payload.indices.length < 2) return { ok: false, error: "invalid_index_count" };
  const indices = payload.indices.map(normalizeIndex);
  if (indices.some((index) => !index)) return { ok: false, error: "invalid_index_row" };
  const codes = new Set(indices.map((index) => index.code));
  if (!codes.has("KOSPI") || !codes.has("KOSDAQ")) return { ok: false, error: "missing_index_code" };
  return { ok: true, value: indices };
}

async function startSnapshot(db, input) {
  const validation = validateStart(input.rawPayload ?? {}, input);
  // validateStart is called by startSnapshot through the raw payload bridge below.
  if (!validation.ok) throw new Error(validation.error);
  const value = validation.value;
  const existing = await db.prepare(
    `SELECT status FROM market_source_snapshot_manifest WHERE as_of_date = ? AND source_version = ?`,
  ).bind(value.asOfDate, value.sourceVersion).first();
  if (existing?.status === "ready") return { status: "already_ready", asOfDate: value.asOfDate, sourceVersion: value.sourceVersion };

  await db.prepare(
    `INSERT INTO market_source_snapshot_manifest (
       as_of_date, source_version, status, etf_as_of_date, kospi_as_of_date, kosdaq_as_of_date,
       etf_row_count, general_etf_count, aum_coverage_pct, etf_source_hash, index_source_hash,
       validation_json, git_commit_sha, created_at, updated_at
     ) VALUES (?, ?, 'collecting', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(as_of_date, source_version) DO UPDATE SET
       status='collecting', etf_as_of_date=excluded.etf_as_of_date, kospi_as_of_date=excluded.kospi_as_of_date,
       kosdaq_as_of_date=excluded.kosdaq_as_of_date, etf_row_count=excluded.etf_row_count,
       general_etf_count=excluded.general_etf_count, aum_coverage_pct=excluded.aum_coverage_pct,
       etf_source_hash=excluded.etf_source_hash, index_source_hash=excluded.index_source_hash,
       validation_json=excluded.validation_json, git_commit_sha=excluded.git_commit_sha,
       ready_at=NULL, updated_at=excluded.updated_at`,
  ).bind(
    value.asOfDate, value.sourceVersion, value.asOfDate, value.asOfDate, value.asOfDate,
    value.expectedEtfCount, value.generalEtfCount, value.aumCoveragePct, value.etfSourceHash, value.indexSourceHash,
    JSON.stringify(value.validation), value.gitCommitSha, nowIso(), nowIso(),
  ).run();
  return { status: "collecting", asOfDate: value.asOfDate, sourceVersion: value.sourceVersion };
}

async function ingestBatch(db, common, etfs) {
  const manifest = await db.prepare(
    `SELECT status, etf_source_hash FROM market_source_snapshot_manifest WHERE as_of_date = ? AND source_version = ?`,
  ).bind(common.asOfDate, common.sourceVersion).first();
  if (!manifest) throw new Error("snapshot_not_started");
  if (manifest.status === "ready") return { status: "already_ready", accepted: 0 };
  const ingestedAt = nowIso();
  const statements = etfs.map((etf) => db.prepare(
    `INSERT INTO market_source_etf_daily (
       as_of_date, source_version, ticker, etf_name, close_value, change_pct, trade_value,
       aum_value, risk_type, asset_class, asset_detail, nav_value, disparity_pct, is_general_etf, source_hash, shares, ingested_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(as_of_date, source_version, ticker) DO UPDATE SET
       etf_name=excluded.etf_name, close_value=excluded.close_value, change_pct=excluded.change_pct,
       trade_value=excluded.trade_value, aum_value=excluded.aum_value, risk_type=excluded.risk_type,
       asset_class=excluded.asset_class, asset_detail=excluded.asset_detail,
       nav_value=excluded.nav_value, disparity_pct=excluded.disparity_pct,
       is_general_etf=excluded.is_general_etf, shares=excluded.shares,
       source_hash=excluded.source_hash, ingested_at=excluded.ingested_at`,
  ).bind(
    common.asOfDate, common.sourceVersion, etf.ticker, etf.name, etf.close, etf.changePct, etf.tradeValue,
    etf.aumValue ?? null, etf.riskType, etf.assetClass ?? null, etf.assetDetail ?? null,
    etf.navValue ?? null, etf.disparityPct ?? null,
    etf.isGeneralEtf, manifest.etf_source_hash, etf.shares ?? null, ingestedAt,
  ));
  await db.batch(statements);
  return { status: "collecting", accepted: etfs.length };
}

async function finalizeSnapshot(env, common, indices) {
  const db = env.ETF_PRICES;
  const manifest = await db.prepare(
    `SELECT etf_row_count, general_etf_count, aum_coverage_pct, etf_source_hash, index_source_hash, validation_json
     FROM market_source_snapshot_manifest WHERE as_of_date = ? AND source_version = ? AND status = 'collecting'`,
  ).bind(common.asOfDate, common.sourceVersion).first();
  if (!manifest) {
    const existing = await db.prepare(`SELECT status FROM market_source_snapshot_manifest WHERE as_of_date = ? AND source_version = ?`).bind(common.asOfDate, common.sourceVersion).first();
    if (existing?.status === "ready") return { status: "already_ready", asOfDate: common.asOfDate, sourceVersion: common.sourceVersion };
    throw new Error("snapshot_not_collecting");
  }
  const counts = await db.prepare(
    `SELECT COUNT(*) AS etf_count, SUM(CASE WHEN is_general_etf = 1 THEN 1 ELSE 0 END) AS general_count,
            SUM(CASE WHEN is_general_etf = 1 AND aum_value > 0 THEN 1 ELSE 0 END) AS aum_count
     FROM market_source_etf_daily WHERE as_of_date = ? AND source_version = ?`,
  ).bind(common.asOfDate, common.sourceVersion).first();
  if (Number(counts?.etf_count) !== manifest.etf_row_count || Number(counts?.general_count) !== manifest.general_etf_count) throw new Error("snapshot_row_count_mismatch");
  const calculatedCoverage = manifest.general_etf_count ? (Number(counts?.aum_count) / manifest.general_etf_count) * 100 : 0;
  if (Math.abs(calculatedCoverage - manifest.aum_coverage_pct) > 0.000001) throw new Error("snapshot_aum_coverage_mismatch");

  const eventId = `market_snapshot_ready:${common.asOfDate}:${common.sourceVersion}:market_briefing`;
  const now = nowIso();
  const statements = [
    ...indices.map((index) => db.prepare(
      `INSERT INTO market_source_index_daily (
         as_of_date, source_version, index_code, index_name, close_value, change_points, change_pct,
         volume_value, source_hash, ingested_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(as_of_date, source_version, index_code) DO UPDATE SET
         index_name=excluded.index_name, close_value=excluded.close_value, change_points=excluded.change_points,
         change_pct=excluded.change_pct, volume_value=excluded.volume_value, source_hash=excluded.source_hash,
         ingested_at=excluded.ingested_at`,
    ).bind(common.asOfDate, common.sourceVersion, index.code, index.name, index.close, index.changePoints, index.changePct, index.volumeValue, manifest.index_source_hash, now)),
    db.prepare(
      `UPDATE market_source_snapshot_manifest
       SET status='ready', ready_at=?, updated_at=?
       WHERE as_of_date=? AND source_version=? AND status='collecting'`,
    ).bind(now, now, common.asOfDate, common.sourceVersion),
  ];
  await env.ETF_PRICES.batch(statements);
  
  if (env.MARKET_BRIEFING_EVENTS) {
    await env.MARKET_BRIEFING_EVENTS.send({
      event_id: eventId,
      event_type: "market_snapshot_ready",
      target_name: "market_briefing",
      as_of_date: common.asOfDate,
      source_version: common.sourceVersion
    });
  } else {
    console.warn("MARKET_BRIEFING_EVENTS queue is not bound. Event not dispatched.");
  }

  return { status: "ready", eventId, asOfDate: common.asOfDate, sourceVersion: common.sourceVersion };
}

function normalizeEtf(item) {
  if (!item || typeof item !== "object") return null;
  const ticker = String(item.ticker ?? "").trim().toUpperCase();
  const name = String(item.name ?? "").trim();
  const riskType = String(item.riskType ?? "").trim();
  const assetClass = item.assetClass == null || String(item.assetClass).trim() === "" ? null : String(item.assetClass).trim();
  const assetDetail = item.assetDetail == null || String(item.assetDetail).trim() === "" ? null : String(item.assetDetail).trim();
  const close = finiteNumber(item.close, 0);
  const changePct = finiteNumber(item.changePct);
  const tradeValue = finiteNumber(item.tradeValue, 0);
  const aumValue = item.aumValue == null || item.aumValue === "" ? null : finiteNumber(item.aumValue, 0);
  const navValue = item.navValue == null || item.navValue === "" ? null : finiteNumber(item.navValue, 0);
  const disparityPct = item.disparityPct == null || item.disparityPct === "" ? null : finiteNumber(item.disparityPct);
  const shares = item.shares == null || item.shares === "" ? null : finiteNumber(item.shares, 0);
  const isGeneralEtf = item.isGeneralEtf === 1 || item.isGeneralEtf === 0 ? item.isGeneralEtf : (riskType === "normal" && !String(assetClass ?? "").includes("금리") && !String(assetClass ?? "").includes("파킹") ? 1 : 0);
  if (!/^[0-9A-Z]{6}$/.test(ticker) || !name || !RISK_TYPES.has(riskType) || close === null || changePct === null || tradeValue === null || aumValue === undefined) return null;
  return { ticker, name, close, changePct, tradeValue, aumValue, riskType, assetClass, assetDetail, navValue, disparityPct, isGeneralEtf, shares };
}

function normalizeIndex(item) {
  if (!item || typeof item !== "object") return null;
  const code = String(item.code ?? "").trim().toUpperCase();
  const name = String(item.name ?? code).trim() || code;
  const close = finiteNumber(item.close, 0);
  const changePct = finiteNumber(item.changePct);
  const changePoints = item.changePoints == null || item.changePoints === "" ? null : finiteNumber(item.changePoints);
  const volumeValue = item.volumeValue == null || item.volumeValue === "" ? null : finiteNumber(item.volumeValue, 0);
  if (!INDEX_CODES.has(code) || close === null || changePct === null || changePoints === undefined || volumeValue === undefined) return null;
  return { code, name, close, changePct, changePoints, volumeValue };
}

function finiteNumber(value, minimum) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || (minimum !== undefined && number < minimum)) return null;
  return number;
}

function isHash(value) {
  return typeof value === "string" && /^[a-f0-9]{32,128}$/i.test(value);
}

function isValidIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isFreshTimestamp(value) {
  if (!value || !/^\d{10}$/.test(value)) return false;
  return Math.abs(Math.floor(Date.now() / 1000) - Number(value)) <= MAX_SIGNATURE_AGE_SECONDS;
}

async function verifySignature(secret, message, suppliedSignature) {
  const supplied = decodeBase64(suppliedSignature);
  if (!supplied) return false;
  const key = await crypto.subtle.importKey("raw", textEncoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, textEncoder.encode(message)));
  if (expected.length !== supplied.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) difference |= expected[index] ^ supplied[index];
  return difference === 0;
}

function decodeBase64(value) {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    return Uint8Array.from(atob(normalized), (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extraHeaders },
  });
}

export const __testables = { normalizeEtf, normalizeIndex, validateCommon, isValidIsoDate };
