export const ASSET_CLASSES = [
  "주식-국내",
  "주식-해외",
  "채권",
  "금리·파킹",
  "원자재",
  "리츠·인프라",
  "혼합·자산배분",
] as const;

export const MARKET_SCOPES = ["국내", "미국", "중국", "일본", "인도", "유럽", "신흥국", "글로벌"] as const;
export const STRATEGIES = ["액티브", "커버드콜"] as const;
export const FX_HEDGES = ["비헤지", "헤지", "부분 헤지", "탄력 헤지"] as const;

export const RISK_TYPES = ["normal", "leverage", "inverse"] as const;
export const PENSION_STATUSES = ["가능", "불가", "확인중"] as const;
export const DIVIDEND_FREQUENCIES = ["월배당", "분기배당", "반기배당", "연배당", "미지급(TR 등)"] as const;
export const AMC_TYPES = ["삼성", "미래에셋", "KB", "한국투자", "신한", "기타"] as const;
export const RETURN_PERIODS = ["1d", "1w", "2w", "1m", "2m", "3m", "6m", "12m", "24m", "36m", "ytd", "itd"] as const;

export const RETURN_PERIOD_LABELS = {
  "1d": "1일",
  "1w": "1주",
  "2w": "2주",
  "1m": "1개월",
  "2m": "2개월",
  "3m": "3개월",
  "6m": "6개월",
  "ytd": "연초 후",
  "12m": "1년",
  "24m": "2년",
  "36m": "3년",
  itd: "상장 후",
} as const;

export type AssetClass = (typeof ASSET_CLASSES)[number];
export type MarketScope = (typeof MARKET_SCOPES)[number];
export type Strategy = (typeof STRATEGIES)[number];
export type FxHedge = (typeof FX_HEDGES)[number];
export type RiskType = (typeof RISK_TYPES)[number];
export type PensionStatus = (typeof PENSION_STATUSES)[number];
export type DividendFrequency = (typeof DIVIDEND_FREQUENCIES)[number];
export type AmcType = (typeof AMC_TYPES)[number];
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
  ter: number;
  dividendFrequency: DividendFrequency;
  amc: AmcType;
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
