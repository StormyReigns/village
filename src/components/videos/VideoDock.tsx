'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CornerUpLeft, GripHorizontal, X } from 'lucide-react';
import { embedUrl } from '@/lib/videos';
import { activeSlot, dockState, setHost, setMode, setSeek, stop, useDock, type DockMode } from './dock';
import { useVideoInfo } from './useVideos';

// The one video player for the whole site (docs/blocks/videos.md, "Pop out"), in the root
// layout so it never unmounts: a YouTube player restarts if it's moved in the page. While the
// video is in place it sits exactly over its spot on the entry (dock.ts calls that a slot),
// following it as you scroll; when the spot scrolls away, closes or gets covered, or you tap
// "Pop out", it moves to a corner and keeps playing. Drag its bar to another corner.

/** YouTube's rules: an embedded player is never smaller than 200 × 200. */
const MIN_HEIGHT = 200;
/** The width of the corner player on a computer; on a phone it's the screen less the gutters. */
const DOCK_WIDTH = 400;
const BAR = 40;
const GAP = 16;
/** Docks when less than this much of its spot shows; goes back when this much shows again. */
const HIDE_BELOW = 0.5;
const SHOW_AT = 0.95;

type Corner = 'tl' | 'tr' | 'bl' | 'br';
const CORNER_KEY = 'village:video-corner';

interface Box { top: number; left: number; bottom: number; right: number }

const inter = (a: Box, b: Box): Box => ({ top: Math.max(a.top, b.top), left: Math.max(a.left, b.left), bottom: Math.min(a.bottom, b.bottom), right: Math.min(a.right, b.right) });
const shown = (el: Element | null) => Boolean(el && el.getClientRects().length && el.getBoundingClientRect().height > 0);

/** The ink bar at the top and, on phones, the Pages bar at the bottom. */
function frameEdges() {
  const header = document.querySelector('header');
  // The phone's Pages bar is pinned to the bottom; the computer's sidebar has the same label.
  const nav = [...document.querySelectorAll('nav[aria-label="Pages"]')].find((n) => getComputedStyle(n).position === 'fixed') ?? null;
  return {
    top: shown(header) ? Math.max(0, header!.getBoundingClientRect().bottom) : 0,
    bottom: shown(nav) ? nav!.getBoundingClientRect().top : window.innerHeight,
  };
}

// The boxes around a spot that scroll or cut off what's inside (the entry panel, for one).
const clippers = new WeakMap<HTMLElement, HTMLElement[]>();
function clippersOf(slot: HTMLElement): HTMLElement[] {
  let list = clippers.get(slot);
  if (!list) {
    list = [];
    for (let p = slot.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (/auto|scroll|hidden|clip/.test(cs.overflowX + cs.overflowY)) list.push(p);
    }
    clippers.set(slot, list);
  }
  return list;
}

/** The part of the screen where the spot can be seen: under the ink bar, above the Pages bar,
 *  inside whatever box it scrolls in. */
function visibleArea(slot: HTMLElement): Box {
  let area: Box = { top: 0, left: 0, bottom: window.innerHeight, right: window.innerWidth };
  // Inside a sheet (the entry panel) the sheet is on top of the bars.
  if (!slot.closest('[aria-modal="true"]')) {
    const edges = frameEdges();
    area = { ...area, top: edges.top, bottom: edges.bottom };
  }
  for (const c of clippersOf(slot)) area = inter(area, c.getBoundingClientRect());
  return area;
}

/** A sheet or dialog open on top of the spot (the spot isn't in it). */
function covered(slot: HTMLElement): boolean {
  for (const m of document.querySelectorAll('[aria-modal="true"]')) {
    if (!m.contains(slot) && shown(m)) return true;
  }
  return false;
}

function readCorner(): Corner {
  try {
    const c = localStorage.getItem(CORNER_KEY);
    if (c === 'tl' || c === 'tr' || c === 'bl' || c === 'br') return c;
  } catch { /* private window: the default corner */ }
  return 'br';
}

/** Where the corner player goes, and its size. */
function dockBox(corner: Corner) {
  const vw = window.innerWidth;
  const phone = vw < 640;
  const width = phone ? vw - GAP * 2 : DOCK_WIDTH;
  const height = BAR + Math.max(MIN_HEIGHT, Math.round((width * 9) / 16));
  const edges = frameEdges();
  const top = corner[0] === 't' ? edges.top + 12 : edges.bottom - 12 - height;
  const left = phone || corner[1] === 'l' ? GAP : vw - GAP - width;
  return { top: Math.max(edges.top + 4, top), left, width, height };
}

