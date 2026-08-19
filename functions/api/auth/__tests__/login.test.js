import { describe, expect, it, vi } from "vitest";
import { hashPassword } from "../../../_shared/auth.js";
import { onRequestPost } from "../login.js";

const ENV = {
  AUTH_PASSWORD_PEPPER: "test-password-pepper-must-have-at-least-thirty-two-characters",
  PUBLIC_APP_ORIGIN: "https://etfcampus.example.com",
};

function request(body, options = {}) {
  return new Request("https://etfcampus.example.com/api/auth/login", {
    method: "POST",
    headers: {
      origin: ENV.PUBLIC_APP_ORIGIN,
      "content-type": "application/json",
      ...(options.headers || {}),
    },
    body: JSON.stringify(body),
  });
}

function createDb(user = null) {
  const statements = [];
  const db = {
    prepare: vi.fn((sql) => ({
      bind: (...params) => {
        statements.push({ sql, params });
        return {
          first: vi.fn().mockResolvedValue(user),
          run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
        };
      },
    })),
  };
  return { db, statements };
}

async function registeredUser(password = "long-enough-password") {
  const { passwordHash, passwordSalt } = await hashPassword(password, ENV);
  return {
    id: "user-1",
    email: "user@example.com",
    display_name: "ETF 캠퍼스",
    password_hash: passwordHash,
    password_salt: passwordSalt,
    status: "active",
    session_version: 1,
  };
}

describe("POST /api/auth/login", () => {
  it("rejects cross-origin login requests", async () => {
    const { db } = createDb();
    const response = await onRequestPost({
      request: request(
        { email: "user@example.com", password: "long-enough-password" },
        { headers: { origin: "https://attacker.example" } },
      ),
      env: { ...ENV, ETF_PRICES: db },
    });

    expect(response.status).toBe(403);
    expect(db.prepare).not.toHaveBeenCalled();
  });

  it("returns one generic error for an unknown email", async () => {
    const { db } = createDb(null);
    const response = await onRequestPost({
      request: request({ email: "unknown@example.com", password: "long-enough-password" }),
      env: { ...ENV, ETF_PRICES: db },
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "invalid_credentials" });
  });

  it("returns the same generic error for an invalid password", async () => {
    const { db } = createDb(await registeredUser());
    const response = await onRequestPost({
      request: request({ email: "user@example.com", password: "wrong-password" }),
      env: { ...ENV, ETF_PRICES: db },
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "invalid_credentials" });
  });

  it("creates a new D1 session and secure cookie for valid credentials", async () => {
    const { db, statements } = createDb(await registeredUser());
    const response = await onRequestPost({
      request: request({ email: "User@Example.com", password: "long-enough-password" }),
      env: { ...ENV, ETF_PRICES: db },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("__Host-etf_session=");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Secure");
    await expect(response.json()).resolves.toMatchObject({
      user: { id: "user-1", email: "user@example.com", displayName: "ETF 캠퍼스" },
    });
    expect(statements.some(({ sql }) => sql.includes("INSERT INTO user_sessions"))).toBe(true);
    expect(JSON.stringify(statements)).not.toContain("long-enough-password");
  });
});
