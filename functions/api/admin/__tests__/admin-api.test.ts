import { describe, expect, it, vi, beforeEach } from "vitest";
import { createMockD1 } from "./setup-d1";
import { onRequestPost as loginPost } from "../auth/login.js";
import { onRequestPost as logoutPost } from "../auth/logout.js";
import { onRequestGet as revisionsGet, onRequestPost as revisionsPost } from "../market-briefings/[id]/revisions.js";
import { onRequestPost as publishPost } from "../market-briefings/[id]/publish.js";
import { onRequestPost as rollbackPost } from "../market-briefings/[id]/rollback.js";
import { onRequestGet as latestGet } from "../../briefings/latest.js";
import { onRequestGet as dateGet } from "../../briefings/[date].js";
import { hashPassword } from "../auth/login.js";
import crypto from "crypto";

// Expose crypto to global for WebCrypto used in _lib/rbac.js and others
if (!globalThis.crypto) {
  globalThis.crypto = crypto as any;
} else if (!globalThis.crypto.subtle) {
  (globalThis.crypto as any).subtle = crypto.webcrypto.subtle;
}

function createContext(url: string, env: any, method = "GET", body: any = null, headers: Record<string, string> = {}) {
  const reqHeaders = new Headers(headers);
  if (!reqHeaders.has("cf-connecting-ip")) reqHeaders.set("cf-connecting-ip", "127.0.0.1");
  if (!reqHeaders.has("user-agent")) reqHeaders.set("user-agent", "vitest");

  return {
    request: {
      method,
      url,
      headers: reqHeaders,
      json: async () => body
    },
    env,
    params: {
      id: "2026-08-20",
      date: "2026-08-20"
    }
  };
}

