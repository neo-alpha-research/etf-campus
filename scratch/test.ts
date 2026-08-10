import { loadEtfs } from "../lib/data/etf-repository";
import { filterEtfs, DEFAULT_SCREENER_FILTERS } from "../lib/domain/etf-screener";
import { getEtfStrategies } from "../lib/domain/etf-classification";

const etfs = loadEtfs();
console.log('Total ETFs:', etfs.length);
const activeEtfs = etfs.filter(e => getEtfStrategies(e).includes("액티브"));
console.log('Active count:', activeEtfs.length);
const passiveEtfs = etfs.filter(e => getEtfStrategies(e).includes("패시브"));
console.log('Passive count:', passiveEtfs.length);

const res = filterEtfs(etfs, {
  ...DEFAULT_SCREENER_FILTERS,
  strategies: ["패시브"]
});
console.log('Filtered Passive count:', res.length);
