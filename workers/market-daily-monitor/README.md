# Market Daily Monitor (Cloudflare Worker)

이 Worker는 매일(화~토) KST 14:15에 실행되어 Market Briefing API가 어제(영업일) 일자로 최신화되어 정상 서빙되고 있는지 감시합니다.
만약 데이터가 지연되거나 검증(Validation) 단계에서 누락된 필드가 있다면 GitHub에 자동으로 Issue를 생성합니다.

## 배포 절차

이 Worker는 인프라 종속성(SPOF) 방지를 위해 GitHub Actions로 자동 배포하지 않으며, **수동 배포를 원칙**으로 합니다. (판정 로직이 변경될 때만 배포)

```bash
cd workers/market-daily-monitor
npm install
npm run deploy
```
*(Wrangler 인증이 되어 있어야 합니다)*

## 🚨 휴장일 목록 동기화 주의 🚨

이 Worker 내부의 `src/market_holidays.txt`는 판정 로직에 직접 사용되는 **번들 사본**입니다.
메인 저장소에서 새 휴장일이 추가/변경되어 원본(`data/market_holidays.txt`)이 바뀌면, 이 Worker도 반드시 **수동으로 재배포(`npm run deploy`)**되어야 새로운 휴장일을 인식할 수 있습니다.
*(GitHub API 호출 의존성을 줄이고 Worker 자체의 판정 안정성을 높이기 위해 네트워크를 타지 않고 로컬 사본을 사용합니다.)*

단, **운영자가 수동 재배포를 잊을 경우를 대비해, Worker가 실행 시점마다 공개된 원본(`https://etf-campus.pages.dev/data/market_holidays.txt`)을 가져와 사본과 비교하고, 불일치 시 자동으로 "휴장일 목록 동기화 필요" Issue를 생성**합니다. Issue 알림을 받으시면 즉시 수동 재배포를 수행해 주십시오.

## 필수 시크릿 (Secret)

이 Worker는 두 가지 인증 키를 사용합니다.

1.  **MONITOR_GITHUB_TOKEN**: GitHub Issue를 생성하고 코멘트를 달기 위한 토큰
2.  **KRX_OPEN_API_KEY**: 프로브 기능이 한국거래소(KRX) API를 호출하기 위한 인증 키

```bash
npx wrangler secret put MONITOR_GITHUB_TOKEN
npx wrangler secret put KRX_OPEN_API_KEY
```

### 토큰 발급 및 설정 방법
1. GitHub 우측 상단 프로필 > **Settings** > **Developer settings** > **Personal access tokens** > **Fine-grained tokens** > `Generate new token` 클릭
2. **Token name:** `cf-worker-market-daily-monitor`
3. **Expiration:** 최대 기한 설정 **(중요: 발급 후 아래 '토큰 만료 예정일' 란에 반드시 기록)**
4. **Resource owner:** 해당 저장소 소유자 (조직/계정)
5. **Repository access:** `Only select repositories` 선택 후 `neo-alpha-research/etf-campus` 단일 지정
6. **Repository permissions:** **`Issues` 항목을 `Read and write`로 설정** (나머지는 No access)
7. 발급된 토큰을 위 `wrangler secret put` 명령어에 입력합니다.

## 🚨 토큰 만료 예정일 관리 🚨

> GitHub Fine-grained PAT는 만료 기한이 존재합니다. 만료일이 지나면 Worker가 Issue를 생성하지 못하고 `401 Unauthorized` 에러를 남긴 채 조용히 실패합니다. 토큰을 갱신할 때마다 아래 만료일을 업데이트해 주십시오.

*   **현재 사용 중인 토큰 만료 예정일: `[여기에 날짜를 입력하세요 - 예: 2027-08-25]`**

## 로컬 테스트 (Cron Trigger 시뮬레이션)

```bash
npm run dev
# 터미널에 주소가 뜨면 브라우저 또는 curl로 아래 엔드포인트 호출
curl http://localhost:8787/__scheduled
```

## 프로브 기능 중단 안내

현재 이 Worker는 감시 기능(KST 14:15 1회) 외에 데이터 최초 공개 시각 측정을 위한 **프로브 기능(KST 05:00~13:00, 15분 간격)**을 겸하고 있습니다.
> **⚠️ 운영 주의:** 프로브 기능은 상시 가동용이 아닙니다. **2026년 9월 8일 (2주 후)경 측정이 완료되면 프로브용 크론(`*/15 ...`)을 wrangler.toml에서 제거해 주십시오.**

