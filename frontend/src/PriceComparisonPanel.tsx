import { useEffect, useRef, useState, type FormEvent } from 'react';
import { comparePrices, priceComparisonCsv } from './priceComparison';
import { priceDrawdown } from './priceDrawdown';
import { money, request } from './api';
import type { Company, PriceHistory } from './types';

export default function PriceComparisonPanel({ history, companies }: { history: PriceHistory; companies: Company[] }) {
  const dates = history.days.map(day => day.date).sort();
  const [start, setStart] = useState(dates[0] || '');
  const [end, setEnd] = useState(dates[dates.length - 1] || '');
  const [ticker, setTicker] = useState('');
  const [snapshot, setSnapshot] = useState<{ result: ReturnType<typeof comparePrices>; reference: PriceHistory; calculatedAt: string } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  function clear() { pending.current?.abort(); setSnapshot(null); setError(''); setLoading(false); }
  async function calculate(event: FormEvent) {
    event.preventDefault(); clear();
    const controller = new AbortController(); pending.current = controller; setLoading(true);
    try {
      if (!companies.some(company => company.ticker === ticker && ticker !== history.ticker && ticker !== 'DEMO')) throw new Error('Choose a different company from the market catalog.');
      priceDrawdown(history, start, end);
      const reference = await request<PriceHistory>(`/api/companies/${encodeURIComponent(ticker)}/prices`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (reference.ticker !== ticker) throw new Error('The returned prices do not match the selected comparison company.');
      setSnapshot({ result: comparePrices(history, reference, start, end), reference, calculatedAt: new Date().toISOString() });
    } catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }
  function download() {
    if (!snapshot) return;
    try {
      const csv = priceComparisonCsv(history, snapshot.reference, snapshot.result, snapshot.calculatedAt, new Date().toISOString());
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = `${history.ticker}-${snapshot.reference.ticker}-price-comparison.csv`;
      try { link.click(); } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch { setError('The price comparison CSV could not be prepared. Please try again.'); }
  }
  const result = snapshot?.result;
  const values = result?.rows.flatMap(row => [row.currentIndex, row.referenceIndex]) || [];
  const low = Math.min(...values); const high = Math.max(...values);
  const points = (field: 'currentIndex' | 'referenceIndex') => result!.rows.map((row, i) => `${45 + i / (result!.rows.length - 1) * 440},${170 - (row[field] - low) / (high - low || 1) * 130}`).join(' ');
  return <section aria-labelledby="price-comparison-heading">
    <h3 id="price-comparison-heading">Compare company prices</h3>
    <p className="muted small">Choose a second market company and load its stored closes. Both series start at 100 on the first date they share in this inclusive window. Only exact shared dates are used; omitted dates can hide larger declines. Splits and dividends are unadjusted, so these price changes are not total returns or investment rankings.</p>
    <form onSubmit={calculate}><div className="stress-inputs">
      <label>Comparison company<select required value={ticker} onChange={event => { clear(); setTicker(event.target.value); }}><option value="">Choose a company</option>{companies.filter(company => company.ticker !== history.ticker && company.ticker !== 'DEMO').map(company => <option key={company.ticker} value={company.ticker}>{company.ticker} · {company.name}</option>)}</select></label>
      <label>Price comparison start date<input type="date" required value={start} onChange={event => { clear(); setStart(event.target.value); }} /></label>
      <label>Price comparison end date<input type="date" required value={end} onChange={event => { clear(); setEnd(event.target.value); }} /></label>
    </div><button className="secondary" disabled={loading || !ticker}>Load price comparison</button></form>
    {loading && <p role="status">Loading comparison prices…</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {snapshot && result && <>
      <p className="muted small">{result.rows.length} shared observations: {result.rows[0].date} through {result.rows[result.rows.length - 1].date}. Excluded in-window observations: {history.ticker} {result.currentExcluded}; {snapshot.reference.ticker} {result.referenceExcluded}. No dates are filled in.</p>
      <p className="muted small">{history.ticker}: {history.source} · Retrieved {history.retrievedAt || 'Not supplied'}. {snapshot.reference.ticker}: {snapshot.reference.source} · Retrieved {snapshot.reference.retrievedAt || 'Not supplied'}. The current series is the already loaded snapshot; reference prices are read separately. Calculated {new Date(snapshot.calculatedAt).toLocaleString()}.</p>
      <div className="table-scroll"><table><caption>Shared-date price comparison summary</caption><thead><tr><th>Company</th><th>Window raw-price change</th><th>Shared-date maximum decline</th></tr></thead><tbody>
        <tr><th scope="row">{history.ticker}</th><td>{result.currentChangePercent.toFixed(2)}%</td><td>{result.currentMaximumDeclinePercent.toFixed(2)}%</td></tr>
        <tr><th scope="row">{snapshot.reference.ticker}</th><td>{result.referenceChangePercent.toFixed(2)}%</td><td>{result.referenceMaximumDeclinePercent.toFixed(2)}%</td></tr>
      </tbody></table></div>
      <div className="trend"><svg viewBox="0 0 520 220" role="img" aria-label="Company raw closes indexed to 100; exact shared-date values are in the table">
        <text x="45" y="25">{high.toFixed(2)}</text><text x="45" y="195">{low.toFixed(2)}</text>
        <polyline fill="none" stroke="var(--accent)" strokeWidth="3" points={points('currentIndex')} />
        <polyline fill="none" stroke="#6ee7b7" strokeWidth="3" strokeDasharray="6 4" points={points('referenceIndex')} />
        <text x="45" y="215">{result.rows[0].date}</text><text x="485" y="215" textAnchor="end">{result.rows[result.rows.length - 1].date}</text>
      </svg><p className="muted small">{history.ticker}: solid violet; {snapshot.reference.ticker}: dashed green. Vertical axis spans observed index values and does not start at zero. Dates are spaced by observation order, not calendar time.</p></div>
      <div className="table-scroll"><table><caption>Shared-date raw closes and index values</caption><thead><tr><th>Date</th><th>{history.ticker} raw close</th><th>{snapshot.reference.ticker} raw close</th><th>{history.ticker} index</th><th>{snapshot.reference.ticker} index</th></tr></thead><tbody>{result.rows.map(row => <tr key={row.date}><th scope="row">{row.date}</th><td>{money(row.currentClose, false)}</td><td>{money(row.referenceClose, false)}</td><td>{row.currentIndex.toFixed(2)}</td><td>{row.referenceIndex.toFixed(2)}</td></tr>)}</tbody></table></div>
      <div className="export-actions"><button className="secondary" onClick={download}>Download price comparison CSV</button><p className="muted small">Exports shared closes, unrounded indices and metrics, coverage counts, each source and retrieval date, and model limits.</p></div>
    </>}
  </section>;
}
