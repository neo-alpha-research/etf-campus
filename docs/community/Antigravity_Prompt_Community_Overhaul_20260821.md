# Antigravity 지시문 — 커뮤니티 고도화 순차 구현 (6인 평가단 루프)

작성일 2026-08-21 · 저장소 `D:\ETFCampus` (`neo-alpha-research/etf-campus`)
근거: Gemini 3.1 Pro 「ETF Campus 커뮤니티 고도화 및 백오피스 구축 명세서」 + 실제 코드 대조 검토

---

# 0. 이 문서의 사용법

**S1부터 S6까지 순서대로, 멈추지 말고 끝까지 진행하십시오.** 각 단계는 `구현 → 6인 평가단 채점 → 개선 → 재채점 → 다음 단계`의 루프를 돕니다.

§7의 **하드 스톱 3종**에 해당할 때만 멈추고 질문하십시오. 그 외의 판단이 애매한 지점은 §7의 기본값을 적용하고 `docs/community/overhaul/DECISIONS.md`에 기록한 뒤 **계속 진행**하십시오. 사소한 결정을 물으려고 멈추지 마십시오.

---

# 1. ⚠️ Gemini 초안 검토 결과 — 그대로 구현하지 마십시오

원본 명세서를 실제 스키마·코드와 대조했습니다. **아래 판정을 따르십시오. 원본과 충돌하면 이 문서가 우선합니다.**

## 1-1. 채택 불가 — 보안 후퇴

### (A) RLS 정책 신설

```sql
-- 원본 제안 — 적용 금지
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read posts" ON community_posts FOR SELECT USING (true);
```

현재 보안 모델은 **base table 권한을 회수하고, 공개 읽기는 `community_public_posts` 뷰로만, 쓰기는 SECURITY DEFINER RPC로만** 허용합니다. base table에 public SELECT를 열면 `author_profile_id`(회원 UUID)가 그대로 노출됩니다. 이 UUID를 공개 DTO에서 빼려고 `list_own_community_post_slugs`가 slug만 반환하도록 설계돼 있습니다.

**이 원칙을 되돌리지 마십시오.** 새 기능도 뷰 + RPC 경로를 따릅니다.

### (B) `toggle_upvote` 함수 시그니처

```sql
-- 원본 제안 — 심각한 취약점
CREATE FUNCTION toggle_upvote(target_post_id UUID, current_user_id UUID)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER
```

`SECURITY DEFINER`인데 **user_id를 파라미터로 받습니다.** 호출자가 아무 UUID나 넣으면 **타인 명의로 추천이 가능합니다.** 기존 커뮤니티 RPC는 전부 함수 내부에서 `auth.uid()`를 씁니다.

**반드시 `auth.uid()` 기반으로 재설계하십시오.**

```sql
create or replace function public.toggle_community_post_upvote(p_slug uuid)
returns table (upvote_count int, is_upvoted boolean)
language plpgsql security definer set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  ...
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  -- 이하 auth.uid()만 사용
end; $$;
```

권한도 기존 패턴을 따르십시오: `revoke all ... from public, anon;` + `grant execute ... to authenticated;`

### (C) `upvote.ts` 엔드포인트

```ts
// 원본 제안 — 적용 금지
const userId = "USER_ID_FROM_SESSION";
headers: { 'apikey': env.SUPABASE_SERVICE_ROLE_KEY, ... }
```

문자열 리터럴 플레이스홀더가 그대로 있고, **service role 키로 RLS를 우회**하면서 호출자가 준 user_id를 씁니다. 두 결함이 겹칩니다.

기존 패턴을 따르십시오: 미들웨어가 세션에서 access token을 뽑아 `Authorization` 헤더에 실어 주므로, 핸들러는 `authenticatedSupabase(context)`로 사용자 JWT 기반 클라이언트를 얻어 RPC를 호출합니다. service role은 쓰지 마십시오.

### (D) `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`

현재 설계는 Supabase 자격증명을 **Pages Functions 서버 측에만** 둡니다(`env.SUPABASE_URL`, `env.SUPABASE_ANON_KEY`). `NEXT_PUBLIC_*`으로 옮기면 클라이언트 번들에 들어가고, 브라우저가 Supabase를 직접 호출하는 구조로 바뀝니다. **다섯 라운드에 걸쳐 굳힌 서버 경계가 통째로 무너집니다.**

