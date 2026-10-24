'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronDown, Hourglass, Plus, Search, Sparkles, StickyNote } from 'lucide-react';
import type { Block, Entry, Page, Route, Tint } from '@/data/pages';
import { sharePath } from '@/data/pages/links';
import { ShareButton } from '@/components/ShareButton';
import { BlockIcon } from '@/components/Icon';
import { Tip } from '@/components/Tip';
import { ScrollRow } from '@/components/ScrollRow';
import { EntryIcon, EntryPanel, Lines, type RouteOption } from './EntryPanel';
import { initials, matches, onRoute, rememberEntry, tintFor, useOpenEntry, useTicks } from './entries';
import { TINT } from './tint';

/** What every Block needs from the page around it. */
export interface BlockContext {
  gameId: string;
  page: Page;
  pageTitle: string;
  tint: Tint;
  route: Route | 'all';
  routes: RouteOption[];
  spoilers: boolean;
  onShowSpoilers: () => void;
}

export function BlockView({ block, ctx }: { block: Block; ctx: BlockContext }) {
  const Cmp = { collection: Collection, timeline: Timeline, checklist: Checklist, guide: Guide }[block.type];
  const t = TINT[ctx.tint];
  return (
    <section id={block.id} aria-labelledby={`${block.id}-title`} className="app-block min-w-0 scroll-mt-20 rounded-[1.25rem] p-4 sm:p-5" style={{ '--tint': `var(--${ctx.tint})` } as React.CSSProperties}>
      <div className="flex items-center gap-3">
        <span className={`grid size-10 place-items-center rounded-2xl ${t.soft} ${t.text}`}><BlockIcon name={block.icon} size={19} /></span>
        <div className="min-w-0 flex-1">
          <h2 id={`${block.id}-title`} className="font-display text-xl leading-tight">{block.title}</h2>
          {block.intro && <p className="text-sm text-muted">{block.intro}</p>}
        </div>
        {block.entries.length > 0 && <ShareButton path={sharePath(ctx.gameId, ctx.page, block)} title={`${block.title} · ${ctx.pageTitle}`} what="Block" tint={ctx.tint} />}
        {block.entries.length > 0 && (
          <Tip text={`Know something missing from ${block.title}? Add it in the Workshop`} tint={ctx.tint} className="shrink-0">
            <Link href={`/g/${ctx.gameId}/workshop?add=${block.id}`} aria-label={`Add to ${block.title}`}
              className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold text-muted ring-1 ring-line hover:text-ink hover:ring-ink">
              <Plus size={15} aria-hidden="true" /><span className="hidden sm:inline">Add</span>
            </Link>
          </Tip>
        )}
      </div>
      {block.entries.length === 0 ? (
        <div className="mt-4 grid justify-items-center gap-2 rounded-2xl bg-card-2 px-4 py-8 text-center">
          <span className={`grid size-12 place-items-center rounded-full ${t.soft} ${t.text}`}><Sparkles size={20} aria-hidden="true" /></span>
          <p className="font-display text-lg">Nothing here yet</p>
          <p className="max-w-xs text-sm text-muted">Know something that belongs here? Add the first one in the Workshop.</p>
          <Link href={`/g/${ctx.gameId}/workshop?add=${block.id}`} className={`gloss mt-1 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-white ${t.solid}`}>
            <Plus size={15} aria-hidden="true" /> Add the first one
          </Link>
        </div>
      ) : <Cmp block={block} ctx={ctx} />}
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
  const entry = blockId === block.id ? block.entries.find((e) => e.id === entryId) : undefined;

  useEffect(() => {
    if (entry) rememberEntry(ctx.gameId, { href: `${window.location.pathname}?e=${block.id}.${entry.id}`, name: entry.name, where: `${ctx.pageTitle} · ${block.title}` });
  }, [entry, block, ctx.gameId, ctx.pageTitle]);

  if (!entry) return null;
  return (
    <EntryPanel entry={entry} block={block} list={list} route={ctx.route} routes={ctx.routes} gameId={ctx.gameId} sharePath={sharePath(ctx.gameId, ctx.page, block, entry)}
      onGo={(e) => set(`${block.id}.${e.id}`, 'replace')} onClose={close} />
  );
}

// ------------------------------------------------------------------ Collection

const num = (s?: string) => Number(/\d+/.exec(s ?? '')?.[0] ?? Infinity);

function Collection({ block, ctx }: { block: Block; ctx: BlockContext }) {
  const { shown, offRoute, spoilers } = useVisible(block, ctx);
  const { set } = useOpenEntry();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState(block.statName ? 'stat' : 'az');
  const [pick, setPick] = useState<string | null>(null);
  const filter = block.filters?.[0];
  const look = block.look ?? 'slots';
  const t = TINT[ctx.tint];

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
    if (sort === 'stat') return found.sort((a, b) => num(a.stat) - num(b.stat) || byName(a, b));
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
  const openIt = (e: Entry) => set(`${block.id}.${e.id}`);

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
              {block.statName && <option value="stat">By {block.statName.toLowerCase()}</option>}
              <option value="az">A to Z</option>
              <option value="za">Z to A</option>
              {filter && <option value="group">By {filter.toLowerCase()}</option>}
            </select>
          </label>
        </div>
      )}
      {values.length > 1 && (
        <ScrollRow className="-mx-1 mt-3 flex gap-1.5 px-1 pb-1" role="group" label={`Filter by ${filter}`}>
          <FilterChip on={!pick} tint={ctx.tint} onClick={() => setPick(null)}>All · {shown.length}</FilterChip>
          {values.map(([v, n]) => <FilterChip key={v} on={pick === v} tint={ctx.tint} onClick={() => setPick(pick === v ? null : v)}>{v} · {n}</FilterChip>)}
        </ScrollRow>
      )}

      {list.length === 0 ? (
        <p className="mt-6 text-center text-sm text-muted">Nothing matches{query && ` “${query}”`}.</p>
      ) : groups.map(([g, es]) => (
        <div key={g || 'all'} className="mt-4">
          {g && <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{g}</h3>}
          {look === 'portraits' && (
            <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {es.map((e) => <li key={e.id}><Portrait e={e} note={mine(e) ?? (filter ? e.categories[filter] : undefined)} strong={Boolean(mine(e))} onOpen={() => openIt(e)} /></li>)}
            </ul>
          )}
          {look === 'slots' && (
            <ul className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-5 xl:grid-cols-7">
              {es.map((e) => <li key={e.id}><Slot e={e} block={block} filter={filter} onOpen={() => openIt(e)} /></li>)}
            </ul>
          )}
          {look === 'rows' && (
            <ul className="grid gap-2">
              {es.map((e) => (
                <li key={e.id}>
                  <button onClick={() => openIt(e)} className="flex w-full items-center gap-3 rounded-2xl bg-card-2 p-2.5 text-left ring-1 ring-line hover:ring-2 hover:ring-[var(--line)] hover:bg-card">
                    <EntryIcon entry={e} block={block} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold leading-tight">{e.name}</span>
                      {e.description && <span className="line-clamp-1 text-sm text-muted">{e.description}</span>}
                    </span>
                    {e.stat && <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${t.soft} ${t.text}`}>{e.stat}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
      <HiddenNote offRoute={offRoute} spoilers={spoilers} ctx={ctx} />
      <OpenPanel block={block} list={list} ctx={ctx} />
    </>
  );
}

/** A character card: a tall portrait with a name plate. */
function Portrait({ e, note, strong, onOpen }: { e: Entry; note?: string; strong: boolean; onOpen: () => void }) {
  const tint = tintFor(Object.values(e.categories)[0] ?? e.name);
  return (
    <button onClick={onOpen} className="lift flex w-full flex-col overflow-hidden rounded-2xl bg-card text-left ring-1 ring-line hover:ring-2">
      <span className={`relative grid aspect-[6/7] w-full place-items-center ${tint}`}>
        {e.icon
          // eslint-disable-next-line @next/next/no-img-element -- community pictures, sized small
          ? <img src={e.icon} alt="" className="absolute inset-0 size-full object-cover" />
          : <span className="font-display text-3xl opacity-80">{initials(e.name)}</span>}
        <span className="gloss absolute inset-0" aria-hidden="true" />
      </span>
      <span className="px-2 py-1.5">
        <span className="block truncate text-sm font-bold">{e.name}</span>
        {note && <span className={'block truncate text-[11px] leading-tight ' + (strong ? 'font-bold text-leaf' : 'text-muted')}>{note}</span>}
      </span>
    </button>
  );
}

/** An inventory slot: a square frame with the item inside, its name underneath. */
function Slot({ e, block, filter, onOpen }: { e: Entry; block: Block; filter?: string; onOpen: () => void }) {
  const kind = filter ? e.categories[filter] : undefined;
  return (
    <button onClick={onOpen} className="group flex w-full flex-col items-center gap-1.5 text-center">
      <span className="lift relative grid aspect-square w-full place-items-center rounded-2xl bg-card-2 shadow-[inset_0_2px_6px_rgb(16_24_40/0.08)] ring-1 ring-line group-hover:ring-2">
        <EntryIcon entry={e} block={block} />
        {kind && <span className={`absolute right-1.5 top-1.5 size-2.5 rounded-full ring-2 ring-card-2 ${tintFor(kind).split(' ')[0].replace('-soft', '')}`} title={kind} />}
      </span>
      <span className="line-clamp-2 text-xs font-bold leading-tight">{e.name}</span>
    </button>
  );
}

function FilterChip({ on, tint, onClick, children }: { on: boolean; tint: Tint; onClick: () => void; children: React.ReactNode }) {
  const t = TINT[tint];
  return (
    <button onClick={onClick} aria-pressed={on}
      className={'shrink-0 rounded-full px-3 py-1.5 text-sm font-bold ring-1 ' + (on ? `${t.solid} ${t.ring} text-white` : 'bg-card ring-line hover:ring-ink')}>
      {children}
    </button>
  );
}

// ------------------------------------------------------------------ Timeline

/** The story as a path of chapter cards. */
function Timeline({ block, ctx }: { block: Block; ctx: BlockContext }) {
  const { shown, offRoute, spoilers } = useVisible(block, ctx);
  const steps = [...shown].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
  const name = (r: Route) => ctx.routes.find((o) => o.key === r)?.label ?? r;
  const t = TINT[ctx.tint];
  return (
    <>
      <ol className="relative mt-5 grid gap-4 pl-12">
        <span className={`absolute bottom-6 left-[1.2rem] top-6 w-1 rounded-full ${t.soft}`} aria-hidden="true" />
        {steps.map((e) => {
          const [part, title] = e.name.includes(': ') ? e.name.split(/: (.*)/) : ['', e.name];
          return (
            <li key={e.id} id={`${block.id}-${e.id}`} className="relative scroll-mt-20">
              <span className={`gloss absolute -left-12 top-3 grid size-10 place-items-center rounded-full font-display text-white ${t.solid}`}>
                {e.order === 0 ? '★' : e.order}
              </span>
              <article className={`rounded-2xl bg-gradient-to-br ${t.bar} to-card p-4 ring-1 ring-line`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {part && <p className={`text-xs font-bold uppercase tracking-wide ${t.text}`}>{part}</p>}
                    <h3 className="flex flex-wrap items-center gap-2 font-display text-xl leading-tight">
                      {title}
                      {e.routes?.length ? <span className={'rounded-full px-2 py-0.5 font-sans text-xs font-bold ' + tintFor(e.routes[0])}>{e.routes.map(name).join(', ')}</span> : null}
                    </h3>
                  </div>
                  <ShareButton path={sharePath(ctx.gameId, ctx.page, block, e)} title={e.name} what="entry" tint={ctx.tint} />
                </div>
                {e.description && <div className="mt-1.5 leading-relaxed"><Lines text={e.description} /></div>}
              </article>
            </li>
          );
        })}
      </ol>
      <HiddenNote offRoute={offRoute} spoilers={spoilers} ctx={ctx} />
    </>
  );
}

// ------------------------------------------------------------------ Checklist

function Ring({ done, total, tint }: { done: number; total: number; tint: Tint }) {
  const r = 22, c = 2 * Math.PI * r, part = total ? done / total : 0;
  return (
    <span className="relative grid size-14 shrink-0 place-items-center">
      <svg viewBox="0 0 52 52" className={`absolute inset-0 -rotate-90 ${TINT[tint].text}`} aria-hidden="true">
        <circle cx="26" cy="26" r={r} fill="none" stroke="var(--line)" strokeWidth="6" />
        <circle cx="26" cy="26" r={r} fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${c * part} ${c}`} />
      </svg>
      <span className="text-sm font-bold">{done}/{total}</span>
    </span>
  );
}

function Checklist({ block, ctx }: { block: Block; ctx: BlockContext }) {
  const { shown, offRoute, spoilers } = useVisible(block, ctx);
  const [ticks, toggle] = useTicks(ctx.gameId);
  const [showDone, setShowDone] = useState(false);
  const { set } = useOpenEntry();
  const key = (e: Entry) => `${block.id}.${e.id}`;
  const todo = shown.filter((e) => !ticks.has(key(e)));
  const done = shown.filter((e) => ticks.has(key(e)));
  const t = TINT[ctx.tint];
  const deadline = (e: Entry) => {
    if (ctx.route !== 'all') return e.perRoute?.[ctx.route]?.[0]?.text ?? e.sections.find((s) => s.label === 'Before')?.text;
    return e.sections.find((s) => s.label === 'Before')?.text ?? (e.perRoute ? 'Depends on your Flame Lord. Pick one above.' : undefined);
  };

  const row = (e: Entry, i: number) => {
    const on = ticks.has(key(e));
    const next = !on && i === 0;
    return (
      <li key={e.id} className={'flex items-start gap-3 rounded-2xl p-3 ring-1 ' + (next ? `${t.soft} ${t.ring}` : 'bg-card-2 ring-line') + (on ? ' opacity-60' : '')}>
        <Tip text={on ? 'Done. Tap to untick' : 'Tick it once it\'s done. Your ticks stay on this device'} tint={ctx.tint} className="shrink-0">
          <button onClick={() => toggle(key(e))} role="checkbox" aria-checked={on} aria-label={`Done: ${e.name}`}
            className={'grid size-8 shrink-0 place-items-center rounded-xl ring-2 ' + (on ? `${t.solid} ${t.ring} text-white` : 'bg-card ring-line hover:ring-ink')}>
            {on && <Check size={17} aria-hidden="true" />}
          </button>
        </Tip>
        <button onClick={() => set(key(e))} className="min-w-0 flex-1 text-left">
          {next && <span className={`block text-[11px] font-bold uppercase tracking-wide ${t.text}`}>Next up</span>}
          <span className={'block font-bold leading-tight ' + (on ? 'line-through' : '')}>{e.name}</span>
          {deadline(e) && !on && (
            <span className={`mt-1 inline-flex items-start gap-1 rounded-lg bg-card px-2 py-0.5 text-sm ring-1 ring-line`}>
              <Hourglass size={13} className={`mt-1 shrink-0 ${t.text}`} aria-hidden="true" /> {deadline(e)!.split('\n')[0]}
            </span>
          )}
        </button>
      </li>
    );
  };

  return (
    <>
      <div className="mt-4 flex items-center gap-3 rounded-2xl bg-card-2 p-3">
        <Ring done={done.length} total={shown.length} tint={ctx.tint} />
        <p className="text-sm">
          <span className="block font-bold">{todo.length ? `${todo.length} still to do` : 'All done. Nothing missed!'}</span>
          <span className="text-muted">Tick things off as you go. Your ticks stay on this device.</span>
        </p>
      </div>
      <ul className="mt-3 grid gap-2">{todo.map(row)}</ul>
      {done.length > 0 && (
        <>
          <button onClick={() => setShowDone(!showDone)} aria-expanded={showDone} className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-muted hover:text-ink">
            <ChevronDown size={16} className={showDone ? 'rotate-180' : ''} aria-hidden="true" /> Done · {done.length}
          </button>
          {showDone && <ul className="mt-2 grid gap-2">{done.map((e) => row(e, -1))}</ul>}
        </>
      )}
      <HiddenNote offRoute={offRoute} spoilers={spoilers} ctx={ctx} />
      <OpenPanel block={block} list={shown} ctx={ctx} />
    </>
  );
}

// ------------------------------------------------------------------ Guide

/** A handbook: contents on the side (computers) or on top (phones), steps and tip notes. */
function Guide({ block, ctx }: { block: Block; ctx: BlockContext }) {
  const { shown, offRoute, spoilers } = useVisible(block, ctx);
  const t = TINT[ctx.tint];
  return (
    <div className="mt-4 lg:grid lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-6">
      <nav aria-label="In this guide" className="lg:sticky lg:top-6 lg:self-start">
        <p className="mb-2 hidden text-xs font-bold uppercase tracking-wide text-muted lg:block">Contents</p>
        <ScrollRow as="ol" className="-mx-1 flex gap-1.5 px-1 pb-1 lg:mx-0 lg:grid lg:gap-1 lg:px-0">
          {shown.map((e, i) => (
            <li key={e.id} className="shrink-0">
              <a href={`#${block.id}-${e.id}`} className="flex items-center gap-2 rounded-full bg-card-2 px-3 py-1.5 text-sm font-bold ring-1 ring-line hover:ring-ink lg:rounded-xl lg:bg-transparent lg:ring-0 lg:hover:bg-card-2">
                <span className={`grid size-5 place-items-center rounded-full text-[11px] ${t.soft} ${t.text}`}>{i + 1}</span>{e.name}
              </a>
            </li>
          ))}
        </ScrollRow>
      </nav>
      <div className="mt-3 grid gap-4 lg:mt-0">
        {shown.map((e, n) => {
          const steps = e.sections.find((s) => s.label === 'Steps');
          const rest = e.sections.filter((s) => s !== steps && s.label !== 'Tip');
          const tip = e.sections.find((s) => s.label === 'Tip');
          return (
            <article key={e.id} id={`${block.id}-${e.id}`} className="scroll-mt-20 rounded-2xl bg-card-2 p-4 ring-1 ring-line">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`text-xs font-bold uppercase tracking-wide ${t.text}`}>Guide {n + 1}</p>
                  <h3 className="font-display text-xl leading-tight">{e.name}</h3>
                </div>
                <ShareButton path={sharePath(ctx.gameId, ctx.page, block, e)} title={e.name} what="guide" tint={ctx.tint} />
              </div>
              {e.description && <div className="mt-1"><Lines text={e.description} /></div>}
              {steps && (
                <ol className="mt-3 grid gap-0">
                  {steps.text.split('\n').filter(Boolean).map((s, i, all) => (
                    <li key={i} className="relative flex gap-3 pb-3 last:pb-0">
                      {i < all.length - 1 && <span className="absolute bottom-0 left-[0.8rem] top-7 w-0.5 bg-line" aria-hidden="true" />}
                      <span className={`gloss z-10 grid size-6.5 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${t.solid}`}>{i + 1}</span>
                      <span className="pt-0.5">{s}</span>
                    </li>
                  ))}
                </ol>
              )}
              {rest.map((s) => <div key={s.label} className="mt-2"><span className="font-bold">{s.label}:</span> <Lines text={s.text} /></div>)}
              {tip && (
                <p className="mt-4 flex -rotate-[0.6deg] gap-2 rounded-xl bg-sun-soft px-3 py-2.5 text-sm">
                  <StickyNote size={16} className="mt-0.5 shrink-0 text-sun" aria-hidden="true" />{tip.text}
                </p>
              )}
            </article>
          );
        })}
      </div>
      <HiddenNote offRoute={offRoute} spoilers={spoilers} ctx={ctx} />
    </div>
  );
}
