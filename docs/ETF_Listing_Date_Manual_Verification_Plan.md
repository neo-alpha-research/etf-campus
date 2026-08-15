# ETF Campus 확인 보류 21종목: 수동 검증 및 추가 데이터 소스 연동 계획

작성일: 2026-08-14  
대상: ETF Campus `etf_listing_dates_enrichment.csv`에서 `listing_date_status = unavailable`인 21종목

## 1. 현황과 목표

현재 1,160개 마스터 ETF 중 1,139개는 KRX KIND ETF 신규상장 공시의 상장일·공시번호와 연결되어 있다. 남은 21개는 대부분 KIND 검색 원장의 시작 시점(2008-08-27)보다 먼저 상장된 레거시 ETF이며, 한 종목은 현 상품명과 과거 공시명 간 불일치 가능성이 있다. 따라서 이 21개는 이름 유사도만으로 보정하지 않고, **문서 속 상장일과 ISIN 또는 단축코드를 함께 확인하는 수동 증적 절차**가 필요하다.

KIND 신규상장 원문은 상장일, 표준코드(ISIN), 단축코드, 최초설정일을 별도로 제공하는 검증 원천이다.[1] 반면 금융위원회 증권상품시세정보의 첫 기준일은 시세 관측일이므로, 공식 상장일을 찾지 못한 경우에만 `provisional_first_trade` 후보로 사용해야 한다.[2]

| 구분 | 종목 수 | 처리 목표 |
| --- | ---: | --- |
| KIND 이전 레거시 ETF | 20 | KRX 보도자료·상장 공고 또는 운용사 보관 문서에서 상장일과 ISIN을 교차확인한다. |
| KIND 명칭 불일치 가능 ETF | 1 | ISIN과 과거 펀드명으로 KIND·운용사·KOFIA 문서를 역검색한다. |
| 공식 날짜 미확보 | 0을 목표 | 최초 거래 확인일을 후보로 저장하되, 화면에서는 상장일로 표기하지 않는다. |

## 2. 21종목 수동 검증 대기열

아래 종목은 현재 마스터의 종목코드와 ISIN을 **고정 키**로 사용한다. 종목명은 리브랜딩·약칭 변경이 있을 수 있으므로 검색 보조어일 뿐, 단독 매칭 근거가 아니다.

| 우선순위 | 종목코드 | ISIN | 현재명 | 운용사 그룹 | 1차 수동 원천 |
| --- | --- | --- | --- | --- | --- |
| P0 | 069500 | KR7069500007 | KODEX 200 | 삼성자산운용 | KODEX 공식 상품·보관 문서, KRX 레거시 상장 공고 |
| P0 | 069660 | KR7069660009 | KIWOOM 200 | 키움투자자산운용 | KIWOOM/구 브랜드 공식 문서, KRX 레거시 상장 공고 |
| P0 | 102110 | KR7102110004 | TIGER 200 | 미래에셋자산운용 | TIGER 공식 상품·보관 문서, KRX 레거시 상장 공고 |
| P1 | 091160 | KR7091160002 | KODEX 반도체 | 삼성자산운용 | KODEX 공식 보관 문서, KRX 레거시 상장 공고 |
| P1 | 091170 | KR7091170001 | KODEX 은행 | 삼성자산운용 | KODEX 공식 보관 문서, KRX 레거시 상장 공고 |
| P1 | 091180 | KR7091180000 | KODEX 자동차 | 삼성자산운용 | KODEX 공식 보관 문서, KRX 레거시 상장 공고 |
| P1 | 091220 | KR7091220004 | TIGER 은행 | 미래에셋자산운용 | TIGER 공식 보관 문서, KRX 레거시 상장 공고 |
| P1 | 091230 | KR7091230003 | TIGER 반도체 | 미래에셋자산운용 | TIGER 공식 보관 문서, KRX 레거시 상장 공고 |
| P1 | 099140 | KR7099140006 | KODEX 차이나H | 삼성자산운용 | KODEX 공식 보관 문서, KRX 레거시 상장 공고 |
| P1 | 100910 | KR7100910009 | KIWOOM KRX100 | 키움투자자산운용 | KIWOOM/구 브랜드 공식 문서, KRX 레거시 상장 공고 |
| P1 | 101280 | KR7101280006 | KODEX 일본TOPIX100 | 삼성자산운용 | KODEX 공식 보관 문서, KRX 레거시 상장 공고 |
| P1 | 102780 | KR7102780004 | KODEX 삼성그룹 | 삼성자산운용 | KODEX 공식 보관 문서, KRX 레거시 상장 공고 |
| P1 | 102960 | KR7102960002 | KODEX 기계장비 | 삼성자산운용 | KODEX 공식 보관 문서, KRX 레거시 상장 공고 |
| P1 | 102970 | KR7102970001 | KODEX 증권 | 삼성자산운용 | KODEX 공식 보관 문서, KRX 레거시 상장 공고 |
| P1 | 104520 | KR7104520002 | KIWOOM 블루칩 | 키움투자자산운용 | KIWOOM/구 브랜드 공식 문서, KRX 레거시 상장 공고 |
| P1 | 104530 | KR7104530001 | KIWOOM 코리아고배당 | 키움투자자산운용 | KIWOOM/구 브랜드 공식 문서, KRX 레거시 상장 공고 |
| P1 | 169950 | KR7169950003 | KODEX 차이나A50 | 삼성자산운용 | KODEX 공식 보관 문서, KRX 레거시 상장 공고 |
| P1 | 174350 | KR7174350009 | TIGER 로우볼 | 미래에셋자산운용 | TIGER 공식 보관 문서, KRX 레거시 상장 공고 |
| P1 | 200250 | KR7200250009 | KIWOOM 인도Nifty50(합성) | 키움투자자산운용 | KIWOOM/구 브랜드 공식 문서, KRX 레거시 상장 공고 |
| P1 | 204480 | KR7204480008 | TIGER 차이나CSI300레버리지(합성) | 미래에셋자산운용 | TIGER 공식 보관 문서, KRX 레거시 상장 공고 |
| P0 | 220130 | KR7220130009 | SOL 차이나강소기업CSI500(합성 H) | 신한자산운용 | SOL/구 브랜드 공식 문서, ISIN 기반 과거명 역검색 |

