# ETF Campus 커뮤니티 작업 인계 프롬프트

작성일 2026-08-20 · 아래 `---` 사이 전문을 그대로 복사해 인계받는 에이전트에게 전달하십시오.
함께 전달할 문서: `docs/community/Review_Community_Auth_Security_20260820.md` (상세 근거)

---

## 역할과 인계 배경

당신은 **기존 `neo-alpha-research/etf-campus` 저장소의 커뮤니티 기능을 이어받아 보안 결함을 수정하는 시니어 엔지니어**입니다.

커뮤니티는 이미 Production에 배포되어 실제 회원이 사용 중입니다. 공개 읽기, 인증 회원 글·댓글 작성, 작성자 소유권 기반 수정·삭제, Supabase RLS/RPC 기반 mutation 통제, Turnstile·속도 제한·탈퇴 모델까지 동작합니다. **새로 만드는 작업이 아니라, 이미 도는 시스템의 결함을 최소 변경으로 고치는 작업입니다.**

직전에 보안 검토가 수행되어 **배포 차단급 결함 5건**이 확인됐습니다. 이번 인계 범위는 그 5건의 수정과 회귀 테스트입니다.

## 0. 검증된 현재 상태

아래는 2026-08-20에 실제 소스를 열어 확인한 사실입니다. 추측하지 말고 이 목록을 기준으로 삼되, 착수 시 한 번 더 확인하십시오.

**아키텍처 경계 (절대 변경 금지)**

- 커뮤니티 데이터는 **Supabase Auth + Supabase Postgres**
- ETF 가격 데이터는 **Cloudflare D1 (`ETF_PRICES`)**
- 이 둘은 장애·권한·개인정보 경계를 분리하기 위해 의도적으로 나뉘어 있습니다. **절대 결합하지 마십시오.**
- 서버 런타임은 Cloudflare Pages Functions (`functions/` 디렉터리)
- Next.js는 `output: "export"` 완전 정적 빌드
- 테스트 러너 vitest (`npm test`), 린트 `npm run lint`, 빌드 `npm run build`

**실재 확인된 핵심 파일**

```
functions/api/community/_middleware.js              인증·CSRF·Origin 게이트 (중앙)
functions/api/community/_lib/session.js             세션 쿠키·CSRF·refresh helper
functions/api/community/_lib/request-security.js    Turnstile·속도 제한
functions/api/community/_lib/api-security.ts        오류 응답 규약
functions/api/community/auth/request-otp.js
functions/api/community/auth/verify-otp.js          ← 수정 대상
functions/api/community/auth/set-password.js        ← 수정 대상
functions/api/community/auth/login-password.js
functions/api/community/auth/session.js
functions/api/community/auth/profile.js
functions/api/community/auth/account.js
functions/api/community/posts/**
components/auth/supabase-auth-flow.tsx              ← 클라이언트 수정 대상
components/community/**
supabase/migrations/**                              ← 중복 파일 문제 있음 (§2)
supabase/ops/schedule_community_retention.sql       pg_cron 등록 스크립트 (존재함)
```

**현재 브랜치 주의**

작업 checkout은 `feat/admin-market-briefing-console`이며 **마켓 브리핑 운영 콘솔의 미완성 작업이 섞여 있습니다.** 그 브랜치에는 별도로 알려진 결함이 있고 이번 인계 범위가 아닙니다.

→ **커뮤니티 수정은 `origin/main`에서 새 브랜치를 파서 진행하고, 마켓 브리핑 변경을 절대 섞지 마십시오.**

**설계상 잘 되어 있는 부분 (유지할 것)**

바꾸지 마십시오. 이미 올바릅니다.

