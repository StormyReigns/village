'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronRight, MapPin, Plus, X } from 'lucide-react';
import type { Block, Entry } from '@/data/pages';
import type { Mention } from '@/data/pages/links';
import { TINT } from './tint';
import { Piece } from '@/components/Piece';
import { useTicks } from './entries';
import type { BlockContext } from './Blocks';

// The "map" look for a Collection: places grouped by region (the Block's first filter) and
// drawn as a map of region tiles. Mark places cleared as you go, and the tiles fill in.
// Our own layout from what players know, never the game's map art.

export interface Region { name: string; label: string; places: Entry[]; hub: boolean }

export const clearKey = (block: Block, e: Entry) => `cleared:${block.id}.${e.id}`;

/** Places grouped into regions, in the order the Block lists them. The hub comes first. */
export function regionsOf(block: Block, shown: Entry[]): Region[] {
  const by = block.filters?.[0];
  const map = new Map<string, Entry[]>();
  for (const e of shown) {
    const r = (by && e.categories[by]) || 'Other';
    map.set(r, [...(map.get(r) ?? []), e]);
  }
  const regions = [...map].map(([name, places]) => {
    const hub = /^hub$/i.test(name);
    // A hub with one place goes by that place's name ("Dagsion", not "Hub").
    return { name, label: hub && places.length === 1 ? places[0].name : name, places, hub };
  });
  return [...regions.filter((r) => r.hub), ...regions.filter((r) => !r.hub)];
}

/** "Lv 12–18" from the places' levels, when they have them. */
function levels(places: Entry[]) {
  const n = places.map((e) => Number(/\d+/.exec(e.stat ?? '')?.[0])).filter((x) => Number.isFinite(x));
  if (!n.length) return null;
  const lo = Math.min(...n), hi = Math.max(...n);
  return lo === hi ? `Lv ${lo}` : `Lv ${lo}–${hi}`;
}

