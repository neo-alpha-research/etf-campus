# Antigravity 지시: 내일 아침 검증과 미해명 두 가지

작성일: 2026-08-26
발신: EVS Navigator
용도: **내일(8월 27일) 오전 자동 실행이 끝난 뒤** 아래 구분선 안의 전문을 Antigravity에 전달하십시오.

---

## 0. 어제 STEP 3 이 복구되었습니다

**세 곳 교차 검증이 일치했습니다. 판정 방식대로 확인했습니다.**

```
D1 market_briefings            groups = 30
briefing_etf_daily             with_detail = 691
화면 API peerGroups            30개
```

**S&P500 44, 인공지능 40, 반도체 39, 고배당 33, 스타일·팩터 29 등 주식 테마가 화면에 나옵니다.**

**GitHub Actions 없이 아웃박스 상태 제어만으로 5분 만에 재발행이 완료되었습니다.** 앞으로 정정 작업의 표준 절차가 됩니다.

`docs/Data_Catalog.md` 에 2-13 부터 2-17 까지 어제 확인된 사실을 기록했습니다. **작업 전에 읽으십시오.**

---

## 1. 오늘 아침 자동 실행 검증

**08시 07분 자동 실행 결과를 확인하십시오. 8월 26일은 처음 발행되는 날짜이므로 세 잠금 어디에도 걸리지 않습니다.**

**세 곳을 모두 확인해 보고하십시오. 화면 API 하나만으로 판정하지 마십시오.**

```sql
-- 1  D1 원본
SELECT as_of_date, json_extract(metrics_json, '$.peer_group_version') AS ver,
       json_array_length(json_extract(metrics_json, '$.peer_groups')) AS groups
FROM market_briefings ORDER BY as_of_date DESC LIMIT 4;

-- 2  적재 상태
SELECT COUNT(*) AS total, COUNT(NULLIF(asset_detail,'')) AS with_detail,
       COUNT(shares) AS with_shares, COUNT(nav_value) AS with_nav
FROM briefing_etf_daily WHERE as_of_date = '2026-08-26' AND is_general_etf = 1;
```

**3. 화면 API `peerGroups` 전문**

**세 곳이 일치하면 자동화는 완성입니다.**

**어긋나면 KV 문제입니다.** `GET /api/briefings/2026-08-26` 으로 D1 직접 조회와 비교해 보십시오.

**실패했으면 고치지 말고 원인을 보고하십시오.**

---

## 2. 미해명 하나: 그룹 수가 8월 24일보다 줄었습니다

**어제 조회에서 이렇게 나왔습니다.**

```
2026-08-25   groups = 30    (어제 재발행한 것)
2026-08-24   groups = 51
2026-08-21   groups =  3
```

**8월 24일이 51개인데 8월 25일은 30개입니다. 21개가 줄었습니다.**

**8월 24일 브리핑은 분류 파일이 삭제되기 전에 발행된 것입니다.** 즉 **당시 분류 상태가 지금보다 풍부했을 가능성이 있습니다.**

`git checkout origin/main -- data/comparison/etf_comparison_classification.csv` 로 되살린 것은 **커밋된 버전**입니다. **작업 트리에 커밋되지 않은 개선분이 있었다면 그것은 복구되지 않았습니다.**

### 2-1. 확인할 것

**8월 24일 브리핑의 `metrics_json` 에서 `peer_groups` 의 `peerGroup` 이름 51개를 전부 뽑으십시오.**

```sql
SELECT json_extract(metrics_json, '$.peer_groups') FROM market_briefings WHERE as_of_date = '2026-08-24';
```

**8월 25일의 30개와 비교해 8월 24일에만 있는 이름을 목록으로 보고하십시오.**

**그 이름들이 현재 `data/comparison/etf_comparison_classification.csv` 의 `comparison_topic` 에 존재하는지 확인하십시오.**

```
존재한다   → 종목 수가 3개 미만으로 떨어져 임계에서 걸린 것. 정상입니다.
없다       → 분류 데이터 일부가 소실된 것. 복구가 필요합니다.
```

**둘 중 어느 쪽인지 확정한 뒤 보고하십시오. 추정하지 마십시오.**

### 2-2. 없는 경우

**`git log` 로 해당 파일의 이전 버전들을 살펴보십시오.**

```
git log --oneline --all -- data/comparison/etf_comparison_classification.csv
```

**`f615abe` 외에 더 최신 버전이 다른 브랜치나 stash 에 있는지 확인하십시오.**

**찾으면 보고만 하고 적용하지 마십시오.**

---

## 3. 미해명 둘: 일반 ETF 가 1,015에서 1,018로 늘었습니다

**어제 조회 결과입니다.**

```
total = 1018    with_detail = 691    with_shares = 1015
```

