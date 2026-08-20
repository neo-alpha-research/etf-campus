import { requirePermission } from "../../../../_shared/rbac.js";
import { errorResponse } from "../../../community/_lib/api-security.js";

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const auth = await requirePermission(request, env, "briefing.draft.read");
  if (auth.error) return auth.error;

  const asOfDate = params.id;

  const doc = await env.ETF_PRICES.prepare(`SELECT briefing_id FROM market_briefing_editorial_documents WHERE as_of_date = ?`).bind(asOfDate).first();
  if (!doc) return Response.json({ revisions: [] }, { headers: { "Cache-Control": "no-store" } });

  const history = await env.ETF_PRICES.prepare(`
    SELECT revision_no, workflow_status, origin, change_summary, created_by_user_id, created_at 
    FROM market_briefing_editorial_revisions 
    WHERE briefing_id = ? 
    ORDER BY revision_no DESC
  `).bind(doc.briefing_id).all();

  return Response.json({
    revisions: history.results.map(r => ({
      revisionNo: r.revision_no,
      workflowStatus: r.workflow_status,
      origin: r.origin,
      changeSummary: r.change_summary,
      createdBy: r.created_by_user_id,
      createdAt: r.created_at
    }))
  }, { headers: { "Cache-Control": "no-store" } });
}