**환경변수 이름을 바꾸지 마십시오.**

## 1-2. 채택 불가 — 스키마 불일치

원본은 실제 스키마를 보지 않고 작성됐습니다. 확인된 사실입니다.

| 원본 가정 | 실제 |
| --- | --- |
| `community_comments` 테이블 신설 | **이미 존재합니다.** `CREATE TABLE IF NOT EXISTS`라 조용히 무시되고, 이후 코드가 없는 컬럼을 참조하게 됩니다 |
| `community_posts.author_id` | 실제 컬럼명은 **`author_profile_id`** (`public.user_profiles(id)` 참조) |
| `community_posts.id`를 공개 식별자로 사용 | 공개 식별자는 **`slug uuid`** 입니다. `id`는 내부용이며 공개 DTO에 넣지 않습니다 |
| `community_posts.upvote_count` 존재 가정 | **컬럼이 없습니다.** 저장소 전체에 `upvote` 문자열이 0건입니다. 트리거가 없는 컬럼을 UPDATE하면 실패합니다 |
| `community_posts.comment_count` | 공개 뷰에는 있으나 base table 컬럼 여부는 미확인. **S1에서 직접 조회해 확인하십시오** |

`community_posts` 실제 정의입니다.

```sql
create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  slug uuid not null unique default gen_random_uuid(),
  category_id uuid not null references public.community_categories(id) on delete restrict,
  author_profile_id uuid references public.user_profiles(id) on delete set null,
  title text not null,
  body_text text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  deletion_requested_at timestamptz,
  constraint community_posts_title_length check (char_length(title) between 2 and 120),
  constraint community_posts_body_length check (char_length(body_text) between 2 and 6000),
  constraint community_posts_no_html_title check (title !~* '<[[:space:]]*/?[[:space:]]*[[:alpha:]]'),
  constraint community_posts_no_html_body check (body_text !~* '<[[:space:]]*/?[[:space:]]*[[:alpha:]]')
);
```

기존 커뮤니티 테이블 7개: `community_user_roles`, `community_categories`, `community_posts`, `community_comments`, `community_rate_limit_buckets`, `community_admin_audit_logs`, `community_withdrawal_requests`

## 1-3. 운영자 결정으로 제외된 항목

| 항목 | 결정 |
| --- | --- |
| **RSC/SSR 전환, `next-on-pages`, `deploy.yml`** | **제외.** `output: "export"` 정적 빌드를 유지합니다. 원본이 제안한 `npx @cloudflare/next-on-pages@1` + `directory: '.vercel/output/static'`은 빌드 시스템·배포 경로·Functions 구조를 전부 갈아엎는 플랫폼 마이그레이션이며, ETF 1,187페이지 정적 생성과 기존 일일 데이터 워크플로 10개가 영향을 받습니다. **`.github/workflows/`에 새 배포 워크플로를 추가하지 마십시오** |
| **`etf_daily_metrics`, `hardware_valuechain_reports`** | **이번 범위에서 제외.** ETF 가격·지표는 Cloudflare D1(`ETF_PRICES`) 경계를 유지합니다. Supabase에 넣으면 진실의 원천이 둘로 갈립니다 |
| **텔레그램 '네오 마켓 시그널', 모멘텀 스코어, RSI** | **보류 — 법률 검토 후.** 개별 종목 공시 + 모멘텀 지표 + 외부 채널 발송 조합은 자본시장법 §101 영역입니다. 구현하지 마십시오 |
| **n8n / Appsmith / Grafana 연동** | 위 두 항목에 종속되므로 함께 보류 |

## 1-4. 수정 후 채택

