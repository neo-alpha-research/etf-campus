// @vitest-environment node
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it, beforeEach, afterEach } from "vitest";

import { onRequestPost } from "../waitlist";

interface WaitlistApiResponse {
  success?: boolean;
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

  it("수신 동의 철회(withdrawn) 후 재신청 시 상태가 pending으로 복구되고 신규 동의 시각이 기록된다", async () => {
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

    // 2. 운영자 창구(etfcampus@gmail.com)를 통한 철회 처리 시뮬레이션
    sqliteDb
      .prepare("UPDATE lead_waitlist SET status = 'withdrawn', updated_at = '2026-09-20 12:00:00' WHERE email = ?")
      .run(email);

    const row1 = sqliteDb.prepare("SELECT * FROM lead_waitlist WHERE email = ?").get(email) as unknown as WaitlistDbRow;
    expect(row1.status).toBe("withdrawn");

    // 3. 사용자가 페이지에서 다시 동의하고 재신청
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

    // 4. DB 상태가 pending으로 복원되고 1행만 유지되는지 확인
    const rows = sqliteDb
      .prepare("SELECT * FROM lead_waitlist WHERE email = ?")
      .all(email) as unknown as WaitlistDbRow[];

    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe("pending");
    expect(rows[0].interest).toBe("dc_irp");
    expect(rows[0].terms_version).toBe("v1.0");
    expect(rows[0].agreed_at).not.toBeNull();
  });

  it("가이드 발송 완료(sent) 후 재신청 시 상태가 pending으로 복구되어 차기 안내 대상에 편입된다", async () => {
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

    // 2. 가이드 1차 배포 완료 처리 시뮬레이션
    sqliteDb
      .prepare("UPDATE lead_waitlist SET status = 'sent' WHERE email = ?")
      .run(email);

    const row2 = sqliteDb.prepare("SELECT * FROM lead_waitlist WHERE email = ?").get(email) as unknown as WaitlistDbRow;
    expect(row2.status).toBe("sent");

    // 3. 개정판 또는 추가 안내를 위해 재신청
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
    expect(res.status).toBe(201);

    // 4. DB 검증: status가 pending으로 복원되고 1행만 유지
    const rows = sqliteDb
      .prepare("SELECT * FROM lead_waitlist WHERE email = ?")
      .all(email) as unknown as WaitlistDbRow[];

    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe("pending");
  });

  it("동일 IP에서 짧은 시간 내 과도한 요청 시 429 RATE_LIMITED가 발동한다", async () => {
    const attackerIp = "198.51.100.99";

    const makeSpamRequest = (i: number) =>
      new Request("https://etfcampus.pages.dev/api/lead/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": attackerIp,
        },
        body: JSON.stringify({
          email: `spam_user_${i}@example.com`,
          interest: "routine",
          source: "bot",
          campaign: "challenge_guide_2026",
          termsVersion: "v1.0",
          agreeRequired: true,
        }),
      });

    // 5회까지는 허용 (IP 제한 5회)
    for (let i = 1; i <= 5; i++) {
      const res = await onRequestPost({ request: makeSpamRequest(i), env: { ETF_PRICES: d1Adapter } });
      expect(res.status).toBe(201);
    }

    // 6회째 요청은 레이트 리밋 차단 (429)
    const rateLimitedRes = await onRequestPost({ request: makeSpamRequest(6), env: { ETF_PRICES: d1Adapter } });
    expect(rateLimitedRes.status).toBe(429);
    const body = (await rateLimitedRes.json()) as WaitlistApiResponse;
    expect(body.error?.code).toBe("RATE_LIMITED");
    expect(body.error?.message).toContain("요청이 너무 많습니다");

    // lead_rate_limits 테이블에 기록 확인
    interface RateRow {
      key: string;
      count: number;
      reset_at: number;
    }
    const rateRows = sqliteDb
      .prepare("SELECT * FROM lead_rate_limits WHERE key = ?")
      .all(`ip:${attackerIp}`) as unknown as RateRow[];

    expect(rateRows.length).toBe(1);
    expect(rateRows[0].count).toBeGreaterThanOrEqual(5);
  });
});
