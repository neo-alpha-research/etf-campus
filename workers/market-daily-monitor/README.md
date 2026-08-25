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

## 필수 시크릿 (Secret)

GitHub Issue를 생성하고 코멘트를 달기 위한 토큰이 필요합니다.

```bash
npx wrangler secret put MONITOR_GITHUB_TOKEN
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
