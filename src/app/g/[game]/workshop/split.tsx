'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

// On a phone, builder screens split in two: what you're filling in on top (on the Workbench,
// see globals.css), and the preview underneath on a sheet that looks exactly like the app.
// Drag the sheet's handle to give either side more room. In a wide enough box they sit side by side.

/** The sheet's height on a phone, in percent of the screen: the default, and its limits. */
export const SHEET = { start: 46, min: 9, max: 85 } as const;

/**
 * The sheet's height, remembered on this device, so every editor opens the preview at the
 * size it was last left at.
 */
export function useSheetSize() {
  // Read after the page has loaded (the server has no saved size), so both agree at first.
  const saved = useSyncExternalStore(noChanges, readSheet, () => null);
  const [chosen, setChosen] = useState<number | null>(null);
  const n = Number(saved);
  const pct = chosen ?? (n >= SHEET.min && n <= SHEET.max ? n : SHEET.start);
  const set = (next: number) => {
    setChosen(next);
    try { localStorage.setItem('village:sheet', String(next)); } catch { /* not remembered this time */ }
  };
  return [pct, set] as const;
}
const noChanges = () => () => {};
const readSheet = () => { try { return localStorage.getItem('village:sheet'); } catch { return null; } };

/** Whether the screen is wide enough (md) for the form and preview to sit side by side. */
export function useWide() {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const md = window.matchMedia('(min-width: 768px)');
    const update = () => setWide(md.matches);
    update();
    md.addEventListener('change', update);
    return () => md.removeEventListener('change', update);
  }, []);
  return wide;
}

/**
 * Whether a box (an editor) is wide enough for its form and preview to sit side by side. It
 * goes by the box, not the screen: beside the Workshop chat an editor can be narrow on a
 * wide screen.
 */
export function useWideBox(ref: React.RefObject<HTMLElement | null>, min = 768) {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const look = new ResizeObserver(([e]) => setWide(e.contentRect.width >= min));
    look.observe(el);
    return () => look.disconnect();
  }, [ref, min]);
  return wide;
}

/** Whether the screen is wide enough (lg) for the Workshop chat to sit beside an editor. */
export function useBeside() {
  const [beside, setBeside] = useState(false);
  useEffect(() => {
    const lg = window.matchMedia('(min-width: 1024px)');
    const update = () => setBeside(lg.matches);
    update();
    lg.addEventListener('change', update);
    return () => lg.removeEventListener('change', update);
  }, []);
  return beside;
}

/**
 * The grab handle on top of the preview sheet (phones only). Drag it up or down to resize;
 * a tap tucks the sheet away or brings it back; arrow keys nudge it. `pct` is the sheet's
 * height as a percent of the element marked `data-split`. While dragging, the sheet (marked
 * `data-sheet`) is resized directly, once per frame, and the new size is kept on release, so
 * the whole screen isn't redrawn on every finger movement.
 */
export function SheetHandle({ pct, onChange, children }: { pct: number; onChange: (pct: number) => void; children?: React.ReactNode }) {
  const drag = useRef<{ y: number; moved: boolean; box: DOMRect; sheet: HTMLElement | null; pct: number; frame: number } | null>(null);
  // Kept to a tenth of a percent, so the sheet follows the finger pixel by pixel.
  const clamp = (n: number) => Math.round(Math.min(SHEET.max, Math.max(SHEET.min, n)) * 10) / 10;
  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button:not([data-handle])')) return;
    const box = e.currentTarget.closest('[data-split]')?.getBoundingClientRect();
    if (!box) return;
    drag.current = { y: e.clientY, moved: false, box, sheet: e.currentTarget.closest<HTMLElement>('[data-sheet]'), pct, frame: 0 };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* the drag still works without it */ }
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (Math.abs(e.clientY - d.y) > 4) d.moved = true;
    if (!d.moved) return;
    d.pct = clamp(((d.box.bottom - e.clientY) / d.box.height) * 100);
    if (!d.sheet) { onChange(d.pct); return; }
    cancelAnimationFrame(d.frame);
    d.frame = requestAnimationFrame(() => { if (d.sheet) d.sheet.style.height = `${d.pct}%`; });
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    cancelAnimationFrame(d.frame);
    onChange(d.moved ? d.pct : pct <= SHEET.min + 2 ? SHEET.start : SHEET.min);
  };
  return (
    <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drag.current = null; }}
      className="flex shrink-0 touch-none select-none flex-col gap-1.5 px-4 pb-2 pt-1.5 @3xl:contents">
      <button type="button" data-handle role="separator" aria-orientation="horizontal" aria-label="Preview size: drag, or use the arrow keys"
        aria-valuenow={Math.round(pct)} aria-valuemin={SHEET.min} aria-valuemax={SHEET.max}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') { e.preventDefault(); onChange(clamp(pct + 8)); }
          if (e.key === 'ArrowDown') { e.preventDefault(); onChange(clamp(pct - 8)); }
        }}
        className="mx-auto h-4 w-16 cursor-row-resize rounded-full @3xl:hidden">
        <span className="mx-auto block h-1.5 w-10 rounded-full bg-ink/25" />
      </button>
      {children}
    </div>
  );
}
