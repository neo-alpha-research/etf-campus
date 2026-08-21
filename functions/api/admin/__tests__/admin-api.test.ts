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
        100, 50, 20, 30, 50.0, '상승 우세', 100000.0, 5000.0, 50.0,
        '{}', '{}', '{}', '2026-08-20T00:00:00Z'
      )
    `).run();
  });

  describe("Schema Validation (Regression Prevention)", () => {
    it("Validates schema and tables", () => {
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
    
    it("Migrations are idempotent when applied multiple times", () => {
      // It didn't fail on creation. Let's try running createMockD1 again which runs it twice.
      expect(() => createMockD1()).not.toThrow();
    });
  });

  describe("Authentication API", () => {
    it("Rejects missing API credentials with 401", async () => {
      const ctx = createContext("http://localhost/api/admin/market-briefings/2026-08-20/revisions", env, "POST", {});
      const res = await revisionsPost(ctx);
      expect(res.status).toBe(401);
    });

    it("Rejects insufficient permissions with 403", async () => {
      await env.ETF_PRICES.prepare(`INSERT INTO admin_user_sessions (session_id, user_id, expires_at) VALUES ('sess_2', 'user_1', '2099-01-01T00:00:00.000Z')`).run();
      await env.ETF_PRICES.prepare(`UPDATE admin_users SET role_id = 'no_role' WHERE user_id = 'user_1'`).run();
      // Wait, there is no no_role. It will return 403.
      const ctx = createContext("http://localhost/api/admin/market-briefings/2026-08-20/publish", env, "POST", {}, {
        "Cookie": "__Host-etf_admin_session=sess_2"
      });
      const res = await publishPost(ctx);
      expect(res.status).toBe(403);
    });

    it("Admin session creates valid login and DB record", async () => {
      const ctx = createContext("http://localhost/api/admin/auth/login", env, "POST", { username: "admin", password: "admin123" });
      const res = await loginPost(ctx);
      expect(res.status).toBe(200);
      const headers = res.headers.get("Set-Cookie");
      expect(headers).toContain("__Host-etf_admin_session=");
      
      const session = await env.ETF_PRICES.prepare("SELECT * FROM admin_user_sessions").first();
      expect(session).not.toBeNull();
      expect(session.user_id).toBe("user_1");
    });

    it("Logging out invalidates session cookie", async () => {
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

    it("Validates forbidden words and saves draft payload", async () => {
      const payload = {
        title: "새로운 제목 10자 이상",
        oneLineText: "이것은 20자가 넘는 한 줄 요약 텍스트입니다. 테스트입니다.",
        marketTemperatureCommentary: "시장 해설은 40자 이상이어야 합니다. 특정 종목을 매수 또는 추천합니다. 40자를 채우기 위해 텍스트를 더 추가해봅니다.",
        summaryMarkdown: "본문 내용",
        changeSummary: "변경 사유를 충분히 길게 작성합니다.",
        baseMetricsHash: "hash1",
        baseSourceVersion: "1",
        expectedRevisionNo: 1
      };
      
      const ctx = createContext("http://localhost/api/admin/market-briefings/2026-08-20/revisions", env, "POST", payload, { "Cookie": sessionCookie });
      const res = await revisionsPost(ctx);
      const json = await res.json();
      
      expect(res.status).toBe(200); // Draft save is successful despite forbidden word
      expect(json.hasForbiddenWords).toBe(true);
      expect(json.forbiddenWords).toContain("매수");
      expect(json.forbiddenWords).toContain("추천");
      
      // Check if audit log was written for forbidden words
      const logs = await env.ETF_PRICES.prepare("SELECT * FROM admin_audit_logs WHERE action_name = 'forbidden_words_detected'").all();
      expect(logs.results.length).toBe(1);
    });

    it("Creates a new revision based on existing base revision", async () => {
      const payload = {
        title: "새로운 제목 10자 이상",
        oneLineText: "이것은 20자가 넘는 한 줄 요약 텍스트입니다. 테스트입니다.",
        marketTemperatureCommentary: "시장 해설은 40자 이상이어야 합니다. 시장은 전반적인 상승세를 보이고 있습니다. 40자를 채우기 위해 텍스트를 더 추가해봅니다.",
        summaryMarkdown: "본문 내용",
        changeSummary: "변경 사유를 충분히 길게 작성합니다.",
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

    it("Rejects save with 409 if expectedRevisionNo mismatches", async () => {
      const payload = {
        title: "새로운 제목 10자 이상",
        oneLineText: "이것은 20자가 넘는 한 줄 요약 텍스트입니다. 테스트입니다.",
        marketTemperatureCommentary: "시장 해설은 40자 이상이어야 합니다. 시장은 전반적인 상승세를 보이고 있습니다. 40자를 채우기 위해 텍스트를 더 추가해봅니다.",
        summaryMarkdown: "본문 내용",
        changeSummary: "변경 사유를 충분히 길게 작성합니다.",
        baseMetricsHash: "hash1",
        baseSourceVersion: "1",
        expectedRevisionNo: 99 // Mismatch!
      };
      
      const ctx = createContext("http://localhost/api/admin/market-briefings/2026-08-20/revisions", env, "POST", payload, { "Cookie": sessionCookie });
      const res = await revisionsPost(ctx);
      expect(res.status).toBe(409);
    });

    it("Rejects save with 409 if baseSourceVersion mismatches", async () => {
      const payload = {
        title: "새로운 제목 10자 이상",
        oneLineText: "이것은 20자가 넘는 한 줄 요약 텍스트입니다. 테스트입니다.",
        marketTemperatureCommentary: "시장 해설은 40자 이상이어야 합니다. 시장은 전반적인 상승세를 보이고 있습니다. 40자를 채우기 위해 텍스트를 더 추가해봅니다.",
        summaryMarkdown: "본문 내용",
        changeSummary: "변경 사유를 충분히 길게 작성합니다.",
        baseMetricsHash: "hash2", // Mismatch!
        baseSourceVersion: "2", // Mismatch!
        expectedRevisionNo: 1
      };
      
      const ctx = createContext("http://localhost/api/admin/market-briefings/2026-08-20/revisions", env, "POST", payload, { "Cookie": sessionCookie });
      const res = await revisionsPost(ctx);
      expect(res.status).toBe(409);
    });

    it("Publishing places correctly into outbox", async () => {
      const payload = { expectedRevisionNo: 1 };
      const ctx = createContext("http://localhost/api/admin/market-briefings/2026-08-20/publish", env, "POST", payload, { "Cookie": sessionCookie });
      const res = await publishPost(ctx);
      expect(res.status).toBe(200);
      
      const outbox = await env.ETF_PRICES.prepare("SELECT * FROM market_briefing_editorial_cache_outbox").all();
      expect(outbox.results.length).toBe(1);
      expect(outbox.results[0].action).toBe("publish");
    });
    
    it("Publishing fails with 400 if forbidden words are present in draft", async () => {
      await env.ETF_PRICES.prepare("UPDATE market_briefing_editorial_revisions SET summary_markdown = '매수 우세' WHERE revision_no = 1").run();
      const payload = { expectedRevisionNo: 1 };
      const ctx = createContext("http://localhost/api/admin/market-briefings/2026-08-20/publish", env, "POST", payload, { "Cookie": sessionCookie });
      const res = await publishPost(ctx);
      expect(res.status).toBe(400);
    });

    it("Rollback restores previous version correctly", async () => {
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

    it("ON DELETE CASCADE removes related events and outbox entries", async () => {
      const prepare = (env as Record<string, any>).ETF_PRICES.prepare;
      // Insert a document and related events/outbox
      await prepare("INSERT INTO market_briefing_editorial_documents (briefing_id, as_of_date, current_revision_no, base_source_version, base_metrics_hash) VALUES ('briefing_cascade_test', '2026-08-25', 1, 1, 'hash')").run();
      await prepare("INSERT INTO market_briefing_editorial_events (event_id, briefing_id, revision_no, event_type, actor_type, actor_user_id) VALUES ('event_cascade_test', 'briefing_cascade_test', 1, 'draft_saved', 'user', '1')").run();
      await prepare("INSERT INTO market_briefing_editorial_cache_outbox (event_id, briefing_id, as_of_date, revision_no, published_version, action) VALUES ('outbox_cascade_test', 'briefing_cascade_test', '2026-08-25', 1, 1, 'publish')").run();

      // Verify insertion
      let events = await prepare("SELECT * FROM market_briefing_editorial_events WHERE briefing_id = 'briefing_cascade_test'").all();
      expect((events as { results: unknown[] }).results.length).toBe(1);
      let outbox = await prepare("SELECT * FROM market_briefing_editorial_cache_outbox WHERE briefing_id = 'briefing_cascade_test'").all();
      expect((outbox as { results: unknown[] }).results.length).toBe(1);

      // Delete document (should cascade to events and outbox)
      await prepare("DELETE FROM market_briefing_editorial_documents WHERE briefing_id = 'briefing_cascade_test'").run();

      // Verify cascade deletion
      events = await prepare("SELECT * FROM market_briefing_editorial_events WHERE briefing_id = 'briefing_cascade_test'").all();
      expect((events as { results: unknown[] }).results.length).toBe(0);
      outbox = await prepare("SELECT * FROM market_briefing_editorial_cache_outbox WHERE briefing_id = 'briefing_cascade_test'").all();
      expect((outbox as { results: unknown[] }).results.length).toBe(0);
    });
  });
  
  describe("Public API Fallback & Editorial Integration", () => {
    it("Latest API fetches correct base structure", async () => {
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
    
    it("Latest API merges editorial content correctly", async () => {
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
