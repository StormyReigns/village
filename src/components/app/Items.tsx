'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, LayoutGrid, LayoutList, Search, Table2 } from 'lucide-react';
import type { Block, Entry, FieldDef } from '@/data/pages';
import { ScrollRow } from '@/components/ScrollRow';
import { Piece } from '@/components/Piece';
import { BlockIcon } from '@/components/Icon';
import { useStored } from '@/components/useStored';
import { closest, rank } from '@/lib/search';
import { byStat, heatFill, statFacts } from '@/lib/stats';
import { allStatDefs, besideText, chartDefs, isCategory, shownFields, tileFields, toggleOptions, valueOf } from '@/lib/fields';
import { densityFor, groupOrder, standouts, type Density } from '@/lib/items';
import { symbolFor } from './symbols';
import { entryText, initials, useOpenEntry, useTicks } from './entries';
import { FilterChip, HiddenNote, OpenPanel, useVisible, type BlockContext } from './blockParts';
import { StatTable, statSort } from './StatTable';

type View = 'tiles' | 'list' | 'compare';
/** What a tile needs from its Block (a Workshop sample has no entries or id). */
type TileBlock = Pick<Block, 'title' | 'icon'> & Partial<Pick<Block, 'type' | 'fields' | 'stats' | 'symbols' | 'filters'>>;

/** A type's band behind its section: the Page color, faint, over the white Block (opaque, so
 *  the pinned header hides what scrolls under it). */
const band = (color: string) => `color-mix(in srgb, ${color} 7%, var(--card))`;

/** The device-wide mark for having an item ("Got it"), shared with its full view. */
export const gotKey = (block: Pick<Block, 'id'>, e: Pick<Entry, 'id'>) => `got:${block.id}.${e.id}`;

/**
 * Items: a shelf (the default), grouped under pinned headers by a tag (Type, unless the
 * player picks another), a List to scan, and Compare, the full table of numbers, when the
 * Block has a chart. Each section is drawn by how much it holds (`densityFor`): up to 16
 * items as cards with what the builders put on them, more as small icon tiles in two rows,
 * many as columns of icon rows; tiles and rows scroll sideways, each with its numbers small.
 * The chips above show one type at a time.
 * Tapping an item opens its full view: the Characters card (see CharacterCard), laid out by
 * the Block's fields.
 */
