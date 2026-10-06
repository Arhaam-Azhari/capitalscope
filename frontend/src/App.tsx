import { useEffect, useMemo, useState } from 'react';
import { request } from './api';
import type { Company, FinancialReport } from './types';
import FinancialOverview from './FinancialOverview';
import ValuationPanel from './ValuationPanel';
import CompanyComparison from './CompanyComparison';
import PricePanel from './PricePanel';
import PortfolioPanel from './PortfolioPanel';
import ResearchNotes from './ResearchNotes';

const demo: Company = { ticker: 'DEMO', name: 'Example Manufacturing', sector: 'Industrials' };
const tabs = ['Financials', 'Valuation', 'Research notes', 'Compare companies', 'Prices', 'Portfolios'] as const;
type Section = typeof tabs[number];

export default function App() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [catalogError, setCatalogError] = useState('');
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [universeDate, setUniverseDate] = useState('');
  const [selected, setSelected] = useState('DEMO');
  const [query, setQuery] = useState('');
  const [sector, setSector] = useState('All sectors');
  const [section, setSection] = useState<Section>('Financials');
  const [report, setReport] = useState<FinancialReport | null>(null);
  const [reportError, setReportError] = useState('');
  const [loading, setLoading] = useState(false);
  const [reportAttempt, setReportAttempt] = useState(0);
  const company = companies.find(c => c.ticker === selected) || demo;
  const isExample = selected === 'DEMO';
  const globalSection = section === 'Portfolios' || section === 'Compare companies';
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

  function choose(ticker: string) { setSelected(ticker); setSection('Financials'); }

  return <div className="workspace">
    <aside className="sidebar" aria-label="Company catalog">
      <a className="brand" href="#"><span className="brand-mark" aria-hidden="true">C<span>↗</span></span><span>CapitalScope<small>RESEARCH WORKSPACE</small></span></a>
      <div className="catalog-heading"><span className="eyebrow">COMPANY UNIVERSE</span><span className="catalog-count">{companies.length || '—'}</span></div>
      <label className="search"><span className="sr-only">Search companies</span><span aria-hidden="true">⌕</span><input placeholder="Company or ticker" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <label className="sector-filter"><span className="sr-only">Filter by sector</span><select value={sector} onChange={e => setSector(e.target.value)}><option>All sectors</option>{sectors.map(s => <option key={s}>{s}</option>)}</select></label>
      <button className={`example-switch ${isExample ? 'selected' : ''}`} onClick={() => choose('DEMO')} aria-pressed={isExample}><span aria-hidden="true">◇</span><div>Example workspace<small>Explore with invented figures</small></div></button>
      {catalogError && <div className="sidebar-error" role="alert"><p>{catalogError}</p><button onClick={() => setCatalogAttempt(n => n + 1)}>Retry catalog</button></div>}
      <div className="company-list">{filtered.map(c => <button key={c.ticker} className={`company-option ${selected === c.ticker ? 'selected' : ''}`} onClick={() => choose(c.ticker)} aria-pressed={selected === c.ticker}><span className="ticker-mark" aria-hidden="true">{c.ticker.slice(0, 2)}</span><span className="company-option-name">{c.name}<small>{c.ticker} · {c.sector}</small></span><span aria-hidden="true">›</span></button>)}
        {!catalogError && companies.length > 0 && !filtered.length && <p className="no-companies">No matching companies. Try another name or sector.</p>}
      </div>
      <div className="sidebar-footer"><span className="status-dot" />{universeDate ? `Catalog snapshot · ${universeDate}` : 'Fixed company catalog'}<small>U.S. public companies · market-cap selection</small></div>
    </aside>
    <main>
      <header className="topbar"><div><span className="status-dot" />Company research</div><span className="topbar-right">Financials / Assumptions / Evidence</span></header>
      <div className="main-content">
        <div className="page-intro"><div><span className="eyebrow">RESEARCH / {isExample ? 'EXAMPLE' : company.ticker}</span><h1>{globalSection ? section === 'Portfolios' ? 'Practice portfolios' : 'Company comparisons' : company.name}</h1><p className="muted">Understand the business. Inspect the figures. Record your reasoning.</p></div><div className="company-badge">{isExample ? 'EX' : company.ticker.slice(0, 2)}<span>{company.sector}</span></div></div>
        <div className={`data-banner ${isExample ? 'example' : 'live'}`}><div><span className="status-dot" /><strong>{section === 'Portfolios' ? 'Simulated portfolio workspace' : section === 'Compare companies' ? 'Comparison workspace · sources shown below' : section === 'Prices' ? isExample ? 'Example prices · invented figures' : 'Daily market prices' : isExample ? 'Example data · invented figures' : 'SEC financial data'}</strong><p>{section === 'Portfolios' ? 'Manual simulated trades in a shared practice workspace. No broker orders or real money.' : section === 'Compare companies' ? 'Choose fictional peers or real company filings in the comparison controls.' : section === 'Prices' ? 'Daily raw price history, with source and data mode shown below.' : isExample ? 'This workspace shows a fictional company. Select a listed company to request its real filings.' : 'Annual reported facts, with filing sources. The catalog ranking is a fixed snapshot.'}</p></div>{section === 'Financials' && !isExample && report?.retrievedAt && <span className="retrieved">Retrieved<br />{new Date(report.retrievedAt).toLocaleString()}</span>}</div>
        <nav className="section-tabs" aria-label="Research sections">{tabs.map(t => <button key={t} onClick={() => setSection(t)} aria-current={section === t ? 'page' : undefined} className={section === t ? 'active' : ''}>{t}</button>)}</nav>
        {section === 'Financials' && <>
          {loading && <div className="panel loading-state" role="status"><span className="loader" />{isExample ? 'Opening example workspace…' : `Retrieving ${company.ticker} financials…`}</div>}
          {reportError && <div className="panel unavailable"><span className="eyebrow">DATA UNAVAILABLE</span><h2>Financials could not be loaded</h2><p className="notice error" role="alert">{reportError.includes('SEC_USER_AGENT') ? 'Live SEC access has not been configured for this workspace. The example workspace is available to explore.' : reportError}</p><button className="secondary" onClick={() => setReportAttempt(n => n + 1)}>Retry financials</button>{!isExample && <button className="text-button" onClick={() => choose('DEMO')}>Open example workspace ↗</button>}</div>}
          {report && !loading && <FinancialOverview key={selected} report={report} />}
        </>}
        {section === 'Valuation' && <ValuationPanel key={selected} company={company} />}
        {section === 'Compare companies' && <CompanyComparison companies={companies} />}
        {section === 'Prices' && <PricePanel key={selected} company={company} />}
        {section === 'Portfolios' && <PortfolioPanel companies={companies} />}
        {section === 'Research notes' && <ResearchNotes key={selected} company={company} />}
        <footer className="workspace-footer"><span>CapitalScope</span><span>Company research & valuation · {isExample ? 'Example workspace' : company.ticker}</span></footer>
      </div>
    </main>
  </div>;
}
