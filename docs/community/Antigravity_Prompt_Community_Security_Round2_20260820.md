# Antigravity 후속 지시문 (Round 2) — 커뮤니티 인증 보안 수정 검증 결과

작성일 2026-08-20 · 대상 브랜치 `fix/community-auth-hardening` (워크트리 `D:\etf-campus-community-fix`)
선행 문서: `docs/community/Antigravity_Prompt_Community_Security_Fixes_20260820.md`

---

# 0. 먼저 — Round 1 검증 결과

Round 1 결과물을 **실제 소스로 대조 검증**했습니다. 핵심 5건의 수정 방향은 모두 올바릅니다. 아래는 확인된 사실입니다.

## 통과 항목 (그대로 유지하십시오)

| 항목 | 확인 내용 |
| --- | --- |
| C-1 | `verify-otp.js` 응답 본문에서 `tempAccessToken`/`tempRefreshToken` 완전 제거, `passwordSetupHeaders`로 대체 ✅ |
| C-1 클라이언트 | `supabase-auth-flow.tsx`에서 두 state 완전 제거, set-password body는 `{password, captchaToken}` ✅ |
| C-2 | `sessionHeaders(signInData.session, undefined, setupData.rememberMe)` ✅ |
| H-1 | Turnstile(`community_password_set`) + `password-set-ip`(10/600s) + `password-set-token`(1/600s) ✅ |
| H-2 | body 토큰 경로 완전 제거, `readPasswordSetup` 쿠키 게이트만 신뢰, global signOut 후 재로그인 ✅ |
| H-3 파일 | 언더스코어 버전 2개 제거, 정본 4개만 잔존 ✅ |
| signOut scope | `supabase.js`가 `?scope=global`을 실제로 전송 ✅ |
| 미들웨어 | `PUBLIC_AUTH_PATHS` / `CSRF_EXEMPT_PATHS` 분리 + 정규화 경로 사용 ✅ |
| base64url | `encodeBase64Url`/`decodeBase64Url` 왕복을 Node에서 직접 실행해 검증 — JWT·한글 모두 정상, URL-safe 문자만 출력 ✅ |
| 인코딩 | PowerShell로 생성한 `set-password.test.ts`의 한글 문자열 손상 없음 ✅ |

**절차 위반 2건** (이번엔 사고로 이어지지 않았으나 기록합니다): 금지된 PowerShell 인라인 문자열로 소스 파일을 생성했고, H-3에서 "DB 이력 확인 후 삭제" 순서를 뒤집어 파일부터 삭제했습니다. 다음 라운드에서는 지키십시오.

## ⚠️ 그러나 — §5 "실제 요청·응답 기반 검증 증빙"은 성립하지 않습니다

리포트 §5에 증빙으로 제시한 코드는 `verify-otp.test.ts`의 단언인데, 같은 파일에서 `_lib/session`을 이렇게 mock하고 있습니다.

```ts
vi.mock("../_lib/session", () => ({
  passwordSetupHeaders: () => {
    const headers = new Headers();
    headers.append("Set-Cookie", "__Host-etf-campus-community-pwsetup=mock; HttpOnly; Secure; Max-Age=600");
    headers.set("X-Community-CSRF", "mock-csrf");
    return headers;
  },
}));
```

즉 `expect(setCookie).toContain("Max-Age=600")`과 `expect(csrfHeader).toBe("mock-csrf")`는 **mock이 하드코딩한 문자열을 다시 읽은 것**이지 구현을 검증한 것이 아닙니다. `set-password.test.ts`도 `readPasswordSetup`·`clearPasswordSetupHeaders`·`sessionHeaders`를 전부 mock합니다.

**결과적으로 이번에 새로 작성한 `session.js` 코드 — `passwordSetupHeaders`, `readPasswordSetup`, `clearPasswordSetupHeaders`, `encodeBase64Url`, `decodeBase64Url` — 는 테스트에서 단 한 줄도 실행되지 않습니다.** 이것은 직전 인계에서 문제가 됐던 실패 유형과 정확히 같습니다. mock은 계약을 고정하는 도구지 구현을 검증하는 도구가 아닙니다.

이번 라운드의 최우선 과제는 **`session.js` 실물을 실행하는 테스트**입니다.

# 1. 수정할 결함

## F-1 (High) — `INTERNAL_ERROR`는 허용되지 않은 오류 코드입니다