**`total` 이 1,018 인데 `with_shares` 가 1,015 입니다. 세 종목에 좌수가 없습니다.**

**이전까지 일반 ETF 는 1,015 였습니다.**

### 3-1. 원인 가설

**`briefing_etf_daily` 는 `(as_of_date, ticker)` 로 UPSERT 됩니다. 삭제가 없습니다.**

```
source-materializer.ts L149
ON CONFLICT(as_of_date, ticker) DO UPDATE SET ...
```

**따라서 과거 실행에서 들어왔다가 현재 스냅샷에는 없는 종목이 그대로 남습니다.** 재발행해도 갱신되지 않으므로 `shares` 가 NULL 인 채로 남습니다.

**8월 21일에 `market_source_etf_daily` 가 2,316행이었던 것과 같은 계열입니다.**

### 3-2. 확인할 것

**세 종목을 특정하십시오.**

```sql
SELECT ticker, etf_name, asset_class, source_run_id, inserted_at
FROM briefing_etf_daily
WHERE as_of_date = '2026-08-25' AND is_general_etf = 1 AND shares IS NULL;
```

**그 종목이 현재 마스터 CSV 와 허브에 있는지 확인하십시오.**

```sql
SELECT ticker, source_version FROM market_source_etf_daily
WHERE as_of_date = '2026-08-25' AND ticker IN ('...');
```

**`source_run_id` 가 방금 재발행한 것과 다른지 보십시오. 다르면 고아 행이 맞습니다.**

### 3-3. 왜 중요한가

**STEP 5·6 롤업이 이 모집단 위에서 계산됩니다.**

**고아 행이 섞이면 시장 규모 합계가 부풀고, 순유입 교집합 계산이 어긋납니다.** 작업 D 착수 전에 정리 방침이 필요합니다.

**이번에는 진단만 하십시오. 지우지 마십시오.**

**전체 날짜에 고아 행이 얼마나 있는지도 함께 조회해 보고하십시오.**

```sql
SELECT as_of_date, COUNT(*) AS total, COUNT(shares) AS with_shares
FROM briefing_etf_daily WHERE is_general_etf = 1 GROUP BY as_of_date ORDER BY as_of_date DESC;
```

---

## 4. 8월 24일 재발행은 그다음입니다

**허브가 131건이므로 `daily-market.yml` 을 8월 24일로 재실행해야 합니다.**

**2번 조사가 끝난 뒤에 판단합니다.** 8월 24일이 51개였던 이유를 모르는 채로 재발행하면 30개로 덮어써 버립니다. **되돌릴 수 없습니다.**

**이번 라운드에서 8월 24일과 8월 21일을 건드리지 마십시오.**

---

## 5. 이번 범위 밖

**작업 D 테이블을 만들지 마십시오.** 3번 정리 방침이 정해진 뒤입니다.

**분류 데이터를 새로 만들거나 채우지 마십시오.**

**고아 행을 지우지 마십시오.**

**KV 무효화 경로를 구현하지 마십시오.**

**`미확인 주식전략` 375건을 분류하지 마십시오.**

**STEP 1 지표 복구는 Step54 별도 지시서입니다.**

**URL 구조, 사이트맵, 아카이브 페이지네이션**은 착수하지 마십시오.

---

## 6. 작업 규칙

**워크플로 실행은 이번 라운드에 0회입니다.**

**프로덕션에서 DELETE 와 UPDATE 를 하지 마십시오.** 조회만 합니다.

**모든 보고에 화면 API 결과를 포함하십시오.**

**추정하지 마십시오.** 2-1 은 있는지 없는지 둘 중 하나로 답이 나옵니다.

**`git add .` 와 `git commit -am` 을 쓰지 마십시오.**

**명령을 `;` 로 연결하지 마십시오.**

**스크립트는 `scratch/` 안에 파일로 만들어 실행하십시오.**

기존 파일을 통째로 다시 쓰지 말고 증분 편집만 하십시오.

`docs/Data_Catalog.md` 는 커밋 대상이고 `Antigravity_Step*.md` 는 커밋하지 마십시오.

보고 전에 `git status --porcelain` 과 `git log --oneline -n 5`, `git rev-parse --abbrev-ref HEAD` 를 실행해 출력을 붙여넣으십시오.

---

## 7. 진행 순서

**1단계.** 1번의 세 곳을 확인해 8월 26일 자동 발행 결과를 보고하십시오. **가장 먼저 하십시오.**

**2단계.** 2-1 로 8월 24일에만 있는 그룹 이름을 뽑아 분류 파일에 존재하는지 확정해 보고하십시오.

**3단계.** 3-2 로 좌수 없는 세 종목을 특정하고, 전체 날짜 고아 행 현황을 보고하십시오.

**4단계.** 여기서 멈추십시오.
