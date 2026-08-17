import { describe, expect, it, vi } from "vitest";
import { onRequestPost } from "../register.js";

const ENV = {
  AUTH_PASSWORD_PEPPER: "test-password-pepper-must-have-at-least-thirty-two-characters",
  PUBLIC_APP_ORIGIN: "https://etfcampus.example.com",
};

function request(body, options = {}) {
  return new Request("https://etfcampus.example.com/api/auth/register", {
    method: "POST",
    headers: {
      origin: ENV.PUBLIC_APP_ORIGIN,
      "content-type": "application/json",
      ...(options.headers || {}),
    },
    body: options.rawBody ?? JSON.stringify(body),
  });
}

function createDb({ existingUser = null, batchError = null } = {}) {
  const statements = [];
  const db = {
    prepare: vi.fn((sql) => ({
      bind: (...params) => {
        const statement = { sql, params };
        statements.push(statement);
        return {
          first: vi.fn().mockResolvedValue(
            sql.includes("SELECT id FROM auth_users") ? existingUser : null,
          ),
          run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
          ...statement,
        };
      },
    })),
    batch: batchError
      ? vi.fn().mockRejectedValue(batchError)
      : vi.fn().mockResolvedValue([]),
  };

  return { db, statements };
}

describe("POST /api/auth/register", () => {
  it("rejects cross-origin membership creation", async () => {
    const { db } = createDb();
    const response = await onRequestPost({
      request: request(
        { email: "user@example.com", password: "long-enough-password", requiredConsent: true },
        { headers: { origin: "https://attacker.example" } },
      ),
      env: { ...ENV, ETF_PRICES: db },
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "request_not_allowed" });
    expect(db.prepare).not.toHaveBeenCalled();
  });

  it("rejects a password shorter than ten characters", async () => {
    const { db } = createDb();
    const response = await onRequestPost({
      request: request({ email: "user@example.com", password: "short", requiredConsent: true }),
      env: { ...ENV, ETF_PRICES: db },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_password" });
    expect(db.batch).not.toHaveBeenCalled();
  });

  it("rejects registration without required consent", async () => {
    const { db } = createDb();
    const response = await onRequestPost({
      request: request({ email: "user@example.com", password: "long-enough-password" }),
      env: { ...ENV, ETF_PRICES: db },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "required_consent_missing" });
    expect(db.batch).not.toHaveBeenCalled();
  });

  it("returns a conflict for an existing email", async () => {
    const { db } = createDb({ existingUser: { id: "existing-user" } });
    const response = await onRequestPost({
      request: request({ email: "User@Example.com", password: "long-enough-password", requiredConsent: true }),
      env: { ...ENV, ETF_PRICES: db },
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "email_already_registered" });
    expect(db.batch).not.toHaveBeenCalled();
  });

  it("creates user, required consent, session and a secure session cookie", async () => {
    const { db, statements } = createDb();
    const response = await onRequestPost({
      request: request({
        email: "User@Example.com",
        password: "long-enough-password",
        displayName: "ETF 캠퍼스",
        requiredConsent: true,
        marketingConsent: true,
      }),
      env: { ...ENV, ETF_PRICES: db },
    });

    expect(response.status).toBe(201);
    expect(response.headers.get("set-cookie")).toContain("__Host-etf_session=");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Secure");
    expect(response.headers.get("set-cookie")).toContain("SameSite=Lax");

    await expect(response.json()).resolves.toMatchObject({
      user: {
        email: "user@example.com",
        displayName: "ETF 캠퍼스",
      },
    });
    expect(db.batch).toHaveBeenCalledTimes(1);
    expect(db.batch.mock.calls[0][0]).toHaveLength(4);
    expect(JSON.stringify(statements)).not.toContain("long-enough-password");
  });

  it("returns a conflict when a concurrent insert violates the unique email constraint", async () => {
    const { db } = createDb({ batchError: new Error("UNIQUE constraint failed: auth_users.email") });
    const response = await onRequestPost({
      request: request({ email: "user@example.com", password: "long-enough-password", requiredConsent: true }),
      env: { ...ENV, ETF_PRICES: db },
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "email_already_registered" });
  });
});
