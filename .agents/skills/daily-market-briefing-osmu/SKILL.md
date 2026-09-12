---
name: daily-market-briefing-osmu
description: "매일 아침 마켓 브리핑 데이터를 기반으로 인스타그램 6장, 스레드 1장, 이메일 뉴스레터를 원클릭으로 렌더링하고 Cloudflare KV 업로드 및 3대 채널 동시 배포를 수행하는 전사 표준 OSMU 발행 스킬 가이드입니다."
---

# 데일리 마켓 브리핑 OSMU 원클릭 통합 발행 스킬 가이드

본 문서는 매일 아침 전 거래일 마감 데이터와 Gemini 시황 문구가 준비되었을 때, **별도의 레이아웃 수동 조정 없이 단 하나의 동작으로 3개 채널(Threads, Instagram 6장 캐러셀, Email 뉴스레터)을 픽셀 퍼펙트로 동시 발행**하기 위한 전사 단일 진실 공급원(SSOT) 표준 절차입니다.

---

## 1. 일일 무결점 운영 파이프라인 (Daily Operating Flow)

### A. 화~금요일 아침 (월~목 거래일 대상): 적재 즉시 자동 발행
```
[07:50~08:40 KST] daily-market.yml
       │ (KRX Open API 시세 수집 및 D1/웹페이지 반영)
       ▼
[자동 연쇄 실행] generate-osmu.yml
       │ (인스타 6장, 스레드 1장, 뉴스레터 렌더링 및 KV 업로드)
       │ (3대 채널 즉시 자동 배포: Threads, Instagram, Newsletter)
       ▼
[텔레그램 알림] "🎉 [ETF CAMPUS] 마켓 브리핑 3대 채널 자동 발행 완료"
```

### B. 토요일 아침 (금요일 거래일 대상): 데이터 적재 및 OSMU 사전 준비 (발행 보류)
```
[07:50~08:40 KST] daily-market.yml
       │ (금요일 종가 KRX 수집 및 D1/웹페이지 반영)
       ▼
[자동 연쇄 실행] generate-osmu.yml
       │ (인스타 6장, 스레드 1장, 뉴스레터 렌더링 및 KV 업로드 완료)
       │ (Weekend Standby: 주말 SNS 노이즈 방지를 위해 소셜 발행 보류)
       ▼
[텔레그램 알림] "✨ [ETF CAMPUS] 금요일 마켓 브리핑 & OSMU 준비 완료 (월요일 07:30 자동 발행 예정)"
       │ (필요 시 대시보드에서 검토 후 '즉시 발송' 가능)
```

### C. 월요일 아침 07:30 KST: 금요일 마켓 브리핑 정각 자동 배포
```
[07:30 KST 정각] generate-osmu.yml (스케줄: Sunday 22:30 UTC)
       │ (토요일에 이미 완벽히 준비된 금요일 브리핑 및 KV 에셋 로드)
       │ (3대 채널 정각 자동 배포: Threads, Instagram, Newsletter)
       ▼
[텔레그램 알림] "🎉 [ETF CAMPUS] 마켓 브리핑 3대 채널 자동 발행 완료"
```

---

## 2. 전제 조건 및 아키텍처 원칙 (Core Directives)

1. **단일 진실 공급원 (SSOT)**:
   - 모든 시각 산출물(인스타그램 6장, 스레드 1장, 이메일)은 `workers/market-briefing-distributor` 내의 표준 템플릿 엔진을 통해서만 생성됩니다.
2. **Zero-Overflow 템플릿 강제**:
   - 종목명/테마명이 길어지더라도 카드 테두리를 넘치지 않도록 `fitAndClampText` 동적 스케일링과 SVG `clipPath`가 상시 적용되어 있습니다. 임의의 폰트 크기 하드코딩을 금지합니다.
3. **ETF 캠퍼스 공식 표준 풋터 준수**:
   - 모든 슬라이드 및 인포그래픽 하단에는 자본시장법 제101조 면책 문구와 표준 라운드 배너(`🔍 DC/IRP, 연금저축, ISA 계좌별 ETF 비교 분석 최적화 | 📊 ETF 캠퍼스 etf-campus.pages.dev`)가 텍스트+이모지로만 렌더링되어야 합니다.
4. **브리핑 문장 작성 규칙 준수**:
   - 시황 요약 본문에서 괄호 `()` 사용 절대 금지.
   - 피어그룹 부연 괄호는 `formatThemeForSummary`를 통해 자동 정제.

---

## 3. 원클릭 실행 커맨드 (One-Click Commands)

작업자는 루트 디렉토리(`d:\ETFCampus`)에서 아래 명령어 중 목적에 맞는 명령 하나만 실행합니다:

### A. 3대 채널 원클릭 동시 발행 (Recommended CLI)
터미널에서 1줄 명령으로 Threads, Newsletter, Instagram 3개 채널 동시 발행:
```bash
npm run briefing:distribute
```
*(특정 날짜를 명시하여 발행하는 경우: `npm run briefing:distribute -- 2026-09-09`)*
*(이미 발행된 건을 강제 재발행하는 경우: `npm run briefing:distribute -- 2026-09-09 --force`)*

### B. 시각 산출물 사전 검수 (Render Only)
KV 업로드나 배포 없이 로컬 아카이브(`OSMU_Archive/{date}/`)에 PNG/SVG/HTML만 생성하여 검수할 때:
```bash
npm run briefing:render
```
*(특정 날짜 지정: `npm run briefing:render -- --date=2026-09-09`)*

### C. Cloudflare KV 자산 동기화 (Sync Only)
이미 렌더링된 이미지만 Cloudflare KV로 다시 업로드할 때:
```bash
npm run briefing:sync
```

---

## 4. 5단계 무결성 점검 체크리스트 (5-Point Checklist)

발행 전후로 아래 5대 전문가 검증 항목을 확인합니다:

1. **[Design] 수직 레이아웃 균형 (Vertical Cadence)**:
   - 슬라이드 2~5의 핵심 요약 배너 배경이 순수 화이트(`#FFFFFF`)인지 확인.
   - 슬라이드 3의 상위/하위 랭킹 화살표 및 수치 간격이 겹치지 않고 정돈되었는지 확인.
   - 슬라이드 5의 고평가 - 저평가 - 실전가이드 - 면책 황금비율 유지 여부.
2. **[Data] 종목 및 수치 무결성 (Zero Hallucination)**:
   - 결측치 시 그레이스풀 폴백(`정상 범위 호가 유지` 등) 노출 확인. 임의의 가짜 ETF나 추정치 삽입 금지.
3. **[Rendering] Chromium 렌더러 픽셀 퍼펙트**:
   - Windows Chrome 엔진(`chrome.exe`)을 통해 이모지와 한글 글꼴(Pretendard)이 깨짐 없이 선명하게 렌더링되었는지 확인.
4. **[Cloudflare] KV 키 네이밍 규격**:
   - 인스타그램: `image:instagram:{YYYY-MM-DD}:{1..6}`
   - 스레드: `image:threads:{YYYY-MM-DD}`
5. **[Compliance & Meta API] 자본시장법 제101조 및 발행 상태**:
   - 대시보드 상단 배지 확인: `✅ 서킷브레이커 정상`, `✅ 스레드 발행완료`, `✅ 인스타 발행완료`, `✅ 뉴스레터 준비완료`.
