# ETF Campus 커뮤니티 구현 독립 검토 결과

검토일 2026-08-20 · 검토 대상 checkout HEAD `3f3eec7`
검토 방법: 소스 직접 판독. 아래 파일을 실제로 열어 확인했습니다.

```
functions/api/community/_middleware.js
functions/api/community/_lib/session.js
functions/api/community/auth/verify-otp.js
functions/api/community/auth/set-password.js
functions/api/community/auth/login-password.js
functions/api/community/auth/account.js
supabase/ops/schedule_community_retention.sql
supabase/migrations/  (파일 목록)
```

**검토 범위 한계**: 이 checkout은 `feat/admin-market-briefing-console` 브랜치이며 마켓 브리핑 관련 미완성 변경이 섞여 있습니다. `npm test` / `npm run build`는 실행하지 않았고, Production 배포본과 DB 상태도 확인하지 않았습니다. 아래 판단은 **소스 코드 판독에 근거**하며, 런타임·배포 증빙이 필요한 항목은 그렇게 표시했습니다. 비밀값·실제 계정·인증 코드는 일절 확인하지 않았습니다.

---

## 1. 총평 — 승인 가능 / 차단

### 승인 가능 (현 상태 유지 권장)

설계 대부분은 견고합니다. 다음은 **바꾸지 말고 유지**하십시오.

| 항목 | 확인 내용 |
| --- | --- |
| 요청 게이트 | `_middleware.js`가 unsafe method에 대해 Origin/Referer 동일 출처 검사 → `Content-Type: application/json` 강제 → CSRF 이중 제출 검증을 순서대로 적용. 폼 기반 CSRF가 구조적으로 차단됨 |
| 인증 기본값 | `needsAuthentication()`이 **deny-by-default**이고 공개 경로만 명시적 allowlist. 안전한 방향 |
| 쿠키 | `__Host-` 접두사 + `Secure` + `HttpOnly` + `Path=/`. `__Host-`는 서브도메인 쿠키 주입을 막아 **이중 제출 CSRF를 실제로 유효하게** 만듦 |
| CSRF 비교 | 길이 확인 후 XOR 누적 상수시간 비교 |
| 로그아웃 | `signOut({ scope: "global" })`로 refresh token을 서버에서 폐기. 쿠키만 지우는 흔한 실수를 피함 |
| DB 권한 | base table 권한 회수 + 공개 view read-only + SECURITY DEFINER RPC로 write 제한 + RLS 2차 방어 |
| 소유권 노출 | owner RPC가 slug만 반환하고 `author_profile_id`를 공개 DTO에 넣지 않음 |

### 배포 차단 (Production 반영 전 수정 필요)

| # | 항목 | 심각도 |
| --- | --- | --- |
| C-1 | `verify-otp`가 refresh token을 응답 본문으로 JS에 전달 | **Critical** |
| H-1 | `set-password`에 Turnstile·속도 제한 없음 | High |
| H-2 | 세션 변경 시 현재 비밀번호 재확인 없음 | High |
| H-3 | 중복 마이그레이션 파일 존재 | High |
| H-4 | `rememberMe` 선택값이 가입·재설정 경로에서 무시됨 | High |

---

## 2. 상세 발견 사항

### C-1 (Critical) — OTP 검증 응답이 refresh token을 JavaScript에 넘깁니다

**위치**: `functions/api/community/auth/verify-otp.js`

```js
return new Response(JSON.stringify({
  authenticated: true,
  tempAccessToken: data.session.access_token,
  tempRefreshToken: data.session.refresh_token
}), { status: 200, headers: { "Content-Type": "application/json" } });
```

이 설계는 시스템의 다른 모든 부분이 지키고 있는 불변식을 **이 한 곳에서 깹니다.** 다른 경로는 전부 토큰을 `__Host-` HttpOnly 쿠키에만 담아 JS가 읽지 못하게 하는데, 이 엔드포인트만 refresh token을 본문으로 반환합니다.

| 항목 | 내용 |
| --- | --- |
| 영향 | refresh token은 최대 30일 유효한 장기 자격증명입니다. 사이트 어디든 XSS가 한 번 성립하면 **비밀번호를 바꿔도 유지되는 계정 탈취**가 가능합니다(Supabase가 비밀번호 변경 시 refresh token을 일괄 폐기하지 않는 설정이면 특히 그렇습니다). HttpOnly 쿠키 설계의 이점이 이 경로에서 무효화됩니다 |
| 부차 영향 | 토큰이 브라우저 devtools 네트워크 기록, 클라이언트 오류 리포팅, 중간 프록시 로그에 남을 수 있습니다 |
| 재현 | 신규 가입 흐름에서 OTP 검증 요청의 응답 본문을 확인 |
| 권장 수정 | 토큰을 본문으로 반환하지 말고, **단일 목적·단기 HttpOnly 쿠키**(예: `__Host-etf-campus-community-pwsetup`, `Max-Age` 5~10분)로 발급하십시오. `set-password.js`는 body가 아니라 그 쿠키에서 토큰을 읽고, 성공 시 즉시 해당 쿠키를 만료시킵니다. 클라이언트 React state에서 토큰을 보관할 이유가 사라집니다 |
| 테스트 | ① verify-otp 응답 본문에 `access_token`/`refresh_token` 문자열이 없음 ② set-password가 body 토큰을 무시하고 쿠키만 신뢰함 ③ 쿠키 만료 후 set-password 호출 시 401 ④ set-password 성공 후 동일 쿠키 재사용 시 401 |

