import { validateBriefingPayload } from "./circuit-breaker";
import { generateInstagramCarousel, generateInstagramCaption } from "./templates/instagram";
import { generateNewsletterHtml } from "./templates/newsletter";
import { generateThreadsThread, generateThreadsImageSvg } from "./templates/threads";
import { reviewAndRefineWithGemini, type PolishedNarrative } from "./services/gemini";
import { classifyMarketRegime } from "./services/market-regime";
import type { BriefingDistributeEvent, Env, MarketBriefingPayload } from "./types";

function escapeXml(unsafe?: string): string {
  if (!unsafe) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeBriefingPayload(raw: any): MarketBriefingPayload | null {
  if (!raw) return null;
  const briefing = raw.briefing || raw;
  const pulse = briefing.pulse || {};
  const kospi = briefing.marketIndices?.find((i: any) => i.code === "KOSPI");
  const kosdaq = briefing.marketIndices?.find((i: any) => i.code === "KOSDAQ");

  return {
    ...briefing,
    pulse,
    headlineText: briefing.headline?.text || briefing.headlineText || "",
    marketTemperature: pulse.marketTemperature || briefing.marketTemperature || "하락 우세",
    kospiClose: kospi?.close ?? briefing.kospiClose ?? 0,
    kospiChangePct: kospi?.change_pct ?? briefing.kospiChangePct ?? 0,
    kosdaqClose: kosdaq?.close ?? briefing.kosdaqClose ?? 0,
    kosdaqChangePct: kosdaq?.change_pct ?? briefing.kosdaqChangePct ?? 0,
    generalEtfCount: pulse.generalEtfCount ?? briefing.generalEtfCount ?? 0,
    generalTotalAum: pulse.generalTotalAum ?? briefing.generalTotalAum ?? 0,
    generalTotalTradeValue: pulse.generalTotalTradeValue ?? briefing.generalTotalTradeValue ?? 0,
    generalAumWeightedReturnPct: pulse.generalAumWeightedReturnPct ?? briefing.generalAumWeightedReturnPct ?? 0,
    upCount: pulse.upCount ?? briefing.upCount ?? 0,
    flatCount: pulse.flatCount ?? briefing.flatCount ?? 0,
    downCount: pulse.downCount ?? briefing.downCount ?? 0,
    breadthRatioPct: pulse.breadthRatioPct ?? briefing.breadthRatioPct ?? 0,
    top10TradeSharePct: pulse.top10TradeSharePct ?? briefing.top10TradeSharePct ?? 0,
    allTop10TradeSharePct: pulse.allTop10TradeSharePct ?? briefing.allTop10TradeSharePct ?? 0,
    assetClasses: (briefing.assetClasses || []).map((a: any) => ({
      assetClass: a.assetClass || a.asset_class || "",
      etfCount: a.etfCount || a.etf_count || 0,
      upCount: a.upCount || a.up_count || 0,
      flatCount: a.flatCount || a.flat_count || 0,
      downCount: a.downCount || a.down_count || 0,
      breadthRatioPct: a.breadthRatioPct ?? a.breadth_ratio_pct ?? 0,
      aumWeightedReturnPct: a.aumWeightedReturnPct ?? a.aum_weighted_return_pct ?? 0,
      totalAum: a.totalAum || a.total_aum || 0,
      aumSharePct: a.aumSharePct ?? a.aum_share_pct ?? 0,
      totalTradeValue: a.totalTradeValue || a.total_trade_value || 0,
      tradeSharePct: a.tradeSharePct ?? a.trade_share_pct ?? 0,
      ytdReturnPct: a.ytdReturnPct || 0,
    })),
    focusEtfs: briefing.focusEtfs || [],
    peerGroups: (briefing.peerGroups || []).map((p: any) => ({
      ...p,
      peerGroup: p.peerGroup || p.peer_group || "",
      assetClass: p.assetClass || p.asset_class || "",
      etfCount: p.etfCount || p.etf_count || 0,
      equalWeightReturnPct: p.equalWeightReturnPct ?? p.equal_weight_return_pct ?? 0,
      cappedAumWeightedReturnPct: p.cappedAumWeightedReturnPct ?? p.capped_aum_weighted_return_pct ?? 0,
    })),
    disparityWarning: (briefing.disparityWarning || []).map((d: any) => ({
      ...d,
      ticker: d.ticker || "",
      etfName: d.etfName || d.etf_name || "",
      disparityPct: d.disparityPct ?? d.disparity_pct ?? 0,
    })),
    periodicFlows: briefing.periodicFlows ? briefing.periodicFlows : (briefing.fundFlow?.general ? {
      dailyFundFlows: {
        topInflows: (briefing.fundFlow.general.topInflows || []).map((f: any, idx: number) => ({
          rank: idx + 1,
          ticker: f.ticker,
          name: f.name || f.etfName || "핵심ETF",
          theme: f.theme || "핵심ETF",
          inflow: f.inflow ?? Math.round((f.netInflowValue || 0) / 100000000),
          changePct: f.changePct ?? 0,
        })),
        topOutflows: (briefing.fundFlow.general.topOutflows || []).map((f: any, idx: number) => ({
          rank: idx + 1,
          ticker: f.ticker,
          name: f.name || f.etfName || "핵심ETF",
          theme: f.theme || "핵심ETF",
          inflow: f.inflow ?? Math.round((f.netInflowValue || 0) / 100000000),
          changePct: f.changePct ?? 0,
        })),
      }
    } : undefined),
  };
}

async function loadBriefingPayload(env: Env, asOfDate?: string): Promise<MarketBriefingPayload | null> {
  // 1. Try pointer if no date or looking for latest
  if (!asOfDate) {
    const pointer = await env.BRIEFING_KV.get<{ payloadKey?: string; asOfDate?: string }>("market-briefing:v0:latest-pointer", "json");
    if (pointer?.payloadKey) {
      const payload = await env.BRIEFING_KV.get<any>(pointer.payloadKey, "json");
      if (payload) return normalizeBriefingPayload(payload);
    }
  } else {
    // Try version 1 to 5 in KV
    for (const v of [1, 2, 3, 4, 5]) {
      const key = `market-briefing:v0:payload:${asOfDate}:v${v}`;
      const payload = await env.BRIEFING_KV.get<any>(key, "json");
      if (payload) return normalizeBriefingPayload(payload);
    }
  }

  // 2. Direct fetch from Pages public API fallback
  try {
    const target = asOfDate || "latest";
    const endpoint = target === "latest" 
      ? "https://etf-campus.pages.dev/api/briefings/latest" 
      : `https://etf-campus.pages.dev/api/briefings/${target}`;
    const res = await fetch(endpoint, {
      headers: { "User-Agent": "ETF-Campus-Distributor/1.0" }
    });
    if (res.ok) {
      const json: any = await res.json();
      if (json) return normalizeBriefingPayload(json);
    }
  } catch (err) {
    console.warn("[Distributor] Failed to fetch from API fallback:", err);
  }

  // 3. Direct D1 database fallback (High-Availability BCP/DR)
  if (env.ETF_PRICES && typeof env.ETF_PRICES.prepare === "function") {
    try {
      const query = asOfDate 
        ? "SELECT as_of_date, headline_text, kospi_close, kospi_change_pct, kosdaq_close, kosdaq_change_pct, general_etf_count, general_total_aum, general_total_trade_value, general_aum_weighted_return_pct, up_count, flat_count, down_count, breadth_ratio_pct, metrics_json FROM market_briefings WHERE as_of_date = ? LIMIT 1"
        : "SELECT as_of_date, headline_text, kospi_close, kospi_change_pct, kosdaq_close, kosdaq_change_pct, general_etf_count, general_total_aum, general_total_trade_value, general_aum_weighted_return_pct, up_count, flat_count, down_count, breadth_ratio_pct, metrics_json FROM market_briefings ORDER BY as_of_date DESC LIMIT 1";
      const row: any = await (asOfDate ? env.ETF_PRICES.prepare(query).bind(asOfDate) : env.ETF_PRICES.prepare(query)).first();
      if (row) {
        let metrics: any = {};
        try { metrics = JSON.parse(row.metrics_json || "{}"); } catch (e) {}
        return normalizeBriefingPayload({
          ...row,
          ...metrics,
          asOfDate: row.as_of_date,
          headlineText: row.headline_text,
          assetClasses: metrics.asset_classes || metrics.assetClasses || [],
          peerGroups: metrics.peer_groups || metrics.peerGroups || [],
          periodicFlows: metrics.periodic_flows || metrics.periodicFlows,
          disparityWarning: metrics.disparity_warning || metrics.disparityWarning || [],
        });
      }
    } catch (d1Err) {
      console.warn("[Distributor] Failed to query D1 fallback:", d1Err);
    }
  }

  return null;
}

export async function executeDistribution(env: Env, targetDate?: string, dryRun = false): Promise<any> {
  const payload = await loadBriefingPayload(env, targetDate);
  if (!payload) {
    throw new Error(`Briefing payload for ${targetDate || "latest"} not found`);
  }

  const effectiveDate = payload.asOfDate || targetDate || "latest";

  // 0. KV 기반 멱등성 락 확인 (D1 쿼리 한도 초과 시에도 완벽 방어)
  const kvBriefingKey = `distribution:briefing:${effectiveDate}`;
  try {
    const existing = await env.BRIEFING_KV.get<{ status?: string }>(kvBriefingKey, "json");
    if (existing?.status === "distributed" && !dryRun) {
      return {
        success: true,
        alreadyDistributed: true,
        status: "already_distributed",
        asOfDate: effectiveDate,
        message: `해당 날짜(${effectiveDate})의 브리핑은 이미 배포 완료되었습니다.`,
      };
    }
  } catch (e) {}

  // 1. 서킷 브레이커 검증
  const validation = await validateBriefingPayload(payload, env);
  if (!validation.isSafe) {
    console.error(`[Distributor] Circuit breaker tripped for ${effectiveDate}:`, validation.reasons);
    try {
      await env.ETF_PRICES.prepare(
        `CREATE TABLE IF NOT EXISTS briefing_distribution_logs (
          as_of_date TEXT PRIMARY KEY,
          status TEXT NOT NULL,
          details_json TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      ).run();

      let existingDetails: any = {};
      let existingStatus: string | null = null;
      const row: any = await env.ETF_PRICES.prepare(
        `SELECT status, details_json FROM briefing_distribution_logs WHERE as_of_date = ?`
      ).bind(effectiveDate).first();
      if (row) {
        existingStatus = row.status;
        if (row.details_json) {
          try { existingDetails = JSON.parse(row.details_json); } catch (e) {}
        }
      }
      existingDetails.reasons = validation.reasons;
      const nextStatus = existingStatus === "distributed" ? "distributed" : "blocked";
      if (existingStatus === "distributed") {
        existingDetails.revision_blocked = true;
      }

      await env.ETF_PRICES.prepare(
        `INSERT OR REPLACE INTO briefing_distribution_logs (as_of_date, status, details_json, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
      ).bind(effectiveDate, nextStatus, JSON.stringify(existingDetails)).run();
    } catch (e) {}
    return { success: false, status: "blocked", reasons: validation.reasons };
  }

  // 2. 템플릿 생성 (인스타그램 6장, 스레드 4단, 이메일 HTML)
  const baseUrl = env.SITE_BASE_URL || "https://etf-campus.pages.dev";
  const narrative = await getOrRefineNarrative(payload, env);
  const instagramSlides = generateInstagramCarousel(payload, baseUrl, narrative);
  const threadsPosts = generateThreadsThread(payload, baseUrl, narrative);
  const newsletter = generateNewsletterHtml(payload, baseUrl, narrative);

  // 3. Threads API 실발송 (토큰 존재 및 dryRun 아닐 시)
  let threadsPublishedId: string | null = null;
  if (!dryRun && env.THREADS_ACCESS_TOKEN && env.THREADS_USER_ID) {
    try {
      const fullText = threadsPosts[0]?.content || "";
      const parts = fullText.split("[첫 댓글]");
      const mainPost = parts[0].trim();
      const firstComment = parts[1] ? parts[1].trim() : "";

      const imgKey = `image:threads:${effectiveDate}`;
      const imgBuffer = await env.BRIEFING_KV.get(imgKey, "arrayBuffer");
      const publicPngUrl = `https://market-briefing-distributor.neo-alpha-research.workers.dev/api/images/threads?date=${effectiveDate}`;

      const searchParams = new URLSearchParams();
      if (imgBuffer) {
        searchParams.set("media_type", "IMAGE");
        searchParams.set("image_url", publicPngUrl);
      } else {
        searchParams.set("media_type", "TEXT");
      }
      searchParams.set("text", mainPost);
      searchParams.set("access_token", env.THREADS_ACCESS_TOKEN);

      const createUrl = `https://graph.threads.net/v1.0/${env.THREADS_USER_ID}/threads`;
      const createRes = await fetch(createUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: searchParams,
      });
      const createData: any = await createRes.json();
      if (createData.id) {
        if (imgBuffer) {
          await waitForThreadsContainer(createData.id, env.THREADS_ACCESS_TOKEN);
        }
        const pubUrl = `https://graph.threads.net/v1.0/${env.THREADS_USER_ID}/threads_publish`;
        const pubRes = await fetch(pubUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            creation_id: createData.id,
            access_token: env.THREADS_ACCESS_TOKEN,
          }),
        });
        const pubData: any = await pubRes.json();
        threadsPublishedId = pubData.id || null;

        if (firstComment && threadsPublishedId) {
          await new Promise((r) => setTimeout(r, 3000));
          const replyCreateRes = await fetch(createUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              media_type: "TEXT",
              text: firstComment,
              reply_to_id: threadsPublishedId,
              access_token: env.THREADS_ACCESS_TOKEN,
            }),
          });
          const replyCreateData: any = await replyCreateRes.json();
          if (replyCreateData.id) {
            await waitForThreadsContainer(replyCreateData.id, env.THREADS_ACCESS_TOKEN);
            await fetch(pubUrl, {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                creation_id: replyCreateData.id,
                access_token: env.THREADS_ACCESS_TOKEN,
              }),
            });
          }
        }
      } else {
        console.warn("[Distributor] Threads creation warning:", createData);
      }
    } catch (tErr) {
      console.error("[Distributor] Threads Cloud publishing error:", tErr);
    }
  }

  // 4. 발송 결과
  const dispatchResults = {
    instagram: { status: "rendered_ready", slideCount: instagramSlides.length },
    threads: { 
      status: threadsPublishedId ? "published_live" : (dryRun ? "dry_run" : "rendered_ready"), 
      postCount: threadsPosts.length,
      publishedPostId: threadsPublishedId 
    },
    newsletter: { status: "rendered_ready", subject: newsletter.subject, htmlLength: newsletter.html.length },
  };

  // 5. D1 DB 기록
  try {
    await env.ETF_PRICES.prepare(
      `CREATE TABLE IF NOT EXISTS briefing_distribution_logs (
        as_of_date TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        details_json TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ).run();

    let existingDetails: any = {};
    let existingStatus: string | null = null;
    const row: any = await env.ETF_PRICES.prepare(
      `SELECT status, details_json FROM briefing_distribution_logs WHERE as_of_date = ?`
    ).bind(effectiveDate).first();
    if (row) {
      existingStatus = row.status;
      if (row.details_json) {
        try { existingDetails = JSON.parse(row.details_json); } catch (e) {}
      }
    }

    const mergedDetails = {
      ...existingDetails,
      ...dispatchResults,
      threads: dispatchResults.threads.publishedPostId 
        ? dispatchResults.threads 
        : (existingDetails.threads?.publishedPostId ? existingDetails.threads : dispatchResults.threads),
      instagram: (dispatchResults.instagram as any).publishedPostId 
        ? dispatchResults.instagram 
        : (existingDetails.instagram?.publishedPostId ? existingDetails.instagram : dispatchResults.instagram),
    };
    const nextStatus = threadsPublishedId 
      ? "distributed" 
      : (existingStatus === "distributed" ? "distributed" : (dryRun ? "dry_run" : "ready"));

    await env.ETF_PRICES.prepare(
      `INSERT OR REPLACE INTO briefing_distribution_logs (as_of_date, status, details_json, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(effectiveDate, nextStatus, JSON.stringify(mergedDetails)).run();
  } catch (dbErr) {
    console.warn("[Distributor] Log insert warning:", dbErr);
  }

  // 6. Record in KV as primary resilience store
  if (!dryRun && (threadsPublishedId || (dispatchResults.threads as any).publishedPostId)) {
    try {
      await env.BRIEFING_KV.put(kvBriefingKey, JSON.stringify({
        status: "distributed",
        publishedAt: new Date().toISOString(),
        dispatchResults,
      }), { expirationTtl: 86400 * 30 });
    } catch (e) {}
  }

  return {
    success: true,
    asOfDate: effectiveDate,
    validation,
    dispatchResults,
  };
}

export async function getOrRefineNarrative(payload: MarketBriefingPayload, env: Env): Promise<PolishedNarrative> {
  const cacheKey = `narrative_v9:${payload.asOfDate}`;
  try {
    const cached = await env.BRIEFING_KV.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      const stripEmoji = (str?: string) => (str || "").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").trim();
      return {
        ...parsed,
        slide1Subheadline: stripEmoji(parsed.slide1Subheadline),
        slide1Tip: stripEmoji(parsed.slide1Tip),
        slide4BannerTitle: stripEmoji(parsed.slide4BannerTitle),
        slide4BannerDesc: stripEmoji(parsed.slide4BannerDesc),
        slide5BannerTitle: stripEmoji(parsed.slide5BannerTitle),
        slide5BannerDesc: stripEmoji(parsed.slide5BannerDesc),
        slide5ActionTip: stripEmoji(parsed.slide5ActionTip),
        slide6Block1Title: stripEmoji(parsed.slide6Block1Title),
        slide6Block1Desc: stripEmoji(parsed.slide6Block1Desc),
        captionOpening: stripEmoji(parsed.captionOpening),
        captionMarketSummary: stripEmoji(parsed.captionMarketSummary),
        captionThemeAnalysis: stripEmoji(parsed.captionThemeAnalysis),
        captionWatchPoint: stripEmoji(parsed.captionWatchPoint),
        threadsOpening: stripEmoji(parsed.threadsOpening),
        threadsMarketSummary: stripEmoji(parsed.threadsMarketSummary),
        threadsWatchPoint: stripEmoji(parsed.threadsWatchPoint),
        firstComment: stripEmoji(parsed.firstComment),
      };
    }
  } catch (e) {}

  const baseRegime = classifyMarketRegime(payload);
  const refined = await reviewAndRefineWithGemini(payload, baseRegime, env);

  try {
    await env.BRIEFING_KV.put(cacheKey, JSON.stringify(refined), { expirationTtl: 86400 * 7 });
  } catch (e) {}

  return refined;
}

