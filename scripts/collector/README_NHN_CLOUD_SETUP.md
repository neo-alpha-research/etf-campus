# NHN Cloud & n8n 기반 KOFIA DIS 월간 ETF 실부담비용 전수 수집 가이드

이 문서는 **NHN 클라우드(국내 고정 공인 IP) 가상 서버**와 **n8n 자동화 워크플로우 엔진**을 활용하여, 금융투자협회(KOFIA DIS) 전자공시에서 국내 상장 1,160+개 ETF 전체의 **명목총보수, 기타비용, 총비용비율(TER), 매매·중개수수료율**을 매월 무인 자동으로 수집·검증하고 GitHub 레포지토리에 푸시하는 절차를 설명합니다.

---

## 🏛️ 왜 NHN 클라우드 + n8n 인가?

1. **국내 고정 IP (Pangyo/Gwangju)**:
   - 해외 클라우드(GitHub Actions, AWS US, Azure)의 IP는 KOFIA 보안 방화벽(WAF)에서 비인가 봇으로 탐지되어 차단(403/Timeout)됩니다.
   - NHN 클라우드의 국내 공인 IP는 공시 사이트의 차단 리스크가 제로(0)입니다.
2. **실행 시간 무제한 (No Timeouts)**:
   - 1,160개 ETF의 WebSquare 그리드 조회 및 패킷 파싱 작업을 타임아웃 없이 안정적으로 완주합니다.
3. **무결성 서킷브레이커 (Zero-Hallucination)**:
   - 수집 완료 후 3분해 커버리지 및 최소 유니버스(900개 이상)를 자동 검증하여, 이상 발생 시 GitHub 덮어쓰기를 자동 차단합니다.

---

## ⚙️ 1. NHN Cloud 서버 기본 셋업 (5분 완성)

### 1-1. 인스턴스 사양 권장
* **OS**: Ubuntu 22.04 LTS / 24.04 LTS
* **스펙**: u2.c2m4 (vCPU 2코어, Memory 4GB 이상 권장)
* **네트워크**: 공인 고정 IP 연결 및 아웃바운드 80, 443 허용

### 1-2. 필수 런타임 설치 (SSH 접속 후 터미널 1회 실행)
```bash
# 1. 패키지 업데이트 및 기본 도구
sudo apt update && sudo apt install -y python3-pip python3-venv git curl

# 2. 작업 디렉토리 생성
sudo mkdir -p /opt/etf-collector
sudo chown -R $USER:$USER /opt/etf-collector
cd /opt/etf-collector

# 3. 파이썬 가상환경 및 Playwright 설치
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install playwright

# 4. Playwright Headless Chromium 브라우저 및 시스템 의존성 설치
playwright install --with-deps chromium
```

### 1-3. 스크립트 및 기준 파일 배치
레포지토리의 다음 파일들을 `/opt/etf-collector/`에 복사합니다:
* `kofia_fee_collector.py`
* `data/etf_master_draft.csv` (기준 마스터 파일)
* `data/fees/etf_fee_registry.json` (기존 레지스트리 파일)

```bash
# 단독 수집 테스트 실행 (Dry-run)
python3 kofia_fee_collector.py --registry etf_fee_registry.json --master etf_master_draft.csv --dry-run
```

---

## 🔄 2. n8n 워크플로우 등록 절차

### 2-1. 워크플로우 가져오기 (Import)
1. n8n 웹 대시보드 접속 ➔ 좌측 상단 **Workflows** ➔ **Add workflow** 클릭
2. 우측 상단 메뉴(`...`) ➔ **Import from File** 선택
3. `scripts/collector/n8n_kofia_fee_workflow.json` 파일 선택

### 2-2. 노드별 환경설정 연결
1. **GitHub 노드 (`GitHub Push`)**:
   - **Credential**: GitHub Personal Access Token (PAT) 연결
   - **권한(Scope)**: `repo` (Contents Read & Write)
   - **Repository**: `neo-alpha-research/etf-campus`
   - **Path**: `data/fees/etf_fee_registry.json`
2. **텔레그램 노드 (`Telegram Alert` - 선택사항)**:
   - 본인의 텔레그램 봇 토큰 및 Chat ID 입력 (또는 슬랙 웹훅으로 교체 가능)

### 2-3. 스케줄 활성화 (Activate)
* **실행 주기**: 매월 16일 새벽 03:00 KST (`0 3 16 * *`)
  *(금융투자협회 DIS의 전월 기준 비용 공시가 매월 10~15일경 최종 마감되므로 16일 새벽이 최적의 수집 시점입니다)*
* 워크플로우 우측 상단의 **Active 토글을 ON**으로 켜면 모든 설정이 완료됩니다.

---

## 📊 결과 및 기대 효과
* 수집이 완료되면 GitHub `neo-alpha-research/etf-campus`에 자동으로 커밋이 생성됩니다:
  `chore(fees): monthly KOFIA DIS ETF fee sync [skip ci] (3-tier coverage 92.4%)`
* 커밋이 반영되는 즉시 Cloudflare Pages가 최신 실부담비용 데이터로 전체 1,223개 정적 페이지를 무중단 빌드 배포합니다.
