// The games in the village. Until the database is connected, this file is the source
// of truth for which games exist and which blocks they use; later it seeds the
// `games` and `game_blocks` tables.
//
// Cards (the actual facts) are not seeded here on purpose: they should come from the
// community and verified sources, in our own words, not from copied wiki text.

import { BLOCKS, PRESETS, type BlockDef } from '@/lib/blocks';

export type GameStatus = 'prelaunch' | 'launch' | 'live';

export interface Game {
  id: string;
  title: string;
  shortTitle: string;
  platform: string;
  releaseDate: string;          // ISO date
  status: GameStatus;
  preset: keyof typeof PRESETS;
  /** Per-game names for blocks, e.g. "Units" instead of "People". */
  blockTitles?: Record<string, string>;
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
}

export const GAMES: Game[] = [
  {
    id: 'fortunes-weave',
    title: "Fire Emblem: Fortune's Weave",
    shortTitle: "Fortune's Weave",
    platform: 'Nintendo Switch 2',
    releaseDate: '2026-09-17',
    status: 'live',
    preset: 'tactics-rpg',
    blockTitles: { progress: 'Chapters', people: 'Units', builds: 'Classes and builds' },
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
    preset: 'action-adventure',
    blockTitles: { progress: 'Dungeons', collections: 'Hearts and Skulltulas' },
    next: 'Workshop opens before launch',
    hue: 'leaf',
    genre: 'Action-adventure',
    popularity: 2,
  },
];

export function getGame(id: string): Game | undefined {
  return GAMES.find((g) => g.id === id);
}

export interface GameBlock extends BlockDef {
  /** The name this game uses for the block. */
  label: string;
}

export function blocksFor(game: Game): GameBlock[] {
  return PRESETS[game.preset].map((key) => ({
    ...BLOCKS[key],
    label: game.blockTitles?.[key] ?? BLOCKS[key].title,
  }));
}

export function daysUntil(isoDate: string, from = new Date()): number {
  const target = new Date(isoDate + 'T00:00:00');
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}
