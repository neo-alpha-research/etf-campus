# Antigravity 요청 프롬프트 — 마켓 브리핑 운영 콘솔 (Phase 1)

작성일 2026-08-20 · 아래 `---` 사이 전문을 그대로 복사해 Antigravity에 전달하십시오.
Phase 2 이후 범위는 문서 맨 끝 부록에 있습니다.

---

## 역할

당신은 **기존 `neo-alpha-research/etf-campus` 저장소를 점진적으로 개선하는 시니어 Cloudflare/Next.js 엔지니어**입니다. 새 프로젝트를 만들거나 기존 아키텍처를 교체하지 말고, 현재 코드를 먼저 읽고 **작은 단위의 migration·API·UI·테스트를 추가**하십시오.

- 저장소 `neo-alpha-research/etf-campus`, 기본 브랜치 `main`
- Next.js App Router + TypeScript + Tailwind, **`next.config.ts`에 `output: "export"` (완전 정적 export)**
- 서버 런타임은 Cloudflare **Pages Functions** (`functions/` 디렉터리)
- D1 바인딩 `ETF_PRICES`, KV 바인딩 `BRIEFING_KV` (`wrangler.toml` 참조)
- 테스트 러너는 **vitest** (`npm test`), 린트 `npm run lint`, 빌드 `npm run build`

## 0. 검증된 현재 상태 — 이 사실을 전제로 작업하십시오

아래는 2026-08-20 기준으로 실제 저장소를 확인한 결과입니다. 추측하지 말고 이 목록을 기준으로 삼되, 작업 시작 시 한 번 더 확인하십시오.

**이미 존재하며 절대 깨뜨리면 안 되는 것**

| 항목 | 실제 경로 |
| --- | --- |
| 서명 ingest 엔드포인트 | `functions/api/internal/ingest-market-source.js` |
| 공개 브리핑 API | `functions/api/briefings/latest.js`, `history.js`, `[date].js` |
| 공개 브리핑 UI | `components/market-briefing-v0.tsx`, `app/briefing/**` |
| 이벤트 디스패처 Worker | `workers/market-event-dispatcher/` (cron 있음, Queue producer) |
| 퍼블리셔 Worker | `workers/market-briefing-publisher/` (Queue consumer, DLQ 구성됨) |
| Queue | `etf-campus-market-data-ready` (+ `-dlq`, preview 별도) |
| 적용된 migration | `migrations/0001` ~ `0007` |
| 커뮤니티 인증 | `functions/api/community/auth/*`, `functions/api/community/_lib/session.js` |
| 운영 규칙 문서 | `HANDOVER.md`, `OPERATING_PLAYBOOK.md`, `RELEASE_APPROVAL_CHECKLIST.md` |

**존재하지 않는 것 — 이전 명세서가 잘못 참조했으니 주의하십시오**

- `functions/_shared/auth.js` **없음**. `functions/_shared/`에는 `n8n.js` 하나뿐입니다.
- `functions/api/auth/login.js`, `functions/api/auth/session.js` **없음**.
- `functions/_shared/rbac.js` **없음** (이번에 신규 작성).
- `AGENTS.md` **없음**. 규칙은 위 운영 문서 3종을 따르십시오.
- `app/admin/**` 라우트 **없음** (이번에 신규 작성).

**가장 중요한 사실 — 현재 인증은 D1이 아니라 Supabase입니다**

`migrations/0001_auth_foundation.sql`에 `auth_users`, `user_sessions`, `auth_consents` 테이블이 정의되어 있지만, **실제 커뮤니티 인증 경로는 전부 Supabase Auth를 사용합니다.** `functions/api/community/_lib/session.js`는 Supabase만 참조하고 D1 접근이 없으며, 쿠키도 `__Host-etf-campus-community-at` / `-rt` / `-csrf` / `-rm` 입니다.

따라서 **"기존 D1 opaque session을 재사용"하는 것은 불가능합니다.** 그런 코드는 존재하지 않습니다. 이번 작업에서는 운영자 인증을 D1 위에 **신규 구축**하되, 커뮤니티의 Supabase 인증은 **손대지 않습니다.**

