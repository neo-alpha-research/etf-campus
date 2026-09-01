# ETF Campus 데이터 카탈로그

최초 작성: 2026-08-26
작성 주체: EVS Navigator
성격: **살아 있는 문서.** 데이터 경로를 바꿀 때마다 갱신합니다. 날짜별 버전을 만들지 마십시오.

---

## 0. 이 문서의 목적

데이터 사고가 반복되는 원인 중 하나는 **어느 화면 값이 어디서 오는지를 매번 코드에서 다시 찾는 것**입니다. 그 과정에서 죽은 스크립트를 살아 있는 것으로 착각하거나, 이미 구현된 경로를 새로 만들려는 일이 실제로 있었습니다.

이 문서는 그 탐색을 대체합니다. **작업 착수 전에 여기부터 읽으십시오.**

표기 규칙입니다. **[확인됨]** 은 코드나 문서를 직접 읽고 확인한 것, **[미확인]** 은 검증되지 않은 것입니다. 추정으로 채우지 마십시오.

---

## 1. 데이터 소스 및 산출 요약표 (최신화: 2026-09-01)

새로운 데이터를 추가하거나 기존 파이프라인을 수정할 때는 **반드시 아래 표의 기준을 우선 참고하여 파편화와 혼선을 방지**해야 합니다. 데이터가 결측될 경우 임의로 값을 생성(Hallucination)하는 것은 엄격히 금지됩니다.

| 데이터 항목 | 데이터 소스 (우선순위) | 소싱 방법 (엔진/스크립트) | 소싱 시간(KST) 및 주기 | 주요 계산법 (데이터 정합성 규칙) | 상태 및 라이선스 |
|---|---|---|---|---|---|
| **ETF 일별시세, NAV, 상장좌수** | 1. KRX Open API<br>2. 공공데이터포털(15094806) | `update_daily_data.py`<br>`backfill_api.py` | 매일 08:07<br>(이후 매시간 12:07까지 재시도) | 원천 데이터 활용 (임의 추정 및 더미 주입 **절대 금지**) | 주력 / 비상업적 |
| **ETF 순유입액 (Fund Flow)** | KRX / 공공데이터포털 파생 | `market-briefing-publisher` | 마켓 브리핑 워커 실행 시 | `순유입 = (좌수(T) - 좌수(T-1)) * NAV(T)`<br>※ API의 좌수(shares)는 T-1 기준이므로 T시점 좌수는 `AUM/NAV`로 역산 | 정상 |
| **ETF 괴리율 (Disparity)** | KRX / 공공데이터포털 파생 | 수집 스크립트 파생 로직 | 시세 수집 시 | `괴리율 = (종가 - NAV) / NAV * 100`<br>※ FSC에 필드가 없으므로 직접 수식 계산 | 정상 |
| **시장 카테고리별 AUM 비중** | `etf_prices` / `asset_detail` | `market-briefing-publisher` | 마켓 브리핑 워커 실행 시 | 데이터가 있는 분류만 합산. 과거처럼 특정 카테고리를 전체의 `0.765`로 고정 산출하는 등 비율 하드코딩 **금지** | 정상 |
| **국내 지수 (KOSPI/KOSDAQ)** | KRX Open API | `fetch_market_indices.py` | 매일 08:07 | 원천 데이터 활용 | 공공데이터포털 15094807로 전환 대기 |
| **해외지수, 원자재, 환율, VIX** | Yahoo Finance | `fetch_market_indices.py` | 매일 08:07 | 브라우저 위장 HTML 크롤링 (User-Agent 필수) | 비공식 / 지수 재배포 제한 |
| **총보수 (TER)** | 네이버 금융 HTML | `refresh_fees.py` | 매일 13:22 | HTML 요소 파싱 추출 | 대안 없음 / 약관 위반 소지 |
| **분배금 및 TR 수익률** | 운용사 사이트, KRX KIND | `collect_distribution...`<br>PR/TR 산출 엔진 | 매일 13:07 | 주당 분배금 기반 TR 재투자 수식 적용<br>※ TR 계산의 모든 기준일은 **2026-08-31**로 엄격히 고정 | 비공식 / 대안 없음 |
| **추적오차율** | 제공처 없음 | N/A | N/A | 임의 생성 금지. 현재 데이터 부재로 화면에서 **제거됨** | 사용 안 함 |
| **커뮤니티** | Supabase | Supabase RPC / Views | 실시간 | 자체 게시글 및 메타데이터 적재 | 자체 / 정상 |