export function VideoDock() {
  const dock = useDock();
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const corner = useRef<Corner>('br');
  const drag = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const info = useVideoInfo(dock.now?.youtubeId ?? null);
  const docked = dock.mode !== 'inline';

  useEffect(() => {
    corner.current = readCorner();
    setHost(true);
    return () => setHost(false);
  }, []);

  // Every frame while a video plays: follow its spot, or sit in the corner.
  useEffect(() => {
    if (!dock.now) return;
    let raf = 0, missing = 0, frame = 0, hidden = false, last: DockMode | null = null, settleUntil = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = box.current;
      const st = dockState();
      if (!el || !st.now) return;
      const slot = activeSlot(st);

      if (!slot) {
        // The spot closed or you left its Page: keep playing in the corner.
        if (st.mode === 'inline' && ++missing > 3) setMode('auto');
      } else {
        missing = 0;
        if (st.seek) { setSeek(false); slot.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
        const r = slot.getBoundingClientRect();
        const v = inter(r, visibleArea(slot));
        const area = r.width * r.height;
        const ratio = area > 0 ? (Math.max(0, v.right - v.left) * Math.max(0, v.bottom - v.top)) / area : 0;
        if (frame++ % 10 === 0) hidden = covered(slot);
        if (st.mode === 'inline' && (ratio < HIDE_BELOW || hidden)) setMode('auto');
        else if (st.mode === 'auto' && ratio >= SHOW_AT && !hidden) setMode('inline');

        if (dockState().mode === 'inline') {
          place(el, r.top, r.left, r.width, r.height);
          el.style.clipPath = `inset(${Math.max(0, v.top - r.top)}px ${Math.max(0, r.right - v.right)}px ${Math.max(0, r.bottom - v.bottom)}px ${Math.max(0, v.left - r.left)}px round 16px)`;
        }
      }

      const mode = dockState().mode;
      if (mode !== last) {
        // Glide between the spot and the corner, then follow scrolling exactly again.
        if (last !== null && !calm()) { el.style.transition = 'top .22s ease, left .22s ease, width .22s ease, height .22s ease'; settleUntil = performance.now() + 240; }
        last = mode;
      } else if (settleUntil && performance.now() > settleUntil) { el.style.transition = ''; settleUntil = 0; }

      if (mode !== 'inline' || !slot) {
        const d = dockBox(corner.current);
        const g = drag.current;
        place(el, d.top + (g?.dy ?? 0), d.left + (g?.dx ?? 0), d.width, d.height);
        el.style.clipPath = '';
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [dock.now]);

  if (!dock.now) return null;
  const now = dock.now;
  const title = info && info.ok ? info.title : now.title;

  /** Back to its spot: scroll there, or go back to the Page it was on. */
  const back = () => {
    const slot = activeSlot(dockState());
    setMode('auto');
    if (slot) slot.scrollIntoView({ block: 'center', behavior: 'smooth' });
    else { setSeek(true); router.push(now.where); }
  };

  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, dx: 0, dy: 0 };
  };
  const onMove = (e: React.PointerEvent) => {
    const g = drag.current;
    if (g) { g.dx = e.clientX - g.x; g.dy = e.clientY - g.y; }
  };
  const onUp = () => {
    const el = box.current;
    if (!drag.current || !el) return;
    // Snaps to the nearest corner, and remembers it on this device.
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    corner.current = `${cy < window.innerHeight / 2 ? 't' : 'b'}${cx < window.innerWidth / 2 ? 'l' : 'r'}` as Corner;
    try { localStorage.setItem(CORNER_KEY, corner.current); } catch { /* not remembered */ }
    drag.current = null;
    if (calm()) return;
    el.style.transition = 'top .22s ease, left .22s ease';
    setTimeout(() => { if (box.current) box.current.style.transition = ''; }, 240);
  };

  return (
    <div ref={box} role="region" aria-label={`Video: ${title}`}
      className={'invisible fixed z-[55] flex flex-col overflow-hidden rounded-2xl bg-ink ' + (docked ? 'shadow-[0_12px_32px_-8px_rgba(21,23,28,0.55)] ring-1 ring-white/10' : '')}>
      {docked ? (
        <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          className="flex shrink-0 cursor-grab touch-none select-none items-center gap-1 pl-2.5 pr-1 text-white active:cursor-grabbing" style={{ height: BAR }}>
          <GripHorizontal size={16} aria-hidden="true" className="shrink-0 text-white/50" />
          <p className="min-w-0 flex-1 truncate px-1 text-sm font-bold">{title}</p>
          <button type="button" onClick={back} aria-label="Back to where it was" title="Back to where it was"
            className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-white/15"><CornerUpLeft size={16} aria-hidden="true" /></button>
          <button type="button" onClick={stop} aria-label="Close the video" title="Close"
            className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-white/15"><X size={16} aria-hidden="true" /></button>
        </div>
      ) : null}
      <div className="relative min-h-0 flex-1">
        <iframe key={`${now.id}:${now.youtubeId}`} src={embedUrl(now.youtubeId, now.start)} title={title} className="absolute inset-0 size-full"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
      </div>
    </div>
  );
}

/** Reduced motion: jump between the spot and the corner instead of gliding. */
const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function place(el: HTMLElement, top: number, left: number, width: number, height: number) {
  el.style.top = `${top}px`;
  el.style.left = `${left}px`;
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
  el.style.visibility = 'visible';
}
