// Starter cards for each game, until cards live in the database. Each card gets a stable
// address (its slug) from its block and title.

import { BLOCKS, titleField } from '@/lib/blocks';
import type { Card, PlacedCard } from './types';
import { CARDS as FORTUNES_WEAVE } from './fortunes-weave';

export type { Card, PlacedCard, Route } from './types';

const BY_GAME: Record<string, Card[]> = {
  'fortunes-weave': FORTUNES_WEAVE,
};

function slugify(s: string) {
  return s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-');
}

const placed = new Map<string, PlacedCard[]>();

export function cardsFor(gameId: string): PlacedCard[] {
  if (!placed.has(gameId)) {
    const seen = new Set<string>();
    placed.set(gameId, (BY_GAME[gameId] ?? []).map((c) => {
      const title = c.content[titleField(BLOCKS[c.block]).key] ?? 'Untitled';
      let slug = slugify(title) || c.block;
      if (seen.has(slug)) slug = `${slug}-${c.block}`;
      seen.add(slug);
      return { ...c, title, slug };
    }));
  }
  return placed.get(gameId)!;
}

export function cardFor(gameId: string, slug: string): PlacedCard | undefined {
  return cardsFor(gameId).find((c) => c.slug === slug);
}
