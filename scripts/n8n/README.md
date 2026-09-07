# NHN Cloud n8n 연동 GitHub Actions 트리거 가이드

이 디렉토리는 GitHub Actions의 글로벌 Cron 지연(3~15분)을 극복하고, **NHN Cloud 인스턴스에 호스팅된 n8n을 통해 07:53:00 정각에 0초 오차로 데이터 적재를 발사**하기 위한 워크플로우 명세 및 연동 가이드입니다.

---

## 1. 아키텍처 개요

```text
[NHN Cloud Linux Instance]
       │
   (n8n Cron) 07:53:00 KST
       │
       ▼
   HTTP Request Node ───(POST workflow_dispatch)───▶ [GitHub REST API]
                                                            │
                                                     (0초 즉시 큐잉)
                                                            ▼
                                                   [daily-market.yml 러너 즉각 기동]
```

---

## 2. n8n 워크플로우 적용 방법

1. **n8n 대시보드 접속** (예: `http://<NHN_CLOUD_IP>:5678`)
2. **Workflows** 메뉴에서 **Import from File** 선택 후 [`daily_market_trigger_workflow.json`](daily_market_trigger_workflow.json) 업로드.
3. **Credentials 설정**:
   - `Header Auth` 생성:
     - Header Name: `Authorization`
     - Header Value: `Bearer <GITHUB_PERSONAL_ACCESS_TOKEN>` (권한: `repo` 또는 `actions:write`)
4. 워크플로우를 **Active**로 전환.

---

## 3. GitHub Actions `daily-market.yml` 설정 상태

- GitHub 내부의 `schedule` 크론 블록이 전면 제거되어, GitHub 스케줄러에 의한 지연이나 불필요한 자동 시도가 차단되었습니다.
- n8n의 `workflow_dispatch` 호출을 수신하여 1초 이내에 즉각 실행됩니다.
