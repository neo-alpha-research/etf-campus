# Antigravity 후속 지시문 (Round 3) — 마무리 punch list

작성일 2026-08-20 · 대상 브랜치 `fix/community-auth-hardening` (워크트리 `D:\etf-campus-community-fix`)
선행 문서: `Antigravity_Prompt_Community_Security_Fixes_20260820.md`, `..._Round2_20260820.md`

---

# 0. Round 2 검증 결과 — 대부분 통과

실제 소스를 열어 대조했습니다. **Round 2의 핵심 지적사항은 제대로 해결됐습니다.** 아래는 유지하십시오.

| 항목 | 확인 |
| --- | --- |
| F-2 (503→429 둔갑) | `if (tokenLimit.status === 429)` 분기로 정확히 수정 ✅ |
| F-3 (CSRF 덮어쓰기) | Option B — `if (PUBLIC_AUTH_PATHS.has(pathname)) return response;` ✅ |
| F-4 (refreshToken 제거) | pwsetup 페이로드가 `{accessToken, rememberMe}`만 봉인 ✅ |
| F-6 (BOM) | `set-password.test.ts`·신규 마이그레이션 모두 BOM 없음 ✅ |
| **S-1~S-9** | `_lib/session.test.ts`가 **`_lib/session`을 mock하지 않고 직접 import**. 왕복·URL-safe·null 안전·refreshToken 부재까지 실물 검증 ✅ |
| **T-1 (C-2)** | `set-password.test.ts`에서 `_lib/session` mock을 걷어내고 **실제 base64url 쿠키**로 호출. `rememberMe:true`→`Max-Age=2592000`, `false`→`Max-Age` 부재 양쪽 커버 ✅ |
| T-2/T-3 | IP 제한 원본 429 반환, 토큰 제한 503 유지 회귀 테스트 ✅ |
| T-5~T-10 | `supabase.test.ts`(scope 전달), `_middleware.test.ts`(T-6~T-9), `login-password.test.ts`(열거 방지) ✅ |
| 마이그레이션 한글 | `'^[0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ_.-]+$'` 손상 없음, PowerShell 따옴표 이스케이프도 정상 해제됨 ✅ |

Round 1의 "mock이 mock을 검증하던" 문제는 해소됐습니다. 이제 신규 코드가 실제로 실행됩니다.

**남은 것은 아래 4건입니다.** 새 기능을 추가하지 말고 이것만 정확히 처리하십시오.

# 1. R3-1 (High) — 마이그레이션이 `search_path`를 원본과 다르게 바꿨습니다

신규 파일 `20260820000001_community_function_qualification_fix.sql`이 **요청하지 않은 변경**을 포함하고 있습니다.

| 함수 | 원본 (`20260815000001_community_phase2.sql`) | 신규 파일 |
| --- | --- | --- |
| `create_community_post` | `set search_path = ''` | `set search_path = ''` ✅ 일치 |
| `update_community_post` | `set search_path = ''` | `set search_path = ''` ✅ 일치 |
| `current_community_role` | **`set search_path = public`** (197행) | **`set search_path = ''`** ❌ 변경됨 |
| `bootstrap_community_profile` | **`set search_path = public`** (273행) | **`set search_path = ''`** ❌ 변경됨 |

Round 2 지시문의 "각 함수의 `security definer set search_path = ''`, `revoke`/`grant` 구문을 **원본과 동일하게** 유지"는 **"원본이 가진 값을 그대로 옮겨라"**는 뜻이었습니다. `create_community_post` 계열이 마침 `''`였을 뿐, 모두 `''`로 통일하라는 의미가 아니었습니다.

**왜 문제인가**

이 마이그레이션의 목적은 **중복 파일이 덮어쓴 컬럼 한정을 되돌리는 것**입니다. `search_path` 변경은 그 목적 밖이고, 다음 세 가지가 겹칩니다.

