# Antigravity 지시: 화면이 읽는 것은 metrics_json 입니다

작성일: 2026-08-26
발신: EVS Navigator
용도: 아래 구분선 안의 전문을 Antigravity에 그대로 전달하십시오.

---

## 0. 좌수 시점은 확정되었습니다

**3단계 외부 대조 결과를 승인합니다.** 발신 측에서도 독립 검산해 완전히 일치했습니다.

세 종목의 네 거래일 마스터 CSV 값입니다.

```
069500 KODEX 200
  8/20  AUM/NAV = 234,449,997        8/21 shares = 234,450,000
  8/21  AUM/NAV = 235,350,005        8/24 shares = 235,350,000
  8/24  AUM/NAV = 232,349,998        8/25 shares = 232,350,000
  8/25  AUM/NAV = 231,750,010

102110 TIGER 200
  8/20  AUM/NAV =  95,749,998        8/21 shares =  95,750,000
  8/21  AUM/NAV =  96,000,001        8/24 shares =  96,000,000
  8/24  AUM/NAV =  94,299,998        8/25 shares =  94,300,000
```

**설정 단위까지 정확히 하루씩 밀려 일치합니다.** 우연이 아닙니다.

**결론을 확정합니다. `shares` 는 T-1 좌수이며, 순유입은 `AUM(T) / NAV(T)` 역산으로 계산합니다.** 이 항목은 종결합니다.

---

## 1. 그런데 화면은 아직 고쳐지지 않았습니다

### 1-1. 오늘 세 라운드 동안 화면을 한 번도 보지 않았습니다

`with_detail = 691` 을 세 번 보고했습니다. **그러나 그 숫자는 화면과 무관합니다.**

```
functions/api/briefings/latest.js L80   const metrics = parseJson(briefing.metrics_json, {});
functions/api/briefings/latest.js L117  peerGroups: metrics.peer_groups ?? metrics.peerGroups ?? []
```

**API 는 `briefing_etf_daily` 를 읽지 않습니다. `market_briefings.metrics_json` 안의 `peer_groups` 를 읽습니다.**

그 값은 발행 시점에 한 번 계산되어 동결됩니다.

```
workers/market-briefing-publisher/src/index.ts L481   const peerGroups = calculatePeerGroups(quotes);
workers/market-briefing-publisher/src/index.ts L520   peer_groups: peerGroups,
```

### 1-2. 따라서 오늘의 직접 UPDATE 는 화면에 아무 영향이 없습니다

`repopulate_latest_snapshot.py` 와 `repopulate_all_history_shares.py` 가 `briefing_etf_daily.asset_detail` 을 107에서 691로 올렸습니다.

**`metrics_json.peer_groups` 는 그대로입니다. 8월 24일과 25일 브리핑은 여전히 세부 테마 107건 기준으로 계산된 값을 화면에 내보내고 있습니다.**

**STEP 3 주식 카드는 지금도 비어 있을 것입니다.**

### 1-3. 발신 측 지시에 오류가 있었습니다

직전 지시서 4-3 에서 8월 25일을 비우고 파이프라인을 다시 돌리라고 했습니다. **그 지시는 성립할 수 없었습니다.**

```
workers/market-briefing-publisher/src/source-materializer.ts L101
const alreadyPublished = await db.prepare(
  `SELECT as_of_date FROM market_briefings WHERE as_of_date = ?`).bind(event.as_of_date).first();
if (alreadyPublished) { ... return { status: "skipped_duplicate" }; }
```

**8월 25일은 이미 `market_briefings` 에 있으므로 머티리얼라이저가 통째로 건너뜁니다.**

수집 허브까지는 갱신되었지만 `briefing_etf_daily` 와 `metrics_json` 은 손대지 못했습니다. **발신 측이 이 가드를 알고 있었으면서 지시에 반영하지 못했습니다. 그 부분은 발신 측 잘못입니다.**

---

## 2. 작업 A: 8월 25일 데이터를 먼저 확인하십시오

**직전 라운드에서 8월 25일의 `asset_detail` 과 `shares` 를 NULL 로 비웠습니다. 머티리얼라이저가 건너뛰었다면 그대로 비어 있습니다.**

```sql
SELECT COUNT(*) AS total,
       COUNT(NULLIF(asset_detail,'')) AS with_detail,
       COUNT(shares) AS with_shares
FROM briefing_etf_daily WHERE as_of_date = '2026-08-25';
```

**비어 있으면 `scratch/briefing_etf_daily_20260825_backup.json` 에서 즉시 복원하십시오.**

