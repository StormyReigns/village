'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, Maximize2, Minus, Plus, Scan, X, ZoomIn } from 'lucide-react';
import { pieceHeight } from '@/components/Piece';
import { PIECE_PATH, PIECE_SPOT, PIECE_VIEWBOX } from '@/lib/piece';
import { centerOn, clampView, fitView, frameToSpot, groupPins, spotToFrame, zoomAt, type Size, type View } from '@/lib/world-map';

// A map picture in a frame that fits the Block it's in (docs/blocks/world.md, "Usable inside the
// Block"): it opens showing the whole picture, never traps the page (on a phone one finger
// scrolls the page and two fingers move the map; on a computer drag moves it and Ctrl + wheel
// zooms), and has zoom buttons, Fit, and full screen, where one finger moves it freely.
// Pins are pieces in signal yellow with an ink edge and an ink symbol, which read on any map,
// light or dark (Matt, 2026-11-09: the white split outline looked choppy on a picture). A cleared
// place turns ink with a white edge and a yellow tick. Pins that would touch become a count that
// zooms in on them.

export interface CanvasPin {
  id: string;
  /** Percent across and down the picture. */
  x: number;
  y: number;
  name: string;
  /** Inside the piece: initials or a symbol. */
  mark?: ReactNode;
  /** Cleared: ink with a yellow tick; else yellow with its symbol. */
  done?: boolean;
  /** Ringed in yellow: your choice (picked, or an unsent move). */
  ring?: boolean;
}

const PIN = 32;
const GAP = PIN + 6;
/** How far past its edges the map can be dragged, so a pin under the tools can come out. */
const PAD = 52;

