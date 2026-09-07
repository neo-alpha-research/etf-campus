# ETF 캠퍼스 운영 스크립트 카탈로그 (Ops Scripts Catalog)

본 문서는 `scripts/` 디렉터리에 위치한 117개 스크립트의 실행 주체, 목적, 운영 성격(상시 운영 vs 1회성 마이그레이션)을 전수 분류하여 무중단 운영 안정성과 배포 거버넌스를 보장하기 위한 공식 카탈로그입니다.

---

## 1. 상시 운영 배치 스크립트 (Active CI/CD & Production Pipelines)

아래 스크립트들은 GitHub Actions 워크플로우 또는 빌드(`npm run build`, `npm test`) 과정에서 상시 실행되는 핵심 스크립트로, **임의 수정이나 삭제가 엄격히 제한**됩니다.

| 스크립트 경로 | 실행 워크플로우 / 명령 | 실행 주기 | 주요 역할 |
| :--- | :--- | :---: | :--- |
| `scripts/verify-utf8.mjs` | `npm test` (`ci-fast`, `ci-full`) | 상시 (PR/Push) | 데이터 파일 및 소스 코드 UTF-8 인코딩 무결성 검증 |
| `scripts/generate-screener-json.ts` | `npm run prebuild` | 상시 (Build) | 스크리너 뷰포트용 사전 캐시 정적 JSON 생성 |
| `scripts/generate-style-og-images.mjs` | `npm run prebuild` | 상시 (Build) | 10대 투자 스타일 진단 SNS 공유용 동적 OG 이미지 생성 |
| `scripts/check-release-readiness.mjs` | `npm run check:release` | 상시 (Release) | 학습용 가이드 MDX 컴플라이언스(자본시장법 §101) 게이트 검증 |
| `scripts/check_source_ready.py` | `daily-market.yml` | 매 거래일 09:33 | KRX/공공데이터포털 원천 시장 데이터 적재 완료 여부 사전 검증 |
| `scripts/update_daily_data.py` | `daily-market.yml` | 매 거래일 09:33 | 1,200+ 전 종목 일일 시세, 거래대금, 괴리율, AUM 갱신 |
| `scripts/publish_market_source_snapshot.py` | `daily-market.yml` | 매 거래일 09:33 | 검증된 시세를 Cloudflare D1 시장 스냅샷 허브에 발행 |
| `scripts/rules/validate_daily_market.py` | `daily-market.yml` | 매 거래일 09:33 | 일일 시장 데이터 변동폭 및 제로-할루시네이션 이상치 감사 |
| `scripts/check_workflow_success_today.py` | `daily-distribution.yml`, `daily-holdings.yml` | 상시 배치 가드 | 금일 성공 여부를 선판정하여 Actions 불필요 과금 분 절감 |
| `scripts/run_daily_distribution_update.py` | `daily-distribution.yml` | 매 거래일 13:07 | 분배금 지급 현황 및 신규 배당 공시 수집·동기화 |
| `scripts/refresh_holdings.py` | `daily-holdings.yml` | 매 거래일 19:00 | 주요 ETF 상위 10대 구성종목(Holdings) 수집 및 D1 갱신 |
| `scripts/validate_page3_holdings.py` | `daily-holdings.yml` | 매 거래일 19:00 | 적재된 구성종목 비중 합계 및 종목 코드 유효성 검증 |
| `scripts/rules/audit_holdings_composition.py` | `holdings-audit.yml` | 매 거래일 02:17 | 파생형·복합형 ETF 구성종목 컴플라이언스 이상 여부 정밀 감사 |
| `scripts/sync-kofia-fees.ts` | `kofia-fee-sync.yml` | 매월 1, 5, 10일 | 금융투자협회(KOFIA) 전자공시 실부담비용 3분해 정기 동기화 |
| `scripts/trading_days.py` | `monitor-market-daily-pipeline.yml` | 매 거래일 09:45 | 한국거래소(KRX) 개장일 캘린더 판정 및 휴일 감지 |
| `scripts/generate_local_osmu_preview.py` | `market-briefing-production.yml` | 브리핑 배포 시 | 인스타그램, 스레드, 뉴스레터용 마켓 브리핑 OSMU 카드 렌더링 |
| `scripts/auto-curate-books.ts` | `book-curation.yml` | 정기 실행 | ETF 투자자 필독 도서 큐레이션 및 메타데이터 자동 갱신 |
| `scripts/fetch-book-covers.mjs` | `book-curation.yml` | 정기 실행 | 교보·예스24·알라딘 도서 커버 이미지 엣지 서빙 동기화 |

---

## 2. 1회성 마이그레이션 및 레거시 스크립트 (Archive & Reference)

아래 스크립트들은 프로젝트 초기(Phase 0) 시계열 백필, 상장일 대사, 리드 마그넷 제작 등 1회성 마이그레이션을 위해 작성되었으며, 현재 상시 CI/CD 워크플로우에 의해 직접 호출되지 않습니다.

- **Phase 0 데이터 백필**: `phase0_collect_and_tag.py`, `phase0_merge_verify.py`, `backfill_d1_prices.py`, `backfill_itd.py` 등
- **상장일 대조/해결**: `collect_kind_listing_dates.py`, `resolve_listing_dates_d1.py`, `sync_listing_dates_to_master.py` 등
- **리드마그넷 PDF 생성**: `create_lead_magnet_page1~3.py`, `merge_lead_magnet_pdf.py`, `render_lead_magnet_release.py` 등
- **분배금 초기 수집**: `run_distribution_registry_52.py`, `run_distribution_registry_remaining_23.py` 등

> [!NOTE]
> 1회성 스크립트들은 데이터 재검증 및 감사 추적(Audit Trail) 목적으로 원본 경로를 보존하며, 상시 운영 파이프라인과의 혼선을 방지하기 위해 위 표와 같이 분류 관리합니다.
