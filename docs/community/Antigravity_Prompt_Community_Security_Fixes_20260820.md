# Antigravity 인계 프롬프트 — ETF Campus 커뮤니티 인증 보안 결함 수정

작성일 2026-08-20 · 아래 `---` 사이 전문을 그대로 Antigravity에 붙여넣으십시오.
근거 문서: `docs/community/Review_Community_Auth_Security_20260820.md`

---

# 역할

당신은 **이미 Production에서 운영 중인 `neo-alpha-research/etf-campus` 커뮤니티의 인증 보안 결함을 최소 변경으로 수정하는 시니어 엔지니어**입니다.

커뮤니티는 실제 회원이 사용 중입니다. 공개 읽기, 인증 회원 글·댓글 작성, 작성자 소유권 기반 수정·삭제, Supabase RLS/RPC 기반 mutation 통제, Turnstile·속도 제한·탈퇴 모델이 모두 동작합니다. **새로 만드는 작업이 아닙니다. 도는 시스템의 결함을 고치는 작업입니다.**

이 저장소에는 `CLAUDE.md`나 `AGENTS.md`가 없습니다. 이 프롬프트가 유일한 컨텍스트입니다.

# 0. 검증된 현재 상태 (2026-08-20 실제 소스 확인)

추측하지 마십시오. 아래는 실제로 파일을 열어 확인한 사실입니다.

## 0.1 아키텍처 경계 — 절대 변경 금지

| 대상 | 저장소 |
| --- | --- |
| 커뮤니티 데이터·인증 | Supabase Auth + Supabase Postgres |
| ETF 가격 데이터 | Cloudflare D1 (`ETF_PRICES`) |

장애·권한·개인정보 경계를 분리하려고 의도적으로 나눈 구조입니다. **절대 결합하지 마십시오.**

- 서버 런타임: Cloudflare Pages Functions (`functions/` 디렉터리)
- 프론트엔드: Next.js App Router, `next.config.ts`에 `output: "export"` + `trailingSlash: true`
- 테스트: vitest — `npm test` (= `vitest run`), 린트 `npm run lint` (= `eslint .`), 빌드 `npm run build`
- vitest 설정: `environment: "jsdom"`, `setupFiles: ["./vitest.setup.ts"]`, `fileParallelism: false`, `testTimeout: 15000`

## 0.2 브랜치 위생 — 착수 전 반드시 처리

현재 checkout은 `feat/admin-market-briefing-console`이며 `origin/main` 대비 **커밋은 1개뿐**입니다. 그런데 워킹트리에 **마켓 브리핑 운영 콘솔의 미완성 작업이 커밋되지 않은 채 대량으로 쌓여 있습니다.**

```
수정됨 6개:  components/etf-detail/etf-detail-client.tsx
             functions/api/briefings/[date].js
             functions/api/briefings/latest.js
             workers/market-briefing-publisher/src/index.ts
             workers/market-briefing-publisher/src/publication-cache.ts
             workers/market-event-dispatcher/src/index.ts
추적 안 됨:  app/admin/, functions/api/admin/, functions/_shared/rbac.js,
             functions/api/briefings/_lib/, functions/api/briefings/__tests__/,
             migrations/0008_market_briefing_editorial.sql,
             migrations/0009_market_briefing_editorial_fixes.sql,
             scripts/create-admin-user.mjs 외 다수
```

**미커밋 변경은 브랜치를 바꿔도 따라옵니다.** 그냥 `git checkout -b`를 하면 이 작업이 커뮤니티 PR에 섞입니다.

→ **`git worktree`로 `origin/main`에서 분리된 작업 공간을 만들어 진행하십시오.**

```bash
git fetch origin
git worktree add ../etf-campus-community-fix -b fix/community-auth-hardening origin/main
cd ../etf-campus-community-fix
npm ci
```

작업 공간의 `git status`가 깨끗한지, `git log --oneline -1`이 `origin/main`과 같은지 확인한 뒤 시작하십시오. 마켓 브리핑 관련 파일은 이 PR에 **한 줄도** 들어가면 안 됩니다.

> 참고: `.git/` 안에 이전 에이전트들이 남긴 stale lock 파일이 30개 넘게 쌓여 있습니다 (`index.lock.dead.*`, `HEAD.lock.dead.*` 등). 작업 중 `Unable to create '.git/index.lock': File exists` 오류가 나면 해당 lock 파일을 제거한 뒤 재시도하십시오.

## 0.3 실재 확인된 파일

```
functions/api/community/_middleware.js               인증·CSRF·Origin 게이트 (중앙)
functions/api/community/_lib/session.js              세션 쿠키·CSRF·refresh helper
functions/api/community/_lib/request-security.js     Turnstile·속도 제한
functions/api/community/_lib/api-security.ts         errorResponse(status, code, message)
functions/api/community/_lib/supabase.js             자체 구현 REST 클라이언트 ← 수정 대상 (§0.5)
functions/api/community/auth/request-otp.js
functions/api/community/auth/verify-otp.js           ← 수정 대상
functions/api/community/auth/set-password.js         ← 수정 대상
functions/api/community/auth/login-password.js       참조 기준 (올바르게 구현됨)
functions/api/community/auth/session.js
functions/api/community/auth/profile.js
functions/api/community/auth/account.js
functions/api/community/auth/config.js
functions/api/community/posts/**
components/auth/supabase-auth-flow.tsx               ← 수정 대상 (287줄)
lib/community/browser-client.ts                      ← 수정 대상
supabase/migrations/**                               ← 중복 파일 문제 (H-3)
supabase/ops/schedule_community_retention.sql        pg_cron 등록 스크립트 (존재함)
```

