# Known Failure Modes Catalog (SSOT)

이 문서는 ETF Campus 마켓 브리핑 및 OSMU 자동화 파이프라인에서 실제로 관측된 고유 실패 유형(Failure Modes)을 관리하는 단일 진실 공급원(SSOT)입니다.
`scripts/lint_pipeline.py`의 자동 검사항목(CHECKS) 수는 본 문서에 정의된 고유 실패 유형 수 이상이어야 하며, `scripts/tests/test_lint_pipeline.py`가 아래 "재현 코드 조각"을 전수 검출함을 보증해야 합니다.

---

## [FM-001] CI Git Shallow Clone History Loss
- **관측 사례**: 2026-09-17 CI 환경에서 `actions/checkout@v4` 기본값(`fetch-depth: 1`) 동작 시 `git log`를 통한 과거 커밋 스냅샷 조회가 불가능하여 펀드플로우 연산이 빈 배열(`[]`)을 반환한 사고.
- **발생 위치**: `scripts/build_local_briefing_payload.py:64, 72`
- **실제 발생 코드 조각**:
  ```python
  log_res = subprocess.run(['git', 'log', '-n', '10', '--format=%H', 'data/etf_master_draft.csv'])
  show_res = subprocess.run(['git', 'show', f'{c}:data/etf_master_draft.csv'])
  ```
- **근본 원인**: 런타임 연산이 Git 커밋 히스토리의 `subprocess` 호출에 의존함.
- **방어 대책**: 물리 경량 스냅샷(`data/snapshots/`) 파일 SSOT 구축, Git 히스토리 subprocess 폴백 완전 제거, CI `fetch-depth: 1` 원복.
- **자동 검사**: `scripts/lint_pipeline.py` -> `check_git_log_subprocesses()`

---

## [FM-002] Silent Module Import Swallowing (Fail-Open ImportError)
- **관측 사례**: 2026-09-17 CI 환경에서 `pydantic` 임포트 실패(`ImportError`) 시 `try-except`로 경고만 찍고 기본 체크로 넘어가 무검증 상태로 KV 업로드가 강행된 사고.
- **발생 위치**: `scripts/sync_osmu_kv.py:361-365`
- **실제 발생 코드 조각**:
  ```python
  except ImportError as e:
      print(f"⚠️ Warning: Could not import BriefingContract ({e}), proceeding with basic safety check.", file=sys.stderr)
      # return 1 없음 -> 무검증 KV 업로드 속행
  ```
- **근본 원인**: 예외 발생 시 안전 정지(Fail-Closed)하지 않고 빈 데이터로 통과(Fail-Open)시킴.
- **방어 대책**: 임포트 실패 시 즉시 `sys.exit(1)` 또는 `return 1`로 프로세스를 차단.
- **자동 검사**: `scripts/lint_pipeline.py` -> `check_import_error_swallowing()`

---

## [FM-003] Pipeline Git Commit Artifact Exclusion
- **관측 사례**: 2026-09-17 일별 정본 파일(`data/briefing_payload_2026-09-16.json`)이 생성되었으나 워크플로 내 `git add` 목록에 누락되어 원격 저장소에 아카이빙되지 못한 문제.
- **발생 위치**: `.github/workflows/daily-market.yml:272`
- **실제 발생 코드 조각**:
  ```bash
  for file in data/snapshots data/briefing_payload_latest.json ...; do # briefing_payload_*.json 누락
  ```
- **근본 원인**: 워크플로 파일 목록 수동 관리 시 신규 아티팩트 패턴 누락.
- **방어 대책**: `daily-market.yml`의 `git add` 목록에 `data/briefing_payload_*.json`, `data/snapshots` 등 필수 정본 패턴 필수 포함 강제.
- **자동 검사**: `scripts/lint_pipeline.py` -> `check_daily_market_git_add()`

---

## [FM-004] Hardcoded Production Dates & Mock Literals
- **관측 사례**:
  1. 2026-09-17 `scripts/sync_market_source_indices.py`에 `as_of_date = "2026-09-16"` 하드코딩 후 CI 워크플로에 연결되어 매일 9/16 데이터로 덮어쓰는 버그.
  2. UI 툴팁 문자열 내 `공시 기준 (2026-09-06)` 정적 날짜 하드코딩.
  3. UI 가이드 문구 내 `전수 유니버스 4개사(TIGER 231·KB 143·PLUS 84)` 고정 개수 하드코딩.