1. `current_community_role()`은 `create_community_post`·`update_community_post`가 매번 호출하는 **글쓰기 경로의 핵심 함수**입니다. 여기서 이름 해석이 실패하면 커뮤니티 글쓰기 전체가 죽습니다.
2. 이 저장소의 테스트는 파일 텍스트만 검사합니다. **실제 DB에 적용해 보는 테스트가 없으므로 이 변경은 검증 수단이 없습니다.**
3. 이 마이그레이션은 Production에 적용될 예정입니다. 롤백은 또 한 번의 마이그레이션을 의미합니다.

본문을 읽어보면 두 함수 모두 `public.` 한정과 `auth.uid()` 한정이 되어 있어 `''`에서도 동작할 가능성이 높습니다. **그러나 "높다"로 운영 DB를 바꾸지 않습니다.** 하드닝이 필요하다면 검증 수단을 갖춘 별도 PR에서 하십시오.

**수정 방향**

`current_community_role`과 `bootstrap_community_profile`의 `set search_path`를 **`public`으로 되돌리십시오.** 원본 `20260815000001_community_phase2.sql`의 192~203행·265~305행과 **속성 줄이 글자 단위로 일치**해야 합니다. 달라져도 되는 것은 컬럼 한정(`public.community_user_roles.role`)뿐입니다.

수정 후, 신규 파일의 각 함수 정의와 원본의 해당 정의를 diff해 **차이가 컬럼 한정뿐임을 리포트에 제시**하십시오.

# 2. R3-2 (High) — F-1 복구 분기가 한글 문구 문자열 매칭에 의존합니다

`set-password.js`는 구조화된 신호를 보냅니다.

```js
JSON.stringify({ error: { code: "UNAVAILABLE", message: "..." }, passwordChanged: true })
```

그런데 `lib/community/browser-client.ts`의 `communityFetch`가 이렇게 던집니다.

```js
if (!response.ok) throw new Error(body?.error?.message ?? "요청을 처리하지 못했습니다.");
```

**`passwordChanged` 플래그도, `code`도, `status`도 전부 버려집니다.** 그래서 클라이언트가 이렇게 되어 있습니다.

```js
if (errorMessage.includes("정상 변경되었습니다") || errorMessage.includes("비밀번호는 변경되었으나")) {
  setStep("login");
}
```

문제 세 가지.

1. **문구를 한 글자만 고쳐도 복구 분기가 조용히 죽습니다.** 그리고 이 분기가 죽는 순간은 "비밀번호는 이미 바뀌었고 전 기기 세션은 이미 폐기되었으며 재로그인도 실패한" 최악의 시점입니다. 사용자는 로그인 화면으로 가지 못한 채 에러 문구만 보고 비밀번호 재설정을 반복하게 됩니다.
2. 두 번째 조건 `"비밀번호는 변경되었으나"`는 **Round 1의 옛 문구**입니다. 현재 서버 어디에도 없는 죽은 코드입니다.
3. 서버가 `passwordChanged: true`를 실어 보내는 수고가 **아무 데서도 쓰이지 않습니다.**

**수정 방향**

`communityFetch`가 구조화된 오류를 전달하도록 최소 확장하십시오.

```js
if (!response.ok) {
  const error = new Error(body?.error?.message ?? "요청을 처리하지 못했습니다.");
  error.status = response.status;
  error.code = body?.error?.code;
  error.body = body;
  throw error;
}
```

그리고 `supabase-auth-flow.tsx`에서 **`error.body?.passwordChanged === true`로 분기**하십시오. 한글 문구 매칭 두 줄은 제거합니다.

`communityFetch`는 커뮤니티 전 경로가 쓰는 공용 함수이므로, **기존 호출부가 `error.message`만 읽고 있는지 확인**하고 회귀가 없음을 보이십시오 (Error 인스턴스에 속성을 더하는 것이므로 기존 동작은 유지됩니다).

**테스트**: 재로그인 실패 시나리오에서 클라이언트가 `login` 단계로 전환되는지 검증하십시오. `components/community/__tests__/`의 기존 컴포넌트 테스트 패턴을 따르십시오.