## 0.4 기존 테스트 자산 (전체 45개 중 커뮤니티 관련)

```
functions/api/community/__tests__/auth-config.test.js
functions/api/community/_lib/request-security.test.ts
functions/api/community/auth/request-otp.test.ts
functions/api/community/auth/verify-otp.test.ts               ← 갱신 필요 (§2.1)
functions/api/community/posts/[slug]/index.test.ts
lib/community/__tests__/api-security.test.ts
lib/community/__tests__/community-notices.test.ts
lib/community/__tests__/migration-security-contract.test.ts    ← H-3 근거
lib/community/__tests__/preview-integration.contract.test.ts
lib/community/__tests__/server-session-contract.test.ts        ← 갱신 필요 (§2.1)
lib/community/__tests__/session-runtime.test.ts
lib/community/__tests__/turnstile-security-contract.test.ts
components/community/__tests__/community-auth-dialog.test.tsx
components/community/__tests__/community-post-detail.test.tsx
```

## 0.5 ⚠️ Supabase SDK가 없습니다 — 손수 만든 REST 클라이언트입니다

**`package.json`에 `@supabase/supabase-js`가 없습니다.** `functions/api/community/_lib/supabase.js`는 GoTrue·PostgREST를 `fetch`로 직접 호출하는 **자체 구현 클라이언트**입니다.

```
dependencies: @tanstack/react-virtual, csv-parse, html-to-image, next@16.2.10,
              pretendard, react@19.2.7, react-dom, react-markdown, remark-gfm, swr
devDependencies: eslint, eslint-config-next, jsdom, tailwindcss, typescript, vitest,
              @testing-library/*, @tailwindcss/postcss, @types/*
```

**`import { createClient } from "@supabase/supabase-js"`를 쓰지 마십시오. 설치되어 있지 않습니다.** SDK를 새로 추가하지도 마십시오.

`publicSupabase(env, accessToken?)` / `adminSupabase(env)`가 반환하는 객체에 **실제로 존재하는 메서드는 이것뿐입니다.**

```
.from(table) → .select/.eq/.order/.limit/.insert/.update/.maybeSingle/.single/.then
.rpc(functionName, args)
.auth.getUser(token)
.auth.signInWithOtp({ email, options })
.auth.verifyOtp({ email, token, type })
.auth.signInWithPassword({ email, password })
.auth.updateUser(attributes)
.auth.signOut()
.auth.admin.deleteUser(userId)
```

이 목록에 없는 SDK 메서드(`setSession`, `refreshSession`, `resetPasswordForEmail`, `admin.signOut` 등)는 **존재하지 않습니다.** 필요하면 `supabase.js`에 최소한으로 추가하십시오.

### ⚠️ `signOut()`은 인자를 무시합니다 — 이번에 고쳐야 합니다

`functions/api/community/auth/account.js:10`은 이렇게 호출합니다.

```js
await auth.client.auth.signOut({ scope: "global" });
```

그런데 `supabase.js:94`의 실제 구현은 **인자를 받지 않습니다.**

```js
async signOut() {
  const response = await fetch(new URL("/auth/v1/logout", url),
    { method: "POST", headers: { apikey: apiKey, Authorization: `Bearer ${bearer}` } });
  return { error: response.ok ? null : { message: "Sign out failed" } };
}
```

GoTrue `/auth/v1/logout`의 기본 scope가 `global`이라 **결과적으로는 동작하지만, 코드가 scope를 통제한다는 착시를 만듭니다.** 운영자 결정이 "전 기기 로그아웃"인 이상 이 동작은 테스트로 고정되어야 합니다.

→ `signOut(options)`가 실제로 scope를 전달하도록 최소 확장하십시오.

```js
async signOut(options) {
  const scope = options?.scope ?? "global";
  const target = new URL("/auth/v1/logout", url);
  target.searchParams.set("scope", scope);
  // 이하 동일
}
```

`account.js`의 기존 호출부는 그대로 두면 됩니다 (이제 인자가 실제로 반영됩니다).

### Cloudflare Workers 런타임 제약

`functions/`는 Node가 아니라 Workers 런타임에서 돕니다.

- `crypto.getRandomValues`, `crypto.subtle`은 사용 가능 (`session.js`, `request-security.js`가 이미 사용 중)
- **`Buffer`, `node:crypto`, `fs` 등 Node API는 쓸 수 없습니다.** §2.2의 base64url 인코딩은 `btoa` / `atob` + `Uint8Array` 또는 `TextEncoder`/`TextDecoder`로 구현하십시오
- base64 표준 문자 `+` `/` `=`는 쿠키 값에 안전하지 않을 수 있으니 base64**url** 치환(`-` `_`, 패딩 제거)을 적용하십시오

