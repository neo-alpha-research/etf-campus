# ETF Campus 리드 마그넷 인수인계

## 배포용 파일

운영자가 고객에게 전달할 파일은 아래 한 개다.

- `output/pdf/etf-campus-3-page-etf-lead-magnet.pdf` - A4 가로형 3페이지 최종본

개별 페이지 PDF는 검수·수정용이며, 고객 배포에는 사용하지 않는다.

## 테마별 구성

| 페이지 | 주제 | 핵심 비교 |
| --- | --- | --- |
| 1 | 연금계좌 대표지수 ETF | 합성총보수·비용, 증권거래비용, 실부담비용 |
| 2 | 월배당·인컴형 ETF | 실제 분배 이력 상태, 분배 주기, 가격 MDD |
| 3 | AI·반도체 ETF | YTD·3개월 가격수익률, 가격 MDD, TOP 5 집중도 |

## 월간 갱신에 필요한 파일

| 목적 | 파일 |
| --- | --- |
| 페이지 2 가격 원천 | `data/income_page2_price_history.csv` |
| 페이지 2 분배금 원장 | `data/income_page2_distribution_ledger.csv` |
| 페이지 3 가격 원천 | `data/page3_price_history.csv` |
| 페이지 3 계산 결과 | `data/page3_price_metrics.csv` |
| 페이지 3 보유종목 원천 | `data/page3_holdings_raw_collection.csv` |
| 페이지 3 지표 규칙 | `data/page3_metric_rules.md` |
| PDF 생성 | `scripts/create_lead_magnet_page1.py`, `scripts/create_lead_magnet_page2.py`, `scripts/create_lead_magnet_page3.py` |
| PDF 병합 | `scripts/merge_lead_magnet_pdf.py` |

## 운영 문서

- `OPERATING_PLAYBOOK.md` - 월간 발행 절차와 예외 처리 원칙
- `API_KEY_AND_MONTHLY_RUN_GUIDE.md` - API 키 설정 및 실행 명령
- `RELEASE_APPROVAL_CHECKLIST.md` - 발행 승인 전 점검표

## 현재 데이터 상태

- 페이지 1: KODEX·RISE의 대표 S&P500·나스닥100 ETF 4개 비용 비교
- 페이지 2: RISE 490600의 최근 12개월 실제 분배율은 공식 확인, 나머지 3개는 공식 분배이력 수집 상태를 명시
- 페이지 3: KODEX 395160, RISE 0093A0, TIGER 491010의 가격·보유종목 원문 확인. ACE 446770은 최신 공식 보유종목 원문 미확보로 제외

## 배포 직전 실행 순서

1. `API_KEY_AND_MONTHLY_RUN_GUIDE.md`의 임시 환경변수 설정
2. `OPERATING_PLAYBOOK.md`의 수집·공시 대조·PDF 생성 순서 실행
3. `RELEASE_APPROVAL_CHECKLIST.md`를 모두 확인
4. 최종 PDF 한 개만 배포
