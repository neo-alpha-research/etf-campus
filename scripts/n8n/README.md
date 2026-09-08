# NHN Cloud n8n 스마트 프로빙 및 텔레그램 알림 가이드

이 디렉토리는 GitHub Actions의 글로벌 Cron 지연(3~15분)을 극복하고, **NHN Cloud 인스턴스에 호스팅된 n8n을 통해 07:50~08:40 KST 사이 5분 단위로 원천 데이터를 점검하여 즉시 적재를 가동하고, OSMU 생성 완료 시 텔레그램으로 자동 리포트를 발송**하기 위한 워크플로우 명세 및 연동 가이드입니다.

---

## 1. 아키텍처 개요

```text
[NHN Cloud Linux Instance (n8n)]
       │
   (n8n Cron) 07:50 ~ 08:40 KST (화~토, 5분 간격)
       │
       ▼
 1) [Check GitHub Actions Runs] ───▶ 최근 실행 내역 조회
       │
       ▼
 2) [Evaluate Status (Code Node)] ─┬─▶ 오늘(KST) 이미 성공 완료됨? ──▶ [Skip (조용히 종료)]
                                  ├─▶ 현재 러너 실행/대기 중? ──────▶ [Skip (조용히 종료)]
                                  └─▶ 아직 미적재 상태?
                                        │
                                        ▼ (발사!)
 3) [Trigger daily-market.yml] ────▶ [GitHub Actions Runner 기동 (0초)]
                                        │
                                        ├─▶ Pre-flight Guard (check_source_ready.py)
                                        │     ├─ KRX 미개방: 15초 내 조용히 릴리즈 (다음 5분 틱 대기)
                                        │     └─ KRX 개방 확인: 즉시 전수 적재 및 검증 실행
                                        │
                                        ▼
 4) [Push to main & Production Deploy] (market-briefing-production.yml)
       │
       ├─ D1 마이그레이션 & Cloudflare Pages 최신 배포
       ├─ OSMU 에셋 자동 생성 (인스타그램 캐러셀 + 스레드 텍스트/이미지 + 뉴스레터)
       │
       ▼ (완료 즉시 발송!)
 5) [Send Telegram Notification] (notify_telegram_osmu.py)
       │
       ▼
 📱 [사용자/채널 텔레그램] ──▶ 마켓 브리핑 요약 텍스트 + 고해상도 그래픽 카드 이미지 수신!
```

---

## 2. n8n 스마트 프로빙 워크플로우 적용 방법

1. **n8n 대시보드 접속** (예: `http://<NHN_CLOUD_IP>:5678`)
2. **Workflows** 메뉴에서 **Import from File** 선택 후 [`daily_market_probing_workflow.json`](daily_market_probing_workflow.json) 업로드.
3. **Credentials 설정**:
   - `Header Auth` 생성:
     - Credential Name: `GitHub PAT Authorization (Bearer YOUR_TOKEN)`
     - Header Name: `Authorization`
     - Header Value: `Bearer <GITHUB_PERSONAL_ACCESS_TOKEN>` (권한: `repo` 또는 `actions:write`)
4. 워크플로우를 **Active**로 전환.

### 스케줄 크론 명세
- `50,55 7 * * 2-6` (07:50, 07:55 KST, 화~토)
- `0,5,10,15,20,25,30,35,40 8 * * 2-6` (08:00 ~ 08:40 KST, 화~토, 5분 간격)
- 워크플로우 타임존: `Asia/Seoul` (KST 기준)

---

## 3. OSMU 완료 텔레그램 알림 연동 방법

배포 파이프라인(`market-briefing-production.yml`)의 OSMU 생성이 끝나면, GitHub Actions가 자동으로 텔레그램 봇 API를 통해 당일 브리핑 요약문과 그래픽 카드를 발송합니다.

### 텔레그램 봇 토큰 및 채널 ID 설정 (GitHub Repository Secrets)

1. **텔레그램 봇 생성**:
   - 텔레그램에서 `@BotFather` 검색 후 `/newbot` 입력.
   - 봇 이름 및 유저네임 지정 후 발급되는 **HTTP API Token** 복사.
2. **채팅방/채널 ID 확인**:
   - 개인 채팅으로 받을 경우: `@userinfobot`과 대화하여 나의 유저 ID(숫자) 확인.
   - 채널/그룹으로 받을 경우: 채널을 개설하고 생성한 봇을 관리자(Admin)로 추가한 뒤, 채널 ID(예: `-100xxxxxxxxxx` 또는 `@채널이름`) 확인.
3. **GitHub Secrets 등록**:
   - GitHub Repository (`etf-campus`) -> **Settings** -> **Secrets and variables** -> **Actions** 이동.
   - **Repository secrets**에 다음 2개 등록:
     - `TELEGRAM_BOT_TOKEN`: 1단계에서 발급받은 봇 토큰 (예: `123456789:ABCdef...`)
     - `TELEGRAM_CHAT_ID`: 2단계에서 확인한 채팅방/채널 ID (예: `123456789` 또는 `-1001234567890`)

> [!NOTE]
> `TELEGRAM_BOT_TOKEN` 또는 `TELEGRAM_CHAT_ID`가 등록되지 않은 상태에서는 빌드가 실패하지 않고 안내 로그만 남긴 뒤 안전하게 통과(Graceful Fallback)합니다.

---

## 4. 이중 중복 실행 방지(Double-Lock Guard) 메커니즘

- **1차 락 (n8n 레이어)**:
  - 매 5분 틱마다 GitHub API를 조회하여, 오늘(KST) 이미 완료된 `conclusion: success` 실행이 있거나, 현재 러너가 실행 중(`in_progress`, `queued`)인 경우 GitHub Actions 호출 자체를 중단(Skip)합니다.
- **2차 락 (GitHub Actions 레이어)**:
  - `daily-market.yml`의 `Pre-flight check & Guard` 단계에서 오늘 이미 성공한 이력이 있으면 5초 이내에 `skip=true`로 정상 종료합니다.
  - 당일 데이터를 강제로 다시 적재해야 할 때는 GitHub Actions 수동 실행 창에서 `force: true`를 체크하거나 특정 기준일(`target: YYYYMMDD`)을 입력하면 가드를 통과할 수 있습니다.
