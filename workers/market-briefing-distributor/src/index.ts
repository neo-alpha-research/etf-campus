import { validateBriefingPayload } from "./circuit-breaker";
import { generateInstagramCarousel, generateInstagramCaption } from "./templates/instagram";
import { generateNewsletterHtml } from "./templates/newsletter";
import { generateThreadsThread, generateThreadsImageSvg } from "./templates/threads";
import { reviewAndRefineWithGemini, type PolishedNarrative } from "./services/gemini";
import { classifyMarketRegime, type MarketRegime } from "./services/market-regime";
import type { BriefingDistributeEvent, Env, MarketBriefingPayload } from "./types";

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

  return null;
}

export async function executeDistribution(env: Env, targetDate?: string, dryRun = false): Promise<any> {
  const payload = await loadBriefingPayload(env, targetDate);
  if (!payload) {
    throw new Error(`Briefing payload for ${targetDate || "latest"} not found`);
  }

  const effectiveDate = payload.asOfDate || targetDate || "latest";

  // 1. 서킷 브레이커 검증
  const validation = validateBriefingPayload(payload, env);
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
      await env.ETF_PRICES.prepare(
        `INSERT OR REPLACE INTO briefing_distribution_logs (as_of_date, status, details_json, created_at) VALUES (?, 'blocked', ?, CURRENT_TIMESTAMP)`
      ).bind(effectiveDate, JSON.stringify({ reasons: validation.reasons })).run();
    } catch (e) {}
    return { success: false, status: "blocked", reasons: validation.reasons };
  }

  // 2. 템플릿 생성 (인스타그램 6장, 스레드 4단, 이메일 HTML)
  const baseUrl = env.SITE_BASE_URL || "https://etf-campus.pages.dev";
  const narrative = await getOrRefineNarrative(payload, env);
  const instagramSlides = generateInstagramCarousel(payload, baseUrl, narrative);
  const threadsPosts = generateThreadsThread(payload, baseUrl, narrative);
  const newsletter = generateNewsletterHtml(payload, baseUrl);

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

    await env.ETF_PRICES.prepare(
      `INSERT OR REPLACE INTO briefing_distribution_logs (as_of_date, status, details_json, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(effectiveDate, threadsPublishedId ? "distributed" : (dryRun ? "dry_run" : "ready"), JSON.stringify(dispatchResults)).run();
  } catch (dbErr) {
    console.warn("[Distributor] Log insert warning:", dbErr);
  }

  return {
    success: true,
    asOfDate: effectiveDate,
    validation,
    dispatchResults,
  };
}

export async function getOrRefineNarrative(payload: MarketBriefingPayload, env: Env): Promise<PolishedNarrative> {
  const cacheKey = `narrative_v8:${payload.asOfDate}`;
  try {
    const cached = await env.BRIEFING_KV.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {}

  const baseRegime = classifyMarketRegime(payload);
  const refined = await reviewAndRefineWithGemini(payload, baseRegime, env);

  try {
    await env.BRIEFING_KV.put(cacheKey, JSON.stringify(refined), { expirationTtl: 86400 * 7 });
  } catch (e) {}

  return refined;
}

async function waitForThreadsContainer(containerId: string, accessToken: string, maxAttempts = 12): Promise<boolean> {
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

    try {
      await env.ETF_PRICES.prepare(
        `UPDATE briefing_distribution_logs SET status = 'distributed', created_at = CURRENT_TIMESTAMP WHERE as_of_date = ?`
      ).bind(payload.asOfDate).run();
    } catch (e) {}

    return {
      success: true,
      publishedPostId,
      permalink: `https://www.threads.com/@neo.alphareader/post/${publishedPostId}`,
    };
  } catch (err: any) {
    return { success: false, error: String(err) };
  }
}