`set-password.js`:
```js
return errorResponse(500, "INTERNAL_ERROR", "비밀번호는 변경되었으나 자동 로그인에 실패했습니다. 다시 로그인해 주세요.");
```

`api-security.ts`의 `code` 파라미터는 다음 union으로 제한됩니다.
```
"AUTH_REQUIRED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION_ERROR" |
"RATE_LIMITED" | "CAPTCHA_REQUIRED" | "CONFIGURATION_ERROR" | "UNAVAILABLE"
```

`set-password.js`가 `.js`라 TypeScript가 잡아주지 않았을 뿐, **API 오류 코드 계약 위반**입니다. 클라이언트와 향후 모니터링이 알지 못하는 코드가 나갑니다.

더 중요한 건 이 분기의 성격입니다. **여기 도달한 시점에는 비밀번호가 이미 바뀌었고 전 기기 세션이 이미 폐기된 상태**입니다. 사용자는 로그아웃된 채 500을 받습니다.

**수정 방향**
- 코드를 `UNAVAILABLE`로 바꾸고 상태는 `503`으로 낮추십시오 (재시도 가능함을 의미)
- 메시지에 "비밀번호는 정상 변경되었습니다. 새 비밀번호로 다시 로그인해 주세요"를 명확히 담아 사용자가 재설정을 반복하지 않게 하십시오
- 응답 본문에 `passwordChanged: true` 같은 플래그를 추가해 클라이언트가 로그인 화면으로 보내도록 하고, `supabase-auth-flow.tsx`에서 이 분기를 처리하십시오

## F-2 (High) — 속도 제한 503이 429로 둔갑합니다

`set-password.js`:
```js
const tokenLimit = await enforceDatabaseRateLimit(context, "password-set-token", tokenString, 1, 600);
if (tokenLimit) {
  const response = errorResponse(429, "RATE_LIMITED", "이미 사용한 인증입니다. 처음부터 다시 시도해 주세요.");
  ...
}
```

`enforceDatabaseRateLimit`은 **한도 초과 시 429를 반환하지만, RPC 실패·`COMMUNITY_RATE_LIMIT_SALT` 누락 시에는 503 `CONFIGURATION_ERROR`를 반환**합니다. 위 코드는 실제 응답을 버리고 **무조건 429 "이미 사용한 인증입니다"로 덮어씁니다.**

운영 영향: 속도 제한 백엔드가 고장 나면 모든 사용자가 "이미 사용한 인증입니다"를 보고 OTP를 무한 반복합니다. 그리고 **운영자는 구성 오류 신호를 잃습니다.**

같은 파일 위쪽의 `ipLimit`은 `return ipLimit`으로 원본을 그대로 돌려주고 있어 일관성도 깨집니다. `request-security.js`의 `verifyTurnstile`은 이미 올바른 패턴을 보여줍니다.

```js
const replayError = await enforceDatabaseRateLimit(context, "turnstile-token", token, 1, 600);
if (replayError) {
  if (replayError.status === 429) {
    return errorResponse(400, "CAPTCHA_REQUIRED", "이미 사용했거나 만료된 보안 확인입니다. 다시 시도해 주세요.");
  }
  return replayError;   // ← 503은 그대로 통과
}
```

**수정 방향**: `tokenLimit.status === 429`일 때만 메시지를 갈아끼우고, 그 외에는 `tokenLimit`을 그대로 반환하십시오 (쿠키 만료 헤더는 유지).

## F-3 (High) — 로그인 상태에서 재설정하면 CSRF 토큰이 어긋납니다

`set-password`는 `PUBLIC_AUTH_PATHS`에 있어 인증이 필수가 아니지만, **액세스 쿠키를 가진 사용자가 호출하면** `_middleware.js`가 이 경로를 탑니다.

```js
if (!required && !tokens.accessToken) return context.next();   // ← 로그인 상태면 여기서 안 빠짐
const session = await authenticatedSession(context);
...
return mergeSessionHeaders(response, session);
```

`mergeSessionHeaders` → `responseWithHeaders`는 이렇게 동작합니다.

```js
const merged = new Headers(response.headers);
for (const [key, value] of headers.entries()) merged.set(key, value);   // ← set, 덮어쓰기
```

`session.headers`는 `cacheHeaders(기존_CSRF_토큰)`이므로 **핸들러가 `sessionHeaders`로 새로 발급한 `X-Community-CSRF` 헤더를 옛 토큰으로 덮어씁니다.** 결과: **쿠키에는 새 토큰, 응답 헤더에는 옛 토큰**. 클라이언트 `acceptCsrf()`가 옛 토큰을 저장하고, 다음 mutation에서 `enforceCsrf`가 불일치를 잡아 **403**을 냅니다.

