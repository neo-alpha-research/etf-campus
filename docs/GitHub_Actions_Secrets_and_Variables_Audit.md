# ETF Campus — GitHub Actions Secrets 및 환경 변수 점검

## 점검 결론

현재 `.github/workflows`의 실제 `secrets.*` 참조를 전체 검색한 결과, **GitHub Actions에 등록해야 하는 이름은 6개**입니다. 현재 workflow에는 `vars.*` 참조가 없으므로 **필수 GitHub Actions Variable은 없습니다**.

GitHub secret이 비어 있으면 `${{ secrets.NAME }}`는 빈 문자열로 평가됩니다. 따라서 누락 시 매일 데이터 갱신은 API 인증 오류 또는 signed backfill 인증 오류가 나고, production 배포·rollback workflow는 Cloudflare 인증 오류로 중단됩니다.[1]

## 1. 현재 코드 그대로 사용할 때의 GitHub Repository Secrets

아래 여섯 개를 GitHub repository의 **Settings → Secrets and variables → Actions → Secrets**에 등록하면 현재 모든 workflow가 참조하는 값이 충족됩니다.

| GitHub Secret | 필수 여부 | 참조 workflow | 실제 용도 | 동일 값의 별도 등록 필요 여부 |
| --- | --- | --- | --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | 필수 | `market-briefing-production.yml`, `rollback-market-briefing-production.yml` | Cloudflare account 대상 식별 | 없음 |
| `CLOUDFLARE_API_TOKEN` | 필수 | `market-briefing-production.yml`, `rollback-market-briefing-production.yml` | D1 migration, 두 Worker, Pages production 배포·rollback 인증 | 없음 |
| `DATA_GO_KR_SERVICE_KEY` | 필수 | `daily-data.yml`, `backfill-d1.yml` | 공공데이터포털 ETF·가격 수집 | **collector Worker secret에도 별도 등록** |
| `KRX_OPEN_API_KEY` | 필수 | `daily-data.yml`, `backfill-d1.yml` | 기존 KRX 데이터 갱신·backfill | GitHub workflow 전용 |
| `PRICE_INGEST_ENDPOINT` | 필수 | `daily-data.yml` | GitHub data workflow가 signed price ingest를 호출하는 URL | GitHub workflow 전용 |
| `PRICE_INGEST_HMAC_SECRET` | 필수 | `daily-data.yml`, `backfill-d1.yml` | GitHub data workflow의 signed price ingest 요청 검증 | **Cloudflare Pages production secret에도 같은 값 등록** |

> `CLOUDFLARE_ACCOUNT_ID`는 비밀값은 아니지만, 현재 workflow가 `secrets.CLOUDFLARE_ACCOUNT_ID`로 참조하므로 코드 변경 없이 적용하려면 Repository Secret으로 등록해야 합니다. 이 값을 GitHub Variable로 옮기려면 workflow의 참조를 `vars.CLOUDFLARE_ACCOUNT_ID`로 바꾸어야 합니다.

## 2. GitHub Actions에 등록하지 않는 값

다음 값들은 현재 GitHub Actions가 참조하지 않으므로 GitHub Secret으로 만들면 안 됩니다. 각 값은 Cloudflare Pages 또는 Worker runtime에만 등록합니다.

| 배치 대상 | 필수 값 | 선택·기능 활성화 시 값 | 등록 방식 |
| --- | --- | --- | --- |
| `market-data-collector` Worker | `DATA_GO_KR_SERVICE_KEY` | `OPS_ALERT_WEBHOOK_URL`, `OPS_ALERT_WEBHOOK_TOKEN`, `MANUAL_RUN_TOKEN` | `npx wrangler secret put <NAME>` |
| `market-briefing-publisher` Worker | 없음 | `MANUAL_RUN_TOKEN` | `npx wrangler secret put MANUAL_RUN_TOKEN` |
| Cloudflare Pages Functions | `PRICE_INGEST_HMAC_SECRET` (signed ingest 사용 시) | `AUTH_PASSWORD_PEPPER`, `COMMUNITY_RATE_LIMIT_SALT`, `N8N_WEBHOOK_SECRET`, `PASSWORD_RESET_WEBHOOK_SECRET`, `TURNSTILE_SECRET_KEY`, `SUPABASE_ANON_KEY` | Pages의 Variables and Secrets에서 secret으로 등록 |

`SUPABASE_URL`, `TURNSTILE_REQUIRED`, `TURNSTILE_SITE_KEY`, `TURNSTILE_EXPECTED_HOSTNAME`, `COMMUNITY_ENVIRONMENT`, `PUBLIC_APP_ORIGIN`, `N8N_AUTH_WEBHOOK_URL`, `N8N_WEBHOOK_REQUIRED`, `PASSWORD_RESET_DELIVERY_REQUIRED`, `PASSWORD_RESET_WEBHOOK_URL` 등은 값의 성격에 따라 Cloudflare runtime **일반 variable**로 관리합니다. API key, webhook token, HMAC secret, pepper처럼 외부에 노출되면 안 되는 값은 반드시 secret으로 관리합니다.

