'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Plus, Search, X } from 'lucide-react';
import type { Block, Entry } from '@/data/pages';
import { Piece } from '@/components/Piece';
import { BlockIcon } from '@/components/Icon';
import { EntryPanel, symbolFor } from '@/components/app/EntryPanel';
import { initials, onRoute, rememberEntry, useOpenEntry, useTicks } from '@/components/app/entries';
import type { BlockContext } from '@/components/app/blockParts';
import { addMember, moveMember, nextStep, partySize, removeMember, type NextStep, type Roster } from '@/lib/planner';
import { usePlan } from './usePlan';

// The Planner Block (docs/blocks/planner.md), slice 1: your party for this run, picked from the
// roster (Units), each with the next step to get them. Saved on this device, and in your account when
// signed in. Tapping a unit opens their card here, over the Party Page.

/** The roster's first tag, which groups the picker (Group, for Fortune's Weave). */
const groupKey = (b: Block) => b.filters?.[0] ?? b.fields?.find((f) => f.kind === 'tag' && !f.off)?.key;

/** A unit as a piece: solid once they're yours, the split outline while they're still to recruit. */
function UnitPiece({ entry, roster, color, outline, size = 52 }: { entry: Entry; roster: Block; color: string; outline?: boolean; size?: number }) {
  const symbol = symbolFor(entry, roster);
  const inside = symbol ? <BlockIcon name={symbol} size={Math.round(size * 0.22)} strokeWidth={2.4} /> : initials(entry.name);
  if (outline) return <Piece size={size} outline>{inside}</Piece>;
  return <Piece size={size} color={color} image={entry.icon}>{entry.icon ? null : inside}</Piece>;
}

export function Planner({ block, ctx }: { block: Block; ctx: BlockContext }) {
  const roster = ctx.rosters?.[block.id];
  if (!roster) return <p className="mt-3 text-sm text-muted">This planner picks from a Block that isn’t in the app yet.</p>;
  if (block.byRoute && ctx.routes.length && ctx.route === 'all') {
    return (
      <div className="mt-4 grid justify-items-center gap-2 rounded-2xl bg-card-2 px-4 py-8 text-center">
        <Piece size={56} outline><BlockIcon name={block.icon} size={16} /></Piece>
        <p className="font-display text-lg">Whose run is it?</p>
        <p className="max-w-xs text-sm text-muted">Pick your route at the top of the page. Each route gets its own party, since who can join is different.</p>
      </div>
    );
  }
  return <Party block={block} roster={roster} ctx={ctx} />;
}