## 1. 이번 PR의 범위

**구현할 것**

1. 마켓 브리핑 **editorial(원고) 스키마**를 D1에 추가 — 문서·revision·이벤트·캐시 outbox
2. 자동 생성된 정량 브리핑 위에 **운영자가 텍스트만 편집/발행/롤백**하는 Pages Functions API
3. **운영자 전용 D1 세션 로그인** (커뮤니티 Supabase 세션과 완전히 분리)
4. `/admin/market-briefings` **운영 콘솔 UI**
5. 공개 API에 **additive**로 editorial 필드 노출, `/briefing` 화면이 발행본을 표시
6. 위 전부에 대한 vitest 테스트와 Preview 검증

**이번 PR에서 하지 말 것 (명시적 비범위)**

- 커뮤니티 Supabase → D1 인증 마이그레이션 / dual-session bridge → **Phase 3에서 별도 PR**
- 커뮤니티 RBAC(moderator/manager) 확장 → **Phase 2**
- auth migration 관측 대시보드, alert outbox, webhook 발송 → **Phase 4**
- 외부 LLM 호출, 새 AI API 키 도입
- **새 cron 추가** — 무료 플랜 cron 5슬롯이 이미 소진되어 있습니다. 기존 Queue를 재사용하십시오.
- 기존 테스트 삭제·skip·완화

## 2. 안전 원칙

1. 기존 수집→ingest→snapshot→dispatcher→queue→publisher 정상 경로를 깨지 마십시오.
2. **수집 원본과 정량 지표는 불변입니다.** 운영자 UI/ API가 이를 수정할 수 없어야 합니다.
3. feature branch에서 작업하고, PR 생성 전 `npm test`, `npm run lint`, `npm run build`, `npx tsc --noEmit`을 통과시키십시오.
4. Preview D1에서 migration과 mutation 테스트를 마치기 전에는 **Production migration·deploy를 실행하지 마십시오.**
5. Production 배포는 diff와 결과를 보고한 뒤 **명시적 승인**이 있을 때만 실행하십시오.
6. 시크릿(API key, cookie, JWT, HMAC secret, Cloudflare token)을 코드·로그·UI·테스트 fixture에 노출하지 마십시오.
7. UI 문구는 한국어로 작성하며 **매수·매도·추천·예측·수익 보장 표현을 쓰지 마십시오.**

> 별도 보고 사항: 저장소 루트에 `.preview-hmac-secret.tmp`와 `.manus-inspect-temp/`가 커밋되어 있습니다. 실제 비밀값이면 즉시 회수·교체가 필요합니다. 코드 변경과 별개로 PR 설명에 지적만 남기고, 임의로 삭제하지는 마십시오.

## 3. 착수 전 조사 (PR 설명에 표로 정리)

1. `migrations/0004_market_briefing_v0.sql`, `0006`, `0007`을 읽고 `market_briefings`의 **실제 컬럼명과 PK/UNIQUE 제약**을 확인하십시오. 아래 §5의 FK가 성립하려면 `market_briefings.as_of_date`가 UNIQUE여야 합니다. **아니면 FK를 생략하고 애플리케이션 레벨 검증으로 대체하십시오.**
2. `functions/api/briefings/latest.js`와 `components/market-briefing-v0.tsx`를 읽고 **공개 API 응답 계약을 깨지 않는 방법**을 확정하십시오.
3. `workers/market-briefing-publisher/src/*`를 읽고 KV 키 규칙과 기존 publication cache 구조를 파악해 **중복 구현 없이 재사용**하십시오.
4. `functions/api/community/_lib/api-security.ts`, `request-security.js`의 기존 오류 응답·CSRF·Origin 검증 컨벤션을 파악해 동일하게 따르십시오.
5. 기존 `.test.ts` 파일들의 vitest 컨벤션을 따르십시오.

## 4. 운영자 인증 (D1 신규 구축, 커뮤니티와 분리)

### 4.1 원칙