| 항목 | 수정 내용 |
| --- | --- |
| Feed-First 레이아웃 | 정적 라우트 + 쿼리 파라미터 구조 안에서 구현. **동적 라우트를 만들지 마십시오** — `output: "export"`에서 404가 납니다 (직전 사고 사례) |
| WebP 클라이언트 변환 | 로직은 타당. **디코드 전 파일 크기 상한 검사를 추가**하십시오(예: 20MB 초과 거부). 없으면 대용량 사진이 base64로 메모리에 올라가 모바일에서 탭이 죽습니다. HEIC는 브라우저가 디코드 못 할 수 있으니 실패 시 안내 문구를 노출하십시오 |
| R2 presigned 업로드 | **`@aws-sdk/client-s3`를 설치하지 마십시오.** 미설치 상태이고 Workers 런타임에서 무겁습니다. Cloudflare가 권장하는 **`aws4fetch`**를 쓰거나, R2 바인딩을 `wrangler.toml`에 추가해 Workers에서 직접 put하는 방식을 검토하십시오. 어느 쪽을 골랐는지 근거와 함께 기록하십시오 |
| `$TICKER` Cashtag 파싱 | 채택. 단, **본문은 평문 저장 원칙을 유지**하고 파싱은 렌더 시점에 하십시오. HTML 저장 금지 제약(`community_posts_no_html_body`)이 DB에 걸려 있습니다. 존재하지 않는 티커는 링크로 만들지 마십시오 |
| Disclaimer 컴포넌트 | 채택하되 **문구를 고치십시오.** 원본의 "본 플랫폼은 자본시장법에 따른 유사투자자문업 신고 채널로 1:1 투자 상담을 금지합니다"는 비문이며, 플랫폼이 유사투자자문업 신고 채널이라는 뜻으로 읽힙니다. 사실과 다르고 위험합니다. §7 하드 스톱 대상입니다 |
| 대댓글(`parent_id`) | 기존 `community_comments`에 `parent_id`가 있는지 S1에서 확인 후 판단 |

---

# 2. 착수 전 확인해야 할 저장소 제약

**추측하지 마십시오. 아래는 검증된 사실입니다.**

- **Supabase SDK가 없습니다.** `package.json`에 `@supabase/supabase-js`가 없고, `functions/api/community/_lib/supabase.js`는 GoTrue·PostgREST를 `fetch`로 직접 호출하는 자체 구현 클라이언트입니다. 사용 가능한 메서드는 `from` / `rpc` / `auth.getUser` / `signInWithOtp` / `verifyOtp` / `signInWithPassword` / `updateUser` / `signOut` / `auth.admin.deleteUser` 뿐입니다. 없는 메서드가 필요하면 이 파일에 최소한으로 추가하십시오.
- **Cloudflare Workers 런타임**입니다. `Buffer`, `node:crypto`, `fs`를 쓸 수 없습니다. `crypto.getRandomValues`와 `crypto.subtle`은 사용 가능합니다.
- **`_middleware.js`가 `/api/community/**` 전체에 적용됩니다.** unsafe method는 Origin 동일 출처 → `Content-Type: application/json` → CSRF 이중 제출을 순서대로 통과해야 합니다. **새 엔드포인트를 추가하면 자동으로 이 게이트를 탑니다.** 클라이언트는 `lib/community/browser-client.ts`의 `communityFetch`를 쓰십시오. 직접 `fetch`를 부르면 CSRF 헤더가 빠져 403이 납니다.
- **`next.config.ts`**: `output: "export"`, `trailingSlash: true`. 동적 라우트 불가.
- **명령**: 테스트 `npm test`(vitest), 린트 `npm run lint`, 빌드 `npm run build`.

---

# 3. 절대 규칙