- **발생 위치**: `scripts/sync_market_source_indices.py:17`, UI 컴포넌트
- **실제 발생 코드 조각**:
  ```python
  as_of_date = "2026-09-16"
  source_version = "market-source-2026-09-16-bd9450dcf8ddb141"
  ```
  ```tsx
  title={`공시 기준 (2026-09-06)`}
  text="전수 유니버스 4개사(TIGER 231·KB 143)"
  ```
- **근본 원인**: 일회성 도구가 `_oneoff`로 격리되지 않고 상시 파이프라인에 연결되었거나, 동적 변수 대신 UI 텍스트에 정적 수치 기입.
- **방어 대책**: 파이프라인 스크립트 및 핵심 컴포넌트 대상 날짜 리터럴(`20\d\d-\d\d-\d\d`) 및 고정 카운트(`\d{3,4}개`) 탐지. 일회성 도구는 `scripts/_oneoff/`로 격리.
- **자동 검사**: `scripts/lint_pipeline.py` -> `check_hardcoded_dates_or_counts()`

---

## [FM-005] Dual Representation & Unmapped Identifiers
- **관측 사례**: 2026-09-17 외부 수집 원시 티커(`^GSPC`, `KRW=X`)와 내부 정규 코드(`SPX`, `USDKRW`)가 여러 계층에서 제각각 매핑되어 D1 적재(원시 티커)와 API 서빙(정규 코드) 간 불일치 발생.
- **발생 위치**: `scripts/build_local_briefing_payload.py:268-279`, `scripts/publish_market_source_snapshot.py:263`
- **실제 발생 코드 조각**:
  ```python
  CANONICAL_INDEX_MAP = {"^GSPC": "SPX", "^IXIC": "NDX", ...}
  LABEL_INDEX_MAP = {"SPX": "S&P 500", ...}
  ```
- **근본 원인**: 식별자 변환 딕셔너리가 개별 스크립트에 파편화되어 있고 수집 직후 정규화되지 않음.
- **방어 대책**: `lib/indices.py`를 단일 SSOT로 확립하고, 수집 직후 정규화 수행 및 `CANONICAL_MACRO_CODES` 12대 지표 집합 일치 검증을 D1 적재와 API 전 계층에 강제.
- **자동 검사**: `scripts/lint_pipeline.py` -> `check_macro_indices_ssot()`

---

## [FM-006] Incomplete Migration Sequence & D1 Constraint Mismatch
- **관측 사례**: 2026-09-17 D1 스키마의 과거 `CHECK (index_code IN ('KOSPI', 'KOSDAQ'))` 제약 및 송신 측 2개 한정 필터로 인해 10개 해외/거시 지표가 D1 적재에서 필터링됨.
- **발생 위치**: `migrations/0007_market_source_snapshot_hub.sql:12`, `publish_market_source_snapshot.py:263`
- **실제 발생 코드 조각**:
  ```sql
  CHECK (index_code IN ('KOSPI', 'KOSDAQ'))
  ```
  ```python
  final = signed_post(..., {"indices": kospi_kosdaq}) # 2개만 전송
  ```
- **근본 원인**: D1 마이그레이션 제약이 너무 좁았고, 송신 측 스크립트도 2개로 하드코딩됨.
- **방어 대책**: 마이그레이션 0023으로 12대 정규 지표 화이트리스트 CHECK 제약 재설정 및 마이그레이션 파일 순서·네이밍 정합성 자동 검증.
- **자동 검사**: `scripts/lint_pipeline.py` -> `check_migrations_sequence()`

---

## [FM-007] Unversioned Query on Version-Keyed Snapshot Table
- **관측 사례**: 2026-09-17 `market_source_index_daily` 테이블의 PK에 `source_version`이 포함(`(as_of_date, source_version, index_code)`)되어 있을 때, 조회 쿼리가 버전 조건 없이 `WHERE as_of_date = '$TARGET_DT'`만으로 조회하여, 당일 데이터 수정이나 재발행(re-publish) 발생 시 버전별 12건이 누적(총 24건 이상)되어 API/클라이언트에 중복 반환될 수 있는 위험.
- **발생 위치**: `migrations/0007_market_source_snapshot_hub.sql:39`, `migrations/0023_purge_raw_ticker_index_codes.sql:27`, `.github/workflows/d1-migrations.yml:71`
- **실제 발생 코드 조각**:
  ```sql
  PRIMARY KEY (as_of_date, source_version, index_code)
  ```
  ```sql
  SELECT as_of_date, index_code, index_name, close_value, change_pct
  FROM market_source_index_daily
  WHERE as_of_date = '$TARGET_DT' ORDER BY index_code ASC;
  ```
