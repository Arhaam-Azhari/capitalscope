import { useEffect, useRef, useState } from 'react';
import type { Company } from './types';

const format = 'capitalscope-browser-note-v1';
const maxCharacters = 100_000;
type Backup = { format: string; ticker: string; exportedAt: string; state: 'saved' | 'draft'; text: string };

export default function NoteTransfer({ company, text, isDraft, onRestore }: {
  company: Company; text: string; isDraft: boolean; onRestore: (text: string) => void;
}) {
  const [preview, setPreview] = useState<Backup | null>(null);
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const request = useRef(0);
  useEffect(() => () => { request.current++; }, []);

  function download() {
    setError('');
    try {
      if (text.length > maxCharacters) throw new Error('limit');
      const backup: Backup = { format, ticker: company.ticker, exportedAt: new Date().toISOString(), state: isDraft ? 'draft' : 'saved', text };
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url; link.download = `${company.ticker}-note-backup.json`;
      try { link.click(); } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch { setError('The backup could not be prepared. Backups support up to 100,000 characters; the text download is also available.'); }
  }

  async function read(file: File) {
    const attempt = ++request.current;
    setPreview(null); setError(''); setReading(true);
    try {
      if (file.size > 1_000_000) throw new Error('size');
      const value: unknown = JSON.parse(await file.text());
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('shape');
      const backup = value as Record<string, unknown>;
      if (Object.keys(backup).sort().join(',') !== 'exportedAt,format,state,text,ticker'
        || backup.format !== format || backup.ticker !== company.ticker
        || (backup.state !== 'saved' && backup.state !== 'draft')
        || typeof backup.exportedAt !== 'string' || !Number.isFinite(Date.parse(backup.exportedAt))
        || typeof backup.text !== 'string' || backup.text.length > maxCharacters) throw new Error('backup');
      if (attempt === request.current) setPreview(backup as Backup);
    } catch {
      if (attempt === request.current) setError(`Choose a CapitalScope note backup for ${company.ticker}, up to 1 MB and 100,000 text characters. Invalid files leave your note unchanged.`);
    } finally { if (attempt === request.current) setReading(false); }
  }

  return <details className="note-transfer">
    <summary>Back up or restore this note</summary>
    <p className="muted small">Download the text currently in the editor as a restorable JSON file. It contains your note and its company ticker; review it before sharing. Financial evidence and other companies’ notes are excluded.</p>
    <button type="button" className="secondary" onClick={download}>Download note backup</button>
    <label className="note-label" htmlFor="note-backup-file">Choose a note backup for {company.ticker}</label>
    <input id="note-backup-file" type="file" accept=".json,application/json" onChange={event => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = '';
      if (file) void read(file);
    }} />
    {reading && <p role="status">Reading note backup…</p>}
    {error && <p role="alert" className="notice error">{error}</p>}
    {preview && <div>
      <p>Preview for {preview.ticker} · Exported {new Date(preview.exportedAt).toLocaleString()} · {preview.state === 'draft' ? 'Unsaved draft at export' : 'Saved browser note at export'}</p>
      <pre className="note-preview" aria-label="Note backup preview">{preview.text || '(Empty note)'}</pre>
      <p className="muted small">Restoring replaces the editor text, including any unsaved edits. Your saved browser note stays unchanged until you choose Save note. The file’s company and date are labels, not verified authorship or history.</p>
      <div className="model-actions"><button type="button" className="primary" onClick={() => {
        // I restore into the draft so reading a file never overwrites browser storage.
        onRestore(preview.text); setPreview(null);
      }}>Restore into editor</button><button type="button" className="secondary" onClick={() => setPreview(null)}>Cancel restore</button></div>
    </div>}
  </details>;
}