P0는 사이트 대표성 또는 과거명 불일치 위험이 높은 종목이며, P1은 동일한 레거시 검증 절차로 일괄 처리한다. 수동 담당자는 `data/listing_dates/manual_review_21_queue.csv`에 문서 URL, 제목, 문서 내 인용문, ISIN 또는 단축코드, 확인일을 남긴다.

## 3. 수동 검증 표준 절차

### 3.1. 검색 순서

각 종목은 다음 검색 조합을 순서대로 사용한다. 검색 키는 `ISIN → 종목코드 → 현재명 → 과거명/구 브랜드명` 순서다.

| 단계 | 원천 | 합격 조건 | 저장할 증적 |
| --- | --- | --- | --- |
| 1 | KRX KIND 상세 신규상장 공시 또는 KRX 공식 상장 보도자료 | 문서에 **상장일**과 ISIN 또는 단축코드가 존재하고 마스터와 일치 | 원문 URL, 공시번호, 상장일 원문, ISIN/단축코드 원문, 문서 제목 |
| 2 | 운용사 공식 상품 페이지·보관 PDF·투자설명서 | 상장일이 명시되고 ISIN 또는 종목코드가 일치 | URL/PDF, 페이지 번호, 인용문, ISIN/코드 |
| 3 | KOFIA·SEIBro 등 공식 시장·펀드 정보 | 상장일 필드와 ISIN 또는 종목코드가 일치 | 조회 URL, 조회 시각, 필드명·값 |
| 4 | 금융위원회 시세 API | 가장 이른 `basDt`만 확보 | `first_traded_date`, 조회 URL, `provisional_first_trade` 상태 |

> 운용사 문서에 `최초설정일`만 있고 상장일이 없으면 상장일 검증에 합격하지 않는다. 이 날짜는 `fund_inception_date`에만 저장한다.[1]

### 3.2. 상태 전환 규칙

| 현재 상태 | 확인 증적 | 전환 후 상태 | 필수 필드 |
| --- | --- | --- | --- |
| `unavailable` | KRX 문서의 상장일 + ISIN/단축코드 일치 | `verified_official` | `listing_date`, `source_url`, `kind_receipt_no` 또는 문서식별자, `verified_at`, `verification_note` |
| `unavailable` | 운용사 문서의 상장일 + ISIN/종목코드 일치 | `verified_official` | 위 필드 + `source_type = issuer_official` |
| `unavailable` | 최초 시세 기준일만 확보 | `provisional_first_trade` | `first_traded_date`, `source_type = fsc_price_api_first_seen` |
| 어떤 상태든 | 문서 상장일과 후보일이 불일치 | `conflict` | 두 날짜, 각 URL, 차이 설명 |
| 어떤 상태든 | 동일 키에 서로 다른 공식 상장일 | `manual_review` | 문서 2개 이상, 검토 사유 |

## 4. 추가 데이터 소스 연동 방안

### 4.1. 공통 증적 모델

기존 `etf_listing_dates` 테이블은 최종값 중심이다. 원천을 여러 개 보관하려면 다음 별도 테이블을 추가하는 방안을 권장한다.

```sql
CREATE TABLE IF NOT EXISTS etf_listing_date_evidence (
  evidence_id INTEGER PRIMARY KEY,
  ticker TEXT NOT NULL,
  isin TEXT NOT NULL,
  candidate_listing_date TEXT,
  candidate_first_traded_date TEXT,
  source_rank INTEGER NOT NULL,
  source_type TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_document_id TEXT,
  source_document_title TEXT,
  evidence_quote TEXT,
  match_basis TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  checked_by TEXT NOT NULL,
  review_status TEXT NOT NULL,
  UNIQUE(ticker, source_type, source_url)
);
```

