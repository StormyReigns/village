'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

/** Fades an edge of a scrolling area when there's more beyond it. */
export function fadeMask(dir: 'vertical' | 'horizontal', start: boolean, end: boolean): React.CSSProperties {
  if (!start && !end) return {};
  const side = dir === 'vertical' ? 'to bottom' : 'to right';
  const a = start ? 'transparent, black 24px' : 'black';
  const b = end ? 'black calc(100% - 32px), transparent' : 'black';
  const mask = `linear-gradient(${side}, ${a}, ${b})`;
  return { maskImage: mask, WebkitMaskImage: mask };
}

/**
 * A list that scrolls up and down inside a block. When there's more below, the bottom
 * fades and a small arrow in the block's color bobs there; tap it to scroll down.
 */
export function ScrollBox({ as: Tag = 'div', className = '', children }: {
  as?: 'div' | 'ul' | 'ol'; className?: string; children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const [more, setMore] = useState({ up: false, down: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setMore({ up: el.scrollTop > 2, down: el.scrollTop + el.clientHeight < el.scrollHeight - 2 });
    update();
    el.addEventListener('scroll', update, { passive: true });
    const sized = new ResizeObserver(update);
    sized.observe(el);
    const changed = new MutationObserver(update);
    changed.observe(el, { childList: true, subtree: true });
    return () => { el.removeEventListener('scroll', update); sized.disconnect(); changed.disconnect(); };
  }, []);

  return (
    <div className="relative">
      <Tag ref={ref as never} className={'overflow-y-auto ' + className} style={fadeMask('vertical', more.up, more.down)}>{children}</Tag>
      {more.down && (
        <button type="button" aria-label="Show more below" onClick={() => ref.current?.scrollBy({ top: ref.current.clientHeight * 0.7, behavior: 'smooth' })}
          className="nudge-down absolute bottom-0 left-1/2 grid size-7 -translate-x-1/2 place-items-center rounded-full bg-card shadow-soft ring-1"
          style={{ color: 'var(--tint, var(--ink))', ['--tw-ring-color' as string]: 'var(--edge, var(--line))' }}>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
