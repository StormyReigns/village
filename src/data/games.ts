// The games in the village: names, dates, colors and routes. Each game's app (its Pages,
// Blocks and entries) lives in the database; see src/lib/app-data.ts.

import type { Route } from '@/data/content/types';

export type GameStatus = 'prelaunch' | 'launch' | 'live';

export interface Game {
  id: string;
  title: string;
  shortTitle: string;
  platform: string;
  releaseDate: string;          // ISO date
  status: GameStatus;
  /** What's coming up for this game, shown on its tile. */
  next?: string;
  /** Hue for this game's accents, from the village palette. */
  hue: 'berry' | 'sky' | 'leaf' | 'sun';
  genre: string;
  /**
   * Cover picture in /public, e.g. '/games/fortunes-weave/cover.webp' (16:9, our own art).
   * Until there is one, the tile shows a colored placeholder.
   */
  cover?: string;
  /** Lower comes first in "Popular right now", until real activity numbers exist. */
  popularity: number;
  /** Games with separate routes or paths: the question and the choices. */
  paths?: { question: string; options: { key: Route; label: string; note: string }[] };
}

export const GAMES: Game[] = [
  {
    id: 'fortunes-weave',
    title: "Fire Emblem: Fortune's Weave",
    shortTitle: "Fortune's Weave",
    platform: 'Nintendo Switch 2',
    releaseDate: '2026-09-17',
    status: 'live',
    paths: {
      question: 'Which Flame Lord are you playing?',
      options: [
        { key: 'cai', label: 'Cai', note: 'Ribeira Winds · Fox' },
        { key: 'dietrich', label: 'Dietrich', note: 'House Lamine · Lion' },
        { key: 'theodora', label: 'Theodora', note: "Megaira's Beacon · Wolf" },
        { key: 'leda', label: 'Leda', note: 'Rose Tempest · Eagle' },
      ],
    },
    next: 'Expansion Pass Wave 2 this holiday',
    hue: 'berry',
    genre: 'Tactics RPG',
    popularity: 1,
  },
  {
    id: 'ocarina-of-time',
    title: 'The Legend of Zelda: Ocarina of Time',
    shortTitle: 'Ocarina of Time',
    platform: 'Nintendo Switch 2',
    releaseDate: '2026-11-05',
    status: 'prelaunch',
    next: 'Workshop opens before launch',
    hue: 'leaf',
    genre: 'Action-adventure',
    popularity: 2,
  },
];

export function getGame(id: string): Game | undefined {
  return GAMES.find((g) => g.id === id);
}

export function daysUntil(isoDate: string, from = new Date()): number {
  const target = new Date(isoDate + 'T00:00:00');
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}
