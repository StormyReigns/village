'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

/**
 * A small box that floats beside a button (the reaction picker, a message's "…" menu), over
 * the chat rather than inside it. It opens below the button, or above when there's no room,
 * stays on screen, and closes on a click anywhere else, on Escape, or when the chat scrolls.
 */
export function Popover({ anchor, open, onClose, align = 'end', label, children }: {
  anchor: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  /** Line up with the button's left edge ('start') or right edge ('end'). */
  align?: 'start' | 'end';
  label: string;
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);

  // Place it once it's drawn and its size is known.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const a = anchor.current?.getBoundingClientRect(), b = box.current?.getBoundingClientRect();
      if (!a || !b) return;
      const gap = 6, edge = 8;
      const below = a.bottom + gap + b.height <= window.innerHeight - edge;
      const top = Math.min(window.innerHeight - b.height - edge, below ? a.bottom + gap : Math.max(edge, a.top - gap - b.height));
      const left = Math.min(Math.max(edge, align === 'end' ? a.right - b.width : a.left), window.innerWidth - b.width - edge);
      setAt({ top, left });
    };
    place();
    // "More" makes the picker taller: place it again when its size changes.
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
    if (box.current) ro?.observe(box.current);
    return () => ro?.disconnect();
  }, [open, anchor, align]);

  // Focus moves into the box when it opens, and back to its button when it closes, unless
  // you've already clicked something else.
  useEffect(() => {
    if (!open) return;
    const button = anchor.current, el = box.current;
    requestAnimationFrame(() => el?.querySelector<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])')?.focus({ preventScroll: true }));
    return () => {
      if (document.activeElement === document.body || el?.contains(document.activeElement)) button?.focus({ preventScroll: true });
    };
  }, [open, anchor]);

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!box.current?.contains(t) && !anchor.current?.contains(t)) onClose();
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    const scroll = (e: Event) => { if (!box.current?.contains(e.target as Node)) onClose(); };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', key, true);
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', key, true);
      window.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', onClose);
    };
  }, [open, onClose, anchor]);

  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div ref={box} role="dialog" aria-label={label}
      className="fixed z-[80] rounded-2xl bg-card p-1 text-ink shadow-soft ring-1 ring-line"
      style={at ? { top: at.top, left: at.left } : { top: 0, left: 0, visibility: 'hidden' }}>
      {children}
    </div>,
    document.body,
  );
}
