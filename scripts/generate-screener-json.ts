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
  pensionSourceType: etf.pensionSourceType,
  pensionConfidence: etf.pensionConfidence,
  isaEligible: etf.isaEligible,
  isaEducationRequired: etf.isaEducationRequired,
  asOfDate: etf.asOfDate,
  returns: etf.returns,
  returnsTr: etf.returnsTr,
  returnsNetTr: etf.returnsNetTr,
  classification: etf.classification,
  listingDate: etf.listingDate,
}));

const outPath = path.join(process.cwd(), 'public', 'data', 'screener.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(screenerEtfs), 'utf-8');
console.log('Generated ' + outPath + ' (' + screenerEtfs.length + ' ETFs)');
