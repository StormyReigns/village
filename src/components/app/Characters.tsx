'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronLeft, ChevronRight, Hammer, LayoutList, Search, SquareUser } from 'lucide-react';
import type { Block, Entry } from '@/data/pages';
import { sharePath } from '@/data/pages/links';
import { ShareButton } from '@/components/ShareButton';
import { ScrollRow } from '@/components/ScrollRow';
import { Piece } from '@/components/Piece';
import { BlockIcon } from '@/components/Icon';
import { Tip } from '@/components/Tip';
import { useStored } from '@/components/useStored';
import { closest, rank } from '@/lib/search';
import { byStat } from '@/lib/stats';
import { allStatDefs, besideText, shownFields, spotOf, valueOf } from '@/lib/fields';
import { CharacterCard } from './CharacterCard';
import { symbolFor } from './symbols';
import { entryText, initials, useOpenEntry, useTicks } from './entries';
import { FilterChip, HiddenNote, OpenPanel, useVisible, type BlockContext } from './blockParts';
import { statSort } from './StatTable';

type View = 'profiles' | 'list';
type Dir = -1 | 0 | 1;

/**
 * Characters: one profile at a time with a strip of pieces to jump between them (the
 * default), or a List to scan and sort. Each device remembers which the player picked,
 * per Block. The card is laid out by the Block's fields (see CharacterCard).
 */