1. **증분 편집만.** 기존 파일을 통째로 다시 쓰지 마십시오. 파일 전체를 생성하는 스크립트 방식 금지입니다.
2. **PowerShell로 파일을 쓰지 마십시오.** `>`, `>>`, `Set-Content`, here-string 모두 금지. 이 저장소에서 세 번 사고가 났습니다 — ① 테스트 파일 UTF-8 BOM ② here-string이 백틱과 `${...}`를 변수로 해석해 치환이 조용히 실패 ③ `>>`가 UTF-16LE로 기록해 `.gitignore`를 바이너리로 만듦. **에디터 도구로 편집하십시오.**
3. **정규식 일괄 치환으로 기존 파일을 수정하지 마십시오.** `functions/api/briefings/latest.js`의 로직이 이 경로로 유실된 전례가 있습니다.
4. **`git checkout -- <file>` 되돌린 뒤 재적용 패턴 금지.** 위 유실이 그 경로에서 발생했습니다.
5. **`git add .`와 광범위 글로브 금지.** `git rm *.py`가 `scripts/` 하위 121개를 지울 뻔했습니다. 경로를 명시하십시오.
6. **기존 타입 계약을 바꾸지 마십시오.** 프런트엔드가 소비하는 응답 형태를 바꿔야 하면 멈추고 질문하십시오.
7. **기존 테스트를 삭제·skip·완화하지 마십시오.**
8. **테스트 실패를 "환경 한계"로 분류하지 마십시오.** 실패는 기본적으로 코드가 틀렸다는 신호입니다. 원인을 규명한 뒤에만 다른 판정을 내리십시오.
9. **빌드 통과는 검증이 아닙니다.** 실제 요청·응답 증빙을 제시하십시오. 확보하지 못했으면 "미확보"라고 그대로 적으십시오. **확보하지 못한 것을 확보했다고 적는 것만이 문제입니다.**
10. **모든 파일은 UTF-8(BOM 없음)로 저장하고 저장 후 검증하십시오.**
11. 비밀값(service role key, R2 자격증명, Turnstile secret, 세션 토큰, OTP)과 실제 이용자 이메일을 코드·로그·테스트 fixture·문서에 노출하지 마십시오.
12. **ETF 종목 추천, 매수·매도 신호, 목표가, 수익 보장 문구를 생성하지 마십시오.** 개인 수익률·보유 금액·수익 인증을 지표나 보상으로 삼는 설계도 금지입니다.
13. 각 단계마다 회귀 테스트를 함께 추가하고 `npm test` / `npm run lint` / `npm run build`를 **끝까지** 실행하십시오. lint는 exit 0이어야 합니다.
14. 리포트는 실제 수행한 명령·결과와 일치해야 합니다.

---

# 4. 6인 평가단 — 각 단계마다 실행

각 단계 구현이 끝나면 **아래 6개 관점으로 각각 채점**하십시오. 서브에이전트를 쓸 수 있으면 관점별로 분리해 독립 평가하십시오.

| # | 역할 | 평가 관점 |
| --- | --- | --- |
| 1 | **커뮤니티 운영 전문가** | 1인 운영 부담, 어뷰징 대응 가능성, 초기 회원 유입·잔존, 규칙 이해 가능성, 분쟁 시 증거 보존 |
| 2 | **웹 프론트엔드·UX 전문가** | 접근성(키보드·스크린리더·대비), 모바일 사용성, 로딩·빈 상태·오류 상태 처리, 정적 빌드 제약 준수, 성능 |
| 3 | **데이터 전문가** | 스키마 정합성, 인덱스·쿼리 비용, 마이그레이션 멱등성·롤백, 카운터 정합(동시성), 경계 분리 준수 |
| 4 | **마케팅 전문가** | 검색 유입 설계, 공유 시 표현, 첫 방문자 전환 동선, 브랜드 원칙("어려운 것은 쉽게") 부합 |
| 5 | **고객 페르소나 A — 연금 초보 (40대 직장인)** | DC형 퇴직연금을 막 시작. 용어가 어렵고 실수가 두렵다. "이걸 물어봐도 되나" 싶은 심리적 장벽 |
| 6 | **고객 페르소나 B — ETF 경험자 (30대)** | 이미 3~4종목 보유. 남의 판단 기준이 궁금하지 자기 계좌를 공개하고 싶진 않다. 광고성 글에 민감 |

## 채점 방법

각 평가자가 **5개 항목을 10점 만점**으로 채점하고 근거를 한 줄씩 답니다.

```
① 목적 달성도  ② 사용성  ③ 안전성·프라이버시  ④ 유지보수성  ⑤ 컴플라이언스 부합
```

- **6인 평균 8.0 이상** → 다음 단계로 진행
- **8.0 미만** → 최저 점수 항목부터 개선하고 재채점. **최대 2라운드**
- **2라운드 후에도 8.0 미만** → 개선 가능한 것은 반영하고, 남은 지적을 `docs/community/overhaul/BACKLOG.md`에 기록한 뒤 **다음 단계로 진행**하십시오. 여기서 멈추지 마십시오
- **평가자 중 누구든 ③ 안전성·프라이버시 또는 ⑤ 컴플라이언스를 5점 이하로 주면** 점수 평균과 무관하게 그 지적을 먼저 해소하십시오

채점 결과는 `docs/community/overhaul/reviews/S{n}_review.md`에 기록하십시오. 형식: 평가자별 5개 점수 + 근거 + 개선 요구, 그리고 라운드별 변화.

---

# 5. 단계별 구현

## S0 — 준비 (구현 없음)

