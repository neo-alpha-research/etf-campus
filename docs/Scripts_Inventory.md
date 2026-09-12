# ETF Campus 스크립트 인벤토리 및 파이프라인 매니페스트

최초 작성: 2026-09-12  
성격: **살아 있는 문서(SSOT)**. 파이프라인 변경 시 갱신합니다.

---

## 1. 개요 (Overview)

`scripts/` 디렉토리에는 ETF Campus의 시세 수집, 공시 결산, 연금 규제 검증, OSMU 렌더링을 담당하는 스크립트들이 위치합니다.
본 문서는 **정기 자동화 파이프라인에서 실제 실행되는 핵심 스크립트**와 **빌드/검증 도구**, 그리고 **과거 1회성 마이그레이션 아카이브**를 명확히 구분하여 운영자의 인지 부하를 줄이고 장애를 방지합니다.

---

## 2. 정기 자동화 파이프라인 핵심 스크립트 (Production Active Pipelines)

아래 스크립트들은 GitHub Actions 및 NHN Cloud n8n 스케줄러에 의해 자동으로 정기 실행되는 프로덕션 필수 스크립트입니다.

| 스크립트 경로 | 연계 워크플로우 / 스케줄 | 단일 원천 (SSOT) | 주요 역할 및 기능 |
|:---|:---|:---:|:---|
| `scripts/check_source_ready.py` | `daily-market.yml`<br>(화~토 08:00~09:10 KST) | 한국거래소 (KRX) | 전일 거래일의 KRX Open API 시세 발행 여부 사전 프로빙 (5분 사다리 점검) |
| `scripts/check_workflow_success_today.py` | `daily-market.yml` | GitHub Actions API | 당일 워크플로우 기성공 여부 확인 및 중복 실행 방지 가드 |
| `scripts/update_daily_data.py` | `daily-market.yml` | 한국거래소 (KRX) | 1,167개 ETF 일별 시세, 종가, NAV, 상장좌수, 거래대금 수집 및 정제 |
| `scripts/fetch_market_indices.py` | `daily-market.yml` | KRX / Yahoo / ECOS | KOSPI, KOSDAQ, VKOSPI 및 글로벌 8대 매크로 지표 일괄 수집 |
| `scripts/detect_listing_reference_work.py` | `daily-market.yml` | KRX KIND | 최근 상장 ETF 기준가 및 상장일 수정 작업 필요 여부 감지 |
| `scripts/rebuild_listing_reference_prices.py`| `daily-market.yml` | KRX Open API | 신규 상장 종목 최초 기준가 복원 및 상장 이후 수익률(ITD) 재계산 |
| `scripts/publish_market_source_snapshot.py` | `daily-market.yml` | Cloudflare D1 | 정제된 데이터 스냅샷을 D1 Outbox 및 Hub로 HMAC-SHA256 서명 인제스션 |
| `scripts/rules/validate_issuer_coverage.py` | `daily-market.yml` | 내부 원장 | 발행사 커버리지 종결성 검증 (배포 전 프리플라이트 게이트) |
| `scripts/validate_briefing_gate.py` | `daily-market.yml` | Cloudflare D1/KV | 마켓 브리핑 배포 전 데이터 무결성 및 품질 게이트 검증 |
| `scripts/wait_for_briefing_api.py` | `generate-osmu.yml` | Distributor Worker | OSMU 렌더링 전 배포 API 엔드포인트의 데이터 갱신 대기 |
| `scripts/sync_osmu_kv.py` | `generate-osmu.yml` | Cloudflare KV | 렌더링된 인스타그램 6슬라이드 및 스레드 이미지를 Cloudflare KV로 동기화 |
| `scripts/publish_osmu_channels.py` | `generate-osmu.yml` | Meta Graph API | Threads, Instagram, 이메일 뉴스레터 3대 채널 순차 배포 및 중복 방지 |
| `scripts/notify_telegram_osmu.py` | `generate-osmu.yml` | Telegram Bot API | OSMU 생성 완료 시 운영자에게 1-Tap 검토 및 즉시 발송 링크 알림 발송 |
| `scripts/refresh_holdings.py` | `daily-holdings.yml`<br>(매일 19:00 KST) | 네이버 증권 / 운용사 | 1,160+개 ETF의 구성종목(PDF)을 병렬 수집하여 D1 `etf_holdings` 테이블 적재 |
| `scripts/collector/kofia_fee_collector.py` | `kofia-fee-sync.yml`<br>(매월 1, 5, 10일) | 금융투자협회 (DIS) | 금융투자협회 공모펀드 결산 공시 기반 3-Tier 실부담비용율 전수 수집 |
| `scripts/collector/sync_new_listing_fee.py` | `kofia-fee-sync.yml`<br>(매일 09:33 KST) | FnGuide / 네이버 | 신규 상장 ETF의 약관상 명목 총보수 즉시 동기화 및 마스킹 적용 |
| `scripts/collect_seibro_distributions.py` | `daily-distribution.yml`<br>(화~토 13:07 KST) | 한국예탁결제원 (SEIBro) | 한국예탁결제원 배당·분배금 공시 원장 XML 수집 (`etf_distribution_events.csv`) |
| `scripts/build_distribution_summaries.py` | `daily-distribution.yml` | SEIBro 원장 | 배당 주기, TTM 누적 분배금, 배당수익률 집계 (`etf_distribution_summaries.json`) |
| `scripts/rules/audit_holdings_composition.py`| `holdings-audit.yml`<br>(화~토 02:17 KST) | D1 `etf_holdings` | 구성종목 실측 기반 마케팅 상품명 괴리 및 연금 안전자산 규제 드리프트 감사 |

