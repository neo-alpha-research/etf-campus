import { validateBriefingPayload } from "./circuit-breaker";
import { generateInstagramCarousel } from "./templates/instagram";
import { generateNewsletterHtml } from "./templates/newsletter";
import { generateThreadsThread } from "./templates/threads";
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
  const instagramSlides = generateInstagramCarousel(payload, baseUrl);
  const threadsPosts = generateThreadsThread(payload, baseUrl);
  const newsletter = generateNewsletterHtml(payload, baseUrl);

  // 3. Threads API 실발송 (토큰 존재 및 dryRun 아닐 시)
  let threadsPublishedId: string | null = null;
  if (!dryRun && env.THREADS_ACCESS_TOKEN && env.THREADS_USER_ID) {
    try {
      const fullText = threadsPosts[0]?.content || "";
      const parts = fullText.split("[첫 댓글]");
      const mainPost = parts[0].trim();
      const firstComment = parts[1] ? parts[1].trim() : "";

      const createUrl = `https://graph.threads.net/v1.0/${env.THREADS_USER_ID}/threads`;
      const createRes = await fetch(createUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          media_type: "TEXT",
          text: mainPost,
          access_token: env.THREADS_ACCESS_TOKEN,
        }),
      });
      const createData: any = await createRes.json();
      if (createData.id) {
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

export default {
  async queue(batch: MessageBatch<BriefingDistributeEvent>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      const event = message.body;
      const targetDate = event.as_of_date;

      try {
        console.log(`[Distributor] Consuming distribution event for ${targetDate} v${event.publication_version}`);
        const res = await executeDistribution(env, targetDate, false);
        console.log(`[Distributor] Distribution completed for ${targetDate}:`, JSON.stringify(res));
        message.ack();
      } catch (err) {
        console.error(`[Distributor] Fatal error distributing for ${targetDate}:`, err);
        message.retry({ delaySeconds: Math.min(3600, 60 * 2 ** Math.min(message.attempts, 5)) });
      }
    }
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const targetDate = url.searchParams.get("date") || undefined;
    const baseUrl = env.SITE_BASE_URL || "https://etf-campus.pages.dev";

    // 1. 인스타그램 카드뉴스 프리뷰 (슬라이드 번호 지정 시 SVG 반환, 미지정 시 JSON)
    if (url.pathname === "/api/preview/instagram") {
      const payload = await loadBriefingPayload(env, targetDate);
      if (!payload) return new Response("Briefing not found", { status: 404 });

      const slides = generateInstagramCarousel(payload, baseUrl);
      const slideParam = url.searchParams.get("slide");
      if (slideParam) {
        const slideNo = parseInt(slideParam, 10);
        const slide = slides.find(s => s.slideNumber === slideNo) || slides[0];
        return new Response(slide.svgContent, {
          headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "no-cache" },
        });
      }
      return Response.json({ success: true, asOfDate: payload.asOfDate, slides });
    }

    // 2. 스레드 타래 텍스트 프리뷰
    if (url.pathname === "/api/preview/threads") {
      const payload = await loadBriefingPayload(env, targetDate);
      if (!payload) return new Response("Briefing not found", { status: 404 });

      const posts = generateThreadsThread(payload, baseUrl);
      return Response.json({ success: true, asOfDate: payload.asOfDate, posts });
    }

    // 3. 이메일 뉴스레터 반응형 HTML 프리뷰
    if (url.pathname === "/api/preview/newsletter") {
      const payload = await loadBriefingPayload(env, targetDate);
      if (!payload) return new Response("Briefing not found", { status: 404 });

      const newsletter = generateNewsletterHtml(payload, baseUrl);
      return new Response(newsletter.html, {
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" },
      });
    }

    // 4. 수동 발송 및 즉시 트리거 엔드포인트
    if (url.pathname === "/internal/distribute" || url.pathname === "/api/distribute") {
      const dryRun = url.searchParams.get("dryRun") === "true";
      try {
        const result = await executeDistribution(env, targetDate, dryRun);
        return Response.json(result);
      } catch (err: any) {
        return Response.json({ success: false, error: String(err) }, { status: 500 });
      }
    }

    return new Response("ETF Campus Market Briefing Distributor Worker", { status: 200 });
  },
};
