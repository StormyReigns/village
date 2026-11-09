'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronRight, Filter, MapPin, X } from 'lucide-react';
import type { Block, BlockMap, Entry } from '@/data/pages';
import { Piece } from '@/components/Piece';
import { BlockIcon, hasIcon } from '@/components/Icon';
import { initials, useOpenEntry, useTicks } from '@/components/app/entries';
import { symbolFor } from '@/components/app/symbols';
import type { BlockContext } from '@/components/app/blockParts';
import { browserClient } from '@/lib/supabase/browser';
import { GROUP, MAP_PICTURES, groupSymbol, groupsOf, inGroups, spotOf } from '@/lib/world-map';
import { MapCanvas, type CanvasPin } from './MapCanvas';

// A Places Block's real map (docs/blocks/world.md): the Builders' picture with a pin for every
// place on it. Tap a pin for a small card (Cleared, Open); "Open" brings up the full place.

/** The picture's address. Only ever built from a checked path (mapOf), never a stored address. */
export const mapPictureUrl = (path: string) => browserClient()?.storage.from(MAP_PICTURES).getPublicUrl(path).data.publicUrl ?? '';

/** What sits inside a place's pin: its Group's symbol (from the group's name; a Block's own
 *  `symbols` are for its first filter, Region), else the Block's usual symbol, else initials. */
export function pinMark(e: Entry, block: Block) {
  const symbol = drawable(groupSymbol(e.categories[GROUP])) ?? symbolFor(e, block);
  return symbol ? <BlockIcon name={symbol} size={11} strokeWidth={2.6} /> : initials(e.name);
}

/** A symbol only when we can draw it. */
const drawable = (name?: string) => (hasIcon(name) ? name : undefined);

export const clearKey = (block: Block, e: Entry) => `cleared:${block.id}.${e.id}`;