- **근본 원인**: 서빙 및 조회 대상 테이블임에도 PK에 버전 컬럼이 포함되어 재발행 시 upsert되지 않고 append되며, 조회 측에서는 버전 조건 없이 조회하여 행 중복이 발생함.
- **방어 대책**:
  1. 조회 대상 테이블(`market_source_index_daily`)의 PK를 `(as_of_date, index_code)`로 변경(Migration 0024)하여 당일 재발행 시 자동 upsert 및 12건 고정 보장.
  2. 과거 버전 이력이 필요할 경우 별도의 감사 테이블(`market_source_index_daily_audit`)로 분리.
  3. 린터가 서빙 테이블 PK에 `source_version` 포함 여부 및 버전 없는 쿼리 패턴을 기계적으로 차단.
- **자동 검사**: `scripts/lint_pipeline.py` -> `check_versioned_pk_unversioned_query()`

---

## [FM-008] Untracked Pipeline & Workflow Files
- **관측 사례**: 2026-09-17 `.github/workflows/threads-daily-post.yml` 및 `scripts/threads/` 스크립트가 로컬에 생성되었으나 git add/commit되지 않고 untracked 상태로 방치됨. GitHub Actions는 기본 브랜치(default branch)에 커밋된 워크플로만 cron 스케줄로 실행하므로, 매일 KST 07:00에 실행되어야 할 포스팅 작업이 에러 알림조차 없이 조용히 실행되지 않음.
- **발생 위치**: `.github/workflows/threads-daily-post.yml`, `scripts/threads/generate_thread.py`, `scripts/threads/threads_bank.json`
- **실제 발생 상태 스니펫**:
  ```text
  ?? .github/workflows/threads-daily-post.yml
  ?? scripts/threads/generate_thread.py
  ?? scripts/threads/threads_bank.json
  ```
- **근본 원인**: 자동화 기능을 로컬에서 작성한 후 커밋 및 푸시 단계를 누락하여, 워크플로가 저장소의 실행 대상 트리거로 등록되지 못함.
- **방어 대책**:
  1. 린터(`scripts/lint_pipeline.py`)에 git status 기반 untracked 파이프라인 파일(`check_untracked_pipeline_files()`) 검출기 추가.
  2. 일회성 스크립트(`scripts/_oneoff/`)를 제외한 모든 워크플로 및 파이프라인 스크립트의 untracked 상태를 CI 및 로컬에서 기계적으로 차단.
- **자동 검사**: `scripts/lint_pipeline.py` -> `check_untracked_pipeline_files()`

---

## [FM-009] Premature Destructive Schema Migration Before Code Deployment
- **관측 사례**: 2026-09-17 D1 마이그레이션 0024(`PRIMARY KEY (as_of_date, index_code)`)가 적용된 직후, Cloudflare Pages에 새 Ingest API 코드(`ON CONFLICT (as_of_date, index_code)`)가 빌드/배포 완료되기 전에 워크플로가 Ingest API를 호출하여, 구버전 Worker(`ON CONFLICT (as_of_date, source_version, index_code)`)와 신규 D1 스키마 간 불일치로 HTTP 500 (`ingestion_failed`) 오류 발생.
- **발생 위치**: `.github/workflows/d1-migrations.yml:48`, `functions/api/internal/ingest-market-source.js:178`
- **실제 발생 코드 조각**:
  ```sql
  -- D1 신규 스키마 (0024):
  PRIMARY KEY (as_of_date, index_code)
  -- Cloudflare Pages 미배포 구버전 Worker:
  INSERT INTO market_source_index_daily ... ON CONFLICT(as_of_date, source_version, index_code) DO UPDATE ...
  -- 결과: ON CONFLICT clause does not match any PRIMARY KEY or UNIQUE constraint -> HTTP 500
  ```
- **근본 원인**: 코드 배포와 DB 마이그레이션 순서가 역전되어, 약 2분간 지속되는 Pages 빌드 시간 동안 구버전 코드가 신규 파괴적 스키마(PK 변경)에 접근하여 충돌 발생.
- **방어 대책**:
  1. `d1-migrations.yml` 워크플로에서 마이그레이션 스텝 앞에 **Cloudflare Pages 배포 완료 확인 게이트(Wait for Pages deployment of current SHA)**를 필수 배치하여, 현재 커밋의 코드 배포가 완료된 후에만 D1 마이그레이션 및 재발행을 수행하도록 보장.
  2. `publish_market_source_snapshot.py`에 HTTP 5xx 발생 시 지수 백오프 자동 재시도 로직 유지.
- **자동 검사**: `.github/workflows/d1-migrations.yml` 내 `Wait for Pages deployment of current SHA` 게이트 및 단위 테스트.