1. `git fetch origin` 후 **`origin/main`에서** 새 브랜치를 파십시오.
   ```bash
   git worktree add ../etf-campus-overhaul -b feat/community-overhaul origin/main
   ```
   기존 워크트리에 미커밋 작업이 남아 있을 수 있으므로 `git checkout -b`로 대체하지 마십시오.
2. **PR #13·#14·#15가 머지됐는지 확인**하십시오. 미머지 상태면 그 사실을 기록하고, 해당 PR이 건드린 파일(`functions/api/community/_lib/`, `components/community/`, `lib/community/browser-client.ts`)과 충돌할 작업은 S1 결과 보고에 "머지 후 재확인 필요"로 표시하십시오.
3. `docs/community/overhaul/` 디렉터리와 `DECISIONS.md`, `BACKLOG.md`, `reviews/`를 만드십시오.

## S1 — 현황 조사와 스키마 확정

**구현이 아니라 사실 확보 단계입니다.** 여기서 확보한 사실이 S2 이후의 근거가 됩니다.

Supabase에서 실제로 조회하십시오.

```sql
-- 테이블·뷰 목록
select table_name, table_type from information_schema.tables
 where table_schema='public' order by table_name;

-- community_posts / community_comments 컬럼 전체
select table_name, column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema='public' and table_name in ('community_posts','community_comments')
 order by table_name, ordinal_position;

-- 커뮤니티 함수 정의 전체
select p.proname, pg_get_functiondef(p.oid)
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname like '%community%';

-- 공개 뷰 정의
select table_name, view_definition from information_schema.views
 where table_schema='public' and table_name like 'community%';

-- 인덱스 현황
select tablename, indexname, indexdef from pg_indexes
 where schemaname='public' and tablename like 'community%';
```

확인할 것:
- `comment_count`가 base table 컬럼인지, 뷰에서 계산되는지
- `community_comments`에 `parent_id`가 있는지 (대댓글 가능 여부)
- 목록 조회에 쓰이는 정렬·필터 컬럼에 인덱스가 있는지

**DB 접근 자격증명이 없으면** 조회 SQL을 `docs/community/overhaul/S1_queries.sql`로 저장하고 운영자에게 실행을 요청한 뒤, **결과를 받기 전까지 S2의 스키마 변경 작업을 시작하지 마십시오.** 대신 S2의 프런트엔드 작업(피드 레이아웃)을 먼저 진행하십시오. 여기서 멈추지 마십시오.

**S1 산출물**: `docs/community/overhaul/S1_schema_report.md` — 실제 스키마 현황, §1-2 표의 각 항목 검증 결과, S2 이후 설계에 미치는 영향.

6인 평가단 채점 대상: 조사의 완결성과 이후 설계 근거로서의 충분성.

## S2 — Feed-First 목록과 커서 페이지네이션

- 목록을 피드 형태로 재구성. 카테고리 필터 유지
- **커서 기반 페이지네이션 + "더보기"**. 현재 `limit` 상한 50에 커서가 없어, 글이 쌓이면 오래된 글에 도달할 수 없습니다
- 빈 상태·로딩·오류 상태를 각각 설계하십시오
- 정적 라우트 유지. 상세는 `/community/read/?slug=<uuid>` 규약을 그대로 씁니다

## S3 — 추천(Upvote)

- §1-1 (B)대로 `auth.uid()` 기반 RPC를 신설
- `upvote_count` 컬럼이 없으므로 **마이그레이션으로 추가**하십시오. 기본값 0, NOT NULL
- 동시성: 카운터를 애플리케이션에서 계산하지 말고 DB에서 원자적으로 처리하십시오
- 공개 뷰에 `upvote_count`와 (인증 사용자 기준) `is_upvoted`를 노출. **`author_profile_id`나 추천자 UUID를 공개 DTO에 넣지 마십시오**
- 속도 제한: 기존 `enforceDatabaseRateLimit` 패턴을 따르십시오
- 마이그레이션 파일명은 `supabase/migrations/YYYYMMDDHHMMSS_*.sql` 형식이며, **기존 파일과 타임스탬프·slug가 겹치면 안 됩니다.** `lib/community/__tests__/migration-security-contract.test.ts`에 중복 검출 테스트가 있습니다

## S4 — 이미지 업로드 (WebP + R2)

