'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronDown, Hourglass } from 'lucide-react';
import type { Entry } from '@/data/pages';
import { Piece } from '@/components/Piece';
import type { BlockContext } from '@/components/app/blockParts';
import { EntryLink } from '@/components/app/Peek';
import { onRoute } from '@/components/app/entries';
import { byDeadline, deadlineRank, deadlineText, NO_DEADLINE } from '@/lib/deadline';
import { byRenownAndLevel, chapterLabel, groupInOrder, renownOf } from '@/lib/my-run';
import { buildOf, joinKind, toggleStepDone, type Plan, type Roster } from '@/lib/planner';
import type { ClassLadder } from './sources';
import { TieChips, type Tie } from './TieChips';

const END_OF_PART_ONE = 12.5;
/** How many open items "Your run" shows after Next up before folding the rest away. */
const SHOWN = 4;

// The Party Page's run (docs/blocks/planner.md; reshaped 2026-11-22 from Matt's "just scrolling through lists"):
//   1. Next up: the one next thing to do, big, at the top, with why it matters and its tick.
//   2. The party (handed in as `party`): a strip of faces.
//   3. Your run: everything else in the order you'll meet it, the route's last chances by the chapter of their
//      deadline, then what has no chapter (recruiting, class steps, gear) by the Renown and level it needs (Matt:
//      "Order by Renown, level"). The next few show; later chapters fold away.
// The ticks are the same ones as everywhere: a last chance ticked here is ticked on Last chances, a recruit on
// Units, a class "Reached" on the unit's plan, an item's Got it on its card.

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
  /** What this hangs on that's ticked elsewhere (a recruit's Giant's Meat). */
  ties?: Tie[];
  /** Opens it: a last chance in a pop-up, a unit's card with their plan. */
  open: { href: string } | { unit: string };
}

/** Planned gear still to get (from the Party list). */
export interface Gear { key: string; name: string; needs?: string; done: boolean; toggle: () => void; href: string }
const NONE: Record<string, string[]> = {};
const NO_GEAR: Gear[] = [];

