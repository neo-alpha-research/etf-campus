# Antigravity 후속 지시 — Phase 1 구현 결함 수정 (Round 1)

작성일 2026-08-20 · 아래 `---` 사이 전문을 그대로 복사해 Antigravity에 전달하십시오.
대상 브랜치: `feat/admin-market-briefing-console`

---

## 상황

Phase 1 구현을 검토했습니다. UI와 API 파일 구조는 잘 잡혔지만, **DB 스키마와 코드가 서로 다른 테이블·컬럼을 참조하고 있어 운영자 로그인이 첫 시도에서 실패합니다.** 아래 결함을 수정한 뒤에야 Preview 검증으로 넘어갈 수 있습니다.

`npm test`가 통과한 것은 정상 신호가 아닙니다. **신규 테스트를 하나도 추가하지 않아 새 코드가 단 한 줄도 실행되지 않았기 때문**입니다. 이번 라운드에서는 반드시 실행 경로를 테스트로 덮어야 합니다.

## 1. 치명적 결함 — 반드시 수정

### 1-1. 코드가 참조하는 테이블이 마이그레이션에 없습니다

| 코드가 참조 | 마이그레이션이 생성 | 결과 |
| --- | --- | --- |
| `admin_user_sessions` | `user_sessions` | 로그인 시 `no such table` |
| `admin_auth_roles` | `auth_roles` | 권한 조회 실패 |

**해결 방침: 마이그레이션을 코드 쪽 이름에 맞추십시오.** 신규 인증 테이블은 전부 `admin_` 접두사로 통일합니다. 기존 커뮤니티/레거시 테이블과 이름이 겹치지 않게 하는 것이 목적입니다.

```
admin_users
admin_user_sessions
admin_auth_roles
admin_auth_permissions
admin_auth_role_permissions
admin_auth_role_grants
admin_audit_logs
```

`functions/api/admin/**`, `functions/_shared/rbac.js`의 모든 SQL을 위 이름으로 통일하고, **테이블명이 코드와 마이그레이션에서 100% 일치하는지 grep으로 확인한 결과를 보고하십시오.**

### 1-2. `user_sessions` 재정의 — 조용히 무시되는 시한폭탄

`migrations/0001_auth_foundation.sql`에 이미 `user_sessions`가 존재합니다.

```sql
-- 0001 (기존)
CREATE TABLE IF NOT EXISTS user_sessions (
  session_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, session_version INTEGER NOT NULL,
  token_hash TEXT NOT NULL, ..., idle_expires_at INTEGER NOT NULL, absolute_expires_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);
```

0008이 같은 이름을 `CREATE TABLE IF NOT EXISTS`로 다시 만들고 있어, **실제 DB에서는 새 정의가 적용되지 않고 조용히 무시됩니다.** 마이그레이션은 성공한 것처럼 보이지만 컬럼은 옛것 그대로입니다.

→ **0008에서 `user_sessions` 생성문을 완전히 삭제하고 `admin_user_sessions`로 대체하십시오. 0001은 절대 수정하지 마십시오.**

### 1-3. `admin_audit_logs` 컬럼이 전부 다릅니다

```
코드가 쓰는 컬럼        : log_id, action_name, actor_user_id, ip_address, user_agent, resource_snapshot
마이그레이션이 만든 컬럼 : log_id, action_type, user_id, session_token_hash,
                          ip_address_hash, user_agent_hash, target_resource, metadata_json, created_at
```

겹치는 것은 `log_id` 하나뿐이라 감사 로그 기록이 전부 실패합니다. **하나로 통일하되, 아래 1-4를 함께 반영하십시오.**

### 1-4. 원본 IP / User-Agent를 그대로 저장하고 있습니다 (스펙 위반)

`functions/api/admin/auth/login.js`와 `functions/_shared/rbac.js`가 `ip_address`, `user_agent`를 평문으로 INSERT합니다. 명세는 **pepper를 사용한 HMAC 해시만 저장**하도록 요구했습니다.

