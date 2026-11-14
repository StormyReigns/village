'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Check, ChevronRight, ChevronUp, X } from 'lucide-react';
import type { Block, Entry } from '@/data/pages';
import { Piece } from '@/components/Piece';
import { EntryDetails } from '@/components/app/EntryPanel';
import { useTicks } from '@/components/app/entries';
import type { BlockContext } from '@/components/app/blockParts';

// The place's tray (docs/blocks/world.md): tapping a pin slides it up from the bottom of the
// screen, mostly tucked away (name, where, level, Cleared). Drag it up, tap it, or tap the pin
// again for the whole place; drag it down to tuck it away again, or further to close it. The
// map stays usable while it peeks. Over the full screen map too.


export function PlaceSheet({ entry, block, ctx, clearKey, open, onOpenChange, onClose, onFull, anchor }: {
  entry: Entry; block: Block; ctx: BlockContext; clearKey: string;
  /** Pulled up to show the whole place. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
  /** The place's full panel (sharing, fixes). */
  onFull: () => void;
  /** On wider screens the tray sits centered under this (the map's Block); else across the screen. */
  anchor?: HTMLElement | null;
}) {
  const [ticks, toggle] = useTicks(ctx.gameId);
  const [snapped, setSnapped] = useState(false);
  // Tucked away, exactly its top shows (handle, name, Cleared). Its position is worked out from
  // the tray's own height in CSS, so details loading below never move it.
  const top = useRef<HTMLDivElement>(null);
  const [peek, setPeek] = useState(96);
  // Lined up with the map's Block on wider screens (the app column isn't the middle of the
  // screen when the window is wider than the app).
  const [lane, setLane] = useState<{ left: number; width: number } | null>(null);
  // Dragging: how far the finger has moved from where the sheet sat, in px (down is positive).
  const [drag, setDrag] = useState<number | null>(null);
  const from = useRef<{ y: number; t: number; moved: boolean } | null>(null);
  // Slides in from below the first time it shows: the browser's own animation, which ends in
  // place even if it never gets to play (a tab in the background).
  const shell = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    shell.current?.animate([{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], { duration: 260, easing: 'cubic-bezier(.32,.72,0,1)' });
  }, []);
  useLayoutEffect(() => {
    const el = top.current;
    if (!el) return;
    const measure = () => setPeek(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useLayoutEffect(() => {
    const place = () => {
      if (!anchor || window.innerWidth < 640) { setLane(null); return; }
      const r = anchor.getBoundingClientRect();
      const width = Math.min(r.width, 576);
      setLane({ left: r.left + (r.width - width) / 2, width });
    };
    place();
    window.addEventListener('resize', place);
    const ro = anchor ? new ResizeObserver(place) : null;
    if (anchor) ro!.observe(anchor);
    return () => { window.removeEventListener('resize', place); ro?.disconnect(); };
  }, [anchor]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (open) onOpenChange(false); else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange, onClose]);
  // A new place starts at the top of its details, with no snap left over from the last one.
  const body = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(entry.id);
  if (seen !== entry.id) { setSeen(entry.id); setSnapped(false); }
  useEffect(() => { body.current?.scrollTo({ top: 0 }); }, [entry.id]);

  const on = ticks.has(clearKey);
  const region = block.filters?.[0] ? entry.categories[block.filters[0]] : undefined;
  const group = entry.categories.Group;
  const here = (ctx.mentions?.[entry.name.toLowerCase()] ?? []).filter((m) => !block.entries.some((e) => e.name === m.name));

  // Where it sits: tucked with only its top showing, or all the way up; a drag adds to that, kept
  // between all the way up and all the way down.
  const base = open ? '0px' : `calc(100% - ${peek}px)`;
  const y = `clamp(0px, calc(${base} + ${drag ?? 0}px), 100%)`;

  const down = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, a')) return;
    from.current = { y: e.clientY, t: performance.now(), moved: false };
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* a pointer the browser no longer tracks */ }
  };
  const move = (e: React.PointerEvent) => {
    if (!from.current) return;
    const dy = e.clientY - from.current.y;
    if (Math.abs(dy) > 5) from.current.moved = true;
    if (from.current.moved) setDrag(dy);
  };
  const up = (e: React.PointerEvent) => {
    const f = from.current;
    from.current = null;
    setDrag(null);
    if (!f) return;
    if (!f.moved) { onOpenChange(!open); return; } // a tap on the top toggles it
    const dy = e.clientY - f.y, speed = dy / Math.max(1, performance.now() - f.t); // px per ms
    if (dy < -40 || speed < -0.5) onOpenChange(true);
    else if (open && (dy > 60 || speed > 0.5)) onOpenChange(false);
    else if (!open && (dy > 40 || speed > 0.5)) onClose();
  };

  return createPortal(
    <>
      {/* All the way up, the rest of the screen dims; a tap there tucks it away again. */}
      {open && <div className="fixed inset-0 z-[89] bg-ink/25" onClick={() => onOpenChange(false)} aria-hidden="true" />}
      {/* One smooth glide, no overshoot: the curve phones use for sheets. */}
      <div ref={shell} className={'fixed bottom-0 z-[90] ' + (lane ? '' : 'inset-x-0 mx-auto w-full max-w-xl')} style={lane ? { left: lane.left, width: lane.width } : undefined}>
      <div role="dialog" aria-label={entry.name} aria-modal={open}
        className={'flex max-h-[85dvh] flex-col rounded-t-[1.75rem] bg-card shadow-[0_-6px_24px_rgb(0_0_0/.22)] ring-1 ring-line '
          + (drag == null ? 'transition-transform duration-[260ms] ease-[cubic-bezier(.32,.72,0,1)] motion-reduce:transition-none' : '')}
        style={{ transform: `translateY(${y})` }}>
        {/* The top: drag it, or tap it. */}
        <div ref={top} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { from.current = null; setDrag(null); }}
          className="shrink-0 cursor-grab touch-none select-none px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 active:cursor-grabbing">
          <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-line" aria-hidden="true" />
          <div className="flex items-center gap-3">
            {/* Cleared, like a checklist tick: the split outline until it's done. */}
            <button type="button" onClick={() => { toggle(clearKey); setSnapped(true); }} role="checkbox" aria-checked={on} aria-label={`Cleared: ${entry.name}`} className="shrink-0">
              <Piece size={44} color={`var(--${ctx.tint})`} outline={!on} snap={on && snapped}>{on ? <Check size={15} strokeWidth={3} aria-hidden="true" /> : null}</Piece>
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-lg leading-tight">{entry.name}</p>
              <p className="truncate text-xs text-muted">{[group, region, entry.stat, on ? 'Cleared' : null].filter(Boolean).join(' · ')}</p>
            </div>
            <button type="button" onClick={() => onOpenChange(!open)} aria-label={open ? 'Tuck it away' : 'Show the whole place'} aria-expanded={open}
              className="grid size-9 shrink-0 place-items-center rounded-full bg-card-2 ring-1 ring-line hover:ring-ink">
              <ChevronUp size={18} className={'transition-transform ' + (open ? 'rotate-180' : '')} aria-hidden="true" />
            </button>
            <button type="button" onClick={onClose} aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-card-2 hover:text-ink"><X size={18} aria-hidden="true" /></button>
          </div>
        </div>
        {/* The whole place, scrolling on its own once it's all the way up. */}
        <div ref={body} className={'thin-scroll min-h-0 flex-1 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] ' + (open ? 'overflow-y-auto' : 'overflow-hidden')}>
          <EntryDetails entry={entry} block={block} route={ctx.route} routes={ctx.routes} color={`var(--${ctx.tint})`} />
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
          <button type="button" onClick={onFull} className="btn-quiet mt-6 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold">
            Share or fix this place <ChevronRight size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
      </div>
    </>,
    document.body,
  );
}
