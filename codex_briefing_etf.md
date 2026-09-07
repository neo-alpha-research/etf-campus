# CODEX (GPT-6 Astra) 엔지니어링 인계 브리핑 (`codex_briefing_etf.md`)

> **수신**: CODEX (GPT-6 Astra)  
> **발신**: Antigravity (Advanced Agentic AI, DeepMind)  
> **작성일자**: 2026-09-08  
> **프로젝트**: ETF Campus (대한민국 전 종목 ETF 금융 분석 및 연금 포털)  
> **참조 명세서**: [`architecture_etf.md`](architecture_etf.md), [`issue_log_etf.md`](issue_log_etf.md), [`AGENTS.md`](AGENTS.md)

---

## 1. 프로젝트 정체성 및 절대 준수 규약

CODEX 에이전트는 ETF Campus 코드베이스 작업 시 다음 세 가지 절대 규약을 최우선으로 준수해야 합니다.

1. **ZERO-HALLUCINATION POLICY (엄격한 데이터 무결성)**:
   - 금융 데이터의 결측에 대해 어떠한 자의적 추정, 과거 비율 적용, 더미 데이터 주입도 **엄격히 금지**합니다.
   - 결측치는 무조건 **Graceful Fallback**(`데이터 없음`, `미확인`, 빈 구조체)으로 렌더링해야 합니다.
   - 데이터 파이프라인 수정 전 반드시 `docs/Data_Catalog.md`를 열람하여 공식 수식과 기준일을 확인하십시오.
2. **자본시장법 제101조 컴플라이언스**:
   - 특정 종목 추천, 목표가 제시, 확정 수익률 약속 등 유사투자자문/불법 자문으로 오인될 수 있는 UI/UX 및 브리핑 문구를 원천 배제합니다.
3. **단일 진실 공급원(SSOT) 및 구 잔재 즉시 청산 (Principle of Superseding & Legacy Purge)**:
   - 신규 프로세스나 파이프라인을 도입할 경우, 기존 레거시 코드와 문서의 구 지침을 방치하지 않고 **원자적(Atomically)으로 즉시 수정하거나 완전 제거**해야 합니다.

---

## 2. 현 시스템 상태 요약 (Baseline State)

* **코드베이스 상태**: `main` 브랜치 최신 헤드, 작업 트리 클린(Clean).
* **CI/CD 통과율**: **100% Green (에러 0건)**
  - Frontend: `npm run check:ci` (ESLint 통과, TypeScript CI 타입체크 통과, Vitest 444개 테스트 전수 통과, Cloudflare Workers 3개 타입체크 통과)
  - Data Pipeline: Python 144개 단위 테스트 전수 통과 (`python -m unittest discover -s scripts/tests`)
  - 무결성 감사: `python scripts/verify_zero_hallucination.py` 0 Errors / 0 Warnings 검증 완료.
* **프로덕션 서빙**: `https://etf-campus.pages.dev/` (Cloudflare Pages, HTTP 200 OK).

---

## 3. 사전 정돈 및 `.archive_etf` 격리 내역

인계 직전, 빌드 무결성에 영향을 주지 않으면서도 시스템 혼선을 야기하던 비활성·더미 자산을 `.archive_etf` 디렉토리로 완전 격리하였습니다.

| 격리 디렉토리 | 격리된 자산 목록 | 격리 사유 |
| :--- | :--- | :--- |
| `.archive_etf/dummy_data/` | `mock-briefing.json`, `mock-community-posts.json` | 2026년 8월 기준 모의 데이터 (Zero-Hallucination 원칙에 따른 격리) |
| `.archive_etf/workflows/` | `kofia-fee-sync.yml`, `rollback-market-briefing-production.yml` | GITHUB_TOKEN 쓰기 권한 충돌(403) 및 미사용 롤백 파이프라인 |
| `.archive_etf/scratch/` | `temp_master_*.csv`, `holdings_raw_*.json`, 1회성 스크립트 (30개 파일, 13MB+) | 이전 연구·검증 과정에서 누적된 대용량 스크래치 파일 정리 |
| `.archive_etf/data/` | `data/distributions/raw/legacy_candidate/` | 과거 수집 검증용 레거시 HTML 스냅샷 |
| `.archive_etf/scripts/` | `delete_briefings_20260824_20260828.sql` | 8월 데이터 청산용 1회성 임시 쿼리 |

> ⚠️ **CODEX 작업 주의**: `.archive_etf` 내 파일들은 참고용 보관소이므로, 신규 코드에서 이 폴더의 경로를 직접 참조(Import)해서는 안 됩니다.

---

## 4. 핵심 한계점 및 병목 분석 (Bottlenecks)

CODEX가 즉각적으로 해결에 착수해야 할 프로젝트의 핵심 병목 구간은 다음과 같습니다:

1. **Cloudflare D1 Free Tier 일일 500만 Row Read 쿼터 병목**:
   - 시세 및 보유종목 조회 시 풀 테이블 스캔으로 인해 대량 트래픽 또는 배포 마이그레이션 시 쿼터 고갈(코드 7500) 발생 위험.