export function MapCanvas({ src, pic, alt, pins, selected, onPin, onSpot, credit, focus, bar, overlay, tray, fullRequest, exitRequest, frameClass }: {
  src: string;
  pic: Size;
  alt: string;
  pins: CanvasPin[];
  selected?: string | null;
  onPin?: (id: string) => void;
  /** A tap on the picture itself (placing a pin), with the spot under it. */
  onSpot?: (spot: { x: number; y: number }) => void;
  /** The Page's color name (pins are yellow and ink on every Page, so the map itself doesn't use it). */
  tint?: string;
  credit?: string;
  /** Bring this spot into view when it changes: a gentle pan only if it's near an edge (a tapped
   *  pin), or centered and zoomed in when `zoom` (a place opened from a link). */
  focus?: { x: number; y: number; key: string; zoom?: boolean } | null;
  /** Over the bottom of the frame: the picked pin's card. */
  bar?: ReactNode;
  /** Over the top left of the frame: what's filtered. */
  overlay?: ReactNode;
  /** Full screen only, under the map: a Builder's list of places to pin. */
  tray?: ReactNode;
  /** Opens full screen each time it changes (a "Full screen" button outside the map). */
  fullRequest?: number;
  /** Leaves full screen each time it changes (something opening over the page), without a step back. */
  exitRequest?: number;
  /** The frame's height when it isn't full screen. Without it, the picture's own shape (from the
   *  Block's width), at least 15rem so the pin's card fits, at most two thirds of the
   *  screen, so a wide map has few empty bands on a phone. */
  frameClass?: string;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [full, setFull] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [tools, setTools] = useState(false);
  // The picture failed to load: say so (with Try again) instead of an empty box. `tries` reloads it.
  const [broken, setBroken] = useState(false);
  const [tries, setTries] = useState(0);
  // The latest view, size and full screen, for touch and wheel handlers and glides.
  const viewRef = useRef<View | null>(null);
  const sizeRef = useRef<Size | null>(null);
  const fullRef = useRef(false);
  useLayoutEffect(() => { viewRef.current = view; sizeRef.current = size; fullRef.current = full; });
  // A drag that moved isn't a tap.
  const moved = useRef(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const say = useCallback((text: string) => {
    setHint(text);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(null), 1400);
  }, []);

  // Measure the frame; on a new size (full screen, a turned phone) keep the same middle in view.
  useLayoutEffect(() => {
    const el = frame.current;
    if (!el) return;
    const measure = () => {
      const next = { w: el.clientWidth, h: el.clientHeight };
      if (!next.w || !next.h) return;
      const was = sizeRef.current, v = viewRef.current;
      setSize(next);
      // First time, or showing the whole map: show the whole map at the new size too.
      if (!v || !was || Math.abs(v.scale - fitView(was, pic).scale) < 1e-6) { setView(fitView(next, pic)); return; }
      const mid = { x: ((was.w / 2 - v.x) / (pic.w * v.scale)) * 100, y: ((was.h / 2 - v.y) / (pic.h * v.scale)) * 100 };
      setView(centerOn(mid, v.scale, next, pic, PAD));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pic, full]);

  // Moves glide (zoom buttons, Fit, a count, bringing a pin into view): a quick ease-out, so the
  // map never jumps. A finger or the mouse on the map stops a glide at once.
  const glide = useRef<number | null>(null);
  const stopGlide = () => { if (glide.current != null) { cancelAnimationFrame(glide.current); glide.current = null; } };
  const glideTo = useCallback((to: View) => {
    if (glide.current != null) cancelAnimationFrame(glide.current);
    const from = viewRef.current;
    if (!from || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setView(to); return; }
    const start = performance.now(), ms = 320;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms), e = 1 - Math.pow(1 - t, 3);
      // Scale eases on a log curve, so zooming feels even; position follows.
      const scale = Math.exp(Math.log(from.scale) + (Math.log(to.scale) - Math.log(from.scale)) * e);
      setView({ scale, x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e });
      glide.current = t < 1 ? requestAnimationFrame(step) : null;
    };
    glide.current = requestAnimationFrame(step);
  }, []);
  const update = useCallback((f: (v: View, s: Size) => View) => {
    const v = viewRef.current, s = sizeRef.current;
    if (v && s) glideTo(f(v, s));
  }, [glideTo]);

  // Bring a spot into view when asked. A tapped pin moves only if it's near an edge (or, in full
  // screen, under the place's tray), and never zooms; a place opened from a link is centered and
  // zoomed in a little.
  const focusKey = focus?.key;
  useEffect(() => {
    if (!focus) return;
    const v = viewRef.current, s = sizeRef.current;
    if (!v || !s) return;
    if (focus.zoom) { glideTo(centerOn(focus, Math.max(v.scale, fitView(s, pic).scale * 2), s, pic, PAD)); return; }
    const at = spotToFrame(focus, v, pic);
    const bottom = s.h - (fullRef.current ? 150 : 40);
    if (at.x > 48 && at.x < s.w - 48 && at.y > 56 && at.y < bottom) return;
    // Centered in the part of the map that's in view (above the tray in full screen).
    const shift = fullRef.current ? 55 : 0;
    const c = centerOn(focus, v.scale, s, pic, PAD);
    glideTo(clampView({ ...c, y: c.y - shift }, s, pic, PAD));
    // Only when the spot asked for changes.
  }, [focusKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Touch: one finger scrolls the page (in the Block) or moves the map (full screen); two
  // fingers move and zoom. Listeners that can stop the page, so not passive.
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    let start: { v: View; mid: { x: number; y: number }; dist: number } | null = null;
    let warned = false;
    const local = (t: Touch) => { const r = el.getBoundingClientRect(); return { x: t.clientX - r.left, y: t.clientY - r.top }; };
    const read = (ts: TouchList) => {
      const a = local(ts[0]), b = ts.length > 1 ? local(ts[1]) : a;
      return { mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, dist: Math.hypot(a.x - b.x, a.y - b.y) || 1 };
    };
    const begin = (e: TouchEvent) => {
      const v = viewRef.current;
      if (!v) return;
      if (e.touches.length >= 2 || fullRef.current) stopGlide();
      if (e.touches.length >= 2 || fullRef.current) { const r = read(e.touches); start = { v, ...r }; } else start = null;
      if (e.touches.length === 1) { moved.current = false; warned = false; }
    };
    const move = (e: TouchEvent) => {
      if (e.touches.length === 1 && !fullRef.current) {
        // One finger in the Block: the page scrolls. Say how to move the map, once per touch.
        if (!warned) { warned = true; say('Use two fingers to move the map'); }
        return;
      }
      if (!start) begin(e);
      if (!start) return;
      e.preventDefault();
      moved.current = true;
      const s = sizeRef.current;
      if (!s) return;
      const now = read(e.touches);
      const factor = e.touches.length >= 2 && start.dist > 1 ? now.dist / start.dist : 1;
      const shifted = { ...start.v, x: start.v.x + now.mid.x - start.mid.x, y: start.v.y + now.mid.y - start.mid.y };
      setView(zoomAt(shifted, factor, now.mid, s, pic, PAD));
    };
    const end = (e: TouchEvent) => { if (e.touches.length) begin(e); else start = null; };
    el.addEventListener('touchstart', begin, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    // The wheel scrolls the page unless Ctrl (or a trackpad pinch, which sends Ctrl) is held,
    // or the map is full screen.
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !fullRef.current) { say('Hold Ctrl and scroll to zoom'); return; }
      e.preventDefault();
      stopGlide();
      const r = el.getBoundingClientRect();
      const s = sizeRef.current, v = viewRef.current;
      if (s && v) setView(zoomAt(v, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002)), { x: e.clientX - r.left, y: e.clientY - r.top }, s, pic, PAD));
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.removeEventListener('touchstart', begin);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
      el.removeEventListener('wheel', wheel);
    };
  }, [pic, say, full]);

  // Mouse (and pen): drag to move.
  const drag = useRef<{ x: number; y: number; v: View } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch' || e.button !== 0 || !view) return;
    if ((e.target as HTMLElement).closest('button, a, input, [data-map-ui]')) return;
    setTools(false);
    stopGlide();
    drag.current = { x: e.clientX, y: e.clientY, v: viewRef.current ?? view };
    moved.current = false;
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* a pointer the browser no longer tracks */ }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !size) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (Math.hypot(dx, dy) > 4) moved.current = true;
    if (moved.current) setView(clampView({ ...d.v, x: d.v.x + dx, y: d.v.y + dy }, size, pic, PAD));
  };
  const onPointerUp = () => { drag.current = null; };

  // A tap on the picture (not a drag): a spot for placing.
  const onClick = (e: React.MouseEvent) => {
    if (moved.current) { moved.current = false; return; }
    if (!onSpot || !view || (e.target as HTMLElement).closest('button, a, input, [data-map-ui]')) return;
    const r = frame.current!.getBoundingClientRect();
    const spot = frameToSpot({ x: e.clientX - r.left, y: e.clientY - r.top }, view, pic);
    if (spot) onSpot(spot);
  };

  // Full screen: the page under it stays still, Escape or Back closes it.
  const pushed = useRef(false);
  const close = useCallback(() => {
    setFull(false);
    if (pushed.current) { pushed.current = false; window.history.back(); }
  }, []);
  const open = () => {
    setFull(true);
    // A fresh state object, never Next's own (see useOpenEntry), so Back closes the map.
    window.history.pushState({ villageMap: true }, '', window.location.href);
    pushed.current = true;
  };
  // "Full screen" from outside the map.
  const asked = useRef(fullRequest);
  useEffect(() => {
    if (fullRequest === asked.current) return;
    asked.current = fullRequest;
    if (!fullRef.current) open();
  }, [fullRequest]);
  const exited = useRef(exitRequest);
  useEffect(() => {
    if (exitRequest === exited.current) return;
    exited.current = exitRequest;
    if (fullRef.current) { pushed.current = false; setFull(false); }
  }, [exitRequest]);
  // Leaving full screen for something that opens over the page (a place's card): close it
  // without stepping back, so what opens isn't undone by the step. A tick later, so the tapped
  // button still gets its own tap (closing at once would take it off the page first).
  const leave = (e: React.MouseEvent) => {
    if (fullRef.current && (e.target as HTMLElement).closest('[data-map-exit]')) { pushed.current = false; setTimeout(() => setFull(false), 0); }
  };
  useEffect(() => {
    if (!full) return;
    const was = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    const onPop = () => { if (pushed.current) { pushed.current = false; setFull(false); } };
    window.addEventListener('keydown', onKey);
    window.addEventListener('popstate', onPop);
    return () => { document.body.style.overflow = was; window.removeEventListener('keydown', onKey); window.removeEventListener('popstate', onPop); };
  }, [full, close]);

  const zoomBy = (factor: number) => update((v, s) => zoomAt(v, factor, { x: s.w / 2, y: s.h / 2 }, s, pic, PAD));
  // White with an ink edge and a shadow, so a tool shows on any picture, light or dark.
  const tool = 'grid size-10 shrink-0 place-items-center rounded-full bg-card text-ink shadow-[0_1px_4px_rgb(0_0_0/.35)] ring-1 ring-ink/20 hover:ring-ink disabled:opacity-40';
  const fitted = view && size ? Math.abs(view.scale - fitView(size, pic).scale) < 1e-6 : true;

  // Pins on screen, grouped where they'd touch. The picked one never hides in a group.
  const onScreen = view ? pins.map((p) => ({ ...p, ...spotToFrame(p, view, pic), sx: p.x, sy: p.y })) : [];
  const picked = onScreen.find((p) => p.id === selected);
  const groups = groupPins(onScreen.filter((p) => p.id !== selected), GAP);
  const byId = new Map(onScreen.map((p) => [p.id, p]));
  const zoomToGroup = (ids: string[]) => update((v, s) => {
    const ps = ids.map((id) => byId.get(id)!).filter(Boolean);
    const xs = ps.map((p) => p.sx), ys = ps.map((p) => p.sy);
    const mid = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
    // Close enough that the nearest two pull apart (at least half as close again), in one tap.
    let nearest = Infinity;
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      nearest = Math.min(nearest, Math.hypot(((ps[i].sx - ps[j].sx) / 100) * pic.w, ((ps[i].sy - ps[j].sy) / 100) * pic.h));
    }
    const apart = nearest > 0 && Number.isFinite(nearest) ? (GAP * 1.25) / nearest : v.scale * 4;
    return centerOn(mid, Math.max(v.scale * 1.5, apart), s, pic, PAD);
  });

  const pinButton = (p: (typeof onScreen)[number]) => (
    <button key={p.id} type="button" data-map-ui onClick={() => onPin?.(p.id)} aria-label={p.name} aria-pressed={p.id === selected}
      className="absolute grid place-items-center outline-none focus-visible:[filter:drop-shadow(0_0_2px_var(--signal))_drop-shadow(0_0_2px_var(--signal))]"
      style={{ left: p.x, top: p.y, width: PIN + 12, height: pieceHeight(PIN) + 12, transform: 'translate(-50%, -50%)' }}>
      <MapPinShape done={p.done} big={p.id === selected} halo={p.ring || p.id === selected}>{p.done ? <Check size={13} strokeWidth={3.5} aria-hidden="true" /> : p.mark}</MapPinShape>
      {p.id === selected && (
        <span className="pointer-events-none absolute top-full mt-0.5 max-w-40 truncate rounded-full bg-card px-2 py-0.5 text-xs font-bold text-ink shadow-soft ring-1 ring-line">{p.name}</span>
      )}
    </button>
  );

  const content = (
    // Full screen goes straight under <body>, so nothing on the page (a Block's animation, the
    // phone's tab bar) can sit over it or trap it.
    <div className={full ? 'fixed inset-0 z-[80] flex flex-col bg-ink' : 'relative @container'}>
      <div ref={frame} role="application" aria-label={alt} aria-roledescription="map"
        style={full || frameClass ? undefined : { height: `clamp(15rem, calc(100cqw * ${pic.h / pic.w}), min(66dvh, 40rem))` }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onClick={onClick}
        className={'relative isolate select-none overflow-hidden ' + (full ? 'min-h-0 flex-1 bg-ink [touch-action:none]' : `${frameClass ?? 'w-full'} rounded-2xl bg-card-2 ring-1 ring-line [touch-action:pan-x_pan-y]`)
          + (onSpot ? ' cursor-crosshair' : ' cursor-grab active:cursor-grabbing')}>
        {view && (
          // Drawn at its size on screen, placed with left and top, not moved and scaled with a CSS
          // transform: on iPhones a big transformed picture inside a rounded box sometimes isn't
          // drawn at all (Matt, 2026-11-14: the map went blank on his phone and stayed blank).
          // eslint-disable-next-line @next/next/no-img-element
          <img key={tries} src={tries ? `${src}${src.includes('?') ? '&' : '?'}try=${tries}` : src} alt="" draggable={false} width={pic.w} height={pic.h}
            decoding="async" onError={() => setBroken(true)} onLoad={() => setBroken(false)}
            className="pointer-events-none absolute max-w-none select-none"
            style={{ left: view.x, top: view.y, width: pic.w * view.scale, height: pic.h * view.scale }} />
        )}
        {broken && (
          <div data-map-ui className="absolute inset-0 grid place-items-center p-4">
            <p className="grid justify-items-center gap-2 rounded-2xl bg-card px-4 py-3 text-center text-sm shadow-soft ring-1 ring-line">
              The map picture didn&apos;t load.
              <button type="button" onClick={() => { setBroken(false); setTries((n) => n + 1); }} className="btn-primary rounded-full px-4 py-1.5 text-sm font-bold">Try again</button>
            </p>
          </div>
        )}
        {groups.map((g) => g.ids.length === 1 ? pinButton(byId.get(g.ids[0])!) : (
          <button key={g.ids.join()} type="button" data-map-ui onClick={() => zoomToGroup(g.ids)} aria-label={`${g.ids.length} places here: zoom in`}
            className="absolute grid size-9 place-items-center rounded-full bg-ink text-sm font-black text-white shadow-soft ring-2 ring-white"
            style={{ left: g.x, top: g.y, transform: 'translate(-50%, -50%)' }}>{g.ids.length}</button>
        ))}
        {picked && pinButton(picked)}

        {overlay && <div data-map-ui className="absolute left-2 top-2 max-w-[calc(100%-4.5rem)]">{overlay}</div>}

        {/* The tools, over the top right: a magnifier that opens zoom, Fit and full screen, so the
            map stays clear. Full screen keeps its own close button in view. */}
        <div data-map-ui className="absolute right-2 top-2 flex flex-col items-end gap-1.5">
          <div className="flex gap-1.5">
            {full && <button type="button" onClick={close} aria-label="Close full screen" title="Close full screen" className={tool}><X size={18} aria-hidden="true" /></button>}
            <button type="button" onClick={() => setTools(!tools)} aria-expanded={tools} aria-label="Zoom and full screen" title="Zoom and full screen"
              className={tool + (tools ? ' !bg-signal' : '')}><ZoomIn size={18} aria-hidden="true" /></button>
          </div>
          {tools && (
            <div className="flex flex-col gap-1.5">
              <button type="button" onClick={() => zoomBy(1.6)} aria-label="Zoom in" title="Zoom in" className={tool}><Plus size={18} aria-hidden="true" /></button>
              <button type="button" onClick={() => zoomBy(1 / 1.6)} disabled={fitted} aria-label="Zoom out" title="Zoom out" className={tool}><Minus size={18} aria-hidden="true" /></button>
              <button type="button" onClick={() => update((_, sz) => fitView(sz, pic))} disabled={fitted} aria-label="Show the whole map" title="Show the whole map" className={tool}><Scan size={17} aria-hidden="true" /></button>
              {!full && <button type="button" onClick={() => { setTools(false); open(); }} aria-label="Full screen" title="Full screen" className={tool}><Maximize2 size={17} aria-hidden="true" /></button>}
            </div>
          )}
        </div>

        {hint && (
          <p role="status" className="pointer-events-none absolute inset-x-0 top-1/2 mx-auto w-fit -translate-y-1/2 rounded-full bg-ink/85 px-4 py-2 text-sm font-bold text-white">{hint}</p>
        )}
        {bar && <div data-map-ui onClickCapture={leave} className={'absolute inset-x-2 ' + (full && !tray ? 'bottom-[max(0.5rem,env(safe-area-inset-bottom))]' : 'bottom-2')}>{bar}</div>}
      </div>
      {full && tray}
      {credit && <p className={'px-1 pt-1.5 text-xs ' + (full ? 'px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-white/70' : 'text-muted')}>{credit}</p>}
    </div>
  );
  return full ? createPortal(content, document.body) : content;
}