> **[ZERO-HALLUCINATION 원칙]** 데이터(AUM, 거래대금, 유입액 등)가 비어 있거나 API 오류로 누락되었을 때, 이를 메꾸기 위해 가상의 수치, 더미 종목명, 고정된 비율을 반환해선 안 됩니다. 값이 없으면 빈 배열(`[]`)이나 `null`을 반환하여 UI가 "데이터 없음"을 표시(Graceful Fallback)하도록 해야 합니다.

---

## 2. 데이터셋별 상세

### 2-1. ETF 일별시세 (핵심 데이터)

**확인된 사실 (2026-08-26)**: FSC 응답은 `nav` 필드를 제공하며, 이는 KRX 의 원본 NAV 와 **100% 완벽히 일치**합니다. 따라서 FSC 단독으로 온전한 NAV 확보가 가능합니다. (이전까지 없다고 오판되었으나 묵살 코드의 버그로 밝혀짐)

**화면 사용처**: 전 종목 시세, 상세 페이지, 차트, 마켓 브리핑 STEP 1~5

**수집 스크립트** [확인됨]
- `scripts/backfill_api.py` — 일간 수집과 소급 수집 겸용
- `scripts/update_daily_data.py` — `fetch_snapshot`(공공데이터포털), `fetch_krx_snapshot`(KRX) 정의

**출처** [확인됨]

| 순위 | 출처 | API 명 / URL | 비고 |
|---|---|---|---|
| 1순위 | KRX | KRX Open API (`data-dbg.krx.co.kr/svc/apis/etp/etf_bydd_trd`) | **우선순위 복귀**. 금융위 API는 아침(08:00~10:00)에 데이터가 발행되지 않고 신규 상장 반영이 늦어 매일 폴백이 발생함. 유료화 이전까지 라이선스 부담이 낮으므로 KRX 우선 유지 |
| 2순위 (폴백) | 금융위원회 | 증권상품시세정보 (`apis.data.go.kr/.../getETFPriceInfo`) | KRX 응답 실패 시 대체 출처. KRX 에 없는 ISIN 보충 조회 용도로 사용됨. 추후 유료화 시점에 아침 수집 시각(11시 이후) 조정을 전제로 1순위 전환 재검토 |

`update_daily_data.py` 30행이 `BASE_URL`, 31행이 `KRX_ETF_DAILY_URL` 입니다.

**인증**: `DATA_GO_KR_SERVICE_KEY`, `KRX_OPEN_API_KEY`

**조회 방식**: `basDt` 로 날짜 고정, `numOfRows=1000` 페이징으로 `totalCount` 까지 순회

**적재 경로**: 서명된 인제스션 엔드포인트 `POST /api/internal/ingest-prices`. 요청당 최대 40건. HMAC-SHA256 서명(`PRICE_INGEST_HMAC_SECRET`).

**저장 위치**: D1 `etf_prices`, `briefing_etf_daily`

**건수 기준** [확인됨]: 2026-08-24 기준 1,161건. 두 출처 모두 동일했고 종가 불일치 0건.

**주의**: 공공데이터포털의 하루 중 갱신 시각 (2026-08-26 측정: 08:10, 09:10, 10:14 에 0건. 11:12 에 1,164건. 발행 시각은 10:14 와 11:12 사이. 정확한 시각 [미확인]. 1거래일 관측.)

### 2-2. 국내 지수 (KOSPI, KOSDAQ)

**화면 사용처**: 마켓 티커, 마켓 브리핑 지수 카드

**수집 스크립트** [확인됨]: `scripts/fetch_market_indices.py` 18~21행 `KRX_INDEX_URLS`

```
KOSPI   https://data-dbg.krx.co.kr/svc/apis/idx/kospi_dd_trd
KOSDAQ  https://data-dbg.krx.co.kr/svc/apis/idx/kosdaq_dd_trd
```

**인증**: `KRX_OPEN_API_KEY` (헤더 `AUTH_KEY`)

**저장 위치**: `data/market_indices.json`, D1 `market_index_daily`

**라이선스 문제** [확인됨]: KRX 이용약관 제6조 제2항이 비상업 목적으로 제한합니다.

**전환 계획**: 공공데이터포털 지수시세정보(15094807)로 이전 예정. **2026-08-26 승인 완료** (다만 실제 전환 여부는 아침 가용성 시간대별 측정 결과에 따라 결정될 예정). 승인되면 `getStockMarketIndex` 오퍼레이션을 씁니다. 필드는 `basDt`, `idxNm`, `idxCsf`, `clpr`, `fltRt`.

**주의**: 2024년 12월 6일 이후 일부 지수명이 변경되었습니다. **지수명 문자열을 추정하지 말고 `likeIdxNm` 으로 실제 반환 목록을 확인한 뒤 확정하십시오.**