## 0.6 유지할 것 — 이미 올바릅니다

바꾸지 마십시오.

- `_middleware.js`가 unsafe method에 대해 Origin/Referer 동일 출처 → `Content-Type: application/json` 강제 → CSRF 이중 제출을 순서대로 적용
- `needsAuthentication()`이 deny-by-default이고 공개 경로만 allowlist
- 쿠키가 `__Host-` 접두사 + `Secure` + `HttpOnly` + `Path=/` + `SameSite=Lax`. `__Host-`가 서브도메인 쿠키 주입을 막아 이중 제출 CSRF를 실제로 유효하게 만듦
- `enforceCsrf()`의 상수시간 비교
- 로그아웃이 GoTrue `/auth/v1/logout`을 호출해 refresh token을 서버에서 폐기 (단, scope 인자 전달은 §0.5대로 보정 필요)
- base table 권한 회수 + 공개 view read-only + SECURITY DEFINER RPC로 write 제한 + RLS 2차 방어
- owner RPC가 slug만 반환하고 `author_profile_id`를 공개 DTO에 넣지 않음
- `verifyTurnstile()`의 hostname·action·발급시각(±5분) 검증과 토큰 1회용 재사용 차단
- `login-password.js`의 전체 흐름 — 이번 수정의 **참조 기준**입니다

# 1. 수정 대상 — 배포 차단 5건

문제는 한 곳에 모여 있습니다. **나중에 덧붙인 비밀번호 흐름이 위 설계 규율을 따라가지 못했습니다.**

## C-1 (Critical) — verify-otp가 refresh token을 응답 본문으로 반환

`functions/api/community/auth/verify-otp.js` 현재 코드:

```js
return new Response(JSON.stringify({
  authenticated: true,
  tempAccessToken: data.session.access_token,
  tempRefreshToken: data.session.refresh_token
}), { status: 200, headers: { "Content-Type": "application/json" } });
```

다른 모든 경로는 토큰을 `__Host-` HttpOnly 쿠키에만 두는데 이 한 곳에서 불변식이 깨집니다. refresh token은 최대 30일 유효한 장기 자격증명입니다. 사이트 어디든 XSS가 성립하면 **비밀번호를 바꿔도 유지되는 계정 탈취**가 가능하고, 토큰이 devtools 네트워크 기록·클라이언트 오류 리포팅·중간 프록시 로그에 남습니다.

`components/auth/supabase-auth-flow.tsx`는 이 값을 React state에 보관합니다 (23~24행 `tempAccessToken` / `tempRefreshToken`).

**부수 결함**: `verify-otp.js`는 `sessionHeaders`를 import하고 사용하지 않으며(죽은 import), `rememberMe`를 파싱한 뒤 사용하지 않습니다(죽은 변수). 함께 정리하십시오.

## C-2 (High) — rememberMe 선택이 가입·재설정 경로에서 무시됨

`session.js` 시그니처: `sessionHeaders(session, csrfToken = secureRandom(), rememberMe = true)`

| 호출부 | 코드 | 결과 |
| --- | --- | --- |
| `login-password.js` | `sessionHeaders(data.session, undefined, rememberMe)` | 선택 존중 ✅ |
| `set-password.js` | `sessionHeaders(session)` | **기본값 `true` 적용** ❌ |

신규 가입·비밀번호 재설정 사용자는 체크박스를 해제해도 refresh 쿠키가 30일 유지됩니다. 공용 PC에서 H-2와 결합하면 실질적 계정 탈취 경로입니다.

## H-1 (High) — set-password만 Turnstile·속도 제한이 없음

| 엔드포인트 | Turnstile action | 속도 제한 |
| --- | --- | --- |
| `request-otp` | `community_otp_request` | `otp-request-email` 3/600s, `otp-request-ip` |
| `verify-otp` | `community_otp_verify` | `otp-verify-email` 5/600s, `otp-verify-ip` 10/600s |
| `login-password` | `community_password_login` | `password-login-email` 10/600s, `password-login-ip` 20/600s |
| **`set-password`** | **없음** | **없음** |

**자격증명을 실제로 변경하는 엔드포인트가 인증 계열에서 가장 무방비합니다.**

## H-2 (High) — 로그인 상태에서 현재 비밀번호 확인 없이 비밀번호가 바뀜

`set-password.js`는 body로 받은 access token으로 `supabase.auth.updateUser({ password })`를 호출할 뿐, **그것이 방금 OTP를 통과한 토큰인지 검증하지 않습니다.** 프로젝트의 유효한 access token이면 무엇이든 통과합니다.

로그인 세션이 살아 있는 브라우저(공용 PC, 분실 기기, 30일 `rememberMe`)에서 현재 비밀번호를 모르는 사람이 비밀번호를 바꿔 계정을 영구 탈취할 수 있습니다.

## H-3 (High) — 중복 마이그레이션 파일이 보안 수정을 되돌릴 수 있음

`supabase/migrations/`에 **동일 마이그레이션의 이름만 다른 쌍이 2개** 있습니다. 6개 파일 모두 git에 추적되고 있습니다.

