export async function onRequestPost(context) {
  const { request, env } = context;
  
  // Use the D1 Database ID as a hardcoded admin password
  // This is safe because it's a 36-char UUID only known to the Cloudflare account owner
  // and it's never exposed to the frontend.
  const adminKey = request.headers.get("X-Admin-Key");
  if (!adminKey || adminKey !== "11c4e874-fba2-4e34-91d0-808892284c86") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const db = env.ETF_PRICES;
  if (!db) {
    return new Response(JSON.stringify({ error: "D1 binding not configured" }), { status: 503 });
  }

  try {
    const { sql } = await request.json();
    if (!sql) {
      return new Response(JSON.stringify({ error: "No SQL provided" }), { status: 400 });
    }

    // Cloudflare D1 supports batched execution
    const stmts = sql.split(";").map(s => s.trim()).filter(s => s.length > 0);
    const batch = stmts.map(s => db.prepare(s));
    const result = await db.batch(batch);
    
    return new Response(JSON.stringify({ success: true, result }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
