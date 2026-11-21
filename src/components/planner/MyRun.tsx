'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronDown, Hourglass } from 'lucide-react';
import type { Entry } from '@/data/pages';
import { Piece } from '@/components/Piece';
import type { BlockContext } from '@/components/app/blockParts';
import { EntryLink } from '@/components/app/Peek';
import { Ring } from '@/components/app/Ring';
import { onRoute } from '@/components/app/entries';
import { byDeadline, deadlineRank, deadlineText, NO_DEADLINE } from '@/lib/deadline';
import { byRenownAndLevel, chapterLabel, groupInOrder, renownOf } from '@/lib/my-run';
import { buildOf, joinKind, toggleStepDone, type Plan, type Roster } from '@/lib/planner';
import type { ClassLadder } from './sources';

const END_OF_PART_ONE = 12.5;

// "My run" (docs/blocks/planner.md, 2026-11-20): the route's last chances by the chapter of their deadline,
// then what has no chapter (recruiting a party member, reaching their next class) by the Renown and level it
// needs, least first (Matt: "Order by Renown, level"). The ticks are the same ones as everywhere: a last
// chance ticked here is ticked on Last chances, a recruit on Units, a class "Reached" on the unit's plan.

interface Item {
  key: string;
  name: string;
  /** What it takes or when it's due, one line. */
  needs?: string;
  done: boolean;
  toggle: () => void;
  /** A last chance: its deadline's rank. */
  rank?: number;
  /** Sorting: Renown to wait for, and recruits first (src/lib/my-run.ts). */
  renown?: number;
  first?: boolean;
  /** Opens it: a last chance in a pop-up, a unit's card with their plan. */
  open: { href: string } | { unit: string };
}

