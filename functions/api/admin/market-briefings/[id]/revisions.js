import { requirePermission, auditLog } from "../../../../_shared/rbac.js";
import { errorResponse } from "../../../community/_lib/api-security.js";

const FORBIDDEN_WORDS = ["매수", "매도", "추천", "확실", "예측"];

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const auth = await requirePermission(request, env, "briefing.edit");
  if (auth.error) return auth.error;

  const asOfDate = params.id;
  const body = await request.json();

  const doc = await env.ETF_PRICES.prepare(`SELECT * FROM market_briefing_editorial_documents WHERE as_of_date = ?`).bind(asOfDate).first();
  if (!doc) {
    return errorResponse(404, "NOT_FOUND", "문서가 존재하지 않습니다.");
  }

  if (body.baseMetricsHash !== doc.base_metrics_hash || body.baseSourceVersion !== doc.base_source_version) {
    return errorResponse(409, "VALIDATION_ERROR", "source_revision_required: 기준 데이터가 변경되었습니다. 새로고침 후 다시 시도해주세요.");
  }
  
  if (body.expectedRevisionNo !== doc.current_revision_no) {
    return errorResponse(409, "VALIDATION_ERROR", "revision_conflict: 문서가 다른 사용자에 의해 수정되었습니다.");
  }

  // Validate limits
  if (!body.title || body.title.length < 10 || body.title.length > 100) return errorResponse(400, "VALIDATION_ERROR", "제목은 10~100자여야 합니다.");
  if (!body.oneLineText || body.oneLineText.length < 20 || body.oneLineText.length > 180) return errorResponse(400, "VALIDATION_ERROR", "한 줄 요약은 20~180자여야 합니다.");
  if (!body.marketTemperatureCommentary || body.marketTemperatureCommentary.length < 40 || body.marketTemperatureCommentary.length > 500) return errorResponse(400, "VALIDATION_ERROR", "시장 해설은 40~500자여야 합니다.");
  if (!body.changeSummary || body.changeSummary.length < 8 || body.changeSummary.length > 240) return errorResponse(400, "VALIDATION_ERROR", "변경 사유는 8~240자여야 합니다.");

  // Check forbidden words (we still allow saving draft, but record audit)
  const fullText = `${body.title} ${body.oneLineText} ${body.marketTemperatureCommentary} ${body.summaryMarkdown}`;
  const foundWords = FORBIDDEN_WORDS.filter(w => fullText.includes(w));
  if (foundWords.length > 0) {
    await auditLog(env, "forbidden_words_detected", auth.userId, request, { words: foundWords });
  }

  const newRevisionNo = doc.current_revision_no + 1;
  const revisionId = crypto.randomUUID();
  
  // We need metrics_json from the previous revision
  const prevRev = await env.ETF_PRICES.prepare(`SELECT base_metrics_json FROM market_briefing_editorial_revisions WHERE briefing_id = ? AND revision_no = ?`).bind(doc.briefing_id, doc.current_revision_no).first();

  const batch = [
    env.ETF_PRICES.prepare(`
      INSERT INTO market_briefing_editorial_revisions
      (revision_id, briefing_id, revision_no, workflow_status, origin, base_metrics_hash, base_metrics_json,
       title, one_line_text, market_temperature_commentary, summary_markdown, newsletter_cta_title, newsletter_cta_body, newsletter_cta_url, disclosure_text, change_summary, created_by_user_id)
      VALUES (?, ?, ?, 'draft', 'editor', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      revisionId, doc.briefing_id, newRevisionNo, doc.base_metrics_hash, prevRev.base_metrics_json,
      body.title, body.oneLineText, body.marketTemperatureCommentary, body.summaryMarkdown, 
      body.newsletterCtaTitle || null, body.newsletterCtaBody || null, body.newsletterCtaUrl || null,
      body.disclosureText || "", body.changeSummary, auth.userId
    ),
    env.ETF_PRICES.prepare(`
      UPDATE market_briefing_editorial_documents
      SET current_revision_no = ?, updated_at = CURRENT_TIMESTAMP
      WHERE briefing_id = ? AND current_revision_no = ?
    `).bind(newRevisionNo, doc.briefing_id, doc.current_revision_no)
  ];

  await env.ETF_PRICES.batch(batch);
  await auditLog(env, "briefing_revision_saved", auth.userId, request, { briefingId: doc.briefing_id, revisionNo: newRevisionNo });

  return Response.json({ success: true, revisionNo: newRevisionNo, hasForbiddenWords: foundWords.length > 0, forbiddenWords: foundWords });
}