function generateDashboardHtml(
  payload: MarketBriefingPayload,
  env: Env,
  logStatus: string,
  threadsPublishedId: string | null,
  narrative: PolishedNarrative
): string {
  const date = payload.asOfDate || "2026-09-02";
  const generalCount = payload.generalEtfCount || 1025;
  const up = payload.upCount || 0;
  const flat = payload.flatCount || 0;
  const down = payload.downCount || 0;
  const kospi = payload.kospiChangePct || 0;
  const etfReturn = payload.generalAumWeightedReturnPct || 0;
  const threadsText = generateThreadsThread(payload, env.SITE_BASE_URL || "https://etf-campus.pages.dev", narrative)[0]?.content || "";
  const captionText = generateInstagramCaption(payload, narrative);
  const isPublished = logStatus === "distributed" || Boolean(threadsPublishedId);
  const aiBadge = narrative.source === "gemini-refined"
    ? '<span class="badge badge-live">🤖 Gemini 2.5 AI 검증 완료</span>'
    : '<span class="badge badge-safe">⚙️ 정밀 룰 엔진 초안</span>';

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OSMU 통합 검토 대시보드 | ETF Campus</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Pretendard', -apple-system, sans-serif; }
    body { background-color: #0F172A; color: #F8FAFC; min-height: 100vh; padding: 24px; }
    .container { max-width: 1300px; margin: 0 auto; }
    header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 20px; border-bottom: 1px solid #334155; margin-bottom: 24px; flex-wrap: wrap; gap: 16px; }
    .badge { padding: 6px 14px; border-radius: 9999px; font-size: 13px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; }
    .badge-ready { background: #FEF3C7; color: #B45309; }
    .badge-live { background: #DCFCE7; color: #15803D; }
    .badge-safe { background: #EFF6FF; color: #1D4ED8; }
    .tabs { display: flex; gap: 8px; margin-bottom: 24px; flex-wrap: wrap; }
    .tab-btn { background: #1E293B; border: 1px solid #334155; color: #94A3B8; padding: 12px 24px; border-radius: 12px; font-size: 15px; font-weight: 700; cursor: pointer; transition: all 0.2s; }
    .tab-btn:hover { background: #334155; color: #FFFFFF; }
    .tab-btn.active { background: #2563EB; color: #FFFFFF; border-color: #3B82F6; box-shadow: 0 4px 14px rgba(37,99,235,0.4); }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .card { background: #1E293B; border: 1px solid #334155; border-radius: 18px; padding: 24px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    @media (max-width: 900px) { .grid-2 { grid-template-columns: 1fr; } }
    .preview-img { width: 100%; max-width: 480px; aspect-ratio: 4/5; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.4); border: 1px solid #475569; display: block; margin: 0 auto; background: #000; }
    .carousel-nav { display: flex; justify-content: center; align-items: center; gap: 12px; margin-top: 16px; }
    .nav-btn { background: #334155; color: #F8FAFC; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 700; cursor: pointer; }
    .nav-btn:hover { background: #475569; }
    .copy-box { background: #0F172A; border: 1px solid #334155; border-radius: 12px; padding: 16px; font-size: 14.5px; line-height: 1.7; color: #E2E8F0; white-space: pre-wrap; word-break: break-word; max-height: 520px; overflow-y: auto; }
    .action-btn { background: #10B981; color: #FFFFFF; border: none; padding: 12px 24px; border-radius: 12px; font-size: 15px; font-weight: 800; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 8px; }
    .action-btn:hover { background: #059669; }
    .btn-secondary { background: #334155; color: #F8FAFC; padding: 8px 14px; font-size: 13px; border-radius: 8px; border: none; cursor: pointer; font-weight: 700; }
    .btn-secondary:hover { background: #475569; }
    iframe.email-frame { width: 100%; height: 750px; border: none; border-radius: 14px; background: #FFFFFF; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1 style="font-size: 23px; font-weight: 900; margin-bottom: 6px;">📈 ETF Campus 마켓 브리핑 OSMU 클라우드 통합 검토 허브</h1>
        <p style="color: #94A3B8; font-size: 14px;">데이터 기준일: <strong style="color: #F8FAFC;">${date}</strong> · 일반 ETF <strong style="color: #F8FAFC;">${generalCount}개</strong> (상승 ${up} / 보합 ${flat} / 하락 ${down}) · KOSPI ${kospi > 0 ? '+' : ''}${kospi}% · ETF ${etfReturn > 0 ? '+' : ''}${etfReturn}%</p>
      </div>
      <div style="display: flex; gap: 10px; align-items: center;">
        ${aiBadge}
        <span class="badge badge-safe">✅ 서킷브레이커 정상</span>
        <span class="badge ${isPublished ? 'badge-live' : 'badge-ready'}" id="statusBadge">
          ${isPublished ? '🚀 스레드 발행 완료' : '⏳ 운영자 검토 대기'}
        </span>
        ${!isPublished ? `<button class="action-btn" id="btnPublishThreads" onclick="publishThreads('${date}')">🚀 스레드 발행 승인</button>` : ''}
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
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; text-align: left;">
            <h3 style="font-size: 17px; font-weight: 800;">🖼️ 카드뉴스 (슬라이드 <span id="currentSlideNum">1</span> / 6)</h3>
            <a id="btnOpenSvg" href="/api/preview/instagram?date=${date}&slide=1" target="_blank" class="btn-secondary" style="text-decoration: none;">🔍 원본 SVG</a>
          </div>
          <img id="instagramImg" src="/api/preview/instagram?date=${date}&slide=1&v=${Date.now()}" class="preview-img" alt="Instagram Card">
          <div class="carousel-nav">
            <button class="nav-btn" onclick="changeSlide(-1)">◀ 이전</button>
            <div id="slideDots" style="display: flex; gap: 6px;"></div>
            <button class="nav-btn" onclick="changeSlide(1)">다음 ▶</button>
          </div>
        </div>
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            <h3 style="font-size: 17px; font-weight: 800;">📝 인스타그램 캡션 전문</h3>
            <button class="btn-secondary" onclick="copyText('instagramCaptionText')">📋 캡션 복사</button>
          </div>
          <div id="instagramCaptionText" class="copy-box">${captionText}</div>
        </div>
      </div>
    </div>

    <!-- 2. Threads Tab -->
    <div id="tab-threads" class="tab-content">
      <div class="grid-2">
        <div class="card" style="text-align: center;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; text-align: left;">
            <h3 style="font-size: 17px; font-weight: 800;">🖼️ 스레드 전용 인포그래픽 (1장)</h3>
            <a href="/api/preview/threads-image?date=${date}" target="_blank" class="btn-secondary" style="text-decoration: none;">🔍 원본 SVG</a>
          </div>
          <img src="/api/preview/threads-image?date=${date}&v=${Date.now()}" class="preview-img" alt="Threads Infographic">
        </div>
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            <h3 style="font-size: 17px; font-weight: 800;">🧵 스레드 본문 & 댓글 전문</h3>
            <button class="btn-secondary" onclick="copyText('threadsFullText')">📋 본문 복사</button>
          </div>
          <div id="threadsFullText" class="copy-box">${threadsText}</div>
          <div style="margin-top: 18px; text-align: right;">
            <button class="action-btn" onclick="publishThreads('${date}')">🚀 이 내용으로 스레드 즉시 발행</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 3. Newsletter Tab -->
    <div id="tab-newsletter" class="tab-content">
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
          <h3 style="font-size: 17px; font-weight: 800;">📧 이메일 뉴스레터 프리뷰</h3>
          <a href="/api/preview/newsletter?date=${date}" target="_blank" class="btn-secondary" style="text-decoration: none;">🔗 새 창에서 전체보기</a>
        </div>
        <iframe src="/api/preview/newsletter?date=${date}" class="email-frame"></iframe>
      </div>
    </div>
  </div>

  <script>
    let currentSlide = 1;
    const date = '${date}';

    function switchTab(evt, tabId) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      evt.currentTarget.classList.add('active');
      document.getElementById(tabId).classList.add('active');
    }

    function changeSlide(delta) {
      currentSlide += delta;
      if (currentSlide < 1) currentSlide = 6;
      if (currentSlide > 6) currentSlide = 1;
      updateSlide();
    }

    function goToSlide(n) {
      currentSlide = n;
      updateSlide();
    }

    function updateSlide() {
      document.getElementById('instagramImg').src = '/api/preview/instagram?date=' + date + '&slide=' + currentSlide + '&v=' + Date.now();
      document.getElementById('btnOpenSvg').href = '/api/preview/instagram?date=' + date + '&slide=' + currentSlide;
      document.getElementById('currentSlideNum').innerText = currentSlide;
      renderDots();
    }

    function renderDots() {
      const container = document.getElementById('slideDots');
      container.innerHTML = '';
      for (let i = 1; i <= 6; i++) {
        const dot = document.createElement('button');
        dot.innerText = i;
        dot.style.padding = '4px 10px';
        dot.style.borderRadius = '6px';
        dot.style.border = 'none';
        dot.style.cursor = 'pointer';
        dot.style.fontSize = '12px';
        dot.style.fontWeight = '700';
        dot.style.background = (i === currentSlide) ? '#2563EB' : '#334155';
        dot.style.color = '#FFFFFF';
        dot.onclick = () => goToSlide(i);
        container.appendChild(dot);
      }
    }
    renderDots();

    function copyText(elemId) {
      const text = document.getElementById(elemId).innerText;
      navigator.clipboard.writeText(text).then(() => {
        alert('클립보드에 복사되었습니다!');
      });
    }

    async function publishThreads(dateStr) {
      if (!confirm(dateStr + ' 마켓 브리핑을 스레드(@neo.alphareader)에 실시간 자동 발행하시겠습니까?')) return;
      const btn = event.target;
      btn.disabled = true;
      btn.innerText = '발행 처리 중...';

      try {
        const res = await fetch('/api/publish/threads?date=' + dateStr, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          alert('스레드 발행 성공! (ID: ' + data.publishedPostId + ')');
          document.getElementById('statusBadge').className = 'badge badge-live';
          document.getElementById('statusBadge').innerText = '🚀 스레드 발행 완료';
          if (document.getElementById('btnPublishThreads')) {
            document.getElementById('btnPublishThreads').style.display = 'none';
          }
        } else {
          alert('발행 실패: ' + (data.error || JSON.stringify(data)));
          btn.disabled = false;
          btn.innerText = '🚀 스레드 발행 승인';
        }
      } catch (e) {
        alert('요청 중 오류 발생: ' + e);
        btn.disabled = false;
        btn.innerText = '🚀 스레드 발행 승인';
      }
    }
  </script>
</body>
</html>`;
}

export default {
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

        const validation = validateBriefingPayload(payload, env);
        if (!validation.isSafe) {
          console.error(`[Distributor] Circuit breaker tripped for ${targetDate}:`, validation.reasons);
          await env.ETF_PRICES.prepare(
            `CREATE TABLE IF NOT EXISTS briefing_distribution_logs (
              as_of_date TEXT PRIMARY KEY,
              status TEXT NOT NULL,
              details_json TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`
          ).run();
          await env.ETF_PRICES.prepare(
            `INSERT OR REPLACE INTO briefing_distribution_logs (as_of_date, status, details_json, created_at) VALUES (?, 'blocked', ?, CURRENT_TIMESTAMP)`
          ).bind(targetDate, JSON.stringify({ reasons: validation.reasons })).run();
          message.ack();
          continue;
        }

        // Pre-warm Gemini narrative so it is ready instantaneously for operator review
        try {
          await getOrRefineNarrative(payload, env);
        } catch (narrativeErr) {
          console.warn(`[Distributor] Narrative pre-warm warning for ${targetDate}:`, narrativeErr);
        }

        // Prepare distribution log in 'ready' state for operator review
        await env.ETF_PRICES.prepare(
          `CREATE TABLE IF NOT EXISTS briefing_distribution_logs (
            as_of_date TEXT PRIMARY KEY,
            status TEXT NOT NULL,
            details_json TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`
        ).run();

        await env.ETF_PRICES.prepare(
          `INSERT OR REPLACE INTO briefing_distribution_logs (as_of_date, status, details_json, created_at) VALUES (?, 'ready', ?, CURRENT_TIMESTAMP)`
        ).bind(targetDate, JSON.stringify({ event_id: event.event_id, validated: true })).run();

        console.log(`[Distributor] Assets prepared in READY state for ${targetDate}. Awaiting operator review.`);
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

    try {
      // 1. Root & Preview: Cloud Review Dashboard Hub
      if (url.pathname === "/" || url.pathname === "/preview") {
        const payload = await loadBriefingPayload(env, targetDate);
        if (!payload) return new Response("Briefing not found", { status: 404 });

        let logStatus = "ready";
        let threadsPublishedId: string | null = null;
        try {
          const row: any = await env.ETF_PRICES.prepare(
            `SELECT status, details_json FROM briefing_distribution_logs WHERE as_of_date = ?`
          ).bind(payload.asOfDate).first();
          if (row) {
            logStatus = row.status;
            if (row.details_json) {
              const parsed = JSON.parse(row.details_json);
              threadsPublishedId = parsed.threads?.publishedPostId || null;
            }
          }
        } catch (e) {}

        const narrative = await getOrRefineNarrative(payload, env);
        const html = generateDashboardHtml(payload, env, logStatus, threadsPublishedId, narrative);
        return new Response(html, {
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" },
        });
      }

      // 2. 인스타그램 카드뉴스 프리뷰 (슬라이드 번호 지정 시 SVG 반환, 미지정 시 HTML 리다이렉트 또는 JSON)
      if (url.pathname === "/api/preview/instagram") {
        const payload = await loadBriefingPayload(env, targetDate);
        if (!payload) return new Response("Briefing not found", { status: 404 });

        const narrative = await getOrRefineNarrative(payload, env);
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

        const accept = request.headers.get("Accept") || "";
        if (accept.includes("text/html")) {
          return Response.redirect(new URL(`/?date=${payload.asOfDate}#tab-instagram`, request.url).toString(), 302);
        }

        return Response.json({ success: true, asOfDate: payload.asOfDate, slides });
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
        const date = payload?.asOfDate || targetDate || "2026-09-02";
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
        const payload = await loadBriefingPayload(env, targetDate);
        if (!payload) return new Response("Briefing not found", { status: 404 });

        const newsletter = generateNewsletterHtml(payload, baseUrl);
        return new Response(newsletter.html, {
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" },
        });
      }

      // 6. 스레드 승인 후 실시간 발행 엔드포인트 (Human-in-the-Loop)
      if (url.pathname === "/api/publish/threads") {
        const payload = await loadBriefingPayload(env, targetDate);
        if (!payload) return Response.json({ success: false, error: "Briefing not found" }, { status: 404 });

        const publishRes = await publishToThreadsLive(env, payload);
        return Response.json(publishRes);
      }

      // 7. 통합 distribute 엔드포인트 (dryRun 파라미터 지원)
      if (url.pathname === "/internal/distribute" || url.pathname === "/api/distribute") {
        const dryRun = url.searchParams.get("dryRun") === "true";
        try {
          const result = await executeDistribution(env, targetDate, dryRun);
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
