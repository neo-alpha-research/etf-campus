import { EtfIssuer } from "../domain/etf-types";

// Official registry mapped by ticker or ISIN
// When an official source is verified, we can add it here.
export const OFFICIAL_AMC_REGISTRY: Record<string, EtfIssuer> = {};

export const BRAND_TO_AMC: Record<string, { issuerId: string; issuerName: string }> = {
  "KODEX": { issuerId: "samsung", issuerName: "삼성자산운용" },
  "TIGER": { issuerId: "miraeasset", issuerName: "미래에셋자산운용" },
  "RISE": { issuerId: "kb", issuerName: "KB자산운용" },
  "ACE": { issuerId: "koreainvestment", issuerName: "한국투자신탁운용" },
  "PLUS": { issuerId: "hanwha", issuerName: "한화자산운용" },
  "SOL": { issuerId: "shinhan", issuerName: "신한자산운용" },
  "KIWOOM": { issuerId: "kiwoom", issuerName: "키움투자자산운용" },
  "HANARO": { issuerId: "nhamundi", issuerName: "NH-Amundi자산운용" },
  "1Q": { issuerId: "hana", issuerName: "하나자산운용" },
  "KoAct": { issuerId: "samsungactive", issuerName: "삼성액티브자산운용" },
  "TIME": { issuerId: "timefolio", issuerName: "타임폴리오자산운용" },
  "WON": { issuerId: "woori", issuerName: "우리자산운용" },
  "에셋플러스": { issuerId: "assetplus", issuerName: "에셋플러스자산운용" },
  "BNK": { issuerId: "bnk", issuerName: "BNK자산운용" },
  "IBK": { issuerId: "ibk", issuerName: "IBK자산운용" },
  "마이티": { issuerId: "db", issuerName: "DB자산운용" },
  "HK": { issuerId: "heungkuk", issuerName: "흥국자산운용" },
  "FOCUS": { issuerId: "vi", issuerName: "브이아이자산운용" },
  "UNICORN": { issuerId: "hyundai", issuerName: "현대자산운용" },
  "파워": { issuerId: "kyoboaxa", issuerName: "교보악사자산운용" },
  "MIDAS": { issuerId: "midas", issuerName: "마이다스에셋자산운용" },
  "DAISHIN343": { issuerId: "daishin", issuerName: "대신자산운용" },
  "TREX": { issuerId: "yuri", issuerName: "유리자산운용" },
  "TRUSTON": { issuerId: "truston", issuerName: "트러스톤자산운용" },
  "DS": { issuerId: "ds", issuerName: "DS자산운용" },
  "KCGI": { issuerId: "kcgi", issuerName: "KCGI자산운용" },
  "아이엠에셋": { issuerId: "imasset", issuerName: "iM에셋자산운용" },
  "더제이": { issuerId: "thej", issuerName: "더제이자산운용" },
};

export const LEGACY_BRAND_TO_AMC: Record<string, { issuerId: string; issuerName: string }> = {
  "KBSTAR": { issuerId: "kb", issuerName: "KB자산운용" },
  "KINDEX": { issuerId: "koreainvestment", issuerName: "한국투자신탁운용" },
  "ARIRANG": { issuerId: "hanwha", issuerName: "한화자산운용" },
  "KOSEF": { issuerId: "kiwoom", issuerName: "키움투자자산운용" },
  "히어로즈": { issuerId: "kiwoom", issuerName: "키움투자자산운용" },
  "HEROES": { issuerId: "kiwoom", issuerName: "키움투자자산운용" },
  "KTOP": { issuerId: "hana", issuerName: "하나자산운용" },
  "TIMEFOLIO": { issuerId: "timefolio", issuerName: "타임폴리오자산운용" },
};

export function resolveIssuer(ticker: string, isin: string, name: string): EtfIssuer {
  if (OFFICIAL_AMC_REGISTRY[ticker]) {
    return OFFICIAL_AMC_REGISTRY[ticker];
  }
  if (OFFICIAL_AMC_REGISTRY[isin]) {
    return OFFICIAL_AMC_REGISTRY[isin];
  }

  const brand = name.normalize("NFKC").trim().split(/\s+/)[0];

  if (BRAND_TO_AMC[brand]) {
    const { issuerId, issuerName } = BRAND_TO_AMC[brand];
    return {
      issuerId,
      issuerName,
      brand,
      issuerStatus: "mapped_brand",
      issuerSourceUrl: null,
      issuerVerifiedAt: null,
    };
  }

  if (LEGACY_BRAND_TO_AMC[brand]) {
    const { issuerId, issuerName } = LEGACY_BRAND_TO_AMC[brand];
    return {
      issuerId,
      issuerName,
      brand,
      issuerStatus: "mapped_legacy_brand",
      issuerSourceUrl: null,
      issuerVerifiedAt: null,
    };
  }

  return {
    issuerId: "unknown",
    issuerName: "운용사 확인 필요",
    brand,
    issuerStatus: "needs_review",
    issuerSourceUrl: null,
    issuerVerifiedAt: null,
  };
}