function Party({ block, roster, ctx }: { block: Block; roster: Roster; ctx: BlockContext }) {
  const size = partySize(block.planSetup);
  const rb = roster.block;
  const color = `var(--${roster.page.tint})`;
  // Every unit on this route (header cards aside); spoilers stay out of the picker unless shown.
  const onThisRoute = useMemo(() => rb.entries.filter((e) => !e.header && (!rb.byRoute || onRoute(e, ctx.route))), [rb, ctx.route]);
  const { plan, setPlan, save, error, signedIn } = usePlan(ctx.gameId, block.id, onThisRoute, ctx.route, size);
  const [ticks, toggle] = useTicks(ctx.gameId);
  const recruits = (rb.fields ?? []).some((f) => !f.off && /recruit/i.test(`${f.key} ${f.label}`));
  const byId = useMemo(() => new Map(onThisRoute.map((e) => [e.id, e])), [onThisRoute]);
  const members = plan.party.map((id) => byId.get(id)).filter((e): e is Entry => Boolean(e));
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [snapped, setSnapped] = useState<string | null>(null);
  const full = members.length >= size;
  const recruitKey = (e: Entry) => `recruited:${rb.id}.${e.id}`;
  const stepOf = (e: Entry): NextStep => nextStep(e, rb, ctx.route, recruits ? ticks.has(recruitKey(e)) : undefined, block.planSetup);

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
        {members.length > 1 && (
          <button onClick={() => setEditing(!editing)} aria-pressed={editing}
            className={'ml-auto rounded-full px-3 py-1.5 text-sm font-bold ring-1 ' + (editing ? 'bg-ink text-white ring-ink' : 'ring-line hover:ring-ink')}>
            {editing ? 'Done' : 'Reorder or remove'}
          </button>
        )}
      </div>
      <p className={'text-sm ' + (save === 'error' ? 'text-berry' : 'text-muted')} aria-live="polite">{saveLine}</p>

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
        <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl bg-card ring-1 ring-line">
          {members.map((e, i) => {
            const step = stepOf(e);
            const got = recruits ? ticks.has(recruitKey(e)) : true;
            return (
              <li key={e.id} className="flex items-center gap-3 px-3 py-2.5">
                <button onClick={() => set(`${rb.id}.${e.id}`)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Open ${e.name}`}>
                  <UnitPiece entry={e} roster={rb} color={color} outline={step.kind === 'recruit'} size={48} />
                  <span className="min-w-0">
                    <span className="block font-bold leading-tight">{e.name}</span>
                    {step.text && (
                      <span className="mt-0.5 block text-sm leading-snug text-muted">
                        {step.kind === 'recruit' && <span className="font-bold text-ink">To recruit: </span>}{step.text}
                      </span>
                    )}
                  </span>
                </button>
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
                  <button onClick={() => { if (!got) setSnapped(e.id); toggle(recruitKey(e)); }} aria-pressed={got} aria-label={`${e.name} recruited`}
                    className="grid size-11 shrink-0 place-items-center" title={got ? 'Recruited' : 'Mark as recruited'}>
                    {got ? <Piece size={30} color={color} snap={snapped === e.id}><Check size={13} strokeWidth={3} aria-hidden="true" /></Piece>
                      : <Piece size={30} outline />}
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

      {opened && (
        <EntryPanel entry={opened} block={rb} list={members.includes(opened) ? members : [opened]} route={ctx.route} routes={ctx.routes} gameId={ctx.gameId}
          sharePath={`/g/${ctx.gameId}/${roster.page.id}/${rb.id}.${opened.id}`} color={color}
          onGo={(e) => set(`${rb.id}.${e.id}`, 'replace')} onClose={close} />
      )}
    </div>
  );
}

/** The roster as pieces to tap in or out of the party, grouped like the Units Page, searchable. */
function Picker({ roster, entries, party, size, color, ctx, onToggle, onDone }: {
  roster: Block; entries: Entry[]; party: string[]; size: number; color: string; ctx: BlockContext;
  onToggle: (id: string) => void; onDone: () => void;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = entries.filter((e) => (ctx.spoilers || !e.spoiler || party.includes(e.id)) && (!q || e.name.toLowerCase().includes(q)));
  const hidden = entries.filter((e) => e.spoiler && !ctx.spoilers && !party.includes(e.id)).length;
  const key = groupKey(roster);
  const groups = useMemo(() => {
    const out = new Map<string, Entry[]>();
    for (const e of shown) { const g = (key && e.categories[key]) || 'Others'; out.set(g, [...(out.get(g) ?? []), e]); }
    return [...out];
  }, [shown, key]);
  const full = party.length >= size;

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
      <p className="mt-2 px-1 text-sm text-muted" aria-live="polite">
        {full ? 'Your party is full: tap someone in it to take them out.' : `Tap to add, tap again to take out. ${party.length} of ${size < 100 ? size : 'any'} picked.`}
      </p>
      {groups.length === 0 && <p className="px-1 py-4 text-sm text-muted">Nobody called that on this route.</p>}
      {groups.map(([g, list]) => (
        <div key={g} className="mt-3">
          {key && <h3 className="px-1 text-xs font-bold uppercase tracking-wide text-muted">{g}</h3>}
          <ul className="mt-1 grid grid-cols-[repeat(auto-fill,minmax(4.75rem,1fr))] gap-x-2 gap-y-3">
            {list.map((e) => {
              const on = party.includes(e.id);
              return (
                <li key={e.id}>
                  <button onClick={() => onToggle(e.id)} aria-pressed={on} disabled={!on && full}
                    className="group grid w-full justify-items-center gap-1 rounded-xl p-1 text-center disabled:opacity-40">
                    {/* Yellow marks the player's own choice. */}
                    <span className={'relative rounded-xl p-0.5 ' + (on ? 'bg-signal' : 'group-hover:bg-card')}>
                      <UnitPiece entry={e} roster={roster} color={color} size={48} />
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
      {hidden > 0 && (
        <p className="mt-3 px-1 text-sm text-muted">{hidden} hidden as spoilers. <button onClick={ctx.onShowSpoilers} className="font-bold underline underline-offset-2">Show them</button></p>
      )}
    </section>
  );
}
