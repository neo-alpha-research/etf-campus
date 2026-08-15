# ETF Campus 상장일 데이터 운영 가이드

작성일: 2026-08-14  
작성자: Manus AI

## 목적과 데이터 원칙

이 가이드는 ETF Campus에서 **펀드 최초설정일**, **최초 거래 확인일**, **공식 상장일**을 혼동하지 않고 보관·표시하기 위한 운영 기준이다. KRX KIND의 ETF 신규상장 공시 원문은 상장일, 표준코드(ISIN), 단축코드, 최초설정일을 별도로 기재한다. 따라서 사용자 화면에 `상장일`로 노출할 날짜는 공시의 `상장일` 필드뿐이며, 최초설정일이나 시세 API의 첫 관측일로 대체해서는 안 된다.[1]

현재 산출물은 KIND의 `신규상장(..., 상장일 YYYY.MM.DD)` 검색 결과와 공시번호를 보존한다. 이 제목은 KRX 공식 공시의 상장일 근거이지만, KIND 상세 원문의 ISIN을 자동 추출한 것은 아니므로 상태를 보수적으로 `official_notice_pending_isin`으로 저장한다. 이는 날짜의 원천을 숨기지 않으면서도, 이름 변경·동명 가능성에 대한 검증 여지를 보존하는 설계다.

| 상태 | 화면 표기 | 데이터 처리 원칙 |
| --- | --- | --- |
| `verified_official` | `상장일 YYYY.MM.DD` | KIND 원문 또는 운용사 원문에서 ISIN까지 일치한 경우만 사용한다. |
| `official_notice_pending_isin` | `상장일 YYYY.MM.DD · KIND 공시 기준` | KIND 신규상장 제목과 공시번호, 이름 또는 KRX 내부 종목코드가 일치한 경우다. 후속 ISIN 검증 대상으로 남긴다. |
| `provisional_first_trade` | `최초 거래 확인일 YYYY.MM.DD` | 공식 시세 API의 가장 이른 `basDt`다. 상장일로 표기하지 않는다. |
| `manual_review` | `상장일 검토 필요` | 이름·코드가 다대일 매칭되거나 서로 충돌한다. |
| `unavailable` | `상장일 확인 중` | 공식 공시 및 시세 후보를 아직 확보하지 못했다. |

> 최초설정일은 ETF가 설정된 날이며, 거래소 상장일과 다를 수 있다. 두 날짜를 같은 필드에 저장하거나 대체 표기하면 안 된다.[1]

## 이번 배치의 파일

| 파일 | 용도 |
| --- | --- |
| `data/listing_dates/kind_etf_listing_notices.csv` | KIND 검색 결과에서 수집한 공식 신규상장 공시 원장이다. 공시번호, 제목, 상장일, KRX 내부 종목코드를 보존한다. |
| `data/listing_dates/kind_ledger_validation.md` | 원장 행 수, 기간, 중복 공시번호, 날짜 형식 검수 결과다. |
| `data/listing_dates/etf_listing_dates_enrichment.csv` | 현재 ETF 마스터와 KIND 원장을 결합한 중간 산출물이다. |
| `data/listing_dates/etf_listing_dates_final.csv` | 최초거래일 후보 보완이 성공했을 때 사용하는 최종 산출물 경로다. 이번 환경에서는 공공데이터 API 키가 없어 생성되지 않을 수 있다. |
| `data/listing_dates/etf_listing_dates_review_queue.csv` | 상장폐지·명칭 변경·KIND 원장 미매칭 등 사람이 검토할 행이다. |
| `scripts/collect_kind_listing_dates.py` | KIND 신규상장 공시 원장을 월 단위로 재수집한다. |
| `scripts/merge_listing_dates_with_master.py` | 원장과 `etf_master_draft.csv`를 병합한다. |
| `scripts/collect_first_traded_candidates.py` | 미매칭 ETF의 금융위원회 시세 API 최초 관측일을 후보로 채운다. |
| `scripts/d1_listing_dates_schema.sql` | D1 상장일 증적 테이블 정의다. |
| `scripts/generate_listing_dates_d1_seed.py` | 최종 CSV를 D1 UPSERT SQL로 변환한다. |

## D1 적용 절차