> 부수: `verify-otp.js`는 `rememberMe`를 파싱한 뒤 사용하지 않습니다(죽은 변수). C-1 수정 시 함께 정리하십시오.

### H-1 (High) — `set-password`만 봇·속도 제한이 없습니다

**위치**: `functions/api/community/auth/set-password.js`

`request-otp`, `verify-otp`, `login-password`는 모두 `verifyTurnstile` + `enforceDatabaseRateLimit`(이메일·IP 2중)을 적용합니다. **자격증명을 실제로 변경하는 `set-password`에만 둘 다 없습니다.** 인증 계열에서 가장 민감한 엔드포인트가 가장 보호가 약한 역전 상태입니다.

| 항목 | 내용 |
| --- | --- |
| 영향 | 토큰이 유출된 상황에서 비밀번호 설정 시도를 무제한 반복 가능. 오류 메시지 차이를 이용한 계정 상태 탐색에도 노출 |
| 권장 수정 | `community_password_set` action의 Turnstile 검증 추가, `set-password-ip` 및 토큰 subject 기준 속도 제한 추가. C-1의 단기 쿠키 도입 시 subject를 쿠키 식별자로 삼으면 자연스럽습니다 |
| 테스트 | Turnstile 누락 시 403, 임계 초과 시 429/503, 정상 요청 통과 |

### H-2 (High) — 로그인 상태에서 현재 비밀번호 확인 없이 비밀번호가 바뀝니다

**위치**: `functions/api/community/auth/set-password.js`

`set-password`는 전달된 access token으로 `supabase.auth.updateUser({ password })`를 호출할 뿐, 그것이 **방금 OTP를 통과한 토큰인지 검증하지 않습니다.** 프로젝트의 유효한 access token이면 무엇이든 통과합니다.

| 항목 | 내용 |
| --- | --- |
| 영향 | 로그인된 세션이 살아 있는 브라우저(공용 PC, 분실 기기, `rememberMe` 30일)에서 **현재 비밀번호를 모르는 사람이 비밀번호를 바꿔 계정을 영구 탈취**할 수 있습니다. 정상적인 "비밀번호 변경"과 "OTP 기반 재설정"이 하나의 엔드포인트로 합쳐져 있어 재인증 요구 지점이 사라졌습니다 |
| 권장 수정 | 두 경로를 분리하십시오. ① **재설정**: C-1의 단기 OTP 쿠키가 있을 때만 허용 ② **변경**: 로그인 세션 + `currentPassword` 재확인 필수. 어느 경로든 성공 후 `signOut({ scope: "global" })`로 기존 세션을 일괄 폐기하고 현재 브라우저만 재발급하십시오 |
| 테스트 | 로그인 세션만으로 비밀번호 변경 시도 → 400/401, `currentPassword` 정확 시 성공, 성공 후 다른 기기 세션 무효화 |

### H-3 (High) — 중복 마이그레이션 파일

```
supabase/migrations/20260815000002_community_security_hardening.sql
supabase/migrations/20260815_000002_community_security_hardening.sql   ← 언더스코어 위치가 다름
```

| 항목 | 내용 |
| --- | --- |
| 영향 | 두 파일 내용이 갈라지면 환경마다 다른 권한·RPC 정의가 적용됩니다. 보안 강화 마이그레이션이라 특히 위험합니다. 이력 정렬 순서도 도구에 따라 달라질 수 있습니다 |
| 권장 수정 | 두 파일을 diff해 동일하면 하나를 제거하고, 다르면 어느 쪽이 Preview/Production에 실제 적용됐는지 확인한 뒤 정본을 확정하십시오. **DB에 이미 적용된 이력을 먼저 조회한 뒤** 파일을 지우십시오 |
| 테스트 | 마이그레이션 파일명 중복 검출 테스트(동일 타임스탬프·동일 slug 검사)를 CI에 추가 |

### H-4 (High) — 사용자의 "로그인 상태 유지" 선택이 가입·재설정 경로에서 무시됩니다

**위치**: `set-password.js` → `sessionHeaders(session)` / `session.js` → `sessionHeaders(session, csrfToken = secureRandom(), rememberMe = true)`