**과거 사고**: 2026-08-24 브리핑에 8월 21일 값이 발행되었습니다. 날짜 정합 검사가 있었으나 **요청한 날짜를 그대로 응답 날짜로 기록**해 무력화되었습니다.

### 2-3. 해외지수, 환율, 원자재, 금리, 변동성

**화면 사용처**: 마켓 티커, 마켓 브리핑 본문

**수집 스크립트** [확인됨]: `scripts/fetch_market_indices.py` 24~34행 `TICKERS`

| 표시 라벨 | Yahoo 심볼 | 티커 노출 |
|---|---|---|
| S&P 500 | `^GSPC` | 노출 |
| 나스닥 | `^IXIC` | 노출 |
| 니케이 225 | `^N225` | 노출 |
| 원/달러 | `KRW=X` | 노출 |
| 미 국채 10년물 | `^TNX` | 노출 |
| VIX | `^VIX` | 노출 |
| WTI 원유 | `CL=F` | **제외** |
| 금 선물 | `GC=F` | **제외** |
| 은 선물 | `SI=F` | **제외** |

**호출 방식** [확인됨]: `query1.finance.yahoo.com/v8/finance/chart/{심볼}` 를 `User-Agent: Mozilla/5.0` 으로 호출

**티커 제외 처리**: `components/market-ticker.tsx` 의 `excludedLabels`. 원자재 3종은 수집은 하되 티커에 표시하지 않고 브리핑 본문에서만 씁니다. **라벨 문자열이 `data/market_indices.json` 의 `label` 과 정확히 일치해야 필터가 동작합니다.**

**라이선스 문제**

Yahoo Finance 는 비공식 경로이며 브라우저 위장을 사용합니다.

S&P 500, 나스닥, 니케이 225 는 **지수 자체에 재배포 제한**이 있어 출처를 바꿔도 해결되지 않습니다. FRED 의 `SP500` 은 S&P Dow Jones Indices 의 사전 서면 허가 없이 복제 금지, `NASDAQCOM` 은 상업적 이용에 사전 승인 필요, `NIKKEI225` 는 제3자 재배포에 Nikkei 허가 필요입니다.

VIX 는 CBOE 지수이므로 같은 범주로 봅니다.

**FRED 에서 되돌린 이력** [확인됨]: 미 국채 10년물과 VIX 는 원래 FRED(`DGS10`, `VIXCLS`)에서 받았으나, GitHub Actions 러너 IP 에서 타임아웃과 차단이 발생해 2026-08-26 운영자 판단으로 Yahoo 로 전환했습니다. **안정성 우선 판단이며 라이선스 관점의 개선은 아닙니다.**

`fetch_market_indices.py` 99행에 FRED 조회 함수가 남아 있습니다. 현재 `TICKERS` 에서 참조하지 않으므로 **잔존 코드로 보입니다.** [미확인]

### 2-4. 총보수 (TER)

**수집 스크립트** [확인됨]: `scripts/refresh_fees.py` 12행

```
https://finance.naver.com/item/coinfo.naver?code={ticker}
```

HTML 을 파싱하며 `User-Agent` 를 위장합니다.

**대안 없음** [확인됨]: 공공데이터포털에 데이터가 존재하지 않습니다. 펀드상품기본정보(15094792)는 응답 항목 8개에 보수 필드가 없고, 금융투자협회종합통계정보(15094809)는 시장 집계 통계뿐이며, 펀드상품 판매현황정보(15151230)는 공공누리 제4유형입니다. "총보수", "보수비용", "운용보수" 키워드 검색 결과 0건.

**미조사 경로** [미확인]: 금융투자협회 전자공시(`dis.kofia.or.kr`), KOFIA OpenAPI(`openapi.kofia.or.kr`)

### 2-5. 분배금

**수집 스크립트** [확인됨]: `scripts/collect_distribution_sources.py`, `scripts/collect_distribution_registry.py`, `scripts/build_distribution_summaries.py`

**출처**: 자산운용사 공지 페이지와 KRX KIND(`kind.krx.co.kr`). `User-Agent` 를 위장합니다.

**대안 없음** [확인됨]: 데이터도 없고 라이선스도 막힙니다. 한국예탁결제원 계열(15157413)과 금융위원회 주식배당정보(15043284)는 **공공누리 제2유형으로 상업적 이용 금지**이며, 스키마도 주식 전용이라 ETF 수익증권이 들어갈 자리가 없습니다.

> 본 개방데이터는 공공누리 2유형임을 참고하시기 바랍니다. 이용허락범위 제2유형 : 출처표시 + 상업적 이용금지.

### 2-6. NAV, 괴리율, 상장좌수, 순자산