재현 경로: 로그인 상태에서 비밀번호 재설정 → 성공 → 글쓰기/댓글 시도 → 403. 사용자는 새로고침해야 풀립니다.

> 이 구조는 `login-password`에도 동일하게 존재하던 잠재 결함이지만, 이번 변경으로 `set-password`가 실제로 이 경로를 타게 되면서 현실화됐습니다.

**수정 방향** (둘 중 택1, 판단 후 근거와 함께 보고)
- (A) `mergeSessionHeaders`가 `X-Community-CSRF`와 `Set-Cookie`에 대해서는 **핸들러 응답을 우선**하도록 하십시오. 미들웨어 값은 핸들러가 해당 헤더를 설정하지 않은 경우에만 적용합니다.
- (B) 인증 계열 경로(`PUBLIC_AUTH_PATHS`)는 핸들러가 세션을 스스로 관리하므로, 미들웨어가 `mergeSessionHeaders`를 적용하지 않고 `context.next()` 응답을 그대로 반환하도록 분기하십시오.

(B)가 변경 범위가 작고 의도도 명확합니다. 다만 어느 쪽이든 **회귀 테스트를 반드시 붙이십시오.**

## F-4 (Medium) — pwsetup 쿠키에 refresh token을 담을 이유가 없습니다

`passwordSetupHeaders`는 `{ accessToken, refreshToken, rememberMe }`를 봉인하는데, `set-password.js`는 `setupData.accessToken`과 `setupData.rememberMe`만 씁니다. **`refreshToken`은 어디에서도 읽지 않습니다.**

성공 경로가 `signOut({scope:"global"})` → `signInWithPassword`로 새 세션을 받으므로 구조적으로 필요가 없습니다. C-1이 "장기 자격증명의 노출 지점을 줄이자"는 수정인 이상, 쓰지도 않는 30일짜리 자격증명을 쿠키 하나에 더 넣어 두는 것은 방향에 어긋납니다.

**수정 방향**: 페이로드에서 `refreshToken`을 제거하십시오. `{ accessToken, rememberMe }`만 남깁니다. 쿠키 크기도 줄어듭니다.

## F-5 (Medium) — H-3 파일 삭제만으로는 운영 DB가 고쳐지지 않습니다

리포트 §3에서 스스로 지적한 대로, **운영 DB에 언더스코어 버전이 마지막으로 적용됐다면 변수 섀도잉 방지가 풀린 함수 정의가 지금도 살아 있습니다.** 파일 삭제는 향후 재적용을 막을 뿐 현재 상태를 바꾸지 않습니다.

DB 접근 권한이 없어 조회를 못 한 것은 이해합니다. 그러나 **조회 없이도 안전하게 정정하는 방법이 있습니다.**

**수정 방향**: 신규 마이그레이션 `supabase/migrations/20260820000001_community_function_qualification_fix.sql`을 추가하십시오.

- `20260815000002_community_security_hardening.sql`에 있는 **한정된 버전의 `create_community_post`·`update_community_post` 정의를 그대로 복사**해 `create or replace function`으로 재선언
- `20260815000001_community_phase2.sql`의 한정된 `community_user_roles.role` 참조 부분(200행·301행 해당 함수)도 동일하게 처리
- 각 함수의 `security definer set search_path = ''`, `revoke`/`grant` 구문을 **원본과 동일하게** 유지 — 권한이 리셋되지 않도록 주의
- 파일 상단에 이 마이그레이션의 목적(중복 파일로 인한 덮어쓰기 정정, 멱등)을 주석으로 명시

이렇게 하면 DB 이력이 어느 쪽이었든 **최종 상태가 한정 버전으로 수렴**합니다. `create or replace`이므로 이미 올바른 DB에 적용해도 무해합니다.

작성 후 §2의 마이그레이션 위생 테스트를 다시 돌려 새 파일이 중복 판정에 걸리지 않는지 확인하십시오.

## F-6 (Low) — BOM 제거

`functions/api/community/auth/set-password.test.ts`가 UTF-8 BOM(`EF BB BF`)으로 시작합니다. PowerShell 5.1의 `-Encoding UTF8`이 붙인 것입니다. 동작은 하지만 이 저장소에는 이미 `0bdd170 fix(tests): restore correct encoding for etf-repository.test.ts` 전례가 있습니다.

