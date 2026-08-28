# Antigravity 지시: 8월 25일 재발행 파일럿

작성일: 2026-08-26
발신: EVS Navigator
용도: 아래 구분선 안의 전문을 Antigravity에 그대로 전달하십시오.

---

## 0. 이번 보고는 좋았습니다

**화면 API 응답을 그대로 붙였습니다.** 세 개 테마만 반환되고 주식 카드가 비어 있음이 실측으로 확인되었습니다. 진단이 확정되었습니다.

**8월 25일 데이터를 복원했습니다.** 1,161행, `shares` 100퍼센트입니다.

**`.gitignore` 37행의 `*.sql` 규칙을 찾아냈습니다.** 마이그레이션 4개가 버전 관리 밖에 있던 원인입니다.

**의존 관계 분석도 맞습니다.** 발신 측에서 확인했습니다.

```
migrations/0004_market_briefing_v0.sql L176, L197
FOREIGN KEY (as_of_date) REFERENCES market_briefings(as_of_date) ON DELETE CASCADE
```

---

## 1. 설계에 세 곳을 고쳐야 합니다

### 1-1. `market_briefings` 만 지우면 아무 일도 일어나지 않습니다

```
workers/market-briefing-publisher/src/source-materializer.ts L65~69

async function claimEvent(db, event) {
  const existing = await db.prepare(
    `SELECT status FROM market_source_consumer_runs WHERE consumer_name = ? AND event_id = ?`
  ).bind(CONSUMER_NAME, event.event_id).first();
  if (existing?.status === "ready" || existing?.status === "skipped_duplicate") return "done";
```

**`claimEvent` 가 `market_briefings` 확인보다 먼저 실행됩니다.**

직전 라운드에서 8월 25일 이벤트가 `skipped_duplicate` 로 기록되었습니다. **같은 이벤트를 다시 쏘면 L69 에서 곧바로 반환되고 끝납니다. 삭제한 것이 무의미해집니다.**

**해결책은 소비자 기록을 손대는 것이 아닙니다.**

**새 스냅샷을 발행하면 `source_version` 이 바뀌고 `event_id` 도 달라져 `claimEvent` 를 자연스럽게 통과합니다.** 직전 라운드의 `market-source-2026-08-25-009e85cc246cead1` 처럼 해시가 새로 붙습니다.

**따라서 순서는 이렇습니다.**

```
1  market_briefings 에서 해당 날짜 행 삭제
2  daily-market.yml 을 해당 날짜로 재실행     ← 새 source_version 생성
3  새 event_id 로 claimEvent 통과
4  alreadyPublished 검사도 통과 (1에서 지웠으므로)
5  materialize 진행, metrics_json 새로 생성
```

**`market_source_consumer_runs` 를 직접 지우지 마십시오.** 감사 기록입니다.

### 1-2. `briefing_publication_runs` 를 지우지 마십시오

설계에 다음이 들어 있습니다.

```sql
DELETE FROM briefing_publication_runs WHERE source_as_of_date = '2026-08-25';
```

**불필요합니다.** 발신 측에서 확인한 결과 이 테이블은 INSERT 와 UPDATE 만 되고 **어디서도 중복 가드로 읽히지 않습니다.**

```
workers/market-briefing-publisher/src/index.ts L572  INSERT INTO briefing_publication_runs ...
workers/market-briefing-publisher/src/index.ts L400  UPDATE briefing_publication_runs SET ...
```

**발행 이력 감사 로그입니다. 지우면 무엇이 언제 발행되었는지 추적이 끊깁니다. 그대로 두십시오.**

### 1-3. 8월 21일 커밋을 잘못 지목했습니다

설계 [B] 에 이렇게 적혀 있습니다.

> `commit a7a2a5c` 의 정확한 8월 21일 원천 마스터 데이터(AUM 25.93조원)를 준비

**문장 안에서 어긋납니다.**

발신 측에서 네 커밋의 마스터 CSV 를 직접 열어 확인했습니다.

```
069500 KODEX 200 의 aum 값

3615772  bas_dt 20260820   25,474,813,891,225
74372fb  bas_dt 20260821   25,933,407,658,938
d13f01e  bas_dt 20260824   24,615,790,752,113
70bad82  bas_dt 20260825   24,711,100,353,729
```

**25.93조원은 `74372fb` 의 값입니다. `a7a2a5c` 가 아닙니다.**

