export const ASSET_CLASSES = [
  "주식-국내",
  "주식-해외",
  "채권",
  "금리·파킹",
  "원자재",
  "리츠·인프라",
  "혼합·자산배분",
] as const;

export const MARKET_SCOPES = ["국내", "미국", "중국", "일본", "인도", "유럽", "선진국", "신흥국", "글로벌", "아시아", "베트남", "필리핀", "러시아", "중남미", "멕시코", "싱가포르", "대만", "해당없음"] as const;
export const STRATEGIES = ["?⑥떆釉?", "?≫떚釉?", "而ㅻ쾭?쒖퐳"] as const;
export const FX_HEDGES = ["鍮꾪뿤吏", "?ㅼ?", "遺遺??ㅼ?", "?꾨젰 ?ㅼ?"] as const;

export const RISK_TYPES = ["normal", "leverage", "inverse"] as const;
export const PENSION_STATUSES = ["가능", "불가", "확인중"] as const;
export const RETURN_PERIODS = ["1d", "1w", "2w", "1m", "2m", "3m", "6m", "12m", "24m", "36m", "ytd", "itd"] as const;

export const RETURN_PERIOD_LABELS = {
  "1d": "1??",
  "1w": "1二?",
  "2w": "2二?",
  "1m": "1媛쒖썡",
  "2m": "2媛쒖썡",
  "3m": "3媛쒖썡",
  "6m": "6媛쒖썡",
  "ytd": "?곗큹??",
  "12m": "1??",
  "24m": "2??",
  "36m": "3??",
  itd: "?곸옣 ??",
} as const;

export type AssetClass = (typeof ASSET_CLASSES)[number];
export type MarketScope = (typeof MARKET_SCOPES)[number];
export type Strategy = (typeof STRATEGIES)[number];
export type FxHedge = (typeof FX_HEDGES)[number];
export type RiskType = (typeof RISK_TYPES)[number];
export type PensionStatus = (typeof PENSION_STATUSES)[number];export type IssuerStatus = "verified_official" | "mapped_brand" | "mapped_legacy_brand" | "conflict" | "needs_review";

export type EtfIssuer = {
  issuerId: string;
  issuerName: string;
  brand: string;
  issuerStatus: IssuerStatus;
  issuerSourceUrl: string | null;
  issuerVerifiedAt: string | null;
};

export type ReturnPeriod = (typeof RETURN_PERIODS)[number];
export type EtfReturns = Record<ReturnPeriod, number | null>;

export type ItdAnchor = {
  price: number | null;
  date: string | null;
  source: string | null;
  qualityStatus: string | null;
  verified: boolean;
};

export type EtfFeeInfo = {
  totalFeePct: number | null;
  terPct: number | null;
  otherCostPct: number | null;
  tradingCostPct: number | null;
  effectiveDate: string | null;
  verifiedAt: string | null;
  verificationStatus:
    | "verified_official"
    | "official_single_source"
    | "seed_unverified"
    | "conflict"
    | "pending_review"
    | "stale";
  primarySourceType: string | null;
  primarySourceUrl: string | null;
  dartReceiptNo: string | null;
  secondarySourceUrl: string | null;
  sourceNote: string | null;
};

export type EtfDistributionEvent = {
  eventId: string | null;
  sourceId: string | null;
  sourceOwner: string | null;
  amountKrw: number;
  exDate: string | null;
  recordDate: string | null;
  payDate: string | null;
  distributionType: string;
  displayStatus: "issuer_notice" | "krx_official_partial";
  displayLabel: string;
  updatedAt: string | null;
};

export type EtfDistributionSummary = {
  ticker: string;
  sourceStatus: "issuer_notice" | "krx_official_partial" | "mixed_official_sources";
  sourceLabel: string;
  latest: EtfDistributionEvent;
  records: EtfDistributionEvent[];
  eventCount: number;
  updatedAt: string;
};

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

export type ListingDateStatus =
  | "verified_official"
    | "official_single_source"
  | "official_notice_pending_isin"
  | "provisional_first_trade"
  | "conflict"
  | "manual_review"
  | "unavailable";

export type Etf = {
  isin: string;
  ticker: string;
  name: string;
  baseIndex: string;
  close: number;
  changePct: number;
  tradeValue: number;
  aum: number;
  fee?: EtfFeeInfo | null;
  distributionSummary?: EtfDistributionSummary | null;

  issuer: EtfIssuer;
  riskType: RiskType;
  assetClass: AssetClass;
  pension: PensionStatus;
  pensionSource: string;
  liquidity: string;
  asOfDate: string;
  listingDate: string | null;
  listingDateSource: string | null;
  listingDateStatus: ListingDateStatus | null;
  firstTradedDate: string | null;
  firstTradedDateSource: string | null;
  listingDateVerifiedAt: string | null;
  listingDateEvidenceId: string | null;
  returns: EtfReturns;
  itdAnchor?: ItdAnchor;
  isNew90d: boolean | null;
  isNew3m: boolean;
  classification?: EtfClassification | null;
};

export type EtfSlim = Pick<Etf, "ticker" | "name" | "baseIndex" | "assetClass" | "riskType" | "pension" | "tradeValue"> & {
  // We can include a pre-computed searchKey if we want, or just compute on the fly.
};


