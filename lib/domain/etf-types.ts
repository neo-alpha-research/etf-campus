export const ASSET_CLASSES = [
  "주식-국내",
  "주식-해외",
  "채권",
  "금리·파킹",
  "원자재",
  "리츠·인프라",
  "혼합·자산배분",
] as const;

export const RISK_TYPES = ["normal", "leverage", "inverse"] as const;
export const PENSION_STATUSES = ["가능", "불가", "확인중"] as const;
export const RETURN_PERIODS = ["1d", "1w", "2w", "1m", "2m", "3m", "6m", "ytd", "12m", "24m", "36m"] as const;

export const RETURN_PERIOD_LABELS = {
  "1d": "1일",
  "1w": "1주",
  "2w": "2주",
  "1m": "1개월",
  "2m": "2개월",
  "3m": "3개월",
  "6m": "6개월",
  "ytd": "YTD",
  "12m": "1년",
  "24m": "2년",
  "36m": "3년",
} as const;

export type AssetClass = (typeof ASSET_CLASSES)[number];
export type RiskType = (typeof RISK_TYPES)[number];
export type PensionStatus = (typeof PENSION_STATUSES)[number];
export type ReturnPeriod = (typeof RETURN_PERIODS)[number];
export type EtfReturns = Record<ReturnPeriod, number | null>;

export type EtfClassification = {
  published: boolean;
  marketScope: string | null;
  assetClass: string | null;
  assetDetail: string | null;
  strategy: string | null;
  fxHedge: string | null;
  reviewStatus: string;
  reviewPriority: string;
  sourceUrl: string | null;
  evidenceSummary: string | null;
};

export type Etf = {
  isin: string;
  ticker: string;
  name: string;
  baseIndex: string;
  close: number;
  changePct: number;
  tradeValue: number;
  aum: number;
  riskType: RiskType;
  assetClass: AssetClass;
  pension: PensionStatus;
  pensionSource: string;
  liquidity: string;
  asOfDate: string;
  listingDate: string | null;
  listingDateSource: string | null;
  returns: EtfReturns;
  isNew90d: boolean | null;
  isNew3m: boolean;
  classification?: EtfClassification | null;
};
