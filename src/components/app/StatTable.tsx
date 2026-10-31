'use client';

import { Fragment } from 'react';
import type { Block, Entry } from '@/data/pages';
import { heatFill, placeText, statFacts } from '@/lib/stats';

// The "table" look for a Collection: every entry's stats side by side, each column colored
// from worse (gray) to better (the Page's color) like the heatmaps players make. Tap a column
// to sort it best first (again for worst first), or a row to open the entry.

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
  // Ticked rows come first (the caller orders them); a label over them and a line under them
  // keep a ticked row from passing for the best of the sort.
  const isPinned = (e: Entry) => Boolean(onPin && pinned?.has(e.name));
  const firstRest = entries.findIndex((e) => !isPinned(e));
  const groupRow = (text: string, line: boolean) => (
    <tr aria-hidden="true">
      <td colSpan={defs.length + 1} className={line ? 'pt-2' : 'pt-0.5'}>
        <div className={line ? 'border-t-2 border-line pt-1.5' : ''}>
          <span className="sticky left-2 px-1 text-[11px] font-bold uppercase tracking-wide text-muted">{text}</span>
        </div>
      </td>
    </tr>
  );

  return (
    <>
      <div className="overflow-x-auto rounded-2xl bg-card ring-1 ring-line">
        <table className="w-full border-separate text-sm [border-spacing:2px]">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-card px-1 py-1.5 text-left sm:px-2">
                <button type="button" onClick={() => onSort('az')}
                  className={'rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wide ' + (sort === 'az' ? 'bg-ink text-white' : 'text-muted hover:text-ink')}>Name</button>
              </th>
              {defs.map((d) => {
                const on = sorted?.key === d.key;
                // Best first means biggest first, unless lower is better (Weight).
                const down = d.better === 'high' ? !worst : worst;
                return (
                  <th key={d.key} scope="col" className="px-0.5 py-1.5" aria-sort={on ? (down ? 'descending' : 'ascending') : undefined}>
                    <button type="button" onClick={() => onSort(statSort(d.key, on && !worst))}
                      className={'w-full rounded-full px-1.5 py-0.5 text-xs font-bold uppercase sm:px-2 sm:tracking-wide ' + (on ? 'bg-ink text-white' : 'text-muted hover:text-ink')}>
                      {d.label}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <Fragment key={e.id || e.name}>
              {i === 0 && isPinned(e) && groupRow(pinLabel, false)}
              {i === firstRest && i > 0 && groupRow(sorted ? `Everyone else, by ${sorted.label}` : 'Everyone else', true)}
              <tr onClick={() => onOpen(e)} className="cursor-pointer [&:hover>th]:bg-card-2" aria-current={mark === e.name ? 'true' : undefined}>
                <th scope="row" className={'sticky left-0 z-10 min-w-24 max-w-44 rounded-md px-1.5 py-1.5 sm:min-w-32 sm:px-2 text-left font-normal ' + (mark === e.name ? 'bg-signal' : 'bg-card')}>
                  <span className="flex items-center gap-1.5">
                    {onPin && (
                      <input type="checkbox" checked={pinned?.has(e.name) ?? false} onChange={() => onPin(e.name)} onClick={(ev) => ev.stopPropagation()}
                        aria-label={`Keep ${e.name} at the top`} className="size-3.5 shrink-0 cursor-pointer opacity-50 accent-[var(--color-muted)] hover:opacity-100 checked:opacity-100" />
                    )}
                    <button type="button" onClick={(ev) => { ev.stopPropagation(); onOpen(e); }} className="block text-left font-bold leading-tight hover:underline">
                      {e.name}
                    </button>
                  </span>
                  {filter && e.categories[filter] && <span className="block text-xs text-muted">{e.categories[filter]}</span>}
                </th>
                {defs.map((d) => {
                  const f = statFacts(d, e, among);
                  return (
                    <td key={d.key} title={f ? `${d.label} ${f.value}: ${placeText(f)}` : `No ${d.label.toLowerCase()} yet`}
                      style={f ? { background: heatFill(f.goodness, color) } : undefined}
                      className={'min-w-11 rounded-md px-1 py-1.5 text-center tabular-nums sm:min-w-12 sm:px-2 ' + (f ? (f.place === 1 ? 'font-extrabold' : '') : 'bg-card-2 text-muted')}>
                      {f ? f.value : '–'}
                    </td>
                  );
                })}
              </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          Worse
          <span className="h-2.5 w-20 rounded-full ring-1 ring-line" aria-hidden="true"
            style={{ background: `linear-gradient(to right, ${heatFill(0, color)}, ${heatFill(1, color)})` }} />
          Better
        </span>
        {lower.length > 0 && <span>Lower is better for {lower.join(' and ')}.</span>}
        {sorted && <span>Sorted by {sorted.label.toLowerCase()}, {worst ? 'worst' : 'best'} first.</span>}
      </div>
    </>
  );
}
