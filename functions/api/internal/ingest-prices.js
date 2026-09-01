const MAX_BODY_BYTES = 1_000_000;
// Three replay-protection statements plus one UPSERT per record must remain
// under the D1 free-plan limit of 50 queries per Worker invocation.
const MAX_RECORDS_PER_REQUEST = 40;
const MAX_SIGNATURE_AGE_SECONDS = 300;
const REPLAY_RETENTION_SECONDS = 600;
const PRICE_UPSERT_SQL = [
  "INSERT INTO etf_prices (ticker, date, close) VALUES (?, ?, ?)",
  "ON CONFLICT(ticker, date) DO UPDATE SET close = excluded.close",
].join(" ");

const textEncoder = new TextEncoder();

/**
 * Cloudflare Pages Function: POST /api/internal/ingest-prices
 *
 * This endpoint is intentionally limited to a signed batch of ETF prices.
 * It does not accept SQL, table names, or arbitrary D1 commands.
 *
 * Required bindings:
 * - ETF_PRICES: D1 database binding
 * - PRICE_INGEST_HMAC_SECRET: Pages secret shared only with GitHub Actions
 */
export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405, { Allow: "POST" });
  }

  const secret = env.PRICE_INGEST_HMAC_SECRET;
  const db = env.ETF_PRICES;
  if (!secret || !db) {
    return json({ error: "service_unavailable" }, 503);
  }

  const declaredLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return json({ error: "payload_too_large" }, 413);
  }

  let rawBody;
  try {
    rawBody = await request.text();
  } catch {
    return json({ error: "invalid_request_body" }, 400);
  }

  if (!rawBody || textEncoder.encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return json({ error: "payload_too_large" }, 413);
  }

  const timestamp = request.headers.get("x-etf-ingest-timestamp");
  const signature = request.headers.get("x-etf-ingest-signature");
  if (!isFreshTimestamp(timestamp) || !signature) {
    return json({ error: "invalid_signature" }, 401);
  }

  const signedMessage = `POST\n${timestamp}\n${rawBody}`;
  const signatureIsValid = await verifySignature(secret, signedMessage, signature);
  if (!signatureIsValid) {
    return json({ error: "invalid_signature" }, 401);
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const validation = validatePayload(payload);
  if (!validation.ok) {
    return json({ error: validation.error }, 400);
  }

  const now = new Date();
  const receivedAt = now.toISOString();
  const expiresAt = Math.floor(now.getTime() / 1000) + REPLAY_RETENTION_SECONDS;

  try {
    try {
      await db
        .prepare(
          "CREATE TABLE IF NOT EXISTS etf_price_ingest_requests (" +
            "request_id TEXT PRIMARY KEY, received_at TEXT NOT NULL, expires_at INTEGER NOT NULL)",
        )
        .run();
    } catch {
      // Best-effort table creation if not already present
    }

    const purgeExpired = db
      .prepare("DELETE FROM etf_price_ingest_requests WHERE expires_at < ?")
      .bind(Math.floor(now.getTime() / 1000));
    const recordRequest = db
      .prepare(
        "INSERT INTO etf_price_ingest_requests (request_id, received_at, expires_at) VALUES (?, ?, ?)",
      )
      .bind(validation.requestId, receivedAt, expiresAt);
    const upserts = validation.records.map((record) =>
      db.prepare(PRICE_UPSERT_SQL).bind(record.ticker, record.date, record.close),
    );

    // D1 executes this batch transactionally. A duplicate request_id fails before
    // a second set of price UPSERTs can be committed.
    await db.batch([purgeExpired, recordRequest, ...upserts]);
  } catch (error) {
    if (isDuplicateRequestError(error)) {
      return json({ error: "replayed_request" }, 409);
    }
    console.error("Signed price ingestion failed", {
      requestId: validation.requestId,
      recordCount: validation.records.length,
      error: error instanceof Error ? error.message : String(error),
    });
    return json(
      {
        error: "ingestion_failed",
        message: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }

  return json(
    {
      accepted: validation.records.length,
      requestId: validation.requestId,
    },
    200,
  );
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "invalid_payload" };
  }

  const payloadKeys = Object.keys(payload);
  if (payloadKeys.length !== 2 || !payloadKeys.every((key) => key === "requestId" || key === "records")) {
    return { ok: false, error: "unexpected_payload_field" };
  }

  const { requestId, records } = payload;
  if (typeof requestId !== "string" || !/^[A-Za-z0-9_-]{16,128}$/.test(requestId)) {
    return { ok: false, error: "invalid_request_id" };
  }
  if (!Array.isArray(records) || records.length === 0 || records.length > MAX_RECORDS_PER_REQUEST) {
    return { ok: false, error: "invalid_record_count" };
  }

  const seen = new Set();
  const normalizedRecords = [];
  for (const record of records) {
    if (!record || typeof record !== "object") {
      return { ok: false, error: "invalid_record" };
    }

    const recordKeys = Object.keys(record);
    if (
      recordKeys.length !== 3 ||
      !recordKeys.every((key) => key === "ticker" || key === "date" || key === "close")
    ) {
      return { ok: false, error: "unexpected_record_field" };
    }

    const { ticker, date, close } = record;
    if (typeof ticker !== "string" || !/^[0-9A-Z]{6}$/.test(ticker)) {
      return { ok: false, error: "invalid_ticker" };
    }
    if (typeof date !== "string" || !isValidIsoDate(date)) {
      return { ok: false, error: "invalid_date" };
    }
    if (typeof close !== "number" || !Number.isFinite(close) || close <= 0 || close > 100_000_000) {
      return { ok: false, error: "invalid_close" };
    }

    const key = `${ticker}:${date}`;
    if (seen.has(key)) {
      return { ok: false, error: "duplicate_record" };
    }
    seen.add(key);
    normalizedRecords.push({ ticker, date, close });
  }

  return { ok: true, requestId, records: normalizedRecords };
}

function isValidIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isFreshTimestamp(value) {
  if (!value || !/^\d{10}$/.test(value)) return false;
  const timestamp = Number(value);
  const now = Math.floor(Date.now() / 1000);
  return Math.abs(now - timestamp) <= MAX_SIGNATURE_AGE_SECONDS;
}

async function verifySignature(secret, message, suppliedSignature) {
  const supplied = decodeBase64(suppliedSignature);
  if (!supplied) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, textEncoder.encode(message)),
  );
  return constantTimeEqual(expected, supplied);
}

function decodeBase64(value) {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(normalized);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

function constantTimeEqual(expected, supplied) {
  if (expected.length !== supplied.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected[index] ^ supplied[index];
  }
  return difference === 0;
}

function isDuplicateRequestError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /unique constraint|primary key|constraint failed/i.test(message);
}

function json(body, status, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

export const __testables = {
  PRICE_UPSERT_SQL,
  constantTimeEqual,
  isFreshTimestamp,
  isValidIsoDate,
  validatePayload,
  verifySignature,
};
