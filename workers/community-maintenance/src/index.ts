export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  MANUAL_RUN_TOKEN?: string;
}

type MaintenanceResult = {
  status: "completed" | "already_processed";
  run_key: string;
  affected_count?: number;
};

function koreaRunKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function authorized(request: Request, env: Env): boolean {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  return Boolean(env.MANUAL_RUN_TOKEN && token === env.MANUAL_RUN_TOKEN);
}

async function runMaintenance(env: Env, runKey = koreaRunKey()): Promise<MaintenanceResult> {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/run_community_maintenance`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ p_run_key: runKey }),
  });

  if (!response.ok) {
    throw new Error(`community_maintenance_rpc_failed:${response.status}`);
  }

  const result = await response.json() as MaintenanceResult;
  if (result.status !== "completed" && result.status !== "already_processed") {
    throw new Error("community_maintenance_invalid_response");
  }
  return result;
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runMaintenance(env).then((result) => {
      console.log(JSON.stringify({ event: "community_maintenance_finished", ...result }));
    }));
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/internal/run") return new Response("Not Found", { status: 404 });
    if (!authorized(request, env)) return new Response("Unauthorized", { status: 401 });

    const result = await runMaintenance(env);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  },
};

export const __testables = { koreaRunKey, authorized };