export function Items({ block, ctx }: { block: Block; ctx: BlockContext }) {
  const { shown, offRoute, spoilers } = useVisible(block, ctx);
  const defs = useMemo(() => allStatDefs(block), [block]);
  const [stored, setView] = useStored<View>(`village:${ctx.gameId}:${block.id}:view`, 'tiles');
  const view: View = stored === 'compare' && !defs.length ? 'tiles' : stored;
  const [query, setQuery] = useState('');
  const [pick, setPick] = useState<string | null>(null);
  const [sort, setSort] = useStored(`village:${ctx.gameId}:${block.id}:sort`, 'az');
  const { set } = useOpenEntry();
  const [ticks] = useTicks(ctx.gameId);
  const color = `var(--${ctx.tint})`;
  const fields = shownFields(block);
  // Any tag with two or more values here can group and filter the items (Type, Rank...).
  const tags = useMemo(() => fields.filter((f) => isCategory(f) && !f.spoiler)
    .filter((f) => new Set(shown.map((e) => e.categories[f.key]).filter(Boolean)).size > 1), [fields, shown]);
  const fallback = tags.find((t) => t.key === block.filters?.[0])?.key ?? tags[0]?.key ?? '';
  const [groupBy, setGroupBy] = useStored<string>(`village:${ctx.gameId}:${block.id}:groupBy`, fallback);
  const filter = tags.some((t) => t.key === groupBy) ? groupBy : fallback || undefined;
  const filterLabel = tags.find((t) => t.key === filter)?.label ?? filter;
  const chooseGroup = (key: string) => { setGroupBy(key); setPick(null); };
  const chips = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!pick) return;
    chips.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [pick, filter]);

  // Values of the grouping tag: ranks best first (S, A, B...), else in the builders' order.
  const values = useMemo(() => {
    if (!filter) return [];
    const counts = new Map<string, number>();
    for (const e of shown) if (e.categories[filter]) counts.set(e.categories[filter], (counts.get(e.categories[filter]) ?? 0) + 1);
    return groupOrder([...counts.keys()]).map((v) => [v, counts.get(v)!] as const);
  }, [shown, filter]);

  const statDef = useMemo(() => defs.find((d) => sort.startsWith(statSort(d.key))), [defs, sort]);
  const list = useMemo(() => {
    const found = shown.filter((e) => !pick || !filter || e.categories[filter] === pick);
    if (query.trim()) return rank(found, query, entryText);
    const byName = (a: Entry, b: Entry) => a.name.localeCompare(b.name);
    if (sort === 'za') return found.sort((a, b) => byName(b, a));
    if (statDef) return found.sort((a, b) => byStat(statDef, sort.endsWith(':worst'))(a, b) || byName(a, b));
    return found.sort(byName);
  }, [shown, pick, filter, query, sort, statDef]);

  // Grouped under headers when nothing is typed, picked or ranked, like the game's own
  // inventory tabs. Items without the tag go last, under "Other".
  const groups = useMemo(() => {
    if (query.trim() || pick || statDef || !filter || values.length < 2) return [{ name: '', items: list }];
    const order = [...values.map(([v]) => v), ''];
    return order.map((v) => ({ name: v || 'Other', items: list.filter((e) => (e.categories[filter] ?? '') === v) })).filter((g) => g.items.length);
  }, [list, query, pick, statDef, filter, values]);

  // Standout badges ("Strongest", "Lightest"): the clear best at each number on the tiles.
  const tileDefs = useMemo(() => tileFields(block).filter((f) => f.kind === 'chart').flatMap((f) => chartDefs(block, f)), [block]);
  const badges = useMemo(() => standouts(shown, tileDefs), [shown, tileDefs]);
  // The numbers small tiles and rows show, small: the tile's first chart, at most four.
  const miniDefs = useMemo(() => {
    const first = tileFields(block).find((f) => f.kind === 'chart');
    return first ? chartDefs(block, first).slice(0, 4) : [];
  }, [block]);
  // The tile's first tag other than the grouping one (a weapon's rank), for the rows.
  const rowTag = tileFields(block).find((f) => f.kind === 'tag' && !f.spoiler && (groups.length < 2 || f.key !== filter));
  const open = (e: Entry) => set(`${block.id}.${e.id}`);
  const views: [View, string, typeof LayoutGrid][] = [['tiles', 'Tiles', LayoutGrid], ['list', 'List', LayoutList], ...(defs.length ? [['compare', 'Compare', Table2] as [View, string, typeof LayoutGrid]] : [])];

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="flex h-9 min-w-40 flex-1 items-center gap-2 rounded-full bg-card-2 px-3 ring-1 ring-line focus-within:ring-2 focus-within:ring-sky">
          <Search size={16} className="text-muted" aria-hidden="true" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${block.title.toLowerCase()}, or where to find them`}
            aria-label={`Search ${block.title}`} className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted" />
        </label>
        {/* Yellow marks the player's own choice. */}
        <div role="group" aria-label="Show as" className="flex rounded-full bg-card-2 p-0.5 text-sm font-bold ring-1 ring-line">
          {views.map(([v, label, Icon]) => (
            <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v} aria-label={label}
              className={'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ' + (view === v ? 'bg-signal text-ink' : 'text-muted hover:text-ink')}>
              <Icon size={15} aria-hidden="true" /> <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
        {view !== 'compare' && (
          <label>
            <span className="sr-only">Sort</span>
            <select value={sort} onChange={(e) => {
              setSort(e.target.value);
              // Sorting by a tag groups by it.
              if (e.target.value.startsWith('group:')) { chooseGroup(e.target.value.slice(6)); setSort('az'); }
            }} className="rounded-full bg-card-2 px-3 py-2 text-sm font-bold ring-1 ring-line">
              <option value="az">A to Z</option>
              <option value="za">Z to A</option>
              {tags.filter((t) => t.key !== filter).map((t) => <option key={t.key} value={`group:${t.key}`}>Group by {t.label.toLowerCase()}</option>)}
              {defs.map((d) => <option key={d.key} value={statSort(d.key)}>Best {d.label.toLowerCase()}</option>)}
              {sort.endsWith(':worst') && <option value={sort}>Worst {statDef?.label.toLowerCase()} first</option>}
            </select>
          </label>
        )}
      </div>
      {values.length > 1 && (
        <div ref={chips}>
          <ScrollRow className="-mx-1 mt-3 flex items-center gap-1.5 px-1 pb-1" role="group" label={`Filter by ${filterLabel}`}>
            {tags.length > 1 && (
              <label className="shrink-0">
                <span className="sr-only">Group and filter by</span>
                <select value={filter} onChange={(e) => chooseGroup(e.target.value)}
                  className="max-w-32 rounded-full bg-card px-2.5 py-1 text-sm font-bold text-muted ring-1 ring-line hover:text-ink">
                  {tags.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </label>
            )}
            {/* Each type shows only that type (Matt, 2026-11-16); All brings the shelf back. */}
            <FilterChip on={!pick} tint={ctx.tint} onClick={() => setPick(null)}>All · {shown.length}</FilterChip>
            {values.map(([v, n]) => (
              <FilterChip key={v} on={pick === v} tint={ctx.tint} onClick={() => setPick(pick === v ? null : v)}>
                <span className="inline-flex items-center gap-1.5">{block.symbols?.[v] && <BlockIcon name={block.symbols[v]} size={14} />}{v} · {n}</span>
              </FilterChip>
            ))}
          </ScrollRow>
        </div>
      )}

      {list.length === 0 ? (
        <Nothing query={query} shown={shown} onOpen={open} />
      ) : view === 'compare' ? (
        <div className="mt-3">
          <StatTable block={{ ...block, stats: defs }} entries={list} among={shown} sort={sort.startsWith('stat:') ? sort : ''} onSort={setSort} onOpen={open} filter={filter} color={color}
            groupBy={filter && values.length > 1 ? { key: filter, label: filterLabel ?? filter, order: values.map(([v]) => v) } : undefined} />
        </div>
      ) : (
        groups.map((g) => {
          const density: Density = view === 'tiles' ? densityFor(g.items.length) : 'rows';
          const key = g.name || '@all';
          const got = (e: Entry) => ticks.has(gotKey(block, e));
          // Tiles and rows name their small numbers once, in the header.
          const legend = view === 'tiles' && density !== 'cards' && miniDefs.length > 0;
          return (
            // Each type is its own band, a light wash of the Page color with a faint edge and a
            // gap between, so on a phone it's clear where one type ends and the next begins.
            <section key={key} className={g.name ? 'mt-3 rounded-2xl p-2 sm:p-3' : 'mt-4'} aria-label={g.name || undefined}
              style={g.name ? { background: band(color), boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 30%, transparent)` } : undefined}>
              {/* Pinned under the top bar while its section scrolls past, so you know where you are. */}
              {(g.name || legend) && (
                // A named set starts with a solid strip in the Page color, like a tab, so each set's
                // start stands out at a glance.
                <h3 className={'sticky top-[3.6rem] z-10 mb-2 flex items-center gap-1.5 py-2 text-xs font-bold '
                  + (g.name ? '-mx-2 -mt-2 rounded-t-2xl px-3 text-white sm:-mx-3 sm:-mt-3 sm:px-4' : '-mx-1 bg-card px-1 text-muted')} style={g.name ? { background: color } : undefined}>
                  {g.name && block.symbols?.[g.name] && <BlockIcon name={block.symbols[g.name]} size={17} />}
                  {g.name && <><span className="text-sm">{g.name}</span><span className="opacity-80">{g.items.length}</span></>}
                  {legend && <span className={'ml-auto ' + (g.name ? 'opacity-80' : '')}>{miniDefs.map((d) => d.label).join(' · ')}</span>}
                </h3>
              )}
              {view === 'list' ? (
                <ul className="grid">
                  {g.items.map((e, i) => <Row key={e.id} e={e} block={block} among={shown} color={color} first={i === 0} got={got(e)} route={ctx.route} hide={g.name ? filter : undefined} onOpen={() => open(e)} />)}
                </ul>
              ) : density === 'cards' ? (
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3">
                  {g.items.map((e) => <ItemTile key={e.id} e={e} block={block} among={shown} color={color} got={got(e)} route={ctx.route} hide={g.name ? filter : undefined} badge={badges.size ? badges.get(e.id) ?? '' : undefined} lead={statDef?.key} onOpen={() => open(e)} />)}
                </ul>
              ) : density === 'tiles' ? (
                // Two rows that scroll sideways, however many there are (Matt, 2026-11-16).
                <ScrollRow as="ul" label={g.name || block.title} touchArrows progress className="-mx-1 grid grid-flow-col grid-rows-2 auto-cols-[6.75rem] gap-1 px-1 pb-1">
                  {g.items.map((e) => <SmallTile key={e.id} e={e} block={block} among={shown} color={color} defs={miniDefs} lead={statDef?.key} got={got(e)} onOpen={() => open(e)} />)}
                </ScrollRow>
              ) : (
                // Columns of eight rows that scroll sideways.
                <ScrollRow as="ul" label={g.name || block.title} touchArrows progress className="-mx-1 grid grid-flow-col grid-rows-[repeat(8,auto)] auto-cols-[min(21rem,88%)] gap-x-6 px-1 pb-1">
                  {g.items.map((e) => <ItemLine key={e.id} e={e} block={block} among={shown} color={color} defs={miniDefs} lead={statDef?.key} tag={rowTag} got={got(e)} onOpen={() => open(e)} />)}
                </ScrollRow>
              )}
            </section>
          );
        })
      )}
      <HiddenNote offRoute={offRoute} spoilers={spoilers} ctx={ctx} />
      <OpenPanel block={block} list={groups.flatMap((g) => g.items)} ctx={ctx} />
    </>
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

