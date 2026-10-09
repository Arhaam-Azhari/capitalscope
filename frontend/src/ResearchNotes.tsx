import { noteDrafts } from './researchDrafts';
import { useState } from 'react';
import type { Company } from './types';

export default function ResearchNotes({ company }: { company: Company }) {
  const key = `capitalscope.note.${company.ticker}`;
  const [initial] = useState(() => {
    try { return { text: localStorage.getItem(key) || '', error: '' }; }
    catch { return { text: '', error: 'Browser storage is unavailable. You can write a note, but it cannot be saved here.' }; }
  });
  const [text, setText] = useState(noteDrafts.get(key) ?? initial.text);
  const [message, setMessage] = useState(noteDrafts.has(key) ? 'Unsaved draft restored.' : initial.error);
  const [failed, setFailed] = useState(Boolean(initial.error));

  function save() {
    try { localStorage.setItem(key, text); noteDrafts.delete(key); setMessage('Saved in this browser.'); setFailed(false); }
    catch { setMessage('This browser could not save your note. Copy it somewhere safe before leaving.'); setFailed(true); }
  }

  return <section className="panel" aria-labelledby="notes-heading">
    <div className="panel-title"><div><span className="eyebrow">RESEARCH NOTES</span><h2 id="notes-heading">Write the investment thesis</h2></div><span className="pill">{company.ticker}</span></div>
    <p className="muted">What would need to be true for this investment to work? Record the evidence, assumptions, and risks you want to revisit.</p>
    <label className="note-label" htmlFor="research-note">Your notes for {company.name}</label>
    <textarea id="research-note" rows={12} value={text} onChange={e => { setText(e.target.value); noteDrafts.set(key, e.target.value); setMessage('Unsaved changes.'); setFailed(false); }} placeholder="My thesis…\n\nEvidence I want to check…\n\nWhat could change my view…" />
    <div className="model-actions"><button className="primary" onClick={save}>Save note</button><button className="secondary" onClick={() => {
      let saved: string;
      try { saved = localStorage.getItem(key) || ''; }
      catch { setMessage('This browser could not read the saved note. Copy your draft somewhere safe.'); setFailed(true); return; }
      noteDrafts.delete(key); setText(saved); setMessage('Draft discarded.'); setFailed(false);
    }}>Discard note draft</button><span className="muted small">Drafts stay available while this app is open. Refreshing or closing can lose unsaved drafts. Saved notes are stored on this browser only. No account or cloud sync yet.</span></div>
    {message && <p role={failed ? 'alert' : 'status'} className={failed ? 'notice error' : 'save-status'}>{message}</p>}
  </section>;
}
