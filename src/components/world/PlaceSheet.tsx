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


export function PlaceSheet({ entry, block, ctx, clearKey, open, onOpenChange, onClose, onFull }: {
  entry: Entry; block: Block; ctx: BlockContext; clearKey: string;
  /** Pulled up to show the whole place. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
  /** The place's full panel (sharing, fixes). */
  onFull: () => void;
}) {
  const [ticks, toggle] = useTicks(ctx.gameId);
  const [snapped, setSnapped] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  // Tucked away, exactly its top shows (handle, name, Cleared).
  const top = useRef<HTMLDivElement>(null);
  const [peek, setPeek] = useState(96);
  // Dragging: how far the finger has moved from where the sheet sat, in px (down is positive).
  const [drag, setDrag] = useState<number | null>(null);
  const from = useRef<{ y: number; t: number; moved: boolean } | null>(null);
  // Slides in from below the first time it shows.
  const [shown, setShown] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setShown(true)); return () => cancelAnimationFrame(id); }, []);
  useLayoutEffect(() => {
    const el = sheet.current;
    if (!el) return;
    const measure = () => { setHeight(el.offsetHeight); if (top.current) setPeek(top.current.offsetHeight); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
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

  // Where it sits: all the way up, or tucked with only the top showing.
  const tucked = Math.max(0, height - peek);
  const rest = !shown ? height || 600 : open ? 0 : tucked;
  const y = drag == null ? rest : Math.min(height, Math.max(0, rest + drag));

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
      <div ref={sheet} role="dialog" aria-label={entry.name} aria-modal={open}
        className={'fixed inset-x-0 bottom-0 z-[90] mx-auto flex max-h-[85dvh] w-full max-w-xl flex-col rounded-t-[1.75rem] bg-card shadow-[0_-6px_24px_rgb(0_0_0/.22)] ring-1 ring-line '
          + (drag == null ? 'transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)]' : '')}
        style={{ transform: `translateY(${y}px)` }}>
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
    </>,
    document.body,
  );
}