**확인된 사실 (2026-08-26)**: FSC 응답은 `nav` 필드를 제공하며, 이는 KRX 의 원본 NAV 와 **100% 완벽히 일치**합니다. 따라서 FSC 단독으로 온전한 NAV 확보가 가능합니다. (이전까지 없다고 오판되었으나 묵살 코드의 버그로 밝혀짐)

**저장 위치** [확인됨]: `briefing_etf_daily.nav_value`, `disparity_pct`. 마이그레이션 `0011_briefing_etf_daily_nav.sql`

**용도**: 마켓 브리핑 STEP 4·5 자금 순유입 계산. KRX 응답의 LIST_SHRS (또는 FSC 응답의 stLstgCnt)를 shares 필드로 직접 파싱해 오므로 더 이상 역산 추정하지 않습니다. 두 출처의 값이 동일함이 확인되었습니다.

**주의**: `disparity`(괴리율)는 FSC 응답에 제공되지 않아, 수집 스크립트 단에서 `(종가 - NAV) / NAV * 100` 공식으로 직접 계산해 채워넣는 **파생값(계산값)**입니다.

**주의** [확인됨]: 최근 추가된 컬럼이라 **과거 날짜에는 NULL 이 있습니다.** 순유입은 당일과 비교일 양쪽에 NAV 가 있어야 계산되므로, NAV 이력이 없는 구간은 값이 나오지 않습니다.

**주의** [확인됨]: `0011` 마이그레이션 파일 선두에 BOM 이 있습니다.

### 2-7. 분류 (asset_class, asset_detail)

**원천 파일** [확인됨]: `data/classification/etf_classification_review_draft.csv`

**매핑 스크립트**: `scripts/publish_market_source_snapshot.py`

**과거 사고** [확인됨]: 원천 CSV 가 UTF-8-SIG 인데 스크립트가 `utf-8` 로 열어 첫 헤더가 `﻿ticker` 로 읽혔습니다. `KeyError` 가 발생했으나 **예외가 삼켜져** `asset_detail` 이 전부 빈 값으로 적재되었고, 마켓 브리핑 STEP 3 세부 주도 테마가 통째로 사라졌습니다.

**교훈**: 원인은 BOM 이 아니라 **실패를 감추는 구조**입니다. CSV 를 여는 모든 지점은 `utf-8-sig` 를 쓰고, 매핑 실패는 예외로 종료해야 합니다.

### 2-8. 커뮤니티

**저장소**: Supabase / Postgres. ETF 데이터의 D1 과 **완전히 분리된 저장소입니다.**

**주요 객체**: `create_community_post` RPC, `community_public_posts` 뷰

**카테고리** [확인됨]: `pension-etf-qna`, `etf-questions`, `challenge-30`, `feedback`

---

## 3. 실행 스케줄

크론은 UTC 기준입니다. KST 는 +9시간입니다.

| 워크플로 | cron (UTC) | KST | 내용 |
|---|---|---|---|
| `daily-market.yml` | `07 23 * * 1-5` | 08:07 | ETF 시세, 지수 수집 |
| | `07 0-3 * * 2-6` | 09:07, 10:07, 11:07, 12:07 | 재시도 4단계 |
| `daily-distribution.yml` | `07 4 * * 2-6` | 13:07 | 분배금 |
| `daily-fees.yml` | `22 4 * * 2-6` | 13:22 | 총보수 |
| `monitor-market-daily-pipeline.yml` | `15 5 * * 2-6` | 14:15 | 파이프라인 감시 |

**수동 실행 전용** [확인됨]: `market-briefing-production.yml`, `backfill-d1.yml`, `rollback-market-briefing-production.yml`, `query-d1.yml`

**중요**: `schedule` 이벤트는 **기본 브랜치(`main`)에서만 실행됩니다.** `dev` 에만 있는 변경은 스케줄 실행에 반영되지 않습니다.

**중요**: `daily-market.yml` 은 `target` 입력(`YYYYMMDD`)을 받습니다. 지정하면 사전 확인을 건너뛰고 해당 날짜를 강제 수집합니다.

---

## 4. 적재 상태 확인

### 4-1. 원장 테이블

**`market_data_readiness`** (날짜당 1행) [확인됨]

```
status              collecting / ready / delayed / failed / suppressed
etf_as_of_date      ETF 데이터의 실제 기준일
kospi_as_of_date    코스피 실제 기준일
kosdaq_as_of_date   코스닥 실제 기준일
etf_row_count       적재 건수
general_etf_count   일반 ETF 건수
aum_coverage_pct    AUM 커버리지
etf_source_hash     원본 해시
index_source_hash   지수 원본 해시
validation_json     검증 결과
error_code          실패 사유
collected_at        수집 시각
ready_at            준비 완료 시각
```