export function RegionMap({ block, ctx, regions, onOpen }: {
  block: Block; ctx: BlockContext; regions: Region[]; onOpen: (r: Region) => void;
}) {
  const [ticks] = useTicks(ctx.gameId);
  const t = TINT[ctx.tint];
  return (
    // Map paper: a faint dot grid under the tiles.
    <div className="mt-4 rounded-2xl bg-card-2 p-3 ring-1 ring-line [background-image:radial-gradient(color-mix(in_srgb,var(--muted)_28%,transparent)_1px,transparent_1.5px)] [background-size:16px_16px]">
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {regions.map((r) => {
          const done = r.places.filter((e) => ticks.has(clearKey(block, e))).length;
          const all = done === r.places.length;
          const lv = levels(r.places);
          return (
            <li key={r.name} className={r.hub ? 'col-span-2' : ''}>
              <button type="button" onClick={() => onOpen(r)}
                className={'flex h-full w-full flex-col gap-1 rounded-2xl px-3 py-2.5 text-left ring-1 transition hover:-translate-y-0.5 ' +
                  (all ? `${t.solid} text-white ring-transparent` : done ? `${t.soft} ring-line` : 'bg-card ring-line')}>
                <span className="flex items-center gap-1.5">
                  <MapPin size={14} className={all ? 'text-white' : t.text} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate font-bold leading-tight">{r.label}</span>
                  {all && <Check size={15} aria-hidden="true" />}
                </span>
                {/* Each half stays whole: "0 of 3 cleared", then "Lv 7–16" on the next line if needed. */}
                <span className={'flex flex-wrap gap-x-1.5 text-xs ' + (all ? 'text-white/85' : 'text-muted')}>
                  <span className="whitespace-nowrap">{r.hub ? 'Hub' : `${done} of ${r.places.length} cleared`}</span>
                  {lv && <span className="whitespace-nowrap">{lv}</span>}
                </span>
                {!r.hub && (
                  <span className={'h-1.5 overflow-hidden rounded-full ' + (all ? 'bg-white/30' : 'bg-line')}>
                    <span className={'block h-full rounded-full ' + (all ? 'bg-white' : t.solid)} style={{ width: `${(done / r.places.length) * 100}%` }} />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2.5 px-1 text-xs text-muted">Tap a region to see what&apos;s there. Mark places cleared and the map fills in. Layout is rough, placed by players.</p>
    </div>
  );
}

/** One region: its places to clear, and everything else in the app that mentions it. */
export function RegionSheet({ region, block, ctx, onClose, onOpenPlace }: {
  region: Region; block: Block; ctx: BlockContext; onClose: () => void; onOpenPlace: (e: Entry) => void;
}) {
  const [ticks, toggle] = useTicks(ctx.gameId);
  const [snapped, setSnapped] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const t = TINT[ctx.tint];
  useEffect(() => {
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const done = region.places.filter((e) => ticks.has(clearKey(block, e))).length;
  // What's here: entries elsewhere that mention the region or one of its places.
  const own = new Set(block.entries.map((e) => e.name));
  const seen = new Set<string>();
  const here: Mention[] = [];
  for (const key of [region.name, ...region.places.map((e) => e.name)]) {
    for (const m of ctx.mentions?.[key.toLowerCase()] ?? []) {
      if (own.has(m.name) || seen.has(m.href)) continue;
      seen.add(m.href);
      here.push(m);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/30 backdrop-blur-[2px] lg:items-stretch lg:justify-end" onClick={onClose}>
      <div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label={region.label} onClick={(e) => e.stopPropagation()}
        className="rise flex max-h-[88vh] w-full flex-col rounded-t-[2rem] bg-card shadow-soft outline-none lg:max-h-none lg:w-[28rem] lg:rounded-none lg:rounded-l-[2rem]">
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-line lg:hidden" aria-hidden="true" />
        <div className="flex items-start gap-3 px-5 pt-3">
          <span className={`mt-0.5 grid size-10 shrink-0 place-items-center rounded-2xl ${t.soft} ${t.text}`}><MapPin size={19} aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl leading-tight">{region.label}</h2>
            <p className="text-sm text-muted">{region.hub ? 'Hub' : `${done} of ${region.places.length} cleared`}{levels(region.places) ? ` · ${levels(region.places)}` : ''}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-full bg-card-2 ring-1 ring-line"><X size={18} aria-hidden="true" /></button>
        </div>

        <div className="overflow-y-auto px-5 pb-6 pt-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted">Places</h3>
          <ul className="mt-2 grid gap-2">
            {region.places.map((e) => {
              const on = ticks.has(clearKey(block, e));
              return (
                <li key={e.id} className="flex items-center gap-3 rounded-2xl bg-card-2 p-2.5 ring-1 ring-line">
                  {/* Like a checklist tick: a piece, the split outline until it's cleared. */}
                  <button type="button" onClick={() => { toggle(clearKey(block, e)); setSnapped(clearKey(block, e)); }} role="checkbox" aria-checked={on} aria-label={`Cleared: ${e.name}`} className="shrink-0">
                    <Piece size={42} color={`var(--${ctx.tint})`} outline={!on} snap={on && snapped === clearKey(block, e)}>{on ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : null}</Piece>
                  </button>
                  <button type="button" onClick={() => onOpenPlace(e)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <span className="min-w-0 flex-1">
                      <span className={'block font-bold leading-tight ' + (on ? 'text-muted line-through' : '')}>{e.name}</span>
                      {e.stat && <span className="block text-xs text-muted">{e.stat}</span>}
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-muted" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>

          {here.length > 0 && (
            <>
              <h3 className="mt-6 text-xs font-bold uppercase tracking-wide text-muted">What&apos;s here</h3>
              <ul className="mt-2 grid gap-1.5">
                {here.map((m) => (
                  <li key={m.href}>
                    <Link href={m.href} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-card-2">
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold leading-tight">{m.name}</span>
                        <span className="block text-xs text-muted">{m.where}</span>
                      </span>
                      <ChevronRight size={15} className="shrink-0 text-muted" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}

          <Link href={`/g/${ctx.gameId}/workshop?add=${block.id}`} className="btn-quiet mt-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold">
            <Plus size={15} className="text-leaf" aria-hidden="true" /> Missing a place here? Add it
          </Link>
        </div>
      </div>
    </div>
  );
}