# 3. R3-3 (Medium) — 손으로 만든 503 응답이 보안 헤더를 빠뜨립니다

`set-password.js`의 F-1 분기만 `errorResponse`를 쓰지 않고 `new Response(...)`를 직접 만듭니다.

```js
const response = new Response(
  JSON.stringify({ error: {...}, passwordChanged: true }),
  { status: 503, headers: { "Content-Type": "application/json" } }
);
```

`api-security.ts`의 `errorResponse`/`jsonResponse`는 **모든 응답에 `Cache-Control: no-store`와 `X-Content-Type-Options: nosniff`를 붙입니다.** 이 분기만 둘 다 없습니다. 비밀번호가 방금 바뀐 계정의 응답이 중간 캐시에 남을 수 있고, 저장소 전체의 오류 응답 규약에서 혼자 이탈합니다.

**수정 방향**: `api-security.ts`의 `jsonResponse(body, status)`를 재사용하십시오. 이 함수는 임의 본문과 상태 코드를 받으면서 두 헤더를 보장합니다.

```js
const response = jsonResponse(
  { error: { code: "UNAVAILABLE", message: "비밀번호는 정상 변경되었습니다. 새 비밀번호로 다시 로그인해 주세요." }, passwordChanged: true },
  503,
);
```

**테스트**: 이 분기의 응답에 두 헤더가 있는지 단언을 추가하십시오 (기존 F-1 테스트 확장).

# 4. R3-4 (Medium) — 테스트가 구현을 복사해 쓰고 있습니다

`set-password.test.ts` 32~34행과 `session.test.ts` 9~13행이 `encodeBase64Url`/`decodeBase64Url`을 **테스트 파일 안에 복사해** 두고 있습니다.

```js
// set-password.test.ts 안의 사본
function encodeBase64Url(str) {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, ...
}
```

인코딩 방식을 바꾸면 **구현과 사본이 갈라지고, 테스트는 옛 방식으로 계속 통과하는데 운영은 깨집니다.** 지금 검증하려는 대상이 바로 쿠키 인코딩이므로 이 결합은 특히 위험합니다.

**수정 방향** (구현 변경 없이 테스트만 정리)

- `set-password.test.ts`: 사본을 지우고 **실제 `passwordSetupHeaders`로 쿠키를 만든 뒤 `Set-Cookie`에서 값을 추출**해 요청 `Cookie` 헤더로 쓰십시오. 그러면 verify-otp → set-password 왕복이 실제 구현으로 이어집니다.
- `session.test.ts`: 페이로드 내용 확인이 목적인 곳(S-9 등)은 사본 대신 **`readPasswordSetup`의 반환값**을 단언하십시오. 사본 디코더가 꼭 필요하면 `session.js`에서 두 helper를 export하고 테스트가 그것을 import하십시오.

# 5. 산출물 — 2라운드 연속 누락된 항목이 있습니다

Round 1·2 모두 요구했으나 제출되지 않았습니다. **이번에는 반드시 포함하십시오.**

## 5.1 PR URL

`origin/main` 대상 PR을 생성하고 URL을 제시하십시오. 2회 연속 누락입니다.

## 5.2 `git diff origin/main --stat` 전체 출력

Round 2 리포트에 없었습니다. **마켓 브리핑 파일이 섞이지 않았음을 증명하는 유일한 수단**입니다.

## 5.3 `npm test` 실제 출력

"233개 항목 모두 통과"라고만 보고됐습니다. **터미널 출력 원문**(테스트 파일 목록과 통과/실패 수가 보이는 마지막 20줄)을 붙이십시오. `npm run lint`, `npm run build`도 동일합니다.

## 5.4 walkthrough 문서 위치

`C:\Users\kibae\.gemini\antigravity\brain\...\walkthrough.md`는 저장소 밖이라 PR 리뷰어와 향후 에이전트가 볼 수 없습니다. **`docs/community/` 안으로 옮기고 PR에 포함**하십시오.

## 5.5 실제 요청·응답 증빙 — 과대 보고를 정정하십시오

