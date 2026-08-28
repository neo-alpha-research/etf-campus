# Antigravity 지시: 실행 중단 후 일괄 수정

작성일: 2026-08-26
발신: EVS Navigator
용도: 아래 구분선 안의 전문을 Antigravity에 그대로 전달하십시오.

---

## 0. 지금 하던 것을 멈추십시오

**워크플로 추가 실행을 중지하십시오.** 진행 중인 것이 있으면 완료만 기다리고 새로 실행하지 마십시오.

### 0-1. 현재 상태

발신 측에서 공개 API 를 직접 조회한 결과입니다.

```
asOfDate    2026-08-24   isStale true   staleDays 2
fundFlow    inflows 0건, outflows 0건
peerGroups  0건
```

**브리핑이 8월 24일로 후퇴했고 목표였던 세 항목이 여전히 비어 있습니다.**

### 0-2. 무엇이 문제인가

`normalizeEtf` 수정(`af8d5cf`)은 옳았고 반영되었습니다. **그 뒤가 문제입니다.**

```
13:35  b201a14  allow ^TNX, ^VIX, T10Y2Y in INDEX_CODES
13:49  d26d763  map index codes to canonical D1 ingest codes
13:49  6d82f04  map index codes to canonical D1 ingest codes
13:55  071e314  exclude 금리·파킹 from is_general_etf
14:10  056746f  pass and persist isGeneralEtf explicitly
14:16  cba7821  pass only KOSPI and KOSDAQ
```

**`^TNX` 를 허용했다가 40분 뒤 KOSPI 와 KOSDAQ 만 보내는 쪽으로 되돌렸습니다. 같은 문제에서 양방향으로 갔습니다.**

`d26d763` 과 `6d82f04` 는 같은 시각에 같은 메시지로 중복 커밋되었습니다.

**워크플로 한 번이 4~5분입니다. 코드를 읽지 않고 실행으로 확인하면 그 시간이 그대로 곱해집니다.**

---

## 1. 답은 저장소에 있었습니다

`migrations/0013_expand_index_codes.sql` 입니다.

```sql
index_code TEXT NOT NULL CHECK (index_code IN ('KOSPI','KOSDAQ','TNX','VIX','CLF'))
```

**데이터베이스는 `TNX` 를 받습니다. 캐럿이 붙은 `^TNX` 를 안 받을 뿐입니다.**

**벤더 심볼을 내부 코드로 정규화하는 것이 정답이었습니다.**

```
^TNX  →  TNX
^VIX  →  VIX
CL=F  →  CLF
```

**KOSPI 와 KOSDAQ 만 보내도록 후퇴한 것은 지표를 버린 것입니다.** 되돌리십시오.

---

## 2. 시행착오를 멈추고 한 번에 고치십시오

### 2-1. 먼저 게이트를 전부 열거하십시오

**실행하지 말고 코드와 스키마를 읽으십시오.**

`functions/api/internal/ingest-market-source.js` 에서 요청을 거부하거나 값을 버리는 지점을 **전부 찾아 목록으로 만드십시오.** 검증 조건, 화이트리스트, 개수 비교, 정규식 판정 전부입니다.

`migrations/*.sql` 에서 관련 테이블의 `CHECK` 제약과 `NOT NULL` 을 **전부 찾아 목록으로 만드십시오.**

**두 목록을 대조해 지금 보내는 값이 각 게이트를 통과하는지 표로 정리하십시오.**

| 게이트 | 위치 | 조건 | 현재 보내는 값 | 통과 여부 |

**이 표를 만든 뒤에 코드를 고치십시오. 표 없이 고치면 또 한 번에 하나씩 걸립니다.**

### 2-2. 그다음 한 번에 고치십시오

목록에서 걸리는 항목을 **모두 함께 수정한 뒤 한 번만 실행하십시오.**

---

## 3. 되돌려야 할 변경

### 3-1. `071e314` 일반 ETF 정의 변경