- 커뮤니티 Supabase 인증 코드·쿠키·테이블을 **일절 수정하지 마십시오.**
- 운영자 세션은 **별도 쿠키 `__Host-etf_admin_session`** 을 사용합니다. 커뮤니티 쿠키와 이름이 겹치면 안 됩니다.
- 세션은 D1 `user_sessions`에 저장하는 **opaque 랜덤 토큰**입니다. JWT를 쓰지 말고, `localStorage`에 어떤 토큰도 저장하지 마십시오.
- 쿠키: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, 절대 만료 + idle 만료.
- 운영자 계정은 **자동 가입 금지**. 초기 계정은 migration 또는 문서화된 수동 SQL로만 생성하고, 비밀번호 해시는 Workers 런타임에서 지원되는 방식(PBKDF2 via WebCrypto 등)을 사용하십시오. 평문·약한 해시 금지.

### 4.2 역할

이번 PR에서는 **단일 역할 `platform.owner`** 만 구현합니다. 다만 확장 가능하도록 아래 테이블 구조로 만드십시오.

```sql
auth_roles(role_key TEXT PRIMARY KEY, description TEXT)
auth_permissions(permission_key TEXT PRIMARY KEY, description TEXT)
auth_role_permissions(role_key, permission_key)
auth_role_grants(user_id, role_key, scope, scope_key, granted_at, expires_at, is_active)
```

권한 키는 `briefing.draft.read`, `briefing.edit`, `briefing.publish`, `briefing.rollback`, `security.audit.read`를 정의하고, `platform.owner`에 전부 부여하십시오. Phase 2에서 editor/reviewer/community 역할을 추가할 것이므로 스키마를 그에 맞게 열어두되 **이번에 그 역할들을 만들지는 마십시오.**

### 4.3 `functions/_shared/rbac.js`

모든 admin API가 공유하는 단일 helper를 만드십시오.

1. `__Host-etf_admin_session` 쿠키로 D1 세션 조회, 만료/비활성 확인
2. **write 요청은 `Origin` 헤더가 허용 origin과 일치하는지 검사**
3. 매 요청마다 D1에서 role/permission을 조회 (캐시하지 말 것)
4. 401 / 403 / 503 응답 형식을 기존 `api-security` 컨벤션에 맞춤
5. 권한 거절, publish, rollback을 audit 테이블에 기록
6. **UI에서 메뉴를 숨기는 것은 보안이 아닙니다. 권한 판단은 항상 서버에서 합니다.**

### 4.4 정적 export로 인한 필수 제약 — 반드시 반영

`output: "export"` 때문에 `app/admin/**`은 **서버 렌더링 없이 정적 HTML로 빌드되어 누구나 URL로 접근할 수 있습니다.** 따라서:

- admin 페이지는 **초기 렌더에서 어떤 운영 데이터도 포함하지 않아야** 합니다. 인증된 API 응답을 받은 뒤에만 내용을 그립니다.
- 인증 실패 시 즉시 `/login`으로 보내되, 그 전에 민감 정보가 화면에 노출되면 안 됩니다.
- `/admin/**`에 `noindex`를 적용하고 `robots.txt`에서도 차단하십시오.
- PR 설명에 **"관리자 화면을 Cloudflare Zero Trust Access로 감싸는 것을 권장"** 이라고 남기십시오. 무료 플랜으로 소수 사용자를 커버할 수 있어 1인 운영에 적합한 추가 방어선입니다. 다만 이번 PR에서 설정을 자동화하지는 마십시오.

## 5. Editorial 스키마 (migration `0008`)

현재 마지막 migration이 `0007`임을 확인한 뒤 `0008_market_briefing_editorial.sql`을 만드십시오. 아래는 목표 구조이며, 컬럼명·타입은 기존 컨벤션에 맞게 조정해도 됩니다. **동일 목적의 테이블이 이미 있으면 중복 생성하지 말고 통합하십시오.**