/** What's in an item's piece: its picture, else its type's symbol, else initials. */
function Mark({ e, block, px, big = false }: { e: Entry; block: TileBlock; px: number; big?: boolean }) {
  if (e.icon) return null;
  const symbol = symbolFor(e, block);
  // On a card the symbol is big enough to read as a sword or a spell at a glance.
  return symbol ? <BlockIcon name={symbol} size={Math.round(px * (big ? 0.36 : 0.24))} strokeWidth={big ? 2.2 : 2.4} /> : <>{initials(e.name)}</>;
}

/** The start of what an item does or what's special about it (its first long text), for its card. */
function special(e: Entry, block: TileBlock) {
  const f = shownFields(block).find((x) => x.kind === 'longtext' && !x.spoiler && valueOf(e, x).text);
  return f ? valueOf(e, f).text!.split('\n')[0] : undefined;
}

/** The tile's things, in the builders' order: tiny number boxes for a chart, else a short line or a pill. */
function TileBits({ e, block, among, color, route, hide, lead, row = false }: { e: Entry; block: TileBlock; among: Entry[]; color: string; route: BlockContext['route']; hide?: string; lead?: string; row?: boolean }) {
  const text = (f: FieldDef) => {
    const v = valueOf(e, f);
    return (route !== 'all' ? v.byRoute.find(([r]) => r === route)?.[1] : undefined) ?? v.text ?? v.byRoute[0]?.[1];
  };
  // A tag the items are grouped by is already in the header above, so it isn't repeated.
  const bits = tileFields(block).filter((f) => !f.spoiler && f.key !== hide).map((f) => {
    if (f.kind === 'chart') {
      const defs = chartDefs(block, f).filter((d) => typeof e.stats?.[d.key] === 'number').slice(0, 4);
      if (!defs.length) return null;
      // On a card: two columns of named numbers, heat-colored, the one being sorted by outlined.
      if (!row) return (
        <span key={f.key} className="grid grid-cols-2 gap-1" aria-label={defs.map((d) => `${d.label} ${e.stats?.[d.key]}`).join(', ')}>
          {defs.map((d) => {
            const facts = statFacts(d, e, among);
            return (
              <span key={d.key} className={'grid min-w-0 rounded-lg px-1 py-0.5 leading-tight ' + (d.key === lead ? 'ring-2 ring-ink' : 'ring-1 ring-line')}
                style={{ background: facts ? heatFill(facts.goodness, color) : 'var(--card-2)' }} title={d.label}>
                <span className="truncate text-[10px] font-bold text-ink/70">{d.label}</span>
                <span className="text-sm font-bold tabular-nums">{e.stats?.[d.key]}</span>
              </span>
            );
          })}
        </span>
      );
      return (
        <span key={f.key} className={'flex gap-0.5 ' + (row ? 'w-36' : 'justify-center')} aria-label={defs.map((d) => `${d.label} ${e.stats?.[d.key]}`).join(', ')}>
          {defs.map((d) => {
            const facts = statFacts(d, e, among);
            return (
              <span key={d.key} className="grid min-w-0 flex-1 text-center" title={d.label}>
                <span className="truncate text-[9px] font-bold uppercase leading-tight text-muted">{d.label.slice(0, 3)}</span>
                <span className="rounded-md text-[10px] font-bold tabular-nums leading-snug ring-1 ring-line" style={{ background: facts ? heatFill(facts.goodness, color) : 'var(--card-2)' }}>{e.stats?.[d.key]}</span>
              </span>
            );
          })}
        </span>
      );
    }
    const v = text(f);
    if (!v) return null;
    if (f.kind === 'yesno') return /^(y|yes|true)$/i.test(v) ? <span key={f.key} className="inline-flex items-center justify-center gap-0.5 text-[11px] font-bold"><Check size={11} strokeWidth={3} aria-hidden="true" />{f.label}</span> : null;
    if (f.kind === 'playable') {
      const yes = v === toggleOptions(f)[0];
      return <span key={f.key} className={'mx-auto rounded-full px-2 text-[11px] font-bold ' + (yes ? 'bg-leaf-soft text-leaf' : 'bg-berry-soft text-berry')}>{v}</span>;
    }
    if (f.kind === 'tag') return <span key={f.key} className="mx-auto max-w-full truncate rounded-full bg-card-2 px-2 text-[11px] font-bold">{v}</span>;
    return <span key={f.key} className="truncate text-[11px] text-muted">{besideText(f, v)}</span>;
  }).filter(Boolean);
  if (!bits.length) return null;
  return <span className={row ? 'flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5' : 'grid gap-1'}>{bits}</span>;
}

