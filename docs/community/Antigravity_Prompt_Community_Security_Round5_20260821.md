# Antigravity 후속 지시문 (Round 5) — 롤백 절차 정정과 Preview 계약 테스트

작성일 2026-08-21 · 대상 브랜치 `fix/community-auth-hardening` · PR #13
선행 문서: `..._Fixes_20260820.md`, `..._Round2/3/4_20260820.md`

---

# 0. Round 4 검증 결과 — 브랜치 상태 정상

실제 워크트리로 대조했습니다.

| 항목 | 확인 |
| --- | --- |
| R4-1 lint | rebase로 error 6건 해소, `✖ 59 problems (0 errors, 59 warnings)` — **exit 0** ✅ |
| R4-2 rebase | `app/page.tsx`·`components/screener/screener.tsx`·`components/site-header.tsx` 모두 **`origin/main`과 바이트 단위로 일치**. 격리 확인 ✅ |
| R4-3 `.dev.vars` | `.gitignore` 말미에 `.dev.vars`·`.dev.vars.*` 추가됨. 추적 이력 없음 ✅ |
| R4-4 스테이징 | 경로 명시 커밋으로 전환 ✅ |
| 마이그레이션 | 대상 함수 4개(`create_community_post`, `update_community_post`, `current_community_role`, `bootstrap_community_profile`) 확인 ✅ |

**코드와 브랜치는 머지 가능한 상태입니다.** 남은 것은 아래 3건입니다.

---

# 1. R5-1 (High) — 승인 요청서의 롤백 절차가 틀렸습니다. 실행하면 취약점이 되살아납니다

Round 4 리포트의 마이그레이션 승인 요청에 이렇게 적혀 있습니다.

> **롤백 절차**: 롤백이 필요할 경우, Phase 2의 초기 스크립트에 포함된 4개 함수의 생성 쿼리를 다시 한 번 `CREATE OR REPLACE FUNCTION`으로 실행하여 `search_path`를 `''`로 덮어씌우면 즉시 롤백됩니다.

**두 군데가 사실과 다릅니다.**

**(1) `search_path = ''`가 아닙니다.**

`20260815000001_community_phase2.sql`의 해당 함수 속성은 이렇습니다.

| 함수 | 원본 `search_path` |
| --- | --- |
| `current_community_role` (197행) | `public` |
| `bootstrap_community_profile` (273행) | `public` |
| `create_community_post` / `update_community_post` (`..._000002_...`) | `''` |

R3-1에서 지적하고 직접 되돌린 바로 그 지점입니다. **코드는 올바르게 고쳤는데 문서에 같은 오해가 남아 있습니다.** 이 문장대로 실행하면 R3-1 이전 상태로 되돌아갑니다.

**(2) 더 심각한 문제 — 그 롤백은 이 마이그레이션이 고치려는 결함을 되살립니다.**

이 마이그레이션의 목적은 중복 파일이 덮어쓴 **컬럼 한정을 복구하는 것**입니다. "Phase 2의 초기 스크립트"로 되돌린다는 말이 만약 삭제된 언더스코어 버전(`20260815_000001`·`20260815_000002`)의 정의를 의미한다면, 그것은 `where slug = p_category_slug` 형태의 **한정 없는 정의**이고 PL/pgSQL 변수 섀도잉이 다시 열립니다.

**정확한 롤백 서술**

이 마이그레이션은 함수 본문에 스키마 한정을 더할 뿐 시그니처·권한·데이터를 바꾸지 않습니다. **되돌아갈 가치가 있는 이전 상태가 없습니다.**

승인 요청서를 아래 취지로 다시 쓰십시오.

> **롤백**: 이 마이그레이션은 함수 본문의 스키마 한정만 복구하며 시그니처·`search_path`·권한·데이터를 변경하지 않는다. `create or replace`만 사용하므로 재실행해도 결과가 같다(멱등).
> 되돌릴 필요가 생기면 현재 `main`의 `20260815000001_community_phase2.sql`·`20260815000002_community_security_hardening.sql`에 있는 정의를 그대로 재적용한다 — 이 두 파일이 이미 정본(한정 버전)이므로 **결과적으로 no-op**이다.
> 삭제된 `20260815_000001`·`20260815_000002`(언더스코어 버전)로는 절대 되돌리지 않는다. 그 정의가 이번에 고치는 결함 자체다.