```sql
CREATE TABLE market_briefing_editorial_documents (
  briefing_id TEXT PRIMARY KEY,
  as_of_date TEXT NOT NULL UNIQUE,
  base_source_version TEXT NOT NULL,
  base_metrics_hash TEXT NOT NULL,
  current_revision_no INTEGER NOT NULL DEFAULT 1,
  published_revision_no INTEGER,
  published_version INTEGER NOT NULL DEFAULT 0,
  public_state TEXT NOT NULL DEFAULT 'draft'
    CHECK (public_state IN ('draft','published','withdrawn','needs_rebase')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT
);

CREATE TABLE market_briefing_editorial_revisions (
  revision_id TEXT PRIMARY KEY,
  briefing_id TEXT NOT NULL,
  revision_no INTEGER NOT NULL,
  workflow_status TEXT NOT NULL
    CHECK (workflow_status IN ('draft','published','superseded','withdrawn')),
  origin TEXT NOT NULL CHECK (origin IN ('system','editor','restore')),
  base_metrics_hash TEXT NOT NULL,
  base_metrics_json TEXT NOT NULL,
  title TEXT NOT NULL,
  one_line_text TEXT NOT NULL,
  market_temperature_commentary TEXT NOT NULL,
  summary_markdown TEXT NOT NULL,
  newsletter_cta_title TEXT,
  newsletter_cta_body TEXT,
  newsletter_cta_url TEXT,
  disclosure_text TEXT NOT NULL,
  change_summary TEXT NOT NULL,
  created_by_user_id TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (briefing_id, revision_no),
  FOREIGN KEY (briefing_id) REFERENCES market_briefing_editorial_documents(briefing_id) ON DELETE CASCADE
);

CREATE TABLE market_briefing_editorial_events (
  event_id TEXT PRIMARY KEY,
  briefing_id TEXT NOT NULL,
  revision_no INTEGER,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('system','user')),
  actor_user_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE market_briefing_editorial_cache_outbox (
  event_id TEXT PRIMARY KEY,
  briefing_id TEXT NOT NULL,
  as_of_date TEXT NOT NULL,
  revision_no INTEGER NOT NULL,
  published_version INTEGER NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('publish','rollback','withdraw')),
  delivery_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN ('pending','processing','sent','failed','discarded')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  sent_at TEXT,
  updated_at TEXT NOT NULL
);
```

`in_review` / `approved` 상태를 **일부러 뺐습니다.** 현재 운영자가 1명이므로 검토 승인 단계는 마찰만 만듭니다. Phase 2에서 reviewer 역할을 도입할 때 CHECK 제약을 확장하십시오.

**같은 migration 파일 하단에 롤백 SQL을 주석으로 첨부하십시오** (`DROP TABLE` 순서 포함). 적용 실패 시 복구 절차가 문서에 남아야 합니다.

### 5.1 라이프사이클

```
기존 자동 pipeline이 market_briefings 생성
  → origin='system' 초기 draft revision 자동 생성 (외부 LLM 호출 없이 결정론적 템플릿)
  → 운영자 저장 시 새 revision 생성 (기존 revision을 절대 덮어쓰지 않음)
  → 발행 시 document pointer + published_version + cache outbox를 D1 batch로 원자 기록
  → Queue consumer가 KV payload와 latest pointer를 갱신
  → 공개 API가 published revision 텍스트 + 기존 정량 metrics를 조합해 응답
```

- **롤백은 포인터 되돌리기가 아닙니다.** 과거 revision의 텍스트를 복제한 `origin='restore'` 신규 revision을 만들고 새 `published_version`으로 발행하십시오.
- source snapshot이 교정되어 `source_version`이 바뀌면 발행본을 묵시적으로 덮어쓰지 말고 `needs_rebase`로 표시하십시오.
- **D1이 원장이고 KV는 가속 캐시입니다.** KV를 revision 이력의 출처로 쓰지 마십시오.

## 6. 데이터 소유권

### 6.1 운영자가 수정할 수 없는 값

기준일, source version, KOSPI/KOSDAQ 등 지수, ETF breadth, AUM 가중 수익률, 순자산·거래대금, 품질 검증 결과. 이 값들의 출처는 기존 snapshot/`market_briefings`입니다.

- 편집 payload에 이 값들을 **포함하지 마십시오.**
- 프론트엔드에서 `readonly` input으로도 두지 말고 **별도 읽기 전용 패널**로 렌더하십시오. 편집 가능한 form state에 숫자가 들어가면 안 됩니다.
- 서버는 요청 body를 **allowlist**로 필터링하고, allowlist 밖의 필드가 오면 400 또는 무시 후 audit 기록하십시오.

