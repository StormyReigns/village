'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, ClipboardList } from 'lucide-react';
import type { Block, Page, Route } from '@/data/pages';
import { Piece } from '@/components/Piece';
import { TINT } from '@/components/app/tint';
import { STEP_LABEL, plannerRosters, type Roster } from '@/lib/planner';
import { useParty } from './useParty';

// "Your party" on the game's home (docs/blocks/planner.md, slice 2b; since 2026-11-22 rows inside the
// home's "Next for you" card, docs/app-design.md): the next thing to do for the first few party members
// who still have something to do, each opening their plan on the Party Page. Empty party: an invitation.
// Nothing until a route is picked on games with routes.

const ACTION = new Set(['recruit', 'gear', 'class']);

/** The game's first Planner, the Page it's on, and what it picks from. */
function findPlanner(pages: Page[]): { page: Page; block: Block; roster: Roster } | null {
  for (const page of pages) {
    const block = page.blocks.find((b) => b.type === 'planner');
    const roster = block && plannerRosters(pages, page)[block.id];
    if (block && roster) return { page, block, roster };
  }
  return null;
}

/** Your party's next steps as list rows (inside a <ul>), up to `max` of them, then a way to the Party Page. */
export function PartySteps({ gameId, pages, route, max = 3 }: { gameId: string; pages: Page[]; route: Route | 'all'; max?: number }) {
  const found = useMemo(() => findPlanner(pages), [pages]);
  if (!found || (found.block.byRoute && route === 'all')) return null;
  return <Steps gameId={gameId} page={found.page} block={found.block} roster={found.roster} route={route} max={max} />;
}

function Steps({ gameId, page, block, roster, route, max }: { gameId: string; page: Page; block: Block; roster: Roster; route: Route | 'all'; max: number }) {
  const href = `/g/${gameId}/${page.id}`;
  const { members, stepOf, rb, ready } = useParty(gameId, block, roster, route, href);
  const todo = members.map((e) => ({ e, step: stepOf(e) })).filter((x) => ACTION.has(x.step.kind));
  const t = TINT[page.tint];
  if (!ready) return null;
  if (!members.length) {
    return (
      <li>
        <Link href={href} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-card-2">
          <Piece size={36} outline><ClipboardList size={12} strokeWidth={2.4} aria-hidden="true" /></Piece>
          <span className="min-w-0 flex-1 leading-snug">
            <span className="block font-bold">Plan your party</span>
            <span className="block text-sm text-muted">Pick your units, and each one shows what to do next.</span>
          </span>
          <ArrowRight size={16} className="shrink-0 text-muted" aria-hidden="true" />
        </Link>
      </li>
    );
  }
  return (
    <>
      {todo.slice(0, max).map(({ e, step }) => (
        <li key={e.id}>
          <Link href={`${href}?e=${rb.id}.${e.id}`} className="block rounded-xl px-2 py-1.5 text-sm leading-snug hover:bg-card-2">
            <span className="font-bold">{e.name}</span>
            <span className="text-muted"> · {STEP_LABEL[step.kind]}: {step.text}</span>
          </Link>
        </li>
      ))}
      <li>
        <Link href={href} className={`inline-flex items-center gap-1 rounded-xl px-2 py-1.5 text-sm font-bold ${t.text} hover:bg-card-2`}>
          {todo.length > max ? `Your party · ${todo.length - max} more to do` : todo.length ? 'Your party' : 'Your party · everyone’s plan is done'}
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </li>
    </>
  );
}
