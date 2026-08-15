# 커뮤니티 2.5단계 Preview 공개 게이트

> **상태:** 코드·마이그레이션·자동 보안 계약 검증 단계. 외부 Supabase 프로젝트, SMTP, Cloudflare 환경 변수, Turnstile 키, Preview 배포가 제공·실행되기 전에는 통합 검증 또는 Preview 공개 완료를 주장하지 않는다.

## 1. 코드 보안 경계

커뮤니티 인증은 Pages Functions가 same-origin HttpOnly 쿠키를 읽는 BFF 구조를 사용한다. OTP 검증 응답 본문은 인증 상태만 반환하며 access token과 refresh token을 반환하지 않는다. 접근·갱신 토큰은 `__Host-` 접두사, `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/` 쿠키에만 저장한다. 인증 또는 토큰 갱신 경로의 응답은 `Cache-Control: private, no-store`로 응답해야 한다.

변경 요청은 Pages Functions 미들웨어에서 동일 Origin 또는 Referer, `application/json`, CSRF double-submit 토큰을 모두 확인한다. OTP 요청과 검증은 인증 전 흐름이므로 CSRF 대상에서 제외하되, 동일 출처와 JSON 검증 및 Turnstile 검증을 적용한다.

| 흐름 | 서버 통제 | Preview 검증 기준 |
|---|---|---|
| OTP 요청 | 중립 응답, 이메일 해시 10분 3회, IP 해시 10분 10회, Turnstile action | 가입·비가입 이메일에 동일한 응답을 반환하고 원문 이메일·IP를 테이블·로그에 남기지 않는다. |
| OTP 검증 | 6자리 형식, 이메일·IP 이중 한도, Turnstile action, HttpOnly 세션 발급 | 응답 JSON과 브라우저 저장소에 access/refresh token이 없다. |
| 인증 변경 요청 | 서버 세션 갱신, same-origin, JSON, CSRF, RLS RPC | 타 Origin, 누락 CSRF, 비JSON 요청이 거부된다. |
| 공개 읽기 | 공개 View만 사용 | 이메일, Auth UUID, 프로필 UUID, 삭제·숨김 콘텐츠가 없다. |
| 탈퇴 | 요청 상태 머신, Auth 삭제 성공·실패 기록, 쿠키 폐기 | 중복 요청·Auth 삭제 실패·재시도 흐름을 확인한다. |

## 2. Supabase와 Cloudflare 콘솔 체크리스트

| 콘솔 | 설정 경로 | 운영자 작업 |
|---|---|---|
| Supabase | New Project | Seoul(`ap-northeast-2`) 리전의 **커뮤니티 전용** 프로젝트를 생성한다. 기존 ETF 데이터 D1을 사용하지 않는다. |
| Supabase | SQL Editor 또는 승인된 migration runner | `20260815_000001_community_phase2.sql` 후 `20260815_000002_community_security_hardening.sql` 순서로 1회 적용한다. |
| Supabase | Authentication → Providers → Email | 이메일 OTP를 활성화하고 운영자 테스트 계정으로만 검증한다. |
| Supabase | Authentication → URL Configuration | Preview Site URL과 Redirect URL을 Preview 도메인으로만 설정한다. Production URL은 Production 게이트 승인 전 추가하지 않는다. |
| Supabase | Authentication → SMTP | 외부 Preview 직전에 Resend Custom SMTP, 발신 이름, 인증 전용 발신 도메인 및 DNS를 설정·검증한다. |
| Cloudflare Pages | Settings → Environment variables | Preview와 Production 값을 분리한다. `SUPABASE_URL`, `SUPABASE_ANON_KEY` 또는 publishable key, `SUPABASE_SERVICE_ROLE_KEY`, `COMMUNITY_RATE_LIMIT_SALT`, `COMMUNITY_ENVIRONMENT`, `TURNSTILE_REQUIRED`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_EXPECTED_HOSTNAME`를 암호화 환경 변수로 설정한다. |
| Cloudflare Turnstile | Widget settings | Preview hostname과 action `community_otp_request`, `community_otp_verify`를 허용하도록 구성한다. |
| Cloudflare Access | Application policy | 최초 Preview는 운영자 이메일 그룹 또는 승인된 운영자 계정만 접근하도록 제한한다. |
| 운영 계정 | GitHub, Cloudflare, Supabase, admin | 모두 TOTP MFA와 복구 절차를 적용한다. |

실제 값, 운영자 이메일, 프로젝트 URL, 키, Auth UUID는 코드·Git·문서·채팅에 기록하지 않는다.

## 3. 탈퇴 보존·정리 상태

탈퇴 요청은 DB 요청 기록을 먼저 만들고, 이후 Auth 사용자를 삭제한다. Auth 삭제 실패는 `auth_delete_failed`로 남겨 service-role 기반의 운영 재시도가 가능하도록 한다. 익명화 선택은 Auth·프로필 삭제에 따라 공개 콘텐츠의 작성자 연결을 제거한다. 삭제 선택은 즉시 공개 View에서 숨기고 30일 이후 물리 삭제 대상이 된다.

`purge_due_community_withdrawals()` 함수는 마이그레이션으로 제공되지만, 현재 **정기 실행 플랫폼에는 연결하지 않았다.** 따라서 30일 물리 삭제는 정책·정리 함수가 구현된 상태일 뿐 자동 정리가 운영 중인 상태가 아니다. 운영자는 Supabase의 승인된 스케줄 기능 또는 별도 서버 전용 정리 작업을 선택하고, 실행 ID·실패 재시도·알림을 운영 절차에 추가해야 한다. 이 결정·연결·실행 검증 전에는 “물리 삭제 완료”라고 보고할 수 없다.

## 4. Preview 실행 전 차단 조건

| 차단 조건 | 차단 이유 | 해제 기준 |
|---|---|---|
| `COMMUNITY_ENVIRONMENT=preview` 또는 `production`인데 `TURNSTILE_REQUIRED=true`가 아님 | 외부 OTP CAPTCHA 우회 위험 | Turnstile site/secret key와 expected hostname을 설정하고 서버 응답을 확인한다. |
| SMTP·DNS 미검증 | OTP 전달 실패 및 발신자 신뢰 저하 | 운영자 테스트 계정에서 발송·수신·만료·재요청을 확인한다. |
| RLS·RPC 마이그레이션 미적용 | 직접 Data API 변경·식별자 노출 위험 | SQL 적용 후 anon/member A/member B/admin 검수 계정으로 통합 테스트를 실행한다. |
| Cloudflare Access 미설정 | 운영자 검수 전 외부 노출 위험 | Preview 도메인 접근을 운영자 그룹으로 제한한다. |
| 개인정보·이용약관·투자정보 고지 미승인 | 공개 문구·법적 고지 불완전 | 승인된 최종 문안과 정책 버전을 적용한다. |
| 30일 정리 스케줄 미연결 | 물리 삭제 자동화 미검증 | 승인된 서버 전용 정리 작업과 실패 재시도·감사를 검증한다. |

## 5. 실제 통합 검증 대기 항목

외부 설정이 제공되지 않았으므로 다음은 실행하지 않았다. Supabase CLI/pgTAP 실제 RLS 테스트, anon·member A·member B·admin·닉네임 미설정·탈퇴 처리 중 사용자 계정의 통합 테스트, OTP 만료·재사용·세션 갱신의 실제 Auth 테스트, Turnstile hostname/action/replay 테스트, SMTP·Resend 검증, Cloudflare Access로 제한된 Preview 검증, 30일 정리 작업의 실제 스케줄 실행이 이에 해당한다.
