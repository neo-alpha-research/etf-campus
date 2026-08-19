export interface Env {
  ETF_PRICES: D1Database;
  MARKET_BRIEFING_EVENTS: Queue<MarketSnapshotReadyEvent>;
  APP_TIMEZONE: string;
  MANUAL_RUN_TOKEN?: string;
}

type MarketSnapshotReadyEvent = {
  event_id: string;
  event_type: "market_snapshot_ready";
  target_name: "market_briefing";
  as_of_date: string;
  source_version: string;
};

type OutboxRow = {
  event_id: string;
  payload_json: string;
  attempt_count: number;
};

const nowIso = () => new Date().toISOString();

function nextRetryAt(attempt: number): string {
  const seconds = Math.min(60 * 60, 30 * 2 ** Math.min(attempt, 6));
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function validEvent(value: unknown): value is MarketSnapshotReadyEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;
  return event.event_type === "market_snapshot_ready"
    && event.target_name === "market_briefing"
    && typeof event.event_id === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(String(event.as_of_date ?? ""))
    && typeof event.source_version === "string";
}

async function dispatchPendingEvents(env: Env): Promise<{ sent: number; failed: number }> {
  const pending = await env.ETF_PRICES.prepare(
    `SELECT event_id, payload_json, attempt_count
     FROM market_source_event_outbox
     WHERE target_name = 'market_briefing'
       AND delivery_status IN ('pending', 'failed')
       AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
     ORDER BY created_at ASC
     LIMIT 20`,
  ).bind(nowIso()).all<OutboxRow>();

  let sent = 0;
  let failed = 0;
  for (const row of pending.results ?? []) {
    try {
      const event = JSON.parse(row.payload_json) as unknown;
      if (!validEvent(event)) throw new Error("invalid_outbox_event");
      await env.MARKET_BRIEFING_EVENTS.send(event);
      await env.ETF_PRICES.prepare(
        `UPDATE market_source_event_outbox
         SET delivery_status='sent', attempt_count=attempt_count+1, sent_at=?, next_attempt_at=NULL, updated_at=?
         WHERE event_id=?`,
      ).bind(nowIso(), nowIso(), row.event_id).run();
      sent += 1;
    } catch (error) {
      const attempt = row.attempt_count + 1;
      await env.ETF_PRICES.prepare(
        `UPDATE market_source_event_outbox
         SET delivery_status='failed', attempt_count=?, next_attempt_at=?, updated_at=?
         WHERE event_id=?`,
      ).bind(attempt, nextRetryAt(attempt), nowIso(), row.event_id).run();
      console.error(JSON.stringify({ event: "market_source_event_dispatch_failed", eventId: row.event_id, attempt, message: String(error) }));
      failed += 1;
    }
  }
  return { sent, failed };
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(dispatchPendingEvents(env));
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/internal/dispatch") return new Response("Not Found", { status: 404 });
    const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!env.MANUAL_RUN_TOKEN || token !== env.MANUAL_RUN_TOKEN) return new Response("Unauthorized", { status: 401 });
    const result = await dispatchPendingEvents(env);
    return Response.json(result);
  },
};

export const __testables = { validEvent, nextRetryAt };
