'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

// On a phone, builder screens split in two: what you're filling in on top, the preview
// underneath, each scrolling on its own. These are the shared pieces of that split.

/** How much of the screen the preview takes on a phone: half, most, or just its bar. */
export type Split = 'half' | 'big' | 'small';

/** Height classes for the preview pane on a phone (it sits beside the form from md up). */
export const splitHeight = (s: Split) => (s === 'big' ? 'h-[68%]' : s === 'small' ? 'h-auto' : 'h-[46%]');

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

/** The button on the preview's bar (phones only) that steps it through its three sizes. */
export function SplitToggle({ split, onChange }: { split: Split; onChange: (s: Split) => void }) {
  return (
    <button type="button" onClick={() => onChange(split === 'half' ? 'big' : split === 'big' ? 'small' : 'half')}
      aria-label={split === 'half' ? 'Make the preview bigger' : split === 'big' ? 'Tuck the preview away' : 'Show the preview'}
      className="grid size-7 shrink-0 place-items-center rounded-full bg-card-2 ring-1 ring-line md:hidden">
      {split === 'big' ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronUp size={15} aria-hidden="true" />}
    </button>
  );
}
