import {
  getAuthDb,
  hashPassword,
  hashSessionToken,
  hasTrustedOrigin,
  isValidPassword,
  json,
} from "../../_shared/auth.js";

const MAX_REQUEST_BYTES = 8 * 1024;

function invalidToken() {
  return json({ error: "invalid_or_expired_token" }, { status: 400 });
}

function requestTooLarge(request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  return Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = getAuthDb(env);

  if (!db) return json({ error: "service_unavailable" }, { status: 503 });
  if (!hasTrustedOrigin(request, env)) {
    return json({ error: "request_not_allowed" }, { status: 403 });
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return json({ error: "json_content_type_required" }, { status: 415 });
  }
  if (requestTooLarge(request)) {
    return json({ error: "request_too_large" }, { status: 413 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, { status: 400 });
  }

  const token = String(body.token ?? "").trim();
  const newPassword = String(body.newPassword ?? "");
  const confirmPassword = String(body.confirmPassword ?? "");

  if (token.length < 40 || !isValidPassword(newPassword) || newPassword !== confirmPassword) {
    return invalidToken();
  }

  try {
    const tokenHash = await hashSessionToken(token);
    const now = Math.floor(Date.now() / 1000);
    const tokenRow = await db
      .prepare(
        `SELECT
           r.id AS reset_id,
           r.user_id,
           u.status
         FROM password_reset_tokens r
         JOIN auth_users u ON u.id = r.user_id
         WHERE r.token_hash = ?
           AND r.used_at IS NULL
           AND r.expires_at > ?
         LIMIT 1`,
      )
      .bind(tokenHash, now)
      .first();

    if (!tokenRow || tokenRow.status !== "active") return invalidToken();

    // 먼저 조건부로 토큰을 소비합니다. 동시 요청 중 하나만 변경에 성공합니다.
    const claim = await db
      .prepare(
        `UPDATE password_reset_tokens
         SET used_at = ?
         WHERE id = ? AND used_at IS NULL AND expires_at > ?`,
      )
      .bind(now, tokenRow.reset_id, now)
      .run();

    if (Number(claim.meta?.changes ?? 0) !== 1) return invalidToken();

    const { passwordHash, passwordSalt } = await hashPassword(newPassword, env);

    // 비밀번호 변경과 세션 전체 폐기를 하나의 D1 batch로 처리합니다.
    await db.batch([
      db
        .prepare(
          `UPDATE auth_users
           SET password_hash = ?, password_salt = ?,
               session_version = session_version + 1,
               updated_at = ?
           WHERE id = ? AND status = 'active'`,
        )
        .bind(passwordHash, passwordSalt, now, tokenRow.user_id),
      db
        .prepare("DELETE FROM user_sessions WHERE user_id = ?")
        .bind(tokenRow.user_id),
      db
        .prepare("DELETE FROM password_reset_tokens WHERE user_id = ?")
        .bind(tokenRow.user_id),
    ]);

    return json({ message: "비밀번호가 변경되었습니다. 다시 로그인해 주세요." });
  } catch (error) {
    if (String(error).includes("AUTH_PASSWORD_PEPPER_MISSING_OR_TOO_SHORT")) {
      return json({ error: "service_misconfigured" }, { status: 503 });
    }

    console.error("password_reset_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return json({ error: "password_reset_unavailable" }, { status: 503 });
  }
}