**이것만은 직접 UPDATE 를 허용합니다.** 직전 지시로 비운 것이므로 되돌리는 것도 같은 방식이어야 합니다. **복원 후 건수를 보고하십시오.**

---

## 3. 작업 B: 화면을 실제로 확인하십시오

**숫자를 보고하기 전에 화면이 무엇을 내보내는지 보십시오.**

```
node -e "fetch('https://etf-campus.pages.dev/api/briefings/latest').then(r=>r.json()).then(j=>console.log(JSON.stringify(j.briefing.peerGroups,null,1)))"
```

**네 카드 각각에 몇 개 테마가 들어 있는지 그대로 붙여 보고하십시오.**

**주식 카드가 비어 있으면 1번 진단이 맞는 것입니다.** 채워져 있으면 발신 측 진단이 틀린 것이므로 그 사실을 보고하십시오.

**앞으로 모든 라운드의 보고에 이 확인을 포함하십시오.** D1 건수는 중간 지표일 뿐이고 화면이 최종 판정입니다.

---

## 4. 작업 C: 재발행 설계를 제시하십시오 (실행 금지)

**8월 21일, 24일, 25일 세 날짜의 `metrics_json` 을 다시 만들어야 합니다.** 그러지 않으면 세 날짜 모두 STEP 3 이 빈 채로 아카이브에 남습니다.

**중복 발행 가드 때문에 그냥 재실행할 수 없습니다.**

### 4-1. 확인할 것

**`market_briefings` 에서 해당 날짜 행을 삭제하면 머티리얼라이저가 다시 도는지 확인하십시오.**

`claimEvent` 가 이미 처리한 이벤트를 `done` 으로 걸러내는 구조도 함께 보십시오. **새 `source_version` 이 생기면 `event_id` 도 달라지므로 통과할 것으로 보입니다. 코드로 확인하십시오.**

**삭제해야 하는 테이블이 `market_briefings` 하나뿐인지, `briefing_runs` 나 다른 곳에도 연결이 있는지 확인하십시오.** 외래키가 걸려 있으면 순서가 중요합니다.

### 4-2. 8월 21일은 더 큰 문제가 있습니다

**보고서 1단계 내용을 발신 측이 검산해 확인했습니다.**

```
069500  D1 8/21 행의 aum_value    25,474,813,891,225
        8/20 마스터 aum           25,474,813,891,225   완전히 동일
        8/21 마스터 aum           25,933,407,658,938
```

**D1 의 8월 21일 브리핑은 8월 20일 AUM 을 담고 있습니다.** 좌수 결합 오류만의 문제가 아니라 **발행된 브리핑 자체가 하루 전 데이터입니다.**

2026-08-24 브리핑에 8월 21일 값이 실렸던 것과 같은 계열의 사고입니다.

**따라서 8월 21일은 `metrics_json` 재생성만으로 부족하고 원본 스냅샷부터 다시 만들어야 합니다.**

### 4-3. 보고 후 멈추십시오

**삭제와 재발행 절차를 설계해 보고하고 승인을 받으십시오.** 대상 테이블, 삭제할 행 수, 실행 순서, 실패 시 복구 경로입니다.

**프로덕션에서 행을 삭제하지 마십시오.** 승인 대상입니다.

---

## 5. 순유입 계산은 이미 구현되어 있습니다

**작업 D 에서 새로 만들지 마십시오.**

```
workers/market-briefing-publisher/src/index.ts L272  function calculateFundFlow(quotes, previousQuotes)
                                              L290  // Shares Outstanding = AUM / NAV
                                              L291  const currentShares = q.aum_value / q.nav_value;
                                              L295  const netInflow = (currentShares - prevShares) * q.nav_value;
```

**이미 역산 방식이며 우리가 확정한 공식과 동일합니다.**

**작업 D 의 목적은 계산 로직을 새로 쓰는 것이 아니라, 이 계산 결과를 `market_scale_daily` 와 `peer_flow_daily` 에 일별로 저장해 주간 월간 롤업이 가능하게 만드는 것입니다.**

**같은 공식을 두 벌 만들면 언젠가 서로 달라집니다. 기존 함수를 재사용하거나 공통 모듈로 분리하십시오.**

**기존 함수에 없는 것만 추가하십시오.** 피어그룹 단위 집계, 시장 전체 합계, 기초 AUM 가중수익률, 제외 건수 카운트입니다.

**`calculateFundFlow` 의 현재 동작을 먼저 읽고 무엇이 이미 있는지 보고하십시오.**