- `_middleware.js`가 unsafe method에 대해 Origin/Referer 동일 출처 → `Content-Type: application/json` 강제 → CSRF 이중 제출을 순서대로 적용
- `needsAuthentication()`이 deny-by-default이고 공개 경로만 allowlist
- 쿠키가 `__Host-` 접두사 + `Secure` + `HttpOnly` + `Path=/`. `__Host-`가 서브도메인 쿠키 주입을 막아 이중 제출 CSRF를 실제로 유효하게 만듦
- CSRF 비교가 상수시간
- 로그아웃이 `signOut({ scope: "global" })`로 refresh token을 서버에서 폐기
- base table 권한 회수 + 공개 view read-only + SECURITY DEFINER RPC로 write 제한 + RLS 2차 방어
- owner RPC가 slug만 반환하고 `author_profile_id`를 공개 DTO에 넣지 않음

## 1. 수정 대상 — 배포 차단 5건

문제는 한 곳에 모여 있습니다. **나중에 덧붙인 비밀번호 흐름이 위 설계 규율을 따라가지 못했습니다.**

### C-1 (Critical) — `verify-otp`가 refresh token을 응답 본문으로 반환

`functions/api/community/auth/verify-otp.js`가 `tempAccessToken`과 `tempRefreshToken`을 JSON 본문으로 내려줍니다. 다른 모든 경로는 토큰을 `__Host-` HttpOnly 쿠키에만 두는데 이 한 곳에서 불변식이 깨집니다.

refresh token은 최대 30일 유효한 장기 자격증명입니다. 사이트 어디든 XSS가 성립하면 **비밀번호를 바꿔도 유지되는 계정 탈취**가 가능합니다. 토큰이 devtools 네트워크 기록·클라이언트 오류 리포팅·중간 프록시 로그에 남을 수도 있습니다.

**수정 방향**: 토큰을 본문으로 반환하지 말고 **단일 목적·단기 HttpOnly 쿠키**(예: `__Host-etf-campus-community-pwsetup`, `Max-Age` 5~10분)로 발급하십시오. `set-password.js`는 body가 아니라 그 쿠키에서 토큰을 읽고, 성공 시 즉시 쿠키를 만료시킵니다. 클라이언트가 토큰을 React state에 보관할 이유가 사라지므로 `components/auth/supabase-auth-flow.tsx`에서도 토큰 보관 코드를 제거하십시오.

부수: `verify-otp.js`는 `rememberMe`를 파싱한 뒤 사용하지 않습니다(죽은 변수). C-2와 함께 정리하십시오.

### C-2 (High) — 사용자의 `rememberMe` 선택이 가입·재설정 경로에서 무시됨

`session.js`의 시그니처는 `sessionHeaders(session, csrfToken = secureRandom(), rememberMe = true)`입니다.

- `login-password.js`는 `sessionHeaders(data.session, undefined, rememberMe)` → 선택 존중 ✅
- `set-password.js`는 `sessionHeaders(session)` → **기본값 `true` 적용** ❌

신규 가입·비밀번호 재설정 사용자는 체크 해제 여부와 무관하게 refresh 쿠키가 30일 유지됩니다. 공용 PC에서 H-2와 결합하면 실질적 계정 탈취 경로가 됩니다.

**수정 방향**: `rememberMe`를 verify-otp → set-password로 전달하고(C-1의 단기 쿠키에 함께 봉인하면 자연스럽습니다) `sessionHeaders` 세 번째 인자로 넘기십시오.

### H-1 (High) — `set-password`만 Turnstile·속도 제한이 없음

`request-otp`, `verify-otp`, `login-password`는 모두 `verifyTurnstile` + `enforceDatabaseRateLimit`(이메일·IP 2중)을 적용합니다. **자격증명을 실제로 변경하는 `set-password`에만 둘 다 없습니다.** 인증 계열에서 가장 민감한 엔드포인트가 가장 무방비인 역전 상태입니다.

**수정 방향**: `community_password_set` action의 Turnstile 검증과 IP·subject 기준 속도 제한을 추가하십시오. 기존 두 helper의 사용 패턴을 그대로 따르면 됩니다.

