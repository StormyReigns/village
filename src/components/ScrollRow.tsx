'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { fadeMask } from './ScrollBox';

/**
 * A sideways-scrolling row (chips, blocks, cards). Touchscreens swipe it; with a mouse,
 * the wheel scrolls it sideways and arrow buttons appear at whichever end has more.
 * Either way, the edge with more beyond it fades, so it's clear there's more to see.
 * `touchArrows` shows the arrows on touchscreens too, and `progress` adds a small bar under
 * the row that shows how much there is and how far along you are (the Items shelf).
 */
export function ScrollRow({ as: Tag = 'div', className = '', label, role, touchArrows = false, progress = false, children }: {
  as?: 'div' | 'ul' | 'ol' | 'nav'; className?: string; label?: string; role?: string;
  touchArrows?: boolean; progress?: boolean; children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const [more, setMore] = useState({ left: false, right: false });
  // How much of the row is in view (0 to 1), and how far along it is scrolled (0 to 1).
  const [along, setAlong] = useState({ seen: 1, at: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      setMore({ left: el.scrollLeft > 2, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
      const room = el.scrollWidth - el.clientWidth;
      setAlong({ seen: Math.min(1, el.clientWidth / Math.max(1, el.scrollWidth)), at: room > 0 ? el.scrollLeft / room : 0 });
    };
    // A vertical wheel moves the row sideways. Only once the row is at its end in that
    // direction does the wheel go back to scrolling the page.
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const step = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientWidth : 1);
      const room = step > 0 ? el.scrollWidth - el.clientWidth - el.scrollLeft : el.scrollLeft;
      if (room < 1) return;
      e.preventDefault();
      el.scrollLeft += step;
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
  const arrow = 'absolute top-1/2 z-10 size-9 -translate-y-1/2 place-items-center rounded-full bg-card text-ink shadow-soft ring-1 ring-line hover:ring-ink '
    + (touchArrows ? 'grid' : 'hidden pointer-fine:grid');

  return (
    // min-w-0: inside a grid or flex column the row scrolls, rather than widening the column.
    <div className="relative min-w-0">
      <Tag ref={ref as never} aria-label={label} role={role} className={'chip-strip overflow-x-auto ' + className} style={fadeMask('horizontal', more.left, more.right)}>{children}</Tag>
      {more.left && <button type="button" onClick={() => go(-1)} aria-label="Scroll left" className={arrow + ' -left-2'}><ChevronLeft size={18} aria-hidden="true" /></button>}
      {more.right && <button type="button" onClick={() => go(1)} aria-label="Scroll right" className={arrow + ' -right-2'}><ChevronRight size={18} aria-hidden="true" /></button>}
      {progress && along.seen < 1 && (
        <div aria-hidden="true" className="mx-auto mt-1.5 h-1.5 w-20 overflow-hidden rounded-full bg-ink/10">
          <div className="h-full rounded-full bg-ink/45" style={{ width: `${along.seen * 100}%`, marginLeft: `${along.at * (1 - along.seen) * 100}%` }} />
        </div>
      )}
    </div>
  );
}
