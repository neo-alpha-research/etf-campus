# Antigravity 지시: 이벤트 재배달 절차와 KV 캐시

작성일: 2026-08-26
발신: EVS Navigator
용도: 아래 구분선 안의 전문을 Antigravity에 그대로 전달하십시오.

---

## 0. 이번 라운드 처리는 정확했습니다

**실패를 확인하고 즉시 백업에서 복원한 뒤 멈췄습니다.** 두 번째 시도를 하지 않았습니다. 규칙대로입니다.

**CASCADE 작동 여부를 실측했습니다.** D1 에서 외래키 연쇄 삭제가 실제로 도는 것이 확인되었습니다. 앞으로 재발행에 계속 쓰이는 사실입니다.

**8월 24일 허브가 131건임을 조회로 확인했습니다.** 실행하지 않고 조회만 했습니다.

---

## 1. 발신 측 지시가 틀렸습니다

직전 지시서 1-1 에 이렇게 썼습니다.

> 새 스냅샷을 발행하면 `source_version` 이 바뀌고 `event_id` 도 달라져 `claimEvent` 를 자연스럽게 통과합니다.

**틀렸습니다.**

```
scripts/publish_market_source_snapshot.py L366   etf_hash = canonical_hash(etfs)
scripts/publish_market_source_snapshot.py L409   source_version = f"market-source-{as_of_date}-{etf_hash[:16]}"
```

**`source_version` 은 ETF 페이로드의 내용 해시입니다.** 같은 날짜를 같은 데이터로 다시 발행하면 **해시가 같으므로 `source_version` 도 그대로입니다.**

```
functions/api/internal/ingest-market-source.js L198
ON CONFLICT(event_type, target_name, as_of_date, source_version) DO NOTHING
```

**아웃박스에 같은 행이 이미 있으므로 새 이벤트가 만들어지지 않습니다.**

**보고서의 진단이 맞고 발신 측 지시가 틀렸습니다.** 그 지시 때문에 워크플로를 4분 26초 헛돌렸습니다.

---

## 2. 올바른 재발행 절차

**워크플로를 다시 돌릴 필요가 없습니다. 데이터는 이미 허브에 정확히 들어 있습니다.**

### 2-1. 배달 구조

발신 측에서 코드를 읽어 확인한 경로입니다.

```
publish_market_source_snapshot.py
  → POST /api/internal/ingest-market-source
     허브 적재 + market_source_event_outbox INSERT (중복이면 DO NOTHING)

market-event-dispatcher            crons = ["*/5 * * * *"]
  → SELECT ... WHERE delivery_status IN ('pending','failed')
  → 큐로 전송 후 delivery_status='sent'

market-briefing-publisher          queue consumer
  → materializeMarketSnapshot()    claimEvent → alreadyPublished 검사
  → publishReadyBriefing()
```

**디스패처가 5분마다 아웃박스를 훑어 `pending` 인 것을 큐에 넣습니다.**

**따라서 아웃박스 행을 `pending` 으로 되돌리면 5분 안에 저절로 다시 배달됩니다. GitHub Actions 를 쓸 필요가 없습니다.**

### 2-2. 세 개의 잠금을 모두 풀어야 합니다

**하나라도 남으면 조용히 건너뜁니다.**

```
잠금 1   market_briefings 에 해당 날짜 행 존재
         → source-materializer.ts L101 alreadyPublished

잠금 2   market_source_consumer_runs 의 status 가 'ready' 또는 'skipped_duplicate'
         → source-materializer.ts L69 claimEvent

잠금 3   market_source_event_outbox 의 delivery_status 가 'sent'
         → dispatcher 가 집어가지 않음
```

**직전 라운드에는 잠금 1만 풀었습니다.** 잠금 2와 3이 남아 있어 아무 일도 일어나지 않았습니다.

### 2-3. 실행 순서

**아직 실행하지 마십시오. 3번의 KV 확인이 먼저입니다.**

