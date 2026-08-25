# Antigravity 지시: D1 잠금 조사 검토와 사양 수정

작성일: 2026-08-25
발신: EVS Navigator
용도: 아래 구분선 안의 전문을 Antigravity에 그대로 전달하십시오.

---

## 1. 이번 조사는 잘 수행되었습니다

프로덕션 D1에 직접 질의해 스키마, 인덱스, 상태 분포, 코드 위치를 실측한 것은 정확한 접근이었습니다. 특히 `market_data_readiness`에는 `processing`이나 `skipped_duplicate`를 기록하는 코드 자체가 없다는 발견은 중요합니다.

**조사 게이트가 의도대로 작동했습니다.** 바로 구현에 들어갔다면 필요 없는 컬럼을, 문제가 아닌 테이블에 추가할 뻔했습니다.

---

## 2. 조사 결과가 뒤집은 것

### 2-1. `locked_at` 컬럼은 필요 없습니다

`workers/market-briefing-publisher/src/source-materializer.ts`를 확인한 결과, `market_source_consumer_runs`는 이미 `started_at`을 기록합니다.

```ts
// line 74
SET status='processing', error_detail=NULL, started_at=?, finished_at=NULL, updated_at=?
// line 80-81
INSERT INTO ... (consumer_name, event_id, as_of_date, source_version, status, started_at, updated_at)
VALUES (?, ?, ?, ?, 'processing', ?, ?)
```

**임대 만료 판정에 필요한 시각 정보가 이미 존재합니다.** `locked_at`을 새로 추가하는 것은 같은 의미의 컬럼을 둘로 늘리는 것이며, 어느 쪽이 진실인지 모호해집니다. 기존 `started_at`을 사용하십시오.

### 2-2. `processing` 상태는 영구 잠금이 아닙니다

`claimEvent()` 68행이 다음과 같습니다.

```ts
if (existing?.status === "ready" || existing?.status === "skipped_duplicate") return "done";
```

`processing`은 이 조건에 걸리지 않으므로 아래 UPDATE로 **재점유됩니다.** 즉 `processing`으로 남은 레코드는 다음 실행에서 스스로 회복합니다. 우리가 가정했던 영구 잠금이 아닙니다.

영구적으로 막는 것은 `skipped_duplicate` 하나이며, 이는 100행에서 `market_briefings`에 이미 해당 기준일이 있을 때 의도적으로 설정하는 중복 방지 장치입니다.

### 2-3. 따라서 원인 진단을 다시 해야 합니다

지난 보고에서 Backfill 34회를 "완벽히 D1 잠금 문제의 여파"라고 단정하셨으나, 이번 조사에서 **잠긴 레코드가 0건**으로 확인되었습니다. 그 인과 주장은 현재 근거가 없습니다.

증상(Git에는 데이터가 있는데 화면에 반영되지 않음)은 실재하지만 원인은 아직 특정되지 않았습니다.

---

## 3. 조사가 한 테이블 앞에서 멈췄습니다

보고 말미에 지나가듯 언급하신 `market_source_snapshot_manifest`가 **가장 유력한 잠금 지점**입니다.

`migrations/0007_market_source_snapshot_hub.sql` 44행의 정의를 보면 상태 값이 `collecting`, `ready`, `suppressed`, `failed` 네 가지이고, PK는 `(as_of_date, source_version)`입니다.

그리고 `source-materializer.ts` 109행에서 다음을 요구합니다.

```ts
WHERE as_of_date=? AND source_version=? AND status='ready'
if (!manifest) throw new Error("source_manifest_not_ready");
```

**매니페스트가 `ready`가 아니면 자재화가 실패합니다.** 매니페스트가 `collecting`에 머물러 있으면 소비자는 계속 실패하고 데이터는 화면에 도달하지 못합니다.

`functions/api/internal/ingest-market-source.js` 158행도 확인이 필요합니다.

```js
FROM market_source_snapshot_manifest WHERE as_of_date = ? AND source_version = ? AND status = 'collecting'
```

최종 확정은 `collecting` 상태의 행만 대상으로 합니다. 이전 실행이 중간에 죽어 매니페스트가 다른 상태로 남았다면 확정이 불가능해집니다. 반대로 `collecting`으로 남았다면 새 실행이 초기화 단계(101행)에서 어떻게 처리되는지가 관건입니다.

