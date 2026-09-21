# ETF Campus Timeseries v1 (`tr_index`) Retirement Plan

**문서 작성일**: 2026-09-17  
**소유 부서**: Core Data Engineering & UI/UX Architecture  
**대상 자산**: `public/data/returns/tr_index/*.json` (1,172개 파일, 64.6MB)  
**대체 자산**: `public/data/series/v2/*.json`, `*.recent.json`, `manifest.json` (2,345개 파일, 약 39MB)

---

## 1. 개요 및 배경

Step 83 및 Step 84를 통해 ETF 비교 시계열 차트의 성능 및 데이터 무결성 개선을 위해 **시계열 v2 표준 계약(Columnar Array Format + 250일 최근 데이터 분할 + Manifest 기반 동적 캐싱)**이 도입되었습니다.

### v1 vs v2 자산 비교

| 비교 항목 | v1 (`tr_index`) | v2 (`series/v2`) | 개선 효과 |
|---|---|---|---|
| **데이터 구조** | 행 기반 객체 배열 (`points: [{date, close, tr_index, ...}]`) | 열 기반 압축 배열 (`dates: [], close: [], tr: [], netTr: []`) | 불필요한 JSON 키 반복 제거 |
| **네트워크 페이로드** | 전 종목 약 64.6MB (전체 이력 일괄) | `recent` 12.2KB / `full` 35.0KB (5종목 브로틀리 기준) | 전송량 75% 이상 절감 |
| **캐시 무효화** | 정적 파일 캐시 무효화 메커니즘 부재 | `manifest.json` 기반 동적 `?v={asOf}` 쿼리 부착 | 엣지/CDN 캐시 제어 완벽 보장 |
| **결측치 대응** | 결측치 메타데이터 부재 | 전사 표준 KRX 거래일 달력 기반 LOCF 및 `filled` 인덱스 제공 | Zero-Hallucination 정합성 확보 |

---

## 2. v1 자산 소비 현황 전수 감사 (Consumer Audit)

2026-09-17 기준 코드베이스 전수 조사 결과:

### 2.1 프론트엔드 UI 화면 및 API 라우트
- **소비 화면 목록**: **0건 (None)**
  - `/compare` 화면: `public/data/series/v2/{ticker}.recent.json` 및 `.json`을 직접 소비하도록 전환 완료.
  - `/api/prices/history` 라우트: 비교 화면에서 호출 0건 확인됨.
  - 기타 웹페이지 화면: `tr_index`를 직접 fetch하거나 임베딩하는 사용자 접점 컴포넌트 없음.

### 2.2 백엔드 및 데이터 파이프라인 스크립트
현재 v1은 **파이프라인의 중간 산출물(Intermediate Stage)**로 사용 중입니다:
1. `scripts/calculate_daily_tr_index.py`: KRX 종가 및 분배금 원장을 취합하여 `public/data/returns/tr_index/{ticker}.json` 생성.
2. `scripts/generate_series_v2.py`: 위 `tr_index`를 읽어 v2 포맷(`public/data/series/v2/`)으로 재가공.
3. `scripts/verify_zero_hallucination.py`: `tr_index` 디렉토리를 일부 감사에 사용.
4. `scripts/verify_split_adjustment.py`: 기본 경로로 `tr_index`를 감사.

---

## 3. 3단계 은퇴 로드맵 (Phase-out Roadmap)

| 단계 | 목표 | 주요 작업 내용 | 목표 일정 |
|---|---|---|---|
| **Phase 1 (현재 완료)** | **v2 런칭 및 프론트엔드 완전 전환** | • `series/v2` 포맷 및 `manifest.json` 생성기 가동<br>• `/compare` 화면 v2 소비로 100% 전환<br>• v1-v2 공존 상태 유지 | 2026-09-17 |
| **Phase 2 (파이프라인 단일화)** | **파이프라인 v2 직결 및 중간 산출물 제거** | • `scripts/calculate_daily_tr_index.py`가 중간 v1 파일 없이 v2 파일(`series/v2`)을 직접 생성하도록 통합<br>• `verify_zero_hallucination.py` 및 `verify_split_adjustment.py`의 감사 대상을 v2로 전환<br>• `generate_series_v2.py`를 단일 빌더로 흡수 통합 | 2026-09-25 |
| **Phase 3 (v1 완전 삭제)** | **저장소 용량 회수 (64.6MB Purge)** | • `public/data/returns/tr_index/` 1,172개 파일 전량 `git rm`<br>• 배포 번들 및 Cloudflare Pages 아티팩트 용량 64.6MB 회수<br>• CI/CD 배포 시간 단축 | 2026-10-02 |

---

## 4. 롤백 및 안전 보장 계획 (Safety Guard)

- **보수적 은퇴 원칙**: v1 파일(`public/data/returns/tr_index/*.json`)은 Phase 1 단계인 현재 즉시 삭제하지 않고 보존하여, 예상치 못한 파이프라인 이슈 발생 시 즉각 비교 검증할 수 있는 기준 데이터셋(Reference Baseline)으로 활용합니다.
- Phase 3에서 v1을 최종 삭제하기 전, 프로덕션 환경에서 최소 1주일간 v2 시계열 차트의 모바일/데스크톱 로딩 안정성 및 캐시 무효화 동작을 모니터링합니다.
