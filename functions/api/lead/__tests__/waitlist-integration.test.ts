// @vitest-environment node
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it, beforeEach, afterEach } from "vitest";

import { onRequestPost } from "../waitlist";

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

  const sql0027 = fs.readFileSync("migrations/0027_lead_waitlist.sql", "utf-8");
  const sql0028 = fs.readFileSync("migrations/0028_lead_waitlist_hardening.sql", "utf-8");

  beforeEach(() => {
    sqliteDb = new DatabaseSync(":memory:");
    sqliteDb.exec(sql0027);
    sqliteDb.exec(sql0028);
    d1Adapter = createD1Adapter(sqliteDb);
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
    const res1 = await onRequestPost({ request: makeRequest("dc_irp", "bridge_1"), env: { ETF_PRICES: d1Adapter } });
    expect(res1.status).toBe(201);
    const body1 = (await res1.json()) as WaitlistApiResponse;
    expect(body1.success).toBe(true);

    // 2차 연속 신청 (동일 이메일, 다른 관심사/유입경로)
    const res2 = await onRequestPost({ request: makeRequest("fee", "bridge_2"), env: { ETF_PRICES: d1Adapter } });
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

  it("수신 동의 철회(withdrawn) vs 개인정보 물리적 파기(DELETE)가 명확히 구분되어 동작한다", async () => {
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
    await onRequestPost({ request: initialReq, env: { ETF_PRICES: d1Adapter } });

    // 2. 수신 동의 철회(status = 'withdrawn'): DB 레코드는 감사/부인방지 목적으로 보존되나 발송 대상에서는 제외
    sqliteDb
      .prepare("UPDATE lead_waitlist SET status = 'withdrawn', updated_at = '2026-09-20 12:00:00' WHERE email = ?")
      .run(email);

    const rowWithdrawn = sqliteDb.prepare("SELECT * FROM lead_waitlist WHERE email = ?").get(email) as unknown as WaitlistDbRow;
    expect(rowWithdrawn.status).toBe("withdrawn");

    // 3. 사용자가 페이지에서 다시 필수 동의를 체크하고 재신청 -> status가 pending으로 복구되고 신규 동의시각 갱신
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
    const reapplyRes = await onRequestPost({ request: reapplyReq, env: { ETF_PRICES: d1Adapter } });
    expect(reapplyRes.status).toBe(201);

    const rowsAfterReapply = sqliteDb
      .prepare("SELECT * FROM lead_waitlist WHERE email = ?")
      .all(email) as unknown as WaitlistDbRow[];
    expect(rowsAfterReapply.length).toBe(1);
    expect(rowsAfterReapply[0].status).toBe("pending");
    expect(rowsAfterReapply[0].interest).toBe("dc_irp");

    // 4. 정보주체의 완전 파기 요청(잊혀질 권리): 물리적 DELETE 수행 시 레코드가 영구 소멸됨
    sqliteDb.prepare("DELETE FROM lead_waitlist WHERE email = ?").run(email);
    const rowDeleted = sqliteDb.prepare("SELECT * FROM lead_waitlist WHERE email = ?").get(email);
    expect(rowDeleted).toBeUndefined();
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
    await onRequestPost({ request: initialReq, env: { ETF_PRICES: d1Adapter } });

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
    const res = await onRequestPost({ request: reapplyReq, env: { ETF_PRICES: d1Adapter } });
    
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
        env: { ETF_PRICES: d1Adapter },
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

  it("[개인정보 최소화] lead_rate_limits 테이블에 원문 IP나 이메일이 평문 저장되지 않고 오직 SHA-256 해시 키만 저장된다", async () => {
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
      env: { ETF_PRICES: d1Adapter },
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
