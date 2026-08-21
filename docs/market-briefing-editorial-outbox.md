# Market Briefing Editorial Outbox

## 1. 개요 및 목적
`market_briefing_editorial_cache_outbox` 테이블은 발행, 롤백, 회수(withdraw) 이벤트의 트랜잭셔널 아웃박스입니다. 향후 마켓 브리핑을 티스토리, 스레드 등 다중 채널로 발행(Fan-out)하기 위한 기반 인프라로 설계되었습니다.

## 2. 현재 데이터 흐름
현재 흐름은 다음과 같습니다:
**발행(publish.js 등) → 문서·리비전·이벤트 기록 → outbox 테이블 INSERT → (흐름 종료)**

현재는 큐에 이벤트를 발행하는 생산자 코드가 없기 때문에 `delivery_status = 'pending'` 상태로 레코드가 남는 것이 정상입니다.
*조사 근거*: `functions/api/admin/market-briefings/[id]/publish.js` (47행), `rollback.js` (50행), `withdraw.js` (33행) 등 API 엔드포인트 코드에 큐 전송 로직이 없음.

### KV 무효화가 불필요한 이유
현재 `latest.js`가 D1에서 에디토리얼 정보를 실시간으로 조회하여 오버레이하므로 KV 캐시 무효화는 필요하지 않습니다.
(KV 캐시 키 규약: `market-briefing:v0:{asOfDate}:v{version}`, `market-briefing:v0:latest-pointer`)

## 3. 소비자 측 코드 현황
소비자 측 코드는 이미 존재합니다. 다만 큐를 발행하는 생산자가 없어 호출되지 않을 뿐입니다.
*조사 근거*: 
- `workers/market-briefing-publisher/src/publication-cache.ts` 하단의 `updateEditorialPublicationCache` 함수
- `workers/market-briefing-publisher/src/index.ts` 471~474행의 `market_briefing_editorial` 분기

## 4. 향후 활성화 시 구현해야 할 사항
향후 멀티채널 발행을 위해 활성화 시 다음 사항을 반드시 구현 및 해결해야 합니다.

1. **큐 발행(생산자)**: API 측에서 outbox INSERT 후 실제 큐로 메시지를 전송하는 로직 추가
2. **상태 전이**: `pending` → `processing` → `sent` / `failed` 등 `delivery_status` 전이 관리
3. **재시도 및 백오프**: `attempt_count` 및 `next_attempt_at`을 활용한 재시도/백오프 로직 구현, 및 데드 레터 큐(DLQ)
4. **워커 코드의 알려진 결함 해결** (`index.ts` 분기 관련):
   - `(message.body as any)` 타입 우회 해소 (이벤트 타입 유니온 정의)
   - `console.log` 직접 호출 제거 및 구조화된 로깅으로 교체
   - 캐시 갱신 실패 시에도 `message.ack()`가 호출되어 이벤트가 유실되는 문제 해결 (`message.retry()` 도입)
   - 워커 경로를 덮는 통합/유닛 테스트 작성

## 5. 스키마 원문
```sql
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
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (briefing_id) REFERENCES market_briefing_editorial_documents(briefing_id) ON DELETE CASCADE
);
```
