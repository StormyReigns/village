'use client';

import { useMemo } from 'react';
import { ArrowRight, Plus } from 'lucide-react';
import type { Block, Entry } from '@/data/pages';
import { Piece } from '@/components/Piece';
import { BlockIcon } from '@/components/Icon';
import { symbolFor } from '@/components/app/EntryPanel';
import { initials, onRoute } from '@/components/app/entries';
import type { BlockContext } from '@/components/app/blockParts';
import { STEP_LABEL, nextStep, partySize, type Plan, type Roster } from '@/lib/planner';
import { usePlan } from './usePlan';

// The Party Page with All picked in the route switcher (docs/blocks/planner.md; Matt, 2026-11-15: "I'm
// staring at a boring page"). Every run at a glance: one card per route with its party as pieces and
// a way in, and an invitation on the runs not started yet. With nothing planned anywhere, a sample of
// what a run looks like first, so a new player sees what they'd get.

function Mini({ e, roster, color }: { e: Entry; roster: Block; color: string }) {
  const symbol = symbolFor(e, roster);
  return <Piece size={34} color={color} image={e.icon}>{e.icon ? null : symbol ? <BlockIcon name={symbol} size={8} strokeWidth={2.4} /> : initials(e.name)}</Piece>;
}

/** A sample unit for the explainer: the first unit on the first route with a real recruiting step. */
function sampleOf(units: Entry[], rb: Block, routes: BlockContext['routes'], setup: Block['planSetup']) {
  const first = routes[0];
  if (!first) return null;
  for (const e of units) {
    if (e.spoiler || !onRoute(e, first.key)) continue;
    const step = nextStep(e, { roster: rb, route: first.key, recruited: false, setup });
    // A real step to take, not an avatar or a unit who joins on their own.
    if (step.kind === 'recruit' && !/\bauto\b|automatic|game start|tutorial|joins|off-route/i.test(step.text)) return { e, step, route: first };
  }
  return null;
}

export function Runs({ block, roster, ctx }: { block: Block; roster: Roster; ctx: BlockContext }) {
  const rb = roster.block;
  const size = partySize(block.planSetup);
  const units = useMemo(() => rb.entries.filter((e) => !e.header), [rb.entries]);
  const sources = useMemo(() => ({ roster: units }), [units]);
  // Reading through the saving hook also merges the account's plans when signed in.
  const { all, ready } = usePlan(ctx.gameId, block.id, sources, 'all', size);
  const byId = useMemo(() => new Map(units.map((e) => [e.id, e])), [units]);
  const color = `var(--${roster.page.tint})`;
  const runs = ctx.routes.map((r) => {
    const plan: Plan | undefined = all[r.key];
    const members = (plan?.party ?? []).map((id) => byId.get(id)).filter((e): e is Entry => Boolean(e && onRoute(e, r.key)));
    const planned = members.filter((e) => Object.keys(plan?.builds?.[e.id]?.classes ?? {}).length || Object.values(plan?.builds?.[e.id]?.gear ?? {}).some((x) => x.length)).length;
    return { r, members, planned };
  });
  const started = runs.filter((x) => x.members.length);
  const pick = (key: string) => ctx.onPickRoute?.(key as never);

  const sample = useMemo(() => sampleOf(units, rb, ctx.routes, block.planSetup), [units, rb, ctx.routes, block.planSetup]);

  if (!ready) return <div className="mt-4 h-48 animate-pulse rounded-2xl bg-card-2" />;

  return (
    <div className="mt-4 grid gap-4">
      {started.length === 0 && (
        <div className="rounded-2xl bg-card-2 p-4">
          <p className="font-display text-lg leading-tight">Plan a party for each run</p>
          <ol className="mt-2 grid gap-1 text-sm">
            <li><span className="font-bold">1.</span> Pick the units you&apos;ll take{size < 100 ? `, up to ${size}` : ''}.</li>
            <li><span className="font-bold">2.</span> Plan each one&apos;s classes and gear.</li>
            <li><span className="font-bold">3.</span> See the next thing to do for each, as you play.</li>
          </ol>
          {sample && (
            <div className="mt-3 rounded-2xl bg-card p-3 ring-1 ring-line" aria-label="An example">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">For example, on {sample.route.label}&apos;s run</p>
              <div className="mt-2 flex items-center gap-3">
                <Piece size={44} outline>{initials(sample.e.name)}</Piece>
                <span className="min-w-0">
                  <span className="block font-bold leading-tight">{sample.e.name}</span>
                  <span className="block text-sm leading-snug text-muted"><span className="font-bold text-ink">{STEP_LABEL.recruit}: </span>{sample.step.text}</span>
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      <div>
        <p className="font-bold">{started.length ? 'Your runs' : 'Pick a run to start'}</p>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {runs.map(({ r, members, planned }) => (
            <li key={r.key}>
              <button onClick={() => pick(r.key)} className="lift flex h-full w-full flex-col gap-2 rounded-2xl bg-card p-3 text-left ring-1 ring-line hover:ring-ink">
                <span className="flex w-full items-center gap-2">
                  <span className="flex-1 font-bold">{r.label} run</span>
                  <ArrowRight size={16} className="text-muted" aria-hidden="true" />
                </span>
                {members.length ? (
                  <>
                    <span className="flex flex-wrap gap-1.5">
                      {members.slice(0, 7).map((e) => <Mini key={e.id} e={e} roster={rb} color={color} />)}
                      {members.length > 7 && <span className="self-center text-sm font-bold text-muted">+{members.length - 7}</span>}
                    </span>
                    <span className="text-sm text-muted">
                      {block.planSetup?.size ? `${members.length} of ${size}` : `${members.length} ${members.length === 1 ? 'unit' : 'units'}`}
                      {planned ? ` · ${planned} with a plan` : ' · no classes or gear planned yet'}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="flex gap-1.5" aria-hidden="true">
                      {[0, 1, 2].map((i) => <Piece key={i} size={34} outline>{i === 0 ? <Plus size={11} /> : null}</Piece>)}
                    </span>
                    <span className="text-sm font-bold">Start a {r.label} run</span>
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">Each run has its own party, since who can join changes with the route.</p>
      </div>
    </div>
  );
}
