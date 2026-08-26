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

## 1. 한눈에 보기

| 데이터 | 출처 | 라이선스 | 상태 |
|---|---|---|---|
| ETF 일별시세 | 공공데이터포털 15094806 | 이용허락범위 제한 없음 | 정상 |
| ETF 일별시세 폴백 | KRX Open API | **비상업 제한** | 예외 시에만 |
| KOSPI, KOSDAQ | KRX Open API | **비상업 제한** | 전환 대기 |
| 해외지수 3종 | Yahoo Finance | **비공식, 지수 재배포 제한** | 유료화 전 유지 |
| 원/달러, 원자재 3종 | Yahoo Finance | **비공식** | 유료화 전 유지 |
| 미 국채 10년물, VIX | Yahoo Finance | **비공식** | 유료화 전 유지 |
| 총보수 | 네이버 금융 HTML | **약관 위반 소지** | 대안 없음 |
| 분배금 | 운용사 사이트, KIND | **비공식** | 대안 없음 |
| 커뮤니티 | Supabase | 자체 | 정상 |

**"비상업 제한"과 "비공식"이 붙은 항목은 유료 구독 출시 전에 반드시 정리해야 합니다.**

---

## 2. 데이터셋별 상세

### 2-1. ETF 일별시세 (핵심 데이터)

**확인된 사실 (2026-08-26)**: FSC 응답은 `nav` 필드를 제공하며, 이는 KRX 의 원본 NAV 와 **100% 완벽히 일치**합니다. 따라서 FSC 단독으로 온전한 NAV 확보가 가능합니다. (이전까지 없다고 오판되었으나 묵살 코드의 버그로 밝혀짐)

**화면 사용처**: 전 종목 시세, 상세 페이지, 차트, 마켓 브리핑 STEP 1~5

**수집 스크립트** [확인됨]
- `scripts/backfill_api.py` — 일간 수집과 소급 수집 겸용
- `scripts/update_daily_data.py` — `fetch_snapshot`(공공데이터포털), `fetch_krx_snapshot`(KRX) 정의

**출처** [확인됨]

| 우선순위 | 이름 | URL |
|---|---|---|
| 1 | 공공데이터포털 증권상품시세정보 | `apis.data.go.kr/1160100/service/GetSecuritiesProductInfoService/getETFPriceInfo` |
| 2 (폴백) | KRX Open API | `data-dbg.krx.co.kr/svc/apis/etp/etf_bydd_trd` |

`update_daily_data.py` 30행이 `BASE_URL`, 31행이 `KRX_ETF_DAILY_URL` 입니다.

**인증**: `DATA_GO_KR_SERVICE_KEY`, `KRX_OPEN_API_KEY`

**조회 방식**: `basDt` 로 날짜 고정, `numOfRows=1000` 페이징으로 `totalCount` 까지 순회

**적재 경로**: 서명된 인제스션 엔드포인트 `POST /api/internal/ingest-prices`. 요청당 최대 40건. HMAC-SHA256 서명(`PRICE_INGEST_HMAC_SECRET`).

**저장 위치**: D1 `etf_prices`, `briefing_etf_daily`

**건수 기준** [확인됨]: 2026-08-24 기준 1,161건. 두 출처 모두 동일했고 종가 불일치 0건.

**주의** [미확인]: 공공데이터포털의 하루 중 갱신 시각이 **부분적으로만 확인되었습니다.** (2026-08-26 측정 결과 08:10과 09:10에는 직전 거래일 데이터가 0건으로 아직 발행 전이었습니다. 10시 이후는 아직 미확인 상태입니다.) 수집이 KST 08:07부터 도는데 원본이 오후에 갱신된다면 매번 KRX 로 폴백합니다. 로그의 `Source:` 와 `Fallback (KRX) dates:` 로 확인하십시오.

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

**전환 계획**: 공공데이터포털 지수시세정보(15094807)로 이전 예정. **활용신청 승인 대기 중이라 보류.** 승인되면 `getStockMarketIndex` 오퍼레이션을 씁니다. 필드는 `basDt`, `idxNm`, `idxCsf`, `clpr`, `fltRt`.

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

**용도**: 마켓 브리핑 STEP 4·5 자금 순유입 계산. 이전에는 좌수를 `aum_value / nav_value`로 유도했으나, 현재는 FSC 응답의 `stLstgCnt`를 `shares` 필드로, `nPptTotAmt`를 `net_asset` 필드로 직접 파싱해 수집하므로 더 이상 계산으로 유도하지 않습니다.

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
