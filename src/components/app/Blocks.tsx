'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Search, Sparkles } from 'lucide-react';
import type { Block, Entry, Route } from '@/data/pages';
import { BlockIcon } from '@/components/Icon';
import { EntryIcon, EntryPanel, Lines, type RouteOption } from './EntryPanel';
import { matches, onRoute, tintFor, useOpenEntry } from './entries';

/** What every Block needs from the page around it. */
export interface BlockContext {
  gameId: string;
  route: Route | 'all';
  routes: RouteOption[];
  spoilers: boolean;
  onShowSpoilers: () => void;
}

export function BlockView({ block, ctx }: { block: Block; ctx: BlockContext }) {
  const Cmp = { collection: Collection, timeline: Timeline, checklist: Checklist, guide: Guide }[block.type];
  return (
    <section id={block.id} aria-labelledby={`${block.id}-title`} className="surface min-w-0 scroll-mt-28 rounded-[1.75rem] p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-2xl bg-leaf-soft text-leaf"><BlockIcon name={block.icon} size={19} /></span>
        <div className="min-w-0">
          <h2 id={`${block.id}-title`} className="font-display text-xl leading-tight">{block.title}</h2>
          {block.intro && <p className="text-sm text-muted">{block.intro}</p>}
        </div>
      </div>
      <Cmp block={block} ctx={ctx} />
    </section>
  );
}

/** Entries the player can see: on their route, and no spoilers unless they asked. */
function useVisible(block: Block, ctx: BlockContext) {
  return useMemo(() => {
    const routed = block.byRoute ? block.entries.filter((e) => onRoute(e, ctx.route)) : block.entries;
    const shown = ctx.spoilers ? routed : routed.filter((e) => !e.spoiler);
    return { shown, offRoute: block.entries.length - routed.length, spoilers: routed.length - shown.length };
  }, [block, ctx.route, ctx.spoilers]);
}

function HiddenNote({ offRoute, spoilers, ctx }: { offRoute: number; spoilers: number; ctx: BlockContext }) {
  if (!offRoute && !spoilers) return null;
  const lord = ctx.routes.find((r) => r.key === ctx.route)?.label;
  return (
    <p className="mt-3 text-sm text-muted">
      {offRoute > 0 && <>{offRoute} more on other routes than {lord}&apos;s. </>}
      {spoilers > 0 && (
        <>{spoilers} hidden as spoilers. <button onClick={ctx.onShowSpoilers} className="font-bold text-leaf underline underline-offset-2">Show them</button></>
      )}
    </p>
  );
}

/** The details panel for whichever of this Block's entries is open. */
function OpenPanel({ block, list, ctx }: { block: Block; list: Entry[]; ctx: BlockContext }) {
  const { open, set, close } = useOpenEntry();
  const [blockId, entryId] = open?.split('.') ?? [];
  if (blockId !== block.id) return null;
  const entry = block.entries.find((e) => e.id === entryId);
  if (!entry) return null;
  return (
    <EntryPanel entry={entry} block={block} list={list} route={ctx.route} routes={ctx.routes} gameId={ctx.gameId}
      onGo={(e) => set(`${block.id}.${e.id}`, 'replace')} onClose={close} />
  );
}

// ------------------------------------------------------------------ Collection

