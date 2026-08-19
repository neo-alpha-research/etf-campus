# ETF Campus 마켓 브리핑 이벤트 기반 Snapshot Hub 운영 가이드

## 개요

마켓 브리핑은 더 이상 ETF·지수 API를 직접 호출하지 않습니다. 기존 `.github/workflows/daily-data.yml`이 공식 ETF 데이터를 수집·검증하는 유일한 원천 단계이며, KRX Open API를 우선 사용하고 필요 시 금융위원회 공공데이터포털 ETF API를 보완합니다. 이 workflow가 확정된 `etf_master_draft.csv`를 D1 원천 snapshot으로 적재하고 event outbox를 생성합니다.

`market-event-dispatcher`는 outbox만 Queue로 전송합니다. `market-briefing-publisher`는 Queue consumer로서 D1 source snapshot만 materialize하고 공개 브리핑과 KV cache를 생성합니다. 따라서 데이터 원천 수집 장애, 브리핑 계산 장애, 향후 뉴스레터·분석 worker 장애가 서로 직접 전파되지 않습니다.

> **운영 원칙: 외부 API key는 existing daily workflow에만 둡니다. 모든 consumer는 D1과 자기 Queue binding만 사용합니다.**

## 구성 요소와 권한

| 구성 요소 | 역할 | 외부 API key | D1 | Queue |
| --- | --- | --- | --- | --- |
| `daily-data.yml` | ETF master 갱신·품질 검증·source snapshot publish | `KRX_OPEN_API_KEY`, `DATA_GO_KR_SERVICE_KEY` | signed Pages endpoint 경유 | 직접 사용하지 않음 |
| Pages `ingest-market-source` | snapshot·manifest·outbox 원자 기록 | 없음 | 쓰기 | 없음 |
| `market-event-dispatcher` | outbox 재시도·Queue 전송 | 없음 | 읽기·outbox 상태 쓰기 | producer |
| `market-briefing-publisher` | source materialize·브리핑·KV cache | 없음 | 읽기·쓰기 | consumer |
| 향후 newsletter/analysis Worker | 동일 snapshot으로 독립 산출물 생성 | 별도 consumer 필요 시에만 | 읽기·자기 결과 쓰기 | 별도 consumer |

## production 전환 순서

### 1. 변경사항을 `main`에 병합

`market-briefing-production.yml`은 다음 순서로 실행됩니다.

1. Next.js·Pages Function·dispatcher·publisher 정적 검증
2. production D1 migration `0007_market_source_snapshot_hub.sql` 적용
3. `market-event-dispatcher` 배포
4. `market-briefing-publisher` Queue consumer 배포
5. Pages Function 배포

migration과 Queue consumer가 Pages source ingest endpoint보다 먼저 준비되므로, source endpoint가 event outbox를 만들 때 전달 경로가 먼저 준비되어 있습니다.

### 2. 기존 GitHub Secrets 재사용

새 GitHub Secret이나 새 공공 API key는 필요하지 않습니다. `daily-data.yml`의 source snapshot 단계는 이미 등록된 다음 값을 사용합니다.

| Secret | 사용 목적 |
| --- | --- |
| `KRX_OPEN_API_KEY` | 기존 ETF master 수집과 KOSPI·KOSDAQ source snapshot 조회 |
| `DATA_GO_KR_SERVICE_KEY` | 기존 ETF 수집 보완 fallback |
| `PRICE_INGEST_HMAC_SECRET` | Pages `ingest-market-source` signed request 인증 |

Pages production에 `PRICE_INGEST_HMAC_SECRET`이 이미 존재하는지 기존 `/api/internal/ingest-prices` endpoint가 `401 Unauthorized`로 응답하는 방식으로 확인되었습니다. 이는 endpoint가 있고 secret도 설정되었으나 서명이 없다는 뜻입니다. 같은 secret은 새 source ingest endpoint에도 자동으로 적용됩니다.

### 3. 첫 정상 run 확인

다음 일별 workflow 실행 뒤 production D1에서 상태를 확인합니다.