`a7a2a5c` 는 보고서 1단계에서 스스로 밝혔듯 **`bas_dt` 가 20260820 인 커밋이며, D1 8월 21일 행을 오염시킨 바로 그 출처입니다.** 그것을 다시 소스로 쓰면 같은 오염이 반복됩니다.

**직전 라운드에서 `74372fb` 를 8월 21일 원본으로 오인해 사고가 났고, 이번에는 반대 방향으로 다시 틀렸습니다.**

**커밋 번호를 인용할 때 그 커밋의 `bas_dt` 를 먼저 열어 확인하십시오.**

---

## 2. 이번 라운드는 8월 25일 하나만 합니다

**세 날짜를 한꺼번에 하지 마십시오.**

프로덕션 삭제를 처음 시도하는 것이므로 **되돌릴 수 있는 한 건으로 절차를 검증한 뒤 나머지를 판단합니다.**

### 2-1. 삭제 전 백업

**`market_briefings` 의 2026-08-25 행 전체를 JSON 으로 파일에 저장하십시오.** `metrics_json` 을 포함한 모든 컬럼입니다.

**하위 두 테이블도 함께 백업하십시오.**

```sql
SELECT * FROM market_briefing_asset_classes WHERE as_of_date = '2026-08-25';
SELECT * FROM market_briefing_focus_etfs   WHERE as_of_date = '2026-08-25';
```

**백업 파일 경로와 행 수를 보고에 적으십시오.** 실패 시 이 파일로 되돌립니다.

### 2-2. 삭제

```sql
DELETE FROM market_briefings WHERE as_of_date = '2026-08-25';
```

**한 행만 지워져야 합니다. 영향 행 수를 확인하십시오.**

### 2-3. CASCADE 가 실제로 작동했는지 확인하십시오

**마이그레이션에 `ON DELETE CASCADE` 가 선언되어 있어도 실행 시 외래키 강제가 꺼져 있으면 작동하지 않습니다.**

```sql
SELECT COUNT(*) FROM market_briefing_asset_classes WHERE as_of_date = '2026-08-25';
SELECT COUNT(*) FROM market_briefing_focus_etfs   WHERE as_of_date = '2026-08-25';
```

**0 이어야 합니다. 남아 있으면 CASCADE 가 돌지 않은 것이므로 수동으로 지우고 그 사실을 보고하십시오.**

**이것은 앞으로 모든 재발행에 영향을 주는 사실이므로 반드시 확인하십시오.**

### 2-4. 재발행

```
gh workflow run daily-market.yml -f target=20260825
```

**직전 라운드에서 `2026-08-25` 형식은 실패하고 `20260825` 가 통했습니다. 통한 형식을 쓰십시오.**

### 2-5. 검증

**D1 이 아니라 화면부터 확인하십시오.**

```
node -e "fetch('https://etf-campus.pages.dev/api/briefings/latest').then(r=>r.json()).then(j=>console.log(JSON.stringify(j.briefing.peerGroups,null,1)))"
```

**주식 테마가 나와야 합니다.** S&P500, 반도체, 인공지능, 고배당 같은 이름입니다.

**네 카드의 테마 수를 보고하십시오.**

**주식-국내와 주식-해외를 무엇으로 나누는지도 함께 보고하십시오.** `comparison_topic` 에는 국내 해외 구분이 없습니다. 한쪽만 채워지면 그 기준에 문제가 있는 것입니다.

**그다음 D1 을 확인하십시오.**

```sql
SELECT COUNT(*) AS total, COUNT(NULLIF(asset_detail,'')) AS with_detail,
       COUNT(shares) AS with_shares, COUNT(DISTINCT source_run_id) AS runs
FROM briefing_etf_daily WHERE as_of_date = '2026-08-25' AND is_general_etf = 1;
```

**691 과 1,015 가 파이프라인 산출로 재현되어야 합니다.**

### 2-6. 실패 시

**백업에서 되돌리고 보고하십시오. 두 번째 시도를 하지 마십시오.**

---

## 3. 8월 24일과 21일은 보류합니다

### 3-1. 8월 24일은 먼저 확인할 것이 있습니다

**8월 24일 수집 허브에 세부 테마가 들어 있는지 확인하십시오.**

```sql
SELECT source_version, COUNT(*) AS total, COUNT(NULLIF(asset_detail,'')) AS with_detail
FROM market_source_etf_daily WHERE as_of_date = '2026-08-24'
GROUP BY source_version;
```

**머티리얼라이저는 `briefing_etf_daily` 가 아니라 이 허브를 읽습니다.**

