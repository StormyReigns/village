'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { getGame } from '@/data/games';
import { shadeVars } from '@/lib/shades';

/**
 * Holds one game's screens and gives them its genre shade (Page colors and corners as CSS
 * variables). Scoped to this element, not the whole page, because Next keeps the last
 * screen alive in the background after you leave, and its shade must not follow you.
 */
export function GameShade({ children, className = '' }: { children: ReactNode; className?: string }) {
  const { game } = useParams<{ game: string }>();
  return <div className={className} style={shadeVars(getGame(game)?.shade) as CSSProperties}>{children}</div>;
}
