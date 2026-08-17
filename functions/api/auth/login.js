import {
  buildNewSession,
  buildSessionCookie,
  getAuthDb,
  isValidEmail,
  json,
  normalizeEmail,
  verifyPassword,
} from "../../_shared/auth.js";

const MAX_REQUEST_BYTES = 8 * 1024;

function isTrustedOrigin(request, env) {
  const expectedOrigin = String(env.PUBLIC_APP_ORIGIN ?? "").replace(/\/$/, "");
  return Boolean(expectedOrigin && request.headers.get("origin") === expectedOrigin);
}

function requestTooLarge(request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  return Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES;
}

function invalidCredentials() {
  // 이메일 존재 여부를 구분하지 않아 계정 열거 위험을 줄입니다.
  return json({ error: "invalid_credentials" }, { status: 401 });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = getAuthDb(env);

  if (!db) {
    return json({ error: "service_unavailable" }, { status: 503 });
  }

  if (!isTrustedOrigin(request, env)) {
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

  const email = normalizeEmail(body.email);
  const password = String(body.password ?? "");

  // 로그인 실패 사유는 모두 동일하게 반환합니다.
  if (!isValidEmail(email) || password.length === 0) {
    return invalidCredentials();
  }

  try {
    const user = await db
      .prepare(
        `SELECT
           id,
           email,
           display_name,
           password_hash,
           password_salt,
           status,
           session_version
         FROM auth_users
         WHERE email = ?
         LIMIT 1`,
      )
      .bind(email)
      .first();

    const verified = user
      ? await verifyPassword(password, user.password_salt, user.password_hash, env)
      : false;

    if (!user || !verified || user.status !== "active") {
      return invalidCredentials();
    }

    const session = await buildNewSession(
      env,
      user.id,
      Number(user.session_version),
    );

    await db
      .prepare(
        `INSERT INTO user_sessions
          (session_id, user_id, session_version, token_hash,
           previous_token_hash, previous_token_valid_until,
           created_at, last_seen_at, rotated_at,
           idle_expires_at, absolute_expires_at)
         VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?)`,
      )
      .bind(
        session.sessionId,
        session.userId,
        session.sessionVersion,
        session.tokenHash,
        session.createdAt,
        session.lastSeenAt,
        session.rotatedAt,
        session.idleExpiresAt,
        session.absoluteExpiresAt,
      )
      .run();

    return json(
      {
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
        },
        expiresAt: session.absoluteExpiresAt,
      },
      {
        headers: {
          "set-cookie": buildSessionCookie(
            request,
            session.rawToken,
            session.idleExpiresAt - session.createdAt,
          ),
        },
      },
    );
  } catch (error) {
    if (String(error).includes("AUTH_PASSWORD_PEPPER_MISSING_OR_TOO_SHORT")) {
      return json({ error: "service_misconfigured" }, { status: 503 });
    }

    console.error("auth_login_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return json({ error: "login_failed" }, { status: 500 });
  }
}

export const __testables = {
  isTrustedOrigin,
  requestTooLarge,
};
