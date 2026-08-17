# 커뮤니티 Phase 2.5–2.6 Preview 공개 게이트

> **상태: Preview 공개 보류.** 애플리케이션·세션 계약 검증과 로컬 Supabase 실행 구조는 준비됐지만, Docker 및 로컬 Supabase CLI 부재로 데이터베이스 마이그레이션·pgTAP 권한 검증을 실행하지 못했다. 따라서 이 문서는 **Preview 가능 판정이 아니며**, 외부 설정과 실제 통합 검증 전까지 공개를 승인하지 않는다.

## 1. 목적과 적용 범위

이 게이트는 기존 정적 ETF 기능과 분리된 커뮤니티 경로(`/community`, `/api/community`)만 대상으로 한다. 커뮤니티는 ETF 종목 추천, 수익률 경쟁, 매수 인증을 제공하지 않고 ETF 판단 기준을 학습·검증하는 공간이라는 SSOT 원칙을 따른다. 기존 ETF 탐색·비교·상세·브리핑·가이드·북 큐레이션의 정적 빌드 또는 배포 구조 변경은 이 게이트 범위에 포함하지 않는다.

## 2. 현재 RC 기준선

| 항목 | RC 상태 | 근거·비고 |
|---|---|---|
| 기준 브랜치 | 준비됨 | 최신 `origin/main` 기준의 별도 `community/phase-3-preview-rc` 브랜치에서 커뮤니티 변경을 재구성했다. |
| 커뮤니티 API 분리 | 준비됨 | Pages Functions 라우팅은 커뮤니티 공개 경로와 API 경로로 제한한다. |
| 세션 전달 방식 | 준비됨 | 브라우저 저장소 토큰 대신 HttpOnly `__Host-` 쿠키, CSRF double-submit, 동일 출처·JSON 요청 검증을 사용한다. |
| 탈퇴 상태 관리 보정 | 준비됨 | 세션 만료·폐기 보정과 marker RPC의 boolean 성공 반환 검증을 포함한다. |
| 로컬 DB 실행 구조 | 준비됨 | `supabase/config.toml`, 익명 개발 seed, pgTAP 스켈레톤, 보정 마이그레이션과 Cron 운영 SQL을 추가했다. |
| 실제 DB 통합 검증 | 미실행 | Docker 및 Supabase CLI가 없는 환경이므로 로컬 PostgreSQL/Supabase를 기동하지 못했다. |

## 3. 완료된 로컬 검증

아래 항목은 외부 Supabase 프로젝트나 비밀값 없이 실행 가능한 범위에서 확인했다. 기존 실패는 본 커뮤니티 변경이 아닌 ETF 상세 표시 테스트와 기존 lint 문제로 분류되며, 이 RC에서 새롭게 추가된 실패는 확인되지 않았다.

| 검증 항목 | 결과 | 세부 사항 |
|---|---|---|
| 전체 프로덕션 빌드 | 통과 | 정적 내보내기 빌드가 1,182개 경로 기준으로 완료됐다. |
| 전체 단위 테스트 | 기존 실패 1건 | ETF 상세 표시 관련 기존 실패 1건이며 커뮤니티 변경과 무관하다. |
| 정적 분석 | 기존 오류 14건 | 기존 오류이며 커뮤니티 추가 오류는 없다. |
| 세션 런타임 계약 테스트 | 통과, 3/3 | `__Host-` 쿠키 속성, 복수 `Set-Cookie` 분리, 만료 시 세션 쿠키 폐기를 확인했다. |
| Functions JavaScript 문법 검사 | 통과 | 세션 모듈과 계정 API 문법을 확인했다. |
| 비밀값 정적 검사 | 완료 예정 | 커밋 직전 규칙 기반 검사와 diff 검사를 다시 실행해야 한다. |

## 4. DB·권한·스케줄 미검증 항목

다음 항목은 파일이 준비된 것과 실제 실행·검증을 구별해야 한다. Docker 및 로컬 Supabase CLI가 준비된 검증 환경에서만 실행하며, 결과가 모두 통과하기 전에는 Preview 가능으로 판정하지 않는다.

| 항목 | 준비된 산출물 | 현재 상태 | 재개 후 필수 실행 |
|---|---|---|---|
| 마이그레이션 순서·적용성 | `20260815_000001`~`000003` | 미실행 | 신규 로컬 DB에 번호 순서대로 적용하고 오류·재실행 멱등성을 확인한다. |
| RLS·권한 경계 | `community_rls_permissions_test.sql` | 미실행 | `supabase test db`로 anon/member/moderator/admin/service_role 경계를 검증한다. |
| 탈퇴 상태 머신 | `community_withdrawal_state_test.sql` | 미실행 | 삭제 실패 marker, 완료 marker, 복구 큐, RPC 권한을 검증한다. |
| Supabase DB lint | 설정·마이그레이션 일체 | 미실행 | `supabase db lint`를 실행하고 경고를 판정한다. |
| 로컬 OTP·메일 흐름 | `config.toml` Mailpit 설정 | 미실행 | 익명 개발 계정에서 OTP 요청·검증·세션 생성·로그아웃·탈퇴를 수동 검증한다. |
| 30일 물리 삭제 | `schedule_community_retention.sql` | 의도적으로 미연결 | Production 승인 뒤에만 Cron을 등록하고 실행 로그·대상 범위를 검증한다. |

