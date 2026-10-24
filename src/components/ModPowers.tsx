'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Eye, ShieldCheck } from 'lucide-react';
import { setViewAs, type ViewAs } from './viewAs';

const VIEWS: { key: ViewAs; label: string; note: string }[] = [
  { key: 'self', label: 'Yourself', note: 'Your account, with your moderator powers.' },
  { key: 'villager', label: 'A villager', note: "Signed in, but not you. Your posts look like anyone's, so you can vote on them. Those votes are practice: only you see them." },
  { key: 'visitor', label: 'A visitor', note: 'Not signed in. Read-only, with sign-in prompts.' },
];

const SHORT: Record<ViewAs, string> = { self: 'Moderator', villager: 'As a villager', visitor: 'As a visitor' };

/** Moderator powers, next to the account button. Only shown to moderators and the Founder. */
export function ModPowers({ view }: { view: ViewAs }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onClick = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mousedown', onClick); };
  }, [open]);

  const away = view !== 'self';
  return (
    <div ref={box} className="relative">
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="true"
        className={'inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold ring-1 ' +
          (away ? 'bg-sun-soft text-sun ring-sun' : 'bg-card text-ink ring-line hover:ring-ink')}>
        {away ? <Eye size={16} aria-hidden="true" /> : <ShieldCheck size={16} aria-hidden="true" />}
        <span className="hidden sm:inline">{SHORT[view]}</span>
        <span className="sr-only sm:hidden">Moderator powers</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div className="surface pop absolute right-0 z-40 mt-2 w-72 rounded-2xl p-2 text-sm">
          <p className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-muted">Moderator powers</p>
          <p className="px-3 pb-2 font-bold">See the site as</p>
          <ul role="radiogroup" aria-label="See the site as" className="grid gap-1">
            {VIEWS.map((v) => (
              <li key={v.key}>
                <button role="radio" aria-checked={view === v.key} onClick={() => { setViewAs(v.key); setOpen(false); }}
                  className={'flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left hover:bg-card-2 ' + (view === v.key ? 'bg-card-2' : '')}>
                  <span className={'mt-0.5 grid size-4 shrink-0 place-items-center rounded-full ring-1 ' + (view === v.key ? 'bg-leaf text-paper ring-leaf' : 'ring-line')}>
                    {view === v.key && <Check size={11} aria-hidden="true" />}
                  </span>
                  <span>
                    <span className="block font-bold">{v.label}</span>
                    <span className="block text-muted">{v.note}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="px-3 pb-1 pt-2 text-xs text-muted">Only changes this browser. Nobody else is affected.</p>
        </div>
      )}
    </div>
  );
}

/** A reminder pinned to the bottom of every page while seeing the site as someone else. */
export function ViewAsReminder({ view }: { view: ViewAs }) {
  if (view === 'self') return null;
  return (
    <div role="status" className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="surface flex items-center gap-3 rounded-full py-1.5 pl-4 pr-1.5 text-sm">
        <Eye size={16} className="text-sun" aria-hidden="true" />
        <span>Seeing the site as <b>{view === 'villager' ? 'a villager' : 'a visitor'}</b></span>
        <button onClick={() => setViewAs('self')} className="gloss btn-primary rounded-full px-3 py-1.5 font-bold">Back to me</button>
      </div>
    </div>
  );
}
