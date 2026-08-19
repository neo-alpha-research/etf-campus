# ETF Campus 마켓 브리핑 — Production 장애 롤백 및 GitHub Actions 운영 런북

## 목적과 보호 원칙

이 런북은 분리된 `market-data-collector`와 `market-briefing-publisher`, Cloudflare Pages, D1, KV로 구성된 마켓 브리핑을 대상으로 합니다. 가장 중요한 원칙은 **원천 데이터 수집 문제와 공개 브리핑 문제를 분리하고, 검증되지 않은 데이터보다 마지막 정상 브리핑을 유지한다**는 것입니다.

공개 데이터의 기준점은 D1 `market_briefings`의 마지막 `ready` row입니다. KV는 읽기 가속 계층이므로 KV 문제만으로 D1의 정상 브리핑을 삭제하거나 D1을 복구하지 않습니다. D1은 production Time Travel을 통해 이전 시점으로 복원할 수 있지만, 복원은 전체 데이터와 진행 중인 쿼리에 영향을 주므로 최후 수단으로만 사용합니다.[1]

## CI/CD 구성 파일

| 파일 | 트리거·역할 |
| --- | --- |
| `.github/workflows/market-briefing-production.yml` | `main` branch push 또는 수동 실행 시 검증 → D1 migration → collector → publisher → Pages를 순서대로 배포 |
| `.github/workflows/rollback-market-briefing-production.yml` | 수동 실행 시 지정한 Worker version ID로 rollback하고, 필요하면 알려진 정상 Git ref의 Pages를 재배포 |

Production 배포 workflow는 migration 전 `d1 time-travel info` 결과를 30일 보관 artifact로 남깁니다. D1 migration은 CI의 비대화형 환경에서도 backup을 만들며, 하나의 migration 적용이 실패하면 그 migration은 rollback되고 기존 성공 migration은 유지됩니다.[2]

> **경계**: 이 CI/CD는 Cloudflare 배포 권한만 사용합니다. `DATA_GO_KR_SERVICE_KEY`, 운영자 웹훅 token, 수동 실행 token 같은 업무 시크릿은 GitHub workflow가 매 배포 때 갱신하지 않습니다. 이 시크릿들은 collector·publisher에 한 번 등록하고 필요 시 별도 회전합니다.

## GitHub Secrets와 Environment 설정

GitHub repository의 **Settings → Secrets and variables → Actions**에서 아래 repository secret 두 개를 등록합니다. Cloudflare의 GitHub Actions 문서는 CI에서 API token과 account ID를 secret으로 전달하는 방식을 안내합니다.[3]

| GitHub Secret | 값 | 사용처 |
| --- | --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | ETF Campus가 배포되는 Cloudflare account ID | D1·Worker·Pages 대상 계정 식별 |
| `CLOUDFLARE_API_TOKEN` | production deploy 전용 Cloudflare API token | migration, 두 Worker, Pages 배포 |

Cloudflare API token은 **배포 대상 account 하나로만 scope를 제한**합니다. 최소 권한 후보는 Account 단위의 Cloudflare Workers 편집, D1 편집, Cloudflare Pages 편집입니다. workflow가 KV namespace를 생성하지 않으므로 KV 쓰기 권한은 기본적으로 넣지 않습니다. 배포 중 기존 KV binding을 확인하는 권한 오류가 실제로 발생할 때만 `Workers KV Storage: Read`를 추가합니다. Cloudflare도 CI token scope를 가능한 좁게 제한하라고 권장합니다.[3]

GitHub repository의 **Settings → Environments**에서 `production` environment를 만듭니다. 작성한 두 workflow는 이 environment를 사용합니다.

| 운영 방식 | Environment 설정 | 결과 |
| --- | --- | --- |
| 완전 자동 production | Required reviewers 미설정 | `main` push가 validation 후 자동 배포 |
| 승인형 production | Required reviewers 1명 이상 설정 | `main` push는 검증까지 진행하고 production jobs는 승인 후 실행 |

Pages는 GitHub 연동 자동 빌드와 GitHub Actions Direct Upload를 동시에 운영하지 않습니다. 이 프로젝트에서 작성한 workflow는 Wrangler Direct Upload로 `out`과 Pages Functions를 배포합니다. Pages project의 Git 자동 배포가 켜져 있다면 해제하거나, 반대로 Git 연동을 유지할 경우 workflow의 `deploy_pages` job을 제거해야 합니다.[4]

## 최초 CI/CD 활성화 절차

