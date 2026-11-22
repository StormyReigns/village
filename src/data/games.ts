// What a game is (names, dates, colors and routes), and the starter games. Games live in the database
// (src/lib/games-data.ts, docs/games.md): read them with getGames / findGame on the server, or useGames /
// useGame in the browser (src/components/GamesProvider.tsx). The list below is the fallback for anything a game's
// row doesn't have yet, and was copied into the database by 20261130000000_games_in_db.sql. Each game's app (its
// Pages, Blocks and entries) lives in the database too; see src/lib/app-data.ts.

import type { Route } from '@/data/content/types';
import type { Shade } from '@/lib/shades';

/** 'building': started by a Builder, its Workshop open, not launched for players yet (docs/games.md). */
export type GameStatus = 'building' | 'prelaunch' | 'launch' | 'live';

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
  /** How the genre shades the Page colors and corners (src/lib/shades.ts). Standard if unset. */
  shade?: Shade;
  /**
   * Cover picture in /public, e.g. '/games/fortunes-weave/cover.webp' (16:9, our own art).
   * Until there is one, the tile shows a colored placeholder.
   */
  cover?: string;
  /** Lower comes first in "Popular right now", until real activity numbers exist. */
  popularity: number;
  /** Games with separate routes or paths: the question and the choices. */
  paths?: { question: string; options: { key: Route; label: string; note: string }[] };
  /** Page addresses that have moved, old → new, so old links and bookmarks still land. */
  movedPages?: Record<string, string>;
}

/** The two launch games, as they were before games moved to the database: the fallback, never the list to read. */
export const STARTER_GAMES: Game[] = [
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
    shade: 'fantasy',
    popularity: 1,
    // Classes got a Page of its own (2026-11-11); class entries are found wherever they are now.
    movedPages: { 'units-and-classes': 'units' },
  },
  {
    id: 'ocarina-of-time',
    title: 'The Legend of Zelda: Ocarina of Time',
    shortTitle: 'Ocarina of Time',
    platform: 'Nintendo Switch 2',
    releaseDate: '2026-11-05',
    status: 'prelaunch',
    next: 'The Workshop is open: help build it before launch',
    hue: 'leaf',
    genre: 'Action-adventure',
    shade: 'fantasy',
    popularity: 2,
  },
];


/** The games players see listed (the front page, search, share pictures): not ones still being built. */
export const listed = (games: Game[]) => games.filter((g) => g.status !== 'building');

export function daysUntil(isoDate: string, from = new Date()): number {
  const target = new Date(isoDate + 'T00:00:00');
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}
