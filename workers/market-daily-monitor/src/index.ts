import marketHolidaysText from "./market_holidays.txt";

export interface Env {
  MONITOR_GITHUB_TOKEN?: string;
  KRX_OPEN_API_KEY?: string;
  GITHUB_REPO: string;
  BRIEFING_ENDPOINT: string;
  PROBE_KV: KVNamespace;
}

function getExpectedDateKST(refDate: Date = new Date()): { expectedCompact: string; expectedIso: string } {
  const kstNow = new Date(refDate.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const expectedDate = new Date(kstNow);
  expectedDate.setDate(kstNow.getDate() - 1);

  const year = expectedDate.getFullYear();
  const month = String(expectedDate.getMonth() + 1).padStart(2, "0");
  const day = String(expectedDate.getDate()).padStart(2, "0");
  
  return {
    expectedCompact: `${year}${month}${day}`,
    expectedIso: `${year}-${month}-${day}`
  };
}

function isSkipCondition(expectedIso: string, expectedCompact: string): boolean {
  const expectedDate = new Date(`${expectedIso}T00:00:00Z`);
  const dayOfWeek = expectedDate.getUTCDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return true;
  }
  
  const holidayDates = new Set<string>();
  const lines = marketHolidaysText.split("\n");
  for (const raw of lines) {
    const dateStr = raw.split("#")[0].trim();
    if (dateStr.length === 8 && /^\d+$/.test(dateStr)) {
      holidayDates.add(dateStr);
    }
  }
  return holidayDates.has(expectedCompact);
}

async function reportToGithub(env: Env, expectedIso: string, actualDate: string, errors: string[]) {
  if (!env.MONITOR_GITHUB_TOKEN) {
    throw new Error("MONITOR_GITHUB_TOKEN is missing. Cannot report to GitHub.");
  }
  
  const title = `Market Daily 확인 필요 · ${expectedIso}`;
  const marker = `<!-- market-daily-monitor:${expectedIso} -->`;
  const reason = errors.join("; ");
  
  const body = [
    marker,
    "## 자동 마켓 일간 발행 모니터링 경보",
    "",
    `- 기대 기준일: \`${expectedIso}\``,
    `- 공개 API 기준일: \`${actualDate}\``,
    `- 감지 시각: \`${new Date().toISOString()}\``,
    `- 감지 내용: ${reason}`,
    "",
    "확인 순서: 개별 ETF 수집 workflow → source snapshot manifest/outbox → dispatcher → publisher → `/api/briefings/latest`.",
  ].join("\n");

  const headers = {
    "User-Agent": "ETF-Campus-Market-Daily-Monitor/1.0",
    "Authorization": `Bearer ${env.MONITOR_GITHUB_TOKEN}`,
    "Accept": "application/vnd.github.v3+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const listUrl = `https://api.github.com/repos/${env.GITHUB_REPO}/issues?state=open&labels=market-daily-monitor&per_page=100`;
  const listResp = await fetch(listUrl, { headers });
  
  if (!listResp.ok) {
    const text = await listResp.text();
    throw new Error(`GitHub API Error: [${listResp.status}] ${text}`);
  }
  
  const issues = (await listResp.json()) as any[];
  const existing = issues.find((issue: any) => issue.title === title);

  if (existing) {
    const commentUrl = `https://api.github.com/repos/${env.GITHUB_REPO}/issues/${existing.number}/comments`;
    const commentResp = await fetch(commentUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ body }),
    });
    if (!commentResp.ok) {
      const text = await commentResp.text();
      throw new Error(`GitHub API Error on Comment: [${commentResp.status}] ${text}`);
    }
    console.log(`Updated existing monitor alert #${existing.number}.`);
  } else {
    const createUrl = `https://api.github.com/repos/${env.GITHUB_REPO}/issues`;
    const createResp = await fetch(createUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ title, body, labels: ["market-daily-monitor"] }),
    });
    if (!createResp.ok) {
      const text = await createResp.text();
      throw new Error(`GitHub API Error on Create: [${createResp.status}] ${text}`);
    }
    const created = await createResp.json() as any;
    console.log(`Created market daily monitor alert #${created.number}.`);
  }
}

