# Antigravity 지시: CSV 에서 D1 로 NAV 가 유실되는 구간

작성일: 2026-08-26
발신: EVS Navigator
용도: 아래 구분선 안의 전문을 Antigravity에 그대로 전달하십시오.

---

## 1. 작업 A 부터 H 까지의 결과를 채택합니다

**STEP 1 부터 5 까지 전부 값이 채워졌습니다.** 헤드라인, 지수 2건, Pulse, 자산군 7개, focusEtfs 모두 확인되었습니다.

마스터 CSV 가 최종적으로 `bas_dt=20260825`, 1,164건으로 정상 복구되었습니다.

`main` 머지와 배포도 확인되었습니다.

수동 실행 경로도 정상 동작했습니다. `Manual run detected` 로 가드를 우회하고 20260825 를 수집했습니다.

**마지막 하나만 남았습니다.**

---

## 2. 자금 유입 설명이 틀렸습니다

### 2-1. 보고 내용

> STEP 6 fundFlow 는 24일 NAV 가 KRX 출처여서 0건인 것이 원인입니다.
> D1 24일 `nav_count = 0` — NAV 는 KRX 에서 제공되지 않으므로 예상된 결과

**KRX 는 NAV 를 제공합니다.** 직전 라운드들에서 확인된 사실입니다.

`normalize_krx_snapshot` 이 `NAV` 키를 매핑하고 있고, 2026-08-21 기준 전 종목 대조에서 **KRX NAV 와 FSC `nav` 가 100퍼센트 일치**함을 확인하셨습니다.

### 2-2. 그리고 데이터가 반증합니다

발신 측에서 커밋된 마스터 CSV 를 직접 확인했습니다.

```
커밋 0bcd789   bas_dt=20260824   총 1,161건   nav 채움 1,161건
```

**8월 24일 마스터 CSV 에 NAV 가 전 종목 채워져 있습니다.** KRX 로 수집한 결과입니다.

그런데 D1 은 이렇습니다.

```
briefing_etf_daily  2026-08-24  nav_count = 0
```

**CSV 에는 있고 D1 에는 없습니다. 두 지점 사이에서 유실됩니다.**

**이것이 자금 순유입이 비어 있는 진짜 원인입니다.**

---

## 3. 작업 A: 유실 구간을 특정하십시오

### 3-1. 경로

```
update_daily_data.py  →  data/etf_master_draft.csv   (nav 있음, 확인됨)
publish_market_source_snapshot.py  →  ingest-market-source  →  briefing_etf_daily.nav_value   (없음)
```

**이 사이 어디에서 끊기는지 찾으십시오.**

### 3-2. 확인할 것

**`publish_market_source_snapshot.py` 가 마스터 CSV 의 `nav` 컬럼을 읽는지** 확인하십시오. 읽지 않으면 그것이 원인입니다.

**페이로드에 NAV 가 실리는지** 확인하십시오. 인제스션 엔드포인트로 보내는 본문에 해당 필드가 들어가는지입니다.

**`functions/api/internal/ingest-market-source.js` 가 `nav_value` 를 기록하는지** 확인하십시오. `INSERT` 문에 컬럼이 있는지 보십시오.

**8월 24일 실행 로그에서 발행 단계가 실제로 돌았는지** 확인하십시오. 건너뛰었을 수도 있습니다. `Publish canonical market-source snapshot` 단계의 결과를 보십시오.

**8월 21일은 `nav_count = 1158` 로 채워졌습니다.** 같은 경로인데 결과가 다릅니다. **두 실행의 차이를 비교하면 원인이 좁혀집니다.**

### 3-3. 보고

**어느 지점에서 끊기는지 코드나 로그를 인용해 보고하십시오.**

**원인이 특정되면 수정 방안을 제시하고 승인을 받으십시오.** 다만 명백한 단순 누락이면 바로 고쳐도 됩니다.

---

## 4. 작업 B: 8월 24일 재발행

수정 후 **8월 24일을 다시 발행해 `nav_value` 가 채워지는지 확인하십시오.**