```
20260815000001_community_phase2.sql               22490 bytes
20260815_000001_community_phase2.sql              22434 bytes   ← 쌍
20260815000002_community_security_hardening.sql   18161 bytes
20260815_000002_community_security_hardening.sql  18049 bytes   ← 쌍
20260815000003_community_withdrawal_state_machine.sql           짝 없음
20260819000001_community_post_owner_visibility.sql              짝 없음
```

**실제 diff는 각 쌍당 2줄뿐이며, 전부 PL/pgSQL 변수 섀도잉 방지를 위한 컬럼 한정 여부입니다.**

`phase2` 쌍 (200행, 301행):
```sql
-- 20260815_000001_ (언더스코어 있음)
(select role from public.community_user_roles where user_id = auth.uid()),
-- 20260815000001_ (언더스코어 없음)
(select public.community_user_roles.role from public.community_user_roles where user_id = auth.uid()),
```

`security_hardening` 쌍 (95행, 113행):
```sql
-- 20260815_000002_ (언더스코어 있음)
select id into category_uuid from public.community_categories
  where slug = p_category_slug and is_active;
-- 20260815000002_ (언더스코어 없음)
select id into category_uuid from public.community_categories
  where public.community_categories.slug = p_category_slug
    and public.community_categories.is_active;
```

**한정된 쪽(언더스코어 없음)이 수정본입니다.** 그런데 파일명 정렬 시 `'0'(0x30) < '_'(0x5F)`이므로 **언더스코어 버전이 나중에 실행되어 수정본을 덮어씁니다.** `CREATE OR REPLACE FUNCTION`이면 마지막 실행이 이깁니다.

**정본 확정의 강력한 근거**: `lib/community/__tests__/migration-security-contract.test.ts`가 **언더스코어 없는 파일만** 읽고 있습니다.

```ts
const source = fs.readFileSync(path.join(process.cwd(), "supabase", "migrations",
  "20260815000002_community_security_hardening.sql"), "utf8");
```

즉 저장소의 보안 계약 테스트는 이미 언더스코어 없는 버전을 정본으로 취급합니다.

# 2. 확정된 설계 — 운영자 승인 완료

운영자가 2026-08-20에 아래를 확정했습니다. **재논의하지 말고 그대로 구현하십시오.**

| 항목 | 결정 |
| --- | --- |
| 비밀번호 변경 경로 | **항상 OTP 재인증만.** `set-password`는 재설정 전용. `currentPassword` 기반 변경 경로는 **구현하지 않음** |
| 변경 성공 후 세션 | **전 기기 로그아웃.** `signOut({ scope: "global" })` 후 현재 브라우저만 재발급 |

이 결정 덕분에 H-2 수정이 단순해집니다. **C-1의 단기 쿠키 도입이 곧 H-2 수정입니다** — "로그인 세션이면 통과"하는 경로를 없애고 단기 쿠키만 신뢰하면 되기 때문입니다. C-2의 `rememberMe`도 같은 쿠키에 봉인하면 한 번에 정리됩니다.

## 2.1 ⚠️ 반드시 먼저 읽으십시오 — 기존 테스트 2개가 취약점을 고정하고 있습니다

**"기존 테스트를 건드리지 말라"는 일반 원칙의 예외입니다.** 아래 두 단언은 C-1 취약점을 계약으로 못박고 있어, 수정하면 반드시 깨집니다. 이 두 곳만 갱신을 **명시적으로 승인**합니다.

**(1) `lib/community/__tests__/server-session-contract.test.ts`**

```ts
it("OTP 검증 응답은 임시 세션 토큰을 반환하거나 인증 완료를 처리한다", () => {
  const source = read("functions", "api", "community", "auth", "verify-otp.js");
  expect(source).toContain("tempAccessToken");   // ← 취약점을 고정
});
```

→ 아래처럼 **의미를 반전**시키십시오.

```ts
it("OTP 검증 응답은 세션 토큰을 본문으로 반환하지 않는다", () => {
  const source = read("functions", "api", "community", "auth", "verify-otp.js");
  expect(source).not.toContain("tempAccessToken");
  expect(source).not.toContain("tempRefreshToken");
  expect(source).toContain("__Host-etf-campus-community-pwsetup");
});
```

**(2) `functions/api/community/auth/verify-otp.test.ts`**

```ts
await expect(response.json()).resolves.toEqual({
  authenticated: true,
  tempAccessToken: "test-access-token",
  tempRefreshToken: undefined,          // ← 취약점을 고정
});
```

→ 본문에 토큰이 없고 `Set-Cookie`에 단기 쿠키가 실리는지 검증하도록 재작성하십시오.

**이 두 곳 외에 기존 테스트를 삭제·skip·완화하는 것은 금지입니다.** 다른 테스트가 깨지면 그것은 회귀입니다. 테스트가 아니라 코드를 고치십시오.

## 2.2 서버 설계

### session.js — 신규 export 추가

```js
const PWSETUP_COOKIE = "__Host-etf-campus-community-pwsetup";
const PWSETUP_MAX_AGE = 600; // 10분
```

