'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, ClipboardList } from 'lucide-react';
import type { Block, Page, Route } from '@/data/pages';
import { Piece } from '@/components/Piece';
import { TINT } from '@/components/app/tint';
import { STEP_LABEL, plannerRosters, type Roster } from '@/lib/planner';
import { useParty } from './useParty';

// "Your party" on the game's home (docs/blocks/planner.md, slice 2b): the next thing to do for the
// first few party members who still have something to do, each opening their plan on the Party Page.
// Empty party: an invitation. Nothing until a route is picked on games with routes.

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

export function PartyHome({ gameId, pages, route }: { gameId: string; pages: Page[]; route: Route | 'all' }) {
  const found = useMemo(() => findPlanner(pages), [pages]);
  if (!found || (found.block.byRoute && route === 'all')) return null;
  return <Card gameId={gameId} page={found.page} block={found.block} roster={found.roster} route={route} />;
}

function Card({ gameId, page, block, roster, route }: { gameId: string; page: Page; block: Block; roster: Roster; route: Route | 'all' }) {
  const href = `/g/${gameId}/${page.id}`;
  const { members, stepOf, rb, ready } = useParty(gameId, block, roster, route, href);
  const todo = members.map((e) => ({ e, step: stepOf(e) })).filter((x) => ACTION.has(x.step.kind));
  const t = TINT[page.tint];
  if (!ready) return null;
  return (
    <div className="surface rounded-2xl p-4">
      <Link href={href} className="flex items-center gap-3">
        <Piece size={56} color={`var(--${page.tint})`}><ClipboardList size={17} strokeWidth={2.4} aria-hidden="true" /></Piece>
        <span className="min-w-0 flex-1">
          <span className={`block text-xs font-bold uppercase tracking-wide ${t.text}`}>Your party</span>
          <span className="block font-bold leading-tight">
            {!members.length ? 'Plan who you’ll take on this run' : todo.length ? `Next for ${todo.length === 1 ? todo[0].e.name : `${todo.length} of them`}` : 'Everyone’s plan is done'}
          </span>
          {!members.length && <span className="block text-sm text-muted">Pick your units, and each one shows what to do next.</span>}
        </span>
        <ArrowRight size={18} className="mt-1 text-muted" aria-hidden="true" />
      </Link>
      {todo.length > 0 && (
        <ul className="mt-2 grid gap-1">
          {todo.slice(0, 3).map(({ e, step }) => (
            <li key={e.id}>
              <Link href={`${href}?e=${rb.id}.${e.id}`} className="block rounded-xl px-2 py-1.5 text-sm leading-snug hover:bg-card-2">
                <span className="font-bold">{e.name}</span>
                <span className="text-muted"> · {STEP_LABEL[step.kind]}: {step.text}</span>
              </Link>
            </li>
          ))}
          {todo.length > 3 && <li className="px-2 text-sm text-muted"><Link href={href} className="font-bold underline underline-offset-2">{todo.length - 3} more</Link></li>}
        </ul>
      )}
    </div>
  );
}
