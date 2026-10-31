'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { Block, Entry, StatDef } from '@/data/pages';
import { heatFill, placeText, statFacts } from '@/lib/stats';

// The "table" look for a Collection: every entry's stats side by side, each column colored
// from worse (gray) to better (the Page's color) like the heatmaps players make. Tap a column
// to sort it best first (again for worst first), or a row to open the entry.
//
// Comparing characters (onPin given) works differently, for thumbs on a phone: rows can be
// ticked to stay on top, the stat names and the ticked rows stay put while the rest scrolls,
// and a tap only highlights that row and column. Opening someone takes the arrow by their name.

export const statSort = (key: string, worst = false) => `stat:${key}${worst ? ':worst' : ''}`;

export function StatTable({ block, entries, among, sort, onSort, onOpen, filter, color, mark, pinned, onPin, pinLabel = 'Selected' }: {
  block: Block;
  /** The Page's color, for the better end of the heatmap. */
  color: string;
  entries: Entry[];
  /** What the colors and places compare against: everything shown, not just this filter. */
  among: Entry[];
  sort: string;
  onSort: (sort: string) => void;
  onOpen: (e: Entry) => void;
  filter?: string;
  /** The entry this table was opened from (by name), picked out so it's easy to find. */
  mark?: string;
  /** Rows ticked to stay at the top, by name, with the tick box shown when onPin is given. */
  pinned?: Set<string>;
  onPin?: (name: string) => void;
  /** What the ticked group is called, over its rows. */
  pinLabel?: string;
}) {
  const defs = block.stats ?? [];
  const lower = defs.filter((d) => d.better === 'low').map((d) => d.label);
  const sorted = defs.find((d) => sort.startsWith(statSort(d.key)));
  const worst = sort.endsWith(':worst');
  const compare = Boolean(onPin);
  // Comparing: the row and column last tapped, highlighted.
  const [focus, setFocus] = useState<{ row: string; col?: string } | null>(null);
  const tap = (row: string, col?: string) => setFocus(focus?.row === row && focus.col === col ? null : { row, col });
  // Comparing: open with the sorted column in view, even when it's far to the right.
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!compare || !sorted || !box.current) return;
    const th = box.current.querySelector<HTMLElement>(`th[data-col="${CSS.escape(sorted.key)}"]`);
    const name = box.current.querySelector<HTMLElement>('thead th');
    if (th && name && th.offsetLeft + th.offsetWidth > box.current.clientWidth) {
      box.current.scrollLeft = th.offsetLeft - name.offsetWidth - 8;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the table opens
  }, []);

  // Ticked rows come first (the caller orders them); a label over them and a line under them
  // keep a ticked row from passing for the best of the sort.
  const isPinned = (e: Entry) => Boolean(compare && pinned?.has(e.name));
  const top = entries.filter(isPinned);
  const rest = entries.filter((e) => !isPinned(e));
  const groupRow = (text: string, line: boolean) => (
    <tr aria-hidden="true">
      <td colSpan={defs.length + 1} className={'bg-card ' + (line ? 'pt-2' : 'pt-0.5')}>
        <div className={line ? 'border-t-2 border-line pt-1.5' : ''}>
          <span className="sticky left-2 px-1 text-[11px] font-bold uppercase tracking-wide text-muted">{text}</span>
        </div>
      </td>
    </tr>
  );

  const cell = (d: StatDef, e: Entry) => {
    const f = statFacts(d, e, among);
    const inRow = focus?.row === e.name, inCol = focus?.col === d.key;
    const ring = inRow && inCol ? 'var(--ink)' : inRow || inCol ? 'color-mix(in srgb, var(--ink) 35%, transparent)' : '';
    return (
      <td key={d.key} title={f ? `${d.label} ${f.value}: ${placeText(f)}` : `No ${d.label.toLowerCase()} yet`}
        onClick={compare ? () => tap(e.name, d.key) : undefined}
        style={{ ...(f ? { background: heatFill(f.goodness, color) } : {}), ...(ring ? { boxShadow: `inset 0 0 0 2px ${ring}` } : {}) }}
        className={'min-w-11 rounded-md px-1 py-1.5 text-center tabular-nums sm:min-w-12 sm:px-2 ' + (f ? (f.place === 1 ? 'font-extrabold' : '') : 'bg-card-2 text-muted')}>
        {f ? f.value : '–'}
      </td>
    );
  };

  const row = (e: Entry) => {
    const focused = focus?.row === e.name;
    return (
      <tr key={e.id || e.name} onClick={compare ? undefined : () => onOpen(e)} className={compare ? '' : 'cursor-pointer [&:hover>th]:bg-card-2'}
        aria-current={mark === e.name ? 'true' : undefined}>
        <th scope="row" onClick={compare ? () => tap(e.name) : undefined}
          // The pseudo-element covers the gap left of the sticky names, so cells scrolling under don't peek out.
          className={'sticky left-0 z-10 min-w-24 max-w-44 rounded-md px-1.5 py-1.5 sm:min-w-32 sm:px-2 text-left font-normal before:absolute before:inset-y-0 before:-left-[3px] before:w-[3px] before:bg-card '
            + (mark === e.name ? 'bg-signal' : 'bg-card') + (focused ? ' shadow-[inset_0_0_0_2px_var(--ink)]' : '')}>
          <span className="flex items-center gap-1">
            {onPin && (
              // A roomy target around a small box, so a thumb finds it.
              <label onClick={(ev) => ev.stopPropagation()} className="-my-1.5 -ml-1.5 grid size-8 shrink-0 cursor-pointer place-items-center">
                <input type="checkbox" checked={pinned?.has(e.name) ?? false} onChange={() => onPin(e.name)}
                  aria-label={`Keep ${e.name} at the top`} className="size-3.5 cursor-pointer opacity-50 accent-[var(--color-muted)] checked:opacity-100" />
              </label>
            )}
            {compare ? (
              <span className="min-w-0 flex-1 font-bold leading-tight">{e.name}</span>
            ) : (
              <button type="button" onClick={(ev) => { ev.stopPropagation(); onOpen(e); }} className="block text-left font-bold leading-tight hover:underline">
                {e.name}
              </button>
            )}
            {compare && focused && e.name !== mark && (
              <button type="button" onClick={(ev) => { ev.stopPropagation(); onOpen(e); }} aria-label={`Open ${e.name}`}
                className="grid size-6 shrink-0 place-items-center rounded-full bg-ink text-paper"><ArrowUpRight size={13} aria-hidden="true" /></button>
            )}
          </span>
          {filter && e.categories[filter] && <span className="block text-xs text-muted">{e.categories[filter]}</span>}
        </th>
        {defs.map((d) => cell(d, e))}
      </tr>
    );
  };

  return (
    <>
      <div ref={box} className={'rounded-2xl bg-card ring-1 ring-line ' + (compare ? 'min-h-0 flex-1 overflow-auto overscroll-contain' : 'overflow-x-auto')}>
        <table className="w-full border-separate text-sm [border-spacing:2px]">
          {/* Comparing: the stat names and the ticked rows stay in view while the rest scrolls. */}
          <thead className={compare ? 'sticky top-0 z-20 bg-card' : ''}>
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-card px-1 py-1.5 text-left sm:px-2 before:absolute before:inset-y-0 before:-left-[3px] before:w-[3px] before:bg-card">
                <button type="button" onClick={() => onSort('az')}
                  className={'rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wide ' + (sort === 'az' ? 'bg-ink text-white' : 'text-muted hover:text-ink')}>Name</button>
              </th>
              {defs.map((d) => {
                const on = sorted?.key === d.key;
                // Best first means biggest first, unless lower is better (Weight).
                const down = d.better === 'high' ? !worst : worst;
                return (
                  <th key={d.key} data-col={d.key} scope="col" className="bg-card px-0.5 py-1.5" aria-sort={on ? (down ? 'descending' : 'ascending') : undefined}>
                    <button type="button" onClick={() => onSort(statSort(d.key, on && !worst))}
                      className={'w-full rounded-full px-1.5 py-0.5 text-xs font-bold uppercase sm:px-2 sm:tracking-wide '
                        + (on ? 'bg-ink text-white' : focus?.col === d.key ? 'text-ink ring-2 ring-ink/35' : 'text-muted hover:text-ink')}>
                      {d.label}
                    </button>
                  </th>
                );
              })}
            </tr>
            {top.length > 0 && groupRow(pinLabel, false)}
            {top.map(row)}
          </thead>
          <tbody>
            {top.length > 0 && rest.length > 0 && groupRow(sorted ? `Everyone else, by ${sorted.label}` : 'Everyone else', true)}
            {rest.map((e) => <Fragment key={e.id || e.name}>{row(e)}</Fragment>)}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          Worse
          <span className="h-2.5 w-20 rounded-full ring-1 ring-line" aria-hidden="true"
            style={{ background: `linear-gradient(to right, ${heatFill(0, color)}, ${heatFill(1, color)})` }} />
          Better
        </span>
        {lower.length > 0 && <span>Lower is better for {lower.join(' and ')}.</span>}
        {sorted && <span>Sorted by {sorted.label.toLowerCase()}, {worst ? 'worst' : 'best'} first.</span>}
        {compare && <span>Tap a number to line it up; the arrow opens someone.</span>}
      </div>
    </>
  );
}
