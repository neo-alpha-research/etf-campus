export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  MANUAL_RUN_TOKEN?: string;
}

import { getJudgmentTimeBounds, evaluateRecord, sendChallengeAlert } from "./judgment";

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

async function runChallengeJudgment(env: Env): Promise<void> {
  const now = new Date();
  
  // 1. Get active cohorts
  const cohortsRes = await fetch(`${env.SUPABASE_URL}/rest/v1/community_challenge_cohorts?status=eq.active&select=id,slug,start_date`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
    }
  });
  if (!cohortsRes.ok) throw new Error("failed to fetch cohorts");
  const cohorts = await cohortsRes.json() as any[];

  const totalJudgments = [];

  for (const cohort of cohorts) {
    const bounds = getJudgmentTimeBounds(now, cohort.start_date);
    
    // Fetch all posts for this cohort on the target day
    const postsRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/community_posts?challenge_cohort_id=eq.${cohort.id}&challenge_day_number=eq.${bounds.dayNumber}&deleted_at=is.null&order=created_at.asc`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
        }
      }
    );
    if (!postsRes.ok) continue;
    const posts = await postsRes.json() as any[];
    
    const participantBest: Record<string, any> = {};
    for (const post of posts) {
      const pid = post.author_profile_id;
      const judgment = evaluateRecord(post, bounds);
      
      // If we haven't seen a post for this participant yet, or the current best is not 'on_time' and we found a better one
      if (!participantBest[pid] || participantBest[pid].status === 'failed') {
        participantBest[pid] = {
          cohort_id: cohort.id,
          participant_profile_id: pid,
          post_id: post.id,
          day_number: bounds.dayNumber,
          status: judgment.status,
          rule_version: "v1",
          submitted_at: post.created_at,
          deadline_at: (judgment.status === 'late' || judgment.reason?.includes("마감 시각 초과")) ? bounds.lateDeadline.toISOString() : bounds.onTimeDeadline.toISOString(),
          failure_reason: judgment.reason
        };
      }
    }

    const judgments = Object.values(participantBest);
    
    for (const j of judgments) {
      if (j.status === "failed") {
        await sendChallengeAlert({ email: "unknown@example.com" }, "failed", j.failure_reason);
      }
    }

    totalJudgments.push(...judgments);
  }

  if (totalJudgments.length > 0) {
    const insertRes = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/bulk_insert_challenge_judgments`, {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ p_judgments: totalJudgments })
    });
    if (!insertRes.ok) {
      console.error("bulk insert failed:", await insertRes.text());
    }
  }
}

const workerHandler = {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      Promise.all([
        runMaintenance(env),
        runChallengeJudgment(env)
      ]).then(([maintResult]) => {
        console.log(JSON.stringify({ event: "scheduled_jobs_finished", maintenance: maintResult }));
      }).catch(err => {
        console.error("scheduled job error:", err);
      })
    );
  },

  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/internal/run") return new Response("Not Found", { status: 404 });
    if (!authorized(request, env)) return new Response("Unauthorized", { status: 401 });

    const result = await runMaintenance(env);
    await runChallengeJudgment(env);
    
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  },
};

export default workerHandler;

export const __testables = { koreaRunKey, authorized, runChallengeJudgment };
