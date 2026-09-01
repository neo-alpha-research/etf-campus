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
  asOfDate: etf.asOfDate,
  returns: etf.returns,
  returnsTr: etf.returnsTr,
  returnsNetTr: etf.returnsTr ? Object.fromEntries(
    Object.entries(etf.returnsTr).map(([key, trValue]) => {
      const prValue = etf.returns[key as keyof typeof etf.returns];
      if (typeof trValue !== 'number' || typeof prValue !== 'number') return [key, trValue];
      const dividendComponent = Math.max(0, trValue - prValue);
      return [key, prValue + dividendComponent * 0.846];
    })
  ) : null,
  classification: etf.classification,
  listingDate: etf.listingDate,
}));

const outPath = path.join(process.cwd(), 'public', 'data', 'screener.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(screenerEtfs), 'utf-8');
console.log('Generated ' + outPath + ' (' + screenerEtfs.length + ' ETFs)');