/** The "Got it" mark on a tile or row: a small solid piece with a tick (not got shows nothing). */
function GotMark({ size = 20 }: { size?: number }) {
  return <Piece size={size} color="var(--leaf)" label="Got it"><Check size={Math.round(size * 0.5)} strokeWidth={3.5} aria-hidden="true" /></Piece>;
}

/**
 * An item in the compact looks: its picture small, else its symbol plain in the Page's color
 * (no piece: Matt, 2026-11-15, pieces belong to cards and the full view), else its initials.
 */
function Glyph({ e, block, color, px }: { e: Entry; block: TileBlock; color: string; px: number }) {
  // eslint-disable-next-line @next/next/no-img-element -- a small uploaded picture, already sized
  if (e.icon) return <img src={e.icon} alt="" loading="lazy" className="shrink-0 rounded-md object-cover" style={{ width: px, height: px }} />;
  const symbol = symbolFor(e, block);
  if (symbol) return <BlockIcon name={symbol} size={px} strokeWidth={2} className="shrink-0" style={{ color }} />;
  return (
    <span className="grid shrink-0 place-items-center rounded-md text-[10px] font-bold" style={{ width: px, height: px, background: `color-mix(in srgb, ${color} 14%, white)`, color }}>
      {initials(e.name)}
    </span>
  );
}