최종 테이블은 검증 승격 결과만 보유하고, `etf_listing_date_evidence`는 수동·자동 수집 증적을 누적한다. 이 구조는 나중에 원천이 바뀌거나 문서 URL이 사라져도 의사결정 근거를 보존한다.

### 4.2. 소스 어댑터 구성

| 어댑터 | 목적 | 입력 키 | 출력 | 자동화 수준 |
| --- | --- | --- | --- | --- |
| `kind_notice_adapter` | 신규상장 공시 제목·공시번호 수집 | 기간, 종목명, KRX 코드 | 상장일 후보, 공시번호, 검색 URL | 현재 구현됨 |
| `krx_archive_adapter` | 2008년 이전 레거시 KRX 상장 공고 탐색 | ISIN, 종목코드, 과거명 | 공식 문서 URL, 상장일, 코드 | 수동 검증 우선 |
| `issuer_document_adapter` | 운용사 상품 페이지·보관 PDF 탐색 | ISIN, 종목코드 | 상장일/설정일, 문서 증적 | 운용사별 점진 구현 |
| `official_price_adapter` | 최초 거래 확인일 후보 산출 | 종목코드 | 첫 `basDt`, 요청 URL | 스크립트 준비됨 |
| `review_queue_adapter` | 미결 증적의 담당·기한 관리 | 모든 미결 행 | 상태, 다음 조치, 재검토일 | CSV/D1으로 즉시 가능 |

KRX Open API는 ETF 일별매매정보를 제공하므로 최초 거래일 후보 확인에는 사용할 수 있지만, 상장일 주 원천으로 대체해서는 안 된다.[3] KIND는 ETF 공시를 종목명·보고서명·기간으로 검색할 수 있어 신규 상장 감지의 기준 원천으로 적합하다.[4]

### 4.3. 지속 운영 방식 비교

| 접근 방식 | 동작 방식 | 장점 | 제약 | 적합한 범위 |
| --- | --- | --- | --- | --- |
| 기존 Python 배치 확장 | 현재 `update_daily_data.py` 실행 뒤 KIND·후보일 수집기를 연속 실행 | 이미 쓰는 Python·동적 문서 처리 도구를 재사용하며 운용사 PDF 보완이 쉽다 | 실행 환경의 API 키·스케줄 관리가 필요하다 | 21종목 수동 보완 및 초기 이관 |
| 관리형 정기 작업 | 서버 측 정기 작업이 KIND 수집·D1 반영·검토대기열 생성 | 인프라 관리가 적고 신규 ETF 감지를 일관되게 운영한다 | 동적 운용사 페이지·복잡한 PDF 처리는 별도 어댑터가 필요하다 | 신규 ETF의 일상 감지 |
| 하이브리드 증적 파이프라인 | 정기 작업은 KIND·시세 후보만, 운용사·레거시 문서는 검토 대기열로 처리 | 자동 수집 범위를 신뢰 가능한 원천으로 제한하고 수동 검증을 감사 가능하게 남긴다 | 수동 검토 SLA와 담당자 지정이 필요하다 | 장기 운영 전반 |

세 방식 모두 새 상장 ETF의 자동 감지에는 사용할 수 있다. 다만 자동화가 문서 필드를 신뢰성 있게 추출하지 못하면 해당 행은 승격하지 않고 검토 대기열로 보내야 한다. 선택 전에는 현재 일일 수집이 실행되는 위치, 공공 시세 API 키의 보관 위치, D1 반영 권한을 확인한다.

## 5. 2주 실행 계획

| 시점 | 작업 | 종료 기준 |
| --- | --- | --- |
| 1일차 | 대기열 CSV를 D1 증적 테이블과 연결하고 P0 4종목의 KRX·운용사 문서를 수동 확인 | 각 종목에 URL·인용문·코드 매칭을 기록 |
| 2~4일차 | P1 레거시 17종목을 운용사 그룹별로 일괄 확인 | `verified_official` 또는 `provisional_first_trade`로 모두 전환 |
| 5일차 | 불일치·문서 미확보 행만 `manual_review`로 확정하고 첫 거래 후보 수집 | 미결 사유와 다음 검토일 설정 |
| 2주차 | KIND 정기 수집과 증적 테이블 적재를 연결하고 재실행 테스트 | 신규 상장 1건에 대해 감지→증적→상태 전환을 재현 |

## 참고문헌

[1] [KRX KIND ETF 신규상장 공시 사례](https://kind.krx.co.kr/external/2026/05/08/000383/20260508001028/68152.htm)  
[2] [공공데이터포털, 금융위원회 증권상품시세정보](https://www.data.go.kr/en/data/15094806/openapi.do)  
[3] [KRX Open API 서비스 목록](https://openapi.krx.co.kr/contents/OPP/INFO/service/OPPINFO004.cmd)  
[4] [KRX KIND ETF 공시 검색](https://kind.krx.co.kr/disclosure/disclosurebystocktype.do?method=searchDisclosureByStockTypeEtf)
