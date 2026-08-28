import { validateBriefingPayload } from "./circuit-breaker";
import { generateInstagramCarousel } from "./templates/instagram";
import { generateNewsletterHtml } from "./templates/newsletter";
import { generateThreadsThread } from "./templates/threads";
import type { BriefingDistributeEvent, Env, MarketBriefingPayload } from "./types";

async function loadBriefingPayload(env: Env, asOfDate?: string): Promise<MarketBriefingPayload | null> {
  if (asOfDate) {
    const raw = await env.BRIEFING_KV.get(`briefing:${asOfDate}`, "json") as MarketBriefingPayload | null;
    if (raw) return raw;
  }
  const latest = await env.BRIEFING_KV.get("briefing:latest", "json") as MarketBriefingPayload | null;
  return latest;
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
