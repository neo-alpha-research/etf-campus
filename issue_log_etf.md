# ETF Campus 문제점 및 성능 병목 로그 (`issue_log_etf.md`)

> **문서 버전**: 1.0.0  
> **최종 갱신일**: 2026-09-08  
> **프로젝트**: ETF Campus Web Platform  
> **문서 목적**: 과거 장애·실패 이력, 데이터 파이프라인 결함, 외부 API 병목, 프론트엔드 성능 이슈 전수 기록 및 CODEX 개선 가이드

---

## 1. 외부 API 호출 제한 (Rate Limit) 및 쿼터 병목

### 1.1 Cloudflare D1 Free Tier 일일 Row Read 한도 초과 (Code 7500)
* **발생 일시**: 2026-09-06 05:06:52 UTC (GitHub Actions Run #34012566877)
* **관련 워크플로우**: `Deploy market briefing production` (`market-briefing-production.yml`)
* **실패 로그 원문**:
  ```text
  ✘ [ERROR] A request to the Cloudflare API (/accounts/***/d1/database/11c4e874-fba2-4e34-91d0-808892284c86/query) failed.
  Your account has exceeded D1's free tier daily row read limit. Upgrade to a paid plan or wait until tomorrow (midnight UTC) to continue. [code: 7500]
  ```
* **근본 원인 분석**:
  - D1 Free Tier의 일일 Row Read 한도는 **5,000,000 행(Rows)**입니다.
  - 마켓 브리핑 배포 및 마이그레이션 적용 과정에서 1,167개 ETF 전체의 일일 시세 및 과거 이력 테이블에 대해 인덱스 없이 전체 스캔(Full Table Scan)을 반복 수행하여 일일 한도가 일시에 고갈되었습니다.
* **현재 조치 상태**:
  - 당일 자정(UTC) 쿼터 리셋 후 정상 복구.
* **CODEX 개선 과제**:
  1. 시세 조회 쿼리에 복합 인덱스(`ticker`, `date`) 보강 및 쿼리 프로파일링.
  2. 일일 마켓 브리핑 정적 스냅샷은 D1 대신 **Cloudflare R2(Object Storage)**에 JSON 형태로 직접 업로드 및 엣지 서빙하여 D1 Row Read를 0에 수렴하도록 오프로드.

---

### 1.2 공공데이터포털 (data.go.kr) 금융위 시세 API 쿼터 및 게이트웨이 타임아웃
* **대상 API**: 금융위원회 증권상품시세정보 API (`GetSecuritiesProductInfoService/getETFPriceInfo`)
* **현상**:
  - 장 마감 직후(16:00~17:00 KST) 트래픽 집중 시간대에 1,167개 종목을 일괄 수집할 때 공공데이터포털 게이트웨이에서 간헐적으로 HTTP 500 또는 504 Gateway Timeout 반환.
  - 일일 허용 트래픽(기본 10,000건/일) 초과 위험.
* **현재 조치 상태**:
  - `scripts/update_daily_data.py`에 지수 백오프(Exponential Backoff, 3회 재시도, 회당 3~5초 대기) 적용.
  - 종목별 개별 조회가 아닌 일자별 전종목 조회(1페이지당 1,000개) 방식으로 변경하여 API 호출 횟수를 하루 2회로 최소화.
* **CODEX 개선 과제**:
  - 휴일/영업일 검증 로직(`market_holidays.txt`)을 선행 확인하여 비영업일 불필요한 호출 원천 차단.

---

### 1.3 OpenDART API 분당 호출 제한 및 IP 제어
* **대상 API**: 금융감독원 OpenDART 공시 API (`opendart.fss.or.kr`)
* **현상**: 분당 1,000건 초과 호출 시 즉각적인 429 Too Many Requests 차단.
* **현재 조치 상태**:
  - 벌크 크롤링 대신 운용사별 공시 리스트 배치 단위 수집(`sleep(0.1)` 딜레이 부여).
  - 로컬 캐싱을 적용하여 동일 공시 재다운로드 방지.

---

### 1.4 Gemini API 호출 한도(429) 및 장애(503) 극복 이력
* **현상**: 마켓 브리핑 요약문 생성 시 무료 티어 단일 API 키 사용으로 분당 RPM(15) 초과 발생.
* **해결 완료 (Best Practice)**:
  - `lib/ai/gemini-client.ts`에 **7대 마스터 토큰 풀(`MASTER_GEMINI_TOKENS`) 로드밸런싱**과 **5계층 모델 워터폴** 구축:
    `gemini-3.8-flash` ➡️ `gemini-3.7-flash` ➡️ `gemini-3.6-flash` ➡️ `gemini-flash-latest` ➡️ `gemini-2.5-flash`
  - 장애 시 사전에 검증된 정적 금융 분석 데이터로 즉시 자동 전환되는 Graceful Fallback 구현 완료.

---

## 2. 데이터 파싱 및 무결성 결함 이력

### 2.1 퀀트 TR 엔진 임시 하드코딩 컷오프(Frozen Cutoff) 동결 버그 (🚨 중요 결함)
* **발견 일시**: 2026-09-07
* **영향 파일**: `scripts/calculate_daily_tr_index.py`, `scripts/calculate_total_returns.py`
* **결함 내용**:
  - 과거 백필 작업 시 임시로 삽입되었던 `cutoff_date = '2026-08-31'` 문자열 상수가 제거되지 않고 방치됨.
  - 이로 인해 2026년 9월 1일~4일의 정상 시세가 수집되었음에도 불구하고, TR 지수 및 총수익률 계산에서 9월 데이터가 전면 누락·동결(Frozen)되는 중대 결함 발생.
* **근본 해결 조치 완료**:
  1. `data/etf_master_draft.csv`의 실제 최신 거래일을 동적으로 추출하는 `get_master_latest_date()` 함수로 전면 개편.
  2. `scripts/verify_zero_hallucination.py`에 **Step 4: Cross-Artifact Date Parity Gate**를 신설하여, 마스터 최신일(`2026-09-04`)과 시세 이력, TR 지수, 총수익률 지표 간 기준일 불일치 시 CI를 강제 중단(Exit 1)하도록 원천 차단.
  3. `AGENTS.md`에 **단일 진실 공급원(SSOT) 및 구 프로세스·잔재 청산 원칙**을 전사 지침으로 명문화.

---

### 2.2 OpenDART 투자설명서 본문 절단(Truncation) 이슈
* **현상**:
  - `opendart.fss.or.kr/api/document.xml` 호출 시, 투자설명서 본문 내용이 `[ 본 문 ]` 태그 이후 완전히 비어있는 채 표지만 반환됨.
  - 이로 인해 106개 커버드콜 ETF의 신탁약관 상 파생상품 위험평가액(100% 초과 여부)을 자동 파싱할 수 없는 한계 직면.
* **컴플라이언스 준수 조치**:
  - Zero-Hallucination 원칙에 따라, 추정치나 선형 보간을 일체 금지하고 운용사 원본 공시 확인 전까지 해당 ETF를 '미확인(unverified)' 상태로 유지.
  - 공시 원문이 수기 검증된 종목만 `data/fees/official_total_fee_promoted_v1.json`을 통해 증빙 후 제한적으로 승격.

---

### 2.3 KOFIA 수수료 공시 이상치 및 분모 왜곡
* **현상**:
  - 신규 설정된 지 얼마 되지 않은 ETF의 경우, 초기 순자산총액(AUM) 왜곡으로 인해 금융투자협회 공시 실부담비용이 연 20~50% 수준의 비정상 수치로 공시되는 왜곡 발생.
* **해결 조치**:
  - `scripts/sync-kofia-fees.ts`에 통계적 이상치 서킷 브레이커(Z-score 및 5% 초과율 임계치)를 구축하여, 비정상 공시 수집 시 자동 반영을 거부하고 수동 검토 큐로 이관.

---

## 3. Cloudflare 빌드 및 GitHub Actions 실패 이력

| 워크플로우 Run ID | 발생 일시 | 실패 요인 | 에러 로그 요약 | 근본 조치 및 상태 |
| :--- | :---: | :--- | :--- | :--- |
| `34091237742`<br>~`34088809965` | 2026-09-07 | JSX 텍스트 내 따옴표 unescaped 및 미사용 타입 린트 에러 | `react/no-unescaped-entities: `'` can be escaped with `&apos;`` | #690 커밋에서 엔티티 이스케이프 및 미사용 변수 전수 정리 완료 (✅ 해결) |
| `33483031032` (`kofia-fee-sync`) | 2026-09-01 | GITHUB_TOKEN의 git push 권한 거부 | `remote: Permission to neo-alpha-research/etf-campus.git denied to github-actions[bot]. 403` | 토큰 권한 분리 전까지 `.archive_etf/workflows/`로 격리 보관 |
| `34012566877` (`market-briefing`) | 2026-09-06 | D1 Free Tier 일일 쿼터 초과 | `Your account has exceeded D1's free tier daily row read limit. [code: 7500]` | D1 쿼리 최적화 및 R2 오프로딩 아키텍처 수립 중 |
| `34080882736` (`book-curation`) | 2026-09-07 | 알라딘 TTB 키 환경변수 주입 시점 지연 | `Missing ALADIN_TTB_KEY secret in runner environment` | GitHub Secrets 주입 확인 후 수동 실행 정상 통과 완료 (✅ 해결) |

---

## 4. 프론트엔드 렌더링 지연 및 성능 병목 구간

### 4.1 1,167개 ETF 테이블 전체 렌더링 시 DOM 오버헤드
* **병목 위치**: `components/dashboard/dashboard.tsx`, `components/screener/screener.tsx`
* **현상**:
  - 일반/커버드콜/연금 모드 전환 또는 키워드 검색 시 1,167개 종목의 다중 컬럼(종목명, 티커, 보수, 8개 구간 수익률, 위험등급 뱃지 등)이 가상화 없이 일시에 렌더링됨.
  - 저사양 모바일 기기에서 탭 전환 시 300~600ms의 UI 지연(Jank) 및 프레임 드랍 발생.
* **CODEX 핵심 개선 목표**:
  - `@tanstack/react-virtual`을 도입하여 뷰포트에 표시되는 15~20개 행만 동적으로 DOM에 마운트하는 **가상 스크롤(Virtualization)** 전면 적용.

---

### 4.2 Recharts 시계열 차트 대용량 데이터 로딩 오버헤드
* **병목 위치**: `components/etf-detail/price-history-chart.tsx`, `components/compare/etf-compare-chart.tsx`
* **현상**:
  - '3년' 또는 '설정이후(Max)' 기간 선택 시 최대 750~2,500개의 일별 시세 포인트를 SVG 노드로 변환하면서 클라이언트 브라우저의 CPU 점유율 급증.
* **CODEX 핵심 개선 목표**:
  - 시계열 다운샘플링 알고리즘(LTTB: Largest-Triangle-Three-Buckets)을 클라이언트 차트 렌더링 직전에 적용하여, 시각적 왜곡 없이 데이터 포인트를 100~150개로 압축 렌더링.

---

### 4.3 모바일 뷰포트(360~430px) 가로 스크롤 및 터치 사용성
* **병목 위치**: 모바일 환경에서의 데이터 테이블
* **현상**:
  - 작은 모바일 화면에서 수익률 및 수수료 열을 확인하기 위해 가로 스크롤 시, 종목명 컬럼이 화면 밖으로 밀려나 투자자가 어떤 종목의 수치인지 혼선을 겪을 위험 존재.
* **개선 방향**:
  - `Sticky Left Column`(종목명/티커 고정) 및 우측 그림자 인디케이터(Scroll Hint) 완비.
  - 최소 터치 타겟 44x44px를 철저히 보장하고 상하 스크롤 간섭 방지.
