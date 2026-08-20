import { errorResponse } from "../api/community/_lib/api-security.js";

export async function requirePermission(request, env, requiredAction) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(/__Host-etf_admin_session=([^;]+)/);
  if (!match) return { error: errorResponse(401, "UNAUTHORIZED", "로그인이 필요합니다.") };
  
  const sessionId = match[1];

  const session = await env.ETF_PRICES.prepare(
    `SELECT s.user_id, s.expires_at, u.role_id, u.status 
     FROM admin_user_sessions s
     JOIN admin_users u ON s.user_id = u.user_id
     WHERE s.session_id = ?`
  ).bind(sessionId).first();

  if (!session || session.status !== 'active' || new Date(session.expires_at) < new Date()) {
    return { error: errorResponse(401, "UNAUTHORIZED", "세션이 만료되었거나 유효하지 않습니다.") };
  }

  if (requiredAction) {
    const role = await env.ETF_PRICES.prepare(
      `SELECT permissions_json FROM admin_auth_roles WHERE role_id = ?`
    ).bind(session.role_id).first();
    
    if (!role) return { error: errorResponse(403, "FORBIDDEN", "권한이 없습니다.") };
    
    const permissions = JSON.parse(role.permissions_json || "[]");
    if (!permissions.includes(requiredAction) && !permissions.includes("superuser")) {
      return { error: errorResponse(403, "FORBIDDEN", "이 작업을 수행할 권한이 없습니다.") };
    }
  }

  return { userId: session.user_id, roleId: session.role_id };
}

export async function hashWithPepper(value, pepper) {
  if (!value) return null;
  if (!pepper) throw new Error("Missing pepper");
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function auditLog(env, actionName, userId, request, resourceSnapshot = {}) {
  const pepper = env.AUDIT_HASH_PEPPER;
  if (!pepper) throw new Error("Missing AUDIT_HASH_PEPPER in env");

  const ipHash = await hashWithPepper(request.headers.get("cf-connecting-ip") || "unknown", pepper);
  const uaHash = await hashWithPepper(request.headers.get("user-agent") || "unknown", pepper);

  const logId = crypto.randomUUID();
  await env.ETF_PRICES.prepare(
    `INSERT INTO admin_audit_logs (log_id, action_name, actor_user_id, ip_hash, user_agent_hash, resource_snapshot)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    logId, actionName, userId,
    ipHash, uaHash,
    JSON.stringify(resourceSnapshot)
  ).run();
}
