import { useEffect, useRef, useState } from 'react';
import { money, request } from './api';
import type { Scenario, ValuationPriceEvidence as Context } from './types';

function evidenceKey(context: Context | null) {
  return JSON.stringify({ quote: context?.quote, scenarios: context?.scenarios.map(item => ({ id: item.id, createdAt: item.createdAt,
    modelVersion: item.modelVersion, modeledShares: item.modeledShares, valuePerShare: item.valuePerShare })).sort((a, b) => a.id.localeCompare(b.id)) });
}
const dollars = (value: number | null) => value === null || !Number.isFinite(value) ? 'Unavailable' : money(value, false);
export default function ValuationPriceContext({ ticker, scenarios }: { ticker: string; scenarios: Scenario[] }) {
  const confirmedEvidence = useRef('');
  const [notice, setNotice] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [context, setContext] = useState<Context | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { setConfirmed(false); confirmedEvidence.current = ''; }, [ticker, scenarios]);
  useEffect(() => {
    const controller = new AbortController(); setContext(null); setError('');
    request<Context>(`/api/companies/${ticker}/scenarios/price-context?shareBasisConfirmed=${confirmed}`, { signal: controller.signal })
      .then(data => {
        if (controller.signal.aborted) return;
        if (confirmed && evidenceKey(data) !== confirmedEvidence.current) {
          setConfirmed(false); setNotice('The stored comparison evidence changed. Review the close and saved cases, then confirm the share basis again.'); return;
        }
        setContext(data);
      })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [ticker, scenarios, confirmed, attempt]);
  return <section className="valuation-price-context" aria-label="Saved valuations and dated prices">
    <div className="panel-title"><div><span className="eyebrow">MODEL / STORED CLOSE</span><h3>Valuation price context</h3></div><button className="secondary" onClick={() => { setConfirmed(false); setNotice(''); setAttempt(value => value + 1); }}>Recheck valuation price</button></div>
    <p className="muted small">Compare saved modeled value per share with this company's latest stored raw USD close. This is a gap between your assumptions and a dated quote, not a target price, forecast return, or buy/sell signal. Opening this view does not import prices.</p>
    <label className="scenario-pick"><input type="checkbox" checked={confirmed} disabled={!context?.quote || !context.scenarios.length} onChange={event => { confirmedEvidence.current = evidenceKey(context); setNotice(''); setConfirmed(event.target.checked); }} />I checked that every modeled share count and this close use the same share basis.</label>
    <p className="muted small">Review all modeled share counts below before confirming. Raw prices do not verify splits or dividends; the app cannot establish that your assumptions and quote are comparable. Rechecking prices clears this confirmation.</p>
    {notice && <p className="notice warning" role="status">{notice}</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {!context && !error && <p role="status">Checking saved valuations and stored prices…</p>}
    {context && <>
      {context.quoteError && <p className="notice warning" role="status">{context.quoteError} Valuation gaps are unavailable.</p>}
      {context.quote && <p className={`notice ${context.dataMode === 'example' ? 'example' : 'warning'}`} data-testid="valuation-price-evidence">{context.dataMode === 'example' ? 'Invented example close' : 'Stored market close'}: {money(context.quote.close, false)} · {context.quote.priceDate} · {context.quote.priceAgeDays} calendar days old. {context.quote.sourceUrl ? <a href={context.quote.sourceUrl} target="_blank" rel="noreferrer">{context.quote.source} ↗</a> : context.quote.source}. {context.quote.retrievedAt ? `Imported ${new Date(context.quote.retrievedAt).toLocaleString()}.` : 'Fictional data · no market import.'} Evaluated {new Date(context.evaluatedAt).toLocaleString()}.</p>}
      <div className="table-scroll"><table><caption>Saved per-share valuations versus a dated close</caption><thead><tr><th>Saved case / model</th><th>Modeled shares</th><th>Modeled value / share</th><th>Value − close</th><th>(Value − close) / close</th><th>Comparability</th></tr></thead><tbody>{context.scenarios.map(item => <tr key={item.id}><th scope="row">{item.name}<small className="comparison-evidence">{item.modelVersion} · saved {new Date(item.createdAt).toLocaleString()}</small></th><td>{item.modeledShares === null || !Number.isFinite(item.modeledShares) ? 'Unavailable' : item.modeledShares.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td><td>{dollars(item.valuePerShare)}</td><td>{dollars(item.valueMinusClose)}</td><td>{item.relativeGap === null || !Number.isFinite(item.relativeGap * 100) ? 'Unavailable' : `${(item.relativeGap * 100).toFixed(2)}%`}</td><td className="mark-evidence">{item.unavailableReason || 'Share basis confirmed by you; not provider-verified.'}</td></tr>)}{!context.scenarios.length && <tr><td colSpan={6}>Save a valuation scenario to inspect it here.</td></tr>}</tbody></table></div>
      <p className="muted small">The gap uses (modeled value per share − stored close) / stored close. Negative modeled equity values remain negative, so a gap can be below −100%. Saved assumptions can predate the close; this is not a point-in-time backtest. Later price imports change this view without rewriting saved valuations.</p>
    </>}
  </section>;
}