`exclude 금리·파킹 from is_general_etf` 는 **검증을 통과시키려고 비즈니스 로직을 바꾼 것으로 보입니다.**

`is_general_etf` 는 STEP 3·4·5 의 모집단을 정의합니다. **여기서 종목을 빼면 화면 수치가 조용히 달라집니다.**

**확인해 보고하십시오.**

이 변경 전후로 `is_general_etf = 1` 건수가 어떻게 달라졌는지입니다.

원래 검증이 무엇과 무엇을 비교하고 있었고, 왜 어긋났는지입니다.

**검증이 막았다면 검증을 고칠 것이 아니라 왜 값이 안 맞는지를 봐야 합니다.** 발신 측이 이 세션에서 반복해 지적한 사항입니다.

**정당한 근거가 없으면 되돌리십시오.**

### 3-2. `cba7821` 지수 축소

1번에 따라 정규화로 해결하고 되돌리십시오.

---

## 4. 목표를 다시 확인하십시오

**이번 작업의 목표는 세 가지입니다.**

```
briefing_etf_daily.nav_value      채워짐  →  fundFlow 계산
briefing_etf_daily.asset_detail   채워짐  →  peerGroups 표시
브리핑 기준일이 최신 거래일        →  isStale false
```

**세 가지가 동시에 만족되어야 끝입니다. 하나씩 확인하며 실행을 반복하지 마십시오.**

---

## 5. 실행은 마지막에 한 번만

수정을 전부 마치고 배포한 뒤 **8월 25일 하나만 실행하십시오.**

```
gh workflow run daily-market.yml -f target=20260825
```

**8월 24일은 나중입니다.** 최신 기준일을 먼저 살리는 것이 우선입니다.

실행 후 다음을 한 번에 확인하십시오.

```sql
SELECT as_of_date, COUNT(*) AS total,
       COUNT(nav_value) AS nav,
       COUNT(NULLIF(asset_detail,'')) AS detail,
       SUM(is_general_etf) AS general
FROM briefing_etf_daily
WHERE as_of_date = '2026-08-25';
```

```
node -e "fetch('https://etf-campus.pages.dev/api/briefings/latest').then(r=>r.json()).then(j=>{const b=j.briefing;console.log(b.asOfDate,b.isStale,(b.fundFlow?.topInflows||[]).length,(b.peerGroups||[]).length)})"
```

**실패하면 재실행하지 말고 로그를 확보해 보고하십시오.**

---

## 6. 작업 규칙

**실행으로 시행착오하지 마십시오.** 워크플로 한 번이 4~5분입니다. 코드와 스키마를 먼저 읽으십시오.

**검증이 막으면 검증을 완화하지 마십시오.** 왜 값이 안 맞는지를 규명하십시오.

**같은 문제에서 양방향으로 가지 마십시오.** 되돌리기 전에 왜 처음 방향이 틀렸는지 확인하십시오.

**비즈니스 로직을 검증 통과 목적으로 바꾸지 마십시오.** `is_general_etf` 같은 정의 변경은 승인 대상입니다.

**막히면 재실행을 반복하지 말고 보고하십시오.**

`git add .` 와 `git commit -am` 을 쓰지 마십시오.

`docs/Data_Catalog.md` 는 커밋 대상이고 `Antigravity_Step*.md` 는 커밋하지 마십시오.

---

## 7. 진행 순서

**1단계.** 워크플로 실행을 멈추십시오.

**2단계.** 2-1 의 게이트 목록과 대조표를 만들어 보고하십시오. **읽기 전용입니다. 여기서 한 번 멈추십시오.**

**3단계.** 3-1 의 `is_general_etf` 변경 경위를 함께 보고하십시오.

**4단계.** 승인 후 걸리는 항목을 한 번에 수정하고 배포하십시오.

**5단계.** 8월 25일을 한 번만 실행하고 5번의 확인 결과를 보고하십시오.
