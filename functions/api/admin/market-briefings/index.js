import { requirePermission } from "../../../_shared/rbac.js";

export async function onRequestGet(context) {
  const auth = await requirePermission(context.request, context.env, "briefing.draft.read");
  if (auth.error) return auth.error;

  const results = await context.env.ETF_PRICES.prepare(
    `SELECT 
      b.as_of_date, b.market_temperature, b.status as sync_status,
      d.briefing_id, d.public_state, d.current_revision_no, d.published_revision_no,
      d.updated_at
     FROM market_briefings b
     LEFT JOIN market_briefing_editorial_documents d ON b.as_of_date = d.as_of_date
     ORDER BY b.as_of_date DESC
     LIMIT 50`
  ).all();

  return Response.json({
    data: results.results.map(r => ({
      asOfDate: r.as_of_date,
      marketTemperature: r.market_temperature,
      editorial: r.briefing_id ? {
        state: r.public_state,
        currentRevision: r.current_revision_no,
        publishedRevision: r.published_revision_no,
        updatedAt: r.updated_at
      } : null
    }))
  }, {
    headers: { "Cache-Control": "no-store" }
  });
}
