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
export const RETURN_PERIODS = ["1m", "2m", "3m", "6m", "12m"] as const;

export type AssetClass = (typeof ASSET_CLASSES)[number];
export type RiskType = (typeof RISK_TYPES)[number];
export type PensionStatus = (typeof PENSION_STATUSES)[number];
export type ReturnPeriod = (typeof RETURN_PERIODS)[number];
export type EtfReturns = Record<ReturnPeriod, number | null>;

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
  returns: EtfReturns;
  isNew3m: boolean;
};