/** A pin: the piece in yellow with an ink edge (cleared: ink with a white edge), its symbol in the
 *  middle. The picked one is bigger with a white glow. Drawn here rather than with Piece, whose
 *  outline is the split "not built yet" look, which doesn't read on a busy picture. */
function MapPinShape({ done, big, halo, children }: { done?: boolean; big?: boolean; halo?: boolean; children?: ReactNode }) {
  const w = big ? Math.round(PIN * 1.25) : PIN;
  const h = pieceHeight(w);
  // An edge about 2px wide at any size, outside the shape (the fill is drawn over its inner half).
  const edge = (2.4 * PIECE_VIEWBOX.width) / w * 2;
  return (
    <span className="relative block transition-[width,height] duration-150" style={{ width: w, height: h,
      filter: halo ? 'drop-shadow(0 0 2px #fff) drop-shadow(0 0 2px #fff) drop-shadow(0 1px 3px rgb(0 0 0 / .5))' : 'drop-shadow(0 1px 2px rgb(0 0 0 / .45))' }}>
      <svg viewBox={`${-edge} ${-edge} ${PIECE_VIEWBOX.width + edge * 2} ${PIECE_VIEWBOX.height + edge * 2}`} className="absolute inset-0 size-full overflow-visible" aria-hidden="true">
        <path d={PIECE_PATH} fill={done ? 'var(--ink)' : 'var(--signal)'} stroke={done ? '#fff' : 'var(--ink)'} strokeWidth={edge} strokeLinejoin="round" style={{ paintOrder: 'stroke' }} />
      </svg>
      <span className={'absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center text-[10px] font-black leading-none ' + (done ? 'text-signal' : 'text-ink')}
        style={{ left: `${PIECE_SPOT.x * 100}%`, top: `${PIECE_SPOT.y * 100}%` }}>{children}</span>
    </span>
  );
}
