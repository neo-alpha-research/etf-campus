# ETF Campus 공식 분배금 수집·검증 기반 — 초기 구현 결과

**작업 기준일:** 2026-08-13 (GMT+9)  
**적용 위치:** `D:\ETFCampus`  
**목적:** 운용사 공식 공지와 한국거래소 KIND 공시를 근거로, 분배금·권리 일정·검증 상태를 보존하고 검증되지 않은 TR을 사용자에게 노출하지 않는 데이터 기반을 구축합니다.

## 완료한 구현

이번 작업은 기존 가격수익률(PR) 파일을 수정하지 않고, 원문 증빙·정규화 이벤트·완전성 상태·TR 결과를 병렬 데이터 계층으로 추가했습니다. 이는 기존 상세·비교 화면을 깨지 않으면서 총수익률(TR) 공개 범위를 보수적으로 확대할 수 있는 구조입니다.

| 구분 | 구현 파일 또는 경로 | 역할 |
|---|---|---|
| 공식 원천 수집·정규화·검증 | `scripts/collect_distribution_sources.py` | 원문 보존, SHA-256 해시, 문서 원장, 이벤트 정규화, 완전성 생성, 엄격한 상태 검증 |
| TR 계산기 | `scripts/calculate_total_returns.py` | 고정 기간별 TR 산출. 분배·기업행동 커버리지가 완결되지 않으면 빈 값과 사유를 출력 |
| 원천 문서 원장 | `data/distributions/etf_distribution_source_documents.csv` | URL, 게시일, 수집 시각, HTTP 상태, 콘텐츠 유형, 해시, 원본 경로, 파서 상태 보존 |
| 정규화 분배 이벤트 | `data/distributions/etf_distribution_events.csv` | 권리락일·기준일·지급일·주당 분배금·원천 문서 ID·검증 상태 기록 |
| 완전성 원장 | `data/distributions/etf_tr_data_coverage.csv` | `무분배`와 `미수집`을 구분하고 TR 차단 사유 기록 |
| 기업행동 원장 | `data/corporate_actions/etf_corporate_actions.csv` | 분할·병합·종목코드 변경 검증을 위한 별도 보존 공간 |
| TR 생성 결과 | `data/returns/etf_total_return_metrics.csv` | 기간별 총수익률 또는 명시적 미산출 사유 기록 |
| 코드 입력 보완 | `scripts/backfill_api.py`, `functions/api/internal/ingest-prices.js` | 영문·숫자 혼합 6자리 ETF 코드를 허용하여 가격 적재 누락 방지 |

## 초기 수집·검증 결과

초기 실행은 기존 원장의 공식 URL 후보와 489030의 운용사·KRX 표본 문서를 대상으로 수행했습니다. 원문은 변경 없이 `data/distributions/raw/` 아래에 보존했으며, 수집 이후 SHA-256 무결성 대조를 실행했습니다.

| 측정 항목 | 결과 | 해석 |
|---|---:|---|
| 초기 수집 대상 문서 | 9건 | 운용사 공지·상품 후보 URL과 KRX 표본 공시를 원문 보존 |
| 원천 문서 원장 | 22건 | 초기 수집 문서 + 기존 원장 이관 근거 포함 |
| 정규화 분배 이벤트 | 14건 | 기존 확인 가능 이벤트 13건과 PLUS 489030 수동 검증 표본 1건 |
| ETF 완전성 상태 행 | 1,160건 | 전체 마스터에 대해 `pending` 또는 `partial`을 명시적으로 생성 |
| 원문 해시 대조 | 9 / 9 통과 | 수집된 원문 파일의 존재와 SHA-256 일치 확인 |
| 검증 오류 | 0건 | 중복 이벤트 ID·날짜 역전·문서 참조 오류 미발견 |
| TR 경고 | 14건 | 모든 이벤트가 아직 `partial`이므로 TR 계산 차단 — 의도된 안전 동작 |
| 초기 TR 결과 | 88행 | 현재 가격 이력 8종목 × 11기간을 평가했으며, 검증된 TR 수치는 0건 |

