'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, GripVertical, Plus, Search, Share2, Shield, Swords, X } from 'lucide-react';
import type { Block, Entry } from '@/data/pages';
import { Piece } from '@/components/Piece';
import { BlockIcon } from '@/components/Icon';
import { EntryPanel, symbolFor } from '@/components/app/EntryPanel';
import { initials, rememberEntry, useOpenEntry } from '@/components/app/entries';
import type { BlockContext } from '@/components/app/blockParts';
import { STEP_LABEL, addMember, buildOf, joinKind, moveMember, moveMemberTo, removeMember, slotCount, type Build, type PlanSlot, type Roster } from '@/lib/planner';
import { BuildPlan } from './BuildPlan';
import { useParty } from './useParty';
import { Runs } from './Runs';
import { MyRun } from './MyRun';
import { TieChips } from './TieChips';
import { valueOf } from '@/lib/fields';
import type { ClassLadder } from './sources';

// The Planner Block (docs/blocks/planner.md): your party for this run, picked from the roster (Units),
// each with the next thing to do for them: recruit, get their gear, reach their next class. Saved on
// this device, and in your account when signed in. Tapping a unit opens their card over the Party
// Page, with your plan for them (class steps and gear) at the top.

/**
 * What else there is to plan for a unit, as chips under their line: their classes and each gear slot,
 * "+" while nothing's picked (Matt, 2026-11-15: it wasn't clear there was more to do for each one).
 * A tap opens their card with the plan at the top.
 */
function PlanChips({ build, ladder, slots, onOpen, name }: {
  build: Build; ladder?: ClassLadder; slots: { slot: PlanSlot }[]; onOpen: () => void; name: string;
}) {
  const steps = ladder ? ladder.bands.map((b) => build.classes?.[b]).filter(Boolean) : [];
  const last = steps.length ? ladder?.byId.get(steps[steps.length - 1]!.id)?.name : undefined;
  const chip = 'inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ';
  const empty = chip + 'border border-dashed border-ink/40 text-muted hover:border-ink hover:text-ink';
  const full = chip + 'border border-line bg-card-2 text-ink hover:border-ink';
  if (!ladder && !slots.length) return null;
  return (
    <span className="mt-1.5 flex flex-wrap gap-1.5">
      {ladder && (
        <button onClick={onOpen} className={last ? full : empty} aria-label={last ? `${name}'s classes: ${last}` : `Plan ${name}'s classes`}>
          {last ? <Shield size={12} aria-hidden="true" /> : <Plus size={12} aria-hidden="true" />}
          <span className="truncate">{last ? `${last} · ${steps.length} of ${ladder.bands.length}` : 'Classes'}</span>
        </button>
      )}
      {slots.map(({ slot }) => {
        const n = build.gear?.[slot.key]?.length ?? 0;
        const of = slotCount(slot);
        return (
          <button key={slot.key} onClick={onOpen} className={n ? full : empty} aria-label={n ? `${name}'s ${slot.label}: ${n} of ${of}` : `Plan ${name}'s ${slot.label}`}>
            {n ? <Swords size={12} aria-hidden="true" /> : <Plus size={12} aria-hidden="true" />}
            <span className="truncate">{slot.label}{n ? ` · ${n} of ${of}` : ''}</span>
          </button>
        );
      })}
    </span>
  );
}

/** A unit as a piece: solid once they're yours, the split outline while they're still to recruit. */
function UnitPiece({ entry, roster, color, outline, size = 52 }: { entry: Entry; roster: Block; color: string; outline?: boolean; size?: number }) {
  const symbol = symbolFor(entry, roster);
  const inside = symbol ? <BlockIcon name={symbol} size={Math.round(size * 0.22)} strokeWidth={2.4} /> : initials(entry.name);
  // Still to recruit: the split outline, with their portrait inside it when they have one (review, 2026-11-20:
  // rows of bare outlines all looked alike on a phone).
  if (outline && entry.icon) {
    return (
      <span className="relative inline-grid shrink-0 place-items-center">
        <Piece size={size} outline />
        <span className="absolute inset-0 grid place-items-center"><Piece size={Math.round(size * 0.74)} image={entry.icon} className="opacity-90" /></span>
      </span>
    );
  }
  if (outline) return <Piece size={size} outline>{inside}</Piece>;
  return <Piece size={size} color={color} image={entry.icon}>{entry.icon ? null : inside}</Piece>;
}

