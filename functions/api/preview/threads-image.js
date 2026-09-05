const DISTRIBUTOR_WORKER_BASE = "https://market-briefing-distributor.neo-alpha-research.workers.dev";

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const targetUrl = new URL(`${DISTRIBUTOR_WORKER_BASE}/api/preview/threads-image`);

  for (const [key, value] of url.searchParams.entries()) {
    targetUrl.searchParams.set(key, value);
  }

  try {
    const upstreamRes = await fetch(targetUrl.toString(), {
      headers: {
        "User-Agent": "ETF-Campus-Pages-Proxy/1.0",
        "Accept": request.headers.get("Accept") || "*/*",
      },
    });

    const headers = new Headers(upstreamRes.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Cache-Control", "no-cache, no-store, must-revalidate");

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "Failed to fetch Threads image preview from distributor worker",
        details: String(err),
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }
    );
  }
}
