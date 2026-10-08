import { useEffect, useMemo, useRef, useState } from 'react';
import { request } from './api';
import type { Company, FinancialReport } from './types';
import FinancialOverview from './FinancialOverview';
import ValuationPanel from './ValuationPanel';
import CompanyComparison from './CompanyComparison';
import PricePanel from './PricePanel';
import PortfolioPanel from './PortfolioPanel';
import WatchlistPanel from './WatchlistPanel';
import ResearchNotes from './ResearchNotes';
import ResearchSummary from './ResearchSummary';

const demo: Company = { ticker: 'DEMO', name: 'Example Manufacturing', sector: 'Industrials' };
const tabs = ['Financials', 'Research summary', 'Valuation', 'Research notes', 'Compare companies', 'Prices', 'Portfolios', 'Watchlist'] as const;
type Section = typeof tabs[number];

export default function App() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [catalogError, setCatalogError] = useState('');
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [universeDate, setUniverseDate] = useState('');
  const [selected, setSelected] = useState('DEMO');
  const [query, setQuery] = useState('');
  const [sector, setSector] = useState('All sectors');
  const catalogSummary = useRef<HTMLElement>(null);
  const catalogDetails = useRef<HTMLDetailsElement>(null);
  const [section, setSection] = useState<Section>('Financials');
  const [report, setReport] = useState<FinancialReport | null>(null);
  const [reportError, setReportError] = useState('');
  const [loading, setLoading] = useState(false);
  const [reportAttempt, setReportAttempt] = useState(0);
  const company = companies.find(c => c.ticker === selected) || demo;
  const isExample = selected === 'DEMO';
  const globalSection = section === 'Portfolios' || section === 'Compare companies' || section === 'Watchlist';
  const sectors = useMemo(() => [...new Set(companies.map(c => c.sector))].sort(), [companies]);
  const filtered = useMemo(() => companies.filter(c =>
    (sector === 'All sectors' || c.sector === sector) && `${c.name} ${c.ticker}`.toLowerCase().includes(query.toLowerCase().trim())
  ), [companies, sector, query]);

  useEffect(() => {
    const controller = new AbortController();
    setCatalogError('');
    request<Company[]>('/api/companies', { signal: controller.signal }).then(setCompanies).catch(e => {
      if (!controller.signal.aborted) setCatalogError(e.message);
    });
    request<{ asOf: string }>('/api/universe', { signal: controller.signal }).then(v => setUniverseDate(v.asOf)).catch(() => {});
    return () => controller.abort();
  }, [catalogAttempt]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setReport(null); setReportError('');
    const path = selected === 'DEMO' ? '/api/examples/financials' : `/api/companies/${encodeURIComponent(selected)}/financials`;
    request<FinancialReport>(path, { signal: controller.signal }).then(r => {
      if (!controller.signal.aborted) setReport(r);
    }).catch(e => {
      if (!controller.signal.aborted) setReportError(e.message);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [selected, reportAttempt]);

  function closeCatalog() { if (catalogDetails.current) catalogDetails.current.open = false; }
  function choose(ticker: string) { setSelected(ticker); setSection('Financials'); closeCatalog(); catalogSummary.current?.focus(); }

  return <div className="workspace">
    <header className="masthead">
      <a className="brand" href="#"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>CapitalScope<small>COMPANY INTELLIGENCE</small></span></a>
      <nav className="section-tabs" aria-label="Research sections">{tabs.map(t => <button key={t} onClick={() => { setSection(t); closeCatalog(); }} aria-current={section === t ? 'page' : undefined} className={section === t ? 'active' : ''}>{t}</button>)}</nav>
      <span className="workspace-tag">RESEARCH / 01</span>
    </header>
    <main>
      <div className="context-bar">
        <details className="company-browser" ref={catalogDetails} onKeyDown={event => { if (event.key === 'Escape') { closeCatalog(); catalogSummary.current?.focus(); } }}>
          <summary ref={catalogSummary}><span className="picker-icon" aria-hidden="true">⌕</span><strong>Browse companies</strong><span className="picker-current">{isExample ? 'DEMO' : company.ticker}</span><span aria-hidden="true">⌄</span></summary>
          <div className="catalog-popover" aria-label="Company catalog">
      <div className="catalog-heading"><span className="eyebrow">COMPANY UNIVERSE</span><span className="catalog-count">{companies.length || '—'}</span></div>
      <label className="search"><span className="sr-only">Search companies</span><span aria-hidden="true">⌕</span><input placeholder="Company or ticker" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <label className="sector-filter"><span className="sr-only">Filter by sector</span><select value={sector} onChange={e => setSector(e.target.value)}><option>All sectors</option>{sectors.map(s => <option key={s}>{s}</option>)}</select></label>
      <button className={`example-switch ${isExample ? 'selected' : ''}`} onClick={() => choose('DEMO')} aria-pressed={isExample}><span aria-hidden="true">◇</span><div>Example workspace<small>Explore with invented figures</small></div></button>
      {catalogError && <div className="sidebar-error" role="alert"><p>{catalogError}</p><button onClick={() => setCatalogAttempt(n => n + 1)}>Retry catalog</button></div>}
      <div className="company-list">{filtered.map(c => <button key={c.ticker} className={`company-option ${selected === c.ticker ? 'selected' : ''}`} onClick={() => choose(c.ticker)} aria-pressed={selected === c.ticker}><span className="ticker-mark" aria-hidden="true">{c.ticker.slice(0, 2)}</span><span className="company-option-name">{c.name}<small>{c.ticker} · {c.sector}</small></span><span aria-hidden="true">›</span></button>)}
        {!catalogError && companies.length > 0 && !filtered.length && <p className="no-companies">No matching companies. Try another name or sector.</p>}
      </div>
      <div className="sidebar-footer"><span className="status-dot" />{universeDate ? `Catalog snapshot · ${universeDate}` : 'Fixed company catalog'}<small>U.S. public companies · market-cap selection</small></div>

          </div>
        </details>
        <div className="context-metadata">{universeDate ? `Universe · ${universeDate}` : 'Fixed company universe'}<span>50 U.S. companies</span></div>
      </div>
      <div className="main-content">
        <div className="page-intro"><div><span className="eyebrow">RESEARCH / {isExample ? 'EXAMPLE' : company.ticker}</span><h1>{globalSection ? section === 'Portfolios' ? 'Practice portfolios' : section === 'Watchlist' ? 'Research watchlist' : 'Company comparisons' : company.name}</h1><p className="muted">Financial evidence. Independent assumptions. A clearer investment thesis.</p></div><div className="company-badge"><span className="eyebrow">{globalSection ? 'WORKSPACE' : 'INSTRUMENT'}</span><strong>{globalSection ? 'RESEARCH' : company.ticker}</strong><span>{globalSection ? 'Analysis & practice' : company.sector}</span></div></div>
        <div className={`data-banner ${isExample ? 'example' : 'live'}`}><div><span className="status-dot" /><strong>{section === 'Research summary' ? 'Company research summary · dated evidence' : section === 'Watchlist' ? 'Shared research watchlist' : section === 'Portfolios' ? 'Simulated portfolio workspace' : section === 'Compare companies' ? 'Comparison workspace · sources shown below' : section === 'Prices' ? isExample ? 'Example prices · invented figures' : 'Daily market prices' : isExample ? 'Example data · invented figures' : 'SEC financial data'}</strong><p>{section === 'Research summary' ? 'Saved research, financial facts, model cases, and stored closes retain their own sources and dates.' : section === 'Watchlist' ? 'Saved theses, research status, and review dates. Company sources remain in the analysis views.' : section === 'Portfolios' ? 'Manual simulated trades in a shared practice workspace. No broker orders or real money.' : section === 'Compare companies' ? 'Choose fictional peers or real company filings in the comparison controls.' : section === 'Prices' ? 'Daily raw price history, with source and data mode shown below.' : isExample ? 'This workspace shows a fictional company. Select a listed company to request its real filings.' : 'Annual reported facts, with filing sources. The catalog ranking is a fixed snapshot.'}</p></div>{section === 'Financials' && !isExample && report?.retrievedAt && <span className="retrieved">Retrieved<br />{new Date(report.retrievedAt).toLocaleString()}</span>}</div>

        {section === 'Financials' && <>
          {loading && <div className="panel loading-state" role="status"><span className="loader" />{isExample ? 'Opening example workspace…' : `Retrieving ${company.ticker} financials…`}</div>}
          {reportError && <div className="panel unavailable"><span className="eyebrow">DATA UNAVAILABLE</span><h2>Financials could not be loaded</h2><p className="notice error" role="alert">{reportError.includes('SEC_USER_AGENT') ? 'Live SEC access has not been configured for this workspace. The example workspace is available to explore.' : reportError}</p><button className="secondary" onClick={() => setReportAttempt(n => n + 1)}>Retry financials</button>{!isExample && <button className="text-button" onClick={() => choose('DEMO')}>Open example workspace ↗</button>}</div>}
          {report && !loading && <FinancialOverview key={selected} report={report} />}
        </>}
        {section === 'Valuation' && <ValuationPanel key={selected} company={company} />}
        {section === 'Compare companies' && <CompanyComparison companies={companies} />}
        {section === 'Prices' && <PricePanel key={selected} company={company} />}
        {section === 'Portfolios' && <PortfolioPanel companies={companies} />}
        {section === 'Watchlist' && <WatchlistPanel companies={companies} currentTicker={selected} onOpen={(ticker, target) => { setSelected(ticker); setSection(target); closeCatalog(); }} />}
        {section === 'Research summary' && <ResearchSummary key={selected} company={company} report={report} financialLoading={loading} financialError={reportError} onOpen={target => setSection(target)} />}
        {section === 'Research notes' && <ResearchNotes key={selected} company={company} />}
        <footer className="workspace-footer"><span>CapitalScope</span><span>Company research & valuation · {isExample ? 'Example workspace' : company.ticker}</span></footer>
      </div>
    </main>
  </div>;
}
