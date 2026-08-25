# Antigravity 지시: 동시성 그룹 분리와 감시 장치 통지 경로

작성일: 2026-08-25
발신: EVS Navigator
용도: 아래 구분선 안의 전문을 Antigravity에 그대로 전달하십시오.

---

## 1. 크론 변경은 정확합니다

저장소에서 확인한 결과 환산이 전부 맞습니다.

| 워크플로 | UTC | KST |
|---|---|---|
| daily-market | 23:07, 00-03:07 | 08:07, 09:07, 10:07, 11:07, 12:07 |
| daily-distribution | 23:22, 00-03:22 | 08:22 ~ 12:22 |
| daily-fees | 23:37, 00-03:37 | 08:37 ~ 12:37 |
| monitor | 04:15 | 13:15 |

요일 처리도 정확합니다. UTC 월~금 23시는 KST 화~토 08시, UTC 화~토 0~3시는 KST 화~토 09~12시로 모두 거래일 익일 오전에 맞습니다.

세 워크플로 모두 `git pull --rebase --autostash` 재시도 루프를 갖춘 것도 확인했습니다.

---

## 2. 그런데 무음 취소 문제가 악화되었습니다

세 워크플로가 여전히 `concurrency: daily-etf-data` 그룹을 `cancel-in-progress: false`로 공유합니다.

**실행 횟수가 하루 6회에서 15회로 늘었습니다.** 08:07부터 12:37까지 4시간 30분 안에 15개 실행이 15분 간격으로 같은 그룹에 들어갑니다.

GitHub 규칙상 한 그룹에는 실행 중 1개와 대기 중 1개만 있을 수 있고, 세 번째가 도착하면 대기 중이던 것이 취소됩니다.

**실제로 데이터를 수집하는 날에 문제가 터집니다.** 그날 `daily-market`은 약 1,147종목을 API로 수집하고, 조건이 맞으면 `rebuild_listing_reference_prices.py`를 `--throttle-seconds 1.5`로 실행합니다. 타임아웃이 30분으로 설정된 것 자체가 이 작업이 오래 걸릴 수 있다는 뜻입니다.

15분을 넘기면 다음과 같이 진행됩니다.

```
10:07  market 실행 시작 (실제 수집, 장시간)
10:22  distribution 대기열 진입
10:37  fees 도착 → 대기 중이던 distribution 취소
11:07  market 도착 → 대기 중이던 fees 취소
```

**하루 중 유일하게 의미 있는 그 실행에서 분배금과 수수료 갱신이 취소됩니다.** 간격을 벌리는 것으로는 해결되지 않습니다.

---

## 3. 수정 지시: 동시성 그룹을 분리하십시오

공유 그룹의 원래 목적은 git push 충돌 방지였습니다. 그런데 세 워크플로 모두 `git pull --rebase --autostash` 재시도 루프를 갖췄으므로 **그 목적은 이미 더 나은 수단으로 달성되어 있습니다.** 지금 공유 그룹은 이득 없이 취소만 유발합니다.

각 워크플로에 고유한 그룹을 부여하십시오.

```yaml
# daily-market.yml
concurrency:
  group: daily-market
  cancel-in-progress: false

# daily-distribution.yml
concurrency:
  group: daily-distribution
  cancel-in-progress: false

# daily-fees.yml
concurrency:
  group: daily-fees
  cancel-in-progress: false
```

`cancel-in-progress: false`는 유지합니다. 같은 워크플로가 자기 자신과 겹치는 것은 여전히 막아야 하며, 진행 중인 데이터 커밋을 중간에 끊으면 안 됩니다.

`daily-market.yml`의 기존 주석("Keep one refresh at a time...")은 자기 자신에 대한 설명으로 여전히 유효하므로 그대로 두십시오.

---

## 4. 검토 요청: 후속 워크플로를 체이닝으로 바꿀지

