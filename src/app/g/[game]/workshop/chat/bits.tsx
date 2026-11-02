'use client';

import { useState } from 'react';
import { REASONS, type ReportReason, type Target, type WorkshopData } from '../useWorkshop';

// Small pieces the chat and the Workshop's Draft cards share.

/** "just now", "5m", "3h", or a date. Only ever runs in the browser. */
export function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * When a message was sent, in your own time zone: "3:42 PM" today, "Yesterday 3:42 PM", then
 * "Oct 31, 3:42 PM" (with the year once it's another year). Only ever runs in the browser.
 */
export function clock(iso: string) {
  const d = new Date(iso), now = new Date();
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return time;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`;
  const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) });
  return `${date}, ${time}`;
}

/** The full date and time, for a tooltip. */
export const fullTime = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' });

/** Runs an action that returns an error in plain words (or null), tracking busy and error. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (fn: () => Promise<string | null>) => {
    setBusy(true);
    const err = await fn();
    setBusy(false);
    setError(err ?? '');
    return !err;
  };
  return { run, busy, error };
}

export function SmallButton({ onClick, icon, children, tone = 'plain', disabled }: {
  onClick: () => void; icon?: React.ReactNode; children: React.ReactNode; tone?: 'plain' | 'good' | 'bad'; disabled?: boolean;
}) {
  const tones = { plain: 'bg-card text-ink ring-line hover:ring-ink', good: 'bg-leaf-soft text-leaf ring-leaf/40 hover:ring-leaf', bad: 'bg-berry-soft text-berry ring-berry/40 hover:ring-berry' };
  return (
    <button onClick={onClick} disabled={disabled} className={'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ring-1 disabled:opacity-50 ' + tones[tone]}>
      {icon}{children}
    </button>
  );
}

/** "Report" for villagers: pick a reason, add a note if you like. Goes to the moderators. */
export function ReportForm({ target, live, onDone }: { target: Target; live: WorkshopData; onDone: () => void }) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const { run, busy, error } = useAction();
  if (sent) return <p role="status" className="mt-2 rounded-2xl bg-leaf-soft px-3 py-2 text-sm text-leaf">Thanks. A moderator will take a look.</p>;
  return (
    <form className="mt-2 grid gap-2 rounded-2xl bg-card-2 p-3 ring-1 ring-line"
      onSubmit={async (e) => { e.preventDefault(); if (reason && await run(() => live.report(target, reason, note))) { setSent(true); setTimeout(onDone, 2500); } }}>
      <p className="text-sm font-bold">What&apos;s wrong with it?</p>
      <div role="radiogroup" aria-label="Reason" className="flex flex-wrap gap-1.5">
        {REASONS.map((r) => (
          <button key={r.key} type="button" role="radio" aria-checked={reason === r.key} onClick={() => setReason(r.key)}
            className={'rounded-full px-3 py-1 text-sm font-bold ring-1 ' + (reason === r.key ? 'bg-berry text-paper ring-berry' : 'bg-card ring-line hover:ring-berry')}>
            {r.label}
          </button>
        ))}
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Anything moderators should know (optional)"
        className="rounded-2xl bg-card px-3 py-2 text-sm ring-1 ring-line outline-none placeholder:text-muted focus:ring-2 focus:ring-sky" />
      <div className="flex items-center gap-2">
        <button disabled={!reason || busy} className="rounded-full bg-berry px-4 py-1.5 text-sm font-bold text-paper disabled:opacity-50">Send report</button>
        <button type="button" onClick={onDone} className="rounded-full px-3 py-1.5 text-sm font-bold text-muted hover:text-ink">Cancel</button>
      </div>
      {error && <p role="status" className="text-sm text-berry">{error}</p>}
    </form>
  );
}
