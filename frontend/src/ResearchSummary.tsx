import { useEffect, useState } from 'react';
import { researchChecks, reviewedCount } from './researchChecklist';
import { researchLink } from './researchNavigation';
import { flushSync } from 'react-dom';
import { money, request } from './api';
import type { Company, FinancialReport, ValuationPriceEvidence, WatchlistEntry } from './types';

type Destination = 'Financials' | 'Valuation' | 'Prices' | 'Watchlist';
const dollars = (value: number | null) => value === null || !Number.isFinite(value) ? 'Unavailable' : money(value, false);
export default function ResearchSummary({ company, report, financialLoading, financialError, onOpen }: {
  company: Company; report: FinancialReport | null; financialLoading: boolean; financialError: string;
  onOpen: (section: Destination) => void;
}) {
  const [entry, setEntry] = useState<WatchlistEntry | null>(null);
  const [notesError, setNotesError] = useState(''); const [notesLoading, setNotesLoading] = useState(true);
  const [context, setContext] = useState<ValuationPriceEvidence | null>(null);
  const [contextError, setContextError] = useState(''); const [contextLoading, setContextLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [preparedAt, setPreparedAt] = useState(() => new Date().toISOString());
  const [printError, setPrintError] = useState('');
  const [copyMessage, setCopyMessage] = useState(''); const [copying, setCopying] = useState(false);
  const link = researchLink(company.ticker, 'Research summary');
  const example = company.ticker === 'DEMO';
  const financials = report?.company.ticker === company.ticker && report.dataMode === (example ? 'example' : 'sec') ? report : null;
  const financialMessage = financialError.includes('SEC_USER_AGENT') ? 'Live SEC access has not been configured for this workspace. Financial facts are unavailable.' : financialError;
  const pending = notesLoading || contextLoading || financialLoading;
  useEffect(() => {
    const prepare = () => flushSync(() => setPreparedAt(new Date().toISOString()));
    window.addEventListener('beforeprint', prepare);
    return () => window.removeEventListener('beforeprint', prepare);
  }, []);
  function printResearch() {
    setPrintError('');
    flushSync(() => setPreparedAt(new Date().toISOString()));
    const originalTitle = document.title;
    document.title = `CapitalScope - ${company.ticker} research summary`;
    // I print the evidence already on screen without importing data or saving a new model.
    try { window.print(); }
    catch { setPrintError('The browser could not open printing. Try its Print command once the summary has loaded.'); }
    finally { document.title = originalTitle; }
  }
  async function copyResearchLink() {
    setCopyMessage(''); setCopying(true);
    try { await navigator.clipboard.writeText(link); setCopyMessage('Research link copied.'); }
    catch { setCopyMessage('Copy is unavailable. Select and copy the link below.'); }
    finally { setCopying(false); }
  }
  useEffect(() => {
    const controller = new AbortController();
    setEntry(null); setNotesError(''); setNotesLoading(true);
    setContext(null); setContextError(''); setContextLoading(true);
    // I load saved notes and price evidence independently so one unavailable section does not hide the other.
    request<WatchlistEntry[]>('/api/watchlist', { signal: controller.signal }).then(entries => {
      if (!controller.signal.aborted) setEntry(entries.find(item => item.ticker === company.ticker) || null);
    }).catch(e => { if (!controller.signal.aborted) setNotesError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setNotesLoading(false); });
    request<ValuationPriceEvidence>(`/api/companies/${company.ticker}/scenarios/price-context?shareBasisConfirmed=false`, { signal: controller.signal }).then(data => {
      if (data.ticker !== company.ticker || data.dataMode !== (example ? 'example' : 'market')) throw new Error('The saved evidence does not match this company and data mode.');
      if (!controller.signal.aborted) setContext(data);
    }).catch(e => { if (!controller.signal.aborted) setContextError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setContextLoading(false); });
    return () => controller.abort();
  }, [company.ticker, example, attempt]);
  return <section className="research-summary" aria-label={`Research summary for ${company.ticker}`}>
    <header className="summary-print-header"><p>CapitalScope / Company research</p><h1>{company.name} ({company.ticker})</h1><p>{company.sector} · {example ? 'Fictional company / invented data' : 'Market instrument / sources shown below'}</p><p data-testid="summary-print-time">Prepared for printing: {preparedAt} (UTC)</p><p>Read-only evidence from different dates, not an atomic snapshot or investment recommendation. Missing sections stay labeled. Unsaved drafts and browser-only notes are excluded.</p></header>
    <div className="panel summary-intro"><div className="panel-title"><div><span className="eyebrow">MY RESEARCH / {company.ticker}</span><h2>My company research summary</h2></div><button className="secondary" onClick={() => setAttempt(value => value + 1)}>Reload saved research</button></div>
      <p className="muted small">A read-only view of saved watchlist research, loaded financial facts, valuation cases, and dated closes. Sections can reflect different dates and are not an atomic snapshot. Reloading here reads saved notes, models, and stored prices; it does not import new prices or refresh financial facts. Unsaved drafts and browser-only research notes are excluded.</p>
      <div className="summary-print-actions"><button className="secondary" type="button" disabled={pending} onClick={printResearch}>Print research summary</button><span className="muted small">Opens your browser's print dialog. Choose Save as PDF if available. Prints the displayed evidence, including unavailable sections, without fetching fresh data.</span></div>
      {printError && <p className="notice error" role="alert">{printError}</p>}
      <div className="summary-share"><button className="secondary" type="button" disabled={copying} onClick={copyResearchLink}>Copy company research link</button><label>Company research link<input readOnly value={link} onFocus={event => event.target.select()} /></label><p className="muted small">Opens this company's summary on the same app instance. The link points to the latest saved evidence, not a frozen report, and does not grant access. Localhost links work only on your computer.</p>{copyMessage && <p role="status" className="save-status">{copyMessage}</p>}</div>
    </div>
    <div className="summary-grid">
      <section className="panel" aria-label="Saved company thesis"><div className="panel-title"><h3>My saved thesis and risks</h3><button className="secondary" onClick={() => onOpen('Watchlist')}>Open watchlist</button></div>
        {notesLoading ? <p role="status">Loading saved research…</p> : notesError ? <p className="notice error" role="alert">{notesError}</p> : !entry ? <p className="muted">No saved watchlist entry for {company.ticker}. Add a thesis and review date in Watchlist.</p> : <>
          <p className="muted small">{entry.status} · Review date: {entry.reviewDate || 'Not set'} · Version {entry.version}<br />Updated {new Date(entry.updatedAt).toLocaleString()} · User-entered research</p>
          <h4>My saved research checklist</h4><p className="muted small">{reviewedCount(entry.checks)} of {researchChecks.length} marked reviewed · self-reported, not verified or an investment score</p><ul className="summary-checklist">{researchChecks.map(check => <li key={check.id}>{check.label}: <strong>{entry.checks?.includes(check.id) ? 'Marked reviewed' : 'Not marked reviewed'}</strong></li>)}</ul><p className="muted small">These checks do not confirm share-basis comparability for a valuation price comparison.</p>
          <h4>Investment thesis</h4><p className="summary-notes">{entry.thesis || 'No thesis saved.'}</p>
          <h4>Risks and evidence to check</h4><p className="summary-notes">{entry.risks || 'No risks saved.'}</p>
          {entry.status === 'archived' && <p className="notice warning">This entry is archived and excluded from active review counts.</p>}
        </>}
      </section>
      <section className="panel" aria-label="Company stored close"><div className="panel-title"><h3>Dated price evidence</h3><button className="secondary" onClick={() => onOpen('Prices')}>Open prices</button></div>
        {contextLoading ? <p role="status">Reading stored price evidence…</p> : contextError ? <p className="notice error" role="alert">{contextError}</p> : context?.quote ? <>
          <p className="summary-close" data-testid="summary-close">{dollars(context.quote.close)}</p>
          <p className="muted small">{example ? 'Invented example close' : 'Stored raw USD market close'} · {context.quote.priceDate} · {context.quote.priceAgeDays} calendar days old</p>
          <p>{context.quote.sourceUrl ? <a href={context.quote.sourceUrl} target="_blank" rel="noreferrer">{context.quote.source} ↗</a> : context.quote.source}</p>
          <p className="muted small">{context.quote.retrievedAt ? `Imported ${new Date(context.quote.retrievedAt).toLocaleString()}` : example ? 'Fictional data · no market import' : 'Import timestamp unavailable'}<br />Evaluated {new Date(context.evaluatedAt).toLocaleString()}</p>
        </> : <p className="notice warning">{context?.quoteError || 'No stored price evidence available.'}</p>}
        <p className="muted small">This is a dated daily close, not a current intraday quote. Raw prices do not verify share-basis comparability with saved models.</p>
      </section>
    </div>
    <section className="panel" aria-label="Company financial evidence"><div className="panel-title"><h3>Latest supported financial facts</h3><button className="secondary" onClick={() => onOpen('Financials')}>Open financials</button></div>
      {financialLoading ? <p role="status">Loading company financial facts…</p> : financialError ? <p className="notice error" role="alert">{financialMessage}</p> : !financials ? <p className="notice warning">Matching financial facts are unavailable.</p> : <>
        <p className="muted small">{financials.source} · {example ? 'Invented example figures' : 'Latest filed or restated annual facts, not point-in-time data'}{financials.retrievedAt ? ` · Retrieved ${new Date(financials.retrievedAt).toLocaleString()}` : ''}</p>
        <div className="table-scroll"><table><caption>Latest available period for each supported metric</caption><thead><tr><th>Metric</th><th>Value / unit</th><th>Period ended</th><th>Filed / source</th></tr></thead><tbody>{financials.metrics.map(metric => {
          const latest = [...metric.annualValues].sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))[0];
          return <tr key={metric.name}><th scope="row">{metric.name}</th><td>{latest ? metric.unit === 'USD' ? dollars(latest.value) : `${latest.value.toLocaleString()} ${metric.unit}` : 'Unavailable'}</td><td>{latest?.periodEnd || '—'}</td><td>{latest && !example ? <>{latest.filed || 'Filing date unavailable'}{latest.sourceUrl && <><br /><a href={latest.sourceUrl} target="_blank" rel="noreferrer">SEC filing ↗</a></>}</> : example ? 'Example only' : 'Unavailable'}</td></tr>;
        })}</tbody></table></div>
        <p className="muted small">Periods can differ by metric. Missing facts are unavailable, not zero; financial periods and filing dates differ from price dates. Open Financials for accounting tags and full data notes.</p>
      </>}
    </section>
    <section className="panel" aria-label="Company saved valuation cases"><div className="panel-title"><h3>My saved valuation cases</h3><button className="secondary" onClick={() => onOpen('Valuation')}>Open valuation</button></div>
      {contextLoading ? <p role="status">Loading saved model cases…</p> : contextError ? <p className="notice error" role="alert">{contextError}</p> : !context?.scenarios.length ? <p className="muted">No saved valuation cases for {company.ticker}. Some sectors require a specialized model.</p> : <div className="table-scroll"><table><caption>Saved assumptions expressed as modeled value per share</caption><thead><tr><th>Case / saved date</th><th>Model</th><th>Modeled shares</th><th>Modeled value / share</th></tr></thead><tbody>{context.scenarios.map(item => <tr key={item.id}><th scope="row">{item.name}<small className="comparison-evidence">{new Date(item.createdAt).toLocaleString()}</small></th><td>{item.modelVersion}{item.modelVersion !== 'fcff-v1' && <small className="comparison-evidence">Unsupported for price comparison</small>}</td><td>{item.modeledShares === null || !Number.isFinite(item.modeledShares) ? 'Unavailable' : item.modeledShares.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td><td>{dollars(item.valuePerShare)}</td></tr>)}</tbody></table></div>}
      <p className="muted small">Saved cases reflect your assumptions, not price forecasts or investment recommendations. This summary does not calculate a value-versus-close gap. Open Valuation to inspect assumptions and confirm share-basis comparability before comparing a model with a stored close.</p>
    </section>
  </section>;
}