export function PictureMap({ block, ctx, map, places, onOpenPlace, src: sample }: {
  block: Block; ctx: BlockContext; map: BlockMap;
  /** The places the player can see (on their route, spoilers only when shown). */
  places: Entry[];
  onOpenPlace: (e: Entry) => void;
  /** The sample page only (/lab/map): a picture of our own, not one from the bucket. */
  src?: string;
}) {
  const [ticks, toggle] = useTicks(ctx.gameId);
  const { open } = useOpenEntry();
  const [picked, setPicked] = useState<string | null>(null);
  const [snapped, setSnapped] = useState<string | null>(null);
  // Groups shown on the map; none picked shows every place. Never remembered: a fresh visit
  // always shows everything, so no place is ever missing without the player knowing why (Matt).
  const [only, setOnly] = useState<string[]>([]);
  const src = useMemo(() => sample ?? mapPictureUrl(map.picture), [sample, map.picture]);

  const groups = groupsOf(places);
  const flip = (g: string) => setOnly(only.includes(g) ? only.filter((x) => x !== g) : [...only, g]);
  const showing = only.length ? places.filter((e) => inGroups(e, only)) : places;
  const onMap = showing.filter((e) => spotOf(e));
  const missing = places.filter((e) => !spotOf(e)).length;
  const label = (g: string) => g || 'No group';
  const cleared = places.filter((e) => ticks.has(clearKey(block, e))).length;
  const pins: CanvasPin[] = onMap.map((e) => ({ id: e.id, ...spotOf(e)!, name: e.name, mark: pinMark(e, block), done: ticks.has(clearKey(block, e)) }));

  // A place opened from a link (?e=block.place) is picked and centered on the map.
  const [openBlock, openId] = open?.split('.') ?? [];
  const linked = openBlock === block.id ? onMap.find((e) => e.id === openId) : undefined;
  const [followed, setFollowed] = useState<string | undefined>(undefined);
  if (linked?.id !== followed) { setFollowed(linked?.id); if (linked) setPicked(linked.id); }
  const pick = picked ? onMap.find((e) => e.id === picked) : undefined;
  const focus = pick ? { ...spotOf(pick)!, key: pick.id } : null;

  const bar = pick ? (() => {
    const key = clearKey(block, pick);
    const on = ticks.has(key);
    const region = block.filters?.[0] ? pick.categories[block.filters[0]] : undefined;
    return (
      <div className="flex items-center gap-2.5 rounded-2xl bg-card p-2 pr-2.5 shadow-soft ring-1 ring-line">
        {/* Cleared, like a checklist tick: the split outline until it's done. */}
        <button type="button" onClick={() => { toggle(key); setSnapped(key); }} role="checkbox" aria-checked={on} aria-label={`Cleared: ${pick.name}`} className="shrink-0">
          <Piece size={40} color={`var(--${ctx.tint})`} outline={!on} snap={on && snapped === key}>{on ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : null}</Piece>
        </button>
        <button type="button" data-map-exit onClick={() => onOpenPlace(pick)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className="min-w-0 flex-1">
            <span className="block truncate font-bold leading-tight">{pick.name}</span>
            <span className="block truncate text-xs text-muted">{[region, pick.stat, on ? 'Cleared' : null].filter(Boolean).join(' · ')}</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-white">Open <ChevronRight size={13} aria-hidden="true" /></span>
        </button>
        <button type="button" onClick={() => setPicked(null)} aria-label="Close" className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-card-2 hover:text-ink"><X size={16} aria-hidden="true" /></button>
      </div>
    );
  })() : null;

  // While a filter is on, the map says so in yellow (your choice) over its top left, with how
  // many places it hides and one tap to show them all again.
  const overlay = only.length ? (
    <div role="status" className="flex items-center gap-1.5 rounded-full bg-signal py-1 pl-2.5 pr-1 text-xs font-bold text-ink shadow-[0_1px_4px_rgb(0_0_0/.35)] ring-1 ring-ink/30">
      <Filter size={13} className="shrink-0" aria-hidden="true" />
      <span className="min-w-0 truncate">{showing.length} of {places.length} · only {only.map(label).join(', ')}</span>
      <button type="button" onClick={() => setOnly([])} className="shrink-0 rounded-full bg-ink px-2 py-0.5 text-white">Show all</button>
    </div>
  ) : null;

  return (
    <div className="mt-4">
      {groups.length > 0 && (
        <div role="group" aria-label="Show on the map" className="-mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-1 [contain:inline-size] [scrollbar-width:none]">
          <button type="button" onClick={() => setOnly([])} aria-pressed={!only.length}
            className={'shrink-0 rounded-full px-3 py-1.5 text-sm font-bold ring-1 ' + (!only.length ? 'bg-ink text-white ring-ink' : 'bg-card text-muted ring-line hover:text-ink')}>
            All · {places.length}
          </button>
          {groups.map((g) => {
            const on = only.includes(g.name);
            const sym = drawable(groupSymbol(g.name));
            return (
              <button key={g.name || '-'} type="button" onClick={() => flip(g.name)} aria-pressed={on}
                className={'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ring-1 ' + (on ? 'bg-signal text-ink ring-ink' : 'bg-card text-ink ring-line hover:ring-ink')}>
                {on ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : sym ? <BlockIcon name={sym} size={14} aria-hidden="true" /> : null}
                {label(g.name)} <span className={on ? 'text-ink/70' : 'text-muted'}>{g.count}</span>
              </button>
            );
          })}
        </div>
      )}
      <MapCanvas src={src} pic={map} alt={`Map of ${block.title}`} pins={pins} selected={picked} tint={ctx.tint}
        onPin={(id) => setPicked(id === picked ? null : id)} focus={focus} bar={bar} overlay={overlay} credit={map.credit} />
      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1 font-bold text-ink"><MapPin size={12} aria-hidden="true" /> {cleared} of {places.length} cleared</span>
        {only.length ? (
          <span className="font-bold text-ink">Showing {showing.length} of {places.length}: <button type="button" onClick={() => setOnly([])} className="underline underline-offset-2">show all</button></span>
        ) : <span>Tap a pin to see the place.</span>}
        {missing > 0 && (
          <Link href={`/g/${ctx.gameId}/workshop?pins=${block.id}`} className="font-bold text-ink underline underline-offset-2">
            {missing} not on the map yet: place {missing === 1 ? 'it' : 'them'}
          </Link>
        )}
      </p>
    </div>
  );
}