**수정 방향**: BOM 없는 UTF-8로 다시 저장하십시오. 그리고 **PowerShell 인라인 문자열로 소스 파일을 만들지 마십시오** — 에디터 도구나 Node/Python 스크립트를 쓰십시오.

# 2. 필수 추가 테스트

Round 1에서 요구한 13개 중 실제로 구현된 것은 4개입니다. **아래를 채우십시오.**

## 2.1 최우선 — `session.js` 실물 계약 테스트 (신규 파일)

`functions/api/community/_lib/session.test.ts`를 만들고 **`_lib/session`을 mock하지 말고 직접 import**하십시오. 이 파일에서만큼은 구현이 실제로 돌아야 합니다.

| # | 검증 |
| --- | --- |
| S-1 | `passwordSetupHeaders(session, {rememberMe:true})`의 `Set-Cookie`에 `__Host-etf-campus-community-pwsetup=`, `HttpOnly`, `Secure`, `Path=/`, `SameSite=Lax`, `Max-Age=600`이 모두 포함 |
| S-2 | 같은 응답에 CSRF 쿠키(`HttpOnly` 없음)와 `X-Community-CSRF` 헤더가 함께 발급되고 **두 값이 일치** |
| S-3 | 쿠키 값이 URL-safe 문자(`[A-Za-z0-9-_]`)로만 구성됨 — `;` 오염으로 파싱이 깨지지 않음을 보장 |
| S-4 | `passwordSetupHeaders` → `Set-Cookie`에서 값을 추출 → 그 값을 `Cookie` 헤더로 만든 Request → `readPasswordSetup`이 **원본 `accessToken`·`rememberMe`를 그대로 복원** (왕복 테스트). `rememberMe: false`도 별도 케이스로 |
| S-5 | 한글·특수문자가 포함된 페이로드도 왕복 복원됨 (JWT payload에 비ASCII가 들어갈 수 있음) |
| S-6 | 쿠키 없음 / 손상된 base64 / JSON이 아닌 값 → `readPasswordSetup`이 예외 없이 `null` 반환 |
| S-7 | `clearPasswordSetupHeaders()`가 `Max-Age=0`으로 pwsetup 쿠키만 만료시키고 세션 쿠키는 건드리지 않음 |
| S-8 | `COMMUNITY_SESSION_COOKIE_NAMES`에 `PWSETUP_COOKIE`가 포함됨 |
| S-9 | F-4 적용 후: 쿠키 페이로드를 디코딩했을 때 **`refreshToken` 키가 존재하지 않음** |

## 2.2 Round 1에서 누락된 항목

| # | 시나리오 | 검증 |
| --- | --- | --- |
| T-1 | **rememberMe 전파 (C-2 — 현재 검증 0)** | `readPasswordSetup`을 mock하지 말고 실제 pwsetup 쿠키를 담은 Request로 `set-password`를 호출. `rememberMe:false`면 refresh 쿠키에 `Max-Age`가 없고, `true`면 `Max-Age=2592000` |
| T-2 | `password-set-ip` 속도 제한 | 임계 초과 시 429가 **원본 그대로** 반환됨 |
| T-3 | F-2 회귀 | `password-set-token` 호출이 503을 반환하면 응답도 503 `CONFIGURATION_ERROR`이며 "이미 사용한 인증입니다"로 바뀌지 않음 |
| T-4 | F-1 회귀 | 재로그인 실패 분기가 허용된 코드(`UNAVAILABLE`)를 쓰고, 본문이 "비밀번호는 변경되었다"는 사실을 전달함 |
| T-5 | signOut scope 전달 | `supabase.js`의 `signOut({scope:"global"})`이 `/auth/v1/logout?scope=global`을 요청 (`fetch`를 mock해 URL 확인) |
| T-6 | 미들웨어 CSRF 분리 | `/api/community/auth/set-password`를 CSRF 헤더 없이 POST → 403. `/api/community/auth/login-password`는 CSRF 헤더 없이도 통과 |
| T-7 | 미들웨어 트레일링 슬래시 | `.../set-password/`도 `.../set-password`와 동일 판정 (CSRF 요구·인증 면제 모두) |
| T-8 | 미들웨어 인증 면제 유지 | set-password가 액세스 쿠키 없이 401을 받지 않고 핸들러에 도달 |
| T-9 | F-3 회귀 | 액세스 쿠키를 가진 요청으로 set-password 성공 시, **응답의 `X-Community-CSRF` 값과 CSRF 쿠키 값이 일치**함 |
| T-10 | 로그인 열거 방지 | `login-password`에서 존재·미존재 계정의 상태코드와 본문이 동일 |
| T-11 | 공개 DTO | 목록·상세·댓글 응답에 email·UUID·token 부재 (기존 테스트 확장) |

