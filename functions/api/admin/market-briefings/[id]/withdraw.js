import { requirePermission, auditLog } from "../../../../_shared/rbac.js";
import { errorResponse } from "../../../community/_lib/api-security.js";

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const auth = await requirePermission(request, env, "briefing.publish");
  if (auth.error) return auth.error;

  const asOfDate = params.id;
  
  const doc = await env.ETF_PRICES.prepare(`SELECT * FROM market_briefing_editorial_documents WHERE as_of_date = ?`).bind(asOfDate).first();
  if (!doc) return errorResponse(404, "NOT_FOUND", "문서가 존재하지 않습니다.");
  
  if (doc.public_state !== 'published') {
    return errorResponse(400, "VALIDATION_ERROR", "발행된 문서만 발행 취소할 수 있습니다.");
  }

  const publishedVersion = doc.published_version + 1;
  const eventId = crypto.randomUUID();
  const outboxId = crypto.randomUUID();

  const batch = [
    env.ETF_PRICES.prepare(`
      UPDATE market_briefing_editorial_documents
      SET published_revision_no = NULL, published_version = ?, public_state = 'withdrawn', updated_at = CURRENT_TIMESTAMP
      WHERE briefing_id = ?
    `).bind(publishedVersion, doc.briefing_id),
    env.ETF_PRICES.prepare(`
      INSERT INTO market_briefing_editorial_events (event_id, briefing_id, revision_no, event_type, from_status, to_status, actor_type, actor_user_id)
      VALUES (?, ?, ?, 'withdraw', 'published', 'withdrawn', 'user', ?)
    `).bind(eventId, doc.briefing_id, doc.published_revision_no, auth.userId),
    // [Outbox] 트랜잭셔널 아웃박스 기록. 현재 이 행을 소비하는 디스패처/워커가 없으며
    // delivery_status='pending'으로 남는 것이 정상입니다. 향후 멀티채널 팬아웃 시 활성화 예정.
    env.ETF_PRICES.prepare(`
      INSERT INTO market_briefing_editorial_cache_outbox (event_id, briefing_id, as_of_date, revision_no, published_version, action)
      VALUES (?, ?, ?, ?, ?, 'withdraw')
    `).bind(outboxId, doc.briefing_id, asOfDate, doc.published_revision_no, publishedVersion)
  ];

  await env.ETF_PRICES.batch(batch);
  await auditLog(env, "briefing_withdrawn", auth.userId, request, { briefingId: doc.briefing_id, revisionNo: doc.published_revision_no });

  return Response.json({ success: true, publishedVersion });
}