**`market_source_snapshot_manifest`** — 위와 유사하되 `source_version` 과 `git_commit_sha` 로 버전 관리

### 4-2. 원장에 없는 항목 (개선 필요)

**NAV 커버리지**가 기록되지 않습니다.

**`asset_detail` 커버리지**가 기록되지 않습니다.

**어느 출처에서 수집했는지**(공공데이터포털인지 KRX 인지)가 기록되지 않습니다.

**위 세 가지가 없어서 STEP 3·4·5 사고와 KRX 상시 사용을 원장으로 잡지 못했습니다.**

### 4-3. 조회 방법

```
npx wrangler d1 execute etf-prices --remote --command="SELECT as_of_date, status, etf_row_count, aum_coverage_pct FROM market_data_readiness ORDER BY as_of_date DESC LIMIT 10;"
```

```
node -e "fetch('https://etf-campus.pages.dev/api/briefings/latest').then(r=>r.json()).then(j=>console.log(j.briefing.asOfDate, j.briefing.isStale, j.briefing.staleDays))"
```

**한계**: 조회 수단이 CLI 뿐이라 실제로는 잘 보지 않게 됩니다. 화면이 이상해진 뒤에야 알게 되는 것이 반복 사고의 직접 원인입니다.

### 4-4. 감시 워커

`workers/market-daily-monitor/` 가 KST 14:15 에 돌며 이상 시 GitHub 이슈를 생성합니다.

**한계** [확인됨]: 기대 기준일과 실제 기준일이 같은지만 봅니다(`actual !== expectedIso`). **내용의 완전성은 보지 않습니다.**

---

## 5. 동작하지 않는 코드 (착각 주의)

**아래 스크립트는 어느 워크플로에도 연결되어 있지 않습니다.** 네이버 비공식 API 를 호출하지만 자동 실행되지 않습니다.

| 파일 | 호출 대상 | 상태 |
|---|---|---|
| `scripts/rebuild_unadjusted_prices.py` | `fchart.stock.naver.com`, `count=6000` | **참조 0건. 죽은 코드** |
| `scripts/collect_page2_official_sources.py` | `fchart.stock.naver.com`, `count=400` | 리드마그넷 수동 갱신 경로에서만 |

**이 두 파일을 "현재 사용 중인 네이버 의존"으로 착각한 사례가 실제로 있었습니다.** 살아 있는 가격 수집 경로는 `scripts/backfill_api.py` 입니다.

**판정 방법**: 스크립트가 실제로 도는지 확인하려면 `.github/workflows/` 를 grep 하십시오. 파일 이름이나 문자열 검색만으로 판단하지 마십시오.

---

## 6. 미해결 항목

| 항목 | 내용 |
|---|---|
| 공공데이터포털 갱신 시각 | 아침 수집 시점에 데이터가 있는지 미확인. 없으면 매번 KRX 폴백 |
| 지수 활용신청 | 데이터 15094807 승인 대기 |
| 증권상품시세정보 보유 시작일 | 조회 가능한 가장 이른 날짜 미확인 |
| 값 이상 탐지 | 전 거래일과 종가·등락률이 동일할 때 중단하는 검사 미구현 |
| STEP 6 시장 규모 | 백엔드 미구현. 프론트는 준비 중 표기로 가려 둔 상태 |
| 원장 컬럼 확장 | NAV·`asset_detail` 커버리지, 수집 출처 기록 |
| 상태 조회 화면 | CLI 외 조회 수단 없음 |
| 시크릿 정리 | `secrets.txt`, `.preview-hmac-secret.tmp` 가 커밋 이력에 존재 |

---

## 7. 갱신 규칙

**데이터 경로를 바꾸면 이 문서를 같은 커밋에서 갱신하십시오.**

새 출처를 도입할 때는 **이용허락범위를 개별 확인하고 원문을 인용해 기록하십시오.** 공공데이터포털이라고 모두 상업적 이용이 가능한 것이 아닙니다. 금융위원회 계열은 제한이 없으나 한국예탁결제원 계열은 공공누리 제2유형입니다.

**검증하지 않은 것은 [미확인] 으로 남겨 두십시오.** 추정을 확인된 사실처럼 적으면 이 문서의 존재 이유가 사라집니다.