### 6.2 편집 가능 항목과 검증

| 항목 | 제한 |
| --- | --- |
| `title` | 10~100자 |
| `one_line_text` | 20~180자 |
| `market_temperature_commentary` | 40~500자 |
| `summary_markdown` | 안전한 Markdown, raw HTML 금지 또는 정화 |
| `newsletter_cta_title/body/url` | URL은 HTTPS + 허용 도메인 검증 |
| `disclosure_text` | 기본 템플릿 유지, 제한적 수정 |
| `change_summary` | 필수, 8~240자 |

**동시성·정합성 검사 (발행 전 전부 통과해야 함)**

- `base_source_version`, `base_metrics_hash`가 현재 문서와 일치 — 불일치 시 `409 source_revision_required`
- `expectedRevisionNo` 불일치 시 `409 revision_conflict`
- publish / rollback은 revision·pointer·event·outbox를 **하나의 D1 batch/transaction**으로 기록

**금칙어 검사**: "매수", "매도", "추천", "확실", "예측" 등 직접적 투자 권유 표현이 있으면 **draft 저장은 허용하되 발행은 차단**하고 한국어로 사유를 표시하십시오. 오탐 가능성이 있으므로 검사 결과는 audit metadata에 남기되 본문 원문을 보안 로그에 과도하게 복사하지 마십시오.

## 7. API 계약

### 공개 API — additive만

`/api/briefings/latest`의 기존 필드를 바꾸거나 제거하지 말고 `editorial` 객체만 추가하십시오.

```json
{
  "briefing": {
    "asOfDate": "YYYY-MM-DD",
    "pulse": { "...": "기존 정량 값 그대로" },
    "marketIndices": [],
    "editorial": {
      "briefingId": "...",
      "revisionNo": 3,
      "publishedVersion": 2,
      "title": "...",
      "oneLineText": "...",
      "marketTemperatureCommentary": "...",
      "summaryMarkdown": "...",
      "newsletterCta": { "title": "마켓 인사이트", "body": "...", "url": "..." },
      "disclosureText": "...",
      "updatedAt": "ISO-8601"
    }
  }
}
```

발행된 revision이 없으면 `editorial`은 `null`이고, 공개 화면은 기존 정량 브리핑만 보여주면 됩니다.

### 운영 API

| Method / route | 권한 | 기능 |
| --- | --- | --- |
| `POST /api/admin/auth/login` | — | 운영자 로그인, 세션 쿠키 발급 |
| `POST /api/admin/auth/logout` | 세션 | 세션 폐기 |
| `GET /api/admin/auth/session` | 세션 | 현재 세션·권한 조회 |
| `GET /api/admin/market-briefings` | `briefing.draft.read` | 기준일·상태·revision 목록 |
| `GET /api/admin/market-briefings/:id` | `briefing.draft.read` | 읽기 전용 metrics + 현재 revision |
| `GET /api/admin/market-briefings/:id/history` | `briefing.draft.read` | revision 타임라인 |
| `POST /api/admin/market-briefings/:id/revisions` | `briefing.edit` | allowlist draft 저장 |
| `POST /api/admin/market-briefings/:id/publish` | `briefing.publish` | 발행 + cache outbox |
| `POST /api/admin/market-briefings/:id/rollback` | `briefing.rollback` | restore revision 생성 후 발행 |
| `POST /api/admin/market-briefings/:id/withdraw` | `briefing.publish` | 공개 포인터 회수 |

로그인 엔드포인트에는 **rate limit과 실패 지연**을 넣고, 계정 존재 여부가 응답으로 새어나가지 않게 하십시오.

## 8. 운영 콘솔 UI

라우트 `/admin/market-briefings`(목록), `/admin/market-briefings/[briefingId]`(편집). 한국어 UI, Tailwind, 기존 `@/components`와 포매터 재사용, ETF 캠퍼스의 밝은 연두 계열을 쓰되 가독성 우선.