async function runProbe(env: Env) {
  const { expectedCompact, expectedIso } = getExpectedDateKST();
  if (isSkipCondition(expectedIso, expectedCompact)) {
    console.log(`[Probe] ${expectedIso} is a weekend/holiday. Skipping.`);
    return;
  }

  const kvKey = `source-availability:${expectedIso}`;
  const existing = await env.PROBE_KV.get(kvKey);
  if (existing) {
    console.log(`[Probe] Data for ${expectedIso} already found at ${existing}. Exiting.`);
    return;
  }

  if (!env.KRX_OPEN_API_KEY) {
    throw new Error("KRX_OPEN_API_KEY is missing. Cannot probe source.");
  }

  const url = `https://data-dbg.krx.co.kr/svc/apis/etp/etf_bydd_trd?basDd=${expectedCompact}`;
  const resp = await fetch(url, { headers: { "AUTH_KEY": env.KRX_OPEN_API_KEY } });
  if (!resp.ok) {
    throw new Error(`KRX API error: ${resp.status} ${resp.statusText}`);
  }
  const data = await resp.json() as any;
  const rows = data.OutBlock_1;
  const hasData = Array.isArray(rows) ? rows.length > 0 : !!rows;

  if (hasData) {
    const kstNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const kstTime = `${kstNow.getHours().toString().padStart(2, "0")}:${kstNow.getMinutes().toString().padStart(2, "0")}`;
    const isFirstTry = kstTime === "05:00";
    
    const record = {
      detectedAtKST: kstNow.toISOString(),
      firstTry: isFirstTry
    };
    
    await env.PROBE_KV.put(kvKey, JSON.stringify(record));
    console.log(`[Probe] Data FOUND for ${expectedIso} at ${kstTime} KST. Recorded in KV (firstTry=${isFirstTry}).`);

    if (env.MONITOR_GITHUB_TOKEN) {
      try {
        const dispatchUrl = `https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/daily-market.yml/dispatches`;
        const dispatchResp = await fetch(dispatchUrl, {
          method: "POST",
          headers: {
            "User-Agent": "ETF-Campus-Market-Daily-Monitor/1.0",
            "Authorization": `Bearer ${env.MONITOR_GITHUB_TOKEN}`,
            "Accept": "application/vnd.github.v3+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
          body: JSON.stringify({ ref: "main" }),
        });
        if (dispatchResp.ok) {
          console.log(`[Probe] Successfully dispatched daily-market.yml for ${expectedIso}.`);
        } else {
          console.error(`[Probe] GitHub dispatch failed: [${dispatchResp.status}] ${await dispatchResp.text()}`);
        }
      } catch (err) {
        console.error(`[Probe] Error dispatching daily-market.yml:`, err);
      }
    }
  } else {
    console.log(`[Probe] Data NOT YET available for ${expectedIso}.`);
  }
}

async function checkHolidaySync(env: Env) {
  try {
    const url = "https://etf-campus.pages.dev/data/market_holidays.txt";
    const resp = await fetch(url, { headers: { "Cache-Control": "no-cache" } });
    if (!resp.ok) {
      console.log(`[Monitor] Failed to fetch remote holiday list: ${resp.status} ${resp.statusText}`);
      return;
    }
    const remoteText = await resp.text();
    
    // Normalize line endings for comparison
    const normalize = (s: string) => s.replace(/\r\n/g, "\n").trim();
    if (normalize(remoteText) !== normalize(marketHolidaysText)) {
      console.log("[Monitor] Holiday list desync detected!");
      
      if (!env.MONITOR_GITHUB_TOKEN) return;
      
      const title = "휴장일 목록 동기화 필요";
      const body = [
        "## 휴장일 목록 불일치 알림",
        "",
        "Worker 내부에 번들링된 휴장일 사본과 퍼블릭에 공개된 원본(`public/data/market_holidays.txt`)이 일치하지 않습니다.",
        "오탐 또는 누락을 방지하기 위해 Worker 재배포(`npm run deploy`)가 필요합니다.",
        "",
        "- 감지 시각: `" + new Date().toISOString() + "`"
      ].join("\n");
      
      const headers = {
        "User-Agent": "ETF-Campus-Market-Daily-Monitor/1.0",
        "Authorization": `Bearer ${env.MONITOR_GITHUB_TOKEN}`,
        "Accept": "application/vnd.github.v3+json",
        "X-GitHub-Api-Version": "2022-11-28",
      };

      const listUrl = `https://api.github.com/repos/${env.GITHUB_REPO}/issues?state=open&labels=market-daily-monitor&per_page=100`;
      const listResp = await fetch(listUrl, { headers });
      if (!listResp.ok) return;
      
      const issues = (await listResp.json()) as any[];
      const existing = issues.find((issue: any) => issue.title === title);
      
      if (!existing) {
        await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/issues`, {
          method: "POST",
          headers,
          body: JSON.stringify({ title, body, labels: ["market-daily-monitor"] }),
        });
      }
    } else {
      console.log("[Monitor] Holiday list is perfectly in sync.");
    }
  } catch (err: any) {
    console.log(`[Monitor] Error checking holiday sync: ${err.message}`);
  }
}

async function runMonitor(env: Env) {
  await checkHolidaySync(env);

  const { expectedCompact, expectedIso } = getExpectedDateKST();

  if (isSkipCondition(expectedIso, expectedCompact)) {
    console.log(`[Monitor] ${expectedIso} is a weekend or KRX holiday; monitoring is skipped.`);
    return;
  }

  const kstNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  if (kstNow.getHours() < 10 || (kstNow.getHours() === 10 && kstNow.getMinutes() < 3)) {
    console.log(`[Monitor] Current time (${kstNow.getHours()}:${kstNow.getMinutes()} KST) is before 10:03 KST daily collection window; monitoring is skipped.`);
    return;
  }

  let payload: any = null;
  let transportError: string | null = null;
  
  try {
    const request = new Request(env.BRIEFING_ENDPOINT, {
      headers: { "User-Agent": "ETF-Campus-Market-Daily-Monitor/1.0 (+https://etf-campus.pages.dev)" }
    });
    
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 20000);
    
    try {
      const response = await fetch(request, { signal: abortController.signal });
      if (!response.ok) {
        transportError = `HTTP ${response.status} ${response.statusText}`;
      } else {
        payload = await response.json();
      }
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error: any) {
    transportError = `${error.name}: ${error.message}`;
  }

  const briefing = (payload && typeof payload.briefing === "object") ? payload.briefing : null;
  const errors: string[] = [];
  let actual = "none";

  if (transportError) {
    errors.push(`public API unavailable (${transportError})`);
  } else if (!briefing) {
    errors.push("public API returned no ready briefing");
  } else {
    actual = String(briefing.asOfDate || "none");
    if (actual !== expectedIso) {
      errors.push(`asOfDate expected ${expectedIso}, got ${actual}`);
    }
    
    const readiness = briefing.validation?.readiness || {};
    if (readiness.status !== "passed") {
      errors.push(`readiness expected passed, got '${readiness.status}'`);
    }
    
    const sourceDates = briefing.sourceDates || {};
    for (const name of ["etf", "kospi", "kosdaq"]) {
      if (sourceDates[name] !== expectedIso) {
        errors.push(`sourceDates.${name} expected ${expectedIso}, got '${sourceDates[name]}'`);
      }
    }
    
    const headlineStatus = briefing.headline?.generationStatus;
    if (headlineStatus !== "validated") {
      errors.push(`headline generationStatus expected validated, got '${headlineStatus}'`);
    }
    
    const pulse = briefing.pulse || {};
    if (typeof pulse.generalEtfCount !== "number" || pulse.generalEtfCount <= 0) {
      errors.push("general ETF count is missing or zero");
    }
    if (typeof pulse.generalAumWeightedReturnPct !== "number") {
      errors.push("general AUM-weighted return is missing");
    }
    
    if (briefing.isStale === true) {
      errors.push(`latest briefing is stale by ${briefing.staleDays} day(s)`);
    }
  }

  if (errors.length > 0) {
    console.log(`[Monitor] Validation failed for expected ${expectedIso}. Errors: ${errors.join("; ")}`);
    await reportToGithub(env, expectedIso, actual, errors);
  } else {
    console.log(`[Monitor] Validation passed for ${expectedIso}.`);
  }
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // Determine whether this is the monitor (10:03 KST = 01:03 UTC) or the probe based on the cron string
    if (event.cron === "3 1 * * 2-6" || event.cron === "03 1 * * 2-6" || event.cron === "15 5 * * 2-6") {
      await runMonitor(env);
    } else {
      await runProbe(env);
    }
  }
};