### H-2 (High) — 로그인 상태에서 현재 비밀번호 확인 없이 비밀번호가 바뀜

`set-password.js`는 전달된 access token으로 `supabase.auth.updateUser({ password })`를 호출할 뿐, **그것이 방금 OTP를 통과한 토큰인지 검증하지 않습니다.** 프로젝트의 유효한 access token이면 무엇이든 통과합니다.

결과적으로 로그인 세션이 살아 있는 브라우저(공용 PC, 분실 기기, 30일 `rememberMe`)에서 현재 비밀번호를 모르는 사람이 비밀번호를 바꿔 계정을 영구 탈취할 수 있습니다. "비밀번호 변경"과 "OTP 기반 재설정"이 한 엔드포인트로 합쳐지면서 재인증 요구 지점이 사라졌습니다.

**수정 방향**: 두 경로를 분리하십시오.

- **재설정**: C-1의 단기 OTP 쿠키가 있을 때만 허용
- **변경**: 로그인 세션 + `currentPassword` 재확인 필수

어느 경로든 성공 후 `signOut({ scope: "global" })`로 기존 세션을 일괄 폐기하고 현재 브라우저만 재발급하십시오.

> **운영자 결정 필요**: 위 두 경로를 모두 제공할지, 아니면 항상 OTP 재인증만 요구할지는 제품 결정입니다. 임의로 정하지 말고 선택지를 제시해 확인받으십시오. 1인 운영·보안 우선이면 "항상 OTP 재인증"이 구현·검증 모두 단순합니다.

### H-3 (High) — 중복 마이그레이션 파일이 보안 수정을 되돌릴 수 있음

`supabase/migrations/`에 **동일 마이그레이션의 이름만 다른 쌍이 2개** 있습니다.

```
20260815000001_community_phase2.sql              20260815_000001_community_phase2.sql
20260815000002_community_security_hardening.sql  20260815_000002_community_security_hardening.sql
```

두 쌍 모두 내용이 **다릅니다.** security_hardening 쌍의 실제 차이는 SECURITY DEFINER 함수 안의 컬럼 참조 한정 여부입니다.

```sql
-- 20260815_000002_ (언더스코어 있음) — 한정 없음
select id into category_uuid from public.community_categories
  where slug = p_category_slug and is_active;

-- 20260815000002_ (언더스코어 없음) — 테이블명으로 한정
select id into category_uuid from public.community_categories
  where public.community_categories.slug = p_category_slug
    and public.community_categories.is_active;
```

한정된 쪽이 PL/pgSQL 변수 섀도잉을 막는 **수정본**으로 보입니다. 그런데 파일명 정렬 시 `'0'(0x30) < '_'(0x5F)`이므로 **언더스코어 버전이 나중에 실행되어 수정본을 덮어쓸 수 있습니다.** `CREATE OR REPLACE FUNCTION`이면 마지막 실행이 이깁니다.

**수정 방향**:

1. 먼저 **Production·Preview DB에서 적용된 마이그레이션 이력을 조회**해 어느 파일이 실제로 적용됐는지 확인하십시오. 파일부터 지우지 마십시오.
2. 현재 DB에 살아 있는 함수 정의를 `pg_get_functiondef`로 덤프해 한정 버전인지 확인하십시오.
3. 정본을 확정하고 stale 파일을 제거하되, 이미 적용 이력이 기록된 파일명을 지우면 도구가 재적용을 시도할 수 있으므로 **사용 중인 마이그레이션 도구의 이력 테이블 동작을 먼저 확인**하십시오.
4. 파일명 중복(동일 타임스탬프·동일 slug) 검출 테스트를 CI에 추가해 재발을 막으십시오.

`20260815000003_community_withdrawal_state_machine.sql`에는 짝이 없습니다. 그 파일은 그대로 두십시오.

## 2. 작업 방식 — 과거 실패에서 나온 규칙

이 저장소에서 여러 에이전트가 작업하며 실제로 발생한 사고입니다. 반복하지 마십시오.

