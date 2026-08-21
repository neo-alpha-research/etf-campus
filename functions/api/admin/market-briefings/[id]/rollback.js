import { requirePermission, auditLog } from "../../../../_shared/rbac.js";
import { errorResponse } from "../../../community/_lib/api-security.js";

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const auth = await requirePermission(request, env, "briefing.rollback");
  if (auth.error) return auth.error;

  const asOfDate = params.id;
  const body = await request.json();
  const targetRevisionNo = body.targetRevisionNo;

  if (!targetRevisionNo) return errorResponse(400, "VALIDATION_ERROR", "복구할 revision 번호가 필요합니다.");

  const doc = await env.ETF_PRICES.prepare(`SELECT * FROM market_briefing_editorial_documents WHERE as_of_date = ?`).bind(asOfDate).first();
  if (!doc) return errorResponse(404, "NOT_FOUND", "문서가 존재하지 않습니다.");

  const targetRev = await env.ETF_PRICES.prepare(`SELECT * FROM market_briefing_editorial_revisions WHERE briefing_id = ? AND revision_no = ?`).bind(doc.briefing_id, targetRevisionNo).first();
  if (!targetRev) return errorResponse(404, "NOT_FOUND", "복구할 revision이 존재하지 않습니다.");

  const newRevisionNo = doc.current_revision_no + 1;
  const revisionId = crypto.randomUUID();
  const publishedVersion = doc.published_version + 1;
  const eventId = crypto.randomUUID();
  const outboxId = crypto.randomUUID();

  // Create a new revision with origin='restore' and workflow_status='published'
  const batch = [
    env.ETF_PRICES.prepare(`
      INSERT INTO market_briefing_editorial_revisions
      (revision_id, briefing_id, revision_no, workflow_status, origin, base_metrics_hash, base_metrics_json,
       title, one_line_text, market_temperature_commentary, summary_markdown, newsletter_cta_title, newsletter_cta_body, newsletter_cta_url, disclosure_text, change_summary, created_by_user_id)
      VALUES (?, ?, ?, 'published', 'restore', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      revisionId, doc.briefing_id, newRevisionNo, targetRev.base_metrics_hash, targetRev.base_metrics_json,
      targetRev.title, targetRev.one_line_text, targetRev.market_temperature_commentary, targetRev.summary_markdown, 
      targetRev.newsletter_cta_title, targetRev.newsletter_cta_body, targetRev.newsletter_cta_url,
      targetRev.disclosure_text, `Restored from revision ${targetRevisionNo}`, auth.userId
    ),
    env.ETF_PRICES.prepare(`
      UPDATE market_briefing_editorial_documents
      SET current_revision_no = ?, published_revision_no = ?, published_version = ?, public_state = 'published', published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE briefing_id = ? AND current_revision_no = ?
    `).bind(newRevisionNo, newRevisionNo, publishedVersion, doc.briefing_id, doc.current_revision_no),
    env.ETF_PRICES.prepare(`
      INSERT INTO market_briefing_editorial_events (event_id, briefing_id, revision_no, event_type, from_status, to_status, actor_type, actor_user_id)
      VALUES (?, ?, ?, 'rollback', ?, 'published', 'user', ?)
    `).bind(eventId, doc.briefing_id, newRevisionNo, doc.public_state, auth.userId),
    // [Outbox] 트랜잭셔널 아웃박스 기록. 현재 이 행을 소비하는 디스패처/워커가 없으며
    // delivery_status='pending'으로 남는 것이 정상입니다. 향후 멀티채널 팬아웃 시 활성화 예정.
    env.ETF_PRICES.prepare(`
      INSERT INTO market_briefing_editorial_cache_outbox (event_id, briefing_id, as_of_date, revision_no, published_version, action)
      VALUES (?, ?, ?, ?, ?, 'publish')
    `).bind(outboxId, doc.briefing_id, asOfDate, newRevisionNo, publishedVersion)
  ];

  await env.ETF_PRICES.batch(batch);
  await auditLog(env, "briefing_rolled_back", auth.userId, request, { briefingId: doc.briefing_id, restoredFrom: targetRevisionNo, newRevisionNo });

  return Response.json({ success: true, newRevisionNo, publishedVersion });
}
