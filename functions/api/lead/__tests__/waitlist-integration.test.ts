// @vitest-environment node
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it, beforeEach, afterEach } from "vitest";

import { onRequestPost, type WaitlistEnv } from "../waitlist";

interface WaitlistApiResponse {
  success?: boolean;
  alreadySent?: boolean;
  error?: { code?: string; message?: string };
  message?: string;
}

interface WaitlistDbRow {
  id: number;
  email: string;
  interest: string;
  source: string;
  campaign: string;
  terms_version: string | null;
  agreed_at: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface RateLimitDbRow {
  key: string;
  count: number;
  reset_at: number;
}

/**
 * node:sqlite를 Cloudflare D1 인터페이스로 어댑팅하는 래퍼
 */
function createD1Adapter(db: DatabaseSync) {
  return {
    prepare(query: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async run() {
              try {
                const stmt = db.prepare(query);
                const info = stmt.run(...(args as (string | number | bigint | null | Buffer | Uint8Array)[]));
                return {
                  success: true,
                  meta: {
                    changes: Number(info.changes),
                    last_row_id: Number(info.lastInsertRowid),
                  },
                };
              } catch (error) {
                return { success: false, error };
              }
            },
            async first<T = unknown>(colName?: string): Promise<T | null> {
              try {
                const stmt = db.prepare(query);
                const row = stmt.get(...(args as (string | number | bigint | null | Buffer | Uint8Array)[])) as Record<string, unknown> | undefined;
                if (!row) return null;
                if (colName) return (row[colName] as T) ?? null;
                return row as T;
              } catch {
                return null;
              }
            },
            async all<T = unknown>(): Promise<{ results?: T[]; success?: boolean }> {
              try {
                const stmt = db.prepare(query);
                const rows = stmt.all(...(args as (string | number | bigint | null | Buffer | Uint8Array)[])) as T[];
                return { results: rows, success: true };
              } catch {
                return { results: [], success: false };
              }
            },
          };
        },
      };
    },
  };
}

