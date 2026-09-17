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
- **근본 원인**: 자동화 기능을 로컬에서 작성한 후 커밋 및 푸시 단계를 누락하여, 워크플로가 저장소의 실행 대상 트리거로 등록되지 못함. 또한 CI 클린 체크아웃(`actions/checkout`) 환경에서는 untracked 파일이 원리적으로 존재하지 않으므로(`git status --porcelain`이 항상 빈 문자열), CI 단독 검사로는 검출이 불가능함.
- **방어 대책**:
  1. **실효 집행 지점 로컬 이전**: 저장소 버전 관리 대상인 `.githooks/pre-push`에 린터(`scripts/lint_pipeline.py`) 및 회귀 테스트를 필수 배치하고, `npm run prepare`(`git config core.hooksPath .githooks`)로 모든 개발 환경에 자동 동기화하여 푸시 전 untracked 파일 존재 시 `git push`를 원천 차단. (단, `git push --no-verify`로 로컬 훅이 우회될 수 있으므로 전 브랜치 대상 중앙 집중식 CI 워크플로 `pipeline-integrity.yml`을 상시 병행 집행).
  2. 일회성 스크립트(`scripts/_oneoff/`)를 제외한 모든 워크플로 및 파이프라인 스크립트의 untracked 방치 방지.
- **자동 검사**: `scripts/lint_pipeline.py` -> `check_untracked_pipeline_files()` (로컬 pre-push 훅 집행)

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
  1. `d1-migrations.yml` 워크플로에서 마이그레이션 스텝 앞에 **Cloudflare Pages 배포 완료 확인 게이트(`scripts/check_pages_deployment.py`)**를 필수 배치하여, 현재 커밋의 코드 배포가 완료된 후에만 D1 마이그레이션 및 재발행을 수행하도록 보장.
  2. `publish_market_source_snapshot.py`에 HTTP 5xx 발생 시 지수 백오프 자동 재시도 로직 유지.
- **자동 검사**: `scripts/lint_pipeline.py` -> `check_migration_workflow_deployment_gate()`

---

## [FM-010] Cron Workflow Inactive on Non-Default Branch
- **관측 사례**: 2026-09-17 `threads-daily-post.yml` 등 `cron` 스케줄을 포함하는 워크플로가 원격 피처 브랜치(`feat/threads-automation`)에 추적된 상태로 존재하지만, GitHub Actions는 기본 브랜치(`main`)에 커밋된 워크플로만 cron 스케줄로 실행하므로 스케줄 트리거가 전혀 동작하지 않는 문제 (FM-008의 untracked 상태와 구분되는 별도 실패 유형).
- **발생 위치**: `.github/workflows/threads-daily-post.yml`
- **실제 발생 코드 조각**:
  ```yaml
  on:
    schedule:
      - cron: "0 22 * * *"
  ```
- **근본 원인**: GitHub Actions의 스케줄러 아키텍처 제약(기본 브랜치 전용)에 대한 인지 부족으로 인해 비기본 브랜치에 스케줄 워크플로를 격리한 채 배포 대기.
- **방어 대책**:
  1. 린터에 `check_cron_workflows_on_default_branch()`를 독립 검사로 등록하여 `cron:` 스케줄을 포함하는 워크플로가 `origin/main` 목록에 존재하는지 기계적으로 대조.
  2. `git ls-tree` 실패나 `origin/main` 부재 시 조용히 통과(fail-open)하지 않고 즉시 오류를 반환(Fail-Closed)하여 CI 및 로컬에서 차단.
- **자동 검사**: `scripts/lint_pipeline.py` -> `check_cron_workflows_on_default_branch()`

---

## [FM-011] Destructive Schema Migration Without Baseline Record
- **관측 사례**: 
  1. D1 마이그레이션 0024처럼 테이블을 DROP/재생성하거나 PK를 변경하는 파괴적 스키마 변경 시, 사전/사후 행 수 기준값이 SQL 내부에서 원자적으로 기록되지 않아 데이터 누락 여부를 사후 검증하기 어렵고 데이터 신뢰성을 훼손하는 문제.
  2. D1 마이그레이션 `0023_purge_raw_ticker_index_codes.sql`처럼 DDL 변경 없이 `DELETE FROM`으로 대량의 행을 영구 삭제하는 데이터 파괴적 변경 시에도, 사전/사후 카운트가 기록되지 않으면 의도치 않은 전면 삭제나 불일치를 감지할 수 없음.