async function waitForThreadsContainer(containerId: string, accessToken: string, maxAttempts = 18): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const checkUrl = `https://graph.threads.net/v1.0/${containerId}?fields=status,error_message&access_token=${accessToken}`;
      const res = await fetch(checkUrl);
      const data: any = await res.json();
      if (data.status === "FINISHED") {
        return true;
      }
      if (data.status === "ERROR") {
        console.error(`[Distributor] Container ${containerId} processing failed:`, data);
        return false;
      }
      console.log(`[Distributor] Container ${containerId} status: ${data.status} (wait loop ${i + 1}/${maxAttempts})`);
    } catch (e) {
      console.warn("[Distributor] Status check warning:", e);
    }
  }
  return false;
}

export async function publishToThreadsLive(env: Env, payload: MarketBriefingPayload): Promise<{ success: boolean; publishedPostId?: string; permalink?: string; error?: string }> {
  // 0. Circuit Breaker & Freshness Guard
  const validation = await validateBriefingPayload(payload, env);
  if (!validation.isSafe) {
    return { success: false, error: `Circuit breaker 차단: ${validation.reasons.join(", ")}` };
  }

  // 1. Idempotency Check: Prevent duplicate publishing for the same date (Dual-Store: KV + D1)
  const kvThreadsKey = `distribution:threads:${payload.asOfDate}`;
  const kvInFlightKey = `distribution:inflight:threads:${payload.asOfDate}`;

  // 1-1. Primary Check via KV (resilient to D1 read limit/downtime)
  try {
    const kvRecord = await env.BRIEFING_KV.get<{ publishedPostId?: string; permalink?: string }>(kvThreadsKey, "json");
    if (kvRecord?.publishedPostId) {
      return {
        success: false,
        error: `해당 날짜(${payload.asOfDate})의 스레드가 이미 발행되었습니다. (게시 ID: ${kvRecord.publishedPostId})`,
        publishedPostId: kvRecord.publishedPostId,
        permalink: kvRecord.permalink || `https://www.threads.com/@neo.alphareader/post/${kvRecord.publishedPostId}`,
      };
    }
  } catch (e) {}

  // 1-2. In-Flight Mutex: Block parallel execution requests within 90s window
  try {
    const inFlight = await env.BRIEFING_KV.get(kvInFlightKey);
    if (inFlight) {
      return {
        success: false,
        error: `해당 날짜(${payload.asOfDate})의 스레드 배포가 현재 진행 중입니다. 잠시 후 확인해주세요.`,
      };
    }
    await env.BRIEFING_KV.put(kvInFlightKey, "running", { expirationTtl: 90 });
  } catch (e) {}

  // 1-3. Secondary Check via D1
  try {
    const row: any = await env.ETF_PRICES.prepare(
      `SELECT details_json FROM briefing_distribution_logs WHERE as_of_date = ?`
    ).bind(payload.asOfDate).first();
    if (row && row.details_json) {
      const parsed = JSON.parse(row.details_json);
      if (parsed.threads?.publishedPostId) {
        try { await env.BRIEFING_KV.delete(kvInFlightKey); } catch (e) {}
        return {
          success: false,
          error: `해당 날짜(${payload.asOfDate})의 스레드가 이미 발행되었습니다. (게시 ID: ${parsed.threads.publishedPostId})`,
          publishedPostId: parsed.threads.publishedPostId,
          permalink: parsed.threads.permalink || `https://www.threads.com/@neo.alphareader/post/${parsed.threads.publishedPostId}`,
        };
      }
    }
  } catch (e) {}

  // 2. Credentials Check
  if (!env.THREADS_ACCESS_TOKEN || !env.THREADS_USER_ID) {
    return { success: false, error: "Threads API credentials (THREADS_ACCESS_TOKEN or THREADS_USER_ID) missing." };
  }

  const baseUrl = env.SITE_BASE_URL || "https://etf-campus.pages.dev";
  const narrative = await getOrRefineNarrative(payload, env);
  const threadsPosts = generateThreadsThread(payload, baseUrl, narrative);
  const fullText = threadsPosts[0]?.content || "";
  const parts = fullText.split("[첫 댓글]");
  const mainPost = parts[0].trim();
  const firstComment = parts[1] ? parts[1].trim() : "";

  try {
    const createUrl = `https://graph.threads.net/v1.0/${env.THREADS_USER_ID}/threads`;
    const imgKey = `image:threads:${payload.asOfDate}`;
    const imgBuffer = await env.BRIEFING_KV.get(imgKey, "arrayBuffer");
    const publicPngUrl = `https://market-briefing-distributor.neo-alpha-research.workers.dev/api/images/threads?date=${payload.asOfDate}`;

    // 2. Self-GET Polling Guard: Defend against KV eventual consistency delays
    if (imgBuffer) {
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          const verifyRes = await fetch(publicPngUrl, { method: "HEAD" });
          if (verifyRes.ok && verifyRes.headers.get("content-type")?.includes("image")) {
            break;
          }
        } catch (e) {}
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    const searchParams = new URLSearchParams();
    if (imgBuffer) {
      searchParams.set("media_type", "IMAGE");
      searchParams.set("image_url", publicPngUrl);
    } else {
      searchParams.set("media_type", "TEXT");
    }
    searchParams.set("text", mainPost);
    searchParams.set("access_token", env.THREADS_ACCESS_TOKEN);

    const createRes = await fetch(createUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: searchParams,
    });
    const createData: any = await createRes.json();
    if (!createData.id) {
      return { success: false, error: `Failed to create Threads container: ${JSON.stringify(createData)}` };
    }

    // If media is IMAGE, wait for Meta to finish fetching and processing the image before publishing
    if (imgBuffer) {
      const isReady = await waitForThreadsContainer(createData.id, env.THREADS_ACCESS_TOKEN);
      if (!isReady) {
        return { success: false, error: `Threads image container ${createData.id} was not ready within timeout.` };
      }
    }

    const pubUrl = `https://graph.threads.net/v1.0/${env.THREADS_USER_ID}/threads_publish`;
    const pubRes = await fetch(pubUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        creation_id: createData.id,
        access_token: env.THREADS_ACCESS_TOKEN,
      }),
    });
    const pubData: any = await pubRes.json();
    const publishedPostId = pubData.id;
    if (!publishedPostId) {
      return { success: false, error: `Failed to publish Threads post: ${JSON.stringify(pubData)}` };
    }

    let firstCommentId: string | undefined;
    if (firstComment) {
      await new Promise((r) => setTimeout(r, 2500));
      const replyCreateRes = await fetch(createUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          media_type: "TEXT",
          text: firstComment,
          reply_to_id: publishedPostId,
          access_token: env.THREADS_ACCESS_TOKEN,
        }),
      });
      const replyCreateData: any = await replyCreateRes.json();
      if (replyCreateData.id) {
        await waitForThreadsContainer(replyCreateData.id, env.THREADS_ACCESS_TOKEN);
        const replyPubRes = await fetch(pubUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            creation_id: replyCreateData.id,
            access_token: env.THREADS_ACCESS_TOKEN,
          }),
        });
        const replyPubData: any = await replyPubRes.json();
        firstCommentId = replyPubData.id;
        console.log("[Distributor] First comment published:", replyPubData);
      }
    }

    const permalink = `https://www.threads.net/@neo.alphareader/post/${publishedPostId}`;

    // 3. Record success in KV (primary resilience store) and clear In-Flight Mutex
    try {
      await env.BRIEFING_KV.put(kvThreadsKey, JSON.stringify({
        status: "distributed",
        publishedPostId,
        permalink,
        firstCommentId,
        publishedAt: new Date().toISOString(),
      }), { expirationTtl: 86400 * 30 });
      await env.BRIEFING_KV.delete(kvInFlightKey);
    } catch (e) {
      console.warn("[Distributor] Failed to record Threads distribution in KV:", e);
    }

    // 4. Record success in D1 distribution logs for telemetry
    try {
      let existingDetails: any = {};
      const row: any = await env.ETF_PRICES.prepare(
        `SELECT details_json FROM briefing_distribution_logs WHERE as_of_date = ?`
      ).bind(payload.asOfDate).first();
      if (row && row.details_json) {
        try { existingDetails = JSON.parse(row.details_json); } catch (e) {}
      }
      existingDetails.threads = {
        publishedPostId,
        permalink,
        firstCommentId,
        publishedAt: new Date().toISOString(),
      };
      await env.ETF_PRICES.prepare(
        `INSERT OR REPLACE INTO briefing_distribution_logs (as_of_date, status, details_json, created_at) VALUES (?, 'distributed', ?, CURRENT_TIMESTAMP)`
      ).bind(payload.asOfDate, JSON.stringify(existingDetails)).run();
    } catch (e) {
      console.warn("[Distributor] Failed to record Threads distribution in D1:", e);
    }

    return {
      success: true,
      publishedPostId,
      permalink,
    };
  } catch (err: any) {
    try { await env.BRIEFING_KV.delete(kvInFlightKey); } catch (e) {}
    return { success: false, error: String(err) };
  }
}

