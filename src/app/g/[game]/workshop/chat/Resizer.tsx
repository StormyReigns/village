'use client';

import { useRef } from 'react';

/**
 * A handle between two columns on wide screens: drag it to make a column wider or narrower, like a
 * column in a spreadsheet. Arrow keys work too, and a double click puts it back to the usual width.
 * Used between the chat and the work column, and between an editor and its preview (EditorShell).
 */
export function Resizer({ value, measure, onWidth, limits, onReset, label = 'Chat width', grow = 1, className = 'relative -mx-3 hidden w-2 shrink-0 lg:block', style }: {
  /** The column's width now, for screen readers (0 before it's known). */
  value: number;
  /** The column's width right now, in pixels. */
  measure: () => number;
  onWidth: (px: number) => void;
  /** The narrowest and widest the column may be right now. */
  limits: () => { min: number; max: number };
  onReset: () => void;
  /** What a screen reader calls it. */
  label?: string;
  /** 1: the column is on the left, so dragging right widens it. -1: it's on the right. */
  grow?: 1 | -1;
  /** Where the handle sits and when it shows. */
  className?: string;
  style?: React.CSSProperties;
}) {
  const start = useRef<{ x: number; w: number } | null>(null);
  const clamp = (px: number) => { const { min, max } = limits(); return Math.round(Math.min(max, Math.max(min, px))); };
  return (
    <div role="separator" aria-orientation="vertical" aria-label={`${label}: drag, or use the arrow keys`} tabIndex={0}
      aria-valuenow={value || undefined}
      className={'group/resize cursor-col-resize touch-none outline-none ' + className} style={style}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); start.current = { x: e.clientX, w: measure() }; }}
      onPointerMove={(e) => { if (start.current) onWidth(clamp(start.current.w + grow * (e.clientX - start.current.x))); }}
      onPointerUp={() => { start.current = null; }}
      onPointerCancel={() => { start.current = null; }}
      onDoubleClick={onReset}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); onWidth(clamp(measure() + grow * (e.key === 'ArrowRight' ? 24 : -24))); }
      }}>
      {/* A thin line that shows on hover, with a grip in the middle. */}
      <span className="absolute inset-y-2 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-transparent transition-colors group-hover/resize:bg-ink/30 group-focus-visible/resize:bg-signal group-active/resize:bg-ink/60" />
      <span className="absolute left-1/2 top-1/2 h-10 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink/15 transition-colors group-hover/resize:bg-ink/50" />
    </div>
  );
}
