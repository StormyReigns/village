'use client';

import { useMemo, useState } from 'react';
import { EyeOff, LayoutGrid, LayoutList, Lock, Search, Table2 } from 'lucide-react';
import type { Block, Entry, Route } from '@/data/pages';
import { ScrollRow } from '@/components/ScrollRow';
import { Piece } from '@/components/Piece';
import { useStored } from '@/components/useStored';
import { closest, rank } from '@/lib/search';
import { byStat } from '@/lib/stats';
import { allStatDefs, isCategory, shownFields, valueOf } from '@/lib/fields';
import { bandOf, bandOrder, classShape, rankLine } from '@/lib/classes';
import { entryText, initials, useOpenEntry } from './entries';
import { FilterChip, OpenPanel, type BlockContext } from './blockParts';
import { StatTable, statSort } from './StatTable';

type View = 'ladder' | 'list' | 'compare';

/**
 * Classes (docs/blocks/classes.md): the classes in bands by the Block's first tag (a ladder of
 * tiers in Fire Emblem, roles in World of Warcraft), each band headed by its own card (what the
 * tier takes, what the role does) and holding its classes as pieces with their skill ranks (or
 * chip tag) under the name. A List to scan, and Compare, every class's numbers side by side. A
 * band's header is an entry of its own (`header`), so the community fixes it with a Draft, and
 * tapping it opens it like any card. A class's card is the Characters card, with "Leads to" and
 * "Comes from" (src/lib/classes.ts).
 */