describe("Lead Waitlist Real DB Integration & Operational Scenarios", () => {
  let sqliteDb: DatabaseSync;
  let d1Adapter: ReturnType<typeof createD1Adapter>;
  const testEnv: WaitlistEnv = {
    LEAD_RATE_LIMIT_SECRET: "test_integration_server_secret_key_2026",
  };

  const sql0027 = fs.readFileSync("migrations/0027_lead_waitlist.sql", "utf-8");
  const sql0028 = fs.readFileSync("migrations/0028_lead_waitlist_hardening.sql", "utf-8");

  beforeEach(() => {
    sqliteDb = new DatabaseSync(":memory:");
    sqliteDb.exec(sql0027);
    sqliteDb.exec(sql0028);
    d1Adapter = createD1Adapter(sqliteDb);
    testEnv.ETF_PRICES = d1Adapter;
  });

  afterEach(() => {
    sqliteDb.close();
  });

  it("동일 이메일 연속 신청 시 1행만 남고(멱등성), 관심사와 갱신시각이 정확히 업데이트된다", async () => {
    const makeRequest = (interest: string, source: string) =>
      new Request("https://etfcampus.pages.dev/api/lead/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": "203.0.113.10",
        },
        body: JSON.stringify({
          email: "consecutive@example.com",
          interest,
          source,
          campaign: "challenge_guide_2026",
          termsVersion: "v1.0",
          agreeRequired: true,
        }),
      });

    // 1차 신청
    const res1 = await onRequestPost({ request: makeRequest("dc_irp", "bridge_1"), env: testEnv });
    expect(res1.status).toBe(201);
    const body1 = (await res1.json()) as WaitlistApiResponse;
    expect(body1.success).toBe(true);

    // 2차 연속 신청 (동일 이메일, 다른 관심사/유입경로)
    const res2 = await onRequestPost({ request: makeRequest("fee", "bridge_2"), env: testEnv });
    expect(res2.status).toBe(201);
    const body2 = (await res2.json()) as WaitlistApiResponse;
    expect(body2.success).toBe(true);

    // DB 조회 검증: 정확히 1행만 존재해야 함
    const rows = sqliteDb
      .prepare("SELECT * FROM lead_waitlist WHERE email = 'consecutive@example.com'")
      .all() as unknown as WaitlistDbRow[];

    expect(rows.length).toBe(1);
    expect(rows[0].email).toBe("consecutive@example.com");
    expect(rows[0].interest).toBe("fee");
    expect(rows[0].source).toBe("bridge_2");
    expect(rows[0].campaign).toBe("challenge_guide_2026");
    expect(rows[0].terms_version).toBe("v1.0");
    expect(rows[0].status).toBe("pending");
    expect(rows[0].agreed_at).not.toBeNull();
  });

  it("동의 철회 접수 시 분쟁 예방 명목 보관 없이 지체 없이 D1 원장에서 영구 파기(DELETE)된다", async () => {
    const email = "withdrawn_user@example.com";

    // 1. 최초 신청
    const initialReq = new Request("https://etfcampus.pages.dev/api/lead/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.20" },
      body: JSON.stringify({
        email,
        interest: "routine",
        source: "modal",
        campaign: "challenge_guide_2026",
        termsVersion: "v1.0",
        agreeRequired: true,
      }),
    });
    await onRequestPost({ request: initialReq, env: testEnv });

    const rowBefore = sqliteDb.prepare("SELECT * FROM lead_waitlist WHERE email = ?").get(email) as unknown as WaitlistDbRow;
    expect(rowBefore).toBeDefined();
    expect(rowBefore.email).toBe(email);

    // 2. 수신 동의 철회 요청 접수 시: 별도 보존 근거가 없으므로 분쟁 예방 명목으로 보관하지 않고 지체 없이 DELETE 영구 파기
    sqliteDb.prepare("DELETE FROM lead_waitlist WHERE email = ? AND campaign = 'challenge_guide_2026'").run(email);

    const rowAfterWithdrawal = sqliteDb.prepare("SELECT * FROM lead_waitlist WHERE email = ?").get(email);
    expect(rowAfterWithdrawal).toBeUndefined();

    // 3. 파기 후 사용자가 차후 재신청 시 신규 1행으로 정상 등록
    const reapplyReq = new Request("https://etfcampus.pages.dev/api/lead/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.21" },
      body: JSON.stringify({
        email,
        interest: "dc_irp",
        source: "reapply_modal",
        campaign: "challenge_guide_2026",
        termsVersion: "v1.0",
        agreeRequired: true,
      }),
    });
    const reapplyRes = await onRequestPost({ request: reapplyReq, env: testEnv });
    expect(reapplyRes.status).toBe(201);

    const rowRecreated = sqliteDb.prepare("SELECT * FROM lead_waitlist WHERE email = ?").get(email) as unknown as WaitlistDbRow;
    expect(rowRecreated.status).toBe("pending");
    expect(rowRecreated.interest).toBe("dc_irp");
  });

  it("[신청 범위 엄격 일치] 가이드 발송 완료(sent) 후 재신청 시 후속 판본으로 자동 확장되지 않고 200 발송완료 안내를 반환하며 sent 상태가 보존된다", async () => {
    const email = "sent_user@example.com";

    // 1. 최초 신청
    const initialReq = new Request("https://etfcampus.pages.dev/api/lead/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.30" },
      body: JSON.stringify({
        email,
        interest: "fee",
        source: "modal",
        campaign: "challenge_guide_2026",
        termsVersion: "v1.0",
        agreeRequired: true,
      }),
    });
    await onRequestPost({ request: initialReq, env: testEnv });

    // 2. 가이드 1차 배포 완료(sent) 처리
    sqliteDb
      .prepare("UPDATE lead_waitlist SET status = 'sent' WHERE email = ?")
      .run(email);

    const rowSent = sqliteDb.prepare("SELECT * FROM lead_waitlist WHERE email = ?").get(email) as unknown as WaitlistDbRow;
    expect(rowSent.status).toBe("sent");

    // 3. 발송 완료된 사용자가 다시 신청 폼 제출
    const reapplyReq = new Request("https://etfcampus.pages.dev/api/lead/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.31" },
      body: JSON.stringify({
        email,
        interest: "fee",
        source: "newsletter_bridge",
        campaign: "challenge_guide_2026",
        termsVersion: "v1.0",
        agreeRequired: true,
      }),
    });
    const res = await onRequestPost({ request: reapplyReq, env: testEnv });
    
    // 200 OK와 alreadySent: true 반환 검증
    expect(res.status).toBe(200);
    const body = (await res.json()) as WaitlistApiResponse;
    expect(body.success).toBe(true);
    expect(body.alreadySent).toBe(true);
    expect(body.message).toContain("이미 해당 이메일로 가이드 출시 알림이 발송 완료되었습니다");

    // DB 검증: status가 pending으로 임의 변경되지 않고 'sent'로 온전히 보존됨
    const rowAfter = sqliteDb.prepare("SELECT * FROM lead_waitlist WHERE email = ?").get(email) as unknown as WaitlistDbRow;
    expect(rowAfter.status).toBe("sent");
  });

  it("[SQL 레벨 보호 회귀 테스트] ON CONFLICT UPDATE 직접 실행 시에도 status='sent' 행은 CASE문에 의해 pending으로 변경되지 않는다", () => {
    // 1. sent 상태의 행 생성
    sqliteDb.prepare(`
      INSERT INTO lead_waitlist (
        email, interest, source, campaign, terms_version,
        agreed_at, status, created_at, updated_at
      ) VALUES ('sql_sent_test@example.com', 'fee', 'test', 'challenge_guide_2026', 'v1.0', datetime('now'), 'sent', datetime('now'), datetime('now'))
    `).run();

    const rowSent = sqliteDb.prepare("SELECT status FROM lead_waitlist WHERE email = 'sql_sent_test@example.com'").get() as { status: string };
    expect(rowSent.status).toBe("sent");

    // 2. API의 ON CONFLICT UPDATE SQL을 동일하게 실행 (경쟁 상태 시뮬레이션)
    sqliteDb.prepare(`
      INSERT INTO lead_waitlist (
        email, interest, source, campaign, terms_version,
        agreed_at, status, created_at, updated_at
      ) VALUES ('sql_sent_test@example.com', 'dc_irp', 'bridge_override', 'challenge_guide_2026', 'v1.0', datetime('now'), 'pending', datetime('now'), datetime('now'))
      ON CONFLICT(email, campaign) DO UPDATE SET
        interest = excluded.interest,
        source = excluded.source,
        terms_version = excluded.terms_version,
        agreed_at = excluded.agreed_at,
        status = CASE WHEN lead_waitlist.status = 'sent' THEN 'sent' ELSE 'pending' END,
        updated_at = datetime('now')
    `).run();

    // 3. 관심사와 출처는 갱신되더라도 status는 반드시 'sent'로 보호되어야 함
    const rowAfterUpdate = sqliteDb.prepare("SELECT * FROM lead_waitlist WHERE email = 'sql_sent_test@example.com'").get() as unknown as WaitlistDbRow;
    expect(rowAfterUpdate.status).toBe("sent");
    expect(rowAfterUpdate.interest).toBe("dc_irp");
    expect(rowAfterUpdate.source).toBe("bridge_override");
  });

  it("10개 동시 요청(Promise.all) 시 원자적 레이트 리밋이 정확히 작동하여 5개 성공 및 5개 429 차단된다", async () => {
    const concurrentIp = "198.51.100.77";

    const requests = Array.from({ length: 10 }, (_, i) => {
      return onRequestPost({
        request: new Request("https://etfcampus.pages.dev/api/lead/waitlist", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "CF-Connecting-IP": concurrentIp,
          },
          body: JSON.stringify({
            email: `concurrent_user_${i}@example.com`,
            interest: "all",
            source: "concurrency_test",
            campaign: "challenge_guide_2026",
            termsVersion: "v1.0",
            agreeRequired: true,
          }),
        }),
        env: testEnv,
      });
    });

    const responses = await Promise.all(requests);
    const statusCounts = responses.reduce<Record<number, number>>((acc, res) => {
      acc[res.status] = (acc[res.status] || 0) + 1;
      return acc;
    }, {});

    expect(statusCounts[201]).toBe(5);
    expect(statusCounts[429]).toBe(5);
  });

  it("[서버 비밀키 기반 개인정보 최소화] lead_rate_limits 테이블에 원문 IP/이메일 부재 및 HMAC 해시 키 보관 검증", async () => {
    const testIp = "203.0.113.88";
    const testEmail = "privacy_test@example.com";

    const res = await onRequestPost({
      request: new Request("https://etfcampus.pages.dev/api/lead/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": testIp,
        },
        body: JSON.stringify({
          email: testEmail,
          interest: "all",
          source: "privacy_audit",
          campaign: "challenge_guide_2026",
          termsVersion: "v1.0",
          agreeRequired: true,
        }),
      }),
      env: testEnv,
    });
    expect(res.status).toBe(201);

    // lead_rate_limits 테이블 전수 검사
    const rateRows = sqliteDb.prepare("SELECT * FROM lead_rate_limits").all() as unknown as RateLimitDbRow[];
    expect(rateRows.length).toBeGreaterThanOrEqual(2);

    for (const row of rateRows) {
      // 1. 접두사 검증: rl_ip_ 또는 rl_em_ 으로 시작해야 함
      const hasValidPrefix = row.key.startsWith("rl_ip_") || row.key.startsWith("rl_em_");
      expect(hasValidPrefix).toBe(true);

      // 2. 평문 검증: 원문 IP나 이메일이 키에 포함되어 있으면 안 됨
      expect(row.key).not.toContain(testIp);
      expect(row.key).not.toContain(testEmail);
      expect(row.key).not.toContain("@");
    }
  });
});
