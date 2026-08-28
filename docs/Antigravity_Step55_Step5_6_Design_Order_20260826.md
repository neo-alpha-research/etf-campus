# Antigravity 지시: STEP 5·6 설계와 구현

작성일: 2026-08-26
발신: EVS Navigator
용도: 아래 구분선 안의 전문을 Antigravity에 그대로 전달하십시오.

---

## 0. 현재 상태와 원인

**STEP 5** 는 표 머리글만 있고 행이 없습니다. 주간과 월간 순유입을 계산할 이력이 없기 때문입니다.

**STEP 6** 은 총 운용자산이 "0.0 조원", 종목 수가 "0개", 모든 증감이 "+0 억원" 입니다. **백엔드가 구현되지 않은 채 프런트엔드가 목업 구조를 그리고 있습니다.**

**두 단계 모두 데이터 부족이 아니라 설계 부재입니다.** 이번에 설계를 확정하고 구현합니다.

---

## 1. 지표 정의 (이대로 구현하십시오)

### 1-1. 운용자산 증감과 자금 순유입은 다릅니다

**이것을 혼동하면 잘못된 지표가 됩니다.**

운용자산은 두 가지 이유로 변합니다. **가격이 오르면 자금이 한 푼도 안 들어와도 늘어납니다.** 설정과 환매로 좌수가 변해도 늘어납니다.

**후자만이 진짜 자금 유출입입니다.**

```
자산 증감(AUM)   = 총 AUM(T) - 총 AUM(기준일)      가격 효과 + 자금 효과
실질 자금 순유입  = Σ (좌수(T) - 좌수(기준일)) × NAV(T)   가격 효과 제거
```

**두 값을 각각 표시하고 이름을 구분하십시오.** 현재 STEP 6 화면이 "자산 증감(AUM)" 과 "실질 자금 순유입" 을 나란히 두고 있는데 **그 구조가 맞습니다.**

### 1-2. 순유입은 가산적입니다

**일간 순유입을 매일 저장해 두면 주간과 월간은 그 합으로 구합니다.**

```
주간 순유입 = 최근 5거래일 일간 순유입의 합
월간 순유입 = 최근 21거래일 일간 순유입의 합
```

**종목별 기간 비교가 필요 없습니다. 매일 직전 거래일과만 비교하면 됩니다.**

### 1-3. 누적 수익률은 복리로 계산하십시오

**일별 수익률을 단순 합산하지 마십시오.**

```
누적 수익률 = (1 + r1)(1 + r2) ... (1 + rn) - 1
```

단순 합산은 기간이 길어질수록 오차가 커집니다. **금융 지표에서 이 차이는 그냥 오류입니다.**

### 1-4. 자산 증감은 가산적이 아닙니다

**롤업 테이블의 해당 날짜 총액을 직접 빼서 구하십시오.** 일별 증감을 더하지 마십시오.

### 1-5. 좌수 결측 처리

**NAV 나 좌수가 없는 종목은 순유입 계산에서 제외하고 별도로 세십시오.**

**신규 상장 종목은 직전 거래일이 없으므로 제외하십시오.** 최초 설정액이 순유입으로 잡히면 특정 날짜에 큰 값이 튀어 추세 해석을 방해합니다.

**제외 건수를 기록하고 커버리지가 낮으면 값을 표시하지 마십시오.**

---

## 2. 빈 상태 설계 (중요)

### 2-1. 지금이 왜 나쁜가

**"0.0 조원" 은 거짓 정보입니다.** 국내 상장 ETF 총 운용자산이 0원일 수 없습니다. **금융 정보 서비스에서 사실과 다른 숫자를 표시하는 것은 값이 없는 것보다 나쁩니다.**

**빈 표 머리글만 있는 것은 고장으로 보입니다.** 이용자는 사이트가 망가졌다고 판단합니다.

### 2-2. 어떻게 할 것인가

**값이 없으면 숫자를 표시하지 말고 축적 진행률을 보여 주십시오.**

```
주간 동향     집계 준비 중 · 3 / 5 거래일 수집됨
월간 동향     집계 준비 중 · 3 / 21 거래일 수집됨
```

**이렇게 하면 고장이 아니라 쌓이는 중임이 전달됩니다.** 이용자가 언제 볼 수 있는지 알게 되고, 신뢰가 유지됩니다.

**일간 동향은 2거래일만 있으면 나오므로 먼저 채워집니다.** 일간이 먼저 나오고 주간과 월간이 순차로 열리는 모습 자체가 서비스가 살아 있다는 신호가 됩니다.

### 2-3. 표시 규칙

**계산 가능한 항목만 숫자로 표시하십시오.**

**계산 불가 항목은 진행률 문구로 대체하십시오.** 0 이나 빈칸을 쓰지 마십시오.

