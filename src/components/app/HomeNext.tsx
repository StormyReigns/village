'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Check, ChevronDown, Hourglass, Signpost } from 'lucide-react';
import type { Page, Route } from '@/data/pages';
import { Piece } from '@/components/Piece';
import { PartySteps } from '@/components/planner/PartyHome';
import { byDeadline, deadlineText } from '@/lib/deadline';
import type { RouteOption } from './EntryPanel';
import { onRoute, useTicks } from './entries';
import { TINT } from './tint';

// The game home's route line and "Next for you" card (docs/app-design.md, slice 1). Everything here comes
// from what builders set up: the game's routes and route question, checklists and the Planner.

/** The game's word for a route inside a sentence: its own capitals ("Flame Lord"), but plain "route" for the default. */
const inText = (noun: string) => (noun === 'Route' ? 'route' : noun);

/**
 * Your route, always in view on the home: "Flame Lord: Theodora · Change", opening the phone's own picker.
 * Yellow when none is picked yet (act on this). `noun` is the game's own word for a route.
 */
export function RouteLine({ noun, question, routes, route, onPick }: {
  noun: string; question?: string; routes: RouteOption[]; route: Route | 'all'; onPick: (r: Route | 'all') => void;
}) {
  const picked = route !== 'all' ? routes.find((r) => r.key === route) : undefined;
  return (
    <label className={'relative flex min-h-12 cursor-pointer items-center gap-2.5 rounded-2xl px-4 py-2 ring-1 focus-within:ring-2 focus-within:ring-sky '
      + (picked ? 'bg-card ring-line hover:ring-ink' : 'bg-signal text-ink ring-signal')}>
      <Signpost size={18} className="shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 leading-tight">
        {picked ? (
          <><span className="text-muted">{noun}: </span><span className="font-bold">{picked.label}</span></>
        ) : (
          <><span className="block font-bold">{question ?? `Pick your ${inText(noun)}`}</span>
            <span className="block text-sm">For your deadlines and party. Search always shows every {inText(noun)}.</span></>
        )}
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 text-sm font-bold">{picked ? 'Change' : 'Pick'}<ChevronDown size={14} aria-hidden="true" /></span>
      <select value={route} onChange={(e) => onPick(e.target.value as Route | 'all')} aria-label={question ?? noun}
        className="absolute inset-0 cursor-pointer opacity-0">
        <option value="all">All</option>
        {routes.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
      </select>
    </label>
  );
}

/**
 * The next thing to do: the first unticked last chance on your route (with Done, the same tick as on its
 * Page), then your party's next steps. Nothing at all when there's neither.
 */
export function NextForYou({ gameId, pages, route, spoilers, hasRoutes, noun }: {
  gameId: string; pages: Page[]; route: Route | 'all'; spoilers: boolean; hasRoutes: boolean; noun: string;
}) {
  const [ticks, toggle] = useTicks(gameId);
  // The last one marked Done here, so a mis-tap is one tap to undo.
  const [undo, setUndo] = useState<{ id: string; name: string } | null>(null);
  const next = (() => {
    for (const p of pages) for (const b of p.blocks) {
      if (b.type !== 'checklist') continue;
      const e = byDeadline(b.entries, route).find((x) => !x.header && onRoute(x, route) && !ticks.has(`${b.id}.${x.id}`) && (spoilers || !x.spoiler));
      if (e) {
        const when = route !== 'all' ? deadlineText(e, route) : e.sections.find((s) => s.label === 'Before')?.text;
        return { p, b, e, when };
      }
    }
    return null;
  })();
  const party = <PartySteps gameId={gameId} pages={pages} route={route} />;
  // PartySteps decides for itself whether it has anything; the card shows when either part might.
  const hasPlanner = pages.some((p) => p.blocks.some((b) => b.type === 'planner'));
  if (!next && !hasPlanner) return null;
  const t = next ? TINT[next.p.tint] : null;
  return (
    <section aria-labelledby="next-for-you" className="surface rounded-2xl p-3 sm:p-4">
      <h2 id="next-for-you" className="px-2 text-xs font-bold uppercase tracking-wide text-muted">Next for you</h2>
      <ul className="mt-1.5 grid grid-cols-1 gap-0.5">
        {next && t && (
          <li className="flex items-center gap-3 rounded-xl px-2 py-1.5">
            <Piece size={40} color={`var(--${next.p.tint})`}><Hourglass size={13} strokeWidth={2.4} aria-hidden="true" /></Piece>
            <Link href={`/g/${gameId}/${next.p.id}`} className="min-w-0 flex-1 leading-snug">
              <span className={`block text-xs font-bold ${t.text}`}>Last chance</span>
              <span className="block font-bold">{next.e.name}</span>
              {(next.when || hasRoutes) && (
                <span className="block text-sm text-muted">{next.when ? `Before ${next.when.split('\n')[0]}` : `Pick your ${inText(noun)} to see the deadline.`}</span>
              )}
            </Link>
            <button onClick={() => { const id = `${next.b.id}.${next.e.id}`; toggle(id); setUndo({ id, name: next.e.name }); }} aria-label={`Done: ${next.e.name}`}
              className="inline-flex h-10 shrink-0 items-center gap-1 rounded-full bg-card px-3 text-sm font-bold ring-1 ring-line hover:ring-ink">
              <Check size={15} aria-hidden="true" /> Done
            </button>
          </li>
        )}
        {undo && ticks.has(undo.id) && (
          <li role="status" className="flex items-center gap-2 px-2 pb-1 text-sm text-muted">
            <Check size={14} aria-hidden="true" /><span className="min-w-0 flex-1 truncate">Done: {undo.name}</span>
            <button onClick={() => { toggle(undo.id); setUndo(null); }} className="font-bold text-ink underline underline-offset-2">Undo</button>
          </li>
        )}
        {party}
      </ul>
    </section>
  );
}