- `passwordSetupHeaders(session, { rememberMe, csrfToken })`
  - `PWSETUP_COOKIE`에 `base64url(JSON.stringify({ at, rt, rememberMe }))`를 담아 발급
    (HttpOnly, Secure, Path=/, SameSite=Lax, `Max-Age=600`)
  - **동시에 `CSRF_COOKIE`를 발급하고 응답에 `X-Community-CSRF` 헤더를 실으십시오.** 이유는 §2.3
  - `cacheHeaders()`의 `private, no-store` 규약을 그대로 재사용
- `readPasswordSetup(request)` → `{ accessToken, refreshToken, rememberMe } | null`
  - 값 파싱 실패 시 예외 없이 `null` 반환
- `clearPasswordSetupHeaders()` → 해당 쿠키만 `Max-Age=0`으로 만료
- `COMMUNITY_SESSION_COOKIE_NAMES`에 `PWSETUP_COOKIE`를 추가

기존 `serializeCookie` / `expiredCookie` / `cacheHeaders` / `appendCookies` helper를 재사용하십시오. 새 쿠키 직렬화 로직을 따로 만들지 마십시오.

> **인코딩 주의**: 쿠키 값에 `;`가 들어가면 파싱이 깨집니다. base64url을 쓰는 이유가 이것입니다. JWT 약 1KB + base64 33% 증가 → 4KB 한계 내에 여유롭게 들어갑니다.

### verify-otp.js

```js
// 성공 시
return new Response(
  JSON.stringify({ authenticated: true, passwordSetupRequired: true }),
  { status: 200, headers: passwordSetupHeaders(data.session, { rememberMe }) }
);
```

- 응답 본문에 토큰 문자열이 **한 조각도** 남지 않아야 합니다
- 죽은 import(`sessionHeaders`)와 이제 실제로 쓰이는 `rememberMe` 변수를 정리

### set-password.js — 전면 재구성 (덮어쓰기가 아니라 흐름 재배치)

순서를 반드시 지키십시오.

1. `parseJsonBody` → `password` 길이 8자 이상 검증 (로컬 검증 먼저 — 실패해도 쿠키를 소모하지 않기 위함)
2. `readPasswordSetup(context.request)` → `null`이면 `401 AUTH_REQUIRED`
   **body에서 토큰을 읽는 코드는 완전히 제거하십시오.**
3. `verifyTurnstile(context, payload?.captchaToken, "community_password_set")`
4. `enforceDatabaseRateLimit(context, "password-set-ip", CF-Connecting-IP, 10, 600)`
5. `enforceDatabaseRateLimit(context, "password-set-token", <쿠키 원본 문자열>, 1, 600)`
   → **단기 쿠키 1회용 강제.** `verifyTurnstile` 내부의 `"turnstile-token", token, 1, 600` 재사용 차단과 동일한 패턴입니다. 429가 오면 "이미 사용한 인증입니다. 처음부터 다시 시도해 주세요"로 안내
6. `publicSupabase(env, accessToken).auth.updateUser({ password })`
7. 성공 시 `data.user.email`을 확보 → `signOut({ scope: "global" })`
   (§0.5대로 `supabase.js`의 `signOut`이 scope를 실제로 전달하도록 먼저 고쳐두십시오)
8. `signInWithPassword({ email, password })`로 **새 세션 발급**
9. `sessionHeaders(newSession, undefined, rememberMe)` + `clearPasswordSetupHeaders()`의 만료 쿠키를 함께 실어 응답

> 7→8 순서가 중요합니다. global signOut이 기존 refresh token을 전부 폐기하므로, 현재 브라우저 세션은 새 비밀번호로 재로그인해서 새로 받아야 합니다.

> 실패 경로에서도 `PWSETUP_COOKIE`를 만료시키십시오. 단, 5단계에서 이미 1회용으로 소모되므로 재사용은 원천 차단됩니다.

10. `console.error("Set password error:", error)`는 공급자 오류 객체를 통째로 남깁니다. **오류 코드·분류만 남기도록 축소**하십시오 (원래 백로그 항목이나, 이 파일을 어차피 손대므로 지금 처리).

### _middleware.js — ⚠️ CSRF 경로 정규화를 이번 PR에 포함해야 합니다

현재 `OTP_PATHS` 하나가 **두 가지 역할**을 겸하고 있습니다.

```js
if (OTP_PATHS.has(pathname)) { /* CSRF 면제 — 원본 pathname 사용 */ }
function needsAuthentication(pathname, method) {
  const normalizedPath = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  if (OTP_PATHS.has(normalizedPath)) return false;  // 인증 면제 — 정규화된 경로 사용
}
```

`set-password`가 쿠키 인증 + 상태 변경 엔드포인트가 되는 순간, **CSRF 면제 대상에서 빠져야 합니다.** 그런데 단순히 `OTP_PATHS`에서 제거하면 `needsAuthentication`이 `true`를 반환해 미들웨어가 `__Host-...-at` 액세스 쿠키를 요구하고, pwsetup 쿠키만 가진 사용자는 401을 받습니다.

→ **두 집합으로 분리하고, 양쪽 모두 정규화된 경로로 비교하십시오.**

