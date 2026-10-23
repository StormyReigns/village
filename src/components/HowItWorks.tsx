'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarDays, CircleHelp, Hammer, PencilLine, Users, X } from 'lucide-react';
import { MarketDay } from './Countdown';

// How a fix reaches the app, in plain words. Opened from the Market Day pill and from the
// Workshop's "How it works" button, so newcomers can always find the answer.

const STEPS = [
  {
    icon: PencilLine, tint: 'leaf', title: 'Write it',
    body: 'Tap "Suggest a fix" on anything in the app, or "New" in the Workshop. You see how it will look as you type, and your writing is kept until you send it, even if you sign in partway.',
  },
  {
    icon: Users, tint: 'sky', title: 'Villagers check it',
    body: 'Other villagers vote "I can confirm" or "Seems wrong". Totals stay hidden until 5 votes, so nobody just follows the crowd. Saying where to check it (a source) helps a lot.',
  },
  {
    icon: CalendarDays, tint: 'sun', title: 'Market Day',
    body: 'Once a week, on Sunday, a moderator reviews the Drafts that are ready and publishes them to the app, or declines with a short reason and what would get it in. Every Draft gets an answer within two Market Days.',
  },
  {
    icon: Hammer, tint: 'berry', title: "It's in the app",
    body: 'Your change becomes the new version of that entry for everyone. Earlier versions are kept, so a mistake can always be undone.',
  },
] as const;

export function HowItWorks() {
  return (
    <div>
      <h2 className="font-display text-2xl">How a fix reaches the app</h2>
      <ol className="mt-4 grid gap-3">
        {STEPS.map((s, i) => (
          <li key={s.title} style={{ '--tint': `var(--${s.tint})` } as React.CSSProperties} className="vblock vblock-quiet flex gap-3 p-3" data-roof="none">
            <span className="gloss grid size-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: 'var(--tint)' }}>
              <s.icon size={19} aria-hidden="true" />
            </span>
            <span>
              <span className="block font-bold">{i + 1}. {s.title}</span>
              <span className="block text-sm text-muted">{s.body}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-sm text-muted">Want to talk it through? Tap &ldquo;Discuss&rdquo; on any Draft, or say hello in the Workshop chat.</p>
    </div>
  );
}

function Sheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label="How it works" onClick={(e) => e.stopPropagation()}
        className="rise max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-[2rem] bg-card p-5 shadow-soft outline-none sm:rounded-[2rem] sm:p-6">
        <div className="flex justify-end">
          <button onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full bg-card-2 ring-1 ring-line"><X size={18} aria-hidden="true" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** A "How it works" button that opens the guide. */
export function HowItWorksButton({ className = 'inline-flex', compact = false }: { className?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="How it works" title="How it works"
        className={'items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-sm font-bold ring-1 ring-line hover:ring-ink ' + className}>
        <CircleHelp size={16} className="text-sky" aria-hidden="true" />{!compact && 'How it works'}
      </button>
      {open && <Sheet onClose={() => setOpen(false)}><HowItWorks /></Sheet>}
    </>
  );
}

/** The Market Day countdown as a pill that explains itself when tapped. */
export function MarketDayButton({ className = 'inline-flex' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} title="What's Market Day?"
        className={'items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold hover:brightness-95 ' + className}>
        <CalendarDays size={14} aria-hidden="true" /><MarketDay />
      </button>
      {open && (
        <Sheet onClose={() => setOpen(false)}>
          <p className="rounded-2xl bg-sun-soft px-4 py-3 text-sm">
            <span className="font-bold text-sun">Market Day</span> is the village&apos;s weekly release day: every Sunday, the Drafts villagers
            have checked are reviewed and published to the app.
          </p>
          <div className="mt-5"><HowItWorks /></div>
        </Sheet>
      )}
    </>
  );
}
