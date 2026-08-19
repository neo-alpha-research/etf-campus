# ETF Campus 로그인 기능 운영 배포 체크리스트

## 1. 현재 구현 범위

| 영역 | 상태 | 비고 |
|---|---|---|
| 이메일 회원가입·로그인 | 구현·테스트 완료 | D1 서버 세션과 HttpOnly 쿠키 사용 |
| 세션 조회·회원 API 보호 | 구현·테스트 완료 | `/api/member/*` 미들웨어 적용 |
| 현재 기기·전체 기기 로그아웃 | 구현·테스트 완료 | 세션 삭제와 세션 버전 무효화 |
| 비밀번호 재설정 | 구현·테스트 완료 | n8n 메일 Webhook 설정 후 공개 |
| 로그인·회원가입·재설정 화면 | 구현·정적 빌드 완료 | `/login`, `/register`, `/forgot-password`, `/reset-password` |
| 헤더 로그인 상태 | 구현·정적 빌드 완료 | 데스크톱·모바일 로그인/로그아웃 |
| ETF 비교·상세 게이트 | 구현·정적 빌드 완료 | 로그인 후 원래 URL로 복귀 |
| n8n 메일 자동화 | 템플릿·연동 코드 완료 | 실제 n8n URL·SMTP credential 설정 필요 |

## 2. 배포 전 순서

> **주의:** 아래 원격 D1 마이그레이션과 Cloudflare Pages 배포는 운영 상태를 변경합니다. 운영 담당자가 백업·도메인·환경 변수를 확인한 뒤 실행합니다.

### 2.1 원격 D1 스키마 적용

로컬 실행 검증을 마친 `0001_auth_foundation.sql`과 `0002_password_reset_tokens.sql`을 원격 D1에 적용합니다.

```bash
npx wrangler d1 execute etf-prices --remote --file migrations/0001_auth_foundation.sql
npx wrangler d1 execute etf-prices --remote --file migrations/0002_password_reset_tokens.sql
```

적용 뒤 Cloudflare D1 Console 또는 `wrangler d1 execute`로 `auth_users`, `auth_consents`, `user_sessions`, `password_reset_tokens` 테이블과 인덱스를 확인합니다.

### 2.2 Cloudflare Pages Secret·환경 변수 설정

| 이름 | 종류 | 운영 값 |
|---|---|---|
| `AUTH_PASSWORD_PEPPER` | Secret | 32자 이상 무작위 난수 |
| `PUBLIC_APP_ORIGIN` | 일반 환경 변수 | 예: `https://www.etfcampus.kr` |
| `N8N_AUTH_WEBHOOK_URL` | Secret | n8n 활성 Production Webhook URL |
| `N8N_WEBHOOK_SECRET` | Secret | n8n Header Auth의 Bearer 값과 동일한 32자 이상 난수 |
| `N8N_WEBHOOK_REQUIRED` | 일반 환경 변수 | `true` |
| `PASSWORD_RESET_DELIVERY_REQUIRED` | 일반 환경 변수 | `true` |

`AUTH_PASSWORD_PEPPER`, `N8N_WEBHOOK_SECRET`, `TEST_SENDER_SECRET`은 서로 다른 Secret을 사용합니다. `.env`, Git, n8n 실행 이력, 오류 로그에 원문을 넣지 않습니다.

### 2.3 n8n 활성화

1. `ETF_Campus_인증_이메일_자동화_워크플로우.json`을 import합니다.
2. Webhook 노드의 Authentication을 Header Auth로 설정합니다.
3. Send Email 노드에 SMTP credential·검증된 발신 도메인을 연결합니다.
4. 운영자 알림 노드는 필요한 경우에만 활성화하고, 고정 운영자 수신 주소를 입력합니다.
5. 워크플로우를 활성화하고 **Production URL**을 `N8N_AUTH_WEBHOOK_URL`에 설정합니다.
6. n8n 실행 이력의 성공 데이터 보관을 최소화하고, 원문 재설정 링크가 장기간 남지 않도록 보관 정책을 설정합니다.

### 2.4 Pages 배포

정적 화면은 `npm run build`로 `out/`에 생성되고, `functions/`는 Cloudflare Pages Functions로 함께 배포됩니다. 배포 전후에 `/api/auth/session`이 Pages Function으로 응답하는지 확인합니다.

## 3. 운영 승인 테스트

| 시나리오 | 기대 결과 |
|---|---|
| 신규 회원가입 | `201`, HttpOnly 세션 쿠키 발급, n8n 환영 메일 실행 |
| 잘못된 로그인 | `401 invalid_credentials`, 계정 존재 여부를 구분하지 않음 |
| 정상 로그인 | `200`, 세션 쿠키 발급, 헤더 사용자 상태 표시 |
| ETF 비교 클릭 | 비로그인 사용자는 가입 게이트 노출, 로그인·가입 후 `/compare/` 복귀 |
| ETF 상세 클릭 | 비로그인 사용자는 게이트 노출, 로그인·가입 후 원래 `/etf/<ticker>/` 복귀 |
| 로그아웃 | 헤더 상태 해제, 현재 세션만 제거 |
| 전체 기기 로그아웃 | 모든 세션 무효화 |
| 비밀번호 찾기 | 등록·미등록 이메일 모두 `202`, 등록 이메일에는 n8n 재설정 메일 |
| 비밀번호 재설정 | 토큰 1회만 사용, 새 비밀번호 저장 후 전 기기 세션 제거 |
| 재설정 링크 만료 | `400 invalid_or_expired_token` |

## 4. 출시 이후 보호 조치

Cloudflare WAF Rate Limiting을 `/api/auth/register`, `/api/auth/login`, `/api/auth/password-reset-request`에 적용합니다. 이메일 발송량이 커지면 Cloudflare Turnstile을 회원가입·비밀번호 재설정 요청에 추가합니다. 또한 비밀번호 재설정 화면은 토큰 처리 후 `history.replaceState`로 URL query string을 제거하며, 배포 응답에 `Referrer-Policy: no-referrer`를 설정하는 것을 권장합니다.

## 5. 롤백 원칙

인증 API 장애 시 ETF 탐색 페이지와 공개 콘텐츠는 계속 제공되어야 합니다. 비교·상세 게이트가 전환을 막는 경우에는 직전 정적 배포 버전으로 되돌리거나, `AuthGate` 연결을 제거한 다음 배포합니다. 원격 D1의 회원·세션 데이터는 롤백 때 삭제하지 않습니다.

## References

[1]: https://developers.cloudflare.com/d1/ "Cloudflare D1"
[2]: https://developers.cloudflare.com/pages/functions/ "Cloudflare Pages Functions"
[3]: https://developers.cloudflare.com/workers/configuration/secrets/ "Cloudflare Secrets"
[4]: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/ "n8n Webhook"