```js
// 세션 인증 불필요 (기존 OTP_PATHS와 동일)
const PUBLIC_AUTH_PATHS = new Set([
  "/api/community/auth/request-otp",
  "/api/community/auth/verify-otp",
  "/api/community/auth/set-password",
  "/api/community/auth/login-password",
]);

// CSRF 이중 제출 면제 — set-password는 제외
const CSRF_EXEMPT_PATHS = new Set([
  "/api/community/auth/request-otp",
  "/api/community/auth/verify-otp",
  "/api/community/auth/login-password",
]);
```

`onRequest` 진입부에서 `pathname`을 한 번 정규화해 두 검사 모두에 쓰십시오. 이는 백로그의 "CSRF 경로 정규화" 항목이었으나, 이제 새 흐름의 정확성이 여기에 의존하므로 **이번 범위에 포함됩니다.**

## 2.3 클라이언트 설계

### lib/community/browser-client.ts

`communityFetch` 안의 `isAuthStart`에서 **`set-password`를 제거**하십시오.

```js
const isAuthStart = path.startsWith("/api/community/auth/request-otp") ||
                    path.startsWith("/api/community/auth/verify-otp") ||
                    path.startsWith("/api/community/auth/login-password");
```

이렇게 하면 set-password 호출 시 `ensureCsrf()`가 돕니다. **여기서 verify-otp가 `X-Community-CSRF` 헤더를 실어야 하는 이유가 나옵니다** — `acceptCsrf()`가 모든 응답에서 이 헤더를 읽어 모듈 변수에 저장하므로, verify-otp 직후 `csrfToken`이 이미 채워져 `ensureCsrf()`가 즉시 반환합니다. 헤더를 빠뜨리면 `ensureCsrf()`가 `/api/community/auth/session`을 호출하고, 아직 세션 쿠키가 없어 **로그인 흐름 전체가 예외로 중단됩니다.** 반드시 함께 구현하십시오.

`credentials: "same-origin"`은 이미 설정되어 있으니 그대로 두십시오.

### components/auth/supabase-auth-flow.tsx

- `tempAccessToken` / `tempRefreshToken` **state와 setter를 완전히 제거** (23~24행, 104~105행)
- set-password 호출 본문을 `{ password, captchaToken }`으로 변경 (126~128행)
- **비밀번호 설정 단계에 Turnstile 위젯을 추가**하십시오. action은 `community_password_set`. 기존 단계들이 `loginCaptchaToken` / `requestCaptchaToken` / `verifyCaptchaToken`을 쓰는 패턴을 그대로 따라 `passwordCaptchaToken` state와 `captchaKey` 리셋을 붙이십시오
- `rememberMe` 체크박스는 verify-otp 단계에서 이미 전송되므로 set-password 본문에 다시 넣지 마십시오 (서버가 쿠키에서 읽습니다)

# 3. H-3 조사 절차 — 파일부터 지우지 마십시오

순서를 지키십시오. 파일 삭제가 **마지막**입니다.

1. **Production·Preview DB의 적용 이력을 먼저 조회**하십시오.
   ```sql
   select version, name, inserted_at
   from supabase_migrations.schema_migrations
   order by version;
   ```
   어떤 파일명이 실제로 기록되어 있는지 확인합니다.

2. **현재 DB에 살아 있는 함수 정의를 덤프**해 한정 버전인지 확인하십시오.
   ```sql
   select p.proname, pg_get_functiondef(p.oid)
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('create_community_post', 'update_community_post');
   ```
   `public.community_categories.slug = p_category_slug` 형태로 한정되어 있으면 수정본이 살아 있는 것이고, `slug = p_category_slug`이면 **언더스코어 버전이 덮어쓴 상태**입니다. 후자라면 정본 함수 정의를 재적용하는 마이그레이션이 추가로 필요합니다.

3. **정본은 언더스코어 없는 버전**으로 확정하십시오 (§1 H-3의 테스트 근거). 확정 후 언더스코어 버전 2개를 제거합니다.

4. 단, **이미 적용 이력이 기록된 파일명을 지우면 도구가 재적용을 시도할 수 있습니다.** 사용 중인 마이그레이션 도구의 이력 테이블 동작을 1단계 결과와 대조해 확인한 뒤 제거하십시오. 판단이 서지 않으면 멈추고 질문하십시오.

5. **재발 방지 테스트를 CI에 추가**하십시오. `lib/community/__tests__/migration-security-contract.test.ts`에 붙이거나 새 파일로 만드십시오.
   - `supabase/migrations/`의 파일명에서 타임스탬프의 `_` 구분자를 제거해 정규화했을 때 **동일 (타임스탬프, slug) 조합이 2개 이상이면 실패**

`20260815000003_community_withdrawal_state_machine.sql`과 `20260819000001_community_post_owner_visibility.sql`에는 짝이 없습니다. **그대로 두십시오.**

# 4. 필수 테스트

기존 커뮤니티 테스트 자산에 **비밀번호 흐름 커버리지가 전혀 없습니다.** 아래를 실제로 작성하고 통과시키십시오. 전부 API 레벨에서 검증 가능합니다.