현재 TR 결과가 0건인 것은 실패가 아니라 **검증 상태가 불완전한 데이터를 TR로 오표기하지 않도록 차단한 결과**입니다. 53행은 분배금 커버리지가 아직 `pending`, 18행은 일부 이벤트만 있는 `partial`, 17행은 시작 시점 가격 이력이 부족해 산출하지 않았습니다.

## 적용한 검증 원칙

> 분배금 금액은 운용사 공식 공지에서 확인하고, 분배락일·분배락 기준가격은 KRX KIND 공시로 대조합니다. 두 원천 또는 전 기간 커버리지가 불완전하면 TR을 산출하지 않고 `TR 데이터 미검증` 상태로 유지합니다.

489030 표본의 경우 한화자산운용 PLUS ETF 공식 공지에는 주당 103원, 분배락일 2026-07-29, 분배 기준일 2026-07-31, 지급예정일 2026-08-04가 제시됩니다.[1] 해당 수치는 K-ETF의 차트 표본과도 일치하지만, K-ETF는 원천이 아니라 비교 검증용으로만 취급했습니다. 한국거래소 KIND 공시는 분배락 사유·적용일·기준가격 검증에 사용하며, KRX 기준가격을 TR의 가격 입력으로 사용하지 않습니다.[2]

TR 계산식은 검증된 `ex_date`에 해당하는 주당 현금분배금만 반영합니다.

\[
F_t = \frac{P_t + D_t}{P_{t-1}}
\]

여기서 `P_t`는 기업행동을 반영해 전일과 비교 가능한 시장 종가이고, `D_t`는 해당 권리락일의 검증된 주당 분배금 합계입니다. 시작일보다 늦게 상장한 ETF는 상장일 가격으로 대체하지 않으며 `insufficient_price_history`로 표시합니다.

## 재실행 방법

프로젝트 루트에서 아래 명령을 실행하면, 이미 수집한 원문은 다시 받지 않고 새 대상·실패 대상만 이어서 처리합니다.

```powershell
python scripts\collect_distribution_sources.py run --sleep 0.1
python scripts\calculate_total_returns.py
```

수집 대상은 `data/distributions/collection_targets.csv`에 추가합니다. 운용사 공지 HTML·JSON·PDF·이미지 중 이미지나 스캔 PDF는 외부 OCR 패키지를 추가하지 않고 `manual_review`로 유지합니다. 수동 검증 후에는 `manual_verified_distribution_events.csv`에 이벤트를 추가하고 재정규화합니다.

## 남은 적용 범위

P0 단계의 원장·원문 보존·무결성·TR 차단 기반은 구현됐습니다. 실제 TR 공개를 위해서는 각 운용사(PLUS·KODEX·TIGER·RISE·ACE 등)의 공식 원문 파서를 확대하고, KIND 원문 공시의 접수번호를 종목·월 단위로 연결해야 합니다. 또한 전 종목 월별 가격 이력 및 분할·병합 원장을 채워야 장기 1·2·3년 TR을 안정적으로 산출할 수 있습니다.

UI 반영은 이 데이터가 `verified_complete` 또는 `verified_no_distribution` 상태에 도달한 종목부터 진행해야 합니다. 그 전에는 PR만 표시하고, TR 탭은 비어 있는 값과 검증 사유를 표시하는 것이 안전합니다.

## 검증 명령 결과

| 검증 | 결과 |
|---|---|
| `python -m py_compile` (신규 Python 스크립트 포함) | 통과 |
| `node --check functions/api/internal/ingest-prices.js` | 통과 |
| 기존 가격 적재 API Vitest | 18 / 18 통과 (루트 및 기존 worktree 발견 테스트 포함) |
| Python 영문·숫자 ETF 코드 회귀 테스트 | 통과 |
| JavaScript 영문·숫자 ETF 코드 회귀 테스트 | 통과 |
| 분배금 원장·원문 해시 검증 | 오류 0건, 원문 9 / 9 일치 |

## References

[1]: https://www.plusetf.co.kr/customer/notice/detail?n=30823 "PLUS ETF — 7월 분배금 공지(월말), 2026-07-28"
[2]: https://kind.krx.co.kr/common/disclsviewer.do?method=searchInitInfo&acptNo=20241029000652&docno= "한국거래소 KIND — [PLUS 고배당주위클리커버드콜] ETF 분배락 기준가격 안내"
