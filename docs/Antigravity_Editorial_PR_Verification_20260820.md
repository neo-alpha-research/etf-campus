# Antigravity 구현 보고 검증 결과

작성일: 2026-08-20
작성 주체: EVS Navigator
검증 대상: Antigravity의 "치명적 결함 수정 완료" 보고 6개 항목
검증 방법: 저장소 실물 파일 대조, `git diff` 및 `git show HEAD` 원본 비교, 프런트엔드 타입 계약 대조
판정: **머지 보류 권고**

---

## 결론

6개 항목 중 4개는 보고대로 반영되었으나, **4번 항목(`latest.js` Editorial 주입 복구)은 복구가 아니라 회귀입니다.** 두 개의 공개 API가 프런트엔드가 소비할 수 없는 형태로 재작성되었고, 이 상태로 배포하면 브리핑 대시보드가 빈 화면으로 렌더링됩니다. 빌드와 테스트가 통과하는 이유는 이 계약을 검증하는 테스트가 없기 때문입니다.

---

## P0. 공개 브리핑 API 2종이 프런트엔드 계약을 위반합니다

### 무엇이 사라졌는가

| 파일 | 원본(HEAD) | 현재 | 변화 |
|---|---|---|---|
| `functions/api/briefings/latest.js` | 160줄 | 49줄 | 111줄 삭제 |
| `functions/api/briefings/[date].js` | 135줄 | 40줄 | 123줄 삭제, 28줄 추가 |

원본 두 파일은 공통으로 `toResponsePayload()`를 통해 다음 형태를 반환했습니다.

```js
asOfDate, isStale, staleDays,
headline: { text, generationStatus },
marketIndices, pulse: { ...15개 필드 },
assetClasses, focusEtfs
```

현재 `_lib/editorial.js`의 `mergeBriefingData()`가 반환하는 형태는 다음과 같습니다.

```js
as_of_date, market_temperature, market_temperature_reason,
market_indices, etf_market_overview,
top_gainers, top_losers, top_volume, top_aum_growth,
thematic_trends, editorial
```

### 왜 문제인가

프런트엔드 `lib/hooks/use-market-briefing.ts`의 `MarketBriefing` 타입은 camelCase 계약을 요구합니다. 새 응답은 snake_case이며, 필드명이 겹치는 것이 하나도 없습니다. `asOfDate`와 `as_of_date`, `marketIndices`와 `market_indices`가 각각 다른 키입니다. 그리고 `isStale`, `staleDays`, `headline`, `pulse`, `assetClasses`, `focusEtfs`는 아예 존재하지 않습니다.

결정적 증거가 하나 더 있습니다. 저장소 전체에서 `isStale`, `assetClasses`, `focusEtfs`를 생성하는 파일을 검색하면 **`functions/api/briefings/latest.js.tmp` 하나만 나옵니다.** 이 파일은 git에 추적되지 않는 임시 잔재입니다. 즉 올바른 계약을 만들어내는 코드가 실사용 경로에서 완전히 사라지고, 백업 찌꺼기에만 남아 있는 상태입니다.

### 함께 사라진 기능 두 가지

첫째, **D1 폴백이 제거되었습니다.** 원본 `latest.js`는 KV 미스 시 `ETF_PRICES`에서 `WHERE status = 'ready'` 행을 직접 조회하고 자산군·포커스 ETF를 병렬로 가져왔습니다. 현재는 KV가 비어 있으면 그대로 404 `cache_miss`를 반환합니다. 훅 상단 주석에도 "KV 최신 pointer를 먼저 읽고 D1 ready row로 fallback한 결과를 조회합니다"라고 명시되어 있는데, 그 fallback이 없어졌습니다.