| 순서 | 담당 작업 | 확인 기준 |
| ---: | --- | --- |
| 1 | production KV namespace ID를 Pages·collector·publisher `wrangler.toml`에 동일하게 반영 | placeholder 없음 |
| 2 | collector에 실제 공공 API endpoint와 `DATA_GO_KR_SERVICE_KEY` 등록 | publisher에는 API key 없음 |
| 3 | 위 두 GitHub secret과 `production` environment 등록 | Actions가 인증 가능 |
| 4 | 새 workflow 두 파일과 worker lockfile을 `main`에 merge | Actions 탭에 workflow 표시 |
| 5 | 첫 run의 D1 migration·collector·publisher·Pages job 확인 | 모든 job 성공 |
| 6 | 첫 06:13/06:17 실행 후 D1 query 확인 | readiness·브리핑 기준일 일치 |
| 7 | 새 자동화 검증 후에만 기존 `market-briefing-ingestor` cron 중지 | 중복 발행 없음 |

## 장애 발생 직후 공통 절차

1. **사용자 영향 최소화**를 먼저 수행합니다. 새 공개 내용이 잘못되었거나 발행 Worker가 반복 오류를 낸다면 Cloudflare Dashboard에서 `market-briefing-publisher`의 Cron Trigger를 일시 중지합니다. 마지막 `ready` 브리핑은 계속 제공됩니다.
2. 수집 API 문제라면 `market-data-collector` Cron Trigger를 일시 중지하거나 circuit breaker가 동작하도록 두고, 마지막 공개 브리핑은 유지합니다.
3. 장애 시각, 마지막 정상 기준일, 배포 commit SHA, Worker version ID를 incident 기록에 남깁니다.
4. D1에 쓰기 오류나 migration 문제가 의심될 때만 collector와 publisher를 모두 중지합니다. Pages와 KV만의 문제라면 D1 복구를 실행하지 않습니다.

Worker version ID는 다음 명령으로 확인합니다. Cloudflare Worker는 이전 배포 version으로 rollback할 수 있으며, rollback은 선택 version을 100% 트래픽의 active deployment로 만듭니다.[5]

```powershell
cd D:\ETFCampus\workers\market-data-collector
npx wrangler versions list --name market-data-collector --json
npx wrangler versions list --name market-briefing-publisher --json
```

## 유형별 구체적 롤백 절차

| 장애 유형 | 즉시 보호 조치 | 복구 방법 | D1 조치 |
| --- | --- | --- | --- |
| publisher 계산·발행·KV 오류 | publisher cron 중지 | publisher만 직전 version으로 rollback | 불필요 |
| collector endpoint·시크릿·정규화 오류 | collector cron 중지 | endpoint/secret 수정 또는 collector 직전 version rollback | 불필요 |
| Pages UI·API 응답 오류 | Pages deploy 중지 | 정상 Git tag/commit으로 Pages 재배포 | 불필요 |
| 성공한 migration 이후 schema·데이터 정합성 오류 | collector·publisher 모두 중지 | Worker·Pages를 호환 가능한 정상 version으로 먼저 되돌림 | 필요 시 Time Travel을 수동 검토 |
| KV pointer/payload 오류 | publisher cron 일시 중지 | publisher rollback 또는 정상 D1 row 재발행 절차 | D1 복구 금지 |

### A. Publisher만 rollback

1. Cloudflare Dashboard에서 publisher Cron Trigger를 중지합니다.
2. Actions 탭에서 **Rollback market briefing production** workflow를 선택하고 **Run workflow**를 누릅니다.
3. `publisher_version_id`에 마지막 정상 version ID를 넣고, `collector_version_id`는 비웁니다.
4. Pages UI가 정상이라면 `rollback_pages`는 `false`로 둡니다.
5. workflow가 성공하면 publisher Cron Trigger를 다시 켜고 아래 검증 SQL을 실행합니다.

PowerShell에서 긴급하게 직접 실행할 때의 동등 명령은 다음과 같습니다.

```powershell
cd D:\ETFCampus\workers\market-briefing-publisher
npx wrangler rollback <정상-publisher-version-id> --yes --message "INC-번호: publisher rollback"
```

### B. Collector만 rollback

1. collector Cron Trigger를 중지합니다.
2. Actions의 rollback workflow에서 `collector_version_id`만 입력합니다.
3. publisher는 이미 발행한 기준일을 재발행하지 않으므로, collector 복구 뒤 다음 06:13 수집 및 06:17 발행을 확인합니다.
4. 공개 브리핑이 이미 잘못 발행된 것이 아니라면 Pages와 publisher rollback은 필요하지 않습니다.

```powershell
cd D:\ETFCampus\workers\market-data-collector
npx wrangler rollback <정상-collector-version-id> --yes --message "INC-번호: collector rollback"
```