- 클라이언트 WebP 변환: §1-4의 크기 상한·HEIC 안내 포함
- 업로드 경로: `aws4fetch` 또는 R2 바인딩. **`@aws-sdk/*`를 설치하지 마십시오**
- 새 엔드포인트는 `_middleware.js` 게이트를 통과해야 합니다. `communityFetch`로 호출하십시오
- 업로드 URL 발급은 **인증 회원만**. 속도 제한 필수
- 본문 저장은 평문 유지. 이미지는 URL 참조로 관리하십시오
- **EXIF**: Canvas 재인코딩 과정에서 메타데이터가 제거되는지 실제로 확인하고 결과를 보고하십시오. 연금 계좌 스크린샷에 위치정보가 남으면 안 됩니다

## S5 — `$TICKER` Cashtag

- 렌더 시점 파싱. DB에는 평문 저장
- 실재하는 ETF 티커만 링크로 변환. 링크 대상은 기존 ETF 상세 정적 라우트
- 존재하지 않는 티커는 평문 유지
- **티커 링크가 종목 추천으로 읽히지 않도록** 주변 문구를 검토하십시오

## S6 — 법적 고지 컴포넌트

- `components/layout/disclaimer.tsx` 신설
- **원본 문구를 그대로 쓰지 마십시오.** §7 하드 스톱 대상입니다
- 노출 위치(커뮤니티 하단 / 전역 푸터)를 결정해 기록하십시오

---

# 6. 각 단계 완료 시 보고 형식

```
## S{n} 완료 보고
1. 변경 파일 목록과 각 역할
2. git diff origin/main --stat        ← 삭제 줄이 추가 줄보다 많은 파일은 사유 설명
3. npm test / npm run lint / npm run build 마지막 20줄 (스킵 수 포함해 정확히)
4. 실제 요청·응답 증빙 (토큰·쿠키 값은 앞 8자만 남기고 마스킹). 미확보면 "미확보"와 사유
5. 6인 평가단 채점표 — 라운드별 점수 변화와 반영 내역
6. DECISIONS.md에 기록한 판단과 근거
7. BACKLOG.md로 넘긴 항목
8. 남은 위험 — 숨기지 말 것
```

---

# 7. 멈춤 조건

## 하드 스톱 — 반드시 멈추고 질문하십시오

1. **법적 고지·컴플라이언스 문구를 확정해야 할 때.** S6의 disclaimer 문구는 사실관계와 법적 표현이 걸린 사안입니다. 초안 3가지를 제시하고 운영자 확인을 받으십시오. 임의로 확정하지 마십시오.
2. **기존 보안 모델을 바꿔야 할 때.** base table 권한, RLS 정책, RPC 권한, 세션 쿠키, CSRF, 환경변수 노출 범위 중 무엇이든 바꿔야 한다고 판단되면 멈추십시오.
3. **프런트엔드가 소비하는 기존 응답 계약을 바꿔야 할 때.**

## 그 외 — 기본값을 적용하고 계속하십시오

판단이 애매하면 아래 기본값을 쓰고 `DECISIONS.md`에 근거와 함께 기록한 뒤 **진행하십시오.**

| 상황 | 기본값 |
| --- | --- |
| UI 세부(간격·색·문구 톤) | 기존 커뮤니티 컴포넌트의 스타일을 따름 |
| 신규 옵션의 기본 상태 | 보수적인 쪽 (비공개·꺼짐·최소 권한) |
| 새 필드 공개 여부 | 공개 DTO에 넣지 않음 |
| 성능 vs 단순함 | 단순함. 최적화는 BACKLOG로 |
| 범위가 커질 조짐 | 최소 구현으로 마감하고 확장은 BACKLOG로 |

**"어떻게 할까요"를 물으려고 멈추지 마십시오.** 위 표로 정하고 기록한 뒤 계속하십시오.

---

# 8. 최종 보고

S6까지 끝나면 아래를 제출하십시오.

1. PR URL (`origin/main` 대상)
2. `git diff origin/main --stat` 전체
3. S1~S6 각 단계 채점표 요약 — 최종 평균 점수
4. `DECISIONS.md` 전문
5. `BACKLOG.md` 전문 — 우선순위 표시
6. 하드 스톱으로 운영자 확인이 필요한 항목 목록
7. Gemini 원본 명세서 중 **구현하지 않은 항목과 그 사유** — §1-3에 더해 실제 작업 중 제외한 것이 있으면 함께