- 컬럼명을 `ip_hash`, `user_agent_hash`로 바꾸고, 값은 `HMAC-SHA256(pepper, value)` 결과만 저장하십시오.
- pepper는 Cloudflare secret(예: `AUDIT_HASH_PEPPER`)에서 읽고, 코드·로그·테스트 fixture에 하드코딩하지 마십시오.
- secret 미설정 시 기록을 건너뛰지 말고 **명시적으로 500을 반환**해 설정 누락이 드러나게 하십시오.

### 1-5. `/api/briefings/latest`에 editorial 주입이 사라졌습니다

작업 중 `git checkout main --`으로 되돌린 뒤 재적용하는 과정에서 유실된 것으로 보입니다. 현재 상태:

```
functions/api/briefings/latest.js  → "editorial" 언급 1회, 그것도 주석 한 줄뿐
functions/api/briefings/[date].js  → 정상 주입 (7회)
```

`latest.js`는 공개 화면이 실제로 호출하는 주 엔드포인트입니다. **지금 상태로는 브리핑을 발행해도 사이트에 반영되지 않습니다.** `[date].js`와 동일한 방식으로 다시 구현하고, 두 파일의 editorial 조립 로직을 **공용 helper로 추출해 중복을 제거**하십시오.

## 2. 반드시 함께 고칠 것

### 2-1. 마이그레이션 멱등성

```sql
INSERT INTO auth_roles (role_key, description) VALUES ('platform.owner', ...);
```

재실행 시 PRIMARY KEY 충돌로 실패합니다. **모든 시드 INSERT를 `INSERT OR IGNORE`로 바꾸십시오.**

### 2-2. 초기 운영자 계정을 만들 방법이 없습니다

`admin_users` 테이블만 있고 계정을 생성할 경로가 없어 **로그인 자체가 불가능**합니다. 다음을 제공하십시오.

- 비밀번호 해시는 Workers 런타임에서 동작하는 **PBKDF2(WebCrypto, 반복 횟수 명시) + per-user salt**를 사용
- `scripts/create-admin-user.mjs` 같은 **로컬 실행 스크립트**로 해시를 생성해 출력하고, 운영자가 그 결과를 `wrangler d1 execute`로 넣는 절차를 문서화
- 비밀번호를 명령행 인자로 받지 말고 stdin으로 입력받으십시오 (셸 히스토리 노출 방지)
- 마이그레이션 파일에 실제 계정이나 해시를 하드코딩하지 마십시오

### 2-3. 로그인 보호

`POST /api/admin/auth/login`에 **실패 횟수 기반 지연 또는 rate limit**을 넣고, 아이디 존재 여부가 응답·응답시간으로 구분되지 않게 하십시오(존재하지 않는 계정도 동일한 해시 연산 수행).

### 2-4. 에디터 라우트 변경 사항 보고

`app/admin/market-briefings/[asOfDate]`를 삭제하고 `app/admin/market-briefings/editor`로 바꾸셨습니다. 정적 export의 `generateStaticParams` 제약을 피하려는 판단으로 이해합니다. 타당하지만 명세와 다르므로:

- 목록 → 에디터 이동이 실제로 동작하는지(쿼리 파라미터 전달 포함) 확인
- 새로고침·직접 URL 접근·뒤로가기에서 기준일이 유지되는지 확인
- 변경 이유와 최종 URL 형식을 PR 설명에 명시

## 3. 테스트 — 이번 라운드의 핵심

**신규 vitest 테스트가 0개입니다.** 아래를 실제로 작성하고 통과시키십시오. D1은 Miniflare/`vitest-pool-workers` 또는 in-memory SQLite 대역으로 스키마를 실제 적용한 뒤 검증해야 합니다. **모킹으로 테이블 존재 여부를 가리지 마십시오 — 이번 결함이 정확히 그 지점에서 발생했습니다.**

