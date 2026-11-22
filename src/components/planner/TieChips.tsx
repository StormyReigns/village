'use client';

import { Check, Hourglass } from 'lucide-react';
import { Piece } from '@/components/Piece';
import { EntryLink } from '@/components/app/Peek';
import type { TieCandidate } from '@/lib/ties';

// What a party member's plan hangs on that's ticked elsewhere (docs/blocks/planner.md, 2026-11-22): a last chance
// with its deadline, or an item, each with its own tick. Ticking here ticks it on Last chances or the item's card,
// and the other way round: one tick, wherever it's shown.

export interface Tie extends TieCandidate { due?: string }

export function TieChips({ ties, ticks, toggle, color, label }: {
  ties: Tie[]; ticks: Set<string>; toggle: (key: string) => void; color: string;
  /** Read out before the chips ("Buccar needs"). */
  label: string;
}) {
  if (!ties.length) return null;
  return (
    <span role="group" aria-label={label} className="mt-1.5 flex flex-wrap gap-1.5">
      {ties.map((t) => {
        const done = ticks.has(t.key);
        const word = t.kind === 'item' ? (done ? 'Got it' : 'Got it?') : (done ? 'Done' : 'Done?');
        return (
          <span key={t.key} className={'inline-flex max-w-full items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2 text-xs ' + (done ? 'border-line bg-card-2 text-muted' : 'border-line bg-card')}>
            <button type="button" onClick={() => toggle(t.key)} role="checkbox" aria-checked={done} aria-label={`${t.name}: ${word}`} title={word} className="shrink-0">
              <Piece size={20} color={color} outline={!done}>{done ? <Check size={9} strokeWidth={3} aria-hidden="true" /> : null}</Piece>
            </button>
            {t.kind === 'deadline' && <Hourglass size={12} className="shrink-0" style={{ color }} aria-hidden="true" />}
            <EntryLink href={t.href} className={'min-w-0 truncate font-bold hover:underline ' + (done ? 'line-through' : 'text-ink')}>{t.name}</EntryLink>
            {t.due && !done && <span className="shrink-0 truncate text-muted">· {t.due}</span>}
          </span>
        );
      })}
    </span>
  );
}