지금 구조는 `daily-distribution`과 `daily-fees`도 각각 5회씩 실행됩니다. 그러나 두 워크플로는 시장 데이터가 갱신된 뒤 한 번만 돌면 충분합니다.

`workflow_run` 트리거로 `daily-market` 완료 후 실행되게 바꾸면 세 가지가 개선됩니다. 실행 횟수가 하루 10회에서 2회로 줄고, 시간 기반 추정이 아니라 실제 완료를 근거로 순서가 보장되며, 동시성 충돌 가능성이 사라집니다.

```yaml
on:
  workflow_run:
    workflows: ["Daily ETF market data refresh"]
    types: [completed]
  workflow_dispatch:
```

**다만 확인이 필요합니다.** `daily-market`이 데이터 없이 조기 종료한 날에도 `workflow_run`이 발동하므로, 후속 워크플로가 불필요하게 도는 것을 막을 조건이 필요합니다. `daily-market`이 실제로 데이터를 갱신했는지를 후속 워크플로가 판정할 수 있는 방법이 있는지 조사해 보고하십시오.

**이번 지시에서 구현하지는 마십시오.** 조사 결과를 보고 판단하겠습니다. 3번의 그룹 분리만 먼저 적용하십시오.

---

## 5. 감시 장치 통지 경로

`functions/_shared/n8n.js`와 `N8N_AUTH_WEBHOOK_URL`을 찾아낸 것은 유용한 발견입니다.

다만 새 웹훅 URL을 발급받기 전에 **더 단순한 경로를 먼저 검토하십시오.**

**Cloudflare Worker에서 GitHub REST API를 직접 호출해 Issue를 생성하는 방법입니다.** 기존 모니터 워크플로가 하던 통지 방식(`Market Daily 확인 필요 · YYYY-MM-DD` 제목의 Issue 생성)을 그대로 유지할 수 있습니다.

이 방식의 장점은 세 가지입니다. GitHub API 호출은 Actions 분을 소모하지 않으므로 한도와 무관하게 동작합니다. 운영자가 이미 익숙한 알림 형식이 유지됩니다. 새 외부 서비스나 채널을 추가하지 않아도 됩니다.

필요한 것은 `issues: write` 권한을 가진 fine-grained 토큰 하나이며, Worker 시크릿으로 저장합니다.

**이 방식의 실현 가능성을 조사해 보고하십시오.** 확인할 것은 Cloudflare Worker에서 GitHub API 호출이 가능한지, 필요한 토큰 권한 범위가 정확히 무엇인지, 그리고 중복 Issue 생성을 막는 방법입니다. 같은 날짜에 대해 이미 열린 Issue가 있으면 새로 만들지 않아야 합니다.

n8n 웹훅 방식은 이 조사 결과가 부정적일 때의 대안으로 두겠습니다.

---

## 6. 작업 규칙

기존 파일을 통째로 다시 쓰지 말고 증분 편집만 하십시오.

이 저장소는 `node_modules`가 여러 곳에 있어 루트에서의 재귀 탐색이 사실상 멈춥니다. 탐색은 대상 디렉터리를 특정하거나 `node_modules`를 제외하고 수행하십시오.

완료 보고에 `git log --oneline -n 5`와 `git status --porcelain`을 함께 넣으십시오.

날짜와 시각을 추정하지 말고 실제로 조회해 확인하십시오.

확인한 사실과 추론을 구분하십시오.

---

## 7. 진행 순서

첫째, 3번의 동시성 그룹 분리를 적용하고 커밋하십시오.

둘째, 4번의 `workflow_run` 체이닝 가능성을 조사해 보고하십시오. 구현은 하지 마십시오.

셋째, 5번의 Worker에서 GitHub Issue 생성 방식의 실현 가능성을 조사해 보고하십시오. 구현은 하지 마십시오.

세 가지를 한 번에 보고하시면 됩니다. 그 결과를 보고 감시 장치 구축과 체이닝 여부를 확정하겠습니다.
