# Retired: `market-daily-monitor`

이 Cloudflare Worker는 1주일간의 데이터 공급 시간대 관측(Probe) 및 실시간 모니터링을 위해 한시적으로 운영되었던 Worker입니다.

- **관측 완료 및 제거**: 1주일간의 정밀 관측을 통해 KRX API 공급 패턴이 확정되었으며, Cloudflare Worker 및 15분 단위 Cron 트리거는 2026-08-29부로 완전 삭제되었습니다.
- **상시 모니터링 체계**: 현재 마켓 데일리 데이터 검증 및 모니터링은 GitHub Actions (`.github/workflows/monitor-market-daily-pipeline.yml`)를 통해 매 거래일 익일 **10:03 KST**에 수행됩니다.
