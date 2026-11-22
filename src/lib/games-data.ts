import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { STARTER_GAMES, type Game } from '@/data/games';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from './supabase/config';
import { gameFromRow } from './game-row';

/** The cache tag for the games list. Changing a game refreshes it (slice 2 on, docs/games.md). */
export const GAMES_TAG = 'games';

/**
 * Every game in the village, from the database (docs/games.md, slice 1). Anything a game's row is missing comes
 * from src/data/games.ts, so the site looks the same before and after 20261130000000 is run, and a database
 * that can't be reached never takes the site down. Cached for days; changing a game refreshes it (GAMES_TAG).
 */
export async function getGames(): Promise<Game[]> {
  'use cache';
  cacheTag(GAMES_TAG);
  // Days, not hours: every page's shell reads this, and games rarely change. Changing one refreshes the tag.
  cacheLife('days');
  if (!supabaseConfigured) return STARTER_GAMES;
  try {
    const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { data, error } = await db.from('games').select('*');
    if (error || !data) return STARTER_GAMES;
    const starters = new Map(STARTER_GAMES.map((g) => [g.id, g]));
    const fromDb = data.flatMap((r) => { const g = gameFromRow(r, starters.get(r.id as string)); return g ? [g] : []; });
    // A starter game the database doesn't have yet still shows.
    const missing = STARTER_GAMES.filter((g) => !data.some((r) => r.id === g.id));
    return [...fromDb, ...missing].sort((a, b) => a.popularity - b.popularity || a.title.localeCompare(b.title));
  } catch {
    return STARTER_GAMES;
  }
}

/** One game by its address, or undefined. */
export async function findGame(id: string): Promise<Game | undefined> {
  return (await getGames()).find((g) => g.id === id);
}
