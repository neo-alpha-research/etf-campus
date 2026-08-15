function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' },
  });
}

export async function onRequestGet({ request, env }) {
  const db = env.ETF_PRICES;
  if (!db) return json({ error: 'service_unavailable' }, 503);
  const url = new URL(request.url);
  const ticker = url.searchParams.get('ticker')?.trim();
  const issuer = url.searchParams.get('issuer')?.trim();
  const status = url.searchParams.get('verification_status')?.trim();
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 100), 1), 5000);
  const conditions = [];
  const bindings = [];
  if (ticker) { conditions.push('ticker = ?'); bindings.push(ticker); }
  if (issuer) { conditions.push('issuer = ?'); bindings.push(issuer); }
  if (status) { conditions.push('verification_status = ?'); bindings.push(status); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const stmt = db.prepare(`SELECT ticker, isin, name, issuer, fund_standard_code, legal_fund_name, mapping_status, fee_display_status, collection_state, total_fee_pct, ter_pct, other_cost_pct, trading_cost_pct, effective_burden_cost_pct, effective_date, verified_at, verification_status, primary_source_type, primary_source_url, dart_receipt_no, secondary_source_url, source_note FROM etf_fees ${where} ORDER BY CASE WHEN effective_burden_cost_pct IS NULL THEN 1 ELSE 0 END, effective_burden_cost_pct, name LIMIT ?`).bind(...bindings, limit);
  const result = await stmt.all();
  return json({ items: result.results || [], count: result.results?.length || 0, total_cost_definition: '표면 총보수 + 기타비용 + 매매·중개수수료', generated_at: new Date().toISOString() });
}