export async function publishToInstagramLive(
  env: Env,
  payload: MarketBriefingPayload,
  force = false
): Promise<{ success: boolean; publishedPostId?: string; permalink?: string; error?: string }> {
  // 0. Circuit Breaker & Freshness Guard
  const validation = await validateBriefingPayload(payload, env);
  if (!validation.isSafe) {
    return { success: false, error: `Circuit breaker 차단: ${validation.reasons.join(", ")}` };
  }

  // 1. Idempotency Check: Prevent duplicate publishing for the same date (Dual-Store: KV + D1)
  const kvInstagramKey = `distribution:instagram:${payload.asOfDate}`;
  const kvInFlightKey = `distribution:inflight:instagram:${payload.asOfDate}`;

  // 1-1. Primary Check via KV (resilient to D1 read limit/downtime)
  if (!force) {
    try {
      const kvRecord = await env.BRIEFING_KV.get<{ publishedPostId?: string; permalink?: string }>(kvInstagramKey, "json");
      if (kvRecord?.publishedPostId) {
        return {
          success: false,
          error: `해당 날짜(${payload.asOfDate})의 인스타그램이 이미 발행되었습니다. (게시 ID: ${kvRecord.publishedPostId})`,
          publishedPostId: kvRecord.publishedPostId,
          permalink: kvRecord.permalink || `https://www.instagram.com/neo.alphareader/`,
        };
      }
    } catch (e) {}
  }

  // 1-2. In-Flight Mutex: Block parallel execution requests within 90s window
  try {
    const inFlight = await env.BRIEFING_KV.get(kvInFlightKey);
    if (inFlight && !force) {
      return {
        success: false,
        error: `해당 날짜(${payload.asOfDate})의 인스타그램 배포가 현재 진행 중입니다. 잠시 후 확인해주세요.`,
      };
    }
    await env.BRIEFING_KV.put(kvInFlightKey, "running", { expirationTtl: 90 });
  } catch (e) {}

  // 1-3. Secondary Check via D1
  if (!force) {
    try {
      const row: any = await env.ETF_PRICES.prepare(
        `SELECT details_json FROM briefing_distribution_logs WHERE as_of_date = ?`
      ).bind(payload.asOfDate).first();
      if (row && row.details_json) {
        const parsed = JSON.parse(row.details_json);
        if (parsed.instagram?.publishedPostId) {
          try { await env.BRIEFING_KV.delete(kvInFlightKey); } catch (e) {}
          return {
            success: false,
            error: `해당 날짜(${payload.asOfDate})의 인스타그램이 이미 발행되었습니다. (게시 ID: ${parsed.instagram.publishedPostId})`,
            publishedPostId: parsed.instagram.publishedPostId,
            permalink: parsed.instagram.permalink || `https://www.instagram.com/neo.alphareader/`,
          };
        }
      }
    } catch (e) {}
  }

  // 2. Credentials Check
  if (!env.INSTAGRAM_ACCESS_TOKEN || !env.INSTAGRAM_USER_ID) {
    return { success: false, error: "Instagram API credentials (INSTAGRAM_ACCESS_TOKEN or INSTAGRAM_USER_ID) missing." };
  }

  const narrative = await getOrRefineNarrative(payload, env);
  const caption = generateInstagramCaption(payload, narrative);

  // 3. Multi-Slide Carousel Detection (Check 6 Slides in KV)
  const slideCount = 6;
  const slideChecks = await Promise.all(
    Array.from({ length: slideCount }, (_, idx) =>
      env.BRIEFING_KV.get(`image:instagram:${payload.asOfDate}:${idx + 1}`, "arrayBuffer")
    )
  );
  const isCarousel = slideChecks.every(buf => buf !== null);

  try {
    let publishedPostId: string | null = null;

    if (isCarousel) {
      console.log(`[Distributor] Publishing 6-slide Carousel to Instagram for ${payload.asOfDate}`);
      const itemContainerIds: string[] = [];

      // 3.1 Create child media containers for each slide
      for (let slideNo = 1; slideNo <= slideCount; slideNo++) {
        const slideUrl = `https://market-briefing-distributor.neo-alpha-research.workers.dev/api/images/instagram?date=${payload.asOfDate}&slide=${slideNo}`;
        
        // Self-GET Polling Guard for each slide URL
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const vRes = await fetch(slideUrl, { method: "HEAD" });
            if (vRes.ok) break;
          } catch (e) {}
          await new Promise(r => setTimeout(r, 500));
        }

        const itemRes = await fetch(`https://graph.instagram.com/v21.0/${env.INSTAGRAM_USER_ID}/media`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            image_url: slideUrl,
            is_carousel_item: "true",
            access_token: env.INSTAGRAM_ACCESS_TOKEN,
          }),
        });
        const itemData: any = await itemRes.json();
        if (!itemData.id) {
          throw new Error(`Failed to create Instagram carousel item ${slideNo}: ${JSON.stringify(itemData)}`);
        }
        itemContainerIds.push(itemData.id);
      }

      // 3.2 Wait for all child containers to finish processing (up to 25 attempts / ~37.5s)
      for (const itemId of itemContainerIds) {
        let isChildFinished = false;
        for (let i = 0; i < 25; i++) {
          await new Promise(r => setTimeout(r, 1500));
          const statusRes = await fetch(`https://graph.instagram.com/v21.0/${itemId}?fields=status_code&access_token=${env.INSTAGRAM_ACCESS_TOKEN}`);
          const sData: any = await statusRes.json();
          if (sData.status_code === "FINISHED") {
            isChildFinished = true;
            break;
          }
          if (sData.status_code === "ERROR") {
            throw new Error(`Instagram carousel child container ${itemId} processing error: ${JSON.stringify(sData)}`);
          }
        }
        if (!isChildFinished) {
          throw new Error(`Instagram carousel child container ${itemId} timed out before reaching FINISHED status.`);
        }
      }

      // 3.3 Create parent CAROUSEL container
      const carouselRes = await fetch(`https://graph.instagram.com/v21.0/${env.INSTAGRAM_USER_ID}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          media_type: "CAROUSEL",
          children: itemContainerIds.join(","),
          caption: caption,
          access_token: env.INSTAGRAM_ACCESS_TOKEN,
        }),
      });
      const carouselData: any = await carouselRes.json();
      if (!carouselData.id) {
        throw new Error(`Failed to create Instagram carousel container: ${JSON.stringify(carouselData)}`);
      }

      // 3.4 Wait for carousel container to finish processing (up to 25 attempts / ~50s)
      let isCarouselFinished = false;
      for (let i = 0; i < 25; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const statusRes = await fetch(`https://graph.instagram.com/v21.0/${carouselData.id}?fields=status_code&access_token=${env.INSTAGRAM_ACCESS_TOKEN}`);
        const sData: any = await statusRes.json();
        if (sData.status_code === "FINISHED") {
          isCarouselFinished = true;
          break;
        }
        if (sData.status_code === "ERROR") {
          throw new Error(`Instagram carousel container ${carouselData.id} processing error: ${JSON.stringify(sData)}`);
        }
      }
      if (!isCarouselFinished) {
        throw new Error(`Instagram carousel parent container ${carouselData.id} timed out before reaching FINISHED status.`);
      }

      // 3.5 Publish the carousel
      const pubRes = await fetch(`https://graph.instagram.com/v21.0/${env.INSTAGRAM_USER_ID}/media_publish`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          creation_id: carouselData.id,
          access_token: env.INSTAGRAM_ACCESS_TOKEN,
        }),
      });
      const pubData: any = await pubRes.json();
      publishedPostId = pubData.id;
      if (!publishedPostId) {
        throw new Error(`Failed to publish Instagram carousel: ${JSON.stringify(pubData)}`);
      }
    } else {
      // Fallback to single image
      console.log(`[Distributor] Falling back to single image for Instagram ${payload.asOfDate}`);
      const publicPngUrl = `https://market-briefing-distributor.neo-alpha-research.workers.dev/api/images/threads?date=${payload.asOfDate}`;
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          const verifyRes = await fetch(publicPngUrl, { method: "HEAD" });
          if (verifyRes.ok && verifyRes.headers.get("content-type")?.includes("image")) break;
        } catch (e) {}
        await new Promise((r) => setTimeout(r, 1000));
      }

      const createRes = await fetch(`https://graph.instagram.com/v21.0/${env.INSTAGRAM_USER_ID}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          image_url: publicPngUrl,
          caption: caption,
          access_token: env.INSTAGRAM_ACCESS_TOKEN,
        }),
      });
      const createData: any = await createRes.json();
      if (!createData.id) {
        return { success: false, error: `Failed to create Instagram container: ${JSON.stringify(createData)}` };
      }

      for (let i = 0; i < 12; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const statusRes = await fetch(`https://graph.instagram.com/v21.0/${createData.id}?fields=status_code&access_token=${env.INSTAGRAM_ACCESS_TOKEN}`);
        const sData: any = await statusRes.json();
        if (sData.status_code === "FINISHED") break;
        if (sData.status_code === "ERROR") {
          return { success: false, error: `Instagram container processing error: ${JSON.stringify(sData)}` };
        }
      }

      const pubRes = await fetch(`https://graph.instagram.com/v21.0/${env.INSTAGRAM_USER_ID}/media_publish`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          creation_id: createData.id,
          access_token: env.INSTAGRAM_ACCESS_TOKEN,
        }),
      });
      const pubData: any = await pubRes.json();
      publishedPostId = pubData.id;
      if (!publishedPostId) {
        return { success: false, error: `Failed to publish Instagram post: ${JSON.stringify(pubData)}` };
      }
    }

    let permalink = `https://www.instagram.com/neo.alphareader/`;
    try {
      const pRes = await fetch(`https://graph.instagram.com/v21.0/${publishedPostId}?fields=permalink&access_token=${env.INSTAGRAM_ACCESS_TOKEN}`);
      const pData: any = await pRes.json();
      if (pData.permalink) permalink = pData.permalink;
    } catch (e) {}

    // 4. Record success in KV (primary resilience store) and clear In-Flight Mutex
    try {
      await env.BRIEFING_KV.put(kvInstagramKey, JSON.stringify({
        status: "distributed",
        publishedPostId,
        permalink,
        isCarousel,
        slideCount: isCarousel ? slideCount : 1,
        publishedAt: new Date().toISOString(),
      }), { expirationTtl: 86400 * 30 });
      await env.BRIEFING_KV.delete(kvInFlightKey);
    } catch (e) {
      console.warn("[Distributor] Failed to record Instagram distribution in KV:", e);
    }

    // 5. Record success in D1 distribution logs for telemetry
    try {
      let existingDetails: any = {};
      const row: any = await env.ETF_PRICES.prepare(
        `SELECT details_json FROM briefing_distribution_logs WHERE as_of_date = ?`
      ).bind(payload.asOfDate).first();
      if (row && row.details_json) {
        try { existingDetails = JSON.parse(row.details_json); } catch (e) {}
      }
      existingDetails.instagram = {
        publishedPostId,
        permalink,
        isCarousel,
        slideCount: isCarousel ? slideCount : 1,
        publishedAt: new Date().toISOString(),
      };
      await env.ETF_PRICES.prepare(
        `INSERT OR REPLACE INTO briefing_distribution_logs (as_of_date, status, details_json, created_at) VALUES (?, 'distributed', ?, CURRENT_TIMESTAMP)`
      ).bind(payload.asOfDate, JSON.stringify(existingDetails)).run();
    } catch (e) {
      console.warn("[Distributor] Failed to record Instagram distribution in D1:", e);
    }

    return {
      success: true,
      publishedPostId,
      permalink,
    };
  } catch (err: any) {
    try { await env.BRIEFING_KV.delete(kvInFlightKey); } catch (e) {}
    return { success: false, error: String(err) };
  }
}