```sql
-- 0. 대상 event_id 확인
SELECT event_id, source_version, delivery_status, sent_at
FROM market_source_event_outbox
WHERE as_of_date = '2026-08-25' ORDER BY created_at DESC;

-- 1. 잠금 1
DELETE FROM market_briefings WHERE as_of_date = '2026-08-25';

-- 2. 잠금 2
DELETE FROM market_source_consumer_runs
WHERE consumer_name = 'market_briefing' AND event_id = '<위에서 확인한 event_id>';

-- 3. 잠금 3
UPDATE market_source_event_outbox
SET delivery_status = 'pending', sent_at = NULL, next_attempt_at = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE event_id = '<위에서 확인한 event_id>';
```

**그다음 5분에서 10분 기다리십시오.** 디스패처 크론이 집어갑니다.

**`market_briefings` 에 2026-08-25 행이 다시 생기는지 확인하십시오.**

**`consumer_name` 문자열을 추정하지 마십시오.** `source-materializer.ts` 의 `CONSUMER_NAME` 상수를 열어 실제 값을 확인한 뒤 쓰십시오.

**백업은 직전 라운드 파일을 그대로 씁니다.** 세 테이블 모두 이미 저장되어 있습니다. **덮어쓰지 마십시오.**

---

## 3. KV 캐시가 D1 보다 먼저 읽힙니다

**보고서의 KV 지적이 맞습니다. 확인했습니다.**

```
functions/api/briefings/latest.js L128~129
const cached = await readKvBriefing(context.env.BRIEFING_KV);
if (cached) return Response.json(cached, { headers: JSON_HEADERS });
```

**KV 에 값이 있으면 D1 을 아예 조회하지 않고 그대로 반환합니다.**

쓰는 쪽은 발행 워커입니다.

```
workers/market-briefing-publisher/src/resilience.ts L25~26
await env.BRIEFING_KV.put(payloadKey, ..., { expirationTtl: 7 * 24 * 60 * 60 });
await env.BRIEFING_KV.put(briefingPointerKey, ..., { expirationTtl: 8 * 24 * 60 * 60 });
```

**TTL 이 7일과 8일입니다.**

### 3-1. 왜 중요한가

**발행이 성공하면 KV 도 새로 써지므로 화면이 갱신됩니다. 그러나 발행이 실패하거나 건너뛰어지면 KV 는 이전 값을 최대 8일간 계속 내보냅니다.**

**즉 화면이 정상으로 보여도 그것이 방금 발행한 결과라는 보장이 없습니다.** 직전 라운드가 정확히 그 상황이었습니다.

### 3-2. 지금 확인할 것

**아무것도 지우기 전에 다음을 조사해 보고하십시오.**

**`readKvBriefing` 과 `resilience.ts` 를 읽고 키 구조를 정리하십시오.** 포인터 키와 페이로드 키가 어떻게 구성되는지, 날짜가 키에 들어가는지입니다.

**현재 KV 에 들어 있는 포인터가 어느 날짜를 가리키는지 확인하십시오.**

**KV 를 우회해 D1 을 직접 보는 방법이 있는지 확인하십시오.** 쿼리 파라미터나 별도 엔드포인트가 있는지, 없다면 검증 시 D1 을 직접 조회해야 합니다.

**발행 실패 시 KV 를 무효화하는 경로가 있는지 확인하십시오.** 없다면 그것이 구조적 결함입니다. **이번에 고치지는 말고 보고만 하십시오.**

---

## 4. 내일 아침 검증 방법을 바꿉니다

**8월 26일은 처음 발행되는 날짜이므로 세 잠금 어디에도 걸리지 않습니다. 정상 발행되어야 합니다.**

**다만 화면 API 하나만 보고 판정하지 마십시오. KV 때문에 오판할 수 있습니다.**

**세 곳을 모두 확인해 보고하십시오.**