둘째, **신선도 판정이 제거되었습니다.** 원본의 `toKstDate`, `dateDiffInDays`, `withFreshness`가 `isStale`과 `staleDays`를 계산해 UI에 전달했습니다. 훅 주석의 "stale 상태는 briefing.isStale로 UI에 전달됩니다"가 이제 성립하지 않습니다. 이는 지난 파이프라인 검토에서 강조한 "잘못된 기준일을 감추지 않는다"는 원칙이 화면 단에서 무력화되었다는 뜻입니다.

### 왜 빌드와 테스트가 통과했는가

Cloudflare Pages Functions는 타입 없는 `.js`이고, 프런트엔드 계약은 `.ts`에 있습니다. 둘 사이를 잇는 타입 검사나 계약 테스트가 없으므로 `tsc --noEmit`도 `npm run build`도 이 불일치를 볼 수 없습니다. 이번에 추가된 `admin-api.test.ts`는 관리자 API만 다루며 공개 브리핑 엔드포인트를 건드리지 않습니다.

보고서 말미의 "tsc의 타입 체크 역시 무시할 수 있는 경고 수준"이라는 표현도 그대로 받아들이기 어렵습니다. 실제로 `latest.js`는 `mergeBriefingData`를 import 해놓고 한 번도 사용하지 않습니다. 린트가 통과했다면 미사용 import 규칙이 꺼져 있다는 뜻이고, 그렇다면 린트를 품질 게이트로 신뢰할 수 없습니다.

### 조치

머지 전에 두 엔드포인트를 원본 계약으로 되돌린 뒤, editorial 오버레이만 기존 payload에 필드 하나로 덧붙이십시오. 즉 `toResponsePayload()`를 유지한 채 결과 객체에 `editorial` 키를 추가하는 방식이어야 합니다. 재작성이 아니라 증분 추가가 원래 요구사항이었습니다.

되돌린 뒤에는 계약 회귀 테스트를 하나 추가하십시오. 두 엔드포인트의 응답에 `asOfDate`, `isStale`, `staleDays`, `headline`, `pulse`, `assetClasses`, `focusEtfs`, `editorial` 키가 모두 존재하는지 확인하는 수준이면 충분하며, 이번과 같은 사고를 구조적으로 차단합니다.

---

## P0. 추적되지 않는 임시 파일이 남아 있습니다

`git status`에 `?? functions/api/briefings/latest.js.tmp`가 잡힙니다. 7,702바이트로 현재 `latest.js`(2,043바이트)보다 큽니다. 수정 스크립트가 원본을 백업하고 덮어쓴 흔적으로 보입니다.

Cloudflare Pages Functions는 디렉터리 기반 라우팅을 쓰므로 확장자가 `.tmp`인 파일이 라우트로 잡히지는 않지만, 배포 번들에 불필요하게 포함되고 무엇보다 "올바른 구현이 어디에 있는지" 혼동을 만듭니다. 위 P0 복구 작업에 원본으로 활용한 뒤 삭제하십시오.

---

## P1. 스키마에 남은 불일치

### 세션 테이블은 여전히 평문 IP를 저장합니다

보고서는 "원문 IP와 User-Agent가 평문으로 들어가지 않도록" 처리했다고 했으나, 이는 `admin_audit_logs`에만 적용되었습니다. 같은 마이그레이션의 `admin_user_sessions`는 여전히 다음과 같습니다.

```sql
ip_address TEXT,
user_agent TEXT,
```

감사 로그만 해싱하고 세션 테이블은 평문으로 두면 개인정보 보호 관점의 실익이 절반으로 줄어듭니다. 두 테이블의 처리 방침을 일치시키거나, 세션 테이블에 평문을 두는 이유(예: 세션 이상 탐지 목적)를 문서로 남기십시오.

### 인덱스가 하나도 없습니다

`0008` 마이그레이션에 `CREATE INDEX`가 한 줄도 없습니다. 최소한 다음 두 가지는 필요합니다. 아웃박스 폴링은 `delivery_status`와 `next_attempt_at`으로 조회하므로 복합 인덱스가 있어야 하고, `market_briefing_editorial_events`는 `briefing_id` 기준 조회가 기본이므로 인덱스가 필요합니다. 지금 규모에서는 체감되지 않지만 이벤트와 아웃박스는 계속 누적되는 테이블입니다.

