import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { Crown, Trophy } from 'lucide-react';
import { tierFill, type Tier } from '@/lib/tiers';

// The look of a tier list board (docs/blocks/tier-lists.md), shared by the Tier list Block and a
// shared list's page: an ink header with the list's title, then the tiers as one card of rows,
// each a colored letter tab on a light wash of its color. Works in server and client components.

/** The whole board: header and rows in one card. */
export function BoardCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={'overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-line ' + className}>{children}</div>;
}

/** The ink header: a trophy, the list's title ("MVP"), a line under it, and a chip on the right. */
export function BoardHead({ title, sub, chip }: { title: string; sub?: ReactNode; chip?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 bg-ink px-3 py-2.5 text-white">
      <span className="grid size-10 shrink-0 -rotate-6 place-items-center rounded-xl bg-signal text-ink shadow-sm">
        <Trophy size={20} strokeWidth={2.4} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xl font-extrabold leading-tight tracking-tight">{title}</p>
        {sub && <p className="line-clamp-2 text-xs leading-snug text-white/70">{sub}</p>}
      </div>
      {chip && <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold">{chip}</span>}
    </div>
  );
}

/** A tier's letter tab: the best tier in the full Page color, fading down; the top tier wears a crown. */
export function TierTab({ t, i, n, color }: { t: Tier; i: number; n: number; color: string }) {
  const f = tierFill(i, n, color);
  return (
    <span className="relative grid w-10 shrink-0 place-items-center self-stretch rounded-xl px-1 text-center font-extrabold leading-none sm:w-14"
      style={{ background: f.background, color: f.white ? '#fff' : 'var(--ink)', fontSize: t.label.length <= 2 ? '1.65rem' : '0.75rem' }}>
      {i === 0 && (
        <Crown size={15} strokeWidth={2.6} aria-hidden="true" className="absolute left-0.5 top-0.5 -rotate-12 fill-signal text-ink" />
      )}
      {t.label}
    </span>
  );
}

/** One tier's row. `compact` keeps it short (an empty board); `glow` is a drop target ('on' while dragging over it). */
export function TierRow({ t, i, n, color, compact = false, glow, children, className = '', style, ...rest }: {
  t: Tier; i: number; n: number; color: string; compact?: boolean; glow?: 'target' | 'on'; children?: ReactNode;
} & HTMLAttributes<HTMLDivElement> & { 'data-tier'?: string }) {
  const ring = glow === 'on' ? 'inset 0 0 0 3px var(--signal)' : glow === 'target' ? 'inset 0 0 0 2px color-mix(in srgb, var(--signal) 70%, transparent)' : undefined;
  return (
    <div {...rest} className={'flex gap-2 border-t border-line/70 px-1.5 py-1 transition-shadow ' + (compact ? 'min-h-11 ' : 'min-h-[4.6rem] ') + (glow ? 'cursor-pointer ' : '') + className}
      style={{ background: tierFill(i, n, color).wash, boxShadow: ring, ...style } as CSSProperties}>
      <TierTab t={t} i={i} n={n} color={color} />
      <ul className="flex min-w-0 flex-1 flex-wrap content-center items-start gap-x-1">{children}</ul>
    </div>
  );
}