**승인 요청서를 정정해 다시 제출하십시오.** 운영자가 장애 중에 이 문서를 보고 실행할 수 있습니다.

---

# 2. R5-2 (Low) — 테스트 결과 서술을 정확히 하십시오

리포트는 "236개 모든 테스트 통과"라고 적었으나 붙여준 출력은 이렇습니다.

```
Test Files  49 passed | 1 skipped (50)
     Tests  234 passed | 2 skipped (236)
```

**234 통과, 2 스킵입니다.** 확인해 보니 스킵된 것은 `lib/community/__tests__/preview-integration.contract.test.ts`이고, `describe.skipIf(!enabled || !previewBaseUrl)`로 **환경변수가 없을 때만 건너뛰도록 원래 설계된 스위트**입니다. 규칙 위반이 아니며 정상입니다.

문제는 서술뿐입니다. 앞으로는 `234 passed | 2 skipped (환경변수 미설정 시 건너뛰는 Preview 통합 계약 스위트)`처럼 **스킵을 드러내고 사유를 붙여** 적으십시오.

참고로 Round 3 리포트는 같은 저장소에서 `236 passed (236)`이라고 적었습니다. 둘 중 하나는 잘못 옮긴 것입니다.

---

# 3. R5-3 (High) — E2E는 "불가능"이 아닙니다. 절반은 지금 자동화할 수 있습니다

Round 4 리포트의 사유입니다.

> 저와 같은 자동화 봇(Agent)이나 CLI 스크립트로는 의도적으로 고도화된 Turnstile 캡차 챌린지를 우회하여 통과할 방법이 없었습니다.

**Turnstile이 필요한 시나리오에 대해서는 맞는 말이고, 우회를 시도하지 않은 것도 옳은 판단입니다.** 그러나 결론이 과합니다.

## 3.1 이 저장소에는 이미 Preview 통합 계약 테스트 하네스가 있습니다

`lib/community/__tests__/preview-integration.contract.test.ts`가 존재하고, 아래 두 환경변수로 켜집니다.

```
COMMUNITY_PREVIEW_INTEGRATION_ENABLED=true
COMMUNITY_PREVIEW_INTEGRATION_BASE_URL=<preview canonical origin>
```

현재 내용은 공개 읽기 허용·비인증 쓰기 거부 2건뿐이라 **이번 변경을 전혀 덮지 않습니다.** 여기에 확장하십시오.

## 3.2 Turnstile 없이 검증 가능한 항목

`set-password`의 검사 순서는 **비밀번호 길이 → pwsetup 쿠키 → Turnstile → 속도 제한**입니다. 즉 앞의 두 관문에서 걸리는 요청은 **캡차에 도달하기 전에 응답이 확정**됩니다. 미들웨어의 Origin·Content-Type·CSRF 검사는 그보다도 앞입니다.

아래를 `preview-integration.contract.test.ts`에 추가하십시오. 전부 자격증명 없이 실제 Preview 배포본에 대해 실행됩니다.

| # | 요청 | 기대 |
| --- | --- | --- |
| P-1 | `POST /api/community/auth/set-password` — CSRF 헤더 없음 | `403 FORBIDDEN` (미들웨어 CSRF 게이트) |
| P-2 | 같은 요청 + 트레일링 슬래시 `.../set-password/` | 동일하게 `403` (경로 정규화) |
| P-3 | `POST /api/community/auth/login-password` — CSRF 헤더 없음 | 403이 **아님** (CSRF 면제 경로 유지) |
| P-4 | `POST /api/community/auth/set-password` — Origin 불일치 | `403 FORBIDDEN` |
| P-5 | `POST /api/community/auth/set-password` — `Content-Type: text/plain` | `415 VALIDATION_ERROR` |
| P-6 | `POST /api/community/auth/set-password` — CSRF 통과, pwsetup 쿠키 없음 | `401 AUTH_REQUIRED` (Turnstile 도달 전) |
| P-7 | `POST /api/community/auth/verify-otp` — `captchaToken` 없음 | `400 CAPTCHA_REQUIRED` (Turnstile이 실제로 켜져 있음을 증명) |
| P-8 | `GET /api/community/posts` | 200이고 본문에 `email`·`author_profile_id`·`access_token`·`refresh_token` 문자열 부재 |
| P-9 | `POST /api/community/auth/login-password` — 존재/미존재 계정 | 상태코드·본문 동일 (열거 방지) |