- **PowerShell 인라인 문자열로 소스 파일을 생성·수정하지 마십시오.** 이스케이프 문제로 한글이 깨지고 파일이 반복 손상된 전례가 있습니다. 파일 작업은 에디터 도구나 Python/Node 스크립트로 하고 UTF-8로 저장하십시오.
- **정규식 일괄 치환으로 기존 파일을 수정하지 마십시오.** 그 과정에서 `functions/api/briefings/latest.js`의 핵심 로직이 통째로 유실된 전례가 있습니다.
- **`git checkout -- <file>`로 되돌린 뒤 재적용하는 패턴을 쓰지 마십시오.** 위 유실이 그 경로에서 발생했습니다.
- **테스트 없이 "완료"를 보고하지 마십시오.** 직전 인계에서 신규 테스트를 0개 작성한 채 기존 테스트 통과를 근거로 완료 보고가 나왔는데, 실제로는 새 코드가 한 줄도 실행되지 않은 상태였고 런타임에서 즉시 실패하는 결함이 그대로 남아 있었습니다.
- **빌드 통과는 검증이 아닙니다.** 실제 요청을 보내 응답을 확인한 증빙을 제시하십시오.
- 확신이 서지 않으면 임의 결정하지 말고 **작업을 멈추고 질문**하십시오.

## 3. 필수 테스트

기존 커뮤니티 테스트 자산에 **비밀번호 흐름 커버리지가 없습니다.** 아래를 실제로 작성하고 통과시키십시오. 전부 API 레벨에서 검증 가능합니다.

| 시나리오 | 검증 |
| --- | --- |
| verify-otp 응답 계약 | 본문에 `access_token`/`refresh_token` 문자열 부재, 단기 쿠키만 발급 |
| 단기 쿠키 수명 | 만료 후 set-password 호출 401, 성공 후 동일 쿠키 재사용 401 |
| set-password 보호 | Turnstile 누락 403, 속도 제한 임계 초과 시 차단, 정상 요청 통과 |
| 비밀번호 변경 재인증 | `currentPassword` 없음 → 실패, 정확 → 성공, 성공 후 타 기기 세션 무효 |
| rememberMe 전파 | `false` 시 refresh 쿠키가 `Max-Age` 없는 세션 쿠키로 발급 |
| 로그인 열거 방지 | 존재·미존재 계정의 응답 본문과 상태코드 동일 |
| 마이그레이션 위생 | 동일 타임스탬프·동일 slug 중복 파일 검출 |
| 공개 DTO | 모든 목록·상세·댓글 응답에 email·UUID·token 부재 (기존 테스트 확장) |

기존 테스트를 삭제·skip·완화하지 마십시오.

## 4. 검증과 배포

**로컬**

```bash
npm test
npm run lint
npm run build
```

세 개를 **실제로 끝까지 실행**하고 결과를 보고하십시오. 백그라운드 진행 중인 상태로 완료 보고를 하지 마십시오.

**Production 스모크 테스트 시 주의**

- 반드시 canonical 도메인 `https://etf-campus.pages.dev/community/` 에서만 하십시오.
- Raw Pages deployment URL은 Turnstile expected hostname과 일치하지 않아 인증이 실패하는 것이 **정상**입니다. 이걸 통과시키려고 hostname 검증을 약화하지 마십시오.
- 테스트는 전용 계정으로 하고, 종료 후 계정·게시물을 정리하십시오.

**배포 게이트**

Production 마이그레이션과 배포는 **명시적 승인이 있을 때만** 실행하십시오. 승인 요청 시 변경 diff, 마이그레이션 영향, 테스트 결과, 롤백 절차를 함께 제시하십시오.

## 5. 산출물

