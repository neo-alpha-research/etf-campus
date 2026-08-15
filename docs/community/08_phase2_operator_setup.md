# 커뮤니티 Phase 2 운영자 설정 체크리스트

> **상태:** 코드 반영 전 운영자 콘솔 작업 안내
> **비밀값 원칙:** 이 문서에는 실제 URL·키·SMTP 비밀번호·관리자 이메일·사용자 UUID를 기록하지 않는다.

## 1. Supabase 프로젝트

| 순서 | 운영자 콘솔 작업 | 확인 기준 |
|---:|---|---|
| 1 | 커뮤니티 전용 Supabase 프로젝트를 Seoul(`ap-northeast-2`) 리전으로 생성한다. | 기존 `ETF_PRICES` D1이나 ETF 데이터 프로젝트와 분리되어 있다. |
| 2 | `supabase/migrations/20260815_000001_community_phase2.sql`을 SQL Editor 또는 승인된 마이그레이션 절차로 1회 적용한다. | `user_profiles`, `community_categories`, `community_posts`, `community_comments`, `consent_records`, `post_revisions` 및 RLS·함수가 생성된다. |
| 3 | Authentication에서 이메일 OTP를 활성화하고 매직 링크·비밀번호 기반 진입을 Phase 2 UI에 노출하지 않는다. | 운영자 테스트 계정에서 6자리 OTP가 발송·검증된다. |
| 4 | 개발·검수 중에는 Supabase 기본 발송을 운영자 테스트 계정에만 사용한다. | 외부 공개 대상 발송을 하지 않는다. |
| 5 | 외부 Preview 공개 직전 Resend를 Supabase Custom SMTP로 연결한다. | 뉴스레터와 분리된 트랜잭션 발신, 발신자 이름 `ETF 캠퍼스 인증`, `no-reply@auth.<확정 도메인>`이 확인된다. |
| 6 | 운영자 이메일 OTP 가입 후 별도 보호 절차 또는 Supabase 관리 콘솔에서 `assign_initial_community_admin`을 실행한다. | 최초 admin 1명만 지정되고 UUID·이메일은 코드·문서·마이그레이션에 남지 않는다. |
| 7 | admin 계정과 Supabase·Cloudflare·GitHub 운영 계정에 TOTP MFA를 적용한다. | 각 계정의 복구 절차까지 운영자가 안전한 채널로 보관한다. |

## 2. Cloudflare Pages Functions 비밀값

다음 값은 Cloudflare Pages 프로젝트의 **Settings → Environment variables → Encrypted**에 설정한다. 브라우저 번들, Git, 로그, 문서에 실제 값을 넣지 않는다.

| 변수 이름 | 용도 | 공개 가능 여부 |
|---|---|---:|
| `SUPABASE_URL` | 커뮤니티 전용 Supabase 프로젝트 URL | 서버 환경 변수로만 사용 |
| `SUPABASE_ANON_KEY` | RLS를 적용하는 일반 API 호출의 공개 키 | 서버 환경 변수로만 사용 |
| `SUPABASE_SERVICE_ROLE_KEY` | 회원 탈퇴의 Auth 사용자 삭제·제한된 운영 작업 | **암호화 비밀값 전용**, 브라우저 금지 |
| `COMMUNITY_RATE_LIMIT_SALT` | 이메일·사용자 식별자를 로그에 남기지 않는 속도 제한 키 파생 | 암호화 비밀값 전용 |
| `TURNSTILE_REQUIRED` | 개발 `false`, 외부 Preview 전 `true` | 일반 환경 변수 |
| `TURNSTILE_SECRET_KEY` | CAPTCHA 서버 검증 | `TURNSTILE_REQUIRED=true`일 때 암호화 비밀값 전용 |

`SUPABASE_SERVICE_ROLE_KEY`는 일반 게시물·댓글 CRUD에 사용하지 않는다. 일반 회원의 쓰기·수정·소프트 삭제는 인증 사용자 JWT와 Supabase RLS로 처리한다. Pages Functions는 서비스 역할 키가 필요한 탈퇴 처리와 서버 전용 속도 제한 처리에서만 이를 사용한다.

## 3. CAPTCHA·속도 제한 운영 경계

| 흐름 | 구현된 서버 통제 | 공개 전 운영자 확인 |
|---|---|---|
| OTP 요청 | 이메일 입력 형식 검증, 해시 키 기반 10분 3회 제한, 중립 응답 | Turnstile 사이트 키·위젯 연동이 완료되기 전에는 `TURNSTILE_REQUIRED=false`로 운영자 테스트만 수행한다. |
| OTP 검증 | 6자리 형식 검증, 해시 키 기반 10분 5회 제한, 중립 오류 | 외부 Preview에서는 CAPTCHA 토큰을 제공하는 UI 연동과 서버 검증을 함께 확인한다. |
| 게시물·댓글 작성·수정·삭제 | 인증 JWT, RLS, 사용자 기반 속도 제한, HTML 태그 차단 | 게시물·댓글 생성 경로에서 CAPTCHA 요구 여부와 한도는 외부 Preview 보안 점검에서 결정한다. |
| 탈퇴 | 인증 JWT, 사용자 기반 시간당 2회 제한, 세션·Auth 계정 삭제 | 삭제·익명화 선택이 검색 인덱스·캐시·백업 정책과 일치하는지 확인한다. |

## 4. Preview 공개 전 필수 검수

| 검수 | 완료 기준 |
|---|---|
| 공개 읽기 | 로그인 없이 `/community/`, 게시물 상세, 댓글을 읽을 수 있고 이메일·UUID가 응답에 노출되지 않는다. |
| 인증 쓰기 | 비로그인 POST/PATCH/DELETE가 401 또는 403으로 실패한다. |
| 소유권 | member A가 member B의 게시물·댓글을 수정·삭제하려 하면 RLS와 API가 차단한다. |
| 닉네임 | 이메일 인증 직후 닉네임 설정 전에는 쓰기·댓글이 거부된다. |
| 입력 보호 | HTML 태그 입력이 거부되고 `dangerouslySetInnerHTML` 없이 텍스트로 렌더링된다. |
| OTP | 만료·오입력·재요청 제한·계정 열거 방지 응답·속도 제한을 확인한다. |
| 탈퇴 | 세션 즉시 폐기, 선택한 익명화·삭제 동작, 최대 7일 계정 정보 삭제와 최대 30일 콘텐츠 물리 삭제 작업을 점검한다. |
| 감사 | 역할 부여·회수, 긴급 숨김, 장기 제재 관련 감사 기록과 1년 보존·파기 절차를 확인한다. |
| 법률 검토 | 개인정보 처리방침·이용약관·투자정보 고지의 최종 전문 검토를 완료한다. |

## 5. 로컬 환경 변수 예시

로컬 개발자는 실제 `.dev.vars`를 개인 보안 저장소에서만 만들고 Git에 추가하지 않는다.

```dotenv
SUPABASE_URL=https://your-community-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
COMMUNITY_RATE_LIMIT_SALT=long-random-server-only-value
TURNSTILE_REQUIRED=false
TURNSTILE_SECRET_KEY=
```

> 이 예시는 변수 이름과 설정 경계만 설명한다. 실제 비밀값은 채팅, 소스코드, 커밋, 로그, 일반 문서에 기록하지 않는다.
