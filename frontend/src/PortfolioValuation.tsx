import PortfolioRebalancePanel from './PortfolioRebalancePanel';
import PortfolioStressPanel from './PortfolioStressPanel';
import PortfolioAllocationPanel from './PortfolioAllocationPanel';
import { useEffect, useState } from 'react';
import { money, request } from './api';
import type { Company, PortfolioSummary, PortfolioMarks } from './types';

export default function PortfolioValuation({ summary, companies }: { summary: PortfolioSummary; companies: Company[] }) {
  const [marks, setMarks] = useState<PortfolioMarks | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setMarks(null); setError('');
    request<PortfolioMarks>(`/api/portfolios/${summary.portfolio.id}/valuation`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setMarks(data); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [summary, attempt]);
  return <section className="portfolio-marks" aria-labelledby="marks-heading">
    <div className="panel-title"><div><span className="eyebrow">DAILY CLOSE SNAPSHOTS</span><h3 id="marks-heading">Holdings valuation</h3></div><button className="secondary" onClick={() => setAttempt(n => n + 1)}>Recheck stored prices</button></div>
    <p className="muted small">Current recorded shares × latest stored raw daily close. Import company prices in the Prices tab, then recheck here. This is an estimate from dated snapshots, not a live account value or a performance return. Manual splits must match the price's share basis; recording an event does not verify it with the provider.</p>
    {error && <p className="notice error" role="alert">{error}</p>}
    {!marks && !error && <p role="status">Valuing recorded holdings…</p>}
    {marks && <>
      <p className={`notice ${marks.dataMode === 'example' ? 'example' : 'warning'}`}>{marks.dataMode === 'example' ? 'These closes are invented example prices.' : 'These are stored market snapshots, not live quotes.'} {marks.pricedPositions} of {marks.totalPositions} open holdings priced. Evaluated {new Date(marks.evaluatedAt).toLocaleString()}.</p>
      {!marks.complete && <p className="notice warning" role="status">Portfolio totals are unavailable until every open holding has a usable close. The priced subtotal excludes unavailable holdings.</p>}
      <div className="result-summary"><div><span>Priced holdings subtotal</span><strong data-testid="portfolio-priced-value">{money(marks.pricedHoldingsValue, false)}</strong></div><div><span>Cash + all holdings</span><strong data-testid="portfolio-total-value">{marks.totalValue === null ? 'Unavailable' : money(marks.totalValue, false)}</strong></div><div><span>Unrealized P&amp;L · open holdings</span><strong data-testid="portfolio-unrealized">{marks.unrealizedPnl === null ? 'Unavailable' : money(marks.unrealizedPnl, false)}</strong></div></div>
      <div className="table-scroll"><table><caption>Current holdings valued at stored daily closes</caption><thead><tr><th>Ticker / shares</th><th>Raw close</th><th>Price date / age</th><th>Holding value</th><th>Unrealized P&amp;L</th><th>Evidence</th></tr></thead><tbody>{marks.holdings.map(mark => <tr key={mark.ticker}><th scope="row">{mark.ticker}<small className="comparison-evidence">{mark.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 })} shares</small></th><td>{mark.close === null ? '—' : money(mark.close, false)}</td><td>{mark.priceDate || '—'}{mark.priceAgeDays !== null && <small className="comparison-evidence">{mark.priceAgeDays} calendar days old</small>}</td><td>{mark.value === null ? 'Unavailable' : money(mark.value, false)}</td><td>{mark.unrealizedPnl === null ? '—' : money(mark.unrealizedPnl, false)}</td><td className="mark-evidence">{mark.error || <>{mark.sourceUrl ? <a href={mark.sourceUrl} target="_blank" rel="noreferrer">{mark.source} ↗</a> : mark.source}<small className="comparison-evidence">{mark.retrievedAt ? `Imported ${new Date(mark.retrievedAt).toLocaleString()}` : 'Fictional data · no market import'}</small></>}</td></tr>)}{!marks.holdings.length && <tr><td colSpan={6}>No open holdings. Total value is available cash.</td></tr>}</tbody></table></div>
      <PortfolioAllocationPanel marks={marks} />
      <PortfolioRebalancePanel key={`${marks.portfolioId}:${marks.evaluatedAt}:${attempt}`} marks={marks} companies={companies} />
      <PortfolioStressPanel key={marks.evaluatedAt} marks={marks} />
      <p className="muted small">Unrealized P&amp;L compares the marked holdings with their remaining fee-inclusive cost basis. Cash already includes recorded sales, fees, and dividends. Prices can have different dates; price age is measured in calendar days. Estimated selling costs and historical or annualized returns are not included.</p>
    </>}
  </section>;
}