type StatDefLike = { key: string; label: string; better: 'high' | 'low' };

/** The item's numbers, small and heat-colored against the rest, in the order the header names
 *  them; the stat being sorted by is outlined. */
function MiniStats({ e, defs, among, color, lead, className = '' }: { e: Entry; defs: StatDefLike[]; among: Entry[]; color: string; lead?: string; className?: string }) {
  if (!defs.some((d) => typeof e.stats?.[d.key] === 'number')) return null;
  return (
    <span className={'flex gap-0.5 ' + className} aria-label={defs.map((d) => `${d.label} ${e.stats?.[d.key] ?? 'none'}`).join(', ')}>
      {defs.map((d) => {
        const facts = typeof e.stats?.[d.key] === 'number' ? statFacts(d, e, among) : null;
        return (
          <span key={d.key} title={d.label} className={'min-w-6 rounded px-0.5 text-center text-[10px] font-bold leading-4 tabular-nums ' + (d.key === lead ? 'ring-2 ring-ink' : 'ring-1 ring-line')}
            style={{ background: facts ? heatFill(facts.goodness, color) : 'var(--card-2)' }}>{e.stats?.[d.key] ?? '–'}</span>
        );
      })}
    </span>
  );
}

/** One item in a medium section: its symbol, its name under it, and its numbers, small. */
function SmallTile({ e, block, among, color, defs, lead, got, onOpen }: { e: Entry; block: TileBlock; among: Entry[]; color: string; defs: StatDefLike[]; lead?: string; got: boolean; onOpen: () => void }) {
  return (
    <li className="min-w-0">
      <button type="button" onClick={onOpen} className="grid h-full w-full content-start justify-items-center gap-1 rounded-xl px-1 py-2 text-center hover:bg-card-2">
        <Glyph e={e} block={block} color={color} px={26} />
        <span className="line-clamp-2 w-full text-xs font-bold leading-tight">{got && <span className="mr-0.5 inline-block align-[-2px]"><GotMark size={12} /></span>}{e.name}</span>
        <MiniStats e={e} defs={defs} among={among} color={color} lead={lead} className="justify-center" />
      </button>
    </li>
  );
}