```
source-materializer.ts L115
SELECT ticker, ..., asset_detail, nav_value, disparity_pct, shares
FROM market_source_etf_daily WHERE as_of_date=? AND source_version=?
```

**허브가 아직 107건이면 지우고 재발행해도 결과가 같습니다.** 워크플로를 8월 24일로 다시 돌려 허브부터 새로 만들어야 합니다.

**확인만 하고 실행하지 마십시오.**

### 3-2. 8월 21일은 이번에 손대지 않습니다

**원천 스냅샷과 매니페스트까지 다시 만들어야 하므로 위험이 다릅니다.**

**8월 25일 절차가 검증된 뒤에 별도로 판단합니다. 이번 라운드에서 착수하지 마십시오.**

---

## 4. 내일 아침이 진짜 시험입니다

**소급 보정보다 중요한 것은 자동 실행입니다.**

분류 파일이 복구되어 `main` 에 올라가 있으므로 **내일 아침 08시 07분 자동 실행은 별도 조치 없이 정상 발행되어야 합니다.** 8월 26일은 처음 발행되는 날짜이므로 중복 가드에 걸리지 않습니다.

**내일 실행 후 다음을 확인해 보고하십시오.**

화면 API 의 `peerGroups` 에 주식 테마가 들어 있는지입니다.

`briefing_etf_daily` 의 8월 26일 `with_detail` 과 `with_shares` 입니다.

**여기서 정상이 확인되면 자동화는 완성된 것입니다.** 과거 날짜 보정은 아카이브 정리 작업으로 분리해 여유 있게 진행합니다.

**오늘 밤 `main` 에 추가 변경을 올리지 마십시오.** 내일 아침 실행이 오늘까지의 상태로 도는 것을 봐야 합니다.

---

## 5. 작업 D 는 다음 라운드입니다

**4단계 분석은 정확합니다.** `calculateFundFlow` 를 확장하는 방향으로 승인합니다.

**다만 8월 25일 파일럿이 끝난 뒤에 착수합니다.** 지금 테이블을 만들면 재발행과 뒤섞입니다.

---

## 6. 이번 범위 밖

**8월 24일과 8월 21일을 지우거나 재발행하지 마십시오.** 3-1 은 조회만입니다.

**`briefing_publication_runs` 와 `market_source_consumer_runs` 를 지우지 마십시오.**

**작업 D 테이블을 만들지 마십시오.**

**오늘 밤 `main` 에 병합하지 마십시오.**

**`미확인 주식전략` 375건을 분류하지 마십시오.**

**STEP 1 지표 복구는 Step54 별도 지시서입니다.**

**URL 구조, 사이트맵, 아카이브 페이지네이션**은 착수하지 마십시오.

---

## 7. 작업 규칙

**삭제 전에 백업하십시오. 백업 파일 경로와 행 수를 보고에 적으십시오.**

**커밋 번호를 인용하기 전에 그 커밋의 `bas_dt` 를 열어 확인하십시오.**

**모든 보고에 화면 API 결과를 포함하십시오. D1 건수만으로 완료를 선언하지 마십시오.**

**실패하면 되돌리고 보고하십시오. 두 번째 시도를 하지 마십시오.**

**워크플로 실행은 이번 라운드에 1회입니다.**

**`git add .` 와 `git commit -am` 을 쓰지 마십시오.**

**명령을 `;` 로 연결하지 마십시오.**

**스크립트는 `scratch/` 안에 파일로 만들어 실행하십시오.**

기존 파일을 통째로 다시 쓰지 말고 증분 편집만 하십시오.

`Antigravity_Step*.md` 는 커밋하지 마십시오.

보고 전에 `git status --porcelain` 과 `git log --oneline -n 5`, `git rev-parse --abbrev-ref HEAD` 를 실행해 출력을 붙여넣으십시오.

---

## 8. 진행 순서

**1단계.** 2-1 로 세 테이블을 백업하고 경로와 행 수를 보고하십시오.

**2단계.** 2-2 로 한 행을 삭제하고, 2-3 으로 CASCADE 작동 여부를 확인해 보고하십시오.

**3단계.** 2-4 로 재발행하고, 2-5 로 화면과 D1 을 확인해 보고하십시오. **화면을 먼저 적으십시오.**

**4단계.** 3-1 의 8월 24일 허브 상태를 조회해 보고하십시오. **실행하지 마십시오.**

**5단계.** 여기서 멈추십시오. 내일 아침 자동 실행 결과를 별도로 보고하십시오.
