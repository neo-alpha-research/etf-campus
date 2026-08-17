const SESSION_IDLE_TTL_SECONDS = 7 * 24 * 60 * 60;
const SESSION_ABSOLUTE_TTL_SECONDS = 30 * 24 * 60 * 60;
const SESSION_TOUCH_INTERVAL_SECONDS = 15 * 60;
const PASSWORD_ITERATIONS = 210_000;

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function base64UrlToBytes(value) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function constantTimeEqual(left, right) {
  if (!left || !right) return false;

  try {
    const a = base64UrlToBytes(left);
    const b = base64UrlToBytes(right);
    if (a.length !== b.length) return false;

    let difference = 0;
    for (let index = 0; index < a.length; index += 1) {
      difference |= a[index] ^ b[index];
    }
    return difference === 0;
  } catch {
    return false;
  }
}

export function randomToken(byteLength) {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export function randomId() {
  return crypto.randomUUID();
}

export function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function isValidEmail(email) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPassword(password) {
  return password.length >= 10 && password.length <= 128;
}

function passwordMaterial(password, pepper) {
  return new TextEncoder().encode(`${password}\u0000${pepper}`);
}

function requirePasswordPepper(env) {
  const pepper = String(env.AUTH_PASSWORD_PEPPER ?? "");
  if (pepper.length < 32) {
    throw new Error("AUTH_PASSWORD_PEPPER_MISSING_OR_TOO_SHORT");
  }
  return pepper;
}

async function derivePasswordHash(password, salt, env) {
  const pepper = requirePasswordPepper(env);
  const key = await crypto.subtle.importKey(
    "raw",
    passwordMaterial(password, pepper),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: PASSWORD_ITERATIONS,
      hash: "SHA-256",
    },
    key,
    256,
  );

  return new Uint8Array(bits);
}

export async function hashPassword(password, env) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePasswordHash(password, salt, env);

  return {
    passwordHash: bytesToBase64Url(hash),
    passwordSalt: bytesToBase64Url(salt),
  };
}

export async function verifyPassword(password, passwordSalt, expectedHash, env) {
  try {
    const salt = base64UrlToBytes(passwordSalt);
    const actualHash = await derivePasswordHash(password, salt, env);
    return constantTimeEqual(bytesToBase64Url(actualHash), expectedHash);
  } catch {
    return false;
  }
}

export async function hashSessionToken(rawToken) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(rawToken),
  );
  return bytesToBase64Url(new Uint8Array(digest));
}

function isSecureRequest(request) {
  return new URL(request.url).protocol === "https:";
}

function sessionCookieName(request) {
  return isSecureRequest(request) ? "__Host-etf_session" : "etf_session";
}

export function buildSessionCookie(request, rawToken, maxAge) {
  const attributes = [
    `${sessionCookieName(request)}=${rawToken}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.max(0, Math.floor(maxAge))}`,
  ];

  if (isSecureRequest(request)) attributes.push("Secure");
  return attributes.join("; ");
}

export function clearSessionCookie(request) {
  return buildSessionCookie(request, "", 0);
}

function parseCookie(request, name) {
  const cookieHeader = request.headers.get("cookie") || "";
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return null;
}

function parseSessionToken(rawToken) {
  if (!rawToken) return null;
  const [sessionId, secret, ...rest] = rawToken.split(".");
  if (rest.length > 0 || !sessionId || !secret || sessionId.length < 20 || secret.length < 40) {
    return null;
  }
  return { sessionId, secret };
}

export function getAuthDb(env) {
  // 운영에서 회원 전용 D1을 추가하면 자동으로 우선 사용합니다.
  return env.ETF_AUTH ?? env.ETF_PRICES;
}

export function hasTrustedOrigin(request, env) {
  const expectedOrigin = String(env.PUBLIC_APP_ORIGIN ?? "").replace(/\/$/, "");
  return Boolean(expectedOrigin && request.headers.get("origin") === expectedOrigin);
}

export async function buildNewSession(env, userId, sessionVersion = 1) {
  const now = nowSeconds();
  const sessionId = randomToken(16);
  const secret = randomToken(32);
  const rawToken = `${sessionId}.${secret}`;

  return {
    sessionId,
    userId,
    sessionVersion,
    tokenHash: await hashSessionToken(rawToken),
    createdAt: now,
    lastSeenAt: now,
    rotatedAt: now,
    idleExpiresAt: now + SESSION_IDLE_TTL_SECONDS,
    absoluteExpiresAt: now + SESSION_ABSOLUTE_TTL_SECONDS,
    rawToken,
  };
}

function publicSessionUser(row) {
  return {
    id: row.user_id,
    email: row.email,
    displayName: row.display_name,
    sessionId: row.session_id,
    sessionVersion: Number(row.stored_session_version),
    idleExpiresAt: Number(row.idle_expires_at),
    absoluteExpiresAt: Number(row.absolute_expires_at),
  };
}

