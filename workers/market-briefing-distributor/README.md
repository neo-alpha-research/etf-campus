# Market Briefing Distributor Worker

ETF Campus 데일리 마켓 브리핑을 3대 채널(Instagram, Threads, Newsletter)로 멀티 포맷 가공 및 발행하는 Cloudflare Worker 서비스입니다.

---

## 1. 핵심 아키텍처 & OSMU 템플릿

| 모듈 경로 | 산출물 | 핵심 디자인 및 레이아웃 표준 (2026-09-04 확립) |
| :--- | :--- | :--- |
| `src/templates/instagram.ts` | Instagram 6장 캐러셀 SVG | • **Slide 1**: 옵션 A (정통 카드뉴스 표지형 + 44px 빅 넘버 + 3대 펄스 고대비)<br>• **Slide 2**: 테마 Top 3 랭킹 (주도 38px 레드 / 부진 38px 블루 패널)<br>• **Slide 3**: 6대 자산군 순자산 비중 바 게이지 + 40px 가중수익률<br>• **Slide 4**: 수급 Top 5 (`cleanEtfNameForBanner` + 글자수 기반 `calcBannerFontSize` 오버플로우 영구 방어)<br>• **Slide 5**: **🔴 고평가(할증) vs 🟢 저평가(할인) 상하 2단 분할** (38px 대형 수치 + 실전 팁)<br>• **Slide 6**: 요일별 인터랙티브 CTA & KRX 공시 데이터 고지 |
| `src/templates/threads.ts` | Threads 텍스트 + 단독 1장 슈퍼 인포그래픽 | • **최소 폰트 17.5px 이상 보장** (모바일 타임라인 축소 썸네일 식별)<br>• **1x2 테마 영웅 카드** (상승 1위 vs 하락 1위 대형화, **36px 대형 볼드 등락률**)<br>• 스마트머니 1위 대형 분리 (+857억원 30px 볼드)<br>• 괴리율 수치 28px 대형화 |
| `src/templates/newsletter.ts` | 이메일 뉴스레터 HTML | • **Gmail 앱 100% 호환을 위한 순수 `<table>` 레이아웃** (`display: flex` 절대 금지) |

---

## 2. 텍스트 오버플로우 방어 2대 원칙 (영구 준수)

긴 종목명(예: `KODEX 종합채권(AA-이상)액티브`)이 인입되더라도 박스를 삐져나가지 않도록 아래 함수를 필수로 거쳐야 합니다:

1. `cleanEtfNameForBanner(name, maxChars)`: `(AA-이상)액티브`, `(합성)` 등 가독성을 해치는 괄호 부가설명을 자동 정제.
2. `calcBannerFontSize(text, maxWidthPx, baseFs)`: 전체 글자수 비례 폰트 크기를 26px $\to$ 22px $\to$ 18px로 동적 축소.

---

## 3. 데일리 운영 및 배포 워크플로우

1. **배치 및 수신**: 매 거래일 아침 07:50~08:40 n8n 스마트 프로빙을 통한 데이터 수집 완료 후, GitHub Actions(`daily-market.yml` -> `validate_briefing_gate.py` -> `market-briefing-production.yml`) 및 `market-briefing-publisher`를 통해 Cloudflare D1 및 KV에 적재됩니다. 이후 Cloudflare Queue(`etf-campus-market-briefing-distribute`)를 통해 배포 준비 이벤트가 자동 전달됩니다.
2. **리뷰 대시보드 검증 (Human-in-the-Loop)**:
   * URL: `https://market-briefing-distributor.neo-alpha-research.workers.dev/preview?date=YYYY-MM-DD`
   * 슬라이드별 가독성 및 텍스트 넘침 유무 육안 확인.
3. **템플릿 수정 및 핫픽스**:
   ```bash
   # 타입 체크
   npm run typecheck

   # Cloudflare Worker 즉시 배포 (약 4초 소요)
   npx wrangler deploy

   # GitHub main 브랜치 동기화
   git commit -am "fix(template): ..."
   git push origin main
   ```
4. **발행 실행**: 대시보드에서 [인스타그램 발행] / [스레드 발행] 실시간 트리거 (Meta Graph API 직접 연동) 및 Cloudflare D1 `briefing_distribution_logs`에 최종 배포 상태(`distributed`) 기록.
