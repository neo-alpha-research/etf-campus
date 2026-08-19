import { emitN8nAuthEvent, runInBackground } from "../../_shared/n8n.js";
import {
  buildNewSession,
  buildSessionCookie,
  hashPassword,
  isExpectedUniqueConstraintError,
  isValidEmail,
  isValidPassword,
  json,
  normalizeEmail,
  randomId,
} from "../../_shared/auth.js";

const MAX_REQUEST_BYTES = 8 * 1024;
const DEFAULT_POLICY_VERSION = "2026-08-16";

function getAuthDb(env) {
  // 운영에서 회원 D1을 분리하면 ETF_AUTH를 추가하고 자동으로 우선 사용합니다.
  return env.ETF_AUTH ?? env.ETF_PRICES;
}

function isTrustedOrigin(request, env) {
  const expectedOrigin = String(env.PUBLIC_APP_ORIGIN ?? "").replace(/\/$/, "");
  const origin = request.headers.get("origin");

  // 이메일 회원가입은 브라우저 상태를 만드는 요청이므로 fail-closed 합니다.
  return Boolean(expectedOrigin && origin === expectedOrigin);
}

function parseDisplayName(value) {
  if (value === undefined || value === null || value === "") return null;

  const displayName = String(value).trim();
  if (displayName.length < 2 || displayName.length > 60) return undefined;
  return displayName;
}

function requestTooLarge(request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  return Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES;
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
  const displayName = parseDisplayName(body.displayName);
  const policyVersion = String(body.policyVersion || DEFAULT_POLICY_VERSION).slice(0, 30);
  const requiredConsent = body.requiredConsent === true;
  const marketingConsent = body.marketingConsent === true;

  if (!isValidEmail(email)) {
    return json({ error: "invalid_email" }, { status: 400 });
  }

  if (!isValidPassword(password)) {
    return json({ error: "invalid_password" }, { status: 400 });
  }

  if (displayName === undefined) {
    return json({ error: "invalid_display_name" }, { status: 400 });
  }

  if (!requiredConsent) {
    return json({ error: "required_consent_missing" }, { status: 400 });
  }

  const existingUser = await db
    .prepare("SELECT id FROM auth_users WHERE email = ? LIMIT 1")
    .bind(email)
    .first();

  if (existingUser) {
    return json({ error: "email_already_registered" }, { status: 409 });
  }

  try {
    const { passwordHash, passwordSalt } = await hashPassword(password, env);
    const userId = randomId();
    const now = Math.floor(Date.now() / 1000);
    const session = await buildNewSession(env, userId);
    const statements = [
      db
        .prepare(
          `INSERT INTO auth_users
            (id, email, password_hash, password_salt, display_name,
             status, session_version, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'active', 1, ?, ?)`,
        )
        .bind(userId, email, passwordHash, passwordSalt, displayName, now, now),
      db
        .prepare(
          `INSERT INTO auth_consents
            (id, user_id, consent_type, policy_version, agreed_at)
           VALUES (?, ?, 'service_required', ?, ?)`,
        )
        .bind(randomId(), userId, policyVersion, now),
      db
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
          userId,
          session.sessionVersion,
          session.tokenHash,
          session.createdAt,
          session.lastSeenAt,
          session.rotatedAt,
          session.idleExpiresAt,
          session.absoluteExpiresAt,
        ),
    ];

    if (marketingConsent) {
      statements.push(
        db
          .prepare(
            `INSERT INTO auth_consents
              (id, user_id, consent_type, policy_version, agreed_at)
             VALUES (?, ?, 'marketing_optional', ?, ?)`,
          )
          .bind(randomId(), userId, policyVersion, now),
      );
    }

    // 회원, 동의, 세션을 하나의 D1 batch로 기록합니다.
    await db.batch(statements);

    // 알림 실패가 회원가입 성공을 롤백하지 않도록 best-effort 비동기 전송합니다.
    runInBackground(
      context,
      emitN8nAuthEvent(env, "auth.user_registered", {
        userId,
        email,
        displayName,
        marketingConsent,
        policyVersion,
      }),
      "n8n_user_registered_event_failed",
    );

    return json(
      {
        user: {
          id: userId,
          email,
          displayName,
        },
        expiresAt: session.absoluteExpiresAt,
      },
      {
        status: 201,
        headers: {
          "set-cookie": buildSessionCookie(
            request,
            session.rawToken,
            session.idleExpiresAt - now,
          ),
        },
      },
    );
  } catch (error) {
    if (isExpectedUniqueConstraintError(error)) {
      // 동시 가입 요청에서 발생하는 중복은 동일한 상태 코드로 처리합니다.
      return json({ error: "email_already_registered" }, { status: 409 });
    }

    if (String(error).includes("AUTH_PASSWORD_PEPPER_MISSING_OR_TOO_SHORT")) {
      return json({ error: "service_misconfigured" }, { status: 503 });
    }

    console.error("auth_register_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return json({ error: "registration_failed" }, { status: 500 });
  }
}

export const __testables = {
  getAuthDb,
  isTrustedOrigin,
  parseDisplayName,
  requestTooLarge,
};