2. **1,167개 ETF 테이블 클라이언트 DOM 오버헤드**:
   - `dashboard.tsx` 및 `screener.tsx`에서 가상화(Virtualization) 없이 전체 행을 직접 렌더링하여 모바일 저사양 기기에서 300~600ms 프레임 드랍 발생.
3. **OpenDART API 본문 절단(Truncation) 제약**:
   - `document.xml` 호출 시 투자설명서 본문 미제공으로 커버드콜 위험평가액 자동 추출이 불가능한 구조적 한계.
4. **Recharts 시계열 차트 데이터 과적**:
   - 3년치/Max 기간 시세 렌더링 시 최대 2,500개의 SVG 데이터 포인트를 다운샘플링 없이 렌더링하여 메모리 과소비 유발.

---

## 5. CODEX 즉시 투입 3대 핵심 고도화 미션

### 미션 1: ETF 데이터 수집 자동화 및 스토리지 계층화 (Storage Tiering)
* **목표**: Cloudflare D1 쿼터 고갈 위험을 영구 해소하고 정기 수집 신뢰도 99.9% 달성.
* **구체적 실행 방안**:
  1. **D1 복합 인덱싱**: `etf_prices` (`ticker`, `date`), `etf_holdings` (`ticker`, `as_of_date`) 인덱스 최적화.
  2. **R2 스냅샷 캐싱**: 마켓 브리핑 및 일일 시세 종합 데이터를 일별 정적 JSON으로 빌드하여 Cloudflare R2에 업로드하고 Pages Functions에서 R2/CDN 캐시를 우선 조회하도록 변경 (D1 Row Read를 90% 이상 절감).
  3. **GitHub Actions 토큰 권한 정상화**: `workflows/kofia-fee-sync.yml`에 전용 Personal Access Token(PAT) 또는 적절한 GITHUB_TOKEN 권한(`permissions: contents: write`)을 구성하여 레거시 폴더에서 복귀 및 월간 자동 동기화 활성화.

### 미션 2: 웹앱 프론트엔드 성능 극대화 (Virtualization & Chart Downsampling)
* **목표**: 모바일 및 데스크톱 전 기기에서 60fps 부드러운 스크롤 및 인터랙션 보장.
* **구체적 실행 방안**:
  1. **가상 스크롤 도입**: `@tanstack/react-virtual`을 `components/dashboard/dashboard.tsx`와 `components/screener/screener.tsx`에 도입하여 뷰포트 내 15~20개 행만 동적 렌더링.
  2. **LTTB(Largest-Triangle-Three-Buckets) 차트 다운샘플링**: `components/etf-detail/price-history-chart.tsx`에서 3Y/Max 시계열 데이터를 120개 대표 포인트로 시각적 왜곡 없이 압축하여 Recharts 렌더링 속도 5배 향상.
  3. **모바일 가로 스크롤 Sticky 고정**: 작은 뷰포트(360~430px)에서 종목명/티커 열을 좌측에 고정(`sticky left-0 bg-background z-10`)하고 우측에 그림자 인디케이터 적용.

### 미션 3: 레거시 완전 청산 및 엔지니어링 위생 유지 (Hygiene & Governance)
* **목표**: 기술 부채 누적 원천 차단 및 단일 진실 공급원(SSOT) 준수.
* **구체적 실행 방안**:
  1. `.archive_etf`에 격리된 파일 중 영구 불필요 자산에 대한 단계적 영구 삭제(`git rm`).
  2. 모든 PR/커밋에 대해 `npm run check:ci`와 `python -m unittest discover -s scripts/tests` 통과를 강제하는 pre-push 훅 유지.
  3. 퀀트 TR 지수 및 마스터 데이터 기준일 동기화를 상시 감시하는 `Cross-Artifact Date Parity Gate` 통과 여부 상시 검증.

---

## 6. 골든 커맨드 & 일일 검증 런북 (Cheat Sheet)

CODEX가 작업을 수행할 때마다 반드시 실행해야 하는 검증 명령어입니다:

```bash
# 1. 프론트엔드 통합 검증 (ESLint + TypeScript + Vitest 444개 + Workers 3개 타입체크)
npm run check:ci

# 2. 파이프라인 무결성 단위 테스트 (144개 파이프라인 테스트)
python -m unittest discover -s scripts/tests

# 3. 제로-홀루시네이션 및 기준일 일치(Date Parity) 종합 감사
python scripts/verify_zero_hallucination.py

# 4. UTF-8 인코딩 및 텍스트 파일 검증
npm run verify:utf8

# 5. 로컬 프로덕션 빌드 테스트
npm run build
```

---

## 7. 결언

현재 ETF Campus는 **기능적 무결성(100% Green CI)**과 **금융 컴플라이언스(Zero-Hallucination)**를 완벽하게 갖춘 상태에서 인계됩니다.  
CODEX 에이전트는 위 3대 미션(D1 스토리지 계층화, 가상 스크롤 렌더링, 수집 자동화)을 정밀하게 수행하여, 사용자에게 최상의 속도와 신뢰감을 제공하는 대한민국 1위 ETF 분석 플랫폼으로 고도화해 주시기 바랍니다.
