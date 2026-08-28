# Antigravity 지시: STEP 3 주식 세부 테마 복구

작성일: 2026-08-26
발신: EVS Navigator
용도: 아래 구분선 안의 전문을 Antigravity에 그대로 전달하십시오.

---

## 1. 원인이 특정되었습니다

### 1-1. 증상

STEP 3 자산군 카드 네 개 중 **주식-국내와 주식-해외가 "집계 기준(3종목 이상)에 부합하는 세부 테마가 없습니다" 로 비어 있습니다.**

채권은 2개(국채 51, 회사채 30), 원자재는 1개(금 7)가 정상 표시됩니다.

### 1-2. 데이터 확인 결과

`data/classification/etf_classification_review_draft.csv` 의 `asset_detail` 채움 현황입니다.

```
주식        856종목   detail 채움    1건
채권        136종목   detail 채움   91건
원자재       24종목   detail 채움   23건
통화         12종목   detail 채움   12건
혼합자산      81종목   detail 채움    0건
금리·파킹     43종목   detail 채움    0건
리츠/인프라    12종목   detail 채움    4건
```

**주식 856종목 중 세부 분류가 1건뿐입니다.** 이 파일만으로는 주식 세부 테마가 나올 수 없습니다.

### 1-3. 폴백이 있는데 작동하지 않습니다

`scripts/publish_market_source_snapshot.py` 82~91행입니다.

```python
comparison_path = Path("data/comparison/etf_comparison_classification.csv")
if comparison_path.exists():
    ...
    topic = (row.get("comparison_topic") or "").strip()
    if topic and topic not in ["미확인 주식전략", "미분류"]:
        class_map[ticker] = topic
```

**주식 세부 테마는 이 파일에서 옵니다. 그런데 그 파일이 현재 작업 트리에 없습니다.**

`data/comparison/` 에는 `backup_classification/` 하위 디렉터리만 있습니다.

**`comparison_path.exists()` 가 거짓이라 폴백이 통째로 건너뛰어집니다. 오류도 나지 않습니다.**

### 1-4. 파일은 저장소에 있습니다

**`origin/main` 에 해당 파일이 존재합니다.** 작업 트리에만 없습니다.

`.gitignore` 에도 걸려 있지 않습니다.

`f615abe feat(peer-groups): apply updated comparison classifications and UI logic for full coverage` 커밋에서 갱신된 파일이며, **1,160행에 다음 세부 테마가 들어 있습니다.**

```
S&P500            46      반도체              43
인공지능           40      고배당              33
리츠·인프라        31      스타일·팩터          29
기업집단           25      바이오·제약·헬스케어   22
2차전지·배터리 소재  20      나스닥100           19
배당다우존스        16
```

**전부 집계 기준 3종목을 넘습니다. 복구하면 주식 카드가 채워집니다.**

---

## 2. 작업 A: 파일 복구

**저장소에서 되살리십시오.**

```
git checkout origin/main -- data/comparison/etf_comparison_classification.csv
```

**복구 후 확인하십시오.**

파일이 존재하는지, 행 수가 1,160행 안팎인지입니다.

`comparison_topic` 컬럼이 있는지입니다.

**`data/comparison/` 아래에 다른 파일도 함께 사라졌는지 확인하십시오.**

```
git status --porcelain data/comparison/
git ls-tree origin/main data/comparison/
```

**`origin/main` 에는 있는데 작업 트리에 없는 파일을 전부 목록으로 보고하십시오.** 하나만 사라졌을 가능성은 낮습니다.

---

## 3. 작업 B: 왜 사라졌는지 확인

**같은 일이 반복되면 안 되므로 경위를 확인하십시오.**

오늘 다음 조작이 있었습니다.

```
git reset --hard HEAD~1     (main 에서 실행)
git reset --hard main       (dev 를 강제 정렬)
git push origin dev --force
git checkout data           (여러 차례)
```

**이 중 어느 것이 파일을 지웠는지 확인하십시오.**

`git checkout data` 로 되돌릴 때 **추적되지 않은 파일은 복원되지 않습니다.** 반대로 삭제된 추적 파일은 복원됩니다. 어느 경우인지 봐야 합니다.

**확인이 어려우면 그 사실만 보고하고 넘어가십시오.** 복구가 우선입니다.

**다만 앞으로 `git checkout <디렉터리>` 나 `git reset --hard` 를 실행하기 전에 `git status --porcelain` 으로 무엇이 사라지는지 확인하십시오.**

---

## 4. 작업 C: 재발행

**파일을 복구해도 D1 은 자동으로 바뀌지 않습니다.**

`asset_detail` 은 발행 시점에 D1 에 적재됩니다. **최신 브리핑을 재발행해야 반영됩니다.**

**최신 거래일 하나만 재발행하십시오.**

```
gh workflow run daily-market.yml -f target=<최신 거래일>
```

**과거 날짜를 소급 재발행하지 마십시오.** `market_briefings` 중복 발행 가드 때문에 건너뛰어지고, 시간만 낭비됩니다.

