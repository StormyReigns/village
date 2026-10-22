'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * A sideways-scrolling row (chips, blocks, cards). Touchscreens swipe it; with a mouse,
 * the wheel scrolls it sideways and arrow buttons appear at whichever end has more.
 */
export function ScrollRow({ as: Tag = 'div', className = '', label, role, children }: {
  as?: 'div' | 'ul' | 'ol' | 'nav'; className?: string; label?: string; role?: string; children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const [more, setMore] = useState({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setMore({ left: el.scrollLeft > 2, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
    // A vertical wheel moves the row sideways, until the row reaches its end.
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || el.scrollWidth <= el.clientWidth) return;
      const before = el.scrollLeft;
      el.scrollLeft += e.deltaY;
      if (el.scrollLeft !== before) e.preventDefault();
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    el.addEventListener('wheel', onWheel, { passive: false });
    const seen = new ResizeObserver(update);
    seen.observe(el);
    return () => { el.removeEventListener('scroll', update); el.removeEventListener('wheel', onWheel); seen.disconnect(); };
  }, []);

  const go = (dir: 1 | -1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };
  const arrow = 'absolute top-1/2 z-10 hidden size-9 -translate-y-1/2 place-items-center rounded-full bg-card text-ink shadow-soft ring-1 ring-line hover:ring-ink pointer-fine:grid';

  return (
    <div className="relative">
      <Tag ref={ref as never} aria-label={label} role={role} className={'chip-strip overflow-x-auto ' + className}>{children}</Tag>
      {more.left && <button type="button" onClick={() => go(-1)} aria-label="Scroll left" className={arrow + ' -left-2'}><ChevronLeft size={18} aria-hidden="true" /></button>}
      {more.right && <button type="button" onClick={() => go(1)} aria-label="Scroll right" className={arrow + ' -right-2'}><ChevronRight size={18} aria-hidden="true" /></button>}
    </div>
  );
}