- **발생 위치**: `migrations/0024_single_version_market_source_index_daily.sql`, `migrations/0023_purge_raw_ticker_index_codes.sql`
- **근본 원인**: 스키마 파괴적 변경(DROP/ALTER) 및 대량 데이터 삭제(DELETE FROM) 시 사전 상태와 사후 상태의 카운트를 측정·기록하는 메커니즘 부재.
- **방어 대책**:
  1. `docs/migration_template.sql` 3단계 표준(사전 카운트 기록 -> DDL/DML 변경 -> 사후 카운트 업데이트) 수립.
  2. 린터(`check_destructive_migrations_baseline()`)를 통해 `DROP TABLE`, `ALTER TABLE`, 또는 `DELETE FROM`을 포함하는 신규 마이그레이션(0027번 이후)이 `migration_baselines`에 `INSERT INTO`, `pre_count`, `post_count` 3대 요소를 온전히 기록하지 않으면 기계적으로 차단.
- **자동 검사**: `scripts/lint_pipeline.py` -> `check_destructive_migrations_baseline()`

---

## [FM-012] Working Tree Plaintext Secret Detection
- **관측 사례**: 2026-09-17 포렌식 스캔 작업 중 일회성 스크랩 파일(`scripts/_oneoff/gemini_forensic_scan.txt`)에 평문 시크릿(Google API Key `AIzaSyCvPN7n...`, Gemini CLI Token `AQ.Ab8RN6IhU...` 등 7건)이 미추적(untracked) 상태로 생성되었으나, 기존 `git grep` 기반 검사는 추적 파일만 검사하고 기존 파이프라인 린터(FM-008)는 `_oneoff/` 디렉터리를 스캔에서 제외하여 로컬 검사를 통과하고 pre-commit 훅에서 비로소 차단된 문제.
- **발생 위치**: `scripts/_oneoff/gemini_forensic_scan.txt`, `scripts/lint_pipeline.py:check_working_tree_secrets()`
- **실제 발생 코드 조각**:
  ```
  -  "AIzaSyCvPN7n..." // Primary
  -  "AQ.Ab8RN6IhU..." // Backup CLI Token
  ```
- **근본 원인**: `git grep`의 추적 파일 한정 스캔 및 린터 내 `_oneoff/` 디렉터리 예외 처리로 인해 작업 트리에 존재하는 미추적/임시 파일의 시크릿 노출을 감지하지 못함.
- **방어 대책**:
  1. `.gitignore`에 `scripts/_oneoff/*forensic*`, `scripts/_oneoff/*secret*`, `scripts/_oneoff/*.key`, `scripts/_oneoff/*token*` 가드 등록.
  2. 린터에 `check_working_tree_secrets()`를 등록하여 `.git`, `node_modules` 등 빌드/의존성 캐시를 제외한 작업 트리 전체 파일을 전수 스캔 (1MB 이하, 바이너리 제외).
  3. `android/app/google-services.json`(Firebase 공개 모바일 클라이언트 식별자) 외 일체의 디렉터리(`_oneoff/` 포함) 예외 불허.
  4. 위반 보고 시 키 전문 출력을 금지하고 앞 12자만 마스킹하여 2차 유출 원천 차단.
- **자동 검사**: `scripts/lint_pipeline.py` -> `check_working_tree_secrets()`

---

## [FM-013] WIP Commit on Main Branch Prohibition
- **관측 사례**: 2026-09-17 `feat/compare-timeseries-chart` 작업 중 `wip` 커밋(`da0bccda`, `444dce37`) 및 병합 커밋(`5881130e`, `e285332a`)이 기능 브랜치에서 `main` 브랜치로 역병합/푸시되어 프로덕션 `main` 브랜치 이력에 `wip` 체크포인트가 노출된 문제.
- **발생 위치**: `git log origin/main --oneline`, `AGENTS.md` 규율 10
- **실제 발생 코드 조각**:
  ```
  da0bccda wip(compare): checkpoint step 84 working files on feat/compare-timeseries-chart
  444dce37 wip(compare): save compare timeseries chart components to feature branch
  ```
- **근본 원인**: 브랜치 격리 규율에서 머지 방향(`작업 브랜치 → main` 단방향)을 명시하지 않아, 작업 브랜치에서 `git merge main`을 수행한 뒤 해당 브랜치 헤드를 그대로 `main`에 푸시하는 역병합이 발생함.
- **방어 대책**:
  1. `AGENTS.md` 규율 10에 `작업 브랜치 → main` 단방향 머지 원칙 및 `wip`/`checkpoint`/`temp`/`test(ci)` 커밋의 main 유입 전면 금지 명문화.
  2. 린터에 `check_wip_commits_on_main()`을 등록하여 `origin/main` 최근 30개 커밋에서 `^\S+\s+(wip|checkpoint|temp)[\(:]` 패턴 커밋을 기계적으로 검출·차단 (FM-013 제정 이전 과거 기준점 3건은 baseline으로 격리 관리).