Round 2 리포트는 "Cloudflare 환경에서도 헤더 및 쿠키 파싱 로직이 죽지 않고 계약대로 정확히 반환하는 것을 최종 검증했습니다"라고 적었습니다. 그러나 실제로 얻은 응답은 **`400 VALIDATION_ERROR`(짧은 비밀번호)와 `503 CONFIGURATION_ERROR`(로컬 환경변수 부재)** 두 가지뿐입니다.

Round 2 §3이 요구한 5개 중 실제로 확보된 것은 없습니다.

| # | 요구 | 상태 |
| --- | --- | --- |
| 1 | verify-otp 200 + pwsetup 쿠키 + CSRF 헤더 | ❌ 미확보 |
| 2 | set-password 200 + 세션 쿠키 + pwsetup 만료 | ❌ 미확보 (503) |
| 3 | 재실행 429 | ❌ 미확보 |
| 4 | CSRF 없이 403 | ❌ 미확보 |
| 5 | `rememberMe:false`에서 `Max-Age` 부재 | ❌ 미확보 |

**503이 나온 것 자체는 정상입니다.** 로컬에 Supabase 자격증명과 `COMMUNITY_RATE_LIMIT_SALT`가 없으니 당연합니다. 문제는 그것을 "계약대로 검증됨"으로 보고한 것입니다.

**이번 라운드에서 할 일은 둘 중 하나입니다.**

- (A) `.dev.vars`에 Preview용 Supabase·Turnstile·rate-limit salt를 넣고 `npx wrangler pages dev`로 5개를 실제로 확보한 뒤, **토큰·쿠키 값을 앞 8자만 남기고 마스킹**해 원문 헤더를 붙이십시오. 자격증명은 운영자에게 요청하십시오 — 임의로 만들어 넣지 마십시오.
- (B) 로컬에서 확보 불가능하다고 판단되면, **"미확보"라고 그대로 적고 무엇이 없어서 막혔는지 명시**하십시오. 그 경우 Preview 배포 후 확보하는 것으로 계획을 제시하십시오.

**(B)를 선택해도 감점이 아닙니다. 확보하지 못한 것을 확보했다고 쓰는 것만이 문제입니다.**

# 6. 절차 — 반복 위반 중입니다

- 마이그레이션 SQL을 **또 PowerShell 인라인 문자열(`Set-Content -Value '...'`)로 생성**했습니다. 이번엔 한글과 따옴표가 살아남았지만, Round 1·2 지시문이 모두 금지한 방법입니다. 게다가 리포트에는 "작성 도구를 사용하여 BOM 없이 생성했다"고 적혀 있어 **실제 수행과 보고가 다릅니다.**
- 앞으로 소스·SQL 파일 생성·수정은 에디터 도구나 Node/Python 스크립트만 쓰십시오.
- 리포트는 **수행한 명령과 일치**해야 합니다. 방법을 바꿨으면 바꿨다고 쓰십시오.

# 7. 변경하지 말 것

- §0 표의 통과 항목을 되돌리지 마십시오
- 기존 테스트를 삭제·skip·완화하지 마십시오
- 마켓 브리핑 관련 파일(`app/admin/`, `functions/api/admin/`, `functions/api/briefings/`, `functions/_shared/rbac.js`, `migrations/0008*`, `migrations/0009*`, `workers/`)을 이 PR에 넣지 마십시오
- `ETF_PRICES` D1, ETF 데이터 수집·정적 빌드·배포 파이프라인을 건드리지 마십시오
- 비밀값(service role key, Turnstile secret, SMTP 자격증명, 세션 토큰, OTP)을 코드·로그·테스트 fixture·리포트에 노출하지 마십시오. `.dev.vars`는 `.gitignore`에 있는지 확인하고 커밋하지 마십시오
- 이번 범위 밖 백로그(Turnstile 메시지 일반화, 비밀번호 정책 강화, pg_cron 증빙, mojibake 전수 점검)를 손대지 마십시오
- 확신이 서지 않으면 임의 결정하지 말고 **멈추고 질문**하십시오