export async function getSession(request, env) {
  const db = getAuthDb(env);
  const parsedToken = parseSessionToken(
    parseCookie(request, sessionCookieName(request)),
  );

  if (!db || !parsedToken) {
    return { user: null, setCookie: parsedToken ? clearSessionCookie(request) : null };
  }

  const row = await db
    .prepare(
      `SELECT
         s.session_id,
         s.user_id,
         s.session_version AS stored_session_version,
         s.token_hash,
         s.created_at,
         s.last_seen_at,
         s.idle_expires_at,
         s.absolute_expires_at,
         u.email,
         u.display_name,
         u.status,
         u.session_version AS current_session_version
       FROM user_sessions s
       JOIN auth_users u ON u.id = s.user_id
       WHERE s.session_id = ?
       LIMIT 1`,
    )
    .bind(parsedToken.sessionId)
    .first();

  if (!row) {
    return { user: null, setCookie: clearSessionCookie(request) };
  }

  const now = nowSeconds();
  const isExpired =
    Number(row.idle_expires_at) <= now ||
    Number(row.absolute_expires_at) <= now;
  const isRevoked =
    row.status !== "active" ||
    Number(row.stored_session_version) !== Number(row.current_session_version);

  if (isExpired || isRevoked) {
    await db
      .prepare("DELETE FROM user_sessions WHERE session_id = ?")
      .bind(parsedToken.sessionId)
      .run();
    return { user: null, setCookie: clearSessionCookie(request) };
  }

  const incomingHash = await hashSessionToken(
    `${parsedToken.sessionId}.${parsedToken.secret}`,
  );
  if (!constantTimeEqual(incomingHash, row.token_hash)) {
    // 잘못된 쿠키만 삭제합니다. 세션 자체를 삭제하면 session_id를 추측한
    // 제3자가 정상 사용자를 강제 로그아웃시킬 수 있습니다.
    return { user: null, setCookie: clearSessionCookie(request) };
  }

  const shouldTouch = Number(row.last_seen_at) + SESSION_TOUCH_INTERVAL_SECONDS <= now;
  if (!shouldTouch) {
    return { user: publicSessionUser(row), setCookie: null };
  }

  const nextIdleExpiresAt = Math.min(
    now + SESSION_IDLE_TTL_SECONDS,
    Number(row.absolute_expires_at),
  );
  await db
    .prepare(
      `UPDATE user_sessions
       SET last_seen_at = ?, idle_expires_at = ?
       WHERE session_id = ?`,
    )
    .bind(now, nextIdleExpiresAt, parsedToken.sessionId)
    .run();

  return {
    user: {
      ...publicSessionUser(row),
      idleExpiresAt: nextIdleExpiresAt,
    },
    setCookie: buildSessionCookie(
      request,
      `${parsedToken.sessionId}.${parsedToken.secret}`,
      Math.min(
        nextIdleExpiresAt - now,
        Number(row.absolute_expires_at) - now,
      ),
    ),
  };
}

export async function destroyCurrentSession(request, env) {
  const db = getAuthDb(env);
  const session = await getSession(request, env);

  if (db && session.user) {
    await db
      .prepare("DELETE FROM user_sessions WHERE session_id = ?")
      .bind(session.user.sessionId)
      .run();
  }

  return {
    user: session.user,
    setCookie: clearSessionCookie(request),
  };
}

export async function revokeAllUserSessions(request, env) {
  const db = getAuthDb(env);
  const session = await getSession(request, env);

  if (!db || !session.user) {
    return {
      user: null,
      setCookie: session.setCookie ?? clearSessionCookie(request),
    };
  }

  const now = nowSeconds();
  await db.batch([
    db
      .prepare(
        `UPDATE auth_users
         SET session_version = session_version + 1, updated_at = ?
         WHERE id = ? AND status = 'active'`,
      )
      .bind(now, session.user.id),
    // 세션 버전 변경은 동시 로그인으로 뒤늦게 삽입된 이전 버전 세션도
    // 무효화합니다. 기존 레코드는 즉시 삭제해 저장소를 정리합니다.
    db
      .prepare("DELETE FROM user_sessions WHERE user_id = ?")
      .bind(session.user.id),
  ]);

  return {
    user: session.user,
    setCookie: clearSessionCookie(request),
  };
}

export function appendSetCookie(response, cookie) {
  if (!cookie) return response;

  const headers = new Headers(response.headers);
  headers.append("set-cookie", cookie);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function json(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");

  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

export function isExpectedUniqueConstraintError(error) {
  return /unique constraint|constraint failed/i.test(String(error));
}

export const __testables = {
  constantTimeEqual,
  isValidEmail,
  isValidPassword,
  normalizeEmail,
  parseSessionToken,
};