**Actions가 한도 초과로 실행 도중 강제 종료된 상황이 반복되었으므로, 매니페스트가 `collecting`에 갇혔을 개연성이 높습니다.**

---

## 4. 추가 조사 지시 (구현 전 마지막 단계)

### 4-1. 매니페스트 상태를 확인하십시오

`market_source_snapshot_manifest`에서 `status`별 행 수와, `collecting` 또는 `failed` 상태로 남아 있는 행의 `as_of_date`, `source_version`, `created_at`, `updated_at`을 조회해 보고하십시오.

`collecting`으로 오래 남은 행이 있다면 그것이 우리가 찾던 잠금입니다.

### 4-2. 초기화 경로의 동작을 읽으십시오

`functions/api/internal/ingest-market-source.js`의 95행부터 200행까지를 읽고, 다음 세 경우에 각각 어떻게 동작하는지 표로 정리하십시오.

같은 `(as_of_date, source_version)` 행이 없을 때, `collecting`으로 존재할 때, `ready`로 존재할 때입니다.

**두 번째 경우가 핵심입니다.** 죽은 이전 실행의 잔재를 새 실행이 이어받는지, 거부하는지, 덮어쓰는지에 따라 처방이 달라집니다.

### 4-3. 누락 규모를 확인하십시오

`market_data_readiness`가 4건, `market_source_consumer_runs`가 3건이라는 것은 일일 파이프라인 치고 매우 적습니다. 정상이라면 거래일마다 한 건씩 쌓여야 합니다.

`market_source_snapshot_manifest`와 `market_data_readiness`의 `as_of_date` 목록을 뽑아, 같은 기간의 실제 거래일 목록과 대조해 **며칠이 누락되었는지** 보고하십시오. 0007 마이그레이션 적용일 이후 구간만 대상으로 하면 됩니다.

이 숫자가 문제의 실제 크기입니다. 잠금이 몇 건 있었느냐보다 며칠 치 데이터가 화면에 도달하지 못했느냐가 중요합니다.

---

## 5. 잠정 사양 변경 방향

위 조사 결과에 따라 확정하겠으나 현재 판단은 다음과 같습니다.

**`locked_at` 컬럼 추가는 철회합니다.** 기존 `started_at`을 임대 판정에 사용합니다.

**임대 만료 로직의 대상은 `market_source_snapshot_manifest`의 `collecting` 상태가 될 가능성이 높습니다.** 임계치를 넘긴 `collecting` 행을 `failed`로 전이시키거나 새 실행이 덮어쓸 수 있게 하는 방향입니다. 구체안은 4-2 결과를 보고 정합니다.

**`market_source_consumer_runs`에는 재점유 로직이 이미 있으므로 손대지 않을 수 있습니다.** 다만 `failed` 상태가 무한 재시도로 이어지는지는 확인이 필요합니다.

**모니터링 추가는 그대로 유지합니다.** 대상만 매니페스트로 바뀝니다. `monitor-market-daily-pipeline.yml`에 임계치를 넘긴 `collecting` 행 검사를 넣습니다.

---

## 6. 작업 규칙

이번 단계도 **조사와 보고만 수행하고 코드는 수정하지 마십시오.**

기존 파일을 통째로 다시 쓰지 말고 증분 편집만 하십시오. base64 재구성을 쓰지 마십시오.

완료 보고에 `git log --oneline -n 5`와 `git status --porcelain`을 함께 넣으십시오.

확인한 사실과 추론을 구분하십시오. 이번 보고에서 그 구분이 잘 지켜졌습니다. 다만 지난 라운드의 "완벽히 D1 잠금 문제의 여파"처럼 단정한 인과 주장은 근거가 무너질 수 있으니, 원인을 말할 때는 반드시 뒷받침 데이터를 함께 제시하십시오.

---

## 7. 진행

4-1, 4-2, 4-3 세 가지를 조사해 한 번에 보고하십시오. 전부 읽기 전용입니다.

보고를 받은 뒤 수정된 사양으로 구현 착수를 지시하겠습니다.

Actions 한도가 복구되면 알려 주십시오. 복구 이후 진행할 잔여 과제는 배포 워크플로 경량화, CI 실행 시간과 취소 동작 검증, 서버 설치와 cron 등록입니다.
