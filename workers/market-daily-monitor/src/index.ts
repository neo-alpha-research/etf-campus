import marketHolidaysText from "./market_holidays.txt";

export interface Env {
  MONITOR_GITHUB_TOKEN?: string;
  GITHUB_REPO: string;
  BRIEFING_ENDPOINT: string;
}

function getExpectedDateKST(): { expectedCompact: string; expectedIso: string } {
  const kstNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const expectedDate = new Date(kstNow);
  expectedDate.setDate(kstNow.getDate() - 1); // Yesterday

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
  // 0 = Sunday, 6 = Saturday (which corresponds to 5,6 in Python's weekday where 0=Mon)
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

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const { expectedCompact, expectedIso } = getExpectedDateKST();

    if (isSkipCondition(expectedIso, expectedCompact)) {
      console.log(`${expectedIso} is a weekend or KRX holiday; monitoring is skipped.`);
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
      console.log(`Validation failed for expected ${expectedIso}. Errors: ${errors.join("; ")}`);
      await reportToGithub(env, expectedIso, actual, errors);
    } else {
      console.log(`Validation passed for ${expectedIso}.`);
    }
  }
};