export function Characters({ block, ctx }: { block: Block; ctx: BlockContext }) {
  const { shown, offRoute, spoilers } = useVisible(block, ctx);
  const [view, setView] = useStored<View>(`village:${ctx.gameId}:${block.id}:view`, 'profiles');
  const [query, setQuery] = useState('');
  const [pick, setPick] = useState<string | null>(null);
  const [sort, setSort] = useState('az');
  const { open, set } = useOpenEntry();
  const [ticks, toggle] = useTicks(ctx.gameId);
  const filter = block.filters?.[0];
  const color = `var(--${ctx.tint})`;
  const fields = shownFields(block);
  // Games where people join you get a "Recruited" tick on each one.
  const recruits = fields.some((f) => /recruit/i.test(`${f.key} ${f.label}`));

  const values = useMemo(() => {
    if (!filter) return [];
    const counts = new Map<string, number>();
    for (const e of shown) if (e.categories[filter]) counts.set(e.categories[filter], (counts.get(e.categories[filter]) ?? 0) + 1);
    return [...counts.entries()];
  }, [shown, filter]);

  const list = useMemo(() => {
    const found = shown.filter((e) => !pick || !filter || e.categories[filter] === pick);
    if (query.trim()) return rank(found, query, entryText);
    const byName = (a: Entry, b: Entry) => a.name.localeCompare(b.name);
    if (sort === 'za') return found.sort((a, b) => byName(b, a));
    if (sort === 'group' && filter) return found.sort((a, b) => (a.categories[filter] ?? '').localeCompare(b.categories[filter] ?? '') || byName(a, b));
    const def = allStatDefs(block).find((d) => sort === statSort(d.key));
    if (def) return found.sort((a, b) => byStat(def)(a, b) || byName(a, b));
    return found.sort(byName);
  }, [shown, pick, filter, query, sort, block]);

  // The character on the card: the one in the address (?e=), else the first.
  const [blockId, entryId] = open?.split('.') ?? [];
  const cur = list.find((e) => blockId === block.id && e.id === entryId) ?? list[0];
  const at = cur ? list.indexOf(cur) : -1;
  // Which side the next card slides in from: 1 the right (going forward), -1 the left, 0 just fades in.
  const [enter, setEnter] = useState<Dir>(0);
  const go = (e: Entry | undefined, dir: Dir = 0) => { if (e) { setEnter(dir); set(`${block.id}.${e.id}`, 'replace'); } };
  const switchTo = (v: View) => {
    setView(v);
    // The address holds the card in Profiles, but opens a panel in List.
    if (blockId === block.id) set(null, 'replace');
  };

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="flex min-w-48 flex-1 items-center gap-2 rounded-full bg-card-2 px-3 py-2 ring-1 ring-line focus-within:ring-2 focus-within:ring-sky">
          <Search size={16} className="text-muted" aria-hidden="true" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${block.title.toLowerCase()}`}
            aria-label={`Search ${block.title}`} className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted" />
        </label>
        {/* Yellow marks the player's own choice. */}
        <div role="group" aria-label="Show as" className="flex rounded-full bg-card-2 p-0.5 text-sm font-bold ring-1 ring-line">
          {([['profiles', 'Profiles', SquareUser], ['list', 'List', LayoutList]] as const).map(([v, label, Icon]) => (
            <button key={v} type="button" onClick={() => switchTo(v)} aria-pressed={view === v}
              className={'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ' + (view === v ? 'bg-signal text-ink' : 'text-muted hover:text-ink')}>
              <Icon size={15} aria-hidden="true" /> {label}
            </button>
          ))}
        </div>
        {view === 'list' && (
          <label>
            <span className="sr-only">Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-full bg-card-2 px-3 py-2 text-sm font-bold ring-1 ring-line">
              <option value="az">A to Z</option>
              <option value="za">Z to A</option>
              {filter && <option value="group">By {filter.toLowerCase()}</option>}
              {allStatDefs(block).map((d) => <option key={d.key} value={statSort(d.key)}>Best {d.label.toLowerCase()}</option>)}
            </select>
          </label>
        )}
      </div>
      {values.length > 1 && (
        <ScrollRow className="-mx-1 mt-3 flex gap-1.5 px-1 pb-1" role="group" label={`Filter by ${filter}`}>
          <FilterChip on={!pick} tint={ctx.tint} onClick={() => setPick(null)}>All · {shown.length}</FilterChip>
          {values.map(([v, n]) => <FilterChip key={v} on={pick === v} tint={ctx.tint} onClick={() => setPick(pick === v ? null : v)}>{v} · {n}</FilterChip>)}
        </ScrollRow>
      )}

      {list.length === 0 ? (
        <Nothing query={query} shown={shown} onOpen={go} />
      ) : view === 'profiles' && cur ? (
        <>
          <Strip block={block} list={list} cur={cur} color={color} onPick={(e) => go(e, Math.sign(list.indexOf(e) - at) as Dir)} />
          <Profile key={cur.id} block={block} ctx={ctx} e={cur} prev={list[at - 1]} next={list[at + 1]} n={at + 1} of={list.length} color={color} onGo={go} enter={enter}
            recruited={recruits ? ticks.has(`recruited:${block.id}.${cur.id}`) : undefined} onRecruit={() => toggle(`recruited:${block.id}.${cur.id}`)} />
        </>
      ) : (
        <ul className="mt-3 grid">
          {list.map((e, i) => <Row key={e.id} e={e} block={block} color={color} first={i === 0} onOpen={() => set(`${block.id}.${e.id}`)}
            recruited={recruits ? ticks.has(`recruited:${block.id}.${e.id}`) : undefined} />)}
        </ul>
      )}
      <HiddenNote offRoute={offRoute} spoilers={spoilers} ctx={ctx} />
      {view === 'list' && <OpenPanel block={block} list={list} ctx={ctx} />}
    </>
  );
}

function Nothing({ query, shown, onOpen }: { query: string; shown: Entry[]; onOpen: (e: Entry) => void }) {
  if (!query.trim()) return <p className="mt-6 text-center text-sm text-muted">Nobody here with that filter.</p>;
  const near = closest(shown, query, entryText);
  return (
    <div className="mt-6 grid justify-items-center gap-2 text-center text-sm text-muted">
      <p>Nobody matches “{query.trim()}”.</p>
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

/** What's in an entry's piece: its picture, else its group's symbol, else initials. */
function Mark({ e, block, px }: { e: Entry; block: Block; px: number }) {
  if (e.icon) return null;
  const symbol = symbolFor(e, block);
  return symbol ? <BlockIcon name={symbol} size={Math.round(px * 0.22)} strokeWidth={2.4} /> : <>{initials(e.name)}</>;
}

/** A row of small pieces, one per character: tap one to put them on the card. */
function Strip({ block, list, cur, color, onPick }: { block: Block; list: Entry[]; cur: Entry; color: string; onPick: (e: Entry) => void }) {
  const ref = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[aria-current="true"]');
    const row = el?.closest('.chip-strip') as HTMLElement | null;
    if (el && row) row.scrollTo({ left: el.offsetLeft - row.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' });
  }, [cur.id]);
  return (
    <div ref={ref as never}>
      <ScrollRow as="ul" label="Characters" className="-mx-1 mt-3 flex gap-2 px-1 pb-1 pt-1">
        {list.map((e) => {
          const on = e.id === cur.id;
          return (
            <li key={e.id} className="shrink-0">
              <button type="button" onClick={() => onPick(e)} aria-current={on} aria-label={e.name} className="group flex w-14 flex-col items-center gap-1">
                <span className={'rounded-lg p-0.5 transition ' + (on ? 'bg-signal' : 'group-hover:-translate-y-0.5')}>
                  <Piece size={46} color={color} image={e.icon}><Mark e={e} block={block} px={46} /></Piece>
                </span>
                <span className={'w-full truncate text-center text-[11px] leading-tight ' + (on ? 'font-bold text-ink' : 'text-muted')}>{e.name}</span>
              </button>
            </li>
          );
        })}
      </ScrollRow>
    </div>
  );
}

/**
 * The card for one character, with arrows to the next. On a touchscreen it follows a
 * sideways swipe: let go past a quarter of the way and it slides off as the next one
 * slides in; let go sooner and it springs back. Up-and-down still scrolls the page.
 */
function Profile({ block, ctx, e, prev, next, n, of, color, onGo, enter, recruited, onRecruit }: {
  block: Block; ctx: BlockContext; e: Entry; prev?: Entry; next?: Entry; n: number; of: number; color: string;
  onGo: (e: Entry | undefined, dir?: Dir) => void; enter: Dir; recruited?: boolean; onRecruit: () => void;
}) {
  const card = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; dx: number; side?: boolean } | null>(null);
  const arrow = 'grid size-9 shrink-0 place-items-center rounded-full bg-card-2 ring-1 ring-line hover:ring-ink disabled:opacity-30';
  // The card moves by its style directly, so a swipe never waits on React.
  const place = (dx: number, animate: boolean) => {
    const el = card.current;
    if (!el) return;
    el.style.transition = animate ? 'transform 220ms cubic-bezier(.2,.8,.2,1), opacity 220ms ease-out' : 'none';
    el.style.transform = dx ? `translateX(${dx}px) rotate(${dx / 60}deg)` : '';
    el.style.opacity = dx ? String(Math.max(0.4, 1 - Math.abs(dx) / el.offsetWidth)) : '';
  };
  const down = (p: React.PointerEvent) => {
    if (p.pointerType === 'mouse') return;
    drag.current = { x: p.clientX, y: p.clientY, dx: 0 };
  };
  const move = (p: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const mx = p.clientX - d.x, my = p.clientY - d.y;
    // Decide once which way the finger is going: sideways is ours, up and down is the page's.
    if (d.side === undefined) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      d.side = Math.abs(mx) > Math.abs(my);
      if (!d.side) { drag.current = null; return; }
      try { card.current?.setPointerCapture(p.pointerId); } catch { /* the pointer already ended */ }
    }
    // Past the first or last character it drags with a pull, so it's clear there's no more.
    d.dx = (mx < 0 ? next : prev) ? mx : mx * 0.25;
    place(d.dx, false);
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.side) return;
    const to = d.dx < 0 ? next : prev;
    const width = card.current?.offsetWidth ?? 320;
    if (to && Math.abs(d.dx) > width * 0.25) {
      const dir: Dir = d.dx < 0 ? 1 : -1;
      place(-dir * width * 1.1, true);
      setTimeout(() => onGo(to, dir), 180);
    } else place(0, true);
  };
  return (
    // Clipped, so a card on its way out never widens the page.
    <div className="-mx-1 mt-3 overflow-hidden px-1 py-px">
    <div ref={card} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      className={'touch-pan-y rounded-2xl bg-card p-4 ring-1 ring-line ' + (enter === 1 ? 'card-in-right' : enter === -1 ? 'card-in-left' : 'card-in')}>
      <div className="flex items-center gap-1">
        <p className="flex-1 text-xs font-bold uppercase tracking-wide text-muted">{n} of {of}</p>
        <ShareButton path={sharePath(ctx.gameId, ctx.page, block, e)} title={e.name} what="character" tint={ctx.tint} quiet />
        <button type="button" onClick={() => onGo(prev!, -1)} disabled={!prev} aria-label={prev ? `Back to ${prev.name}` : 'Back'} className={arrow}><ChevronLeft size={18} aria-hidden="true" /></button>
        <button type="button" onClick={() => onGo(next!, 1)} disabled={!next} aria-label={next ? `On to ${next.name}` : 'Next'} className={arrow}><ChevronRight size={18} aria-hidden="true" /></button>
      </div>
      <div className="mx-auto mt-1 max-w-xl">
        <CharacterCard entry={e} block={block} route={ctx.route} routes={ctx.routes} color={color} spoilers={ctx.spoilers} onGo={onGo} />
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {recruited !== undefined && (
            <button type="button" onClick={onRecruit} aria-pressed={recruited}
              className={'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ring-1 ' + (recruited ? 'bg-leaf text-white ring-leaf' : 'ring-line hover:ring-leaf')}>
              <Check size={15} aria-hidden="true" /> {recruited ? 'Recruited' : 'Mark as recruited'}
            </button>
          )}
          <Tip text="Opens a Draft with this character filled in. Change what's wrong; villagers check it" tint="leaf">
            <Link href={`/g/${ctx.gameId}/workshop?fix=${block.id}.${e.id}`} className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ring-1 ring-line hover:ring-leaf">
              <Hammer size={15} aria-hidden="true" /> Suggest a fix
            </Link>
          </Tip>
        </div>
        {e.source && <p className="mt-4 text-xs text-muted">Source: {e.source}</p>}
      </div>
    </div>
    </div>
  );
}

/** One character in the List: piece, name, what they are and where, and when they turn up. */
function Row({ e, block, color, first, onOpen, recruited }: { e: Entry; block: Block; color: string; first: boolean; onOpen: () => void; recruited?: boolean }) {
  const fields = shownFields(block).filter((f) => !f.spoiler);
  const text = (spot: string, kind?: string) => fields.filter((f) => spotOf(f) === spot && (!kind || f.kind === kind))
    .map((f) => valueOf(e, f)).map((v) => v.text ?? v.byRoute[0]?.[1]).filter(Boolean) as string[];
  const besideField = fields.find((f) => spotOf(f) === 'beside');
  const beside = besideField && text('beside')[0] ? besideText(besideField, text('beside')[0]) : undefined;
  const sub = [text('tags', 'tag')[0], text('meta', 'place')[0]].filter(Boolean).join(' · ');
  const when = text('meta', 'when')[0];
  return (
    <li className={first ? '' : 'border-t border-line'}>
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 rounded-xl px-1 py-2.5 text-left hover:bg-card-2">
        <Piece size={46} color={color} image={e.icon}><Mark e={e} block={block} px={46} /></Piece>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="truncate font-bold">{e.name}</span>
            {beside && <span className="shrink-0 text-xs text-muted">{beside}</span>}
            {recruited && <Check size={14} className="shrink-0 self-center text-leaf" aria-label="Recruited" />}
          </span>
          {sub && <span className="block truncate text-sm text-muted">{sub}</span>}
        </span>
        {when && <span className="max-w-[40%] shrink-0 text-right text-xs font-bold leading-tight">{when}</span>}
      </button>
    </li>
  );
}