1. 브랜치와 PR URL (origin/main 기준으로 분기, 마켓 브리핑 변경 미포함 확인)
2. 변경 파일 목록과 각 역할
3. 마이그레이션 중복 조사 결과 — DB 적용 이력, 현재 함수 정의, 확정한 정본, 제거한 파일
4. 신규 테스트 목록과 실행 결과
5. 실제 요청·응답 기반 검증 증빙 (쿠키 헤더 포함, 토큰 값은 마스킹)
6. 운영자 결정이 필요한 항목과 선택지
7. 구현하지 않았거나 위험이 남은 항목을 숨기지 말고 보고

## 6. 금지 사항

- 비밀값(API key, service role key, SMTP 자격증명, Turnstile secret, 세션 토큰, OTP)을 코드·로그·테스트 fixture·보고서에 노출하지 마십시오.
- 실제 이용자 이메일·개인정보를 출력하지 마십시오.
- ETF 종목 추천, 매수·매도 신호, 목표가, 수익 보장 문구를 생성하지 마십시오. 이 서비스는 판단 기준 학습이 목적입니다.
- 기존 ETF 데이터 수집·정적 빌드·Cloudflare Pages 배포·`ETF_PRICES` D1을 커뮤니티 작업으로 변경하거나 결합하지 마십시오.
- 커뮤니티 인증을 D1으로 옮기지 마십시오. 별도 단계로 분리된 작업입니다.

---

# 부록: 이번 범위 밖 백로그

인계받은 에이전트는 아래를 **이번 PR에 포함하지 마십시오.** 위 5건이 끝나고 안정화된 뒤 별도로 진행합니다.

### 다음 PR 후보

| 항목 | 내용 |
| --- | --- |
| CSRF 경로 정규화 | `_middleware.js`의 CSRF 예외는 원본 `pathname`을, 인증 검사는 정규화된 경로를 씁니다. `trailingSlash: true` 설정과 맞물려 `/api/community/auth/login-password/` 요청이 CSRF 검사에 걸려 로그인이 403으로 실패할 수 있습니다. fail-closed라 보안 구멍은 아니지만 재현이 까다로운 간헐적 버그입니다 |
| 오류 로깅 축소 | `set-password.js`의 `console.error("Set password error:", error)`가 공급자 오류 객체를 그대로 남깁니다. 코드·분류만 남기십시오 |
| Turnstile 메시지 일반화 | 실패 메시지에 실제 hostname이 노출됩니다. 사용자에게는 일반 문구, 실제 값은 서버 로그로 |
| 비밀번호 정책 | 현재 길이 8자 검사뿐입니다. 유출 비밀번호 목록 차단과 이메일·닉네임 동일 문자열 거부 권장 |
| purge cron 증빙 | `supabase/ops/schedule_community_retention.sql`에 pg_cron 등록 스크립트가 **존재합니다**. 설계 공백이 아니라 적용 증빙 공백이므로, Production에서 `cron.job` 등록·실행 이력을 조회해 운영 문서에 기록하고 실패 알림만 보강하면 됩니다 |
| mojibake 정리 | 일부 API 한글 문자열 손상 관찰. 전수 점검 후 UTF-8 회귀 테스트 추가 |

### 운영자 결정 필요

- 비밀번호 변경 경로 설계 (재인증 방식)
- 비밀번호 변경 후 전 기기 로그아웃 여부
- Preview/Raw URL 인증 허용 정책
- 신고·모더레이션을 지금 구현할지, 이메일 접수로 시작할지
- 비밀번호 최소 길이 (8자 유지 / 10자 상향)
- ADR-001 및 `06_ssot_decision_log.md` 개정 — 현재 문서는 "OTP-only·6자리·비밀번호 없음"인데 코드는 8자리 OTP + 비밀번호 로그인입니다. "서비스가 평문 비밀번호를 저장하지 않는다"는 원칙은 Supabase가 해시를 관리하므로 여전히 유효하니, 개정 시 이 구분을 명시하십시오
- admin 단일 계정 운영 리스크 (MFA, break-glass, 권한 회수 절차)