---

## 6. `.gitignore` 발견을 축소하지 마십시오

**`migrations/` 가 `.gitignore` 에 걸려 있어 마이그레이션 파일이 버전 관리되지 않고 있었습니다.** 0010, 0013, 0015 가 추적되지 않은 상태였습니다.

**이것은 오늘 나온 발견 중 중요한 축에 듭니다.**

이전에 "마이그레이션 파일과 실제 테이블 정의가 다를 수 있다" 는 혼란이 반복되었습니다. **원인의 일부가 이것이었을 수 있습니다.**

**확인해 보고하십시오.**

`.gitignore` 의 어느 규칙이 `migrations/` 를 걸렀는지, 언제 들어간 규칙인지입니다.

**추적되지 않은 마이그레이션이 더 있는지, 프로덕션 D1 에 적용되었으나 저장소에 없는 스키마 변경이 있는지 확인하십시오.**

```sql
SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name;
```

**실제 테이블 정의와 저장소의 마이그레이션 파일을 대조해 차이를 목록으로 보고하십시오.**

---

## 7. 절차 두 가지

**`main` 병합에 승인을 받지 않았습니다.** 직전 지시서 9번에서 병합 계획을 보고하고 승인을 받으라고 했습니다. 세 차례 병합이 승인 없이 이루어졌습니다.

**이번 경우는 파이프라인 실증에 필요했으므로 결과를 문제 삼지 않습니다.** 다만 `main` 은 내일 아침 자동 실행이 읽는 브랜치입니다. **앞으로는 병합 전에 보고하십시오.**

**보고서에 반대 증거가 있는데 넘어가는 일이 다시 있었습니다.** 이번에는 `with_detail 691` 을 성과로 보고하면서, 그 값이 화면에 반영되는 경로인지는 확인하지 않았습니다.

**숫자를 보고하기 전에 그 숫자가 최종 산출물에 어떻게 도달하는지 한 번 따라가 보십시오.**

---

## 8. 이번 범위 밖

**작업 D 의 테이블 생성과 롤업 계산은 아직 착수하지 마십시오.**

**프로덕션에서 행을 삭제하지 마십시오.** 4번은 설계 보고까지입니다.

**8월 21일 데이터를 임의로 덮어쓰지 마십시오.**

**`미확인 주식전략` 375건을 분류하지 마십시오.**

**STEP 1 지표 복구는 Step54 별도 지시서입니다.**

**URL 구조, 사이트맵, 아카이브 페이지네이션**은 착수하지 마십시오.

---

## 9. 작업 규칙

**D1 을 직접 UPDATE 하지 마십시오.** 2번의 백업 복원만 예외로 허용합니다.

**프로덕션에서 DELETE 를 실행하지 마십시오.** 승인 대상입니다.

**모든 보고에 화면 확인 결과를 포함하십시오.** D1 건수만으로 완료를 선언하지 마십시오.

**`main` 병합 전에 보고하십시오.**

**"완벽하게", "100퍼센트", "완수" 같은 표현을 쓰기 전에 반대 증거를 한 번 찾아보십시오.**

**`git add .` 와 `git commit -am` 을 쓰지 마십시오.**

**명령을 `;` 로 연결하지 마십시오.**

**스크립트는 `scratch/` 안에 파일로 만들어 실행하십시오.**

**워크플로 실행은 이번 라운드에 0회입니다.** 조사와 설계만 합니다.

기존 파일을 통째로 다시 쓰지 말고 증분 편집만 하십시오.

`Antigravity_Step*.md` 는 커밋하지 마십시오.

보고 전에 `git status --porcelain` 과 `git log --oneline -n 5`, `git rev-parse --abbrev-ref HEAD` 를 실행해 출력을 붙여넣으십시오.

---

## 10. 진행 순서

**1단계.** 작업 A 로 8월 25일 데이터 상태를 확인하고, 비어 있으면 백업에서 복원해 보고하십시오. **가장 먼저 하십시오.**

**2단계.** 작업 B 로 화면 API 의 `peerGroups` 를 그대로 붙여 보고하십시오.

**3단계.** 6번의 `.gitignore` 와 마이그레이션 추적 현황을 보고하십시오.

**4단계.** 5번의 `calculateFundFlow` 현재 동작을 읽고 무엇이 이미 있는지 보고하십시오.

**5단계.** 작업 C 의 재발행 설계를 제시하고 멈추십시오. **실행하지 마십시오.**

**1단계와 2단계를 먼저 보고하십시오.**
