'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ListPlus, Plus, Trash2, X } from 'lucide-react';
import type { Choice } from '@/data/pages';
import { choicesOf } from '@/lib/fields';

interface Row { id: number; name: string; about: string; was: string }

/**
 * A tag's list of choices, made in a panel that slides out from Set up (Matt, 2026-11-15): the
 * builder types the choices (Beginner, Specialty, Advanced...), each with optional info, and puts
 * them in order. Then whoever adds or fixes an entry picks one instead of typing it. On a Classes
 * Block the band tag's list is the ladder: its bands in this order, each headed by its info's
 * first line, with the rest a tap away.
 *
 * Quick to fill: Enter adds the next one, and pasting several lines adds each ("Beginner: Level 5"
 * puts what's after the colon in the info). The values entries already use are one tap away.
 */
export function ChoiceList({ label, choices, used, bands, onDone, onClose }: {
  label: string; choices?: Choice[];
  /** What entries already have in this tag, and how many use each. */
  used: [string, number][];
  /** This tag is a Classes Block's bands, so the order and info shape the ladder. */
  bands: boolean;
  onDone: (choices: Choice[]) => void; onClose: () => void;
}) {
  const next = useRef(0);
  const row = (name: string, about = ''): Row => ({ id: next.current++, name, about, was: name });
  const [rows, setRows] = useState<Row[]>(() => choicesOf({ choices }).map((c) => row(c.name, c.about ?? '')));
  const [adding, setAdding] = useState('');
  const [focusId, setFocusId] = useState<number | null>(null);
  const addRef = useRef<HTMLInputElement>(null);
  const has = (n: string) => rows.some((r) => r.name.trim().toLowerCase() === n.trim().toLowerCase());
  const count = (n: string) => used.find(([v]) => v.trim().toLowerCase() === n.trim().toLowerCase())?.[1] ?? 0;
  const missing = used.filter(([v]) => !has(v));

  useEffect(() => { addRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  useEffect(() => {
    if (focusId === null) return;
    document.getElementById(`choice-about-${focusId}`)?.focus();
    setFocusId(null);
  }, [focusId]);

  // One line or several: "Name: info" puts the info in, and names already there are skipped.
  const addLines = (text: string) => {
    const fresh: Row[] = [];
    for (const line of text.split('\n').map((l) => l.trim()).filter(Boolean)) {
      const at = line.indexOf(':');
      const name = (at > 0 ? line.slice(0, at) : line).trim();
      if (!name || has(name) || fresh.some((r) => r.name.toLowerCase() === name.toLowerCase())) continue;
      fresh.push(row(name, at > 0 ? line.slice(at + 1).trim() : ''));
    }
    if (fresh.length) setRows([...rows, ...fresh]);
    setAdding('');
  };
  const patch = (id: number, p: Partial<Row>) => setRows(rows.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const move = (i: number, by: -1 | 1) => {
    const j = i + by;
    if (j < 0 || j >= rows.length) return;
    const n = [...rows];
    [n[i], n[j]] = [n[j], n[i]];
    setRows(n);
  };
  const done = () => onDone(rows.map((r) => ({ name: r.name.trim(), ...(r.about.trim() ? { about: r.about.trim() } : {}) })).filter((c) => c.name));

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`Choices for ${label}`}>
      <button type="button" aria-label="Close without changes" onClick={onClose} className="absolute inset-0 bg-ink/30" />
      <div className="slide-in relative flex h-full w-full max-w-md flex-col bg-card shadow-2xl">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Choices</p>
            <h2 className="truncate font-display text-xl leading-tight">{label}</h2>
          </div>
          <button type="button" onClick={done} className="btn-primary rounded-full px-4 py-2 text-sm font-bold">Done</button>
          <button type="button" onClick={onClose} aria-label="Close without changes" className="grid size-9 place-items-center rounded-full text-muted hover:bg-card-2 hover:text-ink"><X size={18} aria-hidden="true" /></button>
        </div>

        <div className="workbench grid flex-1 content-start gap-3 overflow-y-auto p-4">
          <p className="text-sm text-muted">
            {bands
              ? 'These are the ladder\'s bands, top to bottom. Builders pick one for each class. The first line of the info shows at the top of the band (what it takes); the rest opens with a tap.'
              : 'Builders pick one of these when they add or fix an entry, so everyone uses the same words. Info is optional.'}
          </p>

          {rows.length > 0 && (
            <ol className="grid gap-2">
              {rows.map((r, i) => {
                const n = count(r.was);
                const renamed = r.was && r.name.trim().toLowerCase() !== r.was.trim().toLowerCase();
                return (
                  <li key={r.id} className="grid gap-1.5 rounded-2xl bg-card p-2.5 ring-1 ring-ink">
                    <div className="flex items-center gap-1.5">
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-paper">{i + 1}</span>
                      <input value={r.name} onChange={(e) => patch(r.id, { name: e.target.value })} aria-label={`Choice ${i + 1}`} maxLength={60}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setFocusId(r.id); } }}
                        className="min-w-0 flex-1 rounded-xl px-2.5 py-1.5 text-sm font-bold outline-none" />
                      <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${r.name || 'this'} up`} className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-card-2 hover:text-ink disabled:opacity-30"><ArrowUp size={15} aria-hidden="true" /></button>
                      <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label={`Move ${r.name || 'this'} down`} className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-card-2 hover:text-ink disabled:opacity-30"><ArrowDown size={15} aria-hidden="true" /></button>
                      <button type="button" onClick={() => setRows(rows.filter((x) => x.id !== r.id))} aria-label={`Remove ${r.name || 'this choice'}`} className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-card-2 hover:text-berry"><Trash2 size={15} aria-hidden="true" /></button>
                    </div>
                    <textarea id={`choice-about-${r.id}`} value={r.about} onChange={(e) => patch(r.id, { about: e.target.value })} rows={r.about.includes('\n') ? 3 : 2} maxLength={600}
                      aria-label={`Info about ${r.name || `choice ${i + 1}`}`}
                      placeholder={bands ? 'Optional: what it takes, e.g. Level 20 · Renown 4\nMore lines open with a tap' : 'Optional info about it'}
                      className="rounded-xl px-2.5 py-1.5 text-sm outline-none" />
                    {n > 0 && (
                      <p className="text-xs text-muted">
                        {renamed ? <>{n} {n === 1 ? 'entry still says' : 'entries still say'} “{r.was}”. They show it as not on the list until they&apos;re fixed.</> : <>Used by {n} {n === 1 ? 'entry' : 'entries'}.</>}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}

          <div className="grid gap-1.5 rounded-2xl bg-card p-2.5 ring-1 ring-line">
            <label htmlFor="choice-add" className="flex items-center gap-1.5 text-sm font-bold"><Plus size={15} aria-hidden="true" /> {rows.length ? 'Add another' : 'Add the first choice'}</label>
            <div className="flex gap-2">
              <input id="choice-add" ref={addRef} value={adding} onChange={(e) => setAdding(e.target.value)} maxLength={600}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLines(adding); } }}
                onPaste={(e) => { const t = e.clipboardData.getData('text'); if (t.includes('\n')) { e.preventDefault(); addLines(t); } }}
                placeholder={bands ? 'e.g. Beginner' : 'A choice, then Enter'} className="min-w-0 flex-1 rounded-xl px-2.5 py-1.5 text-sm outline-none" />
              <button type="button" onClick={() => addLines(adding)} disabled={!adding.trim()} className="rounded-full bg-ink px-4 py-1.5 text-sm font-bold text-paper disabled:opacity-40">Add</button>
            </div>
            <p className="text-xs text-muted">Enter adds it and keeps you here for the next one. Paste several lines to add them all.</p>
          </div>

          {missing.length > 0 && (
            <button type="button" onClick={() => setRows([...rows, ...missing.map(([v]) => row(v))])}
              className="flex items-start gap-2 rounded-2xl bg-card p-2.5 text-left text-sm ring-1 ring-line hover:ring-ink">
              <ListPlus size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span><span className="font-bold">Add what entries already use</span>: {missing.map(([v, n]) => `${v} (${n})`).join(', ')}</span>
            </button>
          )}

          <p className="text-xs text-muted">Done keeps the list in this setup; Save setup puts it in the app.{rows.length === 0 ? ' With no choices, builders can type anything, as before.' : ''}</p>
        </div>
      </div>
    </div>
  );
}