export function Planner({ block, ctx }: { block: Block; ctx: BlockContext }) {
  const roster = ctx.rosters?.[block.id];
  if (!roster) return <p className="mt-3 text-sm text-muted">This planner picks from a Block that isn’t in the app yet.</p>;
  // With All picked: every run at a glance, and a way into each (Matt, 2026-11-15).
  if (block.byRoute && ctx.routes.length && ctx.route === 'all') return <Runs block={block} roster={roster} ctx={ctx} />;
  return <Party block={block} roster={roster} ctx={ctx} />;
}

function Party({ block, roster, ctx }: { block: Block; roster: Roster; ctx: BlockContext }) {
  const color = `var(--${roster.page.tint})`;
  const { plan, setPlan, save, error, signedIn, shared, share, size, setup, rb, onThisRoute, ladder, slots, ticks, toggle, recruits, recruitKey, byId, members, stepOf, tiesOf, classTiesOf } =
    useParty(ctx.gameId, block, roster, ctx.route, `/g/${ctx.gameId}/${ctx.page.id}`, ctx.spoilers);
  // Who each tie is for (My run: "Leda's Paralogue · for Buccar"), while they're still to recruit, and their planned
  // gear still to get, with the item's own Got it (docs/blocks/planner.md, 2026-11-22).
  const forWhom: Record<string, string[]> = {};
  for (const e of members) if (stepOf(e).kind === 'recruit') for (const t of tiesOf(e)) (forWhom[t.key] ??= []).push(e.name);
  const gear = members.flatMap((e) => slots.flatMap(({ slot, src, where, byId: items }) => (buildOf(plan, e.id).gear?.[slot.key] ?? []).flatMap((id) => {
    const item = items.get(id);
    if (!item) return [];
    const key = `got:${src.block.id}.${id}`;
    const at = where ? valueOf(item, where).text?.split('\n')[0] : undefined;
    return [{ key, name: `Get ${item.name} for ${e.name}`, needs: at, done: ticks.has(key), toggle: () => toggle(key), href: `/g/${ctx.gameId}/${src.page.id}?e=${src.block.id}.${id}` }];
  })));
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [snapped, setSnapped] = useState<string | null>(null);
  const full = members.length >= size;

  // Share: makes this route's party readable by its link (docs/blocks/planner.md, slice 3), then the
  // phone's share menu, or the link copied on a computer.
  const [shareNote, setShareNote] = useState<string | null>(null);
  const shareParty = async () => {
    if (!signedIn) { setShareNote('Sign in to share your party: its link shows your name.'); return; }
    const r = await share(true);
    if (r.error || !r.id) { setShareNote(r.error ?? 'Couldn’t share it.'); return; }
    const url = `${window.location.origin}/g/${ctx.gameId}/plans/${r.id}`;
    const phone = window.matchMedia('(pointer: coarse)').matches;
    if (phone && navigator.share) {
      try { await navigator.share({ title: `My party · ${ctx.pageTitle}`, url }); } catch { /* closed the share menu */ }
      setShareNote(null);
    } else {
      try { await navigator.clipboard.writeText(url); setShareNote('Link copied. Anyone with it can see this party.'); } catch { setShareNote(url); }
    }
  };

  // Dragging a row by its grip (Reorder mode): the row moves as the finger passes its neighbours'
  // middles. Up and down buttons do the same without dragging.
  const list = useRef<HTMLUListElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const dragTo = (id: string, y: number) => {
    const rows = [...(list.current?.querySelectorAll<HTMLElement>('li[data-member]') ?? [])].filter((r) => r.dataset.member !== id);
    const to = rows.filter((r) => { const b = r.getBoundingClientRect(); return b.top + b.height / 2 < y; }).length;
    const next = moveMemberTo(plan, id, to);
    if (next !== plan) setPlan(next);
  };

  // The unit's card opens over this Page; its address stays the Party Page's (?e=units.goliath).
  const { open, set, close } = useOpenEntry();
  const [openBlock, openId] = open?.split('.') ?? [];
  const opened = openBlock === rb.id ? byId.get(openId) : undefined;
  useEffect(() => {
    if (opened) rememberEntry(ctx.gameId, { href: `${window.location.pathname}?e=${rb.id}.${opened.id}`, name: opened.name, where: `${ctx.pageTitle} · ${block.title}` });
  }, [opened, rb.id, ctx.gameId, ctx.pageTitle, block.title]);

  const saveLine = !signedIn ? 'Kept on this device. Sign in to keep it on every device.'
    : save === 'saving' ? 'Saving…' : save === 'error' ? error ?? 'Couldn’t save to your account.' : save === 'saved' ? 'Saved to your account' : 'Kept on this device';

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-bold">{block.planSetup?.size ? `${members.length} of ${size}` : members.length} in your party</p>
        {members.length > 0 && !editing && (
          <button onClick={shareParty} className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ring-1 ring-line hover:ring-ink">
            <Share2 size={14} aria-hidden="true" /> Share
          </button>
        )}
        {members.length > 1 && (
          <button onClick={() => setEditing(!editing)} aria-pressed={editing}
            className={'rounded-full px-3 py-1.5 text-sm font-bold ring-1 ' + (editing ? 'ml-auto bg-ink text-white ring-ink' : 'ring-line hover:ring-ink')}>
            {editing ? 'Done' : 'Reorder or remove'}
          </button>
        )}
      </div>
      <p className={'text-sm ' + (save === 'error' ? 'text-berry' : 'text-muted')} aria-live="polite">{saveLine}</p>
      {members.length > 0 && !editing && (ladder || slots.length > 0) && (
        <p className="mt-1 text-sm font-bold">Tap a unit to plan their {ladder && slots.length ? 'classes and gear' : ladder ? 'classes' : 'gear'}.</p>
      )}
      {(shareNote || shared) && (
        <p className="text-sm text-muted" aria-live="polite">
          {shareNote && <span className="break-all">{shareNote} </span>}
          {shared && (
            <>
              <a href={`/g/${ctx.gameId}/plans/${shared}`} className="font-bold text-ink underline underline-offset-2">Its link is shared</a>
              {' · '}<button onClick={async () => { const r = await share(false); setShareNote(r.error ?? 'It’s private again: the link no longer opens it.'); }} className="font-bold underline underline-offset-2 hover:text-ink">Make it private</button>
            </>
          )}
        </p>
      )}

      {members.length === 0 && !picking ? (
        <div className="mt-3 grid justify-items-center gap-2 rounded-2xl bg-card-2 px-4 py-8 text-center">
          <Piece size={56} outline><Plus size={18} aria-hidden="true" /></Piece>
          <p className="font-display text-lg">Plan your party</p>
          <p className="max-w-xs text-sm text-muted">Pick who you’ll take on this run. Each one shows what to do next to get them{size < 100 ? `, up to ${size}` : ''}.</p>
          <button onClick={() => setPicking(true)} className="btn-primary mt-1 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold">
            <Plus size={15} aria-hidden="true" /> Pick your first unit
          </button>
        </div>
      ) : (
        <ul ref={list} className="mt-3 divide-y divide-line overflow-hidden rounded-2xl bg-card ring-1 ring-line">
          {members.map((e, i) => {
            const step = stepOf(e);
            const got = recruits ? ticks.has(recruitKey(e)) : true;
            return (
              <li key={e.id} data-member={e.id} className={'flex items-center gap-2 px-3 py-2.5 sm:gap-3 ' + (dragging === e.id ? 'relative z-10 bg-signal/20' : '')}>
                {editing && (
                  <span aria-hidden="true" title="Drag to move"
                    className="-ml-1 grid h-11 w-7 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-muted hover:bg-card-2 hover:text-ink active:cursor-grabbing"
                    onPointerDown={(ev) => { ev.currentTarget.setPointerCapture(ev.pointerId); setDragging(e.id); }}
                    onPointerMove={(ev) => { if (dragging === e.id) dragTo(e.id, ev.clientY); }}
                    onPointerUp={() => setDragging(null)} onPointerCancel={() => setDragging(null)}>
                    <GripVertical size={18} />
                  </span>
                )}
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <button onClick={() => set(`${rb.id}.${e.id}`)} className="shrink-0" aria-label={`Open ${e.name}`}>
                    <UnitPiece entry={e} roster={rb} color={color} outline={step.kind === 'recruit'} size={editing ? 40 : 48} />
                  </button>
                  <span className="min-w-0">
                    <button onClick={() => set(`${rb.id}.${e.id}`)} className="block text-left font-bold leading-tight hover:underline">{e.name}</button>
                    {step.text && (
                      // While reordering on a phone, just the name, so the row has room for its buttons.
                      <span className={'mt-0.5 text-sm leading-snug text-muted ' + (editing ? 'hidden sm:block' : 'block')}>
                        {STEP_LABEL[step.kind] && <span className="font-bold text-ink">{STEP_LABEL[step.kind]}: </span>}{step.text}
                      </span>
                    )}
                    {!editing && step.kind === 'recruit' && <TieChips ties={tiesOf(e)} ticks={ticks} toggle={toggle} color={`var(--${ctx.tint})`} label={`${e.name} needs`} />}
                    {!editing && <PlanChips build={buildOf(plan, e.id)} ladder={ladder} slots={slots} name={e.name} onOpen={() => set(`${rb.id}.${e.id}`)} />}
                  </span>
                </div>
                {editing ? (
                  <span className="flex shrink-0 items-center gap-1">
                    <button onClick={() => setPlan(moveMember(plan, e.id, -1))} disabled={i === 0} aria-label={`Move ${e.name} up`}
                      className="grid size-11 place-items-center rounded-full ring-1 ring-line hover:ring-ink disabled:opacity-30"><ArrowUp size={16} aria-hidden="true" /></button>
                    <button onClick={() => setPlan(moveMember(plan, e.id, 1))} disabled={i === members.length - 1} aria-label={`Move ${e.name} down`}
                      className="grid size-11 place-items-center rounded-full ring-1 ring-line hover:ring-ink disabled:opacity-30"><ArrowDown size={16} aria-hidden="true" /></button>
                    <button onClick={() => setPlan(removeMember(plan, e.id))} aria-label={`Take ${e.name} out of your party`}
                      className="grid size-11 place-items-center rounded-full ring-1 ring-line hover:text-berry hover:ring-berry"><X size={16} aria-hidden="true" /></button>
                  </span>
                ) : recruits && (
                  // The Recruited tick, the same one as on the unit's card: a piece that snaps solid.
                  // Its word under it, so it reads as "Recruited" without a hover (review, 2026-11-20).
                  <button onClick={() => { if (!got) setSnapped(e.id); toggle(recruitKey(e)); }} aria-pressed={got} aria-label={`${e.name} recruited`}
                    className="grid w-16 shrink-0 justify-items-center gap-0.5 py-1" title={got ? 'Recruited. Tap to undo' : 'Mark as recruited'}>
                    {got ? <Piece size={30} color={color} snap={snapped === e.id}><Check size={13} strokeWidth={3} aria-hidden="true" /></Piece>
                      : <Piece size={30} outline />}
                    <span className={'text-[11px] font-bold leading-tight ' + (got ? 'text-ink' : 'text-muted')}>{got ? 'Recruited' : 'Recruited?'}</span>
                  </button>
                )}
              </li>
            );
          })}
          {!picking && (
            <li>
              {full ? (
                <p className="px-3 py-3 text-sm text-muted">Your party is full: swap someone out to add another.</p>
              ) : (
                <button onClick={() => setPicking(true)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-card-2">
                  <Piece size={48} outline><Plus size={16} aria-hidden="true" /></Piece>
                  <span className="font-bold">Add a unit</span>
                </button>
              )}
            </li>
          )}
        </ul>
      )}

      {picking && <Picker roster={rb} entries={onThisRoute} party={plan.party} size={size} color={color} ctx={ctx}
        onToggle={(id) => setPlan(plan.party.includes(id) ? removeMember(plan, id) : addMember(plan, id, size))} onDone={() => setPicking(false)} />}

      {!picking && !editing && (
        <MyRun roster={roster} ctx={ctx} members={members} plan={plan} setPlan={setPlan} ladder={ladder} recruits={recruits}
          recruitKey={recruitKey} ticks={ticks} toggle={toggle} onOpenUnit={(e) => set(`${rb.id}.${e.id}`)} forWhom={forWhom} gear={gear} />
      )}

      {opened && (
        <EntryPanel entry={opened} block={rb} list={members.includes(opened) ? members : [opened]} route={ctx.route} routes={ctx.routes} gameId={ctx.gameId}
          sharePath={`/g/${ctx.gameId}/${roster.page.id}/${rb.id}.${opened.id}`} color={color}
          lead={(ladder || slots.length > 0) && plan.party.includes(opened.id) ? <BuildPlan unit={opened} roster={roster} setup={setup} ladder={ladder} plan={plan} setPlan={setPlan} ctx={ctx} classTiesOf={classTiesOf} /> : undefined}
          onGo={(e) => set(`${rb.id}.${e.id}`, 'replace')} onClose={close} />
      )}
    </div>
  );
}