| # | 시나리오 | 검증 내용 |
| --- | --- | --- |
| 1 | verify-otp 응답 계약 | 본문에 `access_token`/`refresh_token`/`tempAccessToken` 문자열 부재. `Set-Cookie`에 `__Host-...-pwsetup`이 `HttpOnly; Secure; Max-Age=600`으로 발급 |
| 2 | verify-otp CSRF 발급 | 응답에 `X-Community-CSRF` 헤더와 CSRF 쿠키가 함께 실림 |
| 3 | set-password 쿠키 게이트 | pwsetup 쿠키 없이 호출 → 401. body에 토큰을 넣어도 통과하지 못함 |
| 4 | set-password 1회용 | 성공 후 동일 쿠키 재사용 → 차단 (`password-set-token` 한도 1) |
| 5 | set-password Turnstile | captchaToken 누락 시 `CAPTCHA_REQUIRED`, action이 `community_password_set`으로 전달됨 |
| 6 | set-password 속도 제한 | `password-set-ip` 임계 초과 시 429 |
| 7 | rememberMe 전파 | verify-otp에 `rememberMe: false` → set-password 성공 응답의 refresh 쿠키에 `Max-Age` 없음(세션 쿠키). `true`면 `Max-Age=2592000` |
| 8 | 전 기기 로그아웃 | 성공 경로에서 `signOut`이 `scope=global`로 호출되고, 그 뒤 `signInWithPassword`로 새 세션이 발급됨 |
| 8b | signOut scope 전달 | `supabase.js`의 `signOut({scope:"global"})`이 `/auth/v1/logout?scope=global`을 실제로 요청함 (인자 무시 회귀 방지) |
| 9 | 미들웨어 CSRF 분리 | `/api/community/auth/set-password`가 CSRF 헤더 없이 POST되면 403. 트레일링 슬래시(`.../set-password/`)에서도 동일 판정 |
| 10 | 미들웨어 인증 면제 유지 | set-password가 액세스 쿠키 없이도 401을 받지 않고 핸들러에 도달 |
| 11 | 로그인 열거 방지 | 존재·미존재 계정의 응답 본문과 상태코드 동일 (`login-password` 회귀) |
| 12 | 마이그레이션 위생 | 정규화된 (타임스탬프, slug) 중복 파일 검출 |
| 13 | 공개 DTO | 모든 목록·상세·댓글 응답에 email·UUID·token 부재 (기존 테스트 확장) |

기존 테스트의 mock 스타일(`vi.hoisted` + `vi.mock`으로 `_lib/supabase`, `_lib/request-security`, `_lib/api-security`, `_lib/session`을 대체)을 따르십시오. `functions/api/community/auth/verify-otp.test.ts`가 좋은 템플릿입니다.

# 5. 작업 방식 — 과거 실패에서 나온 규칙

이 저장소에서 여러 에이전트가 작업하며 **실제로 발생한 사고**입니다. 반복하지 마십시오.

- **증분 편집 엄수.** 기존 코드를 통째로 덮어쓰거나 지우고 새로 쓰지 마십시오. 필요한 최소한의 라인만 정밀하게 수정하십시오.
- **PowerShell 인라인 문자열로 소스 파일을 생성·수정하지 마십시오.** 이스케이프 문제로 한글이 깨지고 파일이 반복 손상된 전례가 있습니다. 에디터 도구나 Python/Node 스크립트를 쓰고 UTF-8로 저장하십시오.
- **정규식 일괄 치환으로 기존 파일을 수정하지 마십시오.** 그 과정에서 `functions/api/briefings/latest.js`의 핵심 로직이 통째로 유실된 전례가 있습니다.
- **`git checkout -- <file>`로 되돌린 뒤 재적용하는 패턴을 쓰지 마십시오.** 위 유실이 그 경로에서 발생했습니다.
- **API Contract 보존.** 프론트엔드가 소비 중인 기존 응답 구조(카멜 케이스 등)를 망가뜨리지 마십시오. 이번에 의도적으로 바꾸는 계약은 `verify-otp` 응답 본문 하나뿐이며, 그에 맞춰 클라이언트도 같은 PR에서 수정합니다.
- **테스트 없이 "완료"를 보고하지 마십시오.** 직전 인계에서 신규 테스트를 0개 작성한 채 기존 테스트 통과를 근거로 완료 보고가 나왔는데, 실제로는 새 코드가 한 줄도 실행되지 않은 상태였고 런타임에서 즉시 실패하는 결함이 그대로 남아 있었습니다.
- **빌드 통과는 검증이 아닙니다.** 실제 요청을 보내 응답을 확인한 증빙을 제시하십시오.
- 확신이 서지 않으면 임의 결정하지 말고 **작업을 멈추고 질문**하십시오.

# 6. 검증과 배포

## 로컬

```bash
npm test
npm run lint
npm run build
```

세 개를 **실제로 끝까지 실행**하고 결과를 보고하십시오. 백그라운드 진행 중인 상태로 완료 보고를 하지 마십시오.

## Production 스모크 테스트

- 반드시 canonical 도메인 `https://etf-campus.pages.dev/community/` 에서만 하십시오.
- Raw Pages deployment URL은 Turnstile expected hostname과 일치하지 않아 인증이 실패하는 것이 **정상**입니다. 이걸 통과시키려고 hostname 검증을 약화하지 마십시오.
- 테스트는 전용 계정으로 하고, 종료 후 계정·게시물을 정리하십시오.

