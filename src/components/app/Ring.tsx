import type { Tint } from '@/data/pages';
import { TINT } from './tint';

/** Progress as a ring in the Page's color, with done/total in the middle (Last chances, My run). */
export function Ring({ done, total, tint }: { done: number; total: number; tint: Tint }) {
  const r = 22, c = 2 * Math.PI * r, part = total ? done / total : 0;
  return (
    <span className="relative grid size-14 shrink-0 place-items-center">
      <svg viewBox="0 0 52 52" className={`absolute inset-0 -rotate-90 ${TINT[tint].text}`} aria-hidden="true">
        <circle cx="26" cy="26" r={r} fill="none" stroke="var(--line)" strokeWidth="6" />
        <circle cx="26" cy="26" r={r} fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${c * part} ${c}`} />
      </svg>
      <span className="text-sm font-bold">{done}/{total}</span>
    </span>
  );
}