**P-1·P-2·P-6이 이번 PR의 핵심 변경(미들웨어 경로 분리, 쿠키 게이트)을 실제 배포본에서 직접 증명합니다.** 지금 "전체 미확보"인 것과는 크게 다릅니다.

기존 스킵 조건(`describe.skipIf`)을 그대로 따르고, **자격증명·테스트 계정·이메일을 코드에 넣지 마십시오.** 파일 상단 주석의 원칙("This suite intentionally does not contain credentials or test identities")을 유지하십시오.

## 3.3 사람 손이 필요한 항목

아래는 실제 OTP 수신과 Turnstile 통과가 필요하므로 브라우저에서 사람이 수행합니다. **자동화를 시도하지 마십시오.**

| # | 확인 |
| --- | --- |
| H-1 | `verify-otp` 200 — 본문에 토큰 문자열 없음, `Set-Cookie`에 pwsetup 쿠키, `X-Community-CSRF` 헤더 존재 |
| H-2 | `set-password` 200 — 세션 쿠키 발급, pwsetup 쿠키 `Max-Age=0` 만료 |
| H-3 | 동일 pwsetup 쿠키로 재요청 → 429 |
| H-4 | `rememberMe` 체크 해제로 시작 → refresh 쿠키에 `Max-Age` 부재 |
| H-5 | 브라우저 A·B 로그인 → A에서 비밀번호 재설정 → B에서 글쓰기 시 재로그인 요구 (전 기기 로그아웃) |

**운영자가 수행할 수 있도록 절차서를 만드십시오.** `docs/community/`에 아래를 담아 커밋하십시오.

- 브라우저 devtools Network 탭에서 확인할 요청·응답과 **어느 헤더의 어떤 값을 볼지**
- 각 단계의 기대 결과와, 어긋났을 때 무엇을 의미하는지
- 전용 테스트 계정 사용과 종료 후 계정·게시물 정리 절차
- canonical preview 도메인에서만 수행할 것. **Raw Pages deployment URL은 Turnstile expected hostname과 불일치해 실패하는 것이 정상이며, 통과시키려고 hostname 검증을 약화하지 말 것**

---

# 4. 산출물

1. 정정한 마이그레이션 승인 요청서 (롤백 절차 포함)
2. `preview-integration.contract.test.ts`에 추가한 P-1~P-9 코드
3. 로컬 `npm test` 결과 — 이 스위트가 환경변수 없이 **스킵되는지** 확인 (기존 동작 유지)
4. `COMMUNITY_PREVIEW_INTEGRATION_ENABLED=true`로 Preview에 대해 실행한 결과. 실행하지 못했다면 그대로 기재
5. H-1~H-5 운영자 수동 검증 절차서 파일 경로
6. `git diff origin/main --stat`
7. `npm test` / `npm run lint` / `npm run build` 마지막 줄 — 스킵 수를 포함해 정확히

---

# 5. 변경하지 말 것

- Round 1~4에서 통과한 항목의 설계를 되돌리지 마십시오
- 기존 테스트를 삭제·skip·완화하지 마십시오. `preview-integration.contract.test.ts`의 기존 `skipIf` 조건은 원래 설계이므로 그대로 두십시오
- **Turnstile을 우회하거나 hostname·action 검증을 약화하지 마십시오.** 테스트를 통과시키려고 보안 검사를 느슨하게 만드는 것은 이 PR 전체를 무의미하게 만듭니다
- 테스트 코드·문서에 자격증명·실제 이용자 이메일·토큰·OTP를 넣지 마십시오
- Production 마이그레이션과 배포는 **명시적 승인 후에만** 실행하십시오
- `ETF_PRICES` D1, ETF 데이터 수집·정적 빌드·배포 파이프라인을 건드리지 마십시오
- 이번 범위 밖 백로그(Turnstile 메시지 일반화, 비밀번호 정책 강화, pg_cron 증빙, mojibake 전수 점검)를 손대지 마십시오
- 리포트는 실제 결과와 일치해야 합니다. 스킵을 통과로, 미확보를 확보로 적지 마십시오
- 확신이 서지 않으면 임의 결정하지 말고 **멈추고 질문**하십시오
