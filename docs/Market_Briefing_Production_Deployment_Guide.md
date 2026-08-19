# ETF Campus 마켓 브리핑 — Production 배포 및 시크릿 등록 가이드

## 적용 범위

이 가이드는 다음의 분리된 Worker를 production에 배포하는 절차입니다.

| Worker | production 이름 | 책임 | API 시크릿 |
| --- | --- | --- | --- |
| 수집기 | `market-data-collector` | ETF·KOSPI·KOSDAQ 원천 수집, D1 snapshot, readiness 기록 | `DATA_GO_KR_SERVICE_KEY` 필요 |
| 발행기 | `market-briefing-publisher` | ready snapshot 기반 브리핑 계산, 공개 D1 row, KV cache | **설정 금지** |

> **중요**: 기존 `market-briefing-ingestor`는 새 Worker 두 개의 검증이 끝날 때까지 유지합니다. 새 collector와 publisher가 정상 동작한 뒤에만 기존 Worker를 중지하거나 삭제합니다.

## 0. PowerShell 준비 및 Cloudflare 인증

아래 명령은 Windows PowerShell에서 실행합니다. `wrangler whoami`가 올바른 Cloudflare 계정을 표시해야 합니다.

```powershell
cd D:\ETFCampus
npx wrangler login
npx wrangler whoami
```

Wrangler는 프로젝트 로컬 설치를 `npx wrangler`로 실행하는 방식을 지원합니다.[1]

각 Worker에 설치된 의존성과 정적 검사를 먼저 확인합니다.

```powershell
cd D:\ETFCampus\workers\market-data-collector
npm install
npm run typecheck

cd D:\ETFCampus\workers\market-briefing-publisher
npm install
npm run typecheck
```

## 1. Production KV namespace 생성 및 ID 반영

두 Worker와 Pages API는 **동일한 production KV namespace**를 사용합니다. collector는 source circuit breaker 상태를, publisher와 Pages API는 공개 briefing payload를 서로 다른 key prefix로 사용합니다.

```powershell
cd D:\ETFCampus\workers\market-data-collector
npx wrangler kv namespace create BRIEFING_KV
```

출력되는 `id`를 복사해 아래 세 파일의 `REPLACE_WITH_PRODUCTION_KV_NAMESPACE_ID`를 **같은 값**으로 모두 교체합니다.

| 파일 | binding |
| --- | --- |
| `D:\ETFCampus\wrangler.toml` | Pages API용 `BRIEFING_KV` |
| `D:\ETFCampus\workers\market-data-collector\wrangler.toml` | circuit breaker용 `BRIEFING_KV` |
| `D:\ETFCampus\workers\market-briefing-publisher\wrangler.toml` | 공개 payload cache용 `BRIEFING_KV` |

PowerShell에서 다음 명령으로 세 파일을 한 번에 치환할 수 있습니다. `<production-kv-namespace-id>`는 방금 생성된 실제 UUID로 바꿉니다.

```powershell
$prodKvId = "<production-kv-namespace-id>"
$files = @(
  "D:\ETFCampus\wrangler.toml",
  "D:\ETFCampus\workers\market-data-collector\wrangler.toml",
  "D:\ETFCampus\workers\market-briefing-publisher\wrangler.toml"
)
foreach ($file in $files) {
  (Get-Content -Raw $file).Replace("REPLACE_WITH_PRODUCTION_KV_NAMESPACE_ID", $prodKvId) |
    Set-Content -NoNewline $file
}
```

## 2. Collector endpoint 확정

`market-data-collector`의 `wrangler.toml`에서 아래 placeholder를 실제 공공데이터포털 JSON endpoint로 교체합니다. endpoint와 field mapping은 production 배포 전에 실제 응답으로 확인되어야 합니다.

