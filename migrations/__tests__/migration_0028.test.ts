// @vitest-environment node
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

describe("D1 Database Migrations - 0027 Base and 0028 Incremental Hardening", () => {
  const sql0027 = fs.readFileSync("migrations/0027_lead_waitlist.sql", "utf-8");
  const sql0028 = fs.readFileSync("migrations/0028_lead_waitlist_hardening.sql", "utf-8");

  it("시나리오 1: 빈 데이터베이스(Fresh DB)에서 0027과 0028을 순차 적용 시 정상 스키마 및 멱등성이 구성된다", () => {
    const db = new DatabaseSync(":memory:");

    // 0027 적용
    db.exec(sql0027);

    // 0028 적용
    db.exec(sql0028);

    // 컬럼 무결성 검증
    interface ColumnInfo {
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }
    const columns = db.prepare("PRAGMA table_info(lead_waitlist)").all() as unknown as ColumnInfo[];
    const colNames = columns.map((c) => c.name);

    expect(colNames).toContain("id");
    expect(colNames).toContain("email");
    expect(colNames).toContain("interest");
    expect(colNames).toContain("source");
    expect(colNames).toContain("campaign");
    expect(colNames).toContain("terms_version");
    expect(colNames).toContain("agreed_at");
    expect(colNames).toContain("status");
    expect(colNames).toContain("created_at");
    expect(colNames).toContain("updated_at");

    // 고유 인덱스 검증
    interface IndexInfo {
      seq: number;
      name: string;
      unique: number;
      origin: string;
      partial: number;
    }
    const indices = db.prepare("PRAGMA index_list(lead_waitlist)").all() as unknown as IndexInfo[];
    const uniqueIndex = indices.find((idx) => idx.name === "idx_lead_waitlist_email_campaign");
    expect(uniqueIndex).toBeDefined();
    expect(uniqueIndex?.unique).toBe(1);

    // lead_rate_limits 테이블 및 인덱스 검증
    const rateLimitCols = db.prepare("PRAGMA table_info(lead_rate_limits)").all() as unknown as ColumnInfo[];
    const rateColNames = rateLimitCols.map((c) => c.name);
    expect(rateColNames).toEqual(["key", "count", "reset_at"]);
    const rateIndices = db.prepare("PRAGMA index_list(lead_rate_limits)").all() as unknown as IndexInfo[];
    expect(rateIndices.some((idx) => idx.name === "idx_lead_rate_limits_reset_at")).toBe(true);


    // UPSERT 쿼리 실행 및 멱등성 검증
    const upsertStmt = db.prepare(`
      INSERT INTO lead_waitlist (
        email, interest, source, campaign, terms_version,
        agreed_at, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, datetime('now'), 'pending', datetime('now'), datetime('now'))
      ON CONFLICT(email, campaign) DO UPDATE SET
        interest = excluded.interest,
        source = excluded.source,
        terms_version = excluded.terms_version,
        agreed_at = excluded.agreed_at,
        updated_at = datetime('now')
    `);

    // 1회 삽입
    upsertStmt.run("investor@test.com", "dc_irp", "modal", "challenge_guide_2026", "v1.0");

    // 2회 동일 이메일 및 캠페인 재신청 (관심사 변경)
    upsertStmt.run("investor@test.com", "fee", "bridge", "challenge_guide_2026", "v1.0");

    interface Row {
      id: number;
      email: string;
      interest: string;
      source: string;
      campaign: string;
      terms_version: string | null;
      agreed_at: string | null;
    }
    const rows = db.prepare("SELECT * FROM lead_waitlist").all() as unknown as Row[];
    expect(rows.length).toBe(1);
    expect(rows[0].email).toBe("investor@test.com");
    expect(rows[0].interest).toBe("fee");
    expect(rows[0].source).toBe("bridge");

    db.close();
  });

  it("시나리오 2: 0027이 이미 적용된 기존 데이터베이스(Existing DB)에서 레거시 데이터 보존 및 중복 정리가 안전하게 수행된다", () => {
    const db = new DatabaseSync(":memory:");

    // 1. 0027만 먼저 적용된 레거시 상태 재현
    db.exec(sql0027);

    // 2. 레거시 데이터 삽입 (과거 신청자, 중복 행 포함)
    db.exec(`
      INSERT INTO lead_waitlist (email, interest, source, created_at) 
      VALUES ('legacy_dup@test.com', 'fee', 'compare_bridge', '2026-09-20 09:00:00');

      INSERT INTO lead_waitlist (email, interest, source, created_at) 
      VALUES ('legacy_dup@test.com', 'dc_irp', 'compare_bridge', '2026-09-21 10:00:00');

      INSERT INTO lead_waitlist (email, interest, source, created_at) 
      VALUES ('legacy_unique@test.com', 'routine', 'direct', '2026-09-21 11:00:00');
    `);

    // 3. 0028 증분 마이그레이션 적용
    db.exec(sql0028);

    interface Row {
      id: number;
      email: string;
      interest: string;
      source: string;
      campaign: string;
      terms_version: string | null;
      agreed_at: string | null;
      updated_at: string | null;
      created_at: string;
    }
    const rows = db.prepare("SELECT * FROM lead_waitlist ORDER BY id ASC").all() as unknown as Row[];

    // 중복 행 정리 검증 (legacy_dup@test.com 중 최신 id=2만 남고 id=1 삭제)
    expect(rows.length).toBe(2);
    expect(rows.map((r) => r.email)).toEqual(["legacy_dup@test.com", "legacy_unique@test.com"]);
    expect(rows[0].interest).toBe("dc_irp");

    // 과거 신청자에 대한 무결성 검증 (확인되지 않은 동의 버전/시각을 임의 날조하지 않고 NULL 유지)
    expect(rows[0].terms_version).toBeNull();
    expect(rows[0].agreed_at).toBeNull();
    expect(rows[1].terms_version).toBeNull();
    expect(rows[1].agreed_at).toBeNull();

    // 갱신일자는 생성일자로 보존되었는지 검증
    expect(rows[0].updated_at).toBe(rows[0].created_at);
    expect(rows[1].updated_at).toBe(rows[1].created_at);

    // 4. 기존 레거시 사용자가 새로운 v1.0 약관으로 동의하고 재신청했을 때의 정상 업데이트 검증
    const upsertStmt = db.prepare(`
      INSERT INTO lead_waitlist (
        email, interest, source, campaign, terms_version,
        agreed_at, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, datetime('now'), 'pending', datetime('now'), datetime('now'))
      ON CONFLICT(email, campaign) DO UPDATE SET
        interest = excluded.interest,
        source = excluded.source,
        terms_version = excluded.terms_version,
        agreed_at = excluded.agreed_at,
        updated_at = datetime('now')
    `);

    upsertStmt.run("legacy_dup@test.com", "routine", "modal", "challenge_guide_2026", "v1.0");

    const updatedRows = db.prepare("SELECT * FROM lead_waitlist WHERE email = 'legacy_dup@test.com'").all() as unknown as Row[];
    expect(updatedRows.length).toBe(1);
    expect(updatedRows[0].terms_version).toBe("v1.0");
    expect(updatedRows[0].agreed_at).not.toBeNull();
    expect(updatedRows[0].interest).toBe("routine");

    db.close();
  });
});
