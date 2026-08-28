# Antigravity 지시: 8월 25일 1회 실행 승인

작성일: 2026-08-26
발신: EVS Navigator
용도: 아래 구분선 안의 전문을 Antigravity에 그대로 전달하십시오.

---

## 1. 게이트 대조표를 채택합니다

**14개 게이트를 코드와 스키마에서 전수 정리하신 것이 정확합니다.** 요청한 형식 그대로 나왔고 각 항목이 근거와 함께 채워져 있습니다.

---

## 2. 발신 측 지적 두 건을 철회합니다

### 2-1. 지수 코드 건

발신 측이 직전 지시서에서 다음과 같이 썼습니다.

> 데이터베이스는 `TNX` 를 받습니다. 캐럿이 붙은 `^TNX` 를 안 받을 뿐입니다. 벤더 심볼을 내부 코드로 정규화하는 것이 정답이었습니다.

**틀렸습니다.**

```
migrations/0013  →  market_index_daily        IN ('KOSPI','KOSDAQ','TNX','VIX','CLF')
migrations/0007  →  market_source_index_daily IN ('KOSPI','KOSDAQ')
```

**두 개의 다른 테이블입니다.** 스냅샷 허브는 여전히 두 지수만 받습니다.

발신 측이 스키마를 읽으면서 어느 테이블인지 확인하지 않았습니다. **`cba7821` 로 KOSPI 와 KOSDAQ 만 보내도록 하신 판단이 옳습니다. 되돌리지 마십시오.**

### 2-2. `is_general_etf` 건

`071e314` 를 "검증 통과 목적의 비즈니스 로직 변경" 으로 의심했으나 **근거가 없었습니다.**

`d1d4984 exclude parking ETFs from general ETFs in backend` 가 이전부터 있었고, `scripts/publish_market_source_snapshot.py` 336행이 그 정의를 씁니다. **JS 엔드포인트만 어긋나 있었고, Python 정의에 맞춘 것이 옳습니다.**

**`isGeneralEtf` 를 페이로드에 명시적으로 실어 보내도록 바꾸신 것은 더 나은 설계입니다.** 정의가 한 곳에만 존재하게 됩니다. 유지하십시오.

---

## 3. G14 는 중요한 발견입니다

```javascript
// source-materializer.ts L100
SELECT as_of_date FROM market_briefings WHERE as_of_date = ?
→ 존재하면 skipped_duplicate
```

**한 번 발행된 날짜는 다시 발행할 수 없습니다.**

8월 24일을 여러 번 실행하고도 갱신되지 않은 이유가 이것입니다. 원본 데이터를 고쳐도 화면이 바뀌지 않습니다.

**이번 실행에는 영향이 없습니다.** 8월 25일에는 아직 행이 없기 때문입니다.

**다만 구조적 한계입니다.** 잘못 발행된 날짜를 정정할 방법이 없습니다. **정정 경로를 어떻게 만들지 제안해 보고하십시오. 구현은 이번 범위가 아닙니다.**

---

## 4. 8월 25일 1회 실행을 승인합니다

**추가 코드 수정 없이 한 번만 실행하십시오.**

```
gh workflow run daily-market.yml -f target=20260825
```

### 4-1. 실행 전 확인

**`market_briefings` 에 2026-08-25 행이 없는지 먼저 확인하십시오.**

```
SELECT as_of_date, status FROM market_briefings ORDER BY as_of_date DESC LIMIT 3;
```

**이미 있으면 실행해도 `skipped_duplicate` 로 끝납니다.** 그 경우 실행하지 말고 보고하십시오.

### 4-2. 실행 후 확인

```sql
SELECT as_of_date, COUNT(*) AS total,
       COUNT(nav_value) AS nav,
       COUNT(NULLIF(asset_detail,'')) AS detail,
       SUM(is_general_etf) AS general
FROM briefing_etf_daily
WHERE as_of_date = '2026-08-25';
```

```
node -e "fetch('https://etf-campus.pages.dev/api/briefings/latest').then(r=>r.json()).then(j=>{const b=j.briefing;console.log('asOfDate',b.asOfDate,'isStale',b.isStale);console.log('inflows',(b.fundFlow?.topInflows||[]).length);console.log('outflows',(b.fundFlow?.topOutflows||[]).length);console.log('peerGroups',(b.peerGroups||[]).length);console.log('generalEtfCount',b.pulse?.generalEtfCount)})"
```

**목표 상태입니다.**

```
asOfDate    2026-08-25
isStale     false
nav         total 과 동일
detail      total 과 동일
inflows     1건 이상
peerGroups  1건 이상
```

**실패하면 재실행하지 말고 로그를 확보해 보고하십시오.**

### 4-3. 마스터 CSV

실행 후 `bas_dt` 분포가 `20260825` 단일값인지 확인하십시오.

---

## 5. 완료 후

**8월 24일은 지금 손대지 마십시오.** G14 때문에 재발행이 불가능하며, 정정 경로가 정해진 뒤에 처리합니다.

**`marketScale` 백엔드, 고아 레코드 정리, 발행 정정 경로**는 전부 별도 라운드입니다.

**카탈로그에 다음을 기록하십시오.**

`normalizeEtf` 가 `navValue`, `assetDetail`, `disparityPct` 를 누락시키던 버그와 2026-08-26 수정 사실입니다.

**`market_briefings` 중복 발행 가드로 한 번 발행된 날짜를 정정할 수 없다는 한계**입니다.

**`market_source_index_daily` 는 KOSPI 와 KOSDAQ 만 받으며, 글로벌 지수는 `market_index_daily` 소관이라는 구분**입니다. 이번에 혼동이 있었던 지점입니다.

**`is_general_etf` 의 정의가 `risk_type = 'normal' AND asset_class != '금리·파킹'` 이며 Python 이 산출해 페이로드로 전달한다는 것**입니다.

**갱신 후 반영된 행 번호를 보고하십시오.**

---

## 6. 진행 순서

**1단계.** 4-1 의 `market_briefings` 확인을 하십시오.

**2단계.** 행이 없으면 8월 25일을 한 번 실행하십시오.

**3단계.** 4-2 와 4-3 의 확인 결과를 보고하십시오.

**4단계.** 5번의 카탈로그 갱신을 하고 행 번호를 보고하십시오.

**5단계.** 3번의 발행 정정 경로를 제안하십시오. **제안만 하십시오.**

**전부 마치고 한 번에 보고하십시오. 그러면 운영자가 Private 로 되돌립니다.**
