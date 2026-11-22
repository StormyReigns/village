'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, GripVertical, MoreHorizontal, Plus, Search, Share2, Swords, X } from 'lucide-react';
import type { Block, Entry } from '@/data/pages';
import { Piece } from '@/components/Piece';
import { BlockIcon } from '@/components/Icon';
import { EntryPanel, symbolFor } from '@/components/app/EntryPanel';
import { initials, rememberEntry, useOpenEntry } from '@/components/app/entries';
import type { BlockContext } from '@/components/app/blockParts';
import { addMember, buildOf, joinKind, moveMember, moveMemberTo, removeMember, type Roster } from '@/lib/planner';
import { BuildPlan } from './BuildPlan';
import { useParty } from './useParty';
import { Runs } from './Runs';
import { MyRun } from './MyRun';
import { valueOf } from '@/lib/fields';

// The Planner Block (docs/blocks/planner.md): your party for this run, picked from the roster (Units),
// each with the next thing to do for them: recruit, get their gear, reach their next class. Saved on
// this device, and in your account when signed in. Tapping a unit opens their card over the Party
// Page, with your plan for them (class steps and gear) at the top.

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
        {/* A light fill under the portrait, so it doesn't show as a dark blob while the picture loads. */}
        <span className="absolute inset-0 grid place-items-center"><Piece size={Math.round(size * 0.74)} image={entry.icon} color="var(--line)" className="opacity-90" /></span>
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

  // The party as a strip of faces (Matt, 2026-11-22: party rows and My run said everything twice, and "what's
  // next" sat at the bottom). Their steps live in Next up and Your run; their classes and gear on their card.
  const [menu, setMenu] = useState(false);
  // Each unit's planned class steps in ladder order, for the little path of pieces on their card.
  const pathOf = (e: Entry) => (ladder ? ladder.bands.flatMap((b) => {
    const step = buildOf(plan, e.id).classes?.[b];
    const cls = step ? ladder.byId.get(step.id) : undefined;
    return step && cls ? [{ band: b, name: cls.name, done: Boolean(step.done) }] : [];
  }) : []);
  const gearOf = (e: Entry) => Object.values(buildOf(plan, e.id).gear ?? {}).reduce((n, x) => n + x.length, 0);
  const classColor = roster.classes ? `var(--${roster.classes.page.tint})` : 'var(--indigo)';
  const toRecruit = members.filter((e) => stepOf(e).kind === 'recruit').length;
  const partyStrip = (
    <section aria-label="Your party" className="rounded-2xl bg-card p-3 ring-1 ring-line">
      <div className="flex items-center gap-2">
        <h3 className="min-w-0 flex-1">
          <span className="block font-display text-lg leading-tight">Your party</span>
          <span className="block text-xs text-muted">{block.planSetup?.size ? `${members.length} of ${size}` : members.length}{toRecruit ? ` · ${toRecruit} still to recruit` : ''}</span>
        </h3>
        {editing ? (
          <button onClick={() => setEditing(false)} className="rounded-full bg-ink px-3 py-1.5 text-sm font-bold text-white">Done</button>
        ) : members.length > 0 && (
          <button onClick={() => setMenu(!menu)} aria-expanded={menu} aria-label="Party options" className="grid size-9 place-items-center rounded-full text-muted hover:bg-card-2 hover:text-ink">
            <MoreHorizontal size={18} aria-hidden="true" />
          </button>
        )}
      </div>
      {menu && !editing && (
        <div className="mt-2 grid gap-0.5 rounded-xl bg-card-2 p-1.5 text-sm">
          <button onClick={() => { setMenu(false); shareParty(); }} className="flex items-center gap-2 rounded-lg px-2 py-2 text-left font-bold hover:bg-card"><Share2 size={15} aria-hidden="true" /> Share this party</button>
          {members.length > 1 && <button onClick={() => { setMenu(false); setEditing(true); }} className="flex items-center gap-2 rounded-lg px-2 py-2 text-left font-bold hover:bg-card"><GripVertical size={15} aria-hidden="true" /> Reorder or remove</button>}
          <p className={'px-2 py-1 text-xs ' + (save === 'error' ? 'text-berry' : 'text-muted')} aria-live="polite">{saveLine}</p>
        </div>
      )}
      {(shareNote || shared) && (
        <p className="mt-1 text-sm text-muted" aria-live="polite">
          {shareNote && <span className="break-all">{shareNote} </span>}
          {shared && (
            <>
              <a href={`/g/${ctx.gameId}/plans/${shared}`} className="font-bold text-ink underline underline-offset-2">Its link is shared</a>
              {' · '}<button onClick={async () => { const r = await share(false); setShareNote(r.error ?? 'It’s private again: the link no longer opens it.'); }} className="font-bold underline underline-offset-2 hover:text-ink">Make it private</button>
            </>
          )}
        </p>
      )}
      {save === 'error' && !menu && <p className="mt-1 text-sm text-berry">{saveLine}</p>}

      {members.length === 0 ? (
        <div className="mt-2 flex items-center gap-3">
          <Piece size={48} outline><Plus size={16} aria-hidden="true" /></Piece>
          <p className="min-w-0 flex-1 text-sm text-muted">Pick who you’ll take on this run{size < 100 ? `, up to ${size}` : ''}. Each one’s steps show up in your run.</p>
          {!picking && <button onClick={() => setPicking(true)} className="btn-primary shrink-0 rounded-full px-4 py-2 text-sm font-bold">Pick units</button>}
        </div>
      ) : editing ? (
        <ul ref={list} className="mt-2 divide-y divide-line overflow-hidden rounded-xl ring-1 ring-line">
          {members.map((e, i) => (
            <li key={e.id} data-member={e.id} className={'flex items-center gap-2 px-2 py-1.5 ' + (dragging === e.id ? 'relative z-10 bg-signal/20' : '')}>
              <span aria-hidden="true" title="Drag to move"
                className="grid h-11 w-7 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-muted hover:bg-card-2 hover:text-ink active:cursor-grabbing"
                onPointerDown={(ev) => { ev.currentTarget.setPointerCapture(ev.pointerId); setDragging(e.id); }}
                onPointerMove={(ev) => { if (dragging === e.id) dragTo(e.id, ev.clientY); }}
                onPointerUp={() => setDragging(null)} onPointerCancel={() => setDragging(null)}>
                <GripVertical size={18} />
              </span>
              <UnitPiece entry={e} roster={rb} color={color} outline={stepOf(e).kind === 'recruit'} size={36} />
              <span className="min-w-0 flex-1 truncate font-bold">{e.name}</span>
              <button onClick={() => setPlan(moveMember(plan, e.id, -1))} disabled={i === 0} aria-label={`Move ${e.name} up`}
                className="grid size-11 shrink-0 place-items-center rounded-full ring-1 ring-line hover:ring-ink disabled:opacity-30"><ArrowUp size={16} aria-hidden="true" /></button>
              <button onClick={() => setPlan(moveMember(plan, e.id, 1))} disabled={i === members.length - 1} aria-label={`Move ${e.name} down`}
                className="grid size-11 shrink-0 place-items-center rounded-full ring-1 ring-line hover:ring-ink disabled:opacity-30"><ArrowDown size={16} aria-hidden="true" /></button>
              <button onClick={() => setPlan(removeMember(plan, e.id))} aria-label={`Take ${e.name} out of your party`}
                className="grid size-11 shrink-0 place-items-center rounded-full ring-1 ring-line hover:text-berry hover:ring-berry"><X size={16} aria-hidden="true" /></button>
            </li>
          ))}
        </ul>
      ) : (
        // A deployment board (Matt, 2026-11-22: "more fun and interactive, with larger images"): each unit on a card of
        // their own with a big portrait, a yellow "To recruit" tag while they're still to get, and their class path as
        // small pieces (solid once reached). Cards lift under a press; a tap opens their classes and gear.
        <ul className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(5.25rem,1fr))] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] sm:gap-2.5">
          {members.map((e) => {
            const recruit = stepOf(e).kind === 'recruit';
            const path = pathOf(e);
            const gearN = gearOf(e);
            const heading = path.find((x) => !x.done) ?? path[path.length - 1];
            return (
              <li key={e.id}>
                <button onClick={() => set(`${rb.id}.${e.id}`)}
                  aria-label={`Open ${e.name}${recruit ? ', still to recruit' : ''}${heading ? `, heading for ${heading.name}` : ''}`}
                  className="lift relative grid h-full w-full justify-items-center gap-1 rounded-2xl bg-card-2 px-1.5 pb-2.5 pt-3 text-center ring-1 ring-line transition hover:ring-ink active:scale-[0.97]">
                  {recruit && <span className="absolute left-1.5 top-1.5 z-10 rounded-full bg-signal px-1.5 py-0.5 text-[10px] font-bold leading-none text-ink">To recruit</span>}
                  <UnitPiece entry={e} roster={rb} color={color} outline={recruit} size={72} />
                  <span className="line-clamp-1 w-full font-display text-sm leading-tight sm:text-base">{e.name}</span>
                  {path.length > 0 ? (
                    <span className="grid justify-items-center gap-0.5">
                      <span className="flex items-center gap-1" aria-hidden="true">
                        {path.map((x) => <Piece key={x.band} size={13} color={classColor} outline={!x.done} />)}
                      </span>
                      {heading && <span className="line-clamp-1 text-[11px] font-bold leading-tight text-muted">→ {heading.name}</span>}
                    </span>
                  ) : (
                    <span className="text-[11px] leading-tight text-muted">{ladder ? 'Plan classes' : slots.length ? 'Plan gear' : ' '}</span>
                  )}
                  {gearN > 0 && <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-muted"><Swords size={11} aria-hidden="true" />{gearN}</span>}
                </button>
              </li>
            );
          })}
          {!full && !picking && (
            <li>
              <button onClick={() => setPicking(true)}
                className="lift grid h-full min-h-40 w-full content-center justify-items-center gap-1.5 rounded-2xl border-2 border-dashed border-line px-1.5 py-3 text-center hover:border-ink">
                <Piece size={56} outline><Plus size={18} aria-hidden="true" /></Piece>
                <span className="font-display text-sm leading-tight sm:text-base">Add a unit</span>
                {block.planSetup?.size ? <span className="text-[11px] text-muted">{size - members.length} spots left</span> : null}
              </button>
            </li>
          )}
        </ul>
      )}
      {members.length > 0 && !editing && (
        <p className="mt-2 text-xs text-muted">
          
          {(ladder || slots.length > 0) && `Tap a unit for their ${ladder && slots.length ? 'classes and gear' : ladder ? 'classes' : 'gear'}.`}
          {full && ' Your party is full: swap someone out to add another.'}
        </p>
      )}
    </section>
  );

  return (
    <div className="mt-2">
      {picking ? (
        <>
          {partyStrip}
          <Picker roster={rb} entries={onThisRoute} party={plan.party} size={size} color={color} ctx={ctx}
            onToggle={(id) => setPlan(plan.party.includes(id) ? removeMember(plan, id) : addMember(plan, id, size))} onDone={() => setPicking(false)} />
        </>
      ) : (
        <MyRun roster={roster} ctx={ctx} members={members} plan={plan} setPlan={setPlan} ladder={ladder} recruits={recruits}
          recruitKey={recruitKey} ticks={ticks} toggle={toggle} onOpenUnit={(e) => set(`${rb.id}.${e.id}`)} forWhom={forWhom} gear={gear}
          tiesOf={tiesOf} party={partyStrip} />
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