/**
 * The roster as pieces to tap in or out of the party, A to Z, searchable (Matt, 2026-11-15: groups spread
 * it out too much). Each shows its group and class, and when they join if that's not the usual recruiting
 * (review, 2026-11-20): the Flame Lord whose run it is, someone who joins by themselves, someone who only
 * joins in a later Part. Units that can't be planned for (only playable now and then, or nobody knows how)
 * are grayed. Filters: group, class, and how they join.
 */
type JoinFilter = 'all' | 'recruit' | 'auto' | 'later';
const JOIN_FILTERS: { key: JoinFilter; label: string }[] = [
  { key: 'all', label: 'Everyone' }, { key: 'recruit', label: 'You recruit' }, { key: 'auto', label: 'Join automatically' }, { key: 'later', label: 'Join later' },
];

function Picker({ roster, entries, party, size, color, ctx, onToggle, onDone }: {
  roster: Block; entries: Entry[]; party: string[]; size: number; color: string; ctx: BlockContext;
  onToggle: (id: string) => void; onDone: () => void;
}) {
  const [query, setQuery] = useState('');
  const [join, setJoin] = useState<JoinFilter>('all');
  const [group, setGroup] = useState('');
  const [cls, setCls] = useState('');
  const q = query.trim().toLowerCase();
  const groupKey = roster.filters?.[0] ?? 'Group';
  const classKey = (roster.fields ?? []).find((f) => !f.off && f.kind === 'tag' && /class|role/i.test(`${f.key} ${f.label}`))?.key;
  const kinds = useMemo(() => new Map(entries.map((e) => [e.id, joinKind(e, ctx.route)])), [entries, ctx.route]);
  const values = (key?: string) => key ? [...new Set(entries.map((e) => e.categories[key]).filter(Boolean))].sort() : [];
  const groups = values(groupKey), classes = values(classKey);
  const fits = (e: Entry) => {
    const k = kinds.get(e.id)!.kind;
    if (join === 'recruit' && k !== 'none') return false;
    if (join === 'auto' && k !== 'auto' && k !== 'lord') return false;
    if (join === 'later' && k !== 'later') return false;
    return (!group || e.categories[groupKey] === group) && (!cls || (classKey !== undefined && e.categories[classKey] === cls));
  };
  const shown = entries.filter((e) => (ctx.spoilers || !e.spoiler || party.includes(e.id)) && (!q || e.name.toLowerCase().includes(q)) && fits(e));
  const hidden = entries.filter((e) => e.spoiler && !ctx.spoilers && !party.includes(e.id)).length;
  const sorted = [...shown].sort((a, b) => a.name.localeCompare(b.name));
  const full = party.length >= size;
  const select = 'h-9 min-w-0 max-w-[11rem] rounded-full bg-card px-3 text-sm font-bold ring-1 ring-line hover:ring-ink';

  return (
    <section aria-label={`Pick from ${roster.title}`} className="mt-3 rounded-2xl bg-card-2 p-3 ring-1 ring-line">
      <div className="flex items-center gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-card px-3 py-2 ring-1 ring-line focus-within:ring-2 focus-within:ring-sky">
          <Search size={16} className="text-muted" aria-hidden="true" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${roster.title.toLowerCase()}`}
            aria-label={`Search ${roster.title}`} className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted" />
        </label>
        <button onClick={onDone} className="btn-primary shrink-0 rounded-full px-4 py-2 text-sm font-bold">Done</button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {JOIN_FILTERS.map((f) => (
          <button key={f.key} onClick={() => setJoin(f.key)} aria-pressed={join === f.key}
            className={'h-9 rounded-full px-3 text-sm font-bold ring-1 ' + (join === f.key ? 'bg-ink text-white ring-ink' : 'bg-card ring-line hover:ring-ink')}>{f.label}</button>
        ))}
        {groups.length > 1 && (
          <select value={group} onChange={(e) => setGroup(e.target.value)} aria-label={`Filter by ${groupKey}`} className={select}>
            <option value="">Any {groupKey.toLowerCase()}</option>
            {groups.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        )}
        {classes.length > 1 && (
          <select value={cls} onChange={(e) => setCls(e.target.value)} aria-label="Filter by class" className={select}>
            <option value="">Any class</option>
            {classes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>
      <p className="mt-2 px-1 text-sm text-muted" aria-live="polite">
        {full ? 'Your party is full: tap someone in it to take them out.' : `Tap to add, tap again to take out. ${party.length} of ${size < 100 ? size : 'any'} picked.`}
      </p>
      {sorted.length === 0 && <p className="px-1 py-4 text-sm text-muted">Nobody like that on this route.</p>}
      {sorted.length > 0 && (
        <ul className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(5.75rem,1fr))] gap-x-1 gap-y-2.5">
          {sorted.map((e) => {
            const on = party.includes(e.id);
            const k = kinds.get(e.id)!;
            const off = k.kind === 'unplannable' && !on;
            const sub = [e.categories[groupKey], classKey ? e.categories[classKey] : undefined].filter(Boolean).join(' · ');
            return (
              <li key={e.id}>
                <button onClick={() => onToggle(e.id)} aria-pressed={on} disabled={!on && full} title={k.label}
                  className={'group grid w-full justify-items-center gap-0.5 rounded-xl p-1 text-center disabled:opacity-40 ' + (off ? 'opacity-50' : '')}>
                  {/* Yellow marks the player's own choice. */}
                  <span className={'relative rounded-xl p-0.5 ' + (on ? 'bg-signal' : 'group-hover:bg-card')}>
                    <UnitPiece entry={e} roster={roster} color={color} size={44} />
                    {on && <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-ink text-white"><Check size={12} strokeWidth={3} aria-hidden="true" /></span>}
                  </span>
                  <span className="line-clamp-2 text-xs font-bold leading-tight">{e.name}</span>
                  {sub && <span className="line-clamp-1 text-[11px] leading-tight text-muted">{sub}</span>}
                  {k.label && (
                    <span className={'mt-0.5 rounded-full px-1.5 py-px text-[10px] font-bold leading-tight ' + (k.kind === 'lord' ? 'bg-signal text-ink' : k.kind === 'unplannable' ? 'bg-card text-muted ring-1 ring-line' : 'bg-card text-ink ring-1 ring-line')}>
                      {k.label}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {hidden > 0 && (
        <p className="mt-3 px-1 text-sm text-muted">{hidden} hidden as spoilers. <button onClick={ctx.onShowSpoilers} className="font-bold underline underline-offset-2">Show them</button></p>
      )}
    </section>
  );
}
