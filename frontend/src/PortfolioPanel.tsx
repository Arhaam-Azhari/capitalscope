import { useEffect, useRef, useState, type FormEvent } from 'react';
import PortfolioValuation from './PortfolioValuation';
import PortfolioActions from './PortfolioActions';
import { money, request } from './api';
import type { Company, Portfolio, PortfolioSummary } from './types';

export default function PortfolioPanel({ companies }: { companies: Company[] }) {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selected, setSelected] = useState('');
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [name, setName] = useState(''); const [mode, setMode] = useState('example'); const [cash, setCash] = useState('100000');
  const [side, setSide] = useState('BUY'); const [ticker, setTicker] = useState('AAPL');
  const [quantity, setQuantity] = useState(''); const [price, setPrice] = useState(''); const [fee, setFee] = useState('0');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true); const [attempt, setAttempt] = useState(0);
  const pending = useRef<{ signature: string; id: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    request<Portfolio[]>('/api/portfolios', { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) { setPortfolios(data); setSelected(current => current || data[0]?.id || ''); }
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => {
    const controller = new AbortController(); setSummary(null);
    if (selected) request<PortfolioSummary>(`/api/portfolios/${selected}`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setSummary(data); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [selected, attempt]);
  async function create(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const data = await request<PortfolioSummary>('/api/portfolios', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mode, initialCash: cash }) });
      setPortfolios(current => [data.portfolio, ...current]); setSelected(data.portfolio.id); setName('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create the portfolio.'); }
    finally { setBusy(false); }
  }
  async function trade(event: FormEvent) {
    event.preventDefault(); if (!summary) return;
    const fill = { ticker: summary.portfolio.mode === 'example' ? 'DEMO' : ticker, side,
      quantity, price, fee };
    const signature = JSON.stringify([selected, fill]);
    if (pending.current?.signature !== signature) pending.current = { signature, id: crypto.randomUUID() };
    setBusy(true); setError('');
    try {
      const data = await request<PortfolioSummary>(`/api/portfolios/${selected}/trades`, { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...fill, requestId: pending.current!.id }) });
      setSummary(data); setQuantity(''); setPrice(''); setFee('0'); pending.current = null;
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not record the fill.'); }
    finally { setBusy(false); }
  }
  return <section className="panel" aria-labelledby="portfolio-heading">
    <div className="panel-title"><div><span className="eyebrow">PRACTICE WORKSPACE</span><h2 id="portfolio-heading">Simulated portfolios</h2></div></div>
    <p className="notice example">All trades are simulated. Enter a manual fill price; this app does not send orders to a broker or automatically execute at market quotes.</p>
    <p className="muted small">This is a shared workspace without accounts. Everyone with app access can inspect portfolios and record fills.</p>
    {error && <div className="notice error" role="alert">{error}<button className="secondary" disabled={busy} onClick={() => setAttempt(n => n + 1)}>Reload portfolios</button></div>}
    <details className="portfolio-create" open={!portfolios.length}><summary>Create a practice portfolio</summary><form onSubmit={create}><div className="model-fields">
      <label>Portfolio name<input required maxLength={80} value={name} onChange={e => setName(e.target.value)} /></label>
      <label>Portfolio instruments<select value={mode} onChange={e => setMode(e.target.value)}><option value="example">Fictional DEMO company</option><option value="market">Real catalog tickers · simulated fills</option></select></label>
      <label>Starting cash (USD)<input type="number" required min="0.01" max="1000000000" step="0.01" value={cash} onChange={e => setCash(e.target.value)} /></label>
    </div><button className="primary" type="submit" disabled={busy}>Create portfolio</button></form></details>
    {loading ? <p role="status">Loading portfolios…</p> : portfolios.length > 0 && <label className="portfolio-picker">Open portfolio<select disabled={busy} value={selected} onChange={e => { setSelected(e.target.value); setError(''); pending.current = null; }}>{portfolios.map(item => <option key={item.id} value={item.id}>{item.name} · {item.mode === 'example' ? 'fictional' : 'catalog'}</option>)}</select></label>}
    {summary && <>
      <div className="panel-title"><h3>{summary.portfolio.name}</h3><a className="secondary export-link" href={`/api/portfolios/${summary.portfolio.id}/export.csv`}>Download event CSV</a></div>
      <div className="result-summary"><div><span>Available cash</span><strong data-testid="portfolio-cash">{money(summary.cash, false)}</strong></div><div><span>Realized P&amp;L</span><strong data-testid="portfolio-realized">{money(summary.realizedPnl, false)}</strong></div><div><span>Cash dividends received</span><strong data-testid="portfolio-dividends">{money(summary.dividendIncome, false)}</strong></div><div><span>Starting cash</span><strong>{money(summary.portfolio.initialCash, false)}</strong></div></div>
      <div className="table-scroll"><table><caption>Holdings at weighted-average cost</caption><thead><tr><th>Ticker</th><th>Shares</th><th>Cost basis</th><th>Average cost / share</th></tr></thead><tbody>{summary.positions.map(position => <tr key={position.ticker}><th scope="row">{position.ticker}</th><td>{position.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td><td>{money(position.costBasis, false)}</td><td>{money(position.averageCost, false)}</td></tr>)}{!summary.positions.length && <tr><td colSpan={4}>No open positions.</td></tr>}</tbody></table></div>
      <p className="muted small">Cost basis includes buy fees. Realized P&amp;L deducts sell fees using weighted-average cost. This is a practice convention, not a tax-lot calculation. The valuation below uses stored daily closes separately from the trade ledger.</p>
      <PortfolioValuation summary={summary} />
      <form onSubmit={trade}><h3>Record a simulated fill</h3><div className="model-fields">
        {summary.portfolio.mode === 'market' ? <label>Trade company<select disabled={busy} value={ticker} onChange={e => setTicker(e.target.value)}>{companies.map(c => <option key={c.ticker} value={c.ticker}>{c.name} ({c.ticker})</option>)}</select></label> : <p className="notice example">This portfolio only holds the fictional DEMO company.</p>}
        <label>Trade side<select disabled={busy} value={side} onChange={e => setSide(e.target.value)}><option>BUY</option><option>SELL</option></select></label>
        <label>Shares to trade<input disabled={busy} type="number" required min="0.000001" max="1000000000" step="0.000001" value={quantity} onChange={e => setQuantity(e.target.value)} /></label>
        <label>Manual fill price (USD)<input disabled={busy} type="number" required min="0.0001" max="1000000000" step="0.0001" value={price} onChange={e => setPrice(e.target.value)} /></label>
        <label>Trade fee (USD)<input disabled={busy} type="number" required min="0" max="1000000000" step="0.01" value={fee} onChange={e => setFee(e.target.value)} /></label>
      </div><button className="primary" type="submit" disabled={busy}>{busy ? 'Recording…' : 'Record simulated fill'}</button></form>
      <PortfolioActions key={summary.portfolio.id} summary={summary} busy={busy} setBusy={setBusy} onSaved={setSummary} />
      <div className="table-scroll"><table><caption>Recorded simulated fills, oldest first</caption><thead><tr><th>Recorded</th><th>Ticker</th><th>Side</th><th>Shares</th><th>Manual price</th><th>Fee</th></tr></thead><tbody>{summary.trades.map(fill => <tr key={fill.requestId}><td>{new Date(fill.recordedAt).toLocaleString()}</td><td>{fill.ticker}</td><td>{fill.side}</td><td>{fill.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td><td>{money(fill.price, false)}</td><td>{money(fill.fee, false)}</td></tr>)}</tbody></table></div>
    </>}
  </section>;
}