| 영역 | 내용 | 편집 |
| --- | --- | --- |
| 상단 고정 bar | 기준일, source version, 검증 badge, 상태, 저장·미리보기·발행 버튼 | 상태별 |
| 좌측 30% | KOSPI/KOSDAQ, ETF breadth, AUM 가중 수익률, 순자산·거래대금, source 기준일 | **완전 읽기 전용** |
| 중앙 45% | 제목, 오늘의 한 줄, 시장 온도 해설, Markdown 본문, CTA, 고지문 | 편집 가능 |
| 우측 25% | 모바일/데스크톱 미리보기, 발행 검증 결과, revision 타임라인 | 발행·롤백 |

- 저장 시 **새 revision이 생성된다는 사실과 revision 번호**를 화면에 명시하십시오.
- 발행·롤백은 확인 modal에서 기준일·대상 revision·사유 입력을 요구하십시오.
- source version 불일치, metrics hash 불일치, 금칙어, 고지문 누락, 잘못된 CTA URL, stale revision을 **발행 전에 눈에 띄게** 표시하십시오.
- 공개 `/briefing`은 발행본이 있으면 그 텍스트 + 기존 정량 데이터를 보여주고, 없으면 "최신 브리핑 준비 중"을 표시하십시오. 현재의 "학습용 예시"가 실제 운영 데이터처럼 보이지 않게 하십시오.
- 공개 탭 제목은 **마켓 브리핑**, 영문 보조 표기는 **MARKET BRIEFING**. CTA는 **마켓 인사이트** 뉴스레터로 유도하되 추천·수익 보장·예측 표현을 쓰지 마십시오. 고지문은 항상 하단에 노출하십시오.

## 9. 캐시와 outbox

1. D1의 발행 포인터가 source of truth입니다.
2. publish / rollback / withdraw 시 outbox 이벤트를 **같은 batch로** 기록하십시오.
3. **새 cron을 만들지 마십시오.** 기존 `market-event-dispatcher`의 outbox drain 경로나 기존 Queue consumer를 확장해 재사용하십시오. 불가피하게 consumer를 추가한다면 cron 없이 Queue consumer만 추가하십시오.
4. KV 기록 순서: 버전 키 `market-briefing:v1:public:{asOfDate}:v{publishedVersion}` → 마지막에 `market-briefing:v1:latest-pointer`. 기존 publisher의 KV 키 컨벤션과 충돌하지 않게 먼저 확인하십시오.
5. KV 기록이 실패해도 D1 발행은 유지하고 outbox 재시도가 가능해야 합니다.
6. Queue는 at-least-once이므로 이벤트 처리와 KV 기록을 **멱등**하게 구현하십시오.
7. withdraw는 latest pointer를 제거하고, 공개 API가 D1 fallback에서 withdrawn 상태를 올바르게 처리해야 합니다.

## 10. 감사 로그

D1에 다음을 기록하십시오: `admin_login_succeeded`, `admin_login_failed`, `admin_session_revoked`, `operator_access_denied`, `briefing_revision_saved`, `briefing_published`, `briefing_rolled_back`, `briefing_withdrawn`.

- 평문 비밀번호, 원본 세션 쿠키, 원본 토큰을 기록하지 마십시오.
- 클라이언트 IP와 User-Agent는 **pepper를 사용한 HMAC 해시로만** 보관하십시오.

## 11. 테스트

**vitest 테스트 (필수)**

- 세션 없이 admin API 호출 → 401
- 권한 없는 사용자 → 403
- 편집 payload에 정량 필드가 섞이면 400 또는 allowlist에서 제거 + audit 기록
- 저장은 기존 revision을 덮어쓰지 않고 새 revision을 만든다
- `expectedRevisionNo` 불일치 → 409
- source version 불일치 → 409
- publish 후 cache outbox 행이 생성된다
- rollback은 `origin='restore'` 신규 revision과 새 published_version을 만든다
- 동일 outbox 이벤트 재처리가 안전하다 (멱등)
- 금칙어 포함 시 draft 저장은 성공하고 publish는 차단된다
- 공개 API에 발행본이 없을 때 기존 응답 계약이 그대로 유지된다

