import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.join(process.cwd(), "supabase", "migrations", "20260815000002_community_security_hardening.sql"), "utf8");
const postOwnerSource = fs.readFileSync(path.join(process.cwd(), "supabase", "migrations", "20260819000001_community_post_owner_visibility.sql"), "utf8");

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

  it("게시물 소유자 판정 RPC는 공개 작성자 식별자 대신 본인 게시물 slug만 반환한다", () => {
    expect(postOwnerSource).toContain("returns table (slug uuid)");
    expect(postOwnerSource).toContain("post.author_profile_id = auth.uid()");
    expect(postOwnerSource).toContain("revoke all on function public.list_own_community_post_slugs(uuid) from public, anon");
    expect(postOwnerSource).toContain("grant execute on function public.list_own_community_post_slugs(uuid) to authenticated");
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

  it("정규화된 타임스탬프와 slug가 동일한 중복 마이그레이션 파일이 존재하지 않는다", () => {
    const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith(".sql"));
    
    const normalized = new Set();
    for (const file of files) {
      // Remove underscore between date and time to normalize (e.g., 20260815_000001 -> 20260815000001)
      const match = file.match(/^(\d{8})_?(\d{6})_(.+)\.sql$/);
      if (match) {
        const normName = `${match[1]}${match[2]}_${match[3]}`;
        expect(normalized.has(normName)).toBe(false);
        normalized.add(normName);
      }
    }
  });
});
