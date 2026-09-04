# Regulatory Data Catalog & Verification Framework (data/regulatory/)

이 디렉토리는 퇴직연금감독규정 제12조 준수 여부 및 운용사/증권사 공시 데이터 검증을 위한 데이터셋과 산출물을 보관합니다.

---

## 1. 파일 목록 및 현재 운용 상태

### 1-1. `broker_pension_universe.csv`
- **용도**: 주요 증권사(미래에셋, 한국투자, KB 등) 및 운용사에서 공식 공시한 퇴직연금 편입 가능 ETF 및 한도(100% 안전자산, 70% 위험자산) 실측 내역을 기록하는 그릇입니다.
- **연계 스크립트**: `scripts/rules/verify_broker_pension.py`
- **현재 상태 (2026-09-05 기준)**:
  - 증권사별 비표준 웹 크롤링 파이프라인은 운영 복잡도 및 회색지대 규모 대비 비효율로 보류(Phase 2/3 보류)되었습니다.
  - 현재는 `pension_verified` 축의 **수동 공시 데이터 채움 그릇**으로 유지됩니다.
  - 향후 운용사 공식 공시 또는 개별 증권사 유니버스 실측 결과가 확보되면 이 파일에 누적 관리합니다.
  - **주의**: 매일 실행되는 정기 CI/CD 파이프라인(`.github/workflows/holdings-audit.yml`)과 직접 연결되지 않으며 독립 파일로 보존됩니다. 임의로 삭제하지 마십시오.

### 1-2. `verify_broker_pension.py` (`scripts/rules/`)
- **용도**: `broker_pension_universe.csv`의 공시 내역을 `data/etf_master_draft.csv`와 교차 대조하여 검증 여부(`pension_verified = 'Y'`) 및 신뢰도 등급(`pension_confidence = '높음'`)을 갱신하는 배치 스크립트입니다.
- **현재 상태**: 수동 실행 용도로 보존되며 정기 CI 워크플로에는 포함되지 않습니다.

### 1-3. `holdings_measured_composition.csv` (Git 커밋 제외, CI Artifact 전용)
- **용도**: ETF Campus Holdings API(Cloudflare D1)에서 전 종목의 최신 구성종목(Holdings)을 전수 수집하여 7대 자산군(equity, bond, reit, commodity, cash, derivative, unknown) 비중을 실측한 1,167행의 전수 데이터셋입니다.
- **생성 주체**: `scripts/rules/audit_holdings_composition.py` (매 영업일 익일 02:17 KST 정기 실행)
- **보존 정책**:
  - **Git 커밋 금지**: 매일 커밋 시 연간 85MB(233KB/일)의 저장소 비대화가 발생하므로 `.gitignore`에 등록되어 있습니다.
  - **Artifact 업로드**: GitHub Actions `holdings-audit.yml`을 통해 30일간 다운로드 가능한 빌드 아티팩트로만 보존됩니다.

---

## 2. 규정 준수 및 유지보수 원칙
1. **임의 삭제 금지**: `broker_pension_universe.csv`는 향후 증권사 연계 재개 시 핵심 기준선이 되므로 절대 삭제하지 마십시오.
2. **독립성 유지**: 본 디렉토리의 증권사 검증 파일들은 일별 홀딩스 실측 감시 체계(`audit_holdings_composition.py`)와 분리하여 관리합니다.