export function MyRun({ roster, ctx, members, plan, setPlan, ladder, recruits, recruitKey, ticks, toggle, onOpenUnit, forWhom = NONE, gear = NO_GEAR, tiesOf, party }: {
  roster: Roster; ctx: BlockContext; members: Entry[]; plan: Plan; setPlan: (p: Plan) => void; ladder?: ClassLadder;
  recruits: boolean; recruitKey: (e: Entry) => string; ticks: Set<string>; toggle: (key: string) => void; onOpenUnit: (e: Entry) => void;
  /** Party members a last chance is needed for, by its tick key ("for Buccar"). */
  forWhom?: Record<string, string[]>;
  /** Planned gear still to get, with the item's own Got it tick. */
  gear?: Gear[];
  /** What a unit's recruiting hangs on (src/lib/ties.ts). */
  tiesOf?: (e: Entry) => Tie[];
  /** The party strip, shown between Next up and Your run. */
  party: React.ReactNode;
}) {
  const route = ctx.route;
  const [showDone, setShowDone] = useState(false);
  const [showAll, setShowAll] = useState(false);
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
        const who = forWhom[key]?.length ? `for ${forWhom[key].join(', ')}` : undefined;
        return { key, name: e.name, needs: [text?.split('\n')[0], who].filter(Boolean).join(' · ') || undefined, done: ticks.has(key), toggle: () => toggle(key), rank: deadlineRank(text), open: { href: `/g/${ctx.gameId}/${page.id}?e=${key}` } };
      }));
    // Party members to recruit (the usual way, with steps on this route), and what their recruiting hangs on.
    const recruiting: Item[] = recruits ? members.flatMap((e) => {
      const line = e.perRoute?.[route as keyof NonNullable<Entry['perRoute']>]?.[0]?.text;
      if (!line || joinKind(e, route).kind !== 'none') return [];
      const key = recruitKey(e);
      return [{ key, name: `Recruit ${e.name}`, needs: line, first: true, done: ticks.has(key), toggle: () => toggle(key), ties: tiesOf?.(e), open: { unit: e.id } }];
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
      ready: byRenownAndLevel<Item>([...recruiting, ...classes, ...gear.map((g): Item => ({ key: g.key, name: g.name, needs: g.needs, done: g.done, toggle: g.toggle, open: { href: g.href } }))]),
      later: deadlines.filter((d) => (d.rank ?? NO_DEADLINE) >= NO_DEADLINE),
    };
  }, [roster.deadlines, route, ctx.spoilers, ctx.gameId, ticks, toggle, recruits, members, recruitKey, ladder, plan, setPlan, forWhom, gear, tiesOf]);

  // "When you're ready" sits just before the end of Part I, when recruiting closes.
  const partOneAll = dated.filter((x) => (x.rank ?? 0) < END_OF_PART_ONE);
  const afterAll = dated.filter((x) => (x.rank ?? 0) >= END_OF_PART_ONE);
  const all = [...partOneAll, ...ready, ...afterAll, ...later];
  const label = (x: Item) => (ready.includes(x) ? 'When you’re ready' : chapterLabel(x.rank ?? NO_DEADLINE));
  const next = all.find((x) => !x.done && x.key !== snapped) ?? (snapped ? all.find((x) => x.key === snapped) : undefined);
  const done = all.filter((x) => x.done && x.key !== snapped).length;
  const color = `var(--${ctx.tint})`;

  // After Next up: the next few open items in order, then "Later" for the rest (done ones fold under Show done).
  const rest = all.filter((x) => x !== next && (showDone || !x.done || x.key === snapped));
  const openRest = rest.filter((x) => !x.done || x.key === snapped);
  const cut = showAll ? rest.length : (() => { let n = 0, i = 0; for (; i < rest.length && n < SHOWN; i++) if (!rest[i].done) n++; return i; })();
  // The party's own steps ("When you're ready": recruits, classes, gear) always show: they're what this Page is for.
  const shown = rest.filter((x, i) => i < cut || ready.includes(x));
  const folded = openRest.length - shown.filter((x) => !x.done).length;
  const groups = groupInOrder(shown, label);

  const openIt = (it: Item) => ('unit' in it.open ? members.find((m) => m.id === (it.open as { unit: string }).unit) : undefined);
  const body = (it: Item, big?: boolean) => (
    <>
      <span className={(big ? 'block font-display text-xl leading-tight ' : 'block font-bold leading-tight ') + (it.done ? 'line-through' : '')}>{it.name}</span>
      {it.needs && <span className="mt-0.5 flex items-start gap-1 text-sm leading-snug text-muted">{it.rank !== undefined && <Hourglass size={13} className="mt-1 shrink-0" style={{ color }} aria-hidden="true" />}{it.needs}</span>}
    </>
  );
  const opener = (it: Item, big?: boolean) => 'href' in it.open
    ? <EntryLink href={it.open.href} className="block min-w-0 flex-1 text-left">{body(it, big)}</EntryLink>
    : <button onClick={() => { const u = openIt(it); if (u) onOpenUnit(u); }} className="block min-w-0 flex-1 text-left">{body(it, big)}</button>;

  return (
    // One column no wider than the screen: a long chip or name wraps or truncates instead of widening the page.
    <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-4">
      {/* 1. Next up: the answer to "what's next?", before anything else. */}
      {next ? (
        <section aria-label="Next up" className="rounded-2xl bg-signal/15 p-3 ring-2 ring-signal">
          <p className="text-xs font-bold uppercase tracking-wide text-ink">Next up · {label(next)}</p>
          <div className="mt-1.5 flex items-start gap-3">
            {opener(next, true)}
            <button onClick={() => tick(next)} role="checkbox" aria-checked={next.done} aria-label={`Done: ${next.name}`}
              className="grid shrink-0 justify-items-center gap-0.5">
              <Piece size={40} color={color} outline={!next.done} snap={next.done && next.key === snapped}>{next.done ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : null}</Piece>
              <span className="text-[11px] font-bold">{next.done ? 'Done' : 'Done?'}</span>
            </button>
          </div>
          {next.ties && <TieChips ties={next.ties} ticks={ticks} toggle={toggle} color={color} label={`${next.name} needs`} />}
        </section>
      ) : all.length > 0 ? (
        <p className="rounded-2xl bg-card-2 p-3 font-bold">Everything on this run is done. Nothing missed!</p>
      ) : null}

      {/* 2. The party. */}
      {party}

      {/* 3. Your run: the rest, in order. */}
      {rest.length > 0 && (
        <section aria-label="Your run">
          <div className="flex items-baseline gap-2 px-1">
            <h3 className="font-display text-lg leading-tight">Your run</h3>
            <span className="text-sm text-muted">{done} of {all.length} done</span>
          </div>
          <ol className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-3">
            {groups.map((g, gi) => (
              <li key={`${g.label}-${gi}`}>
                <h4 className="px-1 text-xs font-bold uppercase tracking-wide text-muted">{g.label}</h4>
                <ul className="mt-1 divide-y divide-line overflow-hidden rounded-2xl bg-card ring-1 ring-line">
                  {g.items.map((it) => (
                    <li key={it.key} className={'flex items-start gap-3 px-3 py-2.5 ' + (it.done ? 'opacity-60' : '')}>
                      <button onClick={() => tick(it)} role="checkbox" aria-checked={it.done} aria-label={`Done: ${it.name}`} className="shrink-0">
                        <Piece size={28} color={color} outline={!it.done} snap={it.done && it.key === snapped}>{it.done ? <Check size={11} strokeWidth={3} aria-hidden="true" /> : null}</Piece>
                      </button>
                      <span className="min-w-0 flex-1">
                        {opener(it)}
                        {it.ties && !it.done && <TieChips ties={it.ties} ticks={ticks} toggle={toggle} color={color} label={`${it.name} needs`} />}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 px-1">
            {(folded > 0 || showAll) && (
              <button onClick={() => setShowAll(!showAll)} aria-expanded={showAll} className="inline-flex items-center gap-1 text-sm font-bold text-ink hover:underline">
                <ChevronDown size={16} className={showAll ? 'rotate-180' : ''} aria-hidden="true" /> {showAll ? 'Show less' : `Later · ${folded} more`}
              </button>
            )}
            {done > 0 && (
              <button onClick={() => setShowDone(!showDone)} aria-expanded={showDone} className="inline-flex items-center gap-1 text-sm font-bold text-muted hover:text-ink">
                {showDone ? 'Hide done' : `Show done · ${done}`}
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
