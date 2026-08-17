import { describe, expect, it, vi } from "vitest";
import { hashSessionToken } from "../../../_shared/auth.js";
import { onRequestPost as logout } from "../logout.js";
import { onRequestPost as logoutAll } from "../logout-all.js";

const ENV = {
  PUBLIC_APP_ORIGIN: "https://etfcampus.example.com",
};

function request(path, cookie = "", origin = ENV.PUBLIC_APP_ORIGIN) {
  return new Request(`https://etfcampus.example.com${path}`, {
    method: "POST",
    headers: {
      origin,
      ...(cookie ? { cookie } : {}),
    },
  });
}

function createDb(row = null) {
  const statements = [];
  const db = {
    prepare: vi.fn((sql) => ({
      bind: (...params) => {
        const statement = { sql, params };
        statements.push(statement);
        return {
          first: vi.fn().mockResolvedValue(row),
          run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
          ...statement,
        };
      },
    })),
    batch: vi.fn().mockResolvedValue([]),
  };
  return { db, statements };
}

async function validSessionRow(rawToken) {
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
  };
}

describe("POST /api/auth/logout", () => {
  it("rejects a cross-origin logout request", async () => {
    const { db } = createDb();
    const response = await logout({
      request: request("/api/auth/logout", "", "https://attacker.example"),
      env: { ...ENV, ETF_PRICES: db },
    });

    expect(response.status).toBe(403);
    expect(db.prepare).not.toHaveBeenCalled();
  });

  it("deletes only the current session and clears its cookie", async () => {
    const rawToken = "abcdefghijklmnopqrstuv.abcdefghijklmnopqrstuvwxyz0123456789abcdef";
    const { db, statements } = createDb(await validSessionRow(rawToken));
    const response = await logout({
      request: request("/api/auth/logout", `__Host-etf_session=${rawToken}`),
      env: { ...ENV, ETF_PRICES: db },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(statements.some(({ sql }) => sql === "DELETE FROM user_sessions WHERE session_id = ?")).toBe(true);
  });

  it("remains successful when no session exists", async () => {
    const { db } = createDb(null);
    const response = await logout({
      request: request("/api/auth/logout"),
      env: { ...ENV, ETF_PRICES: db },
    });

    expect(response.status).toBe(204);
  });
});

describe("POST /api/auth/logout-all", () => {
  it("requires a valid current session", async () => {
    const { db } = createDb(null);
    const response = await logoutAll({
      request: request("/api/auth/logout-all"),
      env: { ...ENV, ETF_PRICES: db },
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "authentication_required" });
  });

  it("increments the user session version, deletes all sessions, and clears the current cookie", async () => {
    const rawToken = "abcdefghijklmnopqrstuv.abcdefghijklmnopqrstuvwxyz0123456789abcdef";
    const { db } = createDb(await validSessionRow(rawToken));
    const response = await logoutAll({
      request: request("/api/auth/logout-all", `__Host-etf_session=${rawToken}`),
      env: { ...ENV, ETF_PRICES: db },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(db.batch).toHaveBeenCalledTimes(1);

    const [statements] = db.batch.mock.calls[0];
    expect(statements).toHaveLength(2);
    expect(statements[0].sql).toContain("SET session_version = session_version + 1");
    expect(statements[1].sql).toContain("DELETE FROM user_sessions WHERE user_id = ?");
  });
});