export function MyRun({ roster, ctx, members, plan, setPlan, ladder, recruits, recruitKey, ticks, toggle, onOpenUnit }: {
  roster: Roster; ctx: BlockContext; members: Entry[]; plan: Plan; setPlan: (p: Plan) => void; ladder?: ClassLadder;
  recruits: boolean; recruitKey: (e: Entry) => string; ticks: Set<string>; toggle: (key: string) => void; onOpenUnit: (e: Entry) => void;
}) {
  const route = ctx.route;
  const [showDone, setShowDone] = useState(false);
  const [snapped, setSnapped] = useState<string | null>(null);
  // A box just ticked stays put for a moment, so the snap plays before it leaves the list.
  const tick = (it: Item) => {
    if (!it.done) { setSnapped(it.key); setTimeout(() => setSnapped((x) => (x === it.key ? null : x)), 700); }
    it.toggle();
  };

  const { dated, ready, later } = useMemo(() => {
    // The route's last chances, in deadline order.
    const deadlines: Item[] = (roster.deadlines ?? []).flatMap(({ block, page }) =>
      byDeadline(block.entries.filter((e) => (!block.byRoute || onRoute(e, route)) && (ctx.spoilers || !e.spoiler)), route).map((e) => {
        const key = `${block.id}.${e.id}`;
        const text = deadlineText(e, route);
        return { key, name: e.name, needs: text?.split('\n')[0], done: ticks.has(key), toggle: () => toggle(key), rank: deadlineRank(text), open: { href: `/g/${ctx.gameId}/${page.id}?e=${key}` } };
      }));
    // Party members to recruit (the usual way, with steps on this route), and their planned classes.
    const recruiting: Item[] = recruits ? members.flatMap((e) => {
      const line = e.perRoute?.[route as keyof NonNullable<Entry['perRoute']>]?.[0]?.text;
      if (!line || joinKind(e, route).kind !== 'none') return [];
      const key = recruitKey(e);
      return [{ key, name: `Recruit ${e.name}`, needs: line, first: true, done: ticks.has(key), toggle: () => toggle(key), open: { unit: e.id } }];
    }) : [];
    // A class step can't come before its unit joins: it waits for their recruit's Renown while they're still to recruit.
    const joinsAt = new Map(recruiting.filter((r) => !r.done).map((r) => [r.open && 'unit' in r.open ? r.open.unit : '', renownOf(r.needs) ?? 0]));
    const classes: Item[] = ladder ? members.flatMap((e) => ladder.bands.flatMap((band) => {
      const step = buildOf(plan, e.id).classes?.[band];
      const cls = step ? ladder.byId.get(step.id) : undefined;
      if (!step || !cls) return [];
      const needs = [ladder.needs(band), ladder.exam(cls)].filter(Boolean).join(' · ');
      const own = renownOf(needs);
      const wait = joinsAt.get(e.id);
      return [{ key: `class:${e.id}.${band}`, name: `${e.name}: ${cls.name}`, needs: needs || band, renown: wait !== undefined ? Math.max(wait, own ?? 0) : own, done: Boolean(step.done), toggle: () => setPlan(toggleStepDone(plan, e.id, band)), open: { unit: e.id } }];
    })) : [];
    return {
      dated: deadlines.filter((d) => (d.rank ?? NO_DEADLINE) < NO_DEADLINE),
      ready: byRenownAndLevel([...recruiting, ...classes]),
      later: deadlines.filter((d) => (d.rank ?? NO_DEADLINE) >= NO_DEADLINE),
    };
  }, [roster.deadlines, route, ctx.spoilers, ctx.gameId, ticks, toggle, recruits, members, recruitKey, ladder, plan, setPlan]);

  // "When you're ready" sits just before the end of Part I, when recruiting closes.
  const partOneAll = dated.filter((x) => (x.rank ?? 0) < END_OF_PART_ONE);
  const afterAll = dated.filter((x) => (x.rank ?? 0) >= END_OF_PART_ONE);
  const all = [...partOneAll, ...ready, ...afterAll, ...later];
  if (!all.length) return null;
  const done = all.filter((x) => x.done && x.key !== snapped).length;
  const visible = (xs: Item[]) => xs.filter((x) => showDone || !x.done || x.key === snapped);
  const next = all.find((x) => !x.done);
  const label = (x: Item) => chapterLabel(x.rank ?? NO_DEADLINE);
  const partOne = visible(partOneAll);
  const after = visible(afterAll);
  const groups = [
    ...groupInOrder(partOne, label),
    ...(visible(ready).length ? [{ label: 'When you’re ready', note: 'Least Renown first. Recruiting ends with Part I.', items: visible(ready) }] : []),
    ...groupInOrder(after, label),
    ...groupInOrder(visible(later), label),
  ] as { label: string; note?: string; items: Item[] }[];
  const lord = ctx.routes.find((r) => r.key === route)?.label;
  const color = `var(--${ctx.tint})`;

  return (
    <section aria-label="My run" className="mt-6">
      <div className="flex items-center gap-3 rounded-2xl bg-card-2 p-3">
        <Ring done={done} total={all.length} tint={ctx.tint} />
        <p className="min-w-0 text-sm">
          <span className="block font-display text-lg leading-tight">{lord ? `My run · ${lord}` : 'My run'}</span>
          <span className="block text-muted">{next ? <>Next: <span className="font-bold text-ink">{next.name}</span></> : 'Everything’s done. Nothing missed!'}</span>
        </p>
      </div>
      <p className="mt-2 px-1 text-sm text-muted">Last chances by chapter, then your party’s recruits and classes. Tick things off as you go.</p>

      <ol className="mt-3 grid gap-4">
        {groups.map((g) => (
          <li key={g.label}>
            <h4 className="px-1 text-xs font-bold uppercase tracking-wide text-muted">{g.label}</h4>
            {g.note && <p className="px-1 text-xs text-muted">{g.note}</p>}
            <ul className="mt-1.5 grid gap-1.5">
              {g.items.map((it) => {
                const first = it === next;
                const label = <><span className={'block font-bold leading-tight ' + (it.done ? 'line-through' : '')}>{first && <span className="mr-1.5 text-[11px] uppercase tracking-wide text-ink">Next up ·</span>}{it.name}</span>
                  {it.needs && <span className="mt-0.5 flex items-start gap-1 text-sm leading-snug text-muted">{it.rank !== undefined && <Hourglass size={13} className="mt-1 shrink-0" style={{ color }} aria-hidden="true" />}{it.needs}</span>}</>;
                return (
                  <li key={it.key} className={'flex items-start gap-3 rounded-2xl p-2.5 ring-1 ' + (first ? 'bg-signal/15 ring-signal' : 'bg-card ring-line') + (it.done ? ' opacity-60' : '')}>
                    <button onClick={() => tick(it)} role="checkbox" aria-checked={it.done} aria-label={`Done: ${it.name}`} className="shrink-0">
                      <Piece size={36} color={color} outline={!it.done} snap={it.done && it.key === snapped}>{it.done ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : null}</Piece>
                    </button>
                    {'href' in it.open
                      ? <EntryLink href={it.open.href} className="block min-w-0 flex-1 text-left">{label}</EntryLink>
                      : <button onClick={() => { const u = members.find((m) => m.id === (it.open as { unit: string }).unit); if (u) onOpenUnit(u); }} className="block min-w-0 flex-1 text-left">{label}</button>}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
      {done > 0 && (
        <button onClick={() => setShowDone(!showDone)} aria-expanded={showDone} className="mt-3 inline-flex items-center gap-1 px-1 text-sm font-bold text-muted hover:text-ink">
          <ChevronDown size={16} className={showDone ? 'rotate-180' : ''} aria-hidden="true" /> {showDone ? 'Hide done' : `Show done · ${done}`}
        </button>
      )}
    </section>
  );
}