> **중요:** `supabase/ops/schedule_community_retention.sql`은 Production 운영자 전용 SQL이다. Preview에서는 자동 스케줄을 생성하거나 실행하지 않는다.

## 5. 외부 운영자 설정 대기 항목

외부 설정은 서버 전용 환경 변수와 운영 콘솔에서만 수행한다. 이 저장소와 본 문서에는 비밀값, API 키, 사용자 이메일, 프로젝트 식별자를 기록하지 않는다.

| 순서 | 운영자 작업 | 적용 위치 | 완료 판정 |
|---|---|---|---|
| 1 | 서울 리전의 커뮤니티 전용 Supabase 프로젝트 생성 | Supabase | 기존 ETF D1 데이터와 물리·권한 경계가 분리됨 |
| 2 | 마이그레이션 3개를 번호 순서로 적용 | Supabase SQL Editor 또는 CLI | 스키마·RLS·RPC 적용 및 pgTAP 통과 |
| 3 | 이메일 OTP 및 Preview Redirect URL 설정 | Supabase Auth | 승인된 도메인에서만 OTP 콜백 가능 |
| 4 | Resend Custom SMTP 및 DNS 검증 | Supabase / DNS | 테스트 메일을 통해 발송·반송 정책 확인 |
| 5 | Preview 암호화 환경 변수 9개 등록 | Cloudflare Pages Preview | 비밀값을 노출하지 않고 서버 API가 정상 동작 |
| 6 | Turnstile Preview hostname·action 구성 | Cloudflare Turnstile | OTP 요청·검증에서 hostname, action, 만료·재사용 검증 성공 |
| 7 | Preview 운영자 접근 제한 | Cloudflare Access | 비승인 사용자의 Preview 접근 차단 |
| 8 | 최초 admin 지정 | 서버 전용 운영 절차 | 클라이언트 입력이 아닌 서버·DB 역할로만 admin 판정 |
| 9 | Production Cron 등록 | Supabase Cron | Production 승인 후에만 30일 물리 삭제 스케줄 활성화 |
| 10 | 정책 전문 최종 검토 | 법무·운영 | 개인정보 처리방침, 이용약관, 투자정보 고지 반영 |

## 6. Preview 전 수동 통합 검증 시나리오

외부 설정이 끝난 뒤, 접근 제한이 걸린 Preview에서 아래 시나리오를 수동으로 수행한다. 모든 시나리오는 실계좌·개인정보·실제 투자 권유 문구를 사용하지 않는 테스트 데이터만으로 수행한다.

| 시나리오 | 기대 결과 |
|---|---|
| 비로그인 공개 목록·상세 읽기 | 게시물과 댓글은 공개로 보이고, 이메일·내부 사용자 ID는 응답과 화면에 노출되지 않는다. |
| 비로그인 작성·댓글·신고 요청 | 인증 요구 응답으로 차단되며 데이터가 생성되지 않는다. |
| OTP 요청·검증 | Turnstile, 이메일·IP 해시 속도 제한, 환경별 hostname/action 검증을 통과해야 한다. |
| 회원 작성·수정·댓글 | 본인 게시물·댓글에 한해서만 변경할 수 있고, 서버 기준 `created_at`·`updated_at`이 기록된다. |
| 타 사용자 게시물 수정·삭제 | RLS와 API가 일관되게 차단한다. |
| 로그아웃·세션 만료 | 모든 세션 쿠키가 별도 `Set-Cookie`로 만료되고, 이후 인증 API가 안전하게 실패한다. |
| 탈퇴 | 회원 상태 전이와 marker RPC가 일관되게 기록되고, 실패 시 운영 복구 큐 조회가 가능하다. |
| XSS·마크다운 처리 | 허용되지 않은 HTML, 이벤트 핸들러, 스크립트 URL이 렌더링되지 않는다. |
| 오류·로딩·빈 상태 | 모바일과 데스크톱에서 접근 가능한 한국어 UI와 재시도 동선이 제공된다. |

## 7. 공개 차단 조건과 최종 판정

아래 중 하나라도 남아 있으면 Preview 공개를 승인하지 않는다.

1. 마이그레이션 3개 또는 pgTAP 권한·탈퇴 테스트가 미실행이거나 실패한 경우.
2. 서버 전용 비밀값이 클라이언트 번들, 로그, 문서, API 응답에 포함된 경우.
3. Turnstile hostname/action, OTP 속도 제한, CSRF 또는 쿠키 세션 검증이 Preview에서 실패한 경우.
4. 비로그인 작성 차단, 타인 게시물 수정 차단, 공개 응답 개인정보 비노출 중 하나라도 실패한 경우.
5. Cloudflare Access 제한, Supabase Auth redirect, SMTP/DNS, 정책 전문 검토 중 필수 운영 설정이 미완료인 경우.

현재는 **DB 실행 검증 및 외부 설정이 미완료**이므로, RC는 개발 산출물 검토 상태에만 머문다. 실제 Preview 공개, main 병합, 원격 push, Cloudflare 배포 및 Production Cron 등록은 이 문서의 모든 차단 조건이 해소되고 운영자 승인을 받은 뒤에만 별도 단계에서 검토한다.