### 2-6. 신규 종목 ISIN 수집 방침 (2026-08-26 수정)
- **유일한 출처:** ISIN 식별자는 공공데이터포털의 증권상품시세정보(15094806)의 `isinCd`만을 사용합니다. KRX상장종목정보(15094775)에는 ETF가 포함되지 않음이 확인되었습니다.
- **파생/생성 금지:** 추정이나 규칙 기반으로 ISIN이나 체크디짓을 임의 생성하는 것은 엄격히 금지합니다. (잘못된 ISIN이 조용히 확산되는 것을 방지)
- **ISIN 보충 조회:** KRX 우선 수집 시 KRX 응답에는 ISIN이 포함되지 않으므로, 마스터에 ISIN이 없는 종목(신규 상장 등)을 발견하면 FSC 증권상품시세정보에 종목별 보충 조회(basDt 지정 없이)를 수행해 `isinCd`를 채웁니다.
- **보류 목록 관리 (Pending Queue):** 보충 조회에서도 실패해 ISIN을 얻지 못한 종목은 D1 데이터베이스의 보류 목록 테이블(`etf_pending_isins`)에 티커와 최초 감지일을 기록합니다. 매 수집 시 보충 조회를 재시도하며 성공 시 보류 목록에서 제거됩니다. 감지 후 5거래일(임계값) 초과 시 파이프라인 중단 없이 경고 로그를 출력합니다.

### 2-7. 승인된 금융위원회 API 5종 목록 (2026-08-26 기준)
| 데이터 번호 | API | 신청일 | 만료예정일 | ETF 포함 | 현재 용도 |
|---|---|---|---|---|---|
| 15094806 | 증권상품시세정보 | 2026-07-17 | 2028-07-17 | **포함** | ETF 시세, NAV, 좌수, 순자산, ISIN |
| 15094775 | KRX상장종목정보 | 2026-07-17 | 2028-07-17 | 미포함 | **없음** |
| 15094792 | 펀드상품기본정보 | 2026-08-14 | 2028-08-14 | 조사 중 | 상장일 출처 후보 |
| 15094807 | 지수시세정보 | 2026-08-26 | 2028-08-26 | 해당 없음 | 코스피, 코스닥 (전환 검토 중) |
| 15094808 | 주식시세정보 | 2026-08-26 | 2028-08-26 | 미포함 | **없음** |

### 2-8. 추적오차율 데이터
- KRX 일별시세와 FSC 증권상품시세정보 모두 추적오차율을 원본 데이터로 제공하지 않습니다. (과거 매핑은 죽은 코드로 판명)
- 이에 따라 2026-08-26 부로 UI에서 추적오차율 렌더링 요소를 완전히 제거했습니다. CSV의 tracking_error 컬럼은 스키마 유지를 위해 빈 값으로 남겨두었습니다.
- 같은 이유로 PRC_DEV_RT(괴리율 원본 매핑) 및 lstgDt(상장일 원본 매핑) 참조도 코드에서 함께 정리되었습니다.

### 2-9. 스냅샷 적재 정규화 누락 버그 및 수정 (2026-08-26)
- **증상**: D1 `market_source_etf_daily` 및 `briefing_etf_daily` 테이블에서 모든 일자의 `nav_value`, `disparity_pct`, `asset_detail`이 항상 `NULL`로 저장되어 STEP 3(세부 주도 테마 peerGroups)와 STEP 4·5(자금 순유입 fundFlow)가 동시에 차단됨.
- **원인**: `functions/api/internal/ingest-market-source.js`의 `normalizeEtf()` 함수가 해당 필드들을 파싱/반환 객체에서 누락시켜, 하위 SQL 바인딩 단계에서 무조건 `NULL`이 전달되는 구조였음.
- **수정**: `normalizeEtf()` 반환 객체에 `assetDetail`, `navValue`, `disparityPct`, `isGeneralEtf`를 포함하도록 수정하여 파이프라인 전체 복구.
- **핵심 교훈**: 인코딩 수정만으로는 필드가 살아나지 않음. 한 필드가 비어 있을 때 수집 단계(CSV/API)만 보지 말고 인제스션 및 D1 적재 경로 끝까지 추적하여 확인해야 함.

### 2-10. 지수 테이블의 역할 분리
- **`market_source_index_daily` (스냅샷 허브 소관)**: 스냅샷 무결성 검증용 테이블로, 국내 양대 지수인 `KOSPI`와 `KOSDAQ` 2종만 엄격히 관리함 (`CHECK (index_code IN ('KOSPI', 'KOSDAQ'))`, 워커 `source-materializer.ts`에서 2개 지수 수량 강제 검증).
- **`market_index_daily` (브리핑 런 소관)**: 마켓 브리핑의 거시 지표 테이블로, `KOSPI`, `KOSDAQ`, `TNX`, `VIX`, `CLF`, `DGS10`, `T10Y2Y` 등 글로벌 지수를 확장 수용함 (`migrations/0014`).

