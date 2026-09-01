const fs = require('fs');
let c = fs.readFileSync('functions/api/briefings/latest.js', 'utf8');

c = c.replace(/export async function onRequestGet\(context\) \{([\s\S]*?)return Response\.json\(toResponsePayload\(briefing, assetClasses, focusEtfs\), \{ headers: JSON_HEADERS \}\);\n\}/, 
\export async function onRequestGet(context) {
  let cached = null;
  try {
    cached = await readKvBriefing(context.env.BRIEFING_KV);
  } catch (e) {
    console.error("KV Read Error:", e);
  }
  if (cached) return Response.json(cached, { headers: JSON_HEADERS });

  try {
 Response.json(toResponsePayload(briefing, assetClasses, focusEtfs), { headers: JSON_HEADERS });
  } catch (error) {
    console.error("D1 Fallback Error:", error);
    if (cached) return Response.json(cached, { headers: JSON_HEADERS });
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500, headers: JSON_HEADERS });
  }
}\
);
fs.writeFileSync('functions/api/briefings/latest.js', c);