| 변수 | 설정 위치 | 용도 |
| --- | --- | --- |
| `ETF_PRICE_ENDPOINT` | collector `wrangler.toml`의 `[vars]` | ETF 시세 수집 |
| `MARKET_INDEX_ENDPOINT` | collector `wrangler.toml`의 `[vars]` | KOSPI·KOSDAQ 수집 |

발행 Worker에는 이 두 endpoint를 추가하지 않습니다.

## 3. D1 migration 적용

production D1 ID는 프로젝트 루트 `wrangler.toml`에 이미 설정되어 있습니다. 기존 테이블을 변경하지 않고 readiness·발행 실행·발행 잠금 테이블만 추가하는 migration을 적용합니다.

```powershell
cd D:\ETFCampus
npx wrangler d1 migrations apply etf-prices --remote
```

적용 후 테이블을 확인합니다.

```powershell
npx wrangler d1 execute etf-prices --remote --command "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('market_data_readiness', 'briefing_publication_runs', 'briefing_publication_locks') ORDER BY name;"
```

세 테이블이 모두 반환되어야 다음 단계로 진행합니다.

## 4. Collector production 시크릿 등록

Cloudflare Worker secret은 암호화된 binding으로 등록되며, `wrangler secret put`은 입력 프롬프트를 통해 값을 받습니다.[2] 시크릿은 화면에 남는 명령행 인수로 전달하지 않고, 아래 명령 실행 후 나타나는 입력 프롬프트에 붙여넣습니다.

```powershell
cd D:\ETFCampus\workers\market-data-collector

# 필수: 공공데이터포털 서비스 키
npx wrangler secret put DATA_GO_KR_SERVICE_KEY

# 선택: 원천 장애 P1 웹훅 URL
npx wrangler secret put OPS_ALERT_WEBHOOK_URL

# 선택: 웹훅 수신 측 Bearer 인증 토큰
npx wrangler secret put OPS_ALERT_WEBHOOK_TOKEN

# 선택: /internal/collect 수동 호출 보호용. 임의의 고유값을 사용합니다.
npx wrangler secret put MANUAL_RUN_TOKEN
```

`OPS_ALERT_WEBHOOK_URL`과 `OPS_ALERT_WEBHOOK_TOKEN`을 사용하지 않는다면 등록하지 않아도 됩니다. `DATA_GO_KR_SERVICE_KEY`는 반드시 collector에만 등록하고, Pages와 publisher에는 등록하지 않습니다.

## 5. Publisher production 시크릿 등록

publisher는 공공 API key가 필요 없습니다. 수동 발행 endpoint를 열어 둘 필요가 있을 때만 **collector와 다른 값**으로 `MANUAL_RUN_TOKEN`을 등록합니다.

```powershell
cd D:\ETFCampus\workers\market-briefing-publisher
npx wrangler secret put MANUAL_RUN_TOKEN
```

## 6. Worker production 배포

배포 순서는 반드시 **collector → publisher**입니다. collector가 D1 readiness를 만들기 전에는 publisher가 발행할 데이터가 없습니다.

```powershell
cd D:\ETFCampus\workers\market-data-collector
npx wrangler deploy

cd D:\ETFCampus\workers\market-briefing-publisher
npx wrangler deploy
```

배포 결과에서 아래 cron이 표시되는지 확인합니다.

| Worker | cron | 한국 시간 |
| --- | --- | --- |
| collector | `13 21-23 * * 0-4`, `13 0 * * 1-5` | 평일 06:13·07:13·08:13·09:13 |
| publisher | `17 21-23 * * 0-4`, `17 0 * * 1-5` | 평일 06:17·07:17·08:17·09:17 |

## 7. Pages production 배포

Pages는 Wrangler 구성 파일을 production 설정의 source of truth로 사용하며, KV binding도 이 파일에서 배포 환경에 반영할 수 있습니다.[4] 루트 `wrangler.toml`의 production `BRIEFING_KV` placeholder를 실제 ID로 교체한 뒤, 현재 Pages가 Wrangler 직접 배포 방식일 때만 실행합니다. 사전 build 결과물은 `wrangler pages deploy <BUILD_OUTPUT_DIRECTORY>`로 직접 업로드할 수 있습니다.[3]