D1 상장일 테이블을 먼저 만든 뒤, 검증이 끝난 CSV에서 생성한 시드 SQL을 실행한다. `wrangler.toml`의 실제 D1 바인딩 이름은 배포 환경에서 확인해야 하며, 아래 예시는 기존 가격 테이블 이름인 `etf-prices`를 사용한다.

```bash
wrangler d1 execute etf-prices --file=scripts/d1_listing_dates_schema.sql
py -3 scripts/generate_listing_dates_d1_seed.py \
  --input data/listing_dates/etf_listing_dates_enrichment.csv \
  --output data/listing_dates/etf_listing_dates_seed.sql
wrangler d1 execute etf-prices --file=data/listing_dates/etf_listing_dates_seed.sql
```

D1 적용 전에는 `etf_listing_dates_enrichment.csv`의 상태별 건수와 `etf_listing_dates_review_queue.csv`를 검토한다. 특히 `unavailable` 상태를 임의의 날짜로 채워 배포하지 않는다. 화면은 상태별 표기 규칙을 그대로 적용한다.

## 신규 ETF 자동 갱신 절차

신규 종목의 검증 흐름은 완전히 규칙 기반이다. 따라서 사용자 요청이 있을 때만 실행하는 작업이 아니라, 기존 일일 데이터 갱신 작업 뒤에 같은 실행 환경에서 연결하는 방식이 적합하다. 반복 실행에는 아래 순서를 사용한다.

1. 일일 시세 스냅샷에서 신규 종목코드를 감지한다.
2. `collect_kind_listing_dates.py`를 최근 2개월 범위로 실행해 KIND 신규상장 공시 원장을 갱신한다.
3. `merge_listing_dates_with_master.py`로 현재 마스터와 병합한다.
4. KIND 원문에서 ISIN을 확보할 수 있는 경우에만 `verified_official`로 승격하고, URL·공시번호·검증시각을 함께 저장한다.
5. KIND 미매칭 행만 `collect_first_traded_candidates.py`로 보완한다. 이 단계의 결과는 `provisional_first_trade`이며 공식 상장일이 아니다.
6. `manual_review`와 `unavailable` 상태는 검토 대기열로 유지하고, 배포 전에 수를 확인한다.

자동 실행은 외부 계정이나 AI 판단이 아니라 공개 API·공시 조회와 파일 병합으로 끝나는 결정적 작업이다. 따라서 정해진 시각에 백엔드 작업으로 실행하고, 실패한 월·종목을 CSV로 남겨 재시도하는 구성이 권장된다. 분 단위 감시나 별도 상시 프로세스는 필요하지 않다.

## 원천과 한계

금융위원회 증권상품시세정보 API는 기준일·종목코드·ISIN·상품명·NAV·거래대금 등 시세 정보를 제공하지만, 상장일을 명시적으로 제공하지 않는 경우 최초 `basDt`는 상장일이 아니라 후보일이다.[2] KRX Open API의 ETF 제공 항목도 ETF 일별매매정보 중심이므로, 상장일의 주 원천은 KIND 신규상장 공시로 유지한다.[3]

KIND 검색결과는 공개 화면에서 기간·종목명·보고서명 조건으로 조회되며, 결과 제목과 공시번호를 제공한다.[4] 이번 수집에서 KIND 검색이 반환하는 신규상장 공시 원장은 2008-08-27부터 시작한다. 이보다 이전에 상장된 ETF 또는 KIND 검색과 현재 마스터가 매칭되지 않는 ETF는 운용사 공식 상품 페이지·KIND 원문 ISIN·최초 거래 확인일 순서로 보완해야 한다. 이 한계는 `unavailable` 또는 `provisional_first_trade`로 노출되어야 하며, 실제로 확인하지 않은 날짜를 상장일로 표시해서는 안 된다.

## 참고문헌

[1] [KRX KIND, NH-Amundi HANARO 미국AI메모리반도체TOP4+ ETF 신규상장 공시 사례](https://kind.krx.co.kr/external/2026/05/08/000383/20260508001028/68152.htm)  
[2] [공공데이터포털, 금융위원회 증권상품시세정보](https://www.data.go.kr/en/data/15094806/openapi.do)  
[3] [KRX Open API 서비스 목록](https://openapi.krx.co.kr/contents/OPP/INFO/service/OPPINFO004.cmd)  
[4] [KRX KIND, ETF 공시 검색](https://kind.krx.co.kr/disclosure/disclosurebystocktype.do?method=searchDisclosureByStockTypeEtf)