---

## 3. 릴리스 및 빌드 도구 (Build & Release Tooling)

| 스크립트 경로 | 실행 시점 | 주요 역할 |
|:---|:---|:---|
| `scripts/generate-screener-json.ts` | Next.js `prebuild` | 마스터 CSV 데이터를 고속 탐색용 정적 JSON (`public/data/screener.json`)으로 컴파일 |
| `scripts/generate-style-og-images.mjs`| Next.js `prebuild` | 10개 투자 스타일 동물 페르소나의 동적 SNS 공유 OG 이미지 사전 생성 |
| `scripts/verify-utf8.mjs` | `npm test` | 저장소 내 350여 개 텍스트 및 데이터 파일의 UTF-8 BOM/인코딩 무결성 검증 |
| `scripts/check-release-readiness.mjs` | `npm run check:release` | 프로덕션 배포 전 지침, 테스트, 린트, 필수 데이터 파일 누락 여부 종합 진단 |
| `scripts/distribute-briefing.mjs` | `npm run briefing:distribute` | 운영자가 CLI에서 직접 3대 채널 원클릭 동시 발행을 수행할 수 있는 편의 툴 |

---

## 4. 규제 및 품질 보증 엔진 (`scripts/rules/`)

| 스크립트 경로 | 법적/규제 근거 | 주요 역할 |
|:---|:---|:---|
| `scripts/rules/pension_regulatory_engine.py` | 근로자퇴직급여보장법 제21조/제25조<br>퇴직연금감독규정 제9조/제12조<br>조특법 제91조의18 | 파생 위험평가액 40% 초과 종목 배제, 안전자산 100% vs 70% 판정, ISA 세제혜택 분류 |
| `scripts/rules/holdings_asset_classifier.py` | 금융투자협회 펀드분류기준 | ETF 편입 개별 자산(국내주식, 해외주식, 채권, 선물, 현금) 자동 분류 |
| `scripts/rules/validate_evidence_integrity.py` | 다층 증거 원장 기준 | 연금 적격성 증거 원장(`pension_verification_ledger.csv`)의 증거 유효성 검증 |
| `scripts/rules/validate_pension_consistency.py` | 자본시장법 집합투자기구 공시 | 마스터 분류와 연금 검증 시트 간의 논리적 일관성 검사 |

---

## 5. 과거 1회성 마이그레이션 아카이브 (Historical Migrations)

`scripts/` 내의 `collect_income_page2_prices.py`, `calculate_page3_metrics.py`, `run_distribution_registry_52.py`, `create_lead_magnet_*.py` 등은 서비스 런칭 초기 특정 데이터셋 구축 또는 리드마그넷 제작을 위해 작성된 **과거 1회성 실행 스크립트**입니다.
이들은 정기 파이프라인에서 실행되지 않으며, 과거 데이터 구축 이력 추적 및 재현성 확보를 위한 참조용 자산으로 보관됩니다.
