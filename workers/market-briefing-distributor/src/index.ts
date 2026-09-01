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
    assetClasses: briefing.assetClasses || [],
    focusEtfs: briefing.focusEtfs || [],
    peerGroups: briefing.peerGroups || [],
    periodicFlows: briefing.periodicFlows || (briefing.fundFlow?.general ? {
      dailyFundFlows: briefing.fundFlow.general,
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

export default {
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

        // 1. 서킷 브레이커 검증
        const validation = validateBriefingPayload(payload, env);
        if (!validation.isSafe) {
          console.error(`[Distributor] Circuit breaker tripped for ${targetDate}:`, validation.reasons);
          await env.ETF_PRICES.prepare(
            `INSERT OR REPLACE INTO briefing_distribution_logs (as_of_date, status, details_json, created_at) VALUES (?, 'blocked', ?, CURRENT_TIMESTAMP)`
          ).bind(targetDate, JSON.stringify({ reasons: validation.reasons })).run();
          message.ack(); // Do not retry if fundamentally bad data
          continue;
        }

        // 2. 템플릿 생성 (인스타그램 6장, 스레드 4단, 이메일 HTML)
        const baseUrl = env.SITE_BASE_URL || "https://etf-campus.pages.dev";
        const instagramSlides = generateInstagramCarousel(payload, baseUrl);
        const threadsPosts = generateThreadsThread(payload, baseUrl);
        const newsletter = generateNewsletterHtml(payload, baseUrl);

        // 3. 모의/실제 발송 파이프라인
        const dispatchResults = {
          instagram: { status: "rendered_ready", slideCount: instagramSlides.length },
          threads: { status: "rendered_ready", postCount: threadsPosts.length },
          newsletter: { status: "rendered_ready", subject: newsletter.subject, htmlLength: newsletter.html.length },
        };

        // 4. 발송 이력 D1 기록 (멱등성 확보)
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
            `INSERT OR REPLACE INTO briefing_distribution_logs (as_of_date, status, details_json, created_at) VALUES (?, 'distributed', ?, CURRENT_TIMESTAMP)`
          ).bind(targetDate, JSON.stringify(dispatchResults)).run();
        } catch (dbErr) {
          console.warn("[Distributor] Log insert warning:", dbErr);
        }

        console.log(`[Distributor] Successfully prepared multi-channel distribution for ${targetDate}`);
        message.ack();
      } catch (err) {
        console.error(`[Distributor] Fatal error distributing for ${targetDate}:`, err);
        message.retry({ delaySeconds: Math.min(3600, 60 * 2 ** Math.min(message.attempts, 5)) });
      }
    }
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const targetDate = url.searchParams.get("date") || "2026-08-27";
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
      return Response.json({ success: true, asOfDate: targetDate, slides });
    }

    // 2. 스레드 타래 텍스트 프리뷰
    if (url.pathname === "/api/preview/threads") {
      const payload = await loadBriefingPayload(env, targetDate);
      if (!payload) return new Response("Briefing not found", { status: 404 });

      const posts = generateThreadsThread(payload, baseUrl);
      return Response.json({ success: true, asOfDate: targetDate, posts });
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

    // 4. 수동 발송 시뮬레이션
    if (url.pathname === "/internal/distribute") {
      const payload = await loadBriefingPayload(env, targetDate);
      if (!payload) return new Response("Briefing not found", { status: 404 });

      const validation = validateBriefingPayload(payload, env);
      const slides = generateInstagramCarousel(payload, baseUrl);
      const threads = generateThreadsThread(payload, baseUrl);
      const newsletter = generateNewsletterHtml(payload, baseUrl);

      return Response.json({
        success: true,
        asOfDate: targetDate,
        validation,
        results: {
          instagramSlidesCount: slides.length,
          threadsPostCount: threads.length,
          newsletterSubject: newsletter.subject,
        },
      });
    }

    return new Response("ETF Campus Market Briefing Distributor Worker", { status: 200 });
  },
};