`login-password.js`는 `sessionHeaders(data.session, undefined, rememberMe)`로 사용자의 선택을 전달하지만, `set-password.js`는 세 번째 인자를 넘기지 않아 **기본값 `true`가 적용**됩니다. `verify-otp.js`가 받은 `rememberMe`도 어디에도 전달되지 않습니다.

| 항목 | 내용 |
| --- | --- |
| 영향 | 신규 가입·비밀번호 재설정 사용자는 체크 해제 여부와 무관하게 refresh 쿠키가 30일 유지됩니다. 공용 PC 시나리오에서 H-2와 결합하면 실질적 계정 탈취 경로가 됩니다 |
| 권장 수정 | `rememberMe`를 verify-otp → set-password로 전달(단기 쿠키에 함께 봉인)하고 `sessionHeaders` 세 번째 인자로 넘기십시오 |
| 테스트 | rememberMe=false 가입 시 refresh 쿠키에 `Max-Age`가 없어 세션 쿠키로 발급됨 |

### M-1 (Medium) — CSRF 예외 경로가 trailing slash를 정규화하지 않습니다

**위치**: `functions/api/community/_middleware.js`

```js
if (!OTP_PATHS.has(pathname)) { ... enforceCsrf ... }   // 원본 pathname
```

같은 파일의 `needsAuthentication()`은 trailing slash를 제거한 뒤 비교하는데, CSRF 예외는 **원본 `pathname`을 그대로** 사용합니다. `next.config.ts`에 `trailingSlash: true`가 설정돼 있어, `/api/community/auth/login-password/` 형태 요청이 발생하면 예외 목록에 걸리지 않아 CSRF 검사가 수행되고, 아직 CSRF 쿠키가 없는 신규 방문자는 **로그인이 403으로 실패**합니다.

fail-closed라 보안 구멍은 아니지만 재현이 까다로운 간헐적 로그인 실패의 원인이 될 수 있습니다.

| 권장 수정 | `needsAuthentication`과 동일한 정규화 함수를 추출해 두 곳이 같은 값을 쓰게 하십시오 |
| --- | --- |
| 테스트 | trailing slash 유무 양쪽으로 4개 OTP 경로 호출 시 동일하게 동작 |

### M-2 (Medium) — 공급자 오류 객체를 그대로 로깅

**위치**: `set-password.js` — `console.error("Set password error:", error)`

Supabase 오류 객체에는 요청 식별자·내부 메시지가 포함될 수 있습니다. 사용자 메시지는 이미 잘 일반화돼 있으므로, 로그도 **오류 코드와 분류만** 남기십시오.

### M-3 (Medium) — Turnstile 실패 메시지의 hostname 노출

문서에서 이미 지적한 `HOSTNAME_MISMATCH(<actual hostname>)` 건입니다. **동의합니다.** 사용자 메시지는 "보안 확인에 실패했습니다. 공식 주소에서 다시 시도해 주세요."로 일반화하고, 실제 hostname은 서버 로그에만 남기십시오. 배포 URL 구조를 외부에 알려줄 이유가 없습니다.

### M-4 (Medium) — 비밀번호 정책이 길이 8자뿐

`password.length < 8` 외 검증이 없습니다. Supabase 측 정책이 별도로 설정돼 있는지 확인이 필요합니다(코드로는 확인 불가). 최소한 **상위 유출 비밀번호 목록 차단**과 이메일·닉네임과 동일 문자열 거부를 권장합니다. 복잡도 규칙 강제보다 길이 하한 상향(예: 10자)과 유출 목록 차단이 실효가 큽니다.

### L-1 (Low) — purge 스케줄러: 문서 서술 정정

인계 문서는 "durable scheduler 존재를 확정하지 못했다"고 적었으나, **실제로는 스크립트가 존재합니다.**

```
supabase/ops/schedule_community_retention.sql
  → create extension if not exists pg_cron
  → perform cron.schedule(...)
```

즉 설계 공백이 아니라 **적용 증빙 공백**입니다. `supabase/ops/`는 수동 실행 디렉터리이므로, Production DB에서 `cron.job` 조회로 실제 등록 여부와 최근 실행 이력을 확인하고 그 결과를 운영 문서에 남기면 종결됩니다. 실패 시 재시도·알림이 없다면 그 부분만 보강하십시오.

### L-2 (Low) — 문서 드리프트

ADR-001 / `06_ssot_decision_log.md`의 "OTP-only·6자리·비밀번호 없음"과 현재 코드(8자리 + 비밀번호 로그인)의 불일치는 **문서 갱신이 필요합니다.** 다만 "서비스가 비밀번호 평문을 저장하지 않는다"는 원칙은 Supabase가 해시를 관리하므로 그대로 유효합니다. ADR 개정 시 이 구분을 명시하십시오.

