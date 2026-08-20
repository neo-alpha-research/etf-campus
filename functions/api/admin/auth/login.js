import { errorResponse } from "../../community/_lib/api-security.js";
import { auditLog, hashWithPepper } from "../../../_shared/rbac.js";

export async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.json();

  if (!env.AUDIT_HASH_PEPPER) {
    return new Response(JSON.stringify({ error: { message: "Internal server error: missing config" } }), { status: 500 });
  }

  if (!body.username || !body.password) {
    return errorResponse(400, "VALIDATION_ERROR", "아이디와 비밀번호를 입력해주세요.");
  }

  const user = await env.ETF_PRICES.prepare(
    `SELECT * FROM admin_users WHERE username = ?`
  ).bind(body.username).first();

  // Rate limiting / dummy hashing to prevent timing attacks
  const salt = user ? user.user_id : "dummy_salt_for_timing_attack_prevention";
  const providedHash = await hashPassword(body.password, salt);

  if (!user || user.status !== 'active') {
    if (user) await auditLog(env, "login_failed", user.user_id, request, { reason: "inactive_user", username: body.username });
    return errorResponse(401, "UNAUTHORIZED", "아이디 또는 비밀번호가 올바르지 않습니다.");
  }

  if (providedHash !== user.password_hash) {
    await auditLog(env, "login_failed", user.user_id, request, { reason: "invalid_password" });
    return errorResponse(401, "UNAUTHORIZED", "아이디 또는 비밀번호가 올바르지 않습니다.");
  }

  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours

  const clientIp = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
  const userAgent = request.headers.get("User-Agent") || "unknown";

  const ipHash = await hashWithPepper(clientIp, env.AUDIT_HASH_PEPPER);
  const uaHash = await hashWithPepper(userAgent, env.AUDIT_HASH_PEPPER);

  await env.ETF_PRICES.prepare(
    `INSERT INTO admin_user_sessions (session_id, user_id, ip_hash, user_agent_hash, expires_at)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(
    sessionId, user.user_id, ipHash, uaHash, expiresAt.toISOString()
  ).run();

  await auditLog(env, "login_success", user.user_id, request, { sessionId });

  const cookie = `__Host-etf_admin_session=${sessionId}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${8 * 60 * 60}`;
  
  return new Response(JSON.stringify({ success: true, userId: user.user_id }), {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": cookie
    }
  });
}