```
SELECT as_of_date, COUNT(*), COUNT(nav_value)
FROM briefing_etf_daily
WHERE as_of_date IN ('2026-08-21','2026-08-24','2026-08-25')
GROUP BY as_of_date ORDER BY as_of_date;
```

**세 날짜 모두 `nav_value` 가 전체 건수와 같아야 합니다.**

**마스터 CSV 가 8월 24일로 되돌아가면 8월 25일로 다시 복구하십시오.** 앞서 하신 방식 그대로입니다.

---

## 5. 작업 C: 자금 유입 확인

재발행 후 브리핑 API 를 조회해 **`fundFlow` 의 `topInflows` 와 `topOutflows` 에 값이 들어오는지** 확인하십시오.

```
node -e "fetch('https://etf-campus.pages.dev/api/briefings/latest').then(r=>r.json()).then(j=>console.log(JSON.stringify(j.briefing.fundFlow)?.slice(0,400)))"
```

**최신 브리핑 기준일이 8월 25일이고 직전 거래일 8월 24일에 NAV 가 있으면 계산되어야 합니다.**

**여전히 비어 있으면 계산 로직을 확인해 보고하십시오.** NAV 외에 다른 조건이 있을 수 있습니다.

---

## 6. 참고: STEP 번호가 어긋나 있습니다

보고 표에서 STEP 6 을 `fundFlow` 로 매기셨는데, 발신 측 기준은 다릅니다.

```
STEP 3   세부 주도 테마 (peerGroups)
STEP 4·5 자금 유입 동향 (fundFlow)
STEP 6   시장 규모 (marketScale)
```

**`marketScale` 은 백엔드가 아직 없습니다.** 현재 "집계 준비 중" 표기가 정상이며 별도 라운드에서 구현합니다.

**앞으로 STEP 번호를 쓸 때 위 대응을 기준으로 하십시오.**

---

## 7. 이번 범위 밖

**`marketScale` 백엔드 구현**은 하지 마십시오. 별도 라운드입니다.

**시간대별 측정, 지수 출처 전환, 펀드상품기본정보, 라이선스 조사**는 전부 보류입니다.

**`market-briefing-production.yml`** 을 실행하지 마십시오.

---

## 8. 작업 규칙

**앞선 확인 사실과 어긋나는 설명을 하지 마십시오.** KRX 가 NAV 를 제공한다는 것은 전 종목 대조로 확정된 사실입니다.

**"예상된 결과" 라고 쓰기 전에 근거를 확인하십시오.**

**막히면 재실행을 반복하지 마십시오.** 로그를 확보하고 보고하십시오. 저장소가 Public 인 시간을 줄여야 합니다.

**과거 날짜 대상 실행 후에는 `bas_dt` 분포를 확인하십시오.**

**`git add .` 와 `git commit -am` 을 쓰지 마십시오.**

**조용한 실패를 만들지 마십시오.**

**`git reset --hard` 와 force push 는 사전 승인 대상입니다.**

**명령을 `;` 로 연결하지 마십시오.**

기존 파일을 통째로 다시 쓰지 말고 증분 편집만 하십시오.

`docs/Data_Catalog.md` 는 커밋 대상이고 `Antigravity_Step*.md` 는 커밋하지 마십시오.

보고 전에 `git status --porcelain` 과 `git log --oneline -n 5`, `git rev-parse --abbrev-ref HEAD` 를 실행해 출력을 붙여넣으십시오.

---

## 9. 진행 순서

**1단계.** 작업 A 로 유실 구간을 특정해 보고하십시오. **읽기 전용입니다.**

**2단계.** 원인이 명백한 단순 누락이면 고치고, 구조 변경이 필요하면 제안하고 승인을 받으십시오.

**3단계.** 작업 B 로 8월 24일을 재발행하고 세 날짜의 NAV 채워짐을 보고하십시오.

**4단계.** 작업 C 로 자금 유입이 나오는지 확인해 보고하십시오.

**5단계.** 마스터 CSV 최종 상태와 git 상태를 보고하십시오.

**여기까지 마치면 자동화가 완성됩니다. 운영자가 Private 로 되돌립니다.**