**cURL 스모크 스크립트** `scripts/test-market-briefing-editorial-api.sh`

- 기본 실행은 **read-only**
- mutation은 `ALLOW_MUTATION=1` **그리고** Preview fixture ID일 때만
- Production mutation은 `ALLOW_PRODUCTION_MUTATION=1`을 추가로 요구하며 CI에서 실행하지 않음

**품질 게이트** — 실제 실행하고 결과를 PR 설명에 남기십시오.

```bash
npm test
npm run lint
npm run build
npx tsc --noEmit
```

## 12. 배포 순서

**Preview**
1. feature branch에 migration·Functions·UI·테스트 추가
2. Preview D1(`etf-prices-preview`)에 migration 적용
3. Preview 배포 후 read-only + mutation 스모크 테스트
4. D1에서 revision/event/outbox/KV 상태를 read-only SQL로 확인

**Production (승인 후에만)**
1. PR diff, migration 영향, Preview 테스트 결과, production schema diff를 보고
2. **명시적 승인 후** production migration 적용
3. 기존 릴리스 순서를 따름: 검증 → D1 migration → Workers/Queue → Pages
4. Production에서는 **read-only 스모크 테스트만** 수행. 실제 발행본에 rollback mutation 테스트를 하지 마십시오.
5. 배포 직후 확인: 서명 없는 ingest 요청 401 / 공개 브리핑 API 계약 정상 / admin API 미인증 401·미권한 403 / Queue·outbox 오류 없음

## 13. 산출물

1. feature branch와 PR URL
2. 변경 파일 목록과 각 역할
3. migration 목록과 roll-forward·rollback 영향
4. 실행한 테스트 명령과 실제 결과
5. Preview 배포 URL과 스모크 테스트 결과
6. 남은 수동 설정: D1/KV/Queue 바인딩, 시크릿 이름, 운영자 초기 계정 생성 절차
7. Production 배포 직전 체크리스트
8. **구현하지 않았거나 위험이 있는 항목을 숨기지 말고 명확히 보고**

### Definition of Done

- 자동 snapshot 파이프라인과 공개 API 계약이 깨지지 않음
- 운영자가 정량 지표를 수정할 수 없음
- 모든 수정이 불변 revision 이력으로 남음
- rollback이 새 restore revision을 생성함
- D1이 세션·권한·revision의 source of truth
- **커뮤니티 Supabase 로그인이 이번 변경으로 전혀 영향받지 않음**
- 새 cron이 추가되지 않음
- `/admin/**`이 정적 export 환경에서 데이터를 선노출하지 않음
- Preview 검증 완료, Production 배포는 명시적 승인 이후에만

## 마지막 지침

현재 스키마·코드 컨벤션과 이 명세가 충돌하면 **임의로 대규모 리팩터링하지 말고 기존 data contract 보존을 우선**하십시오. 테이블명·파일 확장자는 저장소 컨벤션에 맞게 조정해도 되지만, 보안·권한·정량 데이터 불변성·기존 파이프라인 보호·테스트 기준은 낮추지 마십시오. 명세와 실제 코드가 다르면 **작업을 멈추고 차이를 먼저 보고**하십시오.

---

# 부록: 이후 단계

| Phase | 범위 | 선행 조건 |
| --- | --- | --- |
| **2** | `market_briefing.editor` / `reviewer` 역할 분리, 검토 승인 워크플로(`in_review`, `approved`), 커뮤니티 moderator/manager 역할 | 운영자가 2명 이상이 될 때. 1인 운영 동안은 불필요 |
| **3** | 커뮤니티 Supabase Auth → D1 무중단 전환 (dual-session bridge, identity link, feature flag rollout, kill switch) | Phase 1의 D1 세션이 운영에서 안정화된 뒤. **단독 PR로 진행하고 롤백 계획 필수** |
| **4** | auth migration 관측 대시보드, alert outbox, webhook/Slack 발송 | Phase 3 착수 시 함께 |

Phase 3은 커뮤니티 로그인 전체를 위험에 빠뜨리는 작업입니다. 브리핑 콘솔과 절대 같은 PR에 넣지 마십시오.