**실행 후 확인하십시오.**

```sql
SELECT asset_detail, COUNT(*) AS c
FROM briefing_etf_daily
WHERE as_of_date = '<최신 거래일>' AND is_general_etf = 1
GROUP BY asset_detail ORDER BY c DESC LIMIT 20;
```

**주식 세부 테마가 나와야 합니다.** 빈 문자열 그룹이 여전히 최상위면 다른 문제가 있는 것입니다.

**마스터 CSV 가 과거 날짜로 되돌아가지 않았는지 `bas_dt` 분포를 확인하십시오.**

---

## 5. 작업 D: 화면 확인

```
node -e "fetch('https://etf-campus.pages.dev/api/briefings/latest').then(r=>r.json()).then(j=>console.log(JSON.stringify(j.briefing.peerGroups)?.slice(0,600)))"
```

**네 카드에 각각 몇 개 테마가 나오는지 보고하십시오.**

**주식-국내와 주식-해외가 어떻게 나뉘는지도 확인하십시오.** `comparison_topic` 에는 국내·해외 구분이 없습니다. 화면이 무엇을 기준으로 두 카드를 나누는지 코드에서 확인해 보고하십시오. 복구 후에도 한쪽이 비면 그 기준에 문제가 있는 것입니다.

---

## 6. 남는 문제 (이번에 손대지 마십시오)

**`미확인 주식전략` 375건과 `미분류` 는 폴백 코드가 명시적으로 제외합니다.**

```python
if topic and topic not in ["미확인 주식전략", "미분류"]:
```

**즉 주식 856종목 중 375건은 복구 후에도 세부 테마가 없습니다.** 분류 작업이 미완인 영역입니다.

**이번에 채우려 하지 마십시오.** 현황만 보고하십시오. 별도 과제입니다.

---

## 7. 조용한 실패를 막으십시오

**이번 사고의 본질은 파일이 없어도 아무 일이 일어나지 않았다는 것입니다.**

```python
if comparison_path.exists():
    ...
```

**파일이 없으면 그냥 건너뜁니다. 로그도 없습니다.**

**다음을 추가하십시오.**

파일이 없으면 **경고를 출력하십시오.** 경로와 함께 "주식 세부 테마가 비게 됩니다" 를 명시하십시오.

**`class_map` 에 담긴 항목 수와 전체 종목 수를 실행 종료 시 출력하십시오.**

**`asset_detail` 이 채워진 비율이 임계 미만이면 경고하십시오.** 임계값을 제안하십시오. **파이프라인을 중단시키지는 마십시오.**

**같은 패턴이 다른 곳에도 있는지 확인하십시오.** `Path(...).exists()` 로 감싸고 없으면 조용히 넘어가는 코드를 전수 검색해 목록으로 보고하십시오.

---

## 8. 이번 범위 밖

**분류 데이터를 새로 만들거나 채우지 마십시오.**

**`etf_classification_review_draft.csv` 를 수정하지 마십시오.**

**STEP 1 지표 복구(Step54)와 STEP 5·6 설계(Step55)는 별도 지시서입니다.** 이 건과 독립입니다.

**파이프라인 출처 변경, URL 구조, 사이트맵**은 착수하지 마십시오.

---

## 9. 작업 규칙

**`git checkout <디렉터리>` 와 `git reset --hard` 전에 `git status --porcelain` 으로 영향 범위를 확인하십시오.**

**파일 존재 확인 후 조용히 건너뛰는 코드를 만들지 마십시오. 경고를 남기십시오.**

**워크플로 실행은 최대 2회입니다.** 재발행과 필요 시 마스터 CSV 복구입니다.

**과거 날짜를 소급 재발행하지 마십시오.**

**`git add .` 와 `git commit -am` 을 쓰지 마십시오.**

**명령을 `;` 로 연결하지 마십시오.**

**스크립트는 `scratch/` 안에 파일로 만들어 실행하십시오.**

기존 파일을 통째로 다시 쓰지 말고 증분 편집만 하십시오.

`Antigravity_Step*.md` 는 커밋하지 마십시오.

보고 전에 `git status --porcelain` 과 `git log --oneline -n 5`, `git rev-parse --abbrev-ref HEAD` 를 실행해 출력을 붙여넣으십시오.

---

## 10. 진행 순서

**1단계.** 작업 A 로 파일을 복구하고, `data/comparison/` 아래 사라진 파일 전체 목록을 보고하십시오.

**2단계.** 작업 B 의 경위를 확인해 보고하십시오. **어려우면 그 사실만 적고 넘어가십시오.**

**3단계.** 작업 C 로 최신 거래일을 재발행하고 `asset_detail` 분포를 보고하십시오.

**4단계.** 작업 D 로 네 카드의 테마 수와 국내·해외 구분 기준을 보고하십시오.

**5단계.** 7번의 경고 추가를 구현하고, `Path(...).exists()` 전수 검색 결과를 보고하십시오.

**1단계와 2단계를 먼저 보고하십시오. 3단계 이후는 그 뒤에 진행하십시오.**