## 배포 게이트

Production 마이그레이션과 배포는 **명시적 승인이 있을 때만** 실행하십시오. 승인 요청 시 변경 diff, 마이그레이션 영향, 테스트 결과, 롤백 절차를 함께 제시하십시오.

# 7. 산출물

1. 브랜치와 PR URL (`origin/main` 기준 분기, 마켓 브리핑 변경 미포함을 `git diff --stat`으로 증명)
2. 변경 파일 목록과 각 역할
3. 마이그레이션 조사 결과 — DB 적용 이력, 현재 함수 정의 덤프, 확정한 정본, 제거한 파일, 재적용 필요 여부
4. 신규 테스트 목록과 실행 결과
5. 실제 요청·응답 기반 검증 증빙 (`Set-Cookie` 헤더 포함, **토큰 값은 마스킹**)
6. 갱신한 기존 테스트 2개의 before/after diff
7. 구현하지 않았거나 위험이 남은 항목을 숨기지 말고 보고
8. **리포트 하단에 `git diff --stat` 출력을 반드시 포함**

# 8. 금지 사항

- 비밀값(API key, service role key, SMTP 자격증명, Turnstile secret, 세션 토큰, OTP)을 코드·로그·테스트 fixture·보고서에 노출하지 마십시오.
- 실제 이용자 이메일·개인정보를 출력하지 마십시오.
- ETF 종목 추천, 매수·매도 신호, 목표가, 수익 보장 문구를 생성하지 마십시오. 이 서비스는 판단 기준 학습이 목적입니다.
- 기존 ETF 데이터 수집·정적 빌드·Cloudflare Pages 배포·`ETF_PRICES` D1을 커뮤니티 작업으로 변경하거나 결합하지 마십시오.
- 커뮤니티 인증을 D1으로 옮기지 마십시오. 별도 단계로 분리된 작업입니다.
- **마켓 브리핑 운영 콘솔 관련 파일을 이 PR에 포함하지 마십시오** (`app/admin/`, `functions/api/admin/`, `functions/api/briefings/`, `functions/_shared/rbac.js`, `migrations/0008*`, `migrations/0009*`, `workers/`).

---

# 부록 A: 이번 범위 밖 백로그

**이번 PR에 포함하지 마십시오.** 위 5건이 끝나고 안정화된 뒤 별도로 진행합니다.

| 항목 | 내용 |
| --- | --- |
| Turnstile 메시지 일반화 | 실패 메시지에 실제 hostname이 노출됩니다 (`HOSTNAME_MISMATCH(${result.hostname})`). 사용자에게는 일반 문구, 실제 값은 서버 로그로 |
| 비밀번호 정책 | 현재 길이 8자 검사뿐입니다. 유출 비밀번호 목록 차단과 이메일·닉네임 동일 문자열 거부 권장 |
| purge cron 증빙 | `supabase/ops/schedule_community_retention.sql`에 pg_cron 등록 스크립트가 **존재합니다**. 설계 공백이 아니라 적용 증빙 공백이므로, Production에서 `cron.job` 등록·실행 이력을 조회해 운영 문서에 기록하고 실패 알림만 보강하면 됩니다 |
| mojibake 정리 | 일부 API 한글 문자열 손상 관찰. 전수 점검 후 UTF-8 회귀 테스트 추가 |
| `.git` lock 정리 | stale lock 파일 30개 이상 누적. 정리 후 재발 방지 |

> 백로그에 있던 **"CSRF 경로 정규화"와 "오류 로깅 축소"는 이번 범위로 승격**되었습니다 (§2.2).

# 부록 B: 문서 정합 — 별도 작업

코드와 SSOT 문서가 어긋나 있습니다. 이번 PR에서 코드를 문서에 맞추지 **마십시오.** 문서를 개정할 사안입니다.

| 문서 | 기재 내용 | 실제 코드 |
| --- | --- | --- |
| `docs/community/adr/ADR-001` (ADR-001-B) | "비밀번호·매직 링크 없이 이메일 **6자리** OTP" | `OTP_PATTERN = /^\d{8}$/` (**8자리**) + 비밀번호 로그인 존재 |
| `docs/community/06_ssot_decision_log.md` (PEND-001) | "이메일 6자리 OTP" | 동일 |
| `06_ssot_decision_log.md` (COM-011) | "서비스가 비밀번호를 직접 저장하지 않는다" | **여전히 유효** — Supabase가 해시를 관리하며 서비스는 평문을 저장하지 않음 |

개정 시 COM-011의 구분(평문 미저장 원칙은 유효, 비밀번호 로그인 자체는 도입됨)을 명시하십시오.

# 부록 C: 운영자 결정 대기 항목

- 비밀번호 최소 길이 (8자 유지 / 10자 상향)
- Preview/Raw URL 인증 허용 정책
- 신고·모더레이션을 지금 구현할지, 이메일 접수로 시작할지
- admin 단일 계정 운영 리스크 (ADR-001-F는 TOTP MFA 필수를 명시 — 적용 증빙 필요, break-glass·권한 회수 절차)