**mock 사용 원칙**: 외부 경계(`_lib/supabase`, `_lib/request-security`)는 mock해도 됩니다. **이번 PR에서 새로 작성하거나 수정한 코드(`_lib/session`의 pwsetup 함수, `_middleware.js`, `supabase.js`의 signOut)는 mock하지 말고 실제로 실행하십시오.**

# 3. 실제 요청·응답 증빙 — 이번엔 반드시 수행

Round 1의 `npx wrangler pages dev .build`는 **디렉터리가 틀렸습니다.** `wrangler.toml`에 `pages_build_output_dir = "out"`이 지정되어 있으므로 인자 없이 실행하면 됩니다.

```bash
npm run build
npx wrangler pages dev
```

로컬 dev 서버에서 아래를 실제로 호출하고 **원문 응답 헤더**를 캡처해 리포트에 넣으십시오.

1. `POST /api/community/auth/verify-otp` → 응답 본문에 토큰 문자열 없음 + `Set-Cookie`에 pwsetup 쿠키 + `X-Community-CSRF` 헤더
2. `POST /api/community/auth/set-password` (pwsetup 쿠키 + CSRF 헤더 포함) → 200 + 세션 쿠키 발급 + pwsetup 쿠키 만료
3. 같은 요청 재실행 → 429
4. CSRF 헤더 없이 `POST /api/community/auth/set-password` → 403
5. `rememberMe:false`로 시작한 흐름의 refresh 쿠키에 `Max-Age` 부재

**토큰·쿠키 값은 앞 8자만 남기고 마스킹하십시오.** 로컬 환경 변수가 없어 일부 단계가 503으로 막히면, **막힌 지점과 이유를 그대로 보고**하십시오. 통과한 것처럼 쓰지 마십시오.

Production 스모크 테스트는 canonical 도메인 `https://etf-campus.pages.dev/community/` 에서만 하고, Raw Pages URL이 Turnstile hostname 불일치로 실패하는 것은 **정상 동작**이므로 검증을 약화시키지 마십시오.

# 4. 산출물

1. F-1~F-6 각각의 수정 내용과 근거
2. F-3에서 (A)/(B) 중 무엇을 골랐는지와 이유
3. 신규 테스트 파일 목록과 **각 테스트가 mock이 아닌 실제 구현을 실행함을 보이는 근거** (해당 파일에서 `_lib/session`을 mock하지 않았음을 diff로 제시)
4. `npm test` / `npm run lint` / `npm run build` 전체 출력 (끝까지 실행)
5. §3의 실제 요청·응답 캡처 (마스킹 적용). 수행하지 못한 항목은 이유와 함께 명시
6. 신규 마이그레이션 파일 내용과 멱등성 근거
7. PR URL — **Round 1에서 누락됐습니다.** `origin/main` 대상으로 PR을 생성하고 URL을 제시하십시오
8. `git diff origin/main --stat` 출력
9. 남은 위험과 미구현 항목 — 숨기지 말고 보고

# 5. 변경하지 말 것

- Round 1에서 통과한 항목(§0 표)의 설계를 되돌리지 마십시오
- 기존 테스트를 삭제·skip·완화하지 마십시오. Round 1에서 승인한 2개 외에는 추가 승인이 없습니다
- 마켓 브리핑 관련 파일(`app/admin/`, `functions/api/admin/`, `functions/api/briefings/`, `functions/_shared/rbac.js`, `migrations/0008*`, `migrations/0009*`, `workers/`)을 이 PR에 넣지 마십시오
- `ETF_PRICES` D1, ETF 데이터 수집·정적 빌드·배포 파이프라인을 건드리지 마십시오
- 비밀값(service role key, Turnstile secret, SMTP 자격증명, 세션 토큰, OTP)을 코드·로그·테스트 fixture·리포트에 노출하지 마십시오
- PowerShell 인라인 문자열로 소스 파일을 생성·수정하지 마십시오
- 정규식 일괄 치환으로 기존 파일을 수정하지 마십시오
- 확신이 서지 않으면 임의 결정하지 말고 **멈추고 질문**하십시오
