'use client';

import { useMemo, useState } from 'react';
import { Check, Plus, Search, X } from 'lucide-react';
import type { Entry } from '@/data/pages';
import { Piece } from '@/components/Piece';
import { BlockIcon } from '@/components/Icon';
import { symbolFor } from '@/components/app/EntryPanel';
import { initials, useTicks } from '@/components/app/entries';
import type { BlockContext } from '@/components/app/blockParts';
import { useKin } from '@/components/classes/kin';
import { classesFor } from '@/lib/class-fit';
import { groupOrder } from '@/lib/items';
import { buildOf, setClassStep, slotCount, slotsOf, toggleGear, toggleStepDone, type Plan, type PlanSetup, type PlanSlot, type Roster } from '@/lib/planner';
import type { ClassLadder } from './sources';

// A party member's plan (docs/blocks/planner.md, slice 2), at the top of their card on the Party Page:
// a class for each tier of the Classes ladder, and items in each gear slot. Planned is the split
// outline; done (a class reached, an item got) is solid, as everywhere in Village.

type Picking = { kind: 'class'; band: string } | { kind: 'gear'; slot: string } | null;

const Label = ({ children }: { children: React.ReactNode }) => <h4 className="text-xs font-bold uppercase tracking-wide text-muted">{children}</h4>;

/** A small piece for a class or an item, with its name under it, like an app icon. */
function Tile({ entry, color, outline, empty, label, sub, on, onClick }: {
  entry?: Entry; color: string; outline?: boolean; empty?: boolean; label: string; sub?: string; on?: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} aria-pressed={on} className="grid w-[4.75rem] justify-items-center gap-1 rounded-xl p-1 text-center hover:bg-card-2">
      <span className={'rounded-xl p-0.5 ' + (on ? 'bg-signal' : '')}>
        {empty ? <Piece size={40} outline><Plus size={14} aria-hidden="true" /></Piece>
          : outline ? <Piece size={40} outline>{initials(entry!.name)}</Piece>
            : <Piece size={40} color={color} image={entry!.icon}>{entry!.icon ? null : initials(entry!.name)}</Piece>}
      </span>
      <span className="line-clamp-2 text-xs font-bold leading-tight">{label}</span>
      {sub && <span className="line-clamp-2 text-[0.7rem] leading-tight text-muted">{sub}</span>}
    </button>
  );
}

