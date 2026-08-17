import {
  getAuthDb,
  hashSessionToken,
  hasTrustedOrigin,
  isValidEmail,
  json,
  normalizeEmail,
  randomId,
  randomToken,
} from "../../_shared/auth.js";

const RESET_TTL_SECONDS = 30 * 60;
const MAX_REQUEST_BYTES = 8 * 1024;

function genericAccepted() {
  return json(
    { message: "입력한 이메일 주소가 등록되어 있다면 재설정 안내를 발송합니다." },
    { status: 202 },
  );
}

function requestTooLarge(request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  return Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES;
}

async function deliverResetLink(env, email, rawToken, eventId) {
  const deliveryUrl = String(env.N8N_AUTH_WEBHOOK_URL ?? env.PASSWORD_RESET_WEBHOOK_URL ?? "");
  const deliveryRequired = env.N8N_WEBHOOK_REQUIRED === "true" || env.PASSWORD_RESET_DELIVERY_REQUIRED === "true";

  if (!deliveryUrl) {
    if (deliveryRequired) throw new Error("PASSWORD_RESET_DELIVERY_NOT_CONFIGURED");
    // 로컬 개발에서는 토큰을 로그·응답에 포함하지 않습니다.
    console.warn("password_reset_delivery_not_configured");
    return;
  }

  const appOrigin = String(env.PUBLIC_APP_ORIGIN ?? "").replace(/\/$/, "");
  const webhookSecret = String(env.N8N_WEBHOOK_SECRET ?? env.PASSWORD_RESET_WEBHOOK_SECRET ?? "");
  if (!appOrigin || webhookSecret.length < 32) {
    throw new Error("PASSWORD_RESET_DELIVERY_CONFIG_INVALID");
  }

  const resetUrl = `${appOrigin}/reset-password?token=${encodeURIComponent(rawToken)}`;
  const response = await fetch(deliveryUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${webhookSecret}`,
      "content-type": "application/json",
      "x-idempotency-key": eventId,
    },
    body: JSON.stringify({
      event: "auth.password_reset_requested",
      eventId,
      occurredAt: new Date().toISOString(),
      data: {
        email,
        resetUrl,
        expiresInSeconds: RESET_TTL_SECONDS,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`PASSWORD_RESET_DELIVERY_FAILED_${response.status}`);
  }
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

  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) return genericAccepted();

  try {
    const user = await db
      .prepare("SELECT id, status FROM auth_users WHERE email = ? LIMIT 1")
      .bind(email)
      .first();

    if (!user || user.status !== "active") return genericAccepted();

    const resetId = randomId();
    const rawToken = randomToken(32);
    const tokenHash = await hashSessionToken(rawToken);
    const now = Math.floor(Date.now() / 1000);

    await db.batch([
      db
        .prepare(
          "DELETE FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL",
        )
        .bind(user.id),
      db
        .prepare(
          `INSERT INTO password_reset_tokens
            (id, user_id, token_hash, created_at, expires_at, used_at)
           VALUES (?, ?, ?, ?, ?, NULL)`,
        )
        .bind(resetId, user.id, tokenHash, now, now + RESET_TTL_SECONDS),
    ]);

    try {
      await deliverResetLink(env, email, rawToken, resetId);
    } catch (deliveryError) {
      await db
        .prepare("DELETE FROM password_reset_tokens WHERE id = ?")
        .bind(resetId)
        .run();
      throw deliveryError;
    }

    return genericAccepted();
  } catch (error) {
    console.error("password_reset_request_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return json({ error: "password_reset_unavailable" }, { status: 503 });
  }
}

export const __testables = { deliverResetLink, requestTooLarge };