function checkAuth(request: Request, env: Env): boolean {
  if (!env.MANUAL_RUN_TOKEN) {
    console.error("[SECURITY] MANUAL_RUN_TOKEN이 설정되지 않아 모든 요청을 거부합니다");
    return false;
  }
  const url = new URL(request.url);
  const qToken = url.searchParams.get("token");
  if (qToken && qToken === env.MANUAL_RUN_TOKEN) return true;

  const authHeader = request.headers.get("Authorization") || request.headers.get("X-Auth-Token");
  if (authHeader) {
    const t = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (t === env.MANUAL_RUN_TOKEN) return true;
  }

  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/etf_distributor_auth=([^;]+)/);
  if (match && match[1] === env.MANUAL_RUN_TOKEN) return true;

  return false;
}

function generateLoginHtml(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ETF Campus 배포 대시보드 관리자 인증</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Pretendard', sans-serif; }
    body { background-color: #F8FAFC; color: #0F172A; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 16px; padding: 36px; max-width: 440px; width: 100%; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08); text-align: center; }
    h1 { font-size: 20px; font-weight: 800; margin-bottom: 8px; color: #0F172A; }
    p { font-size: 14px; color: #64748B; margin-bottom: 24px; line-height: 1.5; }
    input { width: 100%; padding: 12px 16px; background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 10px; color: #0F172A; font-size: 15px; margin-bottom: 16px; outline: none; transition: border-color 0.2s; }
    input:focus { border-color: #10B981; background: #FFFFFF; }
    button { width: 100%; padding: 12px; background: #059669; border: none; border-radius: 10px; color: #FFFFFF; font-size: 15px; font-weight: 700; cursor: pointer; transition: background 0.2s; }
    button:hover { background: #047857; }
    .back-link { display: inline-block; margin-top: 16px; font-size: 13px; color: #64748B; text-decoration: none; }
    .back-link:hover { color: #059669; }
  </style>
</head>
<body>
  <div class="card">
    <div style="font-size: 40px; margin-bottom: 16px;">🔐</div>
    <h1>배포 관리자 인증</h1>
    <p>브랜드 안전을 위해 보호된 영역입니다.<br>관리자 액세스 토큰을 입력해 주세요.</p>
    <form onsubmit="handleLogin(event)">
      <input type="password" id="tokenInput" placeholder="Access Token 입력" required autocomplete="current-password">
      <button type="submit">대시보드 접속</button>
    </form>
    <a href="/preview" class="back-link">← 미리보기 모드로 이동</a>
  </div>
  <script>
    function handleLogin(e) {
      e.preventDefault();
      const token = document.getElementById('tokenInput').value.trim();
      if (!token) return;
      document.cookie = "etf_distributor_auth=" + token + "; path=/; max-age=2592000; SameSite=Lax; Secure";
      window.location.href = "/?token=" + encodeURIComponent(token);
    }
  </script>
</body>
</html>`;
}

function generateDashboardHtml(
  payload: MarketBriefingPayload,
  env: Env,
  logStatus: string,
  threadsPublishedId: string | null,
  instagramPublishedId: string | null,
  narrative: PolishedNarrative,
  logReasons: string[] = [],
  isAuthed = false,
  availableDates: string[] = []
): string {
  const hasValidDate = Boolean(payload.asOfDate);
  const date = payload.asOfDate || "";
  const dateDisplay = hasValidDate ? date : '<span style="color: #EF4444; font-weight: 800;">기준일자 없음</span>';

  const generalCount = payload.generalEtfCount;
  const generalCountDisplay = (generalCount !== undefined && generalCount !== null)
    ? `<strong style="color: #0F172A;">${typeof generalCount === "number" ? generalCount.toLocaleString() : generalCount}개</strong>`
    : '<span style="color: #EF4444; font-weight: 800;">데이터 없음</span>';

  const up = payload.upCount ?? 0;
  const flat = payload.flatCount ?? 0;
  const down = payload.downCount ?? 0;

  const kospi = payload.kospiChangePct;
  const kospiFormatted = typeof kospi === "number" ? kospi.toFixed(2) : kospi;
  const kospiDisplay = (kospi !== undefined && kospi !== null)
    ? `KOSPI ${Number(kospi) > 0 ? '+' : ''}${kospiFormatted}%`
    : 'KOSPI <span style="color: #EF4444;">데이터 없음</span>';

  const etfReturn = payload.generalAumWeightedReturnPct;
  const etfReturnFormatted = typeof etfReturn === "number" ? etfReturn.toFixed(2) : etfReturn;
  const etfReturnDisplay = (etfReturn !== undefined && etfReturn !== null)
    ? `ETF ${Number(etfReturn) > 0 ? '+' : ''}${etfReturnFormatted}%`
    : 'ETF <span style="color: #EF4444;">데이터 없음</span>';

  const threadsText = generateThreadsThread(payload, env.SITE_BASE_URL || "https://etf-campus.pages.dev", narrative)[0]?.content || "";
  const captionText = generateInstagramCaption(payload, narrative);
  const newsletterData = generateNewsletterHtml(payload, env.SITE_BASE_URL || "https://etf-campus.pages.dev", narrative);
  const newsletterSubject = newsletterData.subject;
  const newsletterPreheader = newsletterData.preheader;
  const isThreadsPublished = Boolean(threadsPublishedId);
  const isInstagramPublished = Boolean(instagramPublishedId);
  const isBlocked = logStatus === "blocked" || logReasons.length > 0;
  const modelNameDisplay = narrative.modelUsed || "gemini-3.8-flash";
  const tokenDisplay = narrative.tokenIndex ? ` · Token #${narrative.tokenIndex}` : "";
  const aiBadge = narrative.source === "gemini-refined"
    ? `<span class="badge badge-live" title="5계층 모델 워터폴 및 7대 토큰 풀 적용 (${modelNameDisplay})">🤖 ${modelNameDisplay}${tokenDisplay} 검증 완료</span>`
    : '<span class="badge badge-safe">⚙️ 정밀 룰 엔진 초안</span>';

  const uniqueDates = Array.from(new Set([date, ...availableDates])).filter(Boolean).sort().reverse();

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OSMU 통합 검토 대시보드 | ETF Campus (${date})</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif; }
    body { background-color: #F8FAFC; color: #0F172A; min-height: 100vh; padding: 20px; }
    .container { max-width: 1320px; margin: 0 auto; }
    header { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 18px; padding: 20px 24px; margin-bottom: 20px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.03); display: flex; flex-direction: column; gap: 16px; }
    .header-top { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; }
    .header-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .date-select { padding: 7px 12px; border-radius: 10px; border: 1px solid #CBD5E1; background: #FFFFFF; font-size: 13px; font-weight: 700; color: #047857; outline: none; cursor: pointer; }
    .btn-refresh { background: #F1F5F9; color: #0F172A; border: 1px solid #CBD5E1; padding: 7px 14px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s; }
    .btn-refresh:hover { background: #E2E8F0; }
    .header-badges { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .badge { padding: 5px 12px; border-radius: 9999px; font-size: 12.5px; font-weight: 700; display: inline-flex; align-items: center; gap: 5px; }
    .badge-ready { background: #FEF3C7; color: #B45309; }
    .badge-live { background: #DCFCE7; color: #15803D; }
    .badge-safe { background: #EFF6FF; color: #1D4ED8; }
    .badge-blocked { background: #FEE2E2; color: #B91C1C; }
    .badge-auth { background: #ECFDF5; color: #047857; border: 1px solid #A7F3D0; }
    .badge-anon { background: #F1F5F9; color: #64748B; border: 1px solid #CBD5E1; text-decoration: none; }
    .tabs { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
    .tab-btn { background: #FFFFFF; border: 1px solid #CBD5E1; color: #475569; padding: 12px 22px; border-radius: 12px; font-size: 14.5px; font-weight: 700; cursor: pointer; transition: all 0.2s; }
    .tab-btn:hover { background: #F8FAFC; color: #0F172A; border-color: #94A3B8; }
    .tab-btn.active { background: #059669; color: #FFFFFF; border-color: #059669; box-shadow: 0 4px 12px rgba(5,150,105,0.25); }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .card { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 18px; padding: 22px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.03); }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    @media (max-width: 960px) { .grid-2 { grid-template-columns: 1fr; } }
    .preview-img { width: 100%; max-width: 480px; aspect-ratio: 4/5; border-radius: 14px; box-shadow: 0 8px 20px rgba(0,0,0,0.06); border: 1px solid #E2E8F0; display: block; margin: 0 auto; background: #FFFFFF; object-fit: contain; }
    .carousel-nav { display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
    .nav-btn { background: #F1F5F9; color: #1E293B; border: 1px solid #CBD5E1; padding: 6px 14px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; transition: background 0.2s; }
    .nav-btn:hover { background: #E2E8F0; }
    .dot-btn { padding: 4px 10px; border-radius: 6px; border: 1px solid #CBD5E1; cursor: pointer; font-size: 12px; font-weight: 700; background: #F1F5F9; color: #475569; transition: all 0.2s; }
    .dot-btn.active { background: #059669; color: #FFFFFF; border-color: #059669; }
    .copy-box { background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 12px; padding: 16px; font-size: 14px; line-height: 1.7; color: #0F172A; white-space: pre-wrap; word-break: break-word; max-height: 520px; overflow-y: auto; font-family: 'Pretendard', sans-serif; }
    .action-btn { background: #059669; color: #FFFFFF; border: none; padding: 11px 22px; border-radius: 11px; font-size: 14.5px; font-weight: 800; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 8px; }
    .action-btn:hover { background: #047857; }
    .btn-secondary { background: #F8FAFC; color: #1E293B; padding: 6px 12px; font-size: 12.5px; border-radius: 8px; border: 1px solid #CBD5E1; cursor: pointer; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; }
    .btn-secondary:hover { background: #E2E8F0; }
    iframe.email-frame { width: 100%; height: 780px; border: 1px solid #E2E8F0; border-radius: 14px; background: #FFFFFF; }
    @media (max-width: 640px) {
      body { padding: 10px; }
      header { padding: 14px 16px; border-radius: 14px; }
      .card { padding: 14px; border-radius: 14px; }
      .tabs { gap: 6px; }
      .tab-btn { flex: 1 1 100%; text-align: center; justify-content: center; min-height: 44px; padding: 10px 14px; font-size: 13.5px; }
      .dot-btn { min-width: 38px; min-height: 38px; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; }
      .header-actions { width: 100%; justify-content: space-between; }
      .action-btn { width: 100%; justify-content: center; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="header-top">
        <div>
          <h1 style="font-size: 21px; font-weight: 900; margin-bottom: 4px; color: #0F172A; display: flex; align-items: center; gap: 8px;">
            <span>📈 ETF Campus 마켓 브리핑 OSMU 통합 검토 허브</span>
            <span style="font-size: 11px; background: #ECFDF5; color: #047857; border: 1px solid #A7F3D0; padding: 2px 8px; border-radius: 9999px; font-weight: 800;">Cloudflare Edge</span>
          </h1>
          <p style="color: #64748B; font-size: 13.5px;">데이터 기준일: <strong style="color: #0F172A;">${dateDisplay}</strong> · 일반 ETF ${generalCountDisplay} (상승 ${up} / 보합 ${flat} / 하락 ${down}) · ${kospiDisplay} · ${etfReturnDisplay}</p>
        </div>
        <div class="header-actions">
          <label style="font-size: 12px; font-weight: 700; color: #475569;">분석일:</label>
          <select id="dateSelector" class="date-select" onchange="changeDate(this.value)">
            ${uniqueDates.map(d => `<option value="${d}" ${d === date ? 'selected' : ''}>${d} ${d === uniqueDates[0] ? '(최신)' : ''}</option>`).join('')}
          </select>
          <button class="btn-refresh" onclick="forceRefresh('${date}')" title="Cloudflare 캐시를 우회하여 최신 데이터를 즉시 불러옵니다">🔄 최신 갱신</button>
          ${isAuthed 
            ? '<span class="badge badge-auth" title="관리자 토큰이 확인되었습니다">🔑 관리자 인증됨</span>' 
            : '<a href="/login" class="badge badge-anon" title="클릭하여 토큰을 등록하면 즉시 발행할 수 있습니다">🔐 미리보기 모드</a>'
          }
        </div>
      </div>
      <div class="header-badges">
        ${aiBadge}
        ${isBlocked 
          ? `<span class="badge badge-blocked" title="${logReasons.join("; ")}">⛔ 서킷브레이커 차단: ${logReasons[0] || "데이터 검증 실패"}</span>`
          : '<span class="badge badge-safe">✅ 서킷브레이커 정상</span>'
        }
        <span class="badge ${isThreadsPublished ? 'badge-live' : 'badge-ready'}">
          ${isThreadsPublished ? `✅ 스레드 발행완료 (${threadsPublishedId})` : '⏳ 스레드 대기'}
        </span>
        <span class="badge ${isInstagramPublished ? 'badge-live' : 'badge-ready'}">
          ${isInstagramPublished ? `✅ 인스타 발행완료 (${instagramPublishedId})` : '⏳ 인스타 대기'}
        </span>
      </div>
    </header>

    <div class="tabs">
      <button class="tab-btn active" onclick="switchTab(event, 'tab-instagram')">📷 인스타그램 (카드뉴스 6장 & 캡션)</button>
      <button class="tab-btn" onclick="switchTab(event, 'tab-threads')">🧵 스레드 (본문 & 인포그래픽 1장)</button>
      <button class="tab-btn" onclick="switchTab(event, 'tab-newsletter')">📧 이메일 뉴스레터 (반응형 풀뷰)</button>
    </div>

    <!-- 1. Instagram Tab -->
    <div id="tab-instagram" class="tab-content active">
      <div class="grid-2">
        <div class="card" style="text-align: center;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; text-align: left; flex-wrap: wrap; gap: 8px;">
            <h3 style="font-size: 16px; font-weight: 800;">🖼️ 카드뉴스 (슬라이드 <span id="currentSlideNum">1</span> / 6)</h3>
            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
              <div style="display: inline-flex; background: #F1F5F9; border-radius: 8px; padding: 2px; border: 1px solid #CBD5E1;">
                <button id="btnModePng" onclick="setViewMode('png')" style="padding: 4px 10px; border: none; border-radius: 6px; font-size: 11.5px; font-weight: 800; cursor: pointer; background: #059669; color: white;">🖼️ 실물 PNG</button>
                <button id="btnModeSvg" onclick="setViewMode('svg')" style="padding: 4px 10px; border: none; border-radius: 6px; font-size: 11.5px; font-weight: 800; cursor: pointer; background: transparent; color: #64748B;">⚡ SVG 벡터</button>
              </div>
              <a id="btnOpenSvg" href="/api/preview/instagram?date=${date}&slide=1" target="_blank" class="btn-secondary">🔍 SVG 원본</a>
              <a id="btnDownloadPng" href="/api/images/instagram?date=${date}&slide=1" target="_blank" class="btn-secondary">⬇️ PNG 다운</a>
            </div>
          </div>
          <div style="position: relative; width: 100%; max-width: 480px; margin: 0 auto;">
            <img id="instagramImg" src="/api/images/instagram?date=${date}&slide=1&v=${Date.now()}" class="preview-img" alt="Instagram Card" onerror="handleInstagramImgError(this)">
          </div>
          <div class="carousel-nav">
            <button class="nav-btn" onclick="changeSlide(-1)">◀ 이전</button>
            <div id="slideDots" style="display: flex; gap: 6px;"></div>
            <button class="nav-btn" onclick="changeSlide(1)">다음 ▶</button>
          </div>
        </div>
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h3 style="font-size: 16px; font-weight: 800;">📝 인스타그램 캡션 전문</h3>
            <button class="btn-secondary" onclick="copyText('instagramCaptionText')">📋 캡션 복사</button>
          </div>
          <div id="instagramCaptionText" class="copy-box">${captionText}</div>
          <div style="margin-top: 16px; text-align: right;">
            ${isInstagramPublished 
              ? `<button class="action-btn" disabled style="background: #334155; cursor: not-allowed;">✅ 인스타그램 발행 완료 (ID: ${instagramPublishedId})</button>`
              : ((!hasValidDate || isBlocked)
                  ? `<button class="action-btn" disabled style="background: #94A3B8; cursor: not-allowed;">🚫 발행 불가 (${!hasValidDate ? '기준일자 없음' : '서킷브레이커 차단'})</button>`
                  : `<button id="btnPublishInstagram" class="action-btn" style="background: linear-gradient(135deg, #E1306C, #C13584); color: white;" onclick="publishInstagram('${date}')">📸 이 내용으로 인스타그램 6장 카드뉴스 즉시 발행</button>`
                )
            }
          </div>
        </div>
      </div>
    </div>

    <!-- 2. Threads Tab -->
    <div id="tab-threads" class="tab-content">
      <div class="grid-2">
        <div class="card" style="text-align: center;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; text-align: left; flex-wrap: wrap; gap: 8px;">
            <h3 style="font-size: 16px; font-weight: 800;">🖼️ 스레드 전용 인포그래픽 (1장)</h3>
            <div style="display: flex; gap: 6px;">
              <a href="/api/preview/threads-image?date=${date}" target="_blank" class="btn-secondary">🔍 SVG 원본</a>
              <a href="/api/images/threads?date=${date}" target="_blank" class="btn-secondary">⬇️ PNG 다운</a>
            </div>
          </div>
          <img id="threadsImg" src="/api/images/threads?date=${date}&v=${Date.now()}" class="preview-img" alt="Threads Infographic" onerror="this.onerror=null; this.src='/api/preview/threads-image?date=${date}&v='+Date.now()">
        </div>
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h3 style="font-size: 16px; font-weight: 800;">🧵 스레드 본문 & 댓글 전문</h3>
            <button class="btn-secondary" onclick="copyText('threadsFullText')">📋 본문 복사</button>
          </div>
          <div id="threadsFullText" class="copy-box">${threadsText}</div>
          <div style="margin-top: 16px; text-align: right;">
            ${isThreadsPublished 
              ? `<button class="action-btn" disabled style="background: #334155; cursor: not-allowed;">✅ 스레드 발행 완료 (ID: ${threadsPublishedId})</button>`
              : ((!hasValidDate || isBlocked)
                  ? `<button class="action-btn" disabled style="background: #94A3B8; cursor: not-allowed;">🚫 발행 불가 (${!hasValidDate ? '기준일자 없음' : '서킷브레이커 차단'})</button>`
                  : `<button id="btnPublishThreads" class="action-btn" onclick="publishThreads('${date}')">🚀 이 내용으로 스레드 즉시 발행</button>`
                )
            }
          </div>
        </div>
      </div>
    </div>

    <!-- 3. Newsletter Tab -->
    <div id="tab-newsletter" class="tab-content">
      <div class="card">
        <!-- Meta Bar -->
        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 14px 16px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 8px;">
            <div style="font-size: 13.5px; color: #1E293B; line-height: 1.5;">
              <strong style="color: #047857; margin-right: 6px;">[메일 제목]</strong>
              <span id="newsletterSubjectText" style="font-weight: 700;">${escapeXml(newsletterSubject)}</span>
            </div>
            <button class="btn-secondary" onclick="copyNewsletterField('newsletterSubjectText')" style="white-space: nowrap;">📋 제목 복사</button>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
            <div style="font-size: 12.5px; color: #64748B; line-height: 1.5;">
              <strong style="color: #475569; margin-right: 6px;">[받은편지함 미리보기]</strong>
              <span id="newsletterPreheaderText">${escapeXml(newsletterPreheader)}</span>
            </div>
            <button class="btn-secondary" onclick="copyNewsletterField('newsletterPreheaderText')" style="white-space: nowrap;">📋 미리보기 복사</button>
          </div>
        </div>

        <!-- Controls Bar -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
          <div style="display: flex; gap: 8px; align-items: center;">
            <h3 style="font-size: 16px; font-weight: 800; margin: 0;">📧 이메일 뉴스레터 프리뷰</h3>
            <div style="display: inline-flex; background: #F1F5F9; border-radius: 8px; padding: 2px; border: 1px solid #CBD5E1;">
              <button id="btnEmailDesktop" onclick="setEmailViewport('desktop')" style="padding: 4px 10px; border: none; border-radius: 6px; font-size: 11.5px; font-weight: 800; cursor: pointer; background: #059669; color: white;">💻 데스크톱 (620px)</button>
              <button id="btnEmailMobile" onclick="setEmailViewport('mobile')" style="padding: 4px 10px; border: none; border-radius: 6px; font-size: 11.5px; font-weight: 800; cursor: pointer; background: transparent; color: #64748B;">📱 모바일 (375px)</button>
            </div>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button class="btn-secondary" onclick="copyNewsletterHtml('${date}')">📋 HTML 전체 소스 복사</button>
            <a href="/api/preview/newsletter?date=${date}" target="_blank" class="btn-secondary">🔗 새 창에서 전체보기</a>
          </div>
        </div>

        <!-- Iframe Container -->
        <div id="emailFrameContainer" style="max-width: 620px; margin: 0 auto; transition: max-width 0.25s ease; border: 1px solid #E2E8F0; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.04);">
          <iframe id="emailFrame" src="/api/preview/newsletter?date=${date}" class="email-frame" style="width: 100%; height: 800px; border: none; background: #FFFFFF; display: block;"></iframe>
        </div>
      </div>
    </div>
    <footer style="margin-top: 24px; text-align: center; font-size: 12px; color: #64748B; padding: 16px; border-top: 1px solid #E2E8F0;">
      * 본 대시보드는 한국거래소(KRX) 공시 데이터 기반 객관적 분석을 제공하며, 특정 종목의 매수·매도를 추천하지 않습니다. (자본시장법 제101조 준수)
    </footer>
  </div>

  <script>
    let currentSlide = 1;
    const totalSlides = 6;
    const date = '${date}';
    let viewMode = localStorage.getItem('osmu_view_mode') || 'png';

    function setViewMode(mode) {
      viewMode = mode;
      localStorage.setItem('osmu_view_mode', mode);
      updateModeButtons();
      updateSlide();
    }

    function updateModeButtons() {
      const btnPng = document.getElementById('btnModePng');
      const btnSvg = document.getElementById('btnModeSvg');
      if (!btnPng || !btnSvg) return;
      if (viewMode === 'png') {
        btnPng.style.background = '#059669';
        btnPng.style.color = '#FFFFFF';
        btnSvg.style.background = 'transparent';
        btnSvg.style.color = '#64748B';
      } else {
        btnSvg.style.background = '#059669';
        btnSvg.style.color = '#FFFFFF';
        btnPng.style.background = 'transparent';
        btnPng.style.color = '#64748B';
      }
    }

    function handleInstagramImgError(img) {
      if (viewMode === 'png') {
        console.warn('[Dashboard] PNG not found, falling back to SVG renderer');
        viewMode = 'svg';
        updateModeButtons();
        img.src = '/api/preview/instagram?date=' + encodeURIComponent(date) + '&slide=' + currentSlide + '&v=' + Date.now();
      }
    }

    function getCookie(name) {
      const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
      return match ? match[2] : null;
    }

    function switchTab(evt, tabId) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      evt.currentTarget.classList.add('active');
      document.getElementById(tabId).classList.add('active');
      localStorage.setItem('osmu_active_tab', tabId);
      location.hash = tabId;
    }

    function changeSlide(delta) {
      currentSlide += delta;
      if (currentSlide < 1) currentSlide = totalSlides;
      if (currentSlide > totalSlides) currentSlide = 1;
      updateSlide();
    }

    function goToSlide(n) {
      currentSlide = n;
      updateSlide();
    }

    function updateSlide() {
      const img = document.getElementById('instagramImg');
      const v = Date.now();
      if (viewMode === 'png') {
        img.src = '/api/images/instagram?date=' + encodeURIComponent(date) + '&slide=' + currentSlide + '&v=' + v;
      } else {
        img.src = '/api/preview/instagram?date=' + encodeURIComponent(date) + '&slide=' + currentSlide + '&v=' + v;
      }
      document.getElementById('btnOpenSvg').href = '/api/preview/instagram?date=' + encodeURIComponent(date) + '&slide=' + currentSlide;
      document.getElementById('btnDownloadPng').href = '/api/images/instagram?date=' + encodeURIComponent(date) + '&slide=' + currentSlide;
      document.getElementById('currentSlideNum').innerText = currentSlide;
      renderDots();
      localStorage.setItem('osmu_active_slide', currentSlide);
    }

    function renderDots() {
      const container = document.getElementById('slideDots');
      container.innerHTML = '';
      for (let i = 1; i <= totalSlides; i++) {
        const dot = document.createElement('button');
        dot.innerText = i;
        dot.className = 'dot-btn' + (i === currentSlide ? ' active' : '');
        dot.onclick = () => goToSlide(i);
        container.appendChild(dot);
      }
    }

    function copyText(elemId) {
      const text = document.getElementById(elemId).innerText;
      navigator.clipboard.writeText(text).then(() => {
        alert('클립보드에 복사되었습니다!');
      });
    }

    function forceRefresh(dateStr) {
      const url = new URL(window.location.href);
      url.searchParams.set('fresh', '1');
      if (dateStr) url.searchParams.set('date', dateStr);
      window.location.href = url.toString();
    }

    function changeDate(d) {
      const url = new URL(window.location.href);
      url.searchParams.set('date', d);
      url.searchParams.delete('fresh');
      window.location.href = url.toString();
    }

    async function publishThreads(dateStr) {
      if (!dateStr || dateStr === '기준일자 없음') {
        alert('기준일자가 유효하지 않아 발행할 수 없습니다.');
        return;
      }
      let token = getCookie('etf_distributor_auth') || new URLSearchParams(location.search).get('token');
      if (!token) {
        token = prompt('스레드 발행을 위해 관리자 토큰(MANUAL_RUN_TOKEN)을 입력하세요:');
        if (!token) return;
        document.cookie = 'etf_distributor_auth=' + token + '; path=/; max-age=2592000; SameSite=Lax; Secure';
      }
      if (!confirm(dateStr + ' 마켓 브리핑을 스레드(@neo.alphareader)에 실시간 자동 발행하시겠습니까?')) return;
      const btn = event.target;
      btn.disabled = true;
      btn.innerText = '스레드 발행 처리 중...';

      try {
        const res = await fetch('/api/publish/threads?date=' + encodeURIComponent(dateStr) + '&token=' + encodeURIComponent(token), {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token }
        });
        const resText = await res.text();
        let data;
        try {
          data = JSON.parse(resText);
        } catch (jsonErr) {
          throw new Error('서버 응답 오류 (' + res.status + '): ' + resText.slice(0, 150));
        }
        if (data.success) {
          alert('스레드 발행 성공! (ID: ' + data.publishedPostId + ')');
          location.reload();
        } else {
          alert('발행 실패: ' + (data.error || JSON.stringify(data)));
          btn.disabled = false;
          btn.innerText = '🚀 이 내용으로 스레드 즉시 발행';
        }
      } catch (e) {
        alert('요청 중 오류 발생: ' + e);
        btn.disabled = false;
        btn.innerText = '🚀 이 내용으로 스레드 즉시 발행';
      }
    }

    async function publishInstagram(dateStr) {
      if (!dateStr || dateStr === '기준일자 없음') {
        alert('기준일자가 유효하지 않아 발행할 수 없습니다.');
        return;
      }
      let token = getCookie('etf_distributor_auth') || new URLSearchParams(location.search).get('token');
      if (!token) {
        token = prompt('인스타그램 발행을 위해 관리자 토큰(MANUAL_RUN_TOKEN)을 입력하세요:');
        if (!token) return;
        document.cookie = 'etf_distributor_auth=' + token + '; path=/; max-age=2592000; SameSite=Lax; Secure';
      }
      if (!confirm(dateStr + ' 마켓 브리핑을 인스타그램(@neo.alphareader)에 6장 카드뉴스로 실시간 자동 발행하시겠습니까?')) return;
      const btn = event.target;
      btn.disabled = true;
      btn.innerText = '인스타그램 발행 처리 중...';

      try {
        const res = await fetch('/api/publish/instagram?date=' + encodeURIComponent(dateStr) + '&force=true&token=' + encodeURIComponent(token), {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token }
        });
        const resText = await res.text();
        let data;
        try {
          data = JSON.parse(resText);
        } catch (jsonErr) {
          throw new Error('서버 응답 오류 (' + res.status + '): ' + resText.slice(0, 150));
        }
        if (data.success) {
          alert('인스타그램 발행 성공! (ID: ' + data.publishedPostId + ')');
          location.reload();
        } else {
          alert('인스타그램 발행 실패: ' + (data.error || JSON.stringify(data)));
          btn.disabled = false;
          btn.innerText = '📸 이 내용으로 인스타그램 6장 카드뉴스 즉시 발행';
        }
      } catch (e) {
        alert('요청 중 오류 발생: ' + e);
        btn.disabled = false;
        btn.innerText = '📸 이 내용으로 인스타그램 6장 카드뉴스 즉시 발행';
      }
    }

    let emailViewport = localStorage.getItem('osmu_email_viewport') || 'desktop';
    function setEmailViewport(mode) {
      emailViewport = mode;
      localStorage.setItem('osmu_email_viewport', mode);
      const btnDesk = document.getElementById('btnEmailDesktop');
      const btnMob = document.getElementById('btnEmailMobile');
      const container = document.getElementById('emailFrameContainer');
      if (!btnDesk || !btnMob || !container) return;
      if (mode === 'mobile') {
        container.style.maxWidth = '375px';
        btnMob.style.background = '#059669';
        btnMob.style.color = '#FFFFFF';
        btnDesk.style.background = 'transparent';
        btnDesk.style.color = '#64748B';
      } else {
        container.style.maxWidth = '620px';
        btnDesk.style.background = '#059669';
        btnDesk.style.color = '#FFFFFF';
        btnMob.style.background = 'transparent';
        btnMob.style.color = '#64748B';
      }
    }

    function copyNewsletterField(elementId) {
      const el = document.getElementById(elementId);
      if (!el) return;
      navigator.clipboard.writeText(el.innerText || el.textContent).then(() => {
        alert('클립보드에 복사되었습니다.');
      }).catch(() => {
        alert('복사에 실패했습니다.');
      });
    }

    async function copyNewsletterHtml(dateStr) {
      try {
        const res = await fetch('/api/preview/newsletter?date=' + encodeURIComponent(dateStr));
        const html = await res.text();
        await navigator.clipboard.writeText(html);
        alert('이메일 뉴스레터 전체 HTML 소스코드가 클립보드에 복사되었습니다. (스티비/메일침프에 바로 붙여넣기 가능)');
      } catch (e) {
        alert('HTML 복사 실패: ' + e);
      }
    }

    // Restore saved slide, tab and email viewport
    setEmailViewport(emailViewport);
    const savedSlide = parseInt(localStorage.getItem('osmu_active_slide') || '1', 10);
    if (!isNaN(savedSlide) && savedSlide >= 1 && savedSlide <= totalSlides) {
      currentSlide = savedSlide;
    }
    updateModeButtons();
    updateSlide();

    const hashTab = location.hash ? location.hash.replace('#', '') : null;
    const savedTab = hashTab || localStorage.getItem('osmu_active_tab');
    if (savedTab && document.getElementById(savedTab)) {
      document.querySelectorAll('.tab-btn').forEach(b => {
        if (b.getAttribute('onclick').includes(savedTab)) {
          b.click();
        }
      });
    }
  </script>
</body>
</html>`;
}

const workerHandler = {
  // Queue Consumer: prepares assets and saves status as 'ready' (Human-in-the-Loop review)
  async queue(batch: MessageBatch<BriefingDistributeEvent>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      const event = message.body;
      const targetDate = event.as_of_date;

      try {
        console.log(`[Distributor] Consuming distribution event for ${targetDate} v${event.publication_version}`);
        const payload = await loadBriefingPayload(env, targetDate);
        if (!payload) {
          console.error(`[Distributor] Payload for ${targetDate} not found in KV.`);
          message.retry({ delaySeconds: Math.min(3600, 60 * 2 ** Math.min(message.attempts, 5)) });
          continue;
        }

        const validation = await validateBriefingPayload(payload, env);
        await env.ETF_PRICES.prepare(
          `CREATE TABLE IF NOT EXISTS briefing_distribution_logs (
            as_of_date TEXT PRIMARY KEY,
            status TEXT NOT NULL,
            details_json TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`
        ).run();

        let existingStatus: string | null = null;
        let existingDetails: Record<string, any> = {};
        try {
          const row: any = await env.ETF_PRICES.prepare(
            `SELECT status, details_json FROM briefing_distribution_logs WHERE as_of_date = ?`
          ).bind(targetDate).first();
          if (row) {
            existingStatus = row.status;
            if (row.details_json) {
              try { existingDetails = JSON.parse(row.details_json); } catch (e) {}
            }
          }
        } catch (e) {
          console.warn("[Distributor] Failed to query existing log in queue:", e);
        }

        if (!validation.isSafe) {
          console.error(`[Distributor] Circuit breaker tripped for ${targetDate}:`, validation.reasons);
          existingDetails.reasons = validation.reasons;
          existingDetails.event_id = event.event_id;
          existingDetails.validated = false;
          const nextStatus = existingStatus === "distributed" ? "distributed" : "blocked";
          if (existingStatus === "distributed") {
            existingDetails.revision_blocked = true;
          }
          await env.ETF_PRICES.prepare(
            `INSERT OR REPLACE INTO briefing_distribution_logs (as_of_date, status, details_json, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
          ).bind(targetDate, nextStatus, JSON.stringify(existingDetails)).run();
          message.ack();
          continue;
        }

        // Pre-warm Gemini narrative so it is ready instantaneously for operator review
        try {
          await getOrRefineNarrative(payload, env);
        } catch (narrativeErr) {
          console.warn(`[Distributor] Narrative pre-warm warning for ${targetDate}:`, narrativeErr);
        }

        // Prepare distribution log by merging details without overwriting threads/instagram keys
        existingDetails.event_id = event.event_id;
        existingDetails.validated = true;
        delete existingDetails.reasons;

        let nextStatus = "ready";
        if (existingStatus === "distributed") {
          nextStatus = "distributed";
          existingDetails.revision_pending = true;
        }

        await env.ETF_PRICES.prepare(
          `INSERT OR REPLACE INTO briefing_distribution_logs (as_of_date, status, details_json, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
        ).bind(targetDate, nextStatus, JSON.stringify(existingDetails)).run();

        console.log(`[Distributor] Assets prepared in ${nextStatus} state for ${targetDate}. Awaiting operator review.`);
        message.ack();
      } catch (err) {
        console.error(`[Distributor] Fatal error preparing distribution for ${targetDate}:`, err);
        message.retry({ delaySeconds: Math.min(3600, 60 * 2 ** Math.min(message.attempts, 5)) });
      }
    }
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const targetDate = url.searchParams.get("date") || undefined;
    const baseUrl = env.SITE_BASE_URL || "https://etf-campus.pages.dev";
    const isAuthed = checkAuth(request, env);

    try {
      // 0. Security Guard for Publish and Distribute endpoints
      if (url.pathname.startsWith("/api/publish") || url.pathname.startsWith("/api/distribute") || url.pathname.startsWith("/internal/distribute")) {
        if (!isAuthed) {
          return Response.json({ success: false, error: "Unauthorized: Invalid or missing authentication token." }, { status: 401 });
        }
      }

      // 1. Health API Status
      if (url.pathname === "/health") {
        return Response.json({
          service: "market-briefing-distributor",
          status: "online",
          version: "1.0.0",
          timestamp: new Date().toISOString(),
        });
      }

      // Standalone Login Page
      if (url.pathname === "/login") {
        return new Response(generateLoginHtml(), {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      // 1.1 Root & Preview: Cloud Review Dashboard Hub
      if (url.pathname === "/" || url.pathname === "/preview") {
        const isFresh = url.searchParams.get("fresh") === "1";
        const cacheKey = `dashboard:html:v4:${targetDate || "latest"}:${isAuthed ? "authed" : "anon"}`;

        if (!isFresh) {
          try {
            const cachedHtml = await env.BRIEFING_KV.get(cacheKey);
            if (cachedHtml) {
              const resHeaders = new Headers({
                "Content-Type": "text/html; charset=utf-8",
                "Cache-Control": "no-cache, must-revalidate",
                "X-Dashboard-Cache": "HIT",
              });
              if (url.searchParams.get("token") === env.MANUAL_RUN_TOKEN && env.MANUAL_RUN_TOKEN) {
                resHeaders.set("Set-Cookie", `etf_distributor_auth=${env.MANUAL_RUN_TOKEN}; Path=/; Max-Age=2592000; SameSite=Lax; Secure; HttpOnly`);
              }
              return new Response(cachedHtml, { headers: resHeaders });
            }
          } catch (e) {}
        }

        const payload = await loadBriefingPayload(env, targetDate);
        if (!payload) {
          return new Response("Briefing not found for date: " + (targetDate || "latest"), { status: 404 });
        }

        let logStatus = "ready";
        let threadsPublishedId: string | null = null;
        let instagramPublishedId: string | null = null;
        let logReasons: string[] = [];
        try {
          const row: any = await env.ETF_PRICES.prepare(
            `SELECT status, details_json FROM briefing_distribution_logs WHERE as_of_date = ?`
          ).bind(payload.asOfDate).first();
          if (row) {
            logStatus = row.status;
            if (row.details_json) {
              const parsed = JSON.parse(row.details_json);
              threadsPublishedId = parsed.threads?.publishedPostId || null;
              instagramPublishedId = parsed.instagram?.publishedPostId || null;
              if (parsed.reasons) logReasons = parsed.reasons;
            }
          }
        } catch (e) {}

        const validation = await validateBriefingPayload(payload, env);
        if (!validation.isSafe && logReasons.length === 0) {
          logReasons = validation.reasons;
        }

        const narrative = await getOrRefineNarrative(payload, env);

        // Fetch recent available dates for dropdown
        let availableDates: string[] = [payload.asOfDate];
        try {
          const rows: any = await env.ETF_PRICES.prepare(
            `SELECT DISTINCT as_of_date FROM market_briefings ORDER BY as_of_date DESC LIMIT 10`
          ).all();
          if (rows?.results?.length) {
            availableDates = rows.results.map((r: any) => r.as_of_date);
          }
        } catch (e) {
          availableDates = [payload.asOfDate].filter(Boolean);
        }

        const html = generateDashboardHtml(
          payload,
          env,
          logStatus,
          threadsPublishedId,
          instagramPublishedId,
          narrative,
          logReasons,
          isAuthed,
          availableDates
        );

        try {
          await env.BRIEFING_KV.put(cacheKey, html, { expirationTtl: 3600 });
        } catch (e) {}

        const responseHeaders = new Headers({
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache, must-revalidate",
          "X-Dashboard-Cache": "MISS",
        });
        if (url.searchParams.get("token") === env.MANUAL_RUN_TOKEN && env.MANUAL_RUN_TOKEN) {
          responseHeaders.set("Set-Cookie", `etf_distributor_auth=${env.MANUAL_RUN_TOKEN}; Path=/; Max-Age=2592000; SameSite=Lax; Secure; HttpOnly`);
        }
        return new Response(html, { headers: responseHeaders });
      }

      // 2. 인스타그램 카드뉴스 프리뷰 (슬라이드 번호 지정 시 SVG 반환, 미지정 시 HTML 리다이렉트 또는 JSON)
      if (url.pathname === "/api/preview/instagram" || url.pathname === "/api/preview/instagram/caption") {
        const payload = await loadBriefingPayload(env, targetDate);
        if (!payload) return new Response("Briefing not found", { status: 404 });

        const narrative = await getOrRefineNarrative(payload, env);
        const caption = generateInstagramCaption(payload, narrative);
        if (url.pathname === "/api/preview/instagram/caption" || url.searchParams.get("slide") === "caption") {
          return new Response(caption, {
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "Access-Control-Allow-Origin": "*",
            },
          });
        }

        const slides = generateInstagramCarousel(payload, baseUrl, narrative);
        const slideParam = url.searchParams.get("slide");
        if (slideParam) {
          const slideNo = parseInt(slideParam, 10);
          const slide = slides.find(s => s.slideNumber === slideNo) || slides[0];
          return new Response(slide.svgContent, {
            headers: {
              "Content-Type": "image/svg+xml; charset=utf-8",
              "Cache-Control": "no-store, no-cache, must-revalidate",
              "Access-Control-Allow-Origin": "*",
            },
          });
        }

        return Response.json({ success: true, asOfDate: payload.asOfDate, caption, slides });
      }

      // 3. 스레드 전용 인포그래픽 1장 프리뷰 (SVG)
      if (url.pathname === "/api/preview/threads-image") {
        const payload = await loadBriefingPayload(env, targetDate);
        if (!payload) return new Response("Briefing not found", { status: 404 });

        const svg = generateThreadsImageSvg(payload);
        return new Response(svg, {
          headers: {
            "Content-Type": "image/svg+xml; charset=utf-8",
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      // 3.1 스레드 실물 PNG 이미지 서빙 (Meta Threads Graph API 규격)
      if (url.pathname === "/api/images/threads" || url.pathname === "/api/preview/threads-image.png") {
        const payload = await loadBriefingPayload(env, targetDate);
        const date = payload?.asOfDate || targetDate;
        if (!date) {
          return new Response("Missing date parameter for threads image", { status: 400 });
        }
        const key = `image:threads:${date}`;
        const imgBuffer = await env.BRIEFING_KV.get(key, "arrayBuffer");
        if (!imgBuffer) {
          return new Response("PNG image not found in KV", { status: 404 });
        }
        return new Response(imgBuffer, {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=86400",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      // 3.2 인스타그램 카드뉴스 각 슬라이드 실물 PNG 이미지 서빙 (Meta Instagram Carousel 규격)
      if (url.pathname === "/api/images/instagram" || url.pathname === "/api/preview/instagram.png") {
        const payload = await loadBriefingPayload(env, targetDate);
        const date = payload?.asOfDate || targetDate;
        const slideNo = url.searchParams.get("slide") || "1";
        if (!date) {
          return new Response("Missing date parameter for instagram slide", { status: 400 });
        }
        const key = `image:instagram:${date}:${slideNo}`;
        const imgBuffer = await env.BRIEFING_KV.get(key, "arrayBuffer");
        if (!imgBuffer) {
          return new Response(`PNG slide ${slideNo} not found in KV`, { status: 404 });
        }
        return new Response(imgBuffer, {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=86400",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      // 4. 스레드 타래 텍스트 프리뷰
      if (url.pathname === "/api/preview/threads") {
        const payload = await loadBriefingPayload(env, targetDate);
        if (!payload) return new Response("Briefing not found", { status: 404 });

        const narrative = await getOrRefineNarrative(payload, env);
        const posts = generateThreadsThread(payload, baseUrl, narrative);
        return Response.json({ success: true, asOfDate: payload.asOfDate, posts });
      }

      // 5. 이메일 뉴스레터 반응형 HTML 프리뷰
      if (url.pathname === "/api/preview/newsletter") {
        const queryDate = (!targetDate || targetDate === "latest") ? undefined : targetDate;
        const payload = await loadBriefingPayload(env, queryDate);
        if (!payload) return new Response("Briefing not found", { status: 404 });

        const narrative = await getOrRefineNarrative(payload, env);
        const newsletter = generateNewsletterHtml(payload, baseUrl, narrative);
        return new Response(newsletter.html, {
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" },
        });
      }

      // 6. 스레드 실시간 발행 엔드포인트
      if (url.pathname === "/api/publish/threads") {
        const queryDate = (!targetDate || targetDate === "latest") ? undefined : targetDate;
        const payload = await loadBriefingPayload(env, queryDate);
        if (!payload) return Response.json({ success: false, error: "Briefing not found" }, { status: 404 });

        const publishRes = await publishToThreadsLive(env, payload);
        return Response.json({ ...publishRes, targetDate: payload.asOfDate });
      }

      // 6.1 인스타그램 실시간 발행 엔드포인트
      if (url.pathname === "/api/publish/instagram") {
        const queryDate = (!targetDate || targetDate === "latest") ? undefined : targetDate;
        const force = url.searchParams.get("force") === "true";
        const payload = await loadBriefingPayload(env, queryDate);
        if (!payload) return Response.json({ success: false, error: "Briefing not found" }, { status: 404 });

        const publishRes = await publishToInstagramLive(env, payload, force);
        return Response.json({ ...publishRes, targetDate: payload.asOfDate });
      }

      // 7. 통합 distribute 엔드포인트 (dryRun 파라미터 지원)
      if (url.pathname === "/internal/distribute" || url.pathname === "/api/distribute") {
        const queryDate = (!targetDate || targetDate === "latest") ? undefined : targetDate;
        const dryRun = url.searchParams.get("dryRun") === "true";
        try {
          const result = await executeDistribution(env, queryDate, dryRun);
          return Response.json(result);
        } catch (err: any) {
          return Response.json({ success: false, error: String(err) }, { status: 500 });
        }
      }

      return new Response("ETF Campus Market Briefing Distributor Worker. Visit /preview for dashboard.", { status: 200 });
    } catch (err: any) {
      console.error("[Distributor] Unhandled fetch error:", err);
      return new Response(`Server Error: ${err.message || String(err)}`, { status: 500 });
    }
  },
};

export default workerHandler;