**총 운용자산과 총 상장 종목 수는 당일 값이므로 지금도 계산됩니다. 반드시 실제 값을 표시하십시오.** 백엔드가 `pulse.generalTotalAum` 을 이미 내려주고 있습니다.

---

## 3. 데이터 구조

### 3-1. 왜 롤업이 필요한가

**매 요청마다 `briefing_etf_daily` 를 날짜별로 스캔하면 종목 1,164건 곱하기 날짜 수만큼 행을 읽습니다.** D1 에서 이는 낭비이고 응답도 느립니다.

**날짜당 소수의 행으로 미리 집계해 두십시오.**

### 3-2. 테이블 두 개를 신설하십시오

**STEP 6 용 전체 집계입니다. 날짜당 1행입니다.**

```sql
CREATE TABLE IF NOT EXISTS market_scale_daily (
  as_of_date TEXT PRIMARY KEY CHECK (as_of_date GLOB '????-??-??'),
  etf_count INTEGER NOT NULL,
  total_aum REAL NOT NULL,
  aum_count INTEGER NOT NULL,
  prev_as_of_date TEXT,
  net_flow REAL,
  flow_count INTEGER,
  flow_excluded_count INTEGER,
  new_listing_count INTEGER,
  aum_weighted_return_pct REAL,
  source_run_id TEXT,
  computed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**STEP 5 용 피어그룹 집계입니다. 날짜당 피어그룹 수만큼입니다.**

```sql
CREATE TABLE IF NOT EXISTS peer_flow_daily (
  as_of_date TEXT NOT NULL CHECK (as_of_date GLOB '????-??-??'),
  asset_detail TEXT NOT NULL,
  etf_count INTEGER NOT NULL,
  total_aum REAL NOT NULL,
  net_flow REAL,
  flow_count INTEGER,
  aum_weighted_return_pct REAL,
  computed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (as_of_date, asset_detail)
);

CREATE INDEX IF NOT EXISTS idx_peer_flow_daily_date
  ON peer_flow_daily (as_of_date DESC);
```

**컬럼 구성이 부적절하다고 판단되면 착수 전에 제시하십시오. 임의로 바꾸지 마십시오.**

### 3-3. 계산 시점

**응답 시점이 아니라 적재 시점에 계산해 저장하십시오.**

**`workers/market-briefing-publisher/src/source-materializer.ts` 의 `materializeMarketSnapshot()` 안에서, `briefing_etf_daily` 적재가 끝난 직후에 계산하십시오.**

**`INSERT ... ON CONFLICT DO UPDATE` 로 작성하십시오.** 재발행이 흔하므로 멱등해야 합니다.

**계산 불가 시 NULL 로 두십시오. 0 으로 채우지 마십시오.** 0 은 "이동이 없었다" 이고 NULL 은 "모른다" 입니다. 합산할 때 의미가 완전히 달라집니다.

### 3-4. 조회

**기간 조회는 오프셋으로 하십시오.**

```sql
SELECT * FROM market_scale_daily
WHERE as_of_date <= ? ORDER BY as_of_date DESC LIMIT 1 OFFSET ?;
```

오프셋 1 이 직전 거래일, 5 가 5거래일 전, 21 이 21거래일 전입니다.

**순유입 합산은 범위 조회로 하십시오.**

```sql
SELECT SUM(net_flow) AS flow, COUNT(net_flow) AS days
FROM market_scale_daily WHERE as_of_date > ? AND as_of_date <= ?;
```

**`days` 가 기대 거래일 수보다 적으면 결측이 있는 것입니다. 그 사실을 응답에 담으십시오.**

---

## 4. 응답 스키마

### 4-1. STEP 6

```
marketScale: {
  asOfDate, totalAum, etfCount,
  coverage: { aum, flow },
  daily:   { refDate, deltaAum, netFlow, tradingDays, available, reason },
  weekly:  { refDate, deltaAum, netFlow, tradingDays, available, reason },
  monthly: { refDate, deltaAum, netFlow, tradingDays, available, reason }
}
```

### 4-2. STEP 5

```
trendFlow: {
  weekly:  { available, tradingDays, expectedDays, rows: [...] },
  monthly: { available, tradingDays, expectedDays, rows: [...] }
}