```powershell
cd D:\ETFCampus
npx wrangler d1 execute ETF_PRICES --remote --command "
SELECT as_of_date, source_version, status, etf_row_count, general_etf_count, ready_at
FROM market_source_snapshot_manifest
ORDER BY ready_at DESC
LIMIT 3;"

npx wrangler d1 execute ETF_PRICES --remote --command "
SELECT event_id, delivery_status, attempt_count, sent_at
FROM market_source_event_outbox
ORDER BY created_at DESC
LIMIT 5;"

npx wrangler d1 execute ETF_PRICES --remote --command "
SELECT consumer_name, as_of_date, status, finished_at
FROM market_source_consumer_runs
ORDER BY updated_at DESC
LIMIT 5;"
```

정상 순서는 `manifest.status = ready` → outbox `delivery_status = sent` → consumer run `status = ready` → `market_briefings`에 같은 기준일이 생성되는 것입니다. `market_briefings`는 같은 기준일에 하나만 생성되므로 Queue at-least-once 전달이 중복 발행으로 이어지지 않습니다.

### 4. legacy collector retirement 확인

직접 API를 호출하던 `market-data-collector`는 event hub 구조에서 deploy 대상이 아닙니다. 현재 Cloudflare 계정에서 해당 Worker는 조회 결과 존재하지 않았으며, CI workflow에서도 배포 job을 dispatcher로 교체했습니다. 향후 동일 이름의 legacy Worker를 수동 배포하지 마십시오.

## Preview 검증 상태

preview D1에는 migration `0007`이 적용되었고, source snapshot·manifest·outbox·consumer audit 테이블 5개가 생성되었습니다. preview `market-event-dispatcher`와 preview `market-briefing-publisher` Queue consumer도 배포되었습니다.

다만 preview Pages environment에는 `PRICE_INGEST_HMAC_SECRET`이 없어서 새 source ingest endpoint가 `503`을 반환합니다. production secret 값을 공개하거나 채팅으로 전달하지 말고, Cloudflare dashboard에서 **Pages → ETF Campus → Settings → Variables and Secrets → Preview**에 동일한 `PRICE_INGEST_HMAC_SECRET`을 등록해야 preview live end-to-end test를 할 수 있습니다. 이 작업은 production 값을 바꾸지 않는 preview 환경 설정으로만 수행해야 합니다.

## 장애·재처리

| 상태 | 의미 | 운영 조치 |
| --- | --- | --- |
| manifest `collecting` | source batch가 아직 끝나지 않음 | 다음 daily workflow retry 또는 source snapshot publish 재실행 |
| manifest `suppressed` / `failed` | 기준일·품질 조건 미충족 | 검증 결과를 확인하고 원천 수집 문제부터 해결 |
| outbox `failed` | Queue 전송 실패 | dispatcher cron이 backoff 후 재시도 |
| Queue DLQ | publisher consumer가 5회 실패 | D1 consumer run의 `error_detail` 확인 후 manual replay |
| consumer `failed` | materialize 또는 briefing 발행 실패 | source snapshot을 재수집하지 말고 동일 event를 replay |

`market-event-dispatcher`의 `/internal/dispatch`는 인증된 운영자 수동 outbox drain endpoint입니다. production에서 사용하려면 dispatcher에만 `MANUAL_RUN_TOKEN`을 등록하고, token은 GitHub Secret 또는 운영자 password manager에 보관합니다. token을 채팅이나 source code에 넣지 않습니다.

## 향후 consumer 추가

뉴스레터 초안, 분배금 분석, 신규 상장 감시에는 현재 publisher를 수정하지 않습니다. D1 `market_source_snapshot_manifest`와 `market_source_*_daily`를 읽는 별도 Worker를 만들고, outbox `target_name` check constraint와 dispatcher Queue binding에 새 대상만 추가합니다. 각 consumer에는 자체 `market_source_consumer_runs.consumer_name`을 사용해 idempotency·장애·replay를 독립 관리합니다.

## References

[1]: https://developers.cloudflare.com/queues/ "Cloudflare Queues Overview"
[2]: https://developers.cloudflare.com/queues/configuration/batching-retries/ "Cloudflare Queues — Batching, retries and delays"
[3]: https://developers.cloudflare.com/queues/configuration/dead-letter-queues/ "Cloudflare Queues — Dead Letter Queues"
[4]: https://developers.cloudflare.com/pages/functions/bindings/ "Cloudflare Pages Functions bindings"