### 2-11. 일반 ETF (`is_general_etf`) 비즈니스 정의
- **정의**: `risk_type = 'normal' AND asset_class != '금리·파킹'`
- **취지**: 시장 온도(Step 2), 주도 테마(Step 3), 자금 흐름(Step 4·5) 등 핵심 지표 산출 시 현금성 단기자금인 파킹형 상품을 제외하고 순수 투자성 일반 ETF만을 모수로 삼음.
- **동기화 방식**: `scripts/publish_market_source_snapshot.py`가 산출한 `isGeneralEtf`를 페이로드에 명시적으로 실어 보내 D1에 저장함으로써 Python과 JS/Worker 간 단일 기준 유지.

### 2-12. 브리핑 중복 발행 가드 (G14) 및 정정 한계
- `workers/market-briefing-publisher/src/source-materializer.ts` (L100)에 `SELECT as_of_date FROM market_briefings WHERE as_of_date = ?` 검사가 존재하여, 특정 일자의 브리핑이 한 번 `ready`로 생성되면 동일 일자의 후속 스냅샷 이벤트는 `skipped_duplicate`로 처리되어 화면에 반영되지 않음.
- 이로 인해 원본 데이터 정정 후 재발행 시 화면 갱신이 차단되는 한계가 존재하며, 별도의 정정 경로(Replay/Overwrite Flag) 도입이 필요함.
- **2026-08-26 해소**: 아래 2-14 의 3중 잠금 해제 절차로 우회 가능함이 실증되었습니다. 코드 수정 없이 SQL 3문으로 처리합니다.

### 2-13. 상장좌수(`shares`)는 T-1 기준입니다 [확인됨]

**원천 API 가 주는 `shares` (KRX `LIST_SHRS`, FSC `stLstgCnt`) 는 기준일 당일이 아니라 전 거래일 좌수입니다.**

검증 방법과 결과입니다. 마스터 CSV 네 거래일을 교차 대조하면 `shares(T)` 가 `AUM(T-1) / NAV(T-1)` 과 설정 단위까지 정확히 일치합니다.

```
069500 KODEX 200
  8/20  AUM/NAV = 234,449,997      8/21 shares = 234,450,000
  8/21  AUM/NAV = 235,350,005      8/24 shares = 235,350,000
  8/24  AUM/NAV = 232,349,998      8/25 shares = 232,350,000
```

같은 날끼리 맞추면 26퍼센트가 어긋나고, 하루 밀어 맞추면 8퍼센트로 떨어집니다. 세 거래일 연속 재현되었습니다.

`close`, `nav`, `aum` 은 모두 T 시점입니다. NAV 괴리율 중앙값이 +0.004퍼센트, 절댓값 0.5퍼센트 이내가 73퍼센트로 정상 분포하는 것으로 확인했습니다.

**외부 대조**: 069500, 102110, 428510 세 종목의 KRX 공시 상장좌수가 `AUM / NAV` 역산값과 일치했습니다.

**따라서 자금 순유입은 반드시 역산으로 계산합니다.**

```
좌수(T)   = AUM(T) / NAV(T)
순유입(T) = (좌수(T) - 좌수(T-1)) * NAV(T)
```

**실측 `shares` 로 계산하면 T-2 에서 T-1 사이의 자금 흐름이 오늘 것으로 기록됩니다.**

구현은 이미 존재합니다. `workers/market-briefing-publisher/src/index.ts` L272 `calculateFundFlow` 가 L290 주석과 함께 역산 방식을 쓰고 있습니다. **같은 공식을 두 번 구현하지 마십시오.**

`shares` 컬럼 자체는 `migrations/0016` 으로 `market_source_etf_daily` 와 `briefing_etf_daily` 에 추가되어 원천값 그대로 보관됩니다. 시점이 다를 뿐 원천 데이터이므로 검증 기준으로 씁니다.

### 2-14. 재발행에는 세 개의 잠금이 있습니다 [확인됨]

**하나라도 남으면 오류 없이 조용히 건너뜁니다. 2026-08-26 에 잠금 1만 풀고 워크플로를 돌려 헛돈 사례가 있습니다.**

```
잠금 1   market_briefings 에 해당 날짜 행 존재
         source-materializer.ts L101  alreadyPublished

잠금 2   market_source_consumer_runs.status 가 'ready' 또는 'skipped_duplicate'
         source-materializer.ts L69   claimEvent

잠금 3   market_source_event_outbox.delivery_status 가 'sent'
         dispatcher 가 집어가지 않음
```

**`source_version` 은 ETF 페이로드의 내용 해시입니다.**

```
scripts/publish_market_source_snapshot.py L409
source_version = f"market-source-{as_of_date}-{etf_hash[:16]}"
```

**같은 데이터로 다시 발행하면 해시가 같으므로 새 이벤트가 생기지 않습니다.** 아웃박스 INSERT 가 `ON CONFLICT ... DO NOTHING` 입니다.

