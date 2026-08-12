# API 키 설정 및 월간 발행 실행 가이드

이 프로젝트는 금융위원회 공공데이터포털 서비스 키를 `DATA_GO_KR_SERVICE_KEY` 환경변수로만 읽는다. 실제 키를 `.py`, `.csv`, `.md`, PDF, Git 커밋에 넣지 않는다.

## 1. 현재 PowerShell 창에서만 설정하기 (권장)

아래의 `발급받은_일반인증키` 부분만 실제 키로 바꾼다. 이 설정은 현재 PowerShell 창을 닫으면 사라진다.

```powershell
$env:DATA_GO_KR_SERVICE_KEY = '발급받은_일반인증키'
```

정상 설정 확인은 키의 값이 아니라 존재 여부만 확인한다.

```powershell
if ($env:DATA_GO_KR_SERVICE_KEY) { 'API 키 설정됨' } else { 'API 키 없음' }
```

## 2. Windows 사용자 환경변수로 저장하기 (선택)

매번 입력하기 어렵다면 아래처럼 등록한다. 등록 뒤에는 새 PowerShell 창을 열어야 적용된다.

```powershell
setx DATA_GO_KR_SERVICE_KEY "발급받은_일반인증키"
```

공용 PC이거나 여러 사람이 접근하는 계정에서는 이 방식 대신 1번의 임시 설정을 사용한다.

## 3. 월간 발행 실행 순서

프로젝트 폴더에서 실행한다.

```powershell
cd D:\ETFCampus

# 1) 이번 달 기준일에 맞게 필요 시 수집 스크립트의 날짜를 갱신한 뒤 실행
python scripts\collect_income_page2_prices.py
python scripts\collect_page3_prices.py
python scripts\calculate_page3_metrics.py

# 2) 운용사 공식 공시를 대조해 분배금·보유종목 CSV를 갱신
#    - income_page2_distribution_ledger.csv
#    - page3_holdings_raw_collection.csv

# 3) PDF 3페이지 생성 및 병합
python scripts\create_lead_magnet_page1.py
python scripts\create_lead_magnet_page2.py
python scripts\create_lead_magnet_page3.py
python scripts\merge_lead_magnet_pdf.py
```

최종 파일은 다음 위치에 생성된다.

```text
output\pdf\etf-campus-3-page-etf-lead-magnet.pdf
```

## 4. 실행 후 확인

```powershell
python -c "from pypdf import PdfReader; print(len(PdfReader('output/pdf/etf-campus-3-page-etf-lead-magnet.pdf').pages))"
```

출력이 `3`이면 페이지 수가 정상이다. 이후에는 운영 매뉴얼의 발행 전 체크리스트에 따라 기준일·출처·각주·잘림 여부를 확인한다.

## 5. 키 보안 주의

- 키를 캡처·채팅·이메일·커밋에 올렸다면 재발급 후 기존 키를 폐기하는 것이 안전하다.
- 키를 화면에 붙여넣은 뒤에는 터미널 기록이나 스크린샷 공유 범위를 점검한다.
- 서비스 키를 포함한 `.env` 파일을 만들었다면 반드시 Git 추적 대상에서 제외한다.
