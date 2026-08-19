import { describe, expect, it, vi } from "vitest";
import { hashSessionToken } from "../../../_shared/auth.js";
import { onRequestPost as requestReset } from "../password-reset-request.js";
import { onRequestPost as resetPassword } from "../password-reset.js";

const ENV = {
  AUTH_PASSWORD_PEPPER: "test-password-pepper-must-have-at-least-thirty-two-characters",
  PUBLIC_APP_ORIGIN: "https://etfcampus.example.com",
  PASSWORD_RESET_DELIVERY_REQUIRED: "false",
};

function request(path, body, origin = ENV.PUBLIC_APP_ORIGIN) {
  return new Request(`https://etfcampus.example.com${path}`, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createDb({ user = null, tokenRow = null, claimChanges = 1 } = {}) {
  const statements = [];
  const db = {
    prepare: vi.fn((sql) => ({
      bind: (...params) => {
        const statement = { sql, params };
        statements.push(statement);
        return {
          first: vi.fn().mockResolvedValue(
            sql.includes("FROM auth_users") ? user : tokenRow,
          ),
          run: vi.fn().mockResolvedValue({ meta: { changes: claimChanges } }),
          ...statement,
        };
      },
    })),
    batch: vi.fn().mockResolvedValue([]),
  };
  return { db, statements };
}

const activeUser = { id: "user-1", status: "active" };
const resetToken = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

describe("POST /api/auth/password-reset-request", () => {
  it("returns the same accepted response for an unknown email", async () => {
    const { db } = createDb();
    const response = await requestReset({
      request: request("/api/auth/password-reset-request", { email: "unknown@example.com" }),
      env: { ...ENV, ETF_PRICES: db },
    });

    expect(response.status).toBe(202);
    expect(db.batch).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      message: "입력한 이메일 주소가 등록되어 있다면 재설정 안내를 발송합니다.",
    });
  });

  it("creates only a hashed reset token without exposing the raw token", async () => {
    const { db, statements } = createDb({ user: activeUser });
    const response = await requestReset({
      request: request("/api/auth/password-reset-request", { email: "user@example.com" }),
      env: { ...ENV, ETF_PRICES: db },
    });

    expect(response.status).toBe(202);
    expect(await response.text()).not.toContain("token");
    expect(db.batch).toHaveBeenCalledTimes(1);
    expect(statements.some(({ sql }) => sql.includes("INSERT INTO password_reset_tokens"))).toBe(true);
  });
});

describe("POST /api/auth/password-reset", () => {
  it("rejects an already-consumed token", async () => {
    const tokenHash = await hashSessionToken(resetToken);
    const { db } = createDb({
      tokenRow: { reset_id: "reset-1", user_id: "user-1", status: "active", token_hash: tokenHash },
      claimChanges: 0,
    });
    const response = await resetPassword({
      request: request("/api/auth/password-reset", {
        token: resetToken,
        newPassword: "new-long-password",
        confirmPassword: "new-long-password",
      }),
      env: { ...ENV, ETF_PRICES: db },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_or_expired_token" });
    expect(db.batch).not.toHaveBeenCalled();
  });

  it("changes the password and invalidates every existing session", async () => {
    const tokenHash = await hashSessionToken(resetToken);
    const { db, statements } = createDb({
      tokenRow: { reset_id: "reset-1", user_id: "user-1", status: "active", token_hash: tokenHash },
      claimChanges: 1,
    });
    const response = await resetPassword({
      request: request("/api/auth/password-reset", {
        token: resetToken,
        newPassword: "new-long-password",
        confirmPassword: "new-long-password",
      }),
      env: { ...ENV, ETF_PRICES: db },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: "비밀번호가 변경되었습니다. 다시 로그인해 주세요.",
    });
    expect(db.batch).toHaveBeenCalledTimes(1);
    const [batchStatements] = db.batch.mock.calls[0];
    expect(batchStatements).toHaveLength(3);
    expect(batchStatements[0].sql).toContain("session_version = session_version + 1");
    expect(batchStatements[1].sql).toContain("DELETE FROM user_sessions");
    expect(batchStatements[2].sql).toContain("DELETE FROM password_reset_tokens");
    expect(JSON.stringify(statements)).not.toContain("new-long-password");
  });
});