**배달 구조**

```
publish_market_source_snapshot.py → POST /api/internal/ingest-market-source (허브 적재 + 아웃박스)
market-event-dispatcher   crons = ["*/5 * * * *"]   pending/failed 를 큐로 전송
market-briefing-publisher queue consumer            materialize → publish → KV 갱신
```

**따라서 데이터가 이미 허브에 정확히 들어 있으면 워크플로를 다시 돌릴 필요가 없습니다.** 아래 3문 실행 후 5분에서 10분 기다리면 디스패처가 자동 처리합니다. GitHub Actions 를 쓰지 않습니다.

```sql
DELETE FROM market_briefings WHERE as_of_date = '<날짜>';
DELETE FROM market_source_consumer_runs
  WHERE consumer_name = 'market_briefing' AND event_id = '<event_id>';
UPDATE market_source_event_outbox
  SET delivery_status = 'pending', sent_at = NULL, next_attempt_at = NULL,
      updated_at = CURRENT_TIMESTAMP
  WHERE event_id = '<event_id>';
```

**실행 전 `market_briefings`, `market_briefing_asset_classes`, `market_briefing_focus_etfs` 세 테이블을 백업하십시오.** 뒤 두 테이블은 `ON DELETE CASCADE` 로 함께 지워지며, D1 에서 연쇄 삭제가 실제로 작동함을 2026-08-26 에 실측 확인했습니다.

**허브 자체가 낡았으면 이 절차로 부족합니다.** 그때는 `daily-market.yml` 을 해당 날짜로 재실행해 허브부터 다시 만들어야 하며, 데이터가 달라지므로 해시도 자연히 바뀌어 잠금 2와 3은 문제되지 않습니다.

### 2-15. 화면 API 는 KV 를 먼저 읽습니다 [확인됨]

```
functions/api/briefings/latest.js L128~129
const cached = await readKvBriefing(context.env.BRIEFING_KV);
if (cached) return Response.json(cached, { headers: JSON_HEADERS });
```

**KV 에 값이 있으면 D1 을 아예 조회하지 않습니다.**

```
포인터 키   market-briefing:v0:latest-pointer              TTL 8일
페이로드 키 market-briefing:v0:payload:{asOfDate}:v{ver}   TTL 7일
```

쓰는 쪽은 `workers/market-briefing-publisher/src/resilience.ts` L25~26 이며, **발행이 성공해야만 갱신됩니다.**

**발행 실패나 스킵 시 KV 를 무효화하는 경로가 없습니다.** 따라서 발행이 건너뛰어져도 화면은 최대 8일간 이전 값을 정상처럼 내보냅니다. **구조적 결함이며 미해결입니다.**

**검증 시 화면 API 하나만 보지 마십시오.** D1 원본, `briefing_etf_daily` 적재 상태, 화면 API 세 곳을 대조해야 합니다.

**KV 를 우회하는 경로**: `GET /api/briefings/[date]` 는 D1 을 직접 조회합니다.

### 2-16. `peer_groups` 는 발행 시점에 동결됩니다 [확인됨]

```
functions/api/briefings/latest.js L117   peerGroups: metrics.peer_groups
workers/market-briefing-publisher/src/index.ts L481   const peerGroups = calculatePeerGroups(quotes);
workers/market-briefing-publisher/src/index.ts L520   peer_groups: peerGroups,
```

**화면은 `briefing_etf_daily.asset_detail` 을 읽지 않습니다. `market_briefings.metrics_json` 안에 발행 시점 계산되어 동결된 값을 읽습니다.**

**따라서 `briefing_etf_daily` 를 직접 UPDATE 해도 STEP 3 은 절대 바뀌지 않습니다.** 2026-08-26 에 이 착각으로 세 라운드를 소모했습니다. 반드시 2-14 절차로 재발행해야 합니다.

**교훈**: D1 건수는 중간 지표입니다. 완료 판정은 항상 화면 API 응답으로 하십시오.

### 2-17. `migrations/` 가 버전 관리에서 빠져 있었습니다 [확인됨]

`.gitignore` 37행의 `*.sql` 규칙이 `migrations/` 하위까지 무시하고 있었습니다. `0010`, `0013`, `0015`, `0016` 이 추적되지 않은 상태였습니다.

**"마이그레이션 파일과 실제 테이블 정의가 다르다" 는 혼란이 반복된 원인의 일부입니다.**

2026-08-26 에 `!migrations/*.sql` 예외 규칙을 넣고 누락분을 전부 커밋했습니다.

**새 마이그레이션 파일에 BOM 을 넣지 마십시오.** `0011` 과 `0012` 선두에 BOM 이 있습니다.
