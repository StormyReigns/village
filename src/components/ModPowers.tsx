'use client';

import Link from 'next/link';
import { Check, Eye, Users } from 'lucide-react';
import { setViewAs, type ViewAs } from './viewAs';

const VIEWS: { key: ViewAs; label: string; note: string }[] = [
  { key: 'self', label: 'Yourself', note: 'Your account, with your moderator powers.' },
  { key: 'villager', label: 'A villager', note: "Signed in, but not you. Your posts look like anyone's, so you can vote on them. Those votes are practice: only you see them." },
  { key: 'visitor', label: 'A visitor', note: 'Not signed in. Read-only, with sign-in prompts.' },
];

/**
 * Moderator powers, as a section of the account menu (top right). Only shown to moderators and the
 * Founder. `close` shuts the menu after a choice.
 */
export function ModPowers({ view, close }: { view: ViewAs; close: () => void }) {
  return (
    <div className="mt-1 border-t border-line pt-1">
      <p className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-muted">Moderator</p>
      {/* The staff's shared room: tools, the staff chat and the site feed (docs/staff.md). */}
      <Link href="/staff" onClick={close} className="flex items-center gap-2 rounded-xl px-3 py-2 font-bold hover:bg-card-2">
        <Users size={16} className="text-leaf" aria-hidden="true" /> Staff room
      </Link>
      <p className="px-3 pb-1 pt-2 font-bold">See the site as</p>
      <ul role="radiogroup" aria-label="See the site as" className="grid gap-1">
        {VIEWS.map((v) => (
          <li key={v.key}>
            <button role="radio" aria-checked={view === v.key} onClick={() => { setViewAs(v.key); close(); }}
              className={'flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left hover:bg-card-2 ' + (view === v.key ? 'bg-card-2' : '')}>
              <span className={'mt-0.5 grid size-4 shrink-0 place-items-center rounded-full ring-1 ' + (view === v.key ? 'bg-leaf text-paper ring-leaf' : 'ring-line')}>
                {view === v.key && <Check size={11} aria-hidden="true" />}
              </span>
              <span>
                <span className="block font-bold">{v.label}</span>
                <span className="block text-xs text-muted">{v.note}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="px-3 pb-1 pt-2 text-xs text-muted">Only changes this browser. Nobody else is affected.</p>
    </div>
  );
}

/** A reminder pinned to the bottom of every page while seeing the site as someone else. */
export function ViewAsReminder({ view }: { view: ViewAs }) {
  if (view === 'self') return null;
  return (
    // The strip spans the screen to center the pill, so only the pill takes clicks: what sits
    // under the rest of the strip (the Workshop chat box, say) stays usable.
    <div role="status" className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="surface pointer-events-auto flex items-center gap-3 rounded-full py-1.5 pl-4 pr-1.5 text-sm">
        <Eye size={16} className="text-sun" aria-hidden="true" />
        <span>Seeing the site as <b>{view === 'villager' ? 'a villager' : 'a visitor'}</b></span>
        <button onClick={() => setViewAs('self')} className="btn-primary rounded-full px-3 py-1.5 font-bold">Back to me</button>
      </div>
    </div>
  );
}
