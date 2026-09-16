import fs from 'fs';
import path from 'path';
import { loadEtfs } from '../lib/data/etf-repository';

const fullEtfs = loadEtfs();
const screenerEtfs = fullEtfs.map((etf) => ({
  ticker: etf.ticker,
  name: etf.name,
  baseIndex: etf.baseIndex,
  close: etf.close,
  tradeValue: etf.tradeValue,
  aum: etf.aum,
  fee: etf.fee ? {
    totalFeePct: etf.fee.totalFeePct,
    verificationStatus: etf.fee.verificationStatus,
  } : null,
  issuer: etf.issuer,
  riskType: etf.riskType,
  assetClass: etf.assetClass,
  pension: etf.pension,
  pensionLimit: etf.pensionLimit,
  personalPension: etf.personalPension ?? (etf.riskType === "leverage" || etf.riskType === "inverse" ? "불가" : "가능"),
  personalPensionLimit: etf.personalPensionLimit ?? (etf.riskType === "leverage" || etf.riskType === "inverse" ? "불가" : "100%"),
  personalPensionAsOfDate: etf.personalPensionAsOfDate ?? null,
  pensionSourceType: etf.pensionSourceType,
  pensionVerified: etf.pensionVerified,
  pensionConfidence: etf.pensionConfidence,
  isaEligible: etf.isaEligible,
  isaEducationRequired: etf.isaEducationRequired,
  isaTaxType: etf.isaTaxType,
  isaTaxBenefit: etf.isaTaxBenefit,
  asOfDate: etf.asOfDate,
  returns: etf.returns,
  returnsTr: etf.returnsTr,
  returnsNetTr: etf.returnsNetTr,
  classification: etf.classification,
  listingDate: etf.listingDate,
  distributionYield: etf.distributionYield ?? null,
  distributionCycle: etf.distributionCycle ?? null,
  lastDistributionDate: etf.lastDistributionDate ?? null,
}));

const outPath = path.join(process.cwd(), 'public', 'data', 'screener.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(screenerEtfs, null, 2), 'utf-8');
console.log('Generated ' + outPath + ' (' + screenerEtfs.length + ' ETFs)');

const searchIndex = fullEtfs.map((etf) => ({
  ticker: etf.ticker,
  name: etf.name,
  baseIndex: etf.baseIndex || "",
  assetClass: etf.assetClass,
  aum: etf.aum,
  tradeValue: etf.tradeValue,
  pensionLimit: etf.pensionLimit,
  feePct: etf.fee ? etf.fee.totalFeePct : null,
}));
const searchIndexPath = path.join(process.cwd(), 'public', 'data', 'etf-search-index.json');
fs.writeFileSync(searchIndexPath, JSON.stringify(searchIndex, null, 2), 'utf-8');
console.log('Generated ' + searchIndexPath + ' (' + searchIndex.length + ' ETFs)');


