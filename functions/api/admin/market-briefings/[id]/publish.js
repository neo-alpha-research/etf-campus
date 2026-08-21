import { requirePermission, auditLog } from "../../../../_shared/rbac.js";
import { errorResponse } from "../../../community/_lib/api-security.js";

const FORBIDDEN_WORDS = ["매수", "매도", "추천", "확실", "예측"];

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const auth = await requirePermission(request, env, "briefing.publish");
  if (auth.error) return auth.error;

  const asOfDate = params.id;
  const body = await request.json();

  const doc = await env.ETF_PRICES.prepare(`SELECT * FROM market_briefing_editorial_documents WHERE as_of_date = ?`).bind(asOfDate).first();
  if (!doc) return errorResponse(404, "NOT_FOUND", "문서가 존재하지 않습니다.");

  if (body.expectedRevisionNo !== doc.current_revision_no) {
    return errorResponse(409, "VALIDATION_ERROR", "revision_conflict: 문서 상태가 변경되었습니다.");
  }

  const rev = await env.ETF_PRICES.prepare(`SELECT * FROM market_briefing_editorial_revisions WHERE briefing_id = ? AND revision_no = ?`).bind(doc.briefing_id, doc.current_revision_no).first();
  
  const fullText = `${rev.title} ${rev.one_line_text} ${rev.market_temperature_commentary} ${rev.summary_markdown}`;
  const foundWords = FORBIDDEN_WORDS.filter(w => fullText.includes(w));
  if (foundWords.length > 0) {
    return errorResponse(400, "VALIDATION_ERROR", `금칙어가 포함되어 발행할 수 없습니다: ${foundWords.join(", ")}`);
  }

  const publishedVersion = doc.published_version + 1;
  const eventId = crypto.randomUUID();
  const outboxId = crypto.randomUUID();

  const batch = [
    env.ETF_PRICES.prepare(`
      UPDATE market_briefing_editorial_revisions SET workflow_status = 'published' WHERE briefing_id = ? AND revision_no = ?
    `).bind(doc.briefing_id, doc.current_revision_no),
    env.ETF_PRICES.prepare(`
      UPDATE market_briefing_editorial_documents
      SET published_revision_no = ?, published_version = ?, public_state = 'published', published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE briefing_id = ? AND current_revision_no = ?
    `).bind(doc.current_revision_no, publishedVersion, doc.briefing_id, doc.current_revision_no),
    env.ETF_PRICES.prepare(`
      INSERT INTO market_briefing_editorial_events (event_id, briefing_id, revision_no, event_type, from_status, to_status, actor_type, actor_user_id)
      VALUES (?, ?, ?, 'publish', ?, 'published', 'user', ?)
    `).bind(eventId, doc.briefing_id, doc.current_revision_no, doc.public_state, auth.userId),
    // [Outbox] 트랜잭셔널 아웃박스 기록. 현재 이 행을 소비하는 디스패처/워커가 없으며
    // delivery_status='pending'으로 남는 것이 정상입니다. 향후 멀티채널 팬아웃 시 활성화 예정.
    env.ETF_PRICES.prepare(`
      INSERT INTO market_briefing_editorial_cache_outbox (event_id, briefing_id, as_of_date, revision_no, published_version, action)
      VALUES (?, ?, ?, ?, ?, 'publish')
    `).bind(outboxId, doc.briefing_id, asOfDate, doc.current_revision_no, publishedVersion)
  ];

  await env.ETF_PRICES.batch(batch);
  await auditLog(env, "briefing_published", auth.userId, request, { briefingId: doc.briefing_id, revisionNo: doc.current_revision_no, publishedVersion });

  return Response.json({ success: true, publishedVersion });
}
