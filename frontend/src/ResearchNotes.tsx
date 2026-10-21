import { noteDraftBases, noteDrafts } from './researchDrafts';
import { useRef, useState } from 'react';
import type { Company } from './types';
import NoteTransfer from './NoteTransfer';

export default function ResearchNotes({ company }: { company: Company }) {
  const key = `capitalscope.note.${company.ticker}`;
  const [initial] = useState(() => {
    try { return { text: localStorage.getItem(key) || '', error: '' }; }
    catch { return { text: '', error: 'Browser storage is unavailable. You can write a note, but it cannot be saved here.' }; }
  });
  const [text, setText] = useState(noteDrafts.get(key) ?? initial.text);
  const [message, setMessage] = useState(noteDrafts.has(key) ? 'Unsaved draft restored.' : initial.error);
  const [downloadError, setDownloadError] = useState('');
  const [failed, setFailed] = useState(Boolean(initial.error));
  const baseline = useRef(noteDraftBases.get(key) ?? initial.text);
  const [conflict, setConflict] = useState<string | null>(null);

  function keepDraft(next: string) {
    if (!noteDraftBases.has(key)) noteDraftBases.set(key, baseline.current);
    noteDrafts.set(key, next);
  }

  function save(replaceReviewed = false) {
    try {
      const saved = localStorage.getItem(key) || '';
      const expected = replaceReviewed && conflict !== null ? conflict : baseline.current;
      if (saved !== expected && saved !== text) {
        keepDraft(text); setConflict(saved); setMessage('Your draft is intact. Review the changed saved note before choosing which version to keep.'); setFailed(false); return;
      }
      // I check the reviewed text again before replacing it; browser storage does not provide an atomic compare-and-save.
      localStorage.setItem(key, text); baseline.current = text; noteDrafts.delete(key); noteDraftBases.delete(key); setConflict(null); setMessage('Saved in this browser.'); setFailed(false);
    }
    catch { setMessage('This browser could not save your note. Copy it somewhere safe before leaving.'); setFailed(true); }
  }

  function discard() {
    let saved: string;
    try { saved = localStorage.getItem(key) || ''; }
    catch { setMessage('This browser could not read the saved note. Copy your draft somewhere safe.'); setFailed(true); return; }
    baseline.current = saved; noteDrafts.delete(key); noteDraftBases.delete(key); setConflict(null); setText(saved); setMessage('Draft discarded.'); setFailed(false);
  }

  function download() {
    setDownloadError('');
    try {
      // I export the text on screen without changing the saved note or its draft state.
      const content = `CapitalScope research note
Company: ${company.name} (${company.ticker})
Sector: ${company.sector}
Exported: ${new Date().toISOString()}
State: ${noteDrafts.has(key) ? 'Unsaved draft' : 'Saved browser note'}
Scope: Browser-local research text; no financial evidence attached.

${text}`;
      const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url; link.download = `${company.ticker}-research-note.txt`;
      try { link.click(); } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch { setDownloadError('The note download could not be prepared. Copy your text somewhere safe.'); }
  }

  return <section className="panel" aria-labelledby="notes-heading">
    <div className="panel-title"><div><span className="eyebrow">RESEARCH NOTES</span><h2 id="notes-heading">Write the investment thesis</h2></div><span className="pill">{company.ticker}</span></div>
    <p className="muted">What would need to be true for this investment to work? Record the evidence, assumptions, and risks you want to revisit.</p>
    <label className="note-label" htmlFor="research-note">Your notes for {company.name}</label>
    <textarea id="research-note" rows={12} value={text} onChange={e => { setText(e.target.value); keepDraft(e.target.value); setMessage('Unsaved changes.'); setFailed(false); }} placeholder="My thesis…\n\nEvidence I want to check…\n\nWhat could change my view…" />
    <div className="model-actions"><button className="primary" onClick={() => save()}>Save note</button><button className="secondary" disabled={!text.trim()} onClick={download}>Download note text</button><button className="secondary" onClick={discard}>Discard note draft</button><span className="muted small">Drafts stay available while this app is open. Refreshing or closing can lose unsaved drafts. Saved notes are stored on this browser only. No account or cloud sync yet.</span></div>
    {conflict !== null && <div className="notice warning" role="alert">
      <p>The saved note changed since this draft began, possibly in another tab. Your draft has not replaced it.</p>
      <details><summary>Review changed saved note</summary><pre className="note-preview" aria-label="Changed saved note">{conflict || '(Empty saved note)'}</pre></details>
      <p>Download your draft before discarding it if you want to keep both versions. Replacing uses the draft currently in the editor.</p>
      <div className="model-actions"><button type="button" className="secondary" onClick={discard}>Use latest saved note</button><button type="button" className="secondary" onClick={() => save(true)}>Replace saved note with my draft</button></div>
    </div>}
    <p className="muted small">The download includes the text currently shown, including unsaved edits. Downloading does not save the note in this browser.</p>
    <NoteTransfer company={company} text={text} isDraft={noteDrafts.has(key)} onRestore={restored => {
      setText(restored); keepDraft(restored); setMessage('Backup restored as an unsaved draft. Choose Save note to keep it in this browser.'); setFailed(false);
    }} />
    {downloadError && <p role="alert" className="notice error">{downloadError}</p>}
    {message && <p role={failed ? 'alert' : 'status'} className={failed ? 'notice error' : 'save-status'}>{message}</p>}
  </section>;
}