export function BuildPlan({ unit, roster, setup, ladder, plan, setPlan, ctx }: {
  unit: Entry; roster: Roster; setup?: PlanSetup; ladder?: ClassLadder; plan: Plan; setPlan: (p: Plan) => void; ctx: BlockContext;
}) {
  const [picking, setPicking] = useState<Picking>(null);
  const [ticks, toggle] = useTicks(ctx.gameId);
  const build = buildOf(plan, unit.id);
  const slots = slotsOfRoster(roster, setup);
  const classColor = roster.classes ? `var(--${roster.classes.page.tint})` : 'var(--indigo)';
  const shownBands = ladder ? ladder.bands.filter((b) => ctx.spoilers || !ladder.spoilerBands.has(b)) : [];
  const hiddenBands = ladder ? ladder.bands.length - shownBands.length : 0;

  return (
    <section aria-label={`Your plan for ${unit.name}`} className="mb-5 rounded-2xl bg-card-2 p-3 ring-1 ring-line">
      <h3 className="font-display text-lg leading-tight">Your plan for {unit.name}</h3>

      {ladder && (
        <div className="mt-3">
          <Label>Class steps</Label>
          <div className="mt-1 flex flex-wrap gap-x-1 gap-y-2">
            {shownBands.map((band) => {
              const step = build.classes?.[band];
              const cls = step ? ladder.byId.get(step.id) : undefined;
              return (
                <div key={band} className="grid justify-items-center">
                  <Tile entry={cls} color={classColor} empty={!cls} outline={Boolean(cls && !step?.done)} on={picking?.kind === 'class' && picking.band === band}
                    label={cls ? cls.name : band} sub={cls ? ladder.exam(cls) || band : 'Pick'}
                    onClick={() => setPicking(picking?.kind === 'class' && picking.band === band ? null : { kind: 'class', band })} />
                  {cls && (
                    <button onClick={() => setPlan(toggleStepDone(plan, unit.id, band))} aria-pressed={Boolean(step?.done)}
                      aria-label={`${cls.name} ${step?.done ? 'reached' : 'not reached yet'}`}
                      className={'mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[0.7rem] font-bold ring-1 ' + (step?.done ? 'bg-ink text-white ring-ink' : 'ring-line hover:ring-ink')}>
                      {step?.done && <Check size={11} strokeWidth={3} aria-hidden="true" />}{step?.done ? 'Reached' : 'Reached?'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {hiddenBands > 0 && (
            <p className="mt-1 text-xs text-muted">{hiddenBands} more {hiddenBands === 1 ? 'tier' : 'tiers'} hidden as spoilers. <button onClick={ctx.onShowSpoilers} className="font-bold underline underline-offset-2">Show them</button></p>
          )}
          {picking?.kind === 'class' && (
            <ClassPicker unit={unit} roster={roster} ladder={ladder} band={picking.band} chosen={build.classes?.[picking.band]?.id} color={classColor} ctx={ctx}
              onPick={(id) => { setPlan(setClassStep(plan, unit.id, picking.band, id)); setPicking(null); }} onClose={() => setPicking(null)} />
          )}
        </div>
      )}

      {slots.map(({ slot, source }) => {
        const count = slotCount(slot);
        const chosen = build.gear?.[slot.key] ?? [];
        const byId = new Map(source.block.entries.map((e) => [e.id, e]));
        const color = `var(--${source.page.tint})`;
        const open = picking?.kind === 'gear' && picking.slot === slot.key;
        return (
          <div key={slot.key} className="mt-4">
            <Label>{slot.label}{count > 1 ? ` · ${chosen.length} of ${count}` : ''}</Label>
            <div className="mt-1 flex flex-wrap gap-x-1 gap-y-2">
              {chosen.map((id) => {
                const item = byId.get(id);
                if (!item) return null;
                const gotKey = `got:${source.block.id}.${id}`;
                const got = ticks.has(gotKey);
                return (
                  <div key={id} className="grid justify-items-center">
                    <Tile entry={item} color={color} outline={!got} label={item.name} on={open} onClick={() => setPicking(open ? null : { kind: 'gear', slot: slot.key })} />
                    {/* The same "Got it" tick as on the item's own card. */}
                    <button onClick={() => toggle(gotKey)} aria-pressed={got} aria-label={`${item.name} ${got ? 'got' : 'not got yet'}`}
                      className={'mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[0.7rem] font-bold ring-1 ' + (got ? 'bg-ink text-white ring-ink' : 'ring-line hover:ring-ink')}>
                      {got && <Check size={11} strokeWidth={3} aria-hidden="true" />}{got ? 'Got it' : 'Got it?'}
                    </button>
                  </div>
                );
              })}
              {chosen.length < count && (
                <Tile empty color={color} label="Add" on={open} onClick={() => setPicking(open ? null : { kind: 'gear', slot: slot.key })} />
              )}
            </div>
            {open && (
              <GearPicker slot={slot} entries={source.block.entries} chosen={chosen} count={count} color={color} ctx={ctx} blockTitle={source.block.title}
                filters={source.block.filters} symbols={source.block.symbols}
                onToggle={(id) => setPlan(toggleGear(plan, unit.id, slot.key, id, count))} onClose={() => setPicking(null)} />
            )}
          </div>
        );
      })}
    </section>
  );
}

/** The planner's gear slots with the Items Block each draws from (slots whose Block is missing are left out). */
function slotsOfRoster(roster: Roster, setup?: PlanSetup): { slot: PlanSlot; source: NonNullable<Roster['slots']>[string] }[] {
  return slotsOf(setup).flatMap((slot) => (roster.slots?.[slot.key] ? [{ slot, source: roster.slots[slot.key] }] : []));
}

/** One tier's classes: the ones that suit this unit first (from "Classes for <name>"), then every class in it. */
function ClassPicker({ unit, roster, ladder, band, chosen, color, ctx, onPick, onClose }: {
  unit: Entry; roster: Roster; ladder: ClassLadder; band: string; chosen?: string; color: string; ctx: BlockContext;
  onPick: (id: string | null) => void; onClose: () => void;
}) {
  const kin = useKin(roster.block.id);
  const inBand = ladder.inBand(band).filter((e) => ctx.spoilers || !e.spoiler);
  const suggested = useMemo(() => {
    if (!kin || !unit.stats) return [];
    const rows = kin.rows.filter((r) => r.band === band && inBand.some((e) => e.id === r.id));
    const cast = roster.block.entries.map((e) => e.stats);
    return classesFor(unit.stats, cast, rows, kin.defs).slice(0, 3).flatMap((f) => {
      const e = ladder.byId.get(f.row.id);
      return e ? [{ e, why: f.reason.map((d) => d.label).join(', ') }] : [];
    });
  }, [kin, unit.stats, band, inBand, roster.block.entries, ladder.byId]);
  const Row = ({ e, why }: { e: Entry; why?: string }) => (
    <li>
      <button onClick={() => onPick(e.id)} aria-pressed={chosen === e.id} className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-card">
        <span className={'rounded-xl p-0.5 ' + (chosen === e.id ? 'bg-signal' : '')}><Piece size={34} color={color} image={e.icon}>{e.icon ? null : initials(e.name)}</Piece></span>
        <span className="min-w-0">
          <span className="block text-sm font-bold leading-tight">{e.name}</span>
          <span className="block text-xs text-muted">{[ladder.exam(e), why && `Raises ${why}`].filter(Boolean).join(' · ')}</span>
        </span>
      </button>
    </li>
  );
  return (
    <div className="mt-2 rounded-2xl bg-card p-2 ring-1 ring-line">
      <div className="flex items-center gap-2 px-1">
        <p className="flex-1 text-sm font-bold">{band} class for {unit.name}</p>
        {chosen && <button onClick={() => onPick(null)} className="rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-line hover:ring-ink">Clear</button>}
        <button onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-full hover:bg-card-2"><X size={15} aria-hidden="true" /></button>
      </div>
      {suggested.length > 0 && (
        <>
          <p className="mt-2 px-2 text-xs font-bold uppercase tracking-wide text-muted">Suits {unit.name}</p>
          <ul>{suggested.map(({ e, why }) => <Row key={e.id} e={e} why={why} />)}</ul>
        </>
      )}
      <p className="mt-2 px-2 text-xs font-bold uppercase tracking-wide text-muted">Every {band} class</p>
      <ul className="thin-scroll max-h-72 overflow-y-auto">{inBand.map((e) => <Row key={e.id} e={e} />)}</ul>
      {inBand.length === 0 && <p className="px-2 py-2 text-sm text-muted">No classes in this tier on your route.</p>}
    </div>
  );
}

/** A slot's items, searchable, grouped by their first tag, tap to put in or take out. */
function GearPicker({ slot, entries, chosen, count, color, ctx, blockTitle, filters, symbols, onToggle, onClose }: {
  slot: PlanSlot; entries: Entry[]; chosen: string[]; count: number; color: string; ctx: BlockContext; blockTitle: string;
  filters?: string[]; symbols?: Record<string, string>; onToggle: (id: string) => void; onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const fits = entries.filter((e) => !e.header && (!slot.tag || slot.tag.values.includes(e.categories[slot.tag.key] ?? ''))
    && (ctx.spoilers || !e.spoiler || chosen.includes(e.id)) && (!q || e.name.toLowerCase().includes(q)));
  const key = filters?.[0];
  const grouped = fits.reduce((m, e) => { const g = (key && e.categories[key]) || 'Others'; m.set(g, [...(m.get(g) ?? []), e]); return m; }, new Map<string, Entry[]>());
  // In the Items Block's order: letter ranks best first (S, A, B...), else as they come.
  const groups = groupOrder([...grouped.keys()]).map((g) => [g, grouped.get(g)!] as const);
  const full = chosen.length >= count;
  return (
    <div className="mt-2 rounded-2xl bg-card p-2 ring-1 ring-line">
      <div className="flex items-center gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-card-2 px-3 py-1.5 ring-1 ring-line focus-within:ring-2 focus-within:ring-sky">
          <Search size={15} className="text-muted" aria-hidden="true" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${blockTitle.toLowerCase()}`} aria-label={`Search ${blockTitle}`}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted" />
        </label>
        <button onClick={onClose} className="btn-primary shrink-0 rounded-full px-3 py-1.5 text-sm font-bold">Done</button>
      </div>
      <p className="mt-1.5 px-1 text-xs text-muted" aria-live="polite">{full ? `${slot.label} is full: tap one to take it out.` : `Tap to add, tap again to take out. ${chosen.length} of ${count}.`}</p>
      <div className="thin-scroll max-h-80 overflow-y-auto">
        {groups.map(([g, list]) => (
          <div key={g} className="mt-2">
            {key && <p className="px-1 text-xs font-bold uppercase tracking-wide text-muted">{g}</p>}
            <ul className="mt-1 grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-x-1 gap-y-2">
              {list.map((e) => {
                const on = chosen.includes(e.id);
                const symbol = symbolFor(e, { filters, symbols });
                return (
                  <li key={e.id}>
                    <button onClick={() => onToggle(e.id)} aria-pressed={on} disabled={!on && full} className="grid w-full justify-items-center gap-1 rounded-xl p-1 text-center disabled:opacity-40">
                      <span className={'relative rounded-xl p-0.5 ' + (on ? 'bg-signal' : '')}>
                        <Piece size={40} color={color} image={e.icon}>{e.icon ? null : symbol ? <BlockIcon name={symbol} size={9} strokeWidth={2.4} /> : initials(e.name)}</Piece>
                        {on && <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-ink text-white"><Check size={12} strokeWidth={3} aria-hidden="true" /></span>}
                      </span>
                      <span className="line-clamp-2 text-xs font-bold leading-tight">{e.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {groups.length === 0 && <p className="px-1 py-3 text-sm text-muted">Nothing called that here.</p>}
      </div>
    </div>
  );
}
