'use client';

import Link from 'next/link';
import { useState } from 'react';
import { EyeOff } from 'lucide-react';
import type { BlockDef } from '@/lib/blocks';
import { titleField } from '@/lib/blocks';
import type { PlacedCard } from '@/data/content/types';
import { BlockIcon } from './Icon';
import { CardChips } from './CardChips';

/** A compact card for shelves and lists. Opens the card's own page. */
export function MiniCard({ card, block, gameId, showSpoilers, showRoutes, routeLabels, routeLabel, className = '' }: {
  card: PlacedCard;
  block: BlockDef & { label?: string };
  gameId: string;
  showSpoilers: boolean;
  showRoutes: boolean;
  routeLabels: Record<string, string>;
  /** The player's chosen route, e.g. 'Leda': that route's line is shown first. */
  routeLabel?: string;
  className?: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const hidden = card.spoiler && !showSpoilers && !revealed;
  const tf = titleField(block);
  const lines = block.fields
    .filter((f) => f !== tf && card.content[f.key]?.trim())
    .slice(0, 2)
    .map((f) => {
      const all = card.content[f.key].split('\n');
      const mine = routeLabel ? all.find((l) => l.startsWith(routeLabel + ': ')) : undefined;
      return { label: f.label, text: mine ? mine.slice(routeLabel!.length + 2) : all[0] };
    });

  if (hidden) {
    return (
      <button onClick={() => setRevealed(true)} className={'surface grid h-full min-h-40 w-full place-items-center gap-2 rounded-3xl p-4 text-center ' + className}>
        <span className="grid size-10 place-items-center rounded-full bg-card-2 text-muted"><EyeOff size={18} aria-hidden="true" /></span>
        <span className="font-display text-lg">Spoiler</span>
        <span className="text-sm text-muted">Tap to show this {block.title.toLowerCase().replace(/s$/, '')}</span>
      </button>
    );
  }

  return (
    <Link href={`/g/${gameId}/c/${card.slug}`} className={'surface lift flex h-full min-h-40 flex-col rounded-3xl p-4 ' + className}>
      <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted">
        <span className="grid size-6 place-items-center rounded-full bg-leaf-soft text-leaf"><BlockIcon name={block.icon} size={13} /></span>
        {block.label ?? block.title}
      </span>
      <span className="mt-2 font-display text-lg leading-tight">{card.title}</span>
      <span className="mt-2 grid gap-1">
        {lines.map((l) => (
          <span key={l.label} className="line-clamp-2 text-sm"><span className="text-muted">{l.label}: </span>{l.text}</span>
        ))}
      </span>
      <span className="mt-auto pt-3"><CardChips card={card} showRoutes={showRoutes} routeLabels={routeLabels} /></span>
    </Link>
  );
}