/** One item in a long section: a row with its symbol, name, a tag (a rank) and its numbers, small. */
function ItemLine({ e, block, among, color, defs, lead, tag, got, onOpen }: { e: Entry; block: TileBlock; among: Entry[]; color: string; defs: StatDefLike[]; lead?: string; tag?: FieldDef; got: boolean; onOpen: () => void }) {
  const t = tag ? e.categories[tag.key] : undefined;
  return (
    <li className="min-w-0 border-b border-line">
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-2 rounded-lg px-1 py-2 text-left hover:bg-card-2">
        <Glyph e={e} block={block} color={color} px={20} />
        <span className="min-w-0 flex-1 truncate text-sm font-bold">{e.name}</span>
        {got && <GotMark size={14} />}
        {t && <span className="max-w-12 shrink-0 truncate text-[11px] text-muted">{t}</span>}
        <MiniStats e={e} defs={defs} among={among} color={color} lead={lead} className="shrink-0" />
      </button>
    </li>
  );
}

/** One item as a card on the shelf: a standout badge if it's the best at something, its piece
 *  with a big symbol, its name under it like an app icon, the tile's things (named numbers,
 *  a rank...), and a line on what's special. Also the sample tile in the Workshop's Set up. */
export function ItemTile({ e, block, among, color, got, route, hide, badge, lead, onOpen }: {
  e: Entry; block: TileBlock; among: Entry[]; color: string; got: boolean; route: BlockContext['route']; hide?: string;
  /** "Strongest", "Lightest"...: the clear best at one of the tile's numbers. Empty: no badge
   *  on this card, but others in the Block have one (so the row keeps its place). */
  badge?: string;
  /** The stat being sorted by, outlined on the card. */
  lead?: string;
  onOpen?: () => void;
}) {
  const note = special(e, block);
  return (
    <li className="min-w-0">
      <button type="button" onClick={onOpen} className="group grid h-full w-full content-start justify-items-center gap-1.5 rounded-2xl bg-card p-2.5 text-center ring-1 ring-line transition hover:-translate-y-0.5 hover:ring-ink">
        {/* Where any card has a badge, the badge row keeps its height on every card, so the
            pieces line up along a shelf. */}
        {badge !== undefined && <span className="flex h-5 items-center">
          {badge && <span className="rounded-full px-2 text-[11px] font-bold leading-5" style={{ background: `color-mix(in srgb, ${color} 16%, white)`, color }}>{badge}</span>}
        </span>}
        <Piece size={72} color={color} image={e.icon}><Mark e={e} block={block} px={72} big /></Piece>
        {/* Got it sits by the name, clear of the item's piece (pieces never touch). */}
        <span className="line-clamp-2 w-full text-[13px] font-bold leading-tight">{got && <span className="mr-1 inline-block align-[-3px]"><GotMark size={14} /></span>}{e.name}</span>
        <span className="w-full min-w-0"><TileBits e={e} block={block} among={among} color={color} route={route} hide={hide} lead={lead} /></span>
        {note && <span className="line-clamp-2 w-full text-[11px] leading-snug text-muted">{note}</span>}
      </button>
    </li>
  );
}

/** One item in the List: piece, name, and the tile's things in a line. */
function Row({ e, block, among, color, first, got, route, hide, onOpen }: { e: Entry; block: Block; among: Entry[]; color: string; first: boolean; got: boolean; route: BlockContext['route']; hide?: string; onOpen: () => void }) {
  // The row also says what the item does: the first long text it has (What it does, Effect...).
  const does = shownFields(block).find((f) => f.kind === 'longtext' && !f.spoiler && valueOf(e, f).text);
  return (
    <li className={first ? '' : 'border-t border-line'}>
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 rounded-xl px-1 py-2.5 text-left hover:bg-card-2">
        <Piece size={46} color={color} image={e.icon}><Mark e={e} block={block} px={46} /></Piece>
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="flex items-center gap-2">
            <span className="truncate font-bold">{e.name}</span>
            {got && <GotMark size={16} />}
          </span>
          <TileBits e={e} block={block} among={among} color={color} route={route} hide={hide} row />
          {does && <span className="line-clamp-1 text-sm text-muted">{valueOf(e, does).text}</span>}
        </span>
      </button>
    </li>
  );
}