---

## 3. 운영자 결정이 필요한 항목 (임의 확정하지 않음)

| 항목 | 선택지 |
| --- | --- |
| 비밀번호 변경 경로 | (A) 로그인 세션 + 현재 비밀번호 재확인만 허용 (B) 항상 OTP 재인증 요구 (C) 둘 다 제공. 1인 운영·보안 우선이면 (B)가 구현·검증 모두 단순합니다 |
| 비밀번호 변경 후 세션 처리 | (A) 전 기기 로그아웃 (권장) (B) 현재 기기 유지 |
| Preview/Raw URL 인증 허용 | (A) canonical만 허용하고 Raw URL은 안내 문구로 차단 (권장) (B) Preview 전용 hostname을 별도 허용 목록에 추가 |
| 신고·모더레이션 | (A) 이메일 신고 접수로 시작하고 UI는 후순위 (1인 운영에 현실적) (B) 최소 신고 테이블 + admin 큐를 지금 구현 |
| 비밀번호 최소 길이 | 8자 유지 / 10자 상향 |

---

## 4. 테스트 매트릭스 보강안

기존 테스트 목록에 **비밀번호 흐름 커버리지가 없습니다.** 아래를 추가하십시오. 모두 API 레벨에서 검증 가능합니다.

| 시나리오 | 검증 |
| --- | --- |
| verify-otp 응답 계약 | 본문에 토큰 문자열 부재, 단기 쿠키만 발급 |
| set-password 보호 | Turnstile 누락 403, 속도 제한 동작, 만료 쿠키 401, 재사용 401 |
| 비밀번호 변경 재인증 | currentPassword 없음 → 실패, 정확 → 성공, 성공 후 타 기기 세션 무효 |
| rememberMe 전파 | false 시 refresh 쿠키가 세션 쿠키로 발급 |
| trailing slash | 4개 OTP 경로 × slash 유무 = 8케이스 동일 동작 |
| 로그인 열거 방지 | 존재/미존재 계정 응답 본문·상태코드 동일 |
| 마이그레이션 위생 | 중복 타임스탬프·중복 slug 파일 검출 |
| 공개 DTO | 모든 목록·상세·댓글 응답에 email·UUID·token 부재 (기존 테스트 확장) |

---

## 5. 백로그

### 즉시 조치 (Production 반영 전)

1. **C-1** verify-otp 토큰 본문 반환 제거 → 단기 HttpOnly 쿠키로 전환
2. **H-1** set-password에 Turnstile·속도 제한 추가
3. **H-2** 비밀번호 변경/재설정 경로 분리 및 재인증 요구
4. **H-3** 중복 마이그레이션 파일 정리 (DB 적용 이력 확인 후)
5. **H-4** rememberMe 전파 수정
6. 위 항목 회귀 테스트 추가 후 canonical Production에서 최신 SHA·배포 ID 기록과 함께 재검증

### 다음 PR

7. **M-1** trailing slash 정규화 통일
8. **M-2** 오류 로깅 축소, **M-3** Turnstile 메시지 일반화
9. **M-4** 비밀번호 정책 강화
10. **L-1** purge cron 등록·실행 이력 확인 후 운영 문서에 증빙 기록, 실패 알림 보강
11. mojibake 전수 점검 및 UTF-8 회귀 테스트
12. 속도 제한 DB 장애 시 fail-closed 정책의 SLO 명문화 — 현재 설계는 **보안상 옳습니다.** 다만 읽기 전용 열람은 계속 가능해야 하므로, 쓰기·인증만 차단되는지 확인하십시오

### 운영자 결정 필요

13. §3의 5개 선택지 확정
14. ADR-001 / SSOT 개정 (8자리 OTP + 비밀번호 lifecycle 승인 기록)
15. admin 단일 계정 운영 리스크 — MFA, break-glass 절차, 권한 회수 절차

---

## 6. 요약

인증·권한 아키텍처의 **뼈대는 좋습니다.** deny-by-default 미들웨어, `__Host-` 쿠키, 상수시간 CSRF 비교, 전역 로그아웃, base table 권한 회수 후 RPC 경유 write — 모두 제대로 된 선택입니다.

문제는 **나중에 덧붙인 비밀번호 흐름이 그 규율을 따라가지 못한 것**에 집중돼 있습니다. 다른 모든 엔드포인트가 토큰을 HttpOnly 쿠키에만 두는데 `verify-otp`만 본문으로 넘기고, 다른 모든 인증 엔드포인트가 Turnstile·속도 제한을 거는데 `set-password`만 무방비이며, `login-password`는 rememberMe를 존중하는데 `set-password`는 무시합니다.

전면 재작성은 필요 없습니다. **위 5개 항목만 고치면 비밀번호 흐름이 기존 설계의 안전 수준으로 올라옵니다.**
