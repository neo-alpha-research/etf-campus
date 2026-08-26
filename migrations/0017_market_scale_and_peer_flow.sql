-- Migration number: 0017
-- Description: Market Scale and Peer Flow Tables for Market Briefing STEP 5 and STEP 6

-- 1. market_scale_daily (ETF 시장 규모 및 자금 동향)
CREATE TABLE IF NOT EXISTS market_scale_daily (
    as_of_date TEXT PRIMARY KEY,
    total_aum REAL NOT NULL,
    total_etf_count INTEGER NOT NULL,
    general_aum REAL NOT NULL,
    general_etf_count INTEGER NOT NULL,
    daily_aum_change REAL NOT NULL,
    daily_net_inflow REAL NOT NULL,
    weekly_aum_change REAL NOT NULL,
    weekly_net_inflow REAL NOT NULL,
    monthly_aum_change REAL NOT NULL,
    monthly_net_inflow REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. peer_flow_daily (동종 그룹별 주/월간 자금 흐름 및 수익률 랭킹)
CREATE TABLE IF NOT EXISTS peer_flow_daily (
    as_of_date TEXT NOT NULL,
    period TEXT NOT NULL,          -- 'weekly', 'monthly'
    peer_group TEXT NOT NULL,
    asset_class TEXT,
    etf_count INTEGER NOT NULL,
    net_inflow REAL NOT NULL,      -- 기간 내 실질 순유입 금액 합계 (억원)
    cumulative_return_pct REAL NOT NULL, -- 기간 내 그룹 가중 누적 수익률 (%)
    rank INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (as_of_date, period, peer_group)
);

CREATE INDEX IF NOT EXISTS idx_peer_flow_daily_rank 
ON peer_flow_daily(as_of_date, period, rank);