- **자동 검사**: `scripts/lint_pipeline.py` -> `check_wip_commits_on_main()`

---

## [FM-014] Exemption Disclosure SSOT Enforcement
- **관측 사례**: 2026-09-17 FM-013 검사 구현 시 과거 이력(`da0bccda`, `80620aa4`, `444dce37`)을 화이트리스트 상수(`WIP_HISTORICAL_BASELINE_COMMITS`)로 면제 처리했으나, 보고서에 "FM-013 PASSED"만 기재되고 면제된 커밋 3건 및 사유가 투명하게 공개되지 않아 검사 통과의 전제 조건이 은폐된 문제.
- **발생 위치**: `scripts/lint_pipeline.py:check_exemption_disclosure()`, `docs/known_failure_modes.md` 「검사 면제 목록 SSOT」
- **실제 발생 코드 조각**:
  ```python
  WIP_HISTORICAL_BASELINE_COMMITS = {"da0bccda", "80620aa4", "444dce37"}
  ```
- **근본 원인**: 코드 내 면제 상수(`*_EXEMPT*`, `*_BASELINE_*`)가 문서화 및 보고서에 공개되지 않아도 검사가 통과되는 구조적 결함.
- **방어 대책**:
  1. `docs/known_failure_modes.md` 말미에 「검사 면제 목록 SSOT」 섹션을 공식 신설하여 모든 면제 대상과 사유를 단일 진실 공급원으로 공개.
  2. 린터에 `check_exemption_disclosure()`를 등록하여 코드 내 모든 면제 상수 원소(`0001`~`0026`, `android/app/google-services.json`, `.dev.vars`, `.env`, `da0bccda`, `80620aa4`, `444dce37` 등)가 「검사 면제 목록 SSOT」 섹션 본문에 문자열로 100% 명시되어 있는지 자동 대조·검증 (미등재 시 fail-closed 차단).
  3. `AGENTS.md` 규율 9에 면제 목록이 있는 검사 통과 시 면제 항목 및 사유 필수 명시 규율 추가.
- **자동 검사**: `scripts/lint_pipeline.py` -> `check_exemption_disclosure()`

---

## [FM-015] Missing Script Execution Entrypoint Prohibition (검사 스크립트 실행 지점 부재 차단)
- **발생 양상**: 데이터 정합성이나 가격 무결성을 검증하는 게이트 스크립트(`verify_*.py`, `validate_*.py` 등)를 작성하고 로컬에서 테스트까지 완료했으나, 이를 정기 자동화 CI 워크플로(`.github/workflows/**`), Git 훅(`.githooks/**`), 또는 상시 테스트 스위트(`scripts/tests/**`) 어디에도 연결하지 않아 프로덕션 환경에서 검사가 영구히 실행되지 않는 결함.
- **실제 관측 사례**: 2026-09-17 Step 84 차트 고도화 과정에서 `scripts/generate_series_v2.py` 및 `scripts/verify_split_adjustment.py`를 구현하고 무결성 게이트를 구축했으나, `daily-market.yml` 워크플로에 호출 스텝을 누락하여 1,172개 v2 시계열 파일이 수동 생성물로 방치되고 액면분할 감사가 CI에서 전혀 트리거되지 않았던 사건.
- **근본 원인**: "검사 로직을 만들었다"는 행위와 "그 검사가 실제 정기 실행되는 파이프라인 자리를 확보했다"는 행위를 분리 검증하지 않아 발생.
- **방어 대책**:
  1. `scripts/` 내 게이트성 스크립트(`verify_*.py`, `validate_*.py`, `audit_*.py`, `check_*.py`, `lint_*.py`)가 `.github/workflows/**`, `.githooks/**`, 또는 `scripts/tests/**` 중 최소 한 곳 이상에서 호출되는지 정적 분석하여 미호출 시 빌드/푸시 즉시 차단(fail-closed).
  2. 수동 전용 유틸리티나 연구 분석용 스크립트는 `SCRIPT_ENTRYPOINT_EXEMPT` 모듈 상수에 명시하고, FM-014에 의해 본 문서의 「검사 면제 목록 SSOT」 섹션에 사유와 함께 공개 의무화.