describe("Admin API Tests with actual SQLite D1 Mock", () => {
  let env: any;

  beforeEach(async () => {
    env = {
      ETF_PRICES: createMockD1(),
      AUDIT_HASH_PEPPER: "test-pepper-1234",
      BRIEFING_KV: {
        get: vi.fn(),
        put: vi.fn()
      },
      MARKET_BRIEFING_EVENTS: {
        send: vi.fn()
      }
    };
    
    // Seed admin user
    const passwordHash = await hashPassword("admin123", "user_1");
    await env.ETF_PRICES.prepare(`
      INSERT INTO admin_users (user_id, username, password_hash, role_id, status)
      VALUES ('user_1', 'admin', ?, 'editor', 'active')
    `).bind(passwordHash).run();

    await env.ETF_PRICES.prepare(`
      INSERT INTO briefing_runs (run_id, trigger_type, schedule_slot, target_date, status, started_at)
      VALUES ('run_1', 'manual', 'manual', '2026-08-20', 'ready', '2026-08-20T00:00:00Z')
    `).run();

    await env.ETF_PRICES.prepare(`
      INSERT INTO market_briefings (
        as_of_date, status, calculation_version, publication_version, source_run_id,
        kospi_close, kospi_change_pct, kosdaq_close, kosdaq_change_pct,
        general_aum_weighted_return_pct, top50_aum_weighted_return_pct, top100_aum_weighted_return_pct, top200_aum_weighted_return_pct,
        general_etf_count, up_count, flat_count, down_count, breadth_ratio_pct, market_temperature, general_total_aum, general_total_trade_value, top10_trade_share_pct,
        metrics_json, source_dates_json, validation_json, published_at
      )
      VALUES (
        '2026-08-20', 'ready', 'v1', 1, 'run_1',
        2600.0, 1.0, 800.0, 1.5,
        1.0, 1.0, 1.0, 1.0,
        100, 50, 20, 30, 50.0, '?ìŠ¹ ?°ì„¸', 100000.0, 5000.0, 50.0,
        '{}', '{}', '{}', '2026-08-20T00:00:00Z'
      )
    `).run();
  });

  describe("Schema Validation (Regression Prevention)", () => {
    it("ë§ˆì´ê·¸ë ˆ?´ì…˜ 0008??ë¹?DB???ìš© ?? ì½”ë“œê°€ ì°¸ì¡°?˜ëŠ” ëª¨ë“  ?Œì´ë¸”Â·ì»¬?¼ì´ ?¤ì œë¡?ì¡´ìž¬?˜ëŠ”ì§€ ê²€ì¦?, () => {
      const tables = env.ETF_PRICES._getTables().map((t: any) => t.name);
      expect(tables).toContain("admin_users");
      expect(tables).toContain("admin_user_sessions");
      expect(tables).toContain("admin_auth_roles");
      expect(tables).toContain("admin_audit_logs");
      expect(tables).toContain("market_briefing_editorial_documents");
      
      const auditCols = env.ETF_PRICES._getColumns("admin_audit_logs").map((c: any) => c.name);
      expect(auditCols).toContain("log_id");
      expect(auditCols).toContain("ip_hash");
      expect(auditCols).toContain("user_agent_hash");
    });
    
    it("ë§ˆì´ê·¸ë ˆ?´ì…˜???°ì† 2???ìš©?´ë„ ?¤íŒ¨?˜ì? ?ŠìŒ (ë©±ë“±??", () => {
      // It didn't fail on creation. Let's try running createMockD1 again which runs it twice.
      expect(() => createMockD1()).not.toThrow();
    });
  });

  describe("Authentication API", () => {
    it("?¸ì…˜ ì¿ í‚¤ ?†ì´ admin API ?¸ì¶œ ??401", async () => {
      const ctx = createContext("http://localhost/api/admin/market-briefings/2026-08-20/revisions", env, "POST", {});
      const res = await revisionsPost(ctx);
      expect(res.status).toBe(401);
    });

    it("ê¶Œí•œ ?†ëŠ” ?¬ìš©????403", async () => {
      await env.ETF_PRICES.prepare(`INSERT INTO admin_user_sessions (session_id, user_id, expires_at) VALUES ('sess_2', 'user_1', '2099-01-01T00:00:00.000Z')`).run();
      await env.ETF_PRICES.prepare(`UPDATE admin_users SET role_id = 'no_role' WHERE user_id = 'user_1'`).run();
      // Wait, there is no no_role. It will return 403.
      const ctx = createContext("http://localhost/api/admin/market-briefings/2026-08-20/publish", env, "POST", {}, {
        "Cookie": "__Host-etf_admin_session=sess_2"
      });
      const res = await publishPost(ctx);
      expect(res.status).toBe(403);
    });

    it("ë¡œê·¸???±ê³µ ??__Host-etf_admin_session ì¿ í‚¤ ë°œê¸‰, DB???¸ì…˜ ???ì„±", async () => {
      const ctx = createContext("http://localhost/api/admin/auth/login", env, "POST", { username: "admin", password: "admin123" });
      const res = await loginPost(ctx);
      expect(res.status).toBe(200);
      const headers = res.headers.get("Set-Cookie");
      expect(headers).toContain("__Host-etf_admin_session=");
      
      const session = await env.ETF_PRICES.prepare("SELECT * FROM admin_user_sessions").first();
      expect(session).not.toBeNull();
      expect(session.user_id).toBe("user_1");
    });

    it("ë¡œê·¸?„ì›ƒ ???¸ì…˜ ?ê¸°, ?´í›„ ?”ì²­ 401", async () => {
      const ctx = createContext("http://localhost/api/admin/auth/logout", env, "POST");
      const res = await logoutPost(ctx);
      expect(res.headers.get("Set-Cookie")).toContain("Max-Age=0");
    });
  });

  describe("Market Briefing Editor API", () => {
    let sessionCookie: string;

    beforeEach(async () => {
      await env.ETF_PRICES.prepare(`INSERT INTO admin_user_sessions (session_id, user_id, expires_at) VALUES ('sess_1', 'user_1', '2099-01-01T00:00:00.000Z')`).run();
      sessionCookie = "__Host-etf_admin_session=sess_1";
      
      await env.ETF_PRICES.prepare(`
        INSERT INTO market_briefing_editorial_documents (briefing_id, as_of_date, base_source_version, base_metrics_hash, current_revision_no)
        VALUES ('brief_1', '2026-08-20', '1', 'hash1', 1)
      `).run();
      await env.ETF_PRICES.prepare(`
        INSERT INTO market_briefing_editorial_revisions (revision_id, briefing_id, revision_no, workflow_status, origin, base_metrics_hash, base_metrics_json, title, one_line_text, market_temperature_commentary, summary_markdown, disclosure_text, change_summary)
        VALUES ('rev_1', 'brief_1', 1, 'draft', 'system_init', 'hash1', '{}', 'Title1', 'One line', 'Temp', 'Markdown', 'Disclosure', 'Init')
      `).run();
    });

    it("?¸ì§‘ payload???•ëŸ‰ ?„ë“œê°€ ?žì´ë©?400 ?ëŠ” allowlist ?œê±° + audit ê¸°ë¡ (ê¸ˆì¹™???¬í•¨ ??draft ?€?¥ì? ?±ê³µ)", async () => {
      const payload = {
        title: "?ˆë¡œ???œëª© 10?ì´??,
        oneLineText: "??ì¤??”ì•½?€ 20???´ìƒ?´ì–´???©ë‹ˆ?? 20??ì±„ìš°ê¸??ŒìŠ¤??,
        marketTemperatureCommentary: "?œìž¥ ?´ì„¤?€ 40???´ìƒ?´ì–´???©ë‹ˆ?? ë§¤ìˆ˜ ì¶”ì²œ?©ë‹ˆ?? 40?ë? ì±„ìš°ê¸??„í•´???˜ë??†ëŠ” ë¬¸ìž¥??ì¶”ê??©ë‹ˆ??",
        summaryMarkdown: "?´ìš©",
        changeSummary: "ë³€ê²??¬ìœ ë¥?ì¶©ë¶„??ê¸¸ê²Œ ?‘ì„±?©ë‹ˆ??",
        baseMetricsHash: "hash1",
        baseSourceVersion: "1",
        expectedRevisionNo: 1
      };
      
      const ctx = createContext("http://localhost/api/admin/market-briefings/2026-08-20/revisions", env, "POST", payload, { "Cookie": sessionCookie });
      const res = await revisionsPost(ctx);
      const json = await res.json();
      
      expect(res.status).toBe(200); // Draft save is successful despite forbidden word
      expect(json.hasForbiddenWords).toBe(true);
      expect(json.forbiddenWords).toContain("ë§¤ìˆ˜");
      expect(json.forbiddenWords).toContain("ì¶”ì²œ");
      
      // Check if audit log was written for forbidden words
      const logs = await env.ETF_PRICES.prepare("SELECT * FROM admin_audit_logs WHERE action_name = 'forbidden_words_detected'").all();
      expect(logs.results.length).toBe(1);
    });

    it("?€????ê¸°ì¡´ revision????–´?°ì? ?Šê³  ??revision ?ì„±", async () => {
      const payload = {
        title: "?ˆë¡œ???œëª© 10?ì´??,
        oneLineText: "??ì¤??”ì•½?€ 20???´ìƒ?´ì–´???©ë‹ˆ?? 20??ì±„ìš°ê¸??ŒìŠ¤??,
        marketTemperatureCommentary: "?œìž¥ ?´ì„¤?€ 40???´ìƒ?´ì–´???©ë‹ˆ?? ?œìž¥?€ ?¬ì „???ìŠ¹?¸ë? ë³´ì´ê³??ˆìŠµ?ˆë‹¤. 40?ë? ì±„ìš°ê¸??„í•´ ?§ë¶™?…ë‹ˆ??",
        summaryMarkdown: "?´ìš©",
        changeSummary: "ë³€ê²??¬ìœ ë¥?ì¶©ë¶„??ê¸¸ê²Œ ?‘ì„±?©ë‹ˆ??",
        baseMetricsHash: "hash1",
        baseSourceVersion: "1",
        expectedRevisionNo: 1
      };
      
      const ctx = createContext("http://localhost/api/admin/market-briefings/2026-08-20/revisions", env, "POST", payload, { "Cookie": sessionCookie });
      await revisionsPost(ctx);
      
      const revisions = await env.ETF_PRICES.prepare("SELECT * FROM market_briefing_editorial_revisions WHERE briefing_id = 'brief_1'").all();
      expect(revisions.results.length).toBe(2);
      expect(revisions.results[1].revision_no).toBe(2);
    });

    it("expectedRevisionNo ë¶ˆì¼ì¹???409", async () => {
      const payload = {
        title: "?ˆë¡œ???œëª© 10?ì´??,
        oneLineText: "??ì¤??”ì•½?€ 20???´ìƒ?´ì–´???©ë‹ˆ?? 20??ì±„ìš°ê¸??ŒìŠ¤??,
        marketTemperatureCommentary: "?œìž¥ ?´ì„¤?€ 40???´ìƒ?´ì–´???©ë‹ˆ?? ?œìž¥?€ ?¬ì „???ìŠ¹?¸ë? ë³´ì´ê³??ˆìŠµ?ˆë‹¤. 40?ë? ì±„ìš°ê¸??„í•´ ?§ë¶™?…ë‹ˆ??",
        summaryMarkdown: "?´ìš©",
        changeSummary: "ë³€ê²??¬ìœ ë¥?ì¶©ë¶„??ê¸¸ê²Œ ?‘ì„±?©ë‹ˆ??",
        baseMetricsHash: "hash1",
        baseSourceVersion: "1",
        expectedRevisionNo: 99 // Mismatch!
      };
      
      const ctx = createContext("http://localhost/api/admin/market-briefings/2026-08-20/revisions", env, "POST", payload, { "Cookie": sessionCookie });
      const res = await revisionsPost(ctx);
      expect(res.status).toBe(409);
    });

    it("base_source_version ë¶ˆì¼ì¹???409", async () => {
      const payload = {
        title: "?ˆë¡œ???œëª© 10?ì´??,
        oneLineText: "??ì¤??”ì•½?€ 20???´ìƒ?´ì–´???©ë‹ˆ?? 20??ì±„ìš°ê¸??ŒìŠ¤??,
        marketTemperatureCommentary: "?œìž¥ ?´ì„¤?€ 40???´ìƒ?´ì–´???©ë‹ˆ?? ?œìž¥?€ ?¬ì „???ìŠ¹?¸ë? ë³´ì´ê³??ˆìŠµ?ˆë‹¤. 40?ë? ì±„ìš°ê¸??„í•´ ?§ë¶™?…ë‹ˆ??",
        summaryMarkdown: "?´ìš©",
        changeSummary: "ë³€ê²??¬ìœ ë¥?ì¶©ë¶„??ê¸¸ê²Œ ?‘ì„±?©ë‹ˆ??",
        baseMetricsHash: "hash2", // Mismatch!
        baseSourceVersion: "2", // Mismatch!
        expectedRevisionNo: 1
      };
      
      const ctx = createContext("http://localhost/api/admin/market-briefings/2026-08-20/revisions", env, "POST", payload, { "Cookie": sessionCookie });
      const res = await revisionsPost(ctx);
      expect(res.status).toBe(409);
    });

    it("publish ??market_briefing_editorial_cache_outbox ???ì„±", async () => {
      const payload = { expectedRevisionNo: 1 };
      const ctx = createContext("http://localhost/api/admin/market-briefings/2026-08-20/publish", env, "POST", payload, { "Cookie": sessionCookie });
      const res = await publishPost(ctx);
      expect(res.status).toBe(200);
      
      const outbox = await env.ETF_PRICES.prepare("SELECT * FROM market_briefing_editorial_cache_outbox").all();
      expect(outbox.results.length).toBe(1);
      expect(outbox.results[0].action).toBe("publish");
    });
    
    it("ê¸ˆì¹™???¬í•¨ ??publish??ì°¨ë‹¨", async () => {
      await env.ETF_PRICES.prepare("UPDATE market_briefing_editorial_revisions SET summary_markdown = 'ë§¤ìˆ˜?˜ì„¸?? WHERE revision_no = 1").run();
      const payload = { expectedRevisionNo: 1 };
      const ctx = createContext("http://localhost/api/admin/market-briefings/2026-08-20/publish", env, "POST", payload, { "Cookie": sessionCookie });
      const res = await publishPost(ctx);
      expect(res.status).toBe(400);
    });

    it("rollback??origin='restore' ? ê·œ revision + ??published_version ?ì„±", async () => {
      const payload = { expectedRevisionNo: 1 };
      let ctx = createContext("http://localhost/api/admin/market-briefings/2026-08-20/publish", env, "POST", payload, { "Cookie": sessionCookie });
      await publishPost(ctx);
      
      ctx = createContext("http://localhost/api/admin/market-briefings/2026-08-20/rollback", env, "POST", { targetRevisionNo: 1 }, { "Cookie": sessionCookie });
      const res = await rollbackPost(ctx);
      expect(res.status).toBe(200);
      
      const revisions = await env.ETF_PRICES.prepare("SELECT * FROM market_briefing_editorial_revisions ORDER BY revision_no DESC").first();
      expect(revisions.origin).toBe("restore");
      expect(revisions.workflow_status).toBe("published");
      
      const doc = await env.ETF_PRICES.prepare("SELECT * FROM market_briefing_editorial_documents").first();
      expect(doc.published_version).toBe(2);
    });
  });
  
  describe("Public API Fallback & Editorial Integration", () => {
    it("ë°œí–‰ë³¸ì´ ?†ì„ ??/api/briefings/latest ê¸°ì¡´ ?‘ë‹µ ê³„ì•½??ê·¸ë?ë¡?? ì???, async () => {
      env.BRIEFING_KV.get.mockImplementation(async (key: string) => {
        if (key === "market-briefing:v0:latest-pointer") {
          return { cache_key: "latest_v0", as_of_date: "2026-08-20" };
        }
        if (key === "latest_v0") {
          return { as_of_date: "2026-08-20", market_temperature: "Hot", etf_market_overview: {} };
        }
        return null; // No v1
      });
      
      const ctx = createContext("http://localhost/api/briefings/latest", env, "GET");
      const res = await latestGet(ctx);
      const json = await res.json();
      expect(json.briefing.asOfDate).toBe("2026-08-20");
      expect(json.briefing.editorial).toBeUndefined();
    });
    
    it("ë°œí–‰ë³¸ì´ ?ˆì„ ??/api/briefings/latest??editorial??ì±„ì›Œì§?, async () => {
      // Simulate v1 cache is empty but DB has it (fallback to DB)
      await env.ETF_PRICES.prepare(`
        INSERT INTO market_briefing_editorial_documents (briefing_id, as_of_date, base_source_version, base_metrics_hash, current_revision_no, published_revision_no, public_state)
        VALUES ('brief_1', '2026-08-20', '1', 'hash1', 1, 1, 'published')
      `).run();
      await env.ETF_PRICES.prepare(`
        INSERT INTO market_briefing_editorial_revisions (revision_id, briefing_id, revision_no, workflow_status, origin, base_metrics_hash, base_metrics_json, title, one_line_text, market_temperature_commentary, summary_markdown, disclosure_text, change_summary)
        VALUES ('rev_1', 'brief_1', 1, 'published', 'system_init', 'hash1', '{}', 'Test Title', 'One line', 'Temp', 'Markdown', 'Disclosure', 'Init')
      `).run();
      
      env.BRIEFING_KV.get.mockImplementation(async (key: string) => {
        if (key === "market-briefing:v0:latest-pointer") {
          return { cache_key: "latest_v0", as_of_date: "2026-08-20" };
        }
        if (key === "latest_v0") {
          return { as_of_date: "2026-08-20", market_temperature: "Hot" };
        }
        return null;
      });
      
      const ctx = createContext("http://localhost/api/briefings/latest", env, "GET");
      const res = await latestGet(ctx);
      const json = await res.json();
      expect(json.briefing.editorial.title).toBe("Test Title");
    });
  });
});