```powershell
cd D:\ETFCampus
npm run build
npx wrangler pages deploy out --project-name etf-campus
```

Git 연동 Cloudflare Pages 배포를 사용한다면 이 명령과 별도로 중복 배포하지 말고, KV binding 반영 내용을 커밋·푸시하여 기존 배포 파이프라인으로 반영합니다.

## 8. 첫 자동 실행 후 D1 검증

첫 collector 실행 뒤에는 readiness가, 첫 publisher 실행 뒤에는 공개 브리핑과 발행 실행 이력이 생성되어야 합니다.

```powershell
cd D:\ETFCampus

npx wrangler d1 execute etf-prices --remote --command "SELECT as_of_date, status, etf_as_of_date, kospi_as_of_date, kosdaq_as_of_date, general_etf_count, aum_coverage_pct, ready_at FROM market_data_readiness ORDER BY updated_at DESC LIMIT 10;"

npx wrangler d1 execute etf-prices --remote --command "SELECT source_as_of_date, status, error_code, started_at, finished_at FROM briefing_publication_runs ORDER BY started_at DESC LIMIT 10;"

npx wrangler d1 execute etf-prices --remote --command "SELECT as_of_date, general_etf_count, market_temperature, published_at FROM market_briefings ORDER BY as_of_date DESC LIMIT 10;"
```

다음 조건을 만족하면 정상입니다.

| 확인 항목 | 정상 기준 |
| --- | --- |
| readiness | ETF·KOSPI·KOSDAQ `as_of_date`가 같고 `status = 'ready'` |
| 발행 이력 | 첫 발행은 `ready`, 이후 동일 기준일 실행은 `skipped_no_new_data` |
| 공개 브리핑 | 해당 기준일이 `market_briefings`에 정확히 1건 |
| Pages API | `/api/briefings/latest`이 마지막 `ready` 브리핑을 반환 |

## 9. 기존 결합 Worker 중지

새 자동화가 최소 한 번 정상 작동하고 D1 검증까지 끝난 뒤에만 기존 결합 Worker를 삭제합니다. 아래 명령은 되돌리기 전에는 실행하지 않습니다.

```powershell
cd D:\ETFCampus\workers\market-data-collector
npx wrangler delete market-briefing-ingestor
```

삭제 대신 Cloudflare 대시보드에서 기존 `market-briefing-ingestor`의 Cron Trigger만 먼저 중지해도 됩니다. 새 Worker에 오류가 있으면 publisher cron만 중지하면 마지막 `ready` 브리핑은 계속 노출됩니다.

## Production 배포 전 체크리스트

- [ ] 실제 production KV namespace ID가 Pages·collector·publisher 세 파일에 모두 동일하게 반영됨
- [ ] collector endpoint 두 개가 실제 JSON 응답 기준으로 확정됨
- [ ] `DATA_GO_KR_SERVICE_KEY`가 collector에만 등록됨
- [ ] `0006` migration이 production D1에 적용됨
- [ ] collector와 publisher의 `npm run typecheck`이 통과함
- [ ] collector를 먼저, publisher를 나중에 배포함
- [ ] 첫 readiness와 첫 briefing을 D1 query로 확인함
- [ ] 기존 `market-briefing-ingestor`는 새 자동화 검증 후에만 중지함

## References

[1]: https://developers.cloudflare.com/workers/wrangler/commands/ "Cloudflare Workers — Wrangler commands"
[2]: https://developers.cloudflare.com/workers/configuration/secrets/ "Cloudflare Workers — Secrets"
[3]: https://developers.cloudflare.com/pages/get-started/direct-upload/ "Cloudflare Pages — Direct Upload"
[4]: https://developers.cloudflare.com/pages/functions/wrangler-configuration/ "Cloudflare Pages — Wrangler configuration"
