import { describe, expect, it, vi } from "vitest";
import { hashSessionToken } from "../../../_shared/auth.js";
import { onRequest } from "../_middleware.js";

function authRequest(cookie = "") {
  return new Request("https://etfcampus.example.com/api/member/watchlist", {
    method: "POST",
    headers: cookie ? { cookie } : {},
  });
}

function createDb(row = null) {
  const statements = [];
  const db = {
    prepare: vi.fn((sql) => ({
      bind: (...params) => {
        statements.push({ sql, params });
        return {
          first: vi.fn().mockResolvedValue(row),
          run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
        };
      },
    })),
  };
  return { db, statements };
}

async function validSessionRow(rawToken, overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    session_id: rawToken.split(".")[0],
    user_id: "user-1",
    stored_session_version: 1,
    token_hash: await hashSessionToken(rawToken),
    created_at: now - 100,
    last_seen_at: now,
    idle_expires_at: now + 3600,
    absolute_expires_at: now + 3600,
    email: "user@example.com",
    display_name: "ETF 캠퍼스",
    status: "active",
    current_session_version: 1,
    ...overrides,
  };
}

describe("/api/member session middleware", () => {
  it("blocks a request without a session cookie", async () => {
    const { db } = createDb();
    const next = vi.fn();
    const response = await onRequest({
      request: authRequest(),
      env: { ETF_PRICES: db },
      data: {},
      next,
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "authentication_required" });
    expect(next).not.toHaveBeenCalled();
  });

  it("passes a valid D1 session user to the protected handler", async () => {
    const rawToken = "abcdefghijklmnopqrstuv.abcdefghijklmnopqrstuvwxyz0123456789abcdef";
    const { db } = createDb(await validSessionRow(rawToken));
    const data = {};
    const next = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    const response = await onRequest({
      request: authRequest(`__Host-etf_session=${rawToken}`),
      env: { ETF_PRICES: db },
      data,
      next,
    });

    expect(response.status).toBe(200);
    expect(next).toHaveBeenCalledTimes(1);
    expect(data.auth.user).toMatchObject({
      id: "user-1",
      email: "user@example.com",
      sessionId: "abcdefghijklmnopqrstuv",
    });
  });

  it("deletes an expired session and clears its browser cookie", async () => {
    const rawToken = "abcdefghijklmnopqrstuv.abcdefghijklmnopqrstuvwxyz0123456789abcdef";
    const { db, statements } = createDb(
      await validSessionRow(rawToken, { idle_expires_at: 1 }),
    );
    const next = vi.fn();

    const response = await onRequest({
      request: authRequest(`__Host-etf_session=${rawToken}`),
      env: { ETF_PRICES: db },
      data: {},
      next,
    });

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(next).not.toHaveBeenCalled();
    expect(statements.some(({ sql }) => sql.includes("DELETE FROM user_sessions"))).toBe(true);
  });
});
