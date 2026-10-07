import { money } from './api';
import type { Exposure, PortfolioMarks } from './types';

const percent = (weight: number | null) => weight === null ? 'Unavailable' : `${(weight * 100).toFixed(1)}%`;
function Weight({ exposure }: { exposure: Exposure }) {
  return <><span>{percent(exposure.weight)}</span>{exposure.weight !== null && <meter className="allocation-meter" min={0} max={1} value={exposure.weight} aria-label={`${exposure.label} portfolio weight`}>{percent(exposure.weight)}</meter>}</>;
}
function Breakdown({ title, entries, cash, cashWeight }: { title: string; entries: Exposure[]; cash: number; cashWeight: number | null }) {
  return <div className="table-scroll"><table><caption>{title}</caption><thead><tr><th>Exposure</th><th>Snapshot value</th><th>Portfolio weight</th></tr></thead><tbody>
    <tr><th scope="row">Cash</th><td>{money(cash, false)}</td><td><Weight exposure={{ label: 'Cash', value: cash, weight: cashWeight }} /></td></tr>
    {entries.map(exposure => <tr key={exposure.label}><th scope="row">{exposure.label}</th><td>{exposure.value === null ? 'Unavailable' : money(exposure.value, false)}</td><td><Weight exposure={exposure} /></td></tr>)}
  </tbody></table></div>;
}
export default function PortfolioAllocationPanel({ marks }: { marks: PortfolioMarks }) {
  const allocation = marks.allocation;
  return <section className="portfolio-allocation" aria-labelledby="allocation-heading">
    <div className="panel-title"><div><span className="eyebrow">EXPOSURE / SNAPSHOT</span><h3 id="allocation-heading">Portfolio concentration</h3></div><span className="pill">{marks.dataMode === 'example' ? 'Fictional example' : 'Stored daily closes'}</span></div>
    <p className="muted small">Company and sector weights include cash in the denominator. This describes concentration in your recorded holdings at dated closes; it does not estimate volatility, correlation, or diversification benefits.</p>
    {!allocation.available && <p className="notice warning" role="status">{allocation.unavailableReason} All weights and largest-exposure summaries are unavailable. An affected sector's value is also unavailable.</p>}
    <div className="result-summary"><div><span>Cash weight</span><strong data-testid="allocation-cash-weight">{percent(allocation.cashWeight)}</strong></div>
      <div><span>Largest company exposure</span><strong data-testid="allocation-largest-company">{allocation.largestHolding ? `${allocation.largestHolding.label} · ${percent(allocation.largestHolding.weight)}` : allocation.available ? 'No holdings' : 'Unavailable'}</strong></div>
      <div><span>Top three companies · combined</span><strong data-testid="allocation-top-three">{percent(allocation.topThreeHoldingsWeight)}</strong></div>
      <div><span>Largest sector exposure</span><strong data-testid="allocation-largest-sector">{allocation.largestSector ? `${allocation.largestSector.label} · ${percent(allocation.largestSector.weight)}` : allocation.available ? 'No sectors' : 'Unavailable'}</strong></div></div>
    <div className="allocation-breakdowns"><Breakdown title="Company allocation including cash" entries={allocation.companies} cash={marks.cash} cashWeight={allocation.cashWeight} /><Breakdown title="Sector allocation including cash" entries={allocation.sectors} cash={marks.cash} cashWeight={allocation.cashWeight} /></div>
    <p className="muted small">Sectors use the fixed company catalog's labels. Cash is shown separately and excluded from the largest company, largest sector, and top-three-company rankings. Displayed percentages are rounded and may not sum to exactly 100%. Price evidence appears in the holdings table above.</p>
  </section>;
}
