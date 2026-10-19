import { useEffect, useState } from 'react';
import { request } from './api';

type Connections = { secConfigured: boolean; marketPricesConfigured: boolean; checkedAt: string };
export default function DataConnections() {
  const [opened, setOpened] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState<Connections | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!opened) return;
    const controller = new AbortController(); setData(null); setError(''); setLoading(true);
    request<Connections>('/api/data-connections', { signal: controller.signal, cache: 'no-store' })
      .then(value => { if (!controller.signal.aborted) setData(value); })
      .catch(() => { if (!controller.signal.aborted) setError('Connection status could not be read. Try again.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [opened, attempt]);
  return <details className="data-connections" onToggle={event => setOpened(event.currentTarget.open)}>
    <summary>Data connections</summary>
    <p className="muted small">Check which imports are configured for this workspace. This does not contact the providers or verify access, freshness, or company coverage.</p>
    {loading && <p role="status">Checking data connection setup…</p>}
    {error && <p role="alert" className="notice error">{error}</p>}
    {data && <>
      <dl className="connection-grid"><div><dt>SEC annual filings</dt><dd>{data.secConfigured ? 'Configured' : 'Setup needed'}</dd></div><div><dt>Market-price imports</dt><dd>{data.marketPricesConfigured ? 'Configured' : 'Setup needed'}</dd></div></dl>
      <p className="muted small">Checked {new Date(data.checkedAt).toLocaleString()}. Missing setup affects new imports; stored evidence may still be available. Fictional examples work without live connections.</p>
      {(!data.secConfigured || !data.marketPricesConfigured) && <p className="muted small">The person running this workspace can configure missing imports. Contact details and credentials are never displayed here.</p>}
    </>}
    <button type="button" className="secondary" disabled={loading} onClick={() => setAttempt(value => value + 1)}>Check data connections</button>
  </details>;
}
