import { requirePermission, auditLog } from "../../../../_shared/rbac.js";
import { errorResponse } from "../../../community/_lib/api-security.js";

async function createSystemDraft(env, asOfDate, briefing, authUserId, request) {
  const briefingId = crypto.randomUUID();
  const revisionId = crypto.randomUUID();
  const metricsHash = crypto.randomUUID().slice(0, 8); // simple hash stub

  const batch = [
    env.ETF_PRICES.prepare(
      `INSERT INTO market_briefing_editorial_documents (briefing_id, as_of_date, current_revision_no, base_metrics_hash, base_source_version)
       VALUES (?, ?, 1, ?, ?)`
    ).bind(briefingId, asOfDate, metricsHash, briefing.publication_version),
    env.ETF_PRICES.prepare(
      `INSERT INTO market_briefing_editorial_revisions 
       (revision_id, briefing_id, revision_no, workflow_status, origin, base_metrics_hash, base_metrics_json, title, change_summary, created_by_user_id)
       VALUES (?, ?, 1, 'draft', 'system_init', ?, ?, ?, ?, ?)`
    ).bind(revisionId, briefingId, metricsHash, briefing.metrics_json, "초기 생성 초안", "System Initialization", authUserId)
  ];
  
  await env.ETF_PRICES.batch(batch);
  await auditLog(env, "briefing_document_created", authUserId, request, { briefingId, asOfDate });
  
  return { briefingId, currentRevisionNo: 1, baseMetricsHash: metricsHash };
}

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const auth = await requirePermission(request, env, "briefing.draft.read");
  if (auth.error) return auth.error;

  const asOfDate = params.id;

  const briefing = await env.ETF_PRICES.prepare(
    `SELECT * FROM market_briefings WHERE as_of_date = ?`
  ).bind(asOfDate).first();

  if (!briefing) return errorResponse(404, "NOT_FOUND", "데이터가 존재하지 않습니다.");

  let doc = await env.ETF_PRICES.prepare(
    `SELECT * FROM market_briefing_editorial_documents WHERE as_of_date = ?`
  ).bind(asOfDate).first();

  if (!doc) {
    // Generate lazy system draft
    const newDoc = await createSystemDraft(env, asOfDate, briefing, auth.userId, request);
    doc = { 
      briefing_id: newDoc.briefingId, 
      current_revision_no: 1, 
      public_state: 'draft', 
      base_metrics_hash: newDoc.baseMetricsHash 
    };
  }

  const currentRevision = await env.ETF_PRICES.prepare(
    `SELECT * FROM market_briefing_editorial_revisions WHERE briefing_id = ? AND revision_no = ?`
  ).bind(doc.briefing_id, doc.current_revision_no).first();

  return Response.json({
    asOfDate,
    sourceVersion: briefing.publication_version,
    metrics: JSON.parse(briefing.metrics_json || "{}"),
    document: {
      briefingId: doc.briefing_id,
      state: doc.public_state,
      currentRevisionNo: doc.current_revision_no,
      publishedRevisionNo: doc.published_revision_no,
      baseMetricsHash: doc.base_metrics_hash
    },
    currentRevision: {
      title: currentRevision.title,
      oneLineText: currentRevision.one_line_text,
      marketTemperatureCommentary: currentRevision.market_temperature_commentary,
      summaryMarkdown: currentRevision.summary_markdown,
      newsletterCtaTitle: currentRevision.newsletter_cta_title,
      newsletterCtaBody: currentRevision.newsletter_cta_body,
      newsletterCtaUrl: currentRevision.newsletter_cta_url,
      disclosureText: currentRevision.disclosure_text,
      changeSummary: currentRevision.change_summary
    }
  }, { headers: { "Cache-Control": "no-store" } });
}
