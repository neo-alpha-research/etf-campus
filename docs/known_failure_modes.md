# Known Failure Modes Catalog (SSOT)

이 문서는 ETF Campus 마켓 브리핑 및 OSMU 자동화 파이프라인에서 실제로 관측된 고유 실패 유형(Failure Modes)을 관리하는 단일 진실 공급원(SSOT)입니다.
`scripts/lint_pipeline.py`의 자동 검사항목(CHECKS) 수는 본 문서에 정의된 고유 실패 유형 수 이상이어야 하며, 미달 시 CI 파이프라인이 기계적으로 실패(FAIL)합니다.

---

## [FM-001] CI Git Shallow Clone History Loss
- **관측 사례**: CI 환경에서 `actions/checkout@v4` 기본값(`fetch-depth: 1`) 동작 시 `git log`를 통한 과거 커밋 스냅샷 조회가 불가능하여 펀드플로우 연산이 빈 배열(`[]`)을 반환한 사고.
- **근본 원인**: 런타임 연산이 Git 커밋 히스토리의 `subprocess` 호출에 의존함.
- **방어 대책**: 물리 경량 스냅샷(`data/snapshots/`) 파일 SSOT 구축, Git 히스토리 subprocess 폴백 완전 제거, CI `fetch-depth: 1` 원복.
- **자동 검사**: `scripts/lint_pipeline.py` -> `check_git_log_subprocesses()`

---

## [FM-002] Silent Module Import Swallowing (Fail-Open ImportError)
- **관측 사례**: CI 환경에서 `pydantic` 또는 필수 모듈 임포트 실패(`ImportError`) 시 `try-except`로 경고만 찍고 기본 체크로 넘어가 무검증 상태로 KV 업로드가 강행된 사고.
- **근본 원인**: 예외 발생 시 안전 정지(Fail-Closed)하지 않고 빈 데이터로 통과(Fail-Open)시킴.
- **방어 대책**: 임포트 실패 시 즉시 `sys.exit(1)` 또는 `return 1`로 프로세스를 차단.
- **자동 검사**: `scripts/lint_pipeline.py` -> `check_import_error_swallowing()`

---

## [FM-003] Pipeline Git Commit Artifact Exclusion
- **관측 사례**: 일별 정본 파일(`data/briefing_payload_*.json`)이 생성되었으나 워크플로 내 `git add` 목록에 누락되어 원격 저장소에 아카이빙되지 못한 문제.
- **근본 원인**: 워크플로 파일 목록 수동 관리 시 신규 아티팩트 패턴 누락.
- **방어 대책**: `daily-market.yml`의 `git add` 목록에 `briefing_payload_*.json`, `snapshots` 등 필수 정본 패턴 필수 포함 강제.
- **자동 검사**: `scripts/lint_pipeline.py` -> `check_daily_market_git_add()`

---

## [FM-004] Hardcoded Production Dates & Mock Literals
- **관측 사례**: 백필이나 디버깅을 위해 작성된 특정 날짜(`2026-09-16`) 및 하드코딩된 버전 문자열이 상시 CI 워크플로 및 프로덕션 스크립트에 연결되어 다음 날짜 실행 시 과거 데이터를 덮어쓰는 위험 발생.
- **근본 원인**: 일회성 도구가 `_oneoff`로 격리되지 않고 상시 파이프라인에 연결됨.
- **방어 대책**: `scripts/`, `components/`, `functions/`, `workers/` 전역에서 하드코딩된 날짜(`20\d\d-\d\d-\d\d`) 리터럴 탐지 및 차단 (단, `_oneoff/`, `tests/`, `migrations/`는 제외). 일회성 도구는 `scripts/_oneoff/`로 격리.
- **자동 검사**: `scripts/lint_pipeline.py` -> `check_hardcoded_dates_or_counts()`

---

## [FM-005] Dual Representation & Unmapped Identifiers
- **관측 사례**: 외부 수집 원시 티커(`^GSPC`, `KRW=X`)와 내부 정규 코드(`SPX`, `USDKRW`)가 여러 계층에서 제각각 매핑되어 D1 적재와 API 서빙 간 불일치 및 누락 발생.
- **근본 원인**: 식별자 변환 딕셔너리가 개별 스크립트에 파편화되어 있고 수집 직후 정규화되지 않음.
- **방어 대책**: `lib/indices.py`를 단일 SSOT로 확립하고, 수집 직후 정규화 수행 및 `CANONICAL_MACRO_CODES` 12대 지표 집합 일치 검증을 D1 적재와 API 전 계층에 강제.
- **자동 검사**: `scripts/lint_pipeline.py` -> `check_macro_indices_ssot()`

---

## [FM-006] Incomplete Migration Sequence & D1 Constraint Mismatch
- **관측 사례**: D1 스키마의 과거 `CHECK (index_code IN ('KOSPI', 'KOSDAQ'))` 제약으로 인해 10개 해외/거시 지표가 D1 적재에서 필터링되었으며, 마이그레이션 번호 중복 및 순서 오류 가능성 존재.
- **근본 원인**: D1 마이그레이션 번호 체계 미검증 및 스키마-코드 불일치.
- **방어 대책**: `migrations/` 디렉터리의 번호 연속성(0001, 0002 ...) 및 네이밍 정합성 자동 검증.
- **자동 검사**: `scripts/lint_pipeline.py` -> `check_migrations_sequence()`
