'use client';

import { cloneElement, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * A village-style tooltip: a little block in the trigger's color whose roof points at
 * what it describes. Shows after a short pause on hover or keyboard focus. It's drawn
 * above the page, so scrolling rows and panels can't clip it.
 */
export function Tip({ text, tint = 'ink', className = '', children }: { text: React.ReactNode; tint?: string; className?: string; children: React.ReactNode }) {
  const id = useId();
  const wrap = useRef<HTMLSpanElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<{ x: number; y: number; below: boolean; nose: number } | null>(null);

  const show = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(true), 350); };
  const hide = () => { clearTimeout(timer.current); setOpen(false); setPlace(null); };
  useEffect(() => () => clearTimeout(timer.current), []);

  // Place it under the trigger (or above, near the bottom of the screen), kept on screen.
  useLayoutEffect(() => {
    if (!open || !wrap.current || !bubble.current) return;
    const t = wrap.current.getBoundingClientRect();
    const b = bubble.current.getBoundingClientRect();
    const below = t.bottom + b.height + 16 < window.innerHeight;
    const center = t.left + t.width / 2;
    const x = Math.min(Math.max(8, center - b.width / 2), window.innerWidth - b.width - 8);
    setPlace({ x, y: below ? t.bottom + 12 : t.top - b.height - 12, below, nose: center - x });
  }, [open]);

  const trigger = isValidElement<{ 'aria-describedby'?: string }>(children)
    ? cloneElement(children, { 'aria-describedby': open ? id : undefined })
    : children;

  return (
    <span ref={wrap} className={'inline-flex ' + className} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {trigger}
      {open && createPortal(
        <div ref={bubble} id={id} role="tooltip"
          style={{ '--tint': `var(--${tint})`, left: place?.x ?? -9999, top: place?.y ?? -9999 } as React.CSSProperties}
          className={'tip pointer-events-none fixed z-[70] max-w-60 rounded-2xl px-3 py-2 text-xs font-bold leading-snug ' + (place ? 'tip-in' : 'opacity-0')}>
          <span aria-hidden="true" className={'tip-roof ' + (place?.below === false ? 'tip-roof-down' : '')} style={{ left: place?.nose ?? 0 }} />
          {text}
        </div>,
        document.body,
      )}
    </span>
  );
}