function Collection({ block, ctx }: { block: Block; ctx: BlockContext }) {
  const { shown, offRoute, spoilers } = useVisible(block, ctx);
  const { set } = useOpenEntry();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('az');
  const [pick, setPick] = useState<string | null>(null);
  const filter = block.filters?.[0];

  const values = useMemo(() => {
    if (!filter) return [];
    const counts = new Map<string, number>();
    for (const e of shown) counts.set(e.categories[filter], (counts.get(e.categories[filter]) ?? 0) + 1);
    return [...counts.entries()];
  }, [shown, filter]);

  const list = useMemo(() => {
    const found = shown.filter((e) => (!pick || !filter || e.categories[filter] === pick) && matches(e, query));
    const byName = (a: Entry, b: Entry) => a.name.localeCompare(b.name);
    if (sort === 'za') return found.sort((a, b) => byName(b, a));
    if (sort === 'group' && filter) return found.sort((a, b) => a.categories[filter].localeCompare(b.categories[filter]) || byName(a, b));
    return found.sort(byName);
  }, [shown, pick, filter, query, sort]);

  const mine = (e: Entry) => (ctx.route !== 'all' ? e.perRoute?.[ctx.route]?.[0]?.text : undefined);
  const groups = sort === 'group' && filter
    ? list.reduce<[string, Entry[]][]>((g, e) => {
        const v = e.categories[filter];
        if (g.at(-1)?.[0] === v) g.at(-1)![1].push(e); else g.push([v, [e]]);
        return g;
      }, [])
    : [['', list] as [string, Entry[]]];

  return (
    <>
      {block.entries.length > 8 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="flex min-w-48 flex-1 items-center gap-2 rounded-full bg-card-2 px-3 py-2 ring-1 ring-line focus-within:ring-2 focus-within:ring-sky">
            <Search size={16} className="text-muted" aria-hidden="true" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${block.title.toLowerCase()}`}
              aria-label={`Search ${block.title}`} className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted" />
          </label>
          <label>
            <span className="sr-only">Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-full bg-card-2 px-3 py-2 text-sm font-bold ring-1 ring-line">
              <option value="az">A to Z</option>
              <option value="za">Z to A</option>
              {filter && <option value="group">By {filter.toLowerCase()}</option>}
            </select>
          </label>
        </div>
      )}
      {values.length > 1 && (
        <div className="chip-strip -mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label={`Filter by ${filter}`}>
          <FilterChip on={!pick} onClick={() => setPick(null)}>All · {shown.length}</FilterChip>
          {values.map(([v, n]) => <FilterChip key={v} on={pick === v} onClick={() => setPick(pick === v ? null : v)}>{v} · {n}</FilterChip>)}
        </div>
      )}

      {list.length === 0 ? (
        <p className="mt-6 text-center text-sm text-muted">Nothing matches{query && ` “${query}”`}.</p>
      ) : groups.map(([g, es]) => (
        <div key={g || 'all'} className="mt-4">
          {g && <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{g}</h3>}
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {es.map((e) => (
              <li key={e.id}>
                <button onClick={() => set(`${block.id}.${e.id}`)}
                  className="lift flex h-full w-full flex-col items-center gap-1.5 rounded-2xl bg-card-2 px-1.5 pb-2.5 pt-3 text-center ring-1 ring-line hover:ring-leaf">
                  <EntryIcon entry={e} block={block} />
                  <span className="line-clamp-2 text-sm font-bold leading-tight">{e.name}</span>
                  {mine(e)
                    ? <span className="line-clamp-2 text-[11px] font-bold leading-tight text-leaf">{mine(e)}</span>
                    : filter && <span className="line-clamp-1 text-[11px] leading-tight text-muted">{e.categories[filter]}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <HiddenNote offRoute={offRoute} spoilers={spoilers} ctx={ctx} />
      <OpenPanel block={block} list={list} ctx={ctx} />
    </>
  );
}

function FilterChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={on}
      className={'shrink-0 rounded-full px-3 py-1.5 text-sm font-bold ring-1 ' + (on ? 'bg-leaf text-paper ring-leaf' : 'bg-card ring-line hover:ring-leaf')}>
      {children}
    </button>
  );
}

// ------------------------------------------------------------------ Timeline

function Timeline({ block, ctx }: { block: Block; ctx: BlockContext }) {
  const { shown, offRoute, spoilers } = useVisible(block, ctx);
  const steps = [...shown].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
  const name = (r: Route) => ctx.routes.find((o) => o.key === r)?.label ?? r;
  return (
    <>
      <ol className="mt-4 grid gap-0">
        {steps.map((e, i) => (
          <li key={e.id} className="relative flex gap-4 pb-5 last:pb-0">
            {i < steps.length - 1 && <span className="absolute left-[0.9rem] top-8 bottom-0 w-0.5 bg-line" aria-hidden="true" />}
            <span className="gloss z-10 grid size-7.5 shrink-0 place-items-center rounded-full bg-leaf text-xs font-bold text-paper">{e.order ?? i + 1}</span>
            <div className="min-w-0 pt-0.5">
              <h3 className="flex flex-wrap items-center gap-2 font-display text-lg leading-tight">
                {e.name}
                {e.routes?.length ? <span className={'rounded-full px-2 py-0.5 font-sans text-xs font-bold ' + tintFor(e.routes[0])}>{e.routes.map(name).join(', ')}</span> : null}
              </h3>
              {e.description && <div className="mt-1 text-muted"><Lines text={e.description} /></div>}
            </div>
          </li>
        ))}
      </ol>
      <HiddenNote offRoute={offRoute} spoilers={spoilers} ctx={ctx} />
    </>
  );
}

// ------------------------------------------------------------------ Checklist

/** Ticks are the player's own, kept on this device. */
function useTicks(gameId: string) {
  const key = `village:${gameId}:ticks`;
  const [ticks, setTicks] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading device storage after hydration
      setTicks(new Set(JSON.parse(localStorage.getItem(key) ?? '[]')));
    } catch { /* storage unavailable: start empty */ }
  }, [key]);
  const toggle = (id: string) => setTicks((t) => {
    const next = new Set(t);
    if (next.has(id)) next.delete(id); else next.add(id);
    try { localStorage.setItem(key, JSON.stringify([...next])); } catch { /* ignore */ }
    return next;
  });
  return [ticks, toggle] as const;
}

function Checklist({ block, ctx }: { block: Block; ctx: BlockContext }) {
  const { shown, offRoute, spoilers } = useVisible(block, ctx);
  const [ticks, toggle] = useTicks(ctx.gameId);
  const { set } = useOpenEntry();
  const done = shown.filter((e) => ticks.has(`${block.id}.${e.id}`)).length;
  const deadline = (e: Entry) => {
    if (ctx.route !== 'all') return e.perRoute?.[ctx.route]?.[0]?.text ?? e.sections.find((s) => s.label === 'Before')?.text;
    return e.sections.find((s) => s.label === 'Before')?.text ?? (e.perRoute ? 'Depends on your Flame Lord. Pick one above.' : undefined);
  };
  return (
    <>
      <div className="mt-4 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-card-2 ring-1 ring-line">
          <div className="h-full rounded-full bg-leaf transition-all" style={{ width: `${shown.length ? (done / shown.length) * 100 : 0}%` }} />
        </div>
        <span className="text-sm font-bold text-muted">{done} of {shown.length} done</span>
      </div>
      <ul className="mt-3 grid gap-2">
        {shown.map((e) => {
          const key = `${block.id}.${e.id}`;
          const on = ticks.has(key);
          return (
            <li key={e.id} className={'flex items-start gap-3 rounded-2xl bg-card-2 p-3 ring-1 ring-line ' + (on ? 'opacity-60' : '')}>
              <button onClick={() => toggle(key)} role="checkbox" aria-checked={on} aria-label={`Done: ${e.name}`}
                className={'grid size-7 shrink-0 place-items-center rounded-lg ring-2 ' + (on ? 'bg-leaf text-paper ring-leaf' : 'bg-card ring-line hover:ring-leaf')}>
                {on && <Check size={16} aria-hidden="true" />}
              </button>
              <button onClick={() => set(key)} className="min-w-0 flex-1 text-left">
                <span className={'block font-bold leading-tight ' + (on ? 'line-through' : '')}>{e.name}</span>
                {deadline(e) && <span className="mt-0.5 block text-sm text-muted"><span className="font-bold text-berry">Before:</span> {deadline(e)!.split('\n')[0]}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <HiddenNote offRoute={offRoute} spoilers={spoilers} ctx={ctx} />
      <OpenPanel block={block} list={shown} ctx={ctx} />
    </>
  );
}

// ------------------------------------------------------------------ Guide

function Guide({ block, ctx }: { block: Block; ctx: BlockContext }) {
  const { shown, offRoute, spoilers } = useVisible(block, ctx);
  return (
    <>
      {shown.length > 2 && (
        <nav aria-label="In this guide" className="chip-strip -mx-1 mt-4 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {shown.map((e) => <a key={e.id} href={`#${block.id}-${e.id}`} className="shrink-0 rounded-full bg-card-2 px-3 py-1.5 text-sm font-bold ring-1 ring-line hover:ring-leaf">{e.name}</a>)}
        </nav>
      )}
      <div className="mt-2 grid gap-5">
        {shown.map((e) => {
          const steps = e.sections.find((s) => s.label === 'Steps');
          const rest = e.sections.filter((s) => s !== steps && s.label !== 'Tip');
          const tip = e.sections.find((s) => s.label === 'Tip');
          return (
            <article key={e.id} id={`${block.id}-${e.id}`} className="scroll-mt-28 pt-3">
              <h3 className="font-display text-lg">{e.name}</h3>
              {e.description && <div className="mt-1"><Lines text={e.description} /></div>}
              {steps && (
                <ol className="mt-2 grid gap-2">
                  {steps.text.split('\n').filter(Boolean).map((s, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-sky-soft text-xs font-bold text-sky">{i + 1}</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              )}
              {rest.map((s) => <div key={s.label} className="mt-2"><span className="font-bold">{s.label}:</span> <Lines text={s.text} /></div>)}
              {tip && (
                <p className="mt-3 flex gap-2 rounded-2xl bg-sun-soft px-3 py-2 text-sm">
                  <Sparkles size={16} className="mt-0.5 shrink-0 text-sun" aria-hidden="true" />{tip.text}
                </p>
              )}
            </article>
          );
        })}
      </div>
      <HiddenNote offRoute={offRoute} spoilers={spoilers} ctx={ctx} />
    </>
  );
}
