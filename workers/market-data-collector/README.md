# Retired: `market-data-collector`

이 디렉터리의 Worker는 초기 마켓 브리핑 V0에서 ETF·지수 API를 직접 호출하도록 작성된 구현입니다. **현재 event hub 아키텍처에서는 배포하거나 cron을 활성화하지 않습니다.**

원천 API 수집의 단일 책임은 기존 `.github/workflows/daily-data.yml`과 `scripts/update_daily_data.py`가 가집니다. 이 workflow는 KRX Open API를 우선 사용하고, 필요한 경우 금융위원회 공공데이터포털 ETF API를 보완합니다. 검증을 마친 결과는 `scripts/publish_market_source_snapshot.py`를 통해 D1 source snapshot hub로 한 번만 적재됩니다.

그 뒤에는 `market-event-dispatcher`가 D1 outbox를 Queue로 전달하고, `market-briefing-publisher`가 Queue consumer로서 D1 snapshot만 읽어 브리핑을 발행합니다. 따라서 이 legacy Worker에 `DATA_GO_KR_SERVICE_KEY` 또는 `KRX_OPEN_API_KEY`를 새로 등록하지 마십시오.