- 마이그레이션 0008을 빈 DB에 적용 후, **코드가 참조하는 모든 테이블·컬럼이 실제로 존재하는지 검증** (이번 결함의 회귀 방지)
- 마이그레이션을 **연속 2회 적용해도 실패하지 않음** (멱등성)
- 세션 쿠키 없이 admin API 호출 → 401
- 권한 없는 사용자 → 403
- 로그인 성공 → `__Host-etf_admin_session` 쿠키 발급, DB에 세션 행 생성
- 로그아웃 → 세션 폐기, 이후 요청 401
- 편집 payload에 정량 필드가 섞이면 400 또는 allowlist 제거 + audit 기록
- 저장 시 기존 revision을 덮어쓰지 않고 새 revision 생성
- `expectedRevisionNo` 불일치 → 409
- `base_source_version` 불일치 → 409
- publish 후 `market_briefing_editorial_cache_outbox` 행 생성
- rollback이 `origin='restore'` 신규 revision + 새 published_version 생성
- 금칙어 포함 시 draft 저장은 성공, publish는 차단
- **발행본이 없을 때 `/api/briefings/latest` 기존 응답 계약이 그대로 유지됨** (회귀 방지)
- 발행본이 있을 때 `/api/briefings/latest`에 `editorial`이 채워짐

## 4. 실제 동작 검증 (빌드 통과는 검증이 아닙니다)

Preview 환경에서 **아래 시나리오를 끝까지 실행하고 각 단계의 실제 출력을 보고하십시오.** 코드 리뷰나 빌드 성공만으로 "완료"라고 보고하지 마십시오.

1. Preview D1(`etf-prices-preview`)에 0008 적용 → `PRAGMA table_info(...)`로 테이블·컬럼 실물 확인
2. 초기 운영자 계정 생성 → **실제로 로그인 성공** (쿠키 발급 확인)
3. 브리핑 목록 조회 → 편집기 진입 → 초안 저장 → **revision 번호 증가 확인**
4. 발행 → `market_briefing_editorial_cache_outbox`에 행 생성 확인
5. Queue consumer 처리 후 **KV에 `market-briefing:v1:*` 키 생성 확인**
6. `/api/briefings/latest` 호출 → **`editorial` 필드가 실제로 내려오는지 확인**
7. 로그아웃 후 admin API 호출 → 401 확인
8. 감사 로그 테이블에 로그인·발행 기록이 남았고 **IP/UA가 해시로만 저장**됐는지 확인

## 5. 마무리

1. 위 수정을 모두 반영한 뒤 `npm test`, `npm run lint`, `npm run build`, `npx tsc --noEmit`을 **실제로 끝까지 실행**하고 결과를 붙이십시오. (직전 보고에서 `npm run build`가 백그라운드 진행 중인 상태로 완료 보고가 나왔습니다. 완료 여부를 확인한 뒤 보고하십시오.)
2. 브랜치를 원격에 push하고 **PR을 생성**하십시오. 현재 원격에 브랜치가 없습니다.
3. PR 설명에 다음을 포함하십시오.
   - 테이블명·컬럼명 통일 전후 대조표
   - 신규 테스트 목록과 실행 결과
   - Preview 검증 8단계의 실제 출력
   - 에디터 라우트 변경 사유와 최종 URL 형식
   - 남은 위험과 미구현 항목
4. **Production 마이그레이션·배포는 실행하지 마십시오.** 명시적 승인 후에만 진행합니다.

## 6. 작업 원칙

- 기존 자동 수집 파이프라인(ingest → snapshot → dispatcher → queue → publisher)의 정상 경로를 깨지 마십시오.
- 커뮤니티 Supabase 인증 코드·쿠키·테이블을 수정하지 마십시오.
- 새 cron을 추가하지 마십시오.
- **PowerShell 인라인 문자열로 소스 파일을 생성하지 마십시오.** 지난 라운드에서 이스케이프 문제로 한글이 깨지고 파일이 반복 손상됐습니다. 파일 생성·수정은 에디터 도구나 Python/Node 스크립트를 사용하고, UTF-8로 저장하십시오.
- 정규식 일괄 치환으로 기존 파일을 수정하지 마십시오. `latest.js`의 editorial 로직이 그 과정에서 유실됐습니다.
- 확신이 서지 않으면 임의로 결정하지 말고 **작업을 멈추고 질문**하십시오.
