import { beforeAll, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";

import { __testables, onRequest } from "../ingest-prices.js";

beforeAll(() => {
  if (!globalThis.crypto) {
    globalThis.crypto = webcrypto;
  }
});

const SECRET = "test-price-ingest-secret";
const nowTimestamp = () => String(Math.floor(Date.now() / 1000));

async function signatureFor(timestamp, rawBody) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`POST\n${timestamp}\n${rawBody}`),
  );
  return Buffer.from(signature).toString("base64");
}

function createDb() {
  const statements = [];
  const db = {
    prepare: vi.fn((sql) => ({
      bind: (...params) => {
        statements.push({ sql, params });
        return { sql, params };
      },
      run: vi.fn().mockResolvedValue({}),
    })),
    batch: vi.fn().mockResolvedValue([]),
  };
  return { db, statements };
}

describe("validatePayload", () => {
  it("accepts a bounded, well-formed ETF price batch", () => {
    const result = __testables.validatePayload({
      requestId: "batch_20260812_0001",
      records: [
        { ticker: "069500", date: "2026-08-12", close: 12890 },
        { ticker: "123456", date: "2026-08-12", close: 10000.5 },
      ],
    });

    expect(result).toEqual({
      ok: true,
      requestId: "batch_20260812_0001",
      records: [
        { ticker: "069500", date: "2026-08-12", close: 12890 },
        { ticker: "123456", date: "2026-08-12", close: 10000.5 },
      ],
    });
  });

  it("rejects malformed records, duplicate prices, and SQL-shaped tickers", () => {
    expect(
      __testables.validatePayload({
        requestId: "batch_20260812_0001",
        records: [{ ticker: "069500 OR 1=1", date: "2026-08-12", close: 10000 }],
      }),
    ).toMatchObject({ ok: false, error: "invalid_ticker" });

    expect(
      __testables.validatePayload({
        requestId: "batch_20260812_0001",
        records: [
          { ticker: "069500", date: "2026-08-12", close: 10000 },
          { ticker: "069500", date: "2026-08-12", close: 10001 },
        ],
      }),
    ).toMatchObject({ ok: false, error: "duplicate_record" });

    expect(
      __testables.validatePayload({
        requestId: "batch_20260812_0001",
        records: [{ ticker: "069500", date: "2026-08-12", close: 10000, sql: "DROP TABLE etf_prices" }],
      }),
    ).toMatchObject({ ok: false, error: "unexpected_record_field" });
  });

  it("rejects a batch that would exceed the D1 per-invocation query budget", () => {
    const records = Array.from({ length: 41 }, (_, index) => ({
      ticker: String(index).padStart(6, "0"),
      date: "2026-08-12",
      close: 10000 + index,
    }));

    expect(
      __testables.validatePayload({
        requestId: "batch_20260812_too_large",
        records,
      }),
    ).toMatchObject({ ok: false, error: "invalid_record_count" });
  });
});

describe("signed price ingestion", () => {
  it("accepts a valid signed payload and issues only fixed UPSERT statements", async () => {
    const payload = {
      requestId: "batch_20260812_0002",
      records: [{ ticker: "069500", date: "2026-08-12", close: 12890 }],
    };
    const rawBody = JSON.stringify(payload);
    const timestamp = nowTimestamp();
    const { db, statements } = createDb();
    const request = new Request("https://etf-campus.pages.dev/api/internal/ingest-prices", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-etf-ingest-timestamp": timestamp,
        "x-etf-ingest-signature": await signatureFor(timestamp, rawBody),
      },
      body: rawBody,
    });

    const response = await onRequest({
      request,
      env: { ETF_PRICES: db, PRICE_INGEST_HMAC_SECRET: SECRET },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ accepted: 1, requestId: payload.requestId });
    expect(db.batch).toHaveBeenCalledTimes(1);
    expect(statements).toContainEqual({
      sql: __testables.PRICE_UPSERT_SQL,
      params: ["069500", "2026-08-12", 12890],
    });
    expect(statements.some((statement) => /DROP|DELETE.*etf_prices/i.test(statement.sql))).toBe(false);
  });

  it("returns a replay error when the request id already exists", async () => {
    const payload = {
      requestId: "batch_20260812_replayed",
      records: [{ ticker: "069500", date: "2026-08-12", close: 12890 }],
    };
    const rawBody = JSON.stringify(payload);
    const timestamp = nowTimestamp();
    const { db } = createDb();
    db.batch.mockRejectedValueOnce(new Error("UNIQUE constraint failed: etf_price_ingest_requests.request_id"));

    const response = await onRequest({
      request: new Request("https://etf-campus.pages.dev/api/internal/ingest-prices", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-etf-ingest-timestamp": timestamp,
          "x-etf-ingest-signature": await signatureFor(timestamp, rawBody),
        },
        body: rawBody,
      }),
      env: { ETF_PRICES: db, PRICE_INGEST_HMAC_SECRET: SECRET },
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "replayed_request" });
  });

  it("rejects an invalid signature before reaching D1", async () => {
    const { db } = createDb();
    const response = await onRequest({
      request: new Request("https://etf-campus.pages.dev/api/internal/ingest-prices", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-etf-ingest-timestamp": nowTimestamp(),
          "x-etf-ingest-signature": "not-a-valid-signature",
        },
        body: JSON.stringify({
          requestId: "batch_20260812_0003",
          records: [{ ticker: "069500", date: "2026-08-12", close: 12890 }],
        }),
      }),
      env: { ETF_PRICES: db, PRICE_INGEST_HMAC_SECRET: SECRET },
    });

    expect(response.status).toBe(401);
    expect(db.batch).not.toHaveBeenCalled();
  });
});
