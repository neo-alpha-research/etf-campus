export interface Env {
  ETF_PRICES: D1Database;
  BRIEFING_KV: KVNamespace;
  SITE_BASE_URL: string;
  MAX_ALLOWED_DISPARITY_PCT?: string;
  MAX_ALLOWED_DAILY_SPIKE_PCT?: string;
  INSTAGRAM_ACCESS_TOKEN?: string;
  INSTAGRAM_USER_ID?: string;
  THREADS_ACCESS_TOKEN?: string;
  THREADS_USER_ID?: string;
  RESEND_API_KEY?: string;
  SLACK_WEBHOOK_URL?: string;
  MANUAL_RUN_TOKEN?: string;
  GEMINI_API_KEY?: string;
}

export interface BriefingDistributeEvent {
  event_id: string;
  as_of_date: string;
  publication_version: number;
  trigger_type: "queue" | "manual" | "scheduled";
  channels?: Array<"instagram" | "threads" | "newsletter">;
}

export interface AssetClassItem {
  assetClass: string;
  etfCount: number;
  upCount: number;
  flatCount: number;
  downCount: number;
  breadthRatioPct: number;
  aumWeightedReturnPct: number;
  totalAum: number;
  aumSharePct: number;
  totalTradeValue: number;
  tradeSharePct: number;
  ytdReturnPct?: number;
}

export interface FocusEtfItem {
  rankNo: number;
  ticker: string;
  etfName: string;
  assetClass: string;
  closeValue: number;
  changePct: number;
  tradeValue: number;
  tradeSharePct: number;
}

export interface InflowItem {
  rank: number;
  ticker: string;
  name: string;
  etfName?: string;
  assetClass?: string;
  theme?: string;
  inflow: number; // 억원
  inflowAmount?: number;
  netInflowValue?: number;
  changePct?: number;
}

export interface PeerGroupItem {
  assetClass: string;
  peerGroup: string;
  etfCount: number;
  cappedAumWeightedReturnPct: number;
  topEtfName?: string;
  topEtfTicker?: string;
  totalAum?: number;
}

export interface DisparityItem {
  ticker: string;
  name: string;
  assetClass: string;
  nav: number;
  price: number;
  disparityPct: number;
}

export interface MarketIndexItem {
  code: string;
  label: string;
  close: number;
  change_pct: number;
  as_of_date: string;
}

export interface MarketBriefingPulse {
  totalEtfCount?: number;
  generalEtfCount?: number;
  upCount?: number;
  flatCount?: number;
  downCount?: number;
  breadthRatioPct?: number;
  marketTemperature?: string;
  generalAumWeightedReturnPct?: number;
  top50AumWeightedReturnPct?: number;
  top100AumWeightedReturnPct?: number;
  top200AumWeightedReturnPct?: number;
  generalTotalAum?: number;
  generalTotalTradeValue?: number;
  top10TradeSharePct?: number;
  allTop10TradeSharePct?: number;
}

export interface MarketBriefingPayload {
  asOfDate: string;
  publicationVersion: number;
  publishedAt?: string;
  updatedAt?: string;
  isStale?: boolean;
  staleDays?: number;
  headline?: {
    text: string;
    generationStatus?: string;
  };
  marketIndices?: MarketIndexItem[];
  pulse?: MarketBriefingPulse;
  headlineText?: string;
  marketTemperature?: string;
  kospiClose?: number;
  kospiChangePct?: number;
  kosdaqClose?: number;
  kosdaqChangePct?: number;
  generalEtfCount?: number;
  upCount?: number;
  flatCount?: number;
  downCount?: number;
  breadthRatioPct?: number;
  generalTotalAum?: number;
  generalTotalTradeValue?: number;
  marketTurnoverPct?: number;
  top10TradeSharePct?: number;
  allTop10TradeSharePct?: number;
  generalAumWeightedReturnPct?: number;
  top50WeightedReturnPct?: number;
  disparityAlerts?: {
    overvalued: DisparityItem[];
    undervalued: DisparityItem[];
  };
  disparityWarning?: Array<{
    ticker: string;
    etfName?: string;
    name?: string;
    assetClass?: string;
    disparityPct: number;
    nav?: number;
    price?: number;
  }>;
  assetClasses?: AssetClassItem[];
  focusEtfs?: FocusEtfItem[];
  peerGroups?: PeerGroupItem[];
  fundFlow?: any;
  periodicFlows?: {
    dailyFundFlows?: {
      topInflows: InflowItem[];
      topOutflows: InflowItem[];
    };
    weeklyFundFlows?: {
      topInflows: InflowItem[];
      topOutflows: InflowItem[];
    };
  };
  marketScaleSnapshot?: {
    totalAum: number;
    totalTradeValue: number;
    marketTurnoverPct: number;
    categories: Array<{
      category: string;
      label: string;
      aum: number;
      aumSharePct: number;
      tradeValue: number;
      tradeSharePct: number;
      turnoverPct: number;
    }>;
  };
  marketScaleTimeSeries?: {
    daily: Array<{ key: string; label: string; aum: number; adtv: number; turnoverPct: number; aumChange: number; priceEffect?: number; netInflow?: number }>;
    weekly: Array<{ key: string; label: string; aum: number; adtv: number; turnoverPct: number; aumChange: number; priceEffect?: number; netInflow?: number }>;
    monthly: Array<{ key: string; label: string; aum: number; adtv: number; turnoverPct: number; aumChange: number; priceEffect?: number; netInflow?: number }>;
    yearly: Array<{ key: string; label: string; aum: number; adtv: number; turnoverPct: number; aumChange: number; priceEffect?: number; netInflow?: number }>;
  };
}