rows[]: { rank, assetDetail, netFlow, cumulativeReturnPct, etfCount }
```

### 4-3. 공통 규칙

**`available` 이 거짓이면 프런트엔드가 진행률 문구를 표시합니다.**

**`tradingDays` 와 `expectedDays` 를 함께 내려 "3 / 5 거래일" 표기를 만드십시오.**

**`refDate` 를 반드시 포함하십시오.** 휴장으로 기준일이 밀렸을 때 실제 비교 날짜를 화면에 밝혀야 합니다.

**`reason` 에는 `insufficient_history`, `nav_missing`, `low_coverage` 같은 값을 넣으십시오.**

**기존 응답 구조를 깨지 마십시오. 두 키를 추가만 하십시오.** `lib/hooks/use-market-briefing.ts` 의 타입에도 **선택 필드로** 추가하십시오. 과거 날짜에는 없을 수 있습니다.

---

## 5. 소급 집계

**`briefing_etf_daily` 에 이력이 있는 날짜에 대해 롤업을 소급 생성하십시오.**

**NAV 가 없는 날짜의 `net_flow` 는 NULL 로 두십시오.**

**별도 스크립트로 만들고 멱등하게 작성하십시오.** 여러 번 실행해도 같은 결과가 나와야 합니다.

**착수 전에 다음을 조회해 보고하십시오.**

```sql
SELECT as_of_date, COUNT(*) AS total,
       COUNT(aum_value) AS with_aum,
       COUNT(nav_value) AS with_nav,
       COUNT(NULLIF(asset_detail,'')) AS with_detail
FROM briefing_etf_daily WHERE is_general_etf = 1
GROUP BY as_of_date ORDER BY as_of_date DESC LIMIT 40;
```

**이 결과가 무엇을 언제부터 보여 줄 수 있는지 결정합니다.**

---

## 6. 검증

**총액 대조**입니다. `market_scale_daily.total_aum` 과 기존 `pulse.generalTotalAum` 이 같은 날짜에 일치해야 합니다. **다르면 어느 쪽이 맞는지 규명한 뒤 진행하십시오.**

**순유입 부호와 크기**입니다. 총 AUM 대비 극단적인 비율이 나오면 좌수 계산이 잘못된 것입니다.

**피어그룹 합계**입니다. `peer_flow_daily` 의 `total_aum` 합이 `market_scale_daily.total_aum` 과 일치해야 합니다. 분류 미지정 종목이 있으면 그만큼 차이가 나므로 그 건수도 함께 보고하십시오.

**복리 계산**입니다. 표본 하나를 손으로 계산해 대조하십시오.

**멱등성**입니다. 같은 날짜를 두 번 적재해 롤업 값이 변하지 않는지 확인하십시오.

**빈 상태**입니다. 이력이 부족한 구간에서 진행률 문구가 나오는지, 0 이 표시되지 않는지 확인하십시오.

---

## 7. 이번 범위 밖

**서술형 문장을 추가하지 마십시오.** 해석이나 전망을 얹으면 자본시장법 제101조 유사투자자문업 경계에 닿습니다. **사실 서술과 숫자만 표시하십시오.**

**STEP 1 지표 12개 복구**는 별도 지시서(Step54)로 진행합니다. 이 건과 독립입니다.

**아카이브 URL 구조와 사이트맵**은 별도 라운드입니다.

**파이프라인 출처 변경**을 하지 마십시오.

---

## 8. 작업 규칙

**자산 증감과 순유입을 혼동하지 마십시오.** 이름을 구분해 표시하십시오.

**누적 수익률을 단순 합산하지 마십시오.** 복리입니다.

**계산 불가를 0 으로 채우지 마십시오. NULL 과 0 은 다릅니다.**

**빈 상태에 숫자를 넣지 마십시오. 진행률 문구를 쓰십시오.**

**설계 대안을 임의로 고르지 말고 제시한 뒤 승인을 받으십시오.**

**응답 계약을 깨지 마십시오. 추가만 하십시오.**

**`git add .` 와 `git commit -am` 을 쓰지 마십시오.**

**조용한 실패를 만들지 마십시오.**

**명령을 `;` 로 연결하지 마십시오.**

**스크립트는 `scratch/` 안에 파일로 만들어 실행하십시오.**

**워크플로 실행을 남발하지 마십시오. 막히면 로그를 확보하고 보고하십시오.**

기존 파일을 통째로 다시 쓰지 말고 증분 편집만 하십시오.

`Antigravity_Step*.md` 는 커밋하지 마십시오.

보고 전에 `git status --porcelain` 과 `git log --oneline -n 5`, `git rev-parse --abbrev-ref HEAD` 를 실행해 출력을 붙여넣으십시오.

---

## 9. 진행 순서

**1단계.** 5번의 이력 조회를 실행해 보고하십시오. **읽기 전용입니다.**

**2단계.** 다음 세 가지를 제안해 보고하십시오. 롤업 계산을 넣을 정확한 코드 위치, 3-2 컬럼 구성 확정안, 커버리지 임계값입니다. **여기서 멈추십시오.**

**3단계.** 승인 후 마이그레이션과 롤업 계산을 구현하십시오.

**4단계.** 소급 집계 스크립트를 만들어 실행하십시오.

**5단계.** 워커 응답과 프런트엔드를 연결하십시오. **빈 상태 처리를 반드시 포함하십시오.**

**6단계.** 6번의 검증을 수행해 보고하십시오.

**한 번에 다 하지 마십시오. 1단계와 2단계 보고 후 지시를 받으십시오.**