## 3. GitHub 자동 제공 값과 workflow 내부 상수

아래 항목은 직접 등록하지 않습니다.

| 항목 | 이유 |
| --- | --- |
| `GITHUB_TOKEN` | GitHub Actions가 workflow run마다 자동 제공합니다. 기존 `daily-data.yml`은 `permissions: contents: write`로 이 token의 commit·push 권한을 설정합니다. |
| `PAGES_PROJECT_NAME` | 새 production·rollback workflow의 `env`에 `etf-campus`으로 고정되어 있습니다. |
| `WRANGLER_VERSION` | 새 production·rollback workflow의 `env`에 `4.124.0`으로 고정되어 있습니다. |
| `TARGET_DATE`, `inputs.*` | 수동 workflow 입력 또는 schedule 실행 중에 생성되는 실행 값입니다. |
| Worker D1·KV binding ID, endpoint URL, threshold | GitHub Action이 아니라 각 `wrangler.toml`의 binding·`[vars]` 설정입니다. |

## 4. 등록 위치 선택지

현재 workflow를 한 줄도 바꾸지 않는다면 위 6개를 모두 **Repository Secrets**에 등록하는 것이 정확합니다. Repository Secret은 여러 workflow에서 공유할 수 있습니다.[1]

보안을 더 강화하려면 배포 전용 두 값인 `CLOUDFLARE_ACCOUNT_ID`와 `CLOUDFLARE_API_TOKEN`만 `production` Environment Secret으로 옮기는 방식도 가능합니다. Environment secret은 해당 environment를 사용하는 job만 접근할 수 있고, Required reviewer를 설정하면 승인 뒤에만 값이 제공됩니다.[2] 다만 이 방식을 채택하려면 workflow 최상위의 `secrets.CLOUDFLARE_*` 참조를 각 production job 수준으로 옮기는 작은 설정 변경이 필요합니다.

| 방식 | 등록 범위 | 장점 | 유의점 |
| --- | --- | --- | --- |
| A. 현재 코드 유지 | 6개 모두 Repository Secret | 즉시 동작, 설정이 가장 단순 | 배포 token이 repository workflow 범위에 존재 |
| B. 배포 token 격리 | 데이터 4개는 Repository Secret, Cloudflare 2개는 `production` Environment Secret | approval·branch protection과 결합 가능 | workflow의 secret scope를 job 수준으로 조정해야 함 |

## 5. Cloudflare API Token 최소 권한

`CLOUDFLARE_API_TOKEN`은 배포 전용 token으로 새로 만들고, ETF Campus production account 하나에만 scope를 제한합니다. 이 workflow가 수행하는 작업을 기준으로 다음 Account 권한을 후보로 설정합니다.

| Cloudflare account 권한 | 필요한 작업 |
| --- | --- |
| Cloudflare Workers: Edit | collector·publisher deploy 및 version rollback |
| D1: Edit | production migration 및 Time Travel bookmark 조회 |
| Cloudflare Pages: Edit | Pages Direct Upload 배포 |

KV namespace를 CI가 생성·삭제하지 않으므로 기본적으로 `Workers KV Storage: Edit`는 넣지 않습니다. binding 검증 단계에서 실제 권한 오류가 있을 때에만 가장 낮은 권한부터 추가합니다. Cloudflare는 CI API token을 좁은 account scope로 제한하는 방식을 권장합니다.[3]

## 6. 등록 점검 명령

GitHub CLI를 사용한다면 secret 값은 명령행 인수에 노출하지 말고 프롬프트로 입력합니다.[1]

```powershell
# GitHub repository root에서 실행합니다.
gh secret set CLOUDFLARE_ACCOUNT_ID
gh secret set CLOUDFLARE_API_TOKEN
gh secret set DATA_GO_KR_SERVICE_KEY
gh secret set KRX_OPEN_API_KEY
gh secret set PRICE_INGEST_ENDPOINT
gh secret set PRICE_INGEST_HMAC_SECRET

# 값은 표시되지 않고 이름만 확인됩니다.
gh secret list
```

Cloudflare Worker runtime secret은 GitHub Secret 등록과 별개입니다.

```powershell
cd D:\ETFCampus\workers\market-data-collector
npx wrangler secret put DATA_GO_KR_SERVICE_KEY

# signed ingest를 사용하는 Pages production 환경에도 같은 HMAC 값을 별도 등록합니다.
# Cloudflare Dashboard → Workers & Pages → etf-campus → Settings → Variables and Secrets
```

## References

[1]: https://docs.github.com/actions/security-guides/using-secrets-in-github-actions "GitHub Docs — Using secrets in GitHub Actions"
[2]: https://docs.github.com/actions/deployment/targeting-different-environments/using-environments-for-deployment "GitHub Docs — Using environments for deployment"
[3]: https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/ "Cloudflare Docs — GitHub Actions"