export function Classes({ block, ctx }: { block: Block; ctx: BlockContext }) {
  const headers = useMemo(() => block.entries.filter((e) => e.header), [block]);
  const classes = useMemo(() => block.entries.filter((e) => !e.header), [block]);
  const shown = useMemo(() => (ctx.spoilers ? classes : classes.filter((e) => !e.spoiler)), [classes, ctx.spoilers]);
  const defs = useMemo(() => allStatDefs(block), [block]);
  const [stored, setView] = useStored<View>(`village:${ctx.gameId}:${block.id}:view`, 'ladder');
  const view: View = stored === 'compare' && !defs.length ? 'ladder' : stored;
  const [query, setQuery] = useState('');
  const [pick, setPick] = useState<string | null>(null);
  const [sort, setSort] = useStored(`village:${ctx.gameId}:${block.id}:sort`, 'az');
  const { set } = useOpenEntry();
  const color = `var(--${ctx.tint})`;
  const open = (e: Entry) => set(`${block.id}.${e.id}`);

  // What the Block's own setup makes the bands, the skill ranks and the path (src/lib/classes.ts).
  const shape = useMemo(() => classShape(block), [block]);
  // Chips: the first tag that isn't the bands' (Moves: On foot, Riding, Flying...).
  const chipTag = useMemo(() => shownFields(block).filter((f) => isCategory(f) && f.key !== shape.band && !f.spoiler)
    .find((f) => new Set(shown.map((e) => e.categories[f.key]).filter(Boolean)).size > 1), [block, shown, shape.band]);
  const chipValues = useMemo(() => {
    if (!chipTag) return [];
    const counts = new Map<string, number>();
    for (const e of shown) if (e.categories[chipTag.key]) counts.set(e.categories[chipTag.key], (counts.get(e.categories[chipTag.key]) ?? 0) + 1);
    return [...counts];
  }, [shown, chipTag]);

  const statDef = useMemo(() => defs.find((d) => sort.startsWith(statSort(d.key))), [defs, sort]);
  const list = useMemo(() => {
    const found = shown.filter((e) => !pick || !chipTag || e.categories[chipTag.key] === pick);
    if (query.trim()) return rank(found, query, entryText);
    const byName = (a: Entry, b: Entry) => a.name.localeCompare(b.name);
    if (sort === 'za') return found.sort((a, b) => byName(b, a));
    if (statDef) return found.sort((a, b) => byStat(statDef, sort.endsWith(':worst'))(a, b) || byName(a, b));
    return found.sort(byName);
  }, [shown, pick, chipTag, query, sort, statDef]);

  // The ladder: one band per value of the band tag, in the header cards' order, while nothing is searched or ranked.
  const tiers = useMemo(() => bandOrder(block.entries, shape.band), [block, shape.band]);
  const banded = !query.trim() && !statDef;
  const bands = useMemo(() => {
    if (!banded) return [{ tier: '', header: undefined, items: list, hidden: 0 }];
    return [...tiers, ''].map((tier) => ({
      tier,
      header: headers.find((h) => bandOf(h, shape.band) === tier),
      items: list.filter((e) => bandOf(e, shape.band) === tier),
      // Classes in this tier hidden as spoilers (Part III), so the band can offer to show them.
      hidden: ctx.spoilers || pick ? 0 : classes.filter((e) => e.spoiler && bandOf(e, shape.band) === tier).length,
    })).filter((b) => b.items.length || b.hidden);
  }, [banded, tiers, headers, list, classes, ctx.spoilers, pick, shape.band]);
  // Under each class's name: its skill ranks when the Block has them, else its chip tag (Plate, Riding...).
  const subline = (e: Entry) => (shape.ranks ? rankLine(e, shape.ranks) : chipTag ? e.categories[chipTag.key] ?? '' : '');

  const views: [View, string, typeof LayoutGrid][] = [['ladder', 'Ladder', LayoutGrid], ['list', 'List', LayoutList], ...(defs.length ? [['compare', 'Compare', Table2] as [View, string, typeof LayoutGrid]] : [])];
  const routeNames = (rs?: Route[]) => (rs ?? []).map((r) => ctx.routes.find((o) => o.key === r)?.label ?? r).join(', ');

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="flex min-w-48 flex-1 items-center gap-2 rounded-full bg-card-2 px-3 py-2 ring-1 ring-line focus-within:ring-2 focus-within:ring-sky">
          <Search size={16} className="text-muted" aria-hidden="true" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search classes, skills or weapons"
            aria-label={`Search ${block.title}`} className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted" />
        </label>
        {/* Yellow marks the player's own choice. */}
        <div role="group" aria-label="Show as" className="flex rounded-full bg-card-2 p-0.5 text-sm font-bold ring-1 ring-line">
          {views.map(([v, label, Icon]) => (
            <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v}
              className={'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ' + (view === v ? 'bg-signal text-ink' : 'text-muted hover:text-ink')}>
              <Icon size={15} aria-hidden="true" /> <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
        {view !== 'compare' && (
          <label>
            <span className="sr-only">Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-full bg-card-2 px-3 py-2 text-sm font-bold ring-1 ring-line">
              <option value="az">A to Z</option>
              <option value="za">Z to A</option>
              {defs.map((d) => <option key={d.key} value={statSort(d.key)}>Best {d.label}</option>)}
              {sort.endsWith(':worst') && <option value={sort}>Worst {statDef?.label} first</option>}
            </select>
          </label>
        )}
      </div>
      {chipTag && chipValues.length > 1 && (
        <ScrollRow className="-mx-1 mt-3 flex items-center gap-1.5 px-1 pb-1" role="group" label={`Filter by ${chipTag.label}`}>
          <FilterChip on={!pick} tint={ctx.tint} onClick={() => setPick(null)}>All · {shown.length}</FilterChip>
          {chipValues.map(([v, n]) => <FilterChip key={v} on={pick === v} tint={ctx.tint} onClick={() => setPick(pick === v ? null : v)}>{v} · {n}</FilterChip>)}
        </ScrollRow>
      )}

      {list.length === 0 && !bands.some((b) => b.hidden) ? (
        <Nothing query={query} shown={shown} onOpen={open} />
      ) : view === 'compare' ? (
        <div className="mt-3">
          <StatTable block={{ ...block, stats: defs }} entries={list} among={shown} sort={sort.startsWith('stat:') ? sort : ''} onSort={setSort} onOpen={open} color={color} />
        </div>
      ) : (
        bands.map((b) => (
          <section key={b.tier || 'all'} className="mt-5" aria-label={b.tier ? `${b.tier} classes` : undefined}>
            {b.tier && <BandHeader tier={b.tier} header={b.header} block={block} count={b.items.length} tint={ctx.tint} onOpen={open} />}
            {view === 'ladder' ? (
              b.items.length > 0 && (
                <ul className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-x-2 gap-y-3">
                  {b.items.map((e) => <Tile key={e.id} e={e} sub={subline(e)} color={color} routes={routeNames(e.routes)} onOpen={() => open(e)} />)}
                </ul>
              )
            ) : (
              <ul className="mt-1 grid">
                {b.items.map((e, i) => <Row key={e.id} e={e} sub={shape.ranks ? rankLine(e, shape.ranks) : ''} color={color} first={i === 0} routes={routeNames(e.routes)} tag={chipTag?.key} onOpen={() => open(e)} />)}
              </ul>
            )}
            {b.hidden > 0 && (
              <button type="button" onClick={ctx.onShowSpoilers}
                className="spoiler-cover mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-bold text-muted ring-1 ring-line hover:text-ink">
                <EyeOff size={14} aria-hidden="true" /> {b.hidden} {b.hidden === 1 ? 'class' : 'classes'} hidden as spoilers. Tap to show
              </button>
            )}
          </section>
        ))
      )}
      {/* Prev and next go through the classes only; a tier's card opens on its own (no "3 of 33"). */}
      <OpenPanel block={block} list={bands.flatMap((b) => b.items)} ctx={ctx} />
    </>
  );
}

/** A band's header: its name and how many classes, and the first line of its own card (what the
 *  tier takes, what the role does), as one button that opens that card. */
function BandHeader({ tier, header, block, count, tint, onOpen }: { tier: string; header?: Entry; block: Block; count: number; tint: BlockContext['tint']; onOpen: (e: Entry) => void }) {
  // The header card's first filled field in the card's order (Fortune's Weave: "Level 20 · Renown 4 ·
  // Specialty License"), else its description.
  const first = header && shownFields(block).filter((f) => !isCategory(f) && f.kind !== 'chart' && f.kind !== 'tier').map((f) => valueOf(header, f).text).find(Boolean);
  const needs = first ?? header?.description;
  const inner = (
    <>
      <span className="flex items-baseline gap-2">
        <span className="font-display text-lg leading-tight">{tier}</span>
        {count > 0 && <span className="text-xs font-bold text-muted">{count}</span>}
      </span>
      {needs && <span className="text-sm text-muted">{needs.split('\n')[0]}</span>}
    </>
  );
  // The band's rule in the Page color, so the ladder reads as rungs.
  const cls = 'grid w-full gap-0.5 border-b-2 pb-1.5 text-left';
  return header ? (
    <button type="button" onClick={() => onOpen(header)} className={cls + ' hover:opacity-80'} style={{ borderColor: `var(--${tint})` }} aria-label={`${tier}: about this group`}>{inner}</button>
  ) : <div className={cls} style={{ borderColor: `var(--${tint})` }}>{inner}</div>;
}

/** One class on the ladder: its piece, its name under it like an app icon, and its exam. */
function Tile({ e, sub, color, routes, onOpen }: { e: Entry; sub: string; color: string; routes: string; onOpen: () => void }) {
  return (
    <li className="min-w-0">
      <button type="button" onClick={onOpen} className="group grid w-full justify-items-center gap-1 rounded-2xl p-1.5 text-center hover:bg-card-2">
        <span className="transition group-hover:-translate-y-0.5">
          <Piece size={56} color={color} image={e.icon}>{e.icon ? null : initials(e.name)}</Piece>
        </span>
        <span className="line-clamp-2 w-full text-xs font-bold leading-tight">{e.name}</span>
        {/* Skill ranks are the tile's answer ("can she take it?"), so they get room for three skills on a phone. */}
        {sub && <span className="line-clamp-3 w-full text-[11px] leading-tight text-muted">{sub}</span>}
        {routes && <span className="inline-flex max-w-full items-center gap-0.5 truncate text-[10px] font-bold text-muted"><Lock size={9} strokeWidth={3} aria-hidden="true" />{routes}</span>}
      </button>
    </li>
  );
}

/** One class in the List: piece, name, its exam, how it moves and any route lock in a line. */
function Row({ e, sub, color, first, routes, tag, onOpen }: { e: Entry; sub: string; color: string; first: boolean; routes: string; tag?: string; onOpen: () => void }) {
  return (
    <li className={first ? '' : 'border-t border-line'}>
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 rounded-xl px-1 py-2.5 text-left hover:bg-card-2">
        <Piece size={44} color={color} image={e.icon}>{e.icon ? null : initials(e.name)}</Piece>
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="flex flex-wrap items-center gap-x-2">
            <span className="truncate font-bold">{e.name}</span>
            {tag && e.categories[tag] && <span className="rounded-full bg-card-2 px-2 text-[11px] font-bold">{e.categories[tag]}</span>}
          </span>
          <span className="truncate text-sm text-muted">{sub}{routes && <>{sub && ' · '}<Lock size={11} strokeWidth={2.5} className="inline align-[-1px]" aria-label="Only on" /> {routes}</>}</span>
        </span>
      </button>
    </li>
  );
}

function Nothing({ query, shown, onOpen }: { query: string; shown: Entry[]; onOpen: (e: Entry) => void }) {
  if (!query.trim()) return <p className="mt-6 text-center text-sm text-muted">Nothing here with that filter.</p>;
  const near = closest(shown, query, entryText);
  return (
    <div className="mt-6 grid justify-items-center gap-2 text-center text-sm text-muted">
      <p>Nothing matches “{query.trim()}”.</p>
      {near.length > 0 && (
        <p className="flex flex-wrap items-center justify-center gap-1.5">
          Did you mean
          {near.map((e) => <button key={e.id} type="button" onClick={() => onOpen(e)} className="rounded-full bg-card-2 px-2.5 py-1 font-bold text-ink ring-1 ring-line hover:ring-ink">{e.name}</button>)}
          ?
        </p>
      )}
    </div>
  );
}