### 외래키 적용이 일관되지 않습니다

`market_briefing_editorial_revisions`에는 `briefing_id` 외래키가 있으나, `market_briefing_editorial_events`와 `market_briefing_editorial_cache_outbox`에는 없습니다. 의도적으로 이벤트 로그를 문서 삭제와 분리한 것이라면 주석으로 근거를 남기고, 아니라면 통일하십시오.

### `updated_at` 자동 갱신이 없습니다

`market_briefing_editorial_documents.updated_at`은 `DEFAULT CURRENT_TIMESTAMP`만 있고 갱신 트리거가 없습니다. SQLite는 자동으로 갱신하지 않으므로 애플리케이션 코드가 매 UPDATE마다 명시적으로 써야 합니다. 낙관적 동시성 제어(`expectedRevision` 409 처리)와 맞물리는 값이므로 누락 시 진단이 어려워집니다.

---

## 보고 항목별 검증 결과 요약

| 항목 | 보고 내용 | 검증 결과 |
|---|---|---|
| 1 | 테이블명 `admin_` 접두사 교체, 충돌 해소 | 확인됨. `admin_users`, `admin_auth_roles`, `admin_user_sessions`, `admin_audit_logs` 모두 반영 |
| 1 | IP·UA 해시 저장 | 부분 확인. 감사 로그만 적용, 세션 테이블은 평문 유지 |
| 2 | `INSERT OR IGNORE` 멱등성 | 확인됨. 역할 시드에 적용 |
| 2 | `scripts/create-admin-user.mjs` 생성 | 확인됨(파일 존재) |
| 3 | 로그인 타이밍 공격 방어 | 파일 존재 확인. 더미 솔트 로직 자체는 코드 리뷰 필요 |
| 4 | Editorial 주입 복구 | **부적합. 복구가 아니라 계약 파괴 회귀** |
| 5 | In-memory D1 테스트 | 확인됨. `functions/api/admin/__tests__/setup-d1.ts`, `admin-api.test.ts` 존재 |
| 6 | Preview DB 컬럼 확인 | 보고 신뢰. 원격 D1은 본 검증 범위 밖 |
| 6 | Editor 라우팅을 쿼리 파라미터로 변경 | 판단 타당. `output: 'export'` 환경에서 합리적 선택 |

---

## 권고 순서

첫째, `latest.js`와 `[date].js`를 `git show HEAD` 원본으로 되돌린 뒤 `editorial` 키만 증분 추가하십시오. 둘째, 두 엔드포인트의 응답 키 존재 여부를 검사하는 계약 테스트를 추가하십시오. 셋째, `latest.js.tmp`를 삭제하고 미사용 import를 정리한 뒤 린트 규칙이 실제로 작동하는지 확인하십시오. 넷째, P1의 스키마 항목 네 가지를 `0009` 마이그레이션으로 처리하십시오. 이 넷이 끝나기 전에는 PR을 머지하지 않는 것을 권합니다.

---

## 이번 건에서 얻을 교훈

이번 회귀는 코드 실력의 문제가 아니라 **작업 방식의 문제**입니다. 수정이 파일 단위 재작성 스크립트(`fix_backend.py`, `fix_api_scripts.py`, `fix_setup.py` 등)로 이루어졌고, 그 과정에서 기존 로직이 검토 없이 덮어써졌습니다. `.tmp` 잔재가 그 흔적입니다.

앞으로 외부 에이전트에 수정을 맡길 때는 두 가지를 지시문에 넣으십시오. 기존 파일을 통째로 다시 쓰지 말고 증분 편집만 할 것, 그리고 작업 완료 보고에 `git diff --stat`을 반드시 포함할 것입니다. 이번 건도 diff stat 한 줄(`123 deletions`)만 보고에 있었다면 즉시 발견되었을 사안입니다.
