import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.join(process.cwd(), "supabase", "migrations", "20260815000002_community_security_hardening.sql"), "utf8");

describe("커뮤니티 Supabase 보안 마이그레이션 계약", () => {
  it("직접 Data API 테이블 권한을 회수하고 공개 View만 읽기 허용한다", () => {
    expect(source).toContain("revoke all on table public.user_profiles");
    expect(source).toContain("grant select on table public.community_categories, public.community_public_posts, public.community_public_comments to anon, authenticated");
  });

  it("서버 관리 함수는 빈 search_path와 최소 EXECUTE 권한을 사용한다", () => {
    expect(source).toContain("security definer set search_path = ''");
    expect(source).toContain("revoke all on function public.assign_initial_community_admin");
    expect(source).toContain("public.assign_initial_community_admin(uuid, text) to service_role");
  });

  it("동의 기록은 append RPC와 선택 마케팅 철회 RPC로만 처리한다", () => {
    expect(source).toContain("append_community_consent");
    expect(source).toContain("withdraw_community_marketing_consent");
    expect(source).toContain("consent_type not in ('community_terms', 'privacy_notice', 'marketing')");
  });

  it("탈퇴 요청은 재시도 상태와 30일 정리 함수 경계를 기록한다", () => {
    expect(source).toContain("auth_delete_failed");
    expect(source).toContain("mark_community_withdrawal_auth_failed");
    expect(source).toContain("purge_due_community_withdrawals");
    expect(source).toContain("interval '30 days'");
  });
});