### C. Pages rollback

Pages version rollback은 **정상 Git tag 또는 commit SHA를 다시 build·deploy**하는 방식으로 처리합니다. Actions rollback workflow에서 `rollback_pages=true`, `pages_git_ref=<정상-tag-or-SHA>`를 입력합니다. 이 작업은 D1 migration을 되돌리지 않습니다. 따라서 이전 Pages 코드가 현재 D1 schema와 호환되는지 먼저 확인해야 합니다.

### D. D1 migration·데이터 복구

현재 마이그레이션은 기존 테이블을 변경하지 않고 새 테이블만 추가합니다. 따라서 schema migration 성공 뒤 UI 또는 Worker 문제라면 우선 **코드 rollback만** 수행하는 것이 안전합니다.

D1 Time Travel은 데이터베이스 전체를 지정 시점으로 복원하고 진행 중 쿼리와 transaction을 취소합니다.[1] 복구 가능 기간은 Workers Paid plan에서 최대 30일, Free plan에서 최대 7일이므로 incident 발생 시 빠르게 복구 시점을 결정해야 합니다.[1] 이 작업은 CI workflow에 자동화하지 않았으며, 운영자 확인 후 PowerShell에서만 실행합니다.

```powershell
cd D:\ETFCampus

# 복구할 시점의 bookmark를 확인합니다. UTC 시간을 사용합니다.
npx wrangler d1 time-travel info etf-prices --timestamp="2026-08-19T00:00:00Z"

# 반환된 bookmark를 확인한 뒤, 전체 DB overwrite를 수동 확인하여 실행합니다.
npx wrangler d1 time-travel restore etf-prices --bookmark=<복구-bookmark>
```

복구 직후에는 collector·publisher를 아직 재개하지 말고, 아래 검증 SQL과 Pages API를 확인합니다. Time Travel restore는 이전 bookmark로 다시 되돌릴 수 있으므로, restore 명령이 출력하는 직전 bookmark도 incident 기록에 보관합니다.[1]

## 롤백 후 검증 SQL

```sql
-- readiness와 공개 브리핑이 실제 기준일별로 어떻게 연결되는지 확인합니다.
SELECT r.as_of_date,
       r.status AS readiness_status,
       r.etf_as_of_date,
       r.kospi_as_of_date,
       r.kosdaq_as_of_date,
       b.published_at,
       b.general_etf_count
FROM market_data_readiness r
LEFT JOIN market_briefings b ON b.as_of_date = r.as_of_date
ORDER BY r.updated_at DESC
LIMIT 20;

-- 발행 Worker가 같은 기준일을 다시 공개하지 않았는지 확인합니다.
SELECT source_as_of_date, status, error_code, started_at, finished_at
FROM briefing_publication_runs
ORDER BY started_at DESC
LIMIT 20;

-- 최종 공개 데이터가 한 기준일당 하나인지 확인합니다.
SELECT as_of_date, COUNT(*) AS briefing_count
FROM market_briefings
GROUP BY as_of_date
HAVING COUNT(*) > 1;
```

마지막으로 production `https://<도메인>/api/briefings/latest`가 마지막 정상 기준일의 payload를 반환하는지 확인합니다. D1 query와 API 응답이 모두 정상일 때만 중지한 Cron Trigger를 재개합니다.

## 배포 workflow의 실패 처리

`market-briefing-production.yml`은 validate → D1 migration → collector → publisher → Pages를 순차 연결합니다. 한 단계라도 실패하면 후속 배포 job은 실행되지 않습니다. 따라서 migration 오류라면 Worker와 Pages가 새 코드로 배포되지 않고, collector 배포 오류라면 publisher와 Pages는 기존 버전을 유지합니다.

다만 collector가 성공하고 publisher가 실패한 경우 collector만 새 version일 수 있습니다. 이때 새 collector가 `ready` snapshot을 기록해도 publisher가 공개하지 않으므로 화면에는 마지막 `ready` 브리핑이 유지됩니다. 오류가 collector 코드 자체라면 publisher 문제 해결과 별개로 collector rollback workflow를 실행합니다.

## References

[1]: https://developers.cloudflare.com/d1/reference/time-travel/ "Cloudflare D1 — Time Travel and backups"
[2]: https://developers.cloudflare.com/d1/wrangler-commands/ "Cloudflare D1 — Wrangler commands"
[3]: https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/ "Cloudflare Workers — GitHub Actions"
[4]: https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/ "Cloudflare Pages — Direct Upload with continuous integration"
[5]: https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/ "Cloudflare Workers — Rollbacks"