- **자동 검사**: `scripts/lint_pipeline.py` -> `check_script_entrypoint_presence()`

---

## [검사 면제 목록 SSOT]

| 검사명 | 면제 대상 | 사유 | 등록 일시 |
|---|---|---|:---:|
| **FM-011: Destructive Schema Migration Baseline Enforcement** | `0001`, `0002`, `0003`, `0004`, `0005`, `0006`, `0007`, `0008`, `0009`, `0010`, `0011`, `0012`, `0013`, `0014`, `0015`, `0016`, `0017`, `0018`, `0019`, `0020`, `0021`, `0022`, `0023`, `0024`, `0025`, `0026` | 0001~0024는 baseline 감사 인프라 도입 이전 레거시 마이그레이션이며, 0025는 migration_baselines 테이블 자체를 생성한 DDL이고, 0026은 0024 사후 정정 마이그레이션임. 0027 이후 DDL부터 엄격 강제. | 2026-09-17 |
| **FM-012: Working Tree Plaintext Secret Detection** | `android/app/google-services.json` | Firebase 공개 모바일 클라이언트 식별자 파일로, 보안 비밀키가 아닌 번들 식별자이므로 스캔 예외 허용. | 2026-09-17 |
| **FM-012: Working Tree Plaintext Secret Detection** | `.env`, `.dev.vars`, `.env.*`, `.dev.vars.*` | Cloudflare Worker 로컬 개발(wrangler dev) 및 Node 런타임 전용 설정 파일이며, .gitignore 및 .githooks/pre-commit(diff --cached)에 의해 저장소 커밋이 원천 차단됨. | 2026-09-18 |
| **FM-012: Working Tree Plaintext Secret Detection** | `SECRET_SCAN_DIR_EXEMPT`: `.git`, `node_modules`, `.next`, `out`, `.venv`, `__pycache__`, `coverage`, `.wrangler`, `dist` | 패키지 의존성/빌드 산출물/로컬 가상환경 캐시 디렉터리로, 정적 소스코드가 아니므로 작업 트리 평문 시크릿 탐지에서 제외. (_archive/ 및 OSMU_Archive/는 스캔 대상에 필수 포함). | 2026-09-18 |
| **FM-013: WIP Commit on Main Branch Prohibition** | `da0bccda` | `wip(compare): checkpoint step 84 working files on feat/compare-timeseries-chart` (2026-09-17 21:08:44 +0900). 기능 브랜치 역병합으로 main에 기포함된 과거 이력. | 2026-09-18 |
| **FM-013: WIP Commit on Main Branch Prohibition** | `80620aa4` | `wip(compare): integrate EtfCompareTimeseriesChart into CompareClient` (2026-09-17 20:33:48 +0900). 동일 기능 브랜치 작업 체크포인트 커밋으로 main에 기포함된 과거 이력. | 2026-09-18 |
| **FM-013: WIP Commit on Main Branch Prohibition** | `444dce37` | `wip(compare): save compare timeseries chart components to feature branch` (2026-09-17 20:29:43 +0900). 기능 브랜치 최초 생성 시점의 체크포인트 커밋으로 main에 기포함된 과거 이력. | 2026-09-18 |
| **FM-015: Missing Script Execution Entrypoint** | `SCRIPT_ENTRYPOINT_EXEMPT`: `validate_components_clean.py`, `verify_all_comparisons.py`, `verify_broker_pension.py`, `verify_kind_issue_summaries.py`, `verify_kofia_pension.py`, `verify_return_circuit_breaker.py` | 수동 점검 도구, 레거시 감사 도구(FM-004로 대체된 컴포넌트 검사 등), 또는 연구 보고서 전용 검증 산출물로 상시 CI 실행 대상에서 제외. | 2026-09-18 |

---

### [Stash 56건 아카이브 및 복원 SSOT]
2026-09-18 기준 소실되었던 56건의 Stash는 `archive/stash-00-<sha8>` ~ `archive/stash-55-<sha8>` 56개 불활성 태그로 고정되어 영구 보존(gc 면역)되었습니다. `git stash show -p`로 추출된 패치 파일은 untracked 파일을 포함하지 않으므로, **태그가 단일 진실 공급원(SSOT)이자 정본**입니다. 필요 시 개별 복원 명령은 `git stash store -m "<원본 메시지>" <태그의 SHA>`를 사용하며, `git gc`, `git prune`, `git reflog expire`의 임의 실행은 엄격히 금지됩니다.