```sql
-- 1  D1 원본
SELECT as_of_date, json_extract(metrics_json, '$.peer_group_version') AS ver,
       json_array_length(json_extract(metrics_json, '$.peer_groups')) AS groups
FROM market_briefings ORDER BY as_of_date DESC LIMIT 3;

-- 2  적재 상태
SELECT COUNT(*) AS total, COUNT(NULLIF(asset_detail,'')) AS with_detail, COUNT(shares) AS with_shares
FROM briefing_etf_daily WHERE as_of_date = '2026-08-26' AND is_general_etf = 1;
```

**3. 화면 API 의 `peerGroups` 전문**

**세 곳이 서로 일치하는지가 판정 기준입니다.** 어긋나면 KV 문제입니다.

**주식 테마가 나오면 자동화는 완성입니다.** S&P500, 반도체, 인공지능 같은 이름이 보여야 합니다.

**나오지 않으면 원인을 찾되 고치지 말고 보고하십시오.**

---

## 5. 8월 24일은 워크플로가 필요합니다

**허브가 131건으로 확인되었으므로 잠금만 풀어서는 안 됩니다.**

**8월 24일은 허브부터 다시 만들어야 하므로 `daily-market.yml` 재실행이 필요합니다.** 그때는 분류 파일이 복구된 상태이므로 ETF 페이로드가 달라지고 **`source_version` 해시도 자연히 바뀝니다.** 새 이벤트가 생기므로 잠금 2와 3은 문제되지 않습니다.

**다만 잠금 1은 여전히 풀어야 합니다.**

**이번 라운드에서 실행하지 마십시오.** 8월 25일이 검증된 뒤입니다.

---

## 6. 이번 범위 밖

**8월 24일과 8월 21일을 지우거나 재발행하지 마십시오.**

**KV 무효화 경로를 이번에 구현하지 마십시오.** 조사와 보고만 합니다.

**작업 D 테이블을 만들지 마십시오.**

**오늘 밤 `main` 에 병합하지 마십시오.**

**`미확인 주식전략` 375건을 분류하지 마십시오.**

**STEP 1 지표 복구는 Step54 별도 지시서입니다.**

**URL 구조, 사이트맵, 아카이브 페이지네이션**은 착수하지 마십시오.

---

## 7. 작업 규칙

**워크플로 실행은 이번 라운드에 0회입니다.** 아웃박스 재배달로 처리합니다.

**상수와 컬럼 값을 추정하지 마십시오.** `CONSUMER_NAME` 을 코드에서 읽어 확인하십시오.

**백업 파일을 덮어쓰지 마십시오.** 직전 라운드 파일이 유일한 복구 경로입니다.

**화면 API 결과만으로 완료를 선언하지 마십시오.** KV 가 앞에 있습니다.

**실패하면 되돌리고 보고하십시오. 두 번째 시도를 하지 마십시오.**

**`git add .` 와 `git commit -am` 을 쓰지 마십시오.**

**명령을 `;` 로 연결하지 마십시오.**

**스크립트는 `scratch/` 안에 파일로 만들어 실행하십시오.**

기존 파일을 통째로 다시 쓰지 말고 증분 편집만 하십시오.

`Antigravity_Step*.md` 는 커밋하지 마십시오.

보고 전에 `git status --porcelain` 과 `git log --oneline -n 5`, `git rev-parse --abbrev-ref HEAD` 를 실행해 출력을 붙여넣으십시오.

---

## 8. 진행 순서

**1단계.** 3-2 의 KV 구조를 조사해 보고하십시오. **아직 아무것도 지우지 마십시오.**

**2단계.** 2-3 의 세 잠금을 풀고 5분에서 10분 기다린 뒤, `market_briefings` 에 2026-08-25 행이 생겼는지 보고하십시오.

**3단계.** D1, 적재 상태, 화면 API 세 곳을 확인해 보고하십시오. **세 곳이 일치하는지가 판정입니다.**

**4단계.** 여기서 멈추십시오.

**5단계.** 내일 아침 자동 실행 후 4번의 세 가지를 확인해 별도로 보고하십시오.
