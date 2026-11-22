'use server';

import { updateTag } from 'next/cache';
import { serverClient } from '@/lib/supabase/server';
import { appTag } from '@/lib/app-data';
import { GAMES_TAG } from '@/lib/games-data';

/**
 * Refreshes a game's app right after a moderator publishes. Only moderators of that
 * game can trigger it; anyone else is ignored.
 */
export async function appChanged(gameId: string) {
  const db = await serverClient();
  if (!db) return;
  const { data: { user } } = await db.auth.getUser();
  if (!user) return;
  const { data: isMod } = await db.rpc('is_moderator', { g: gameId });
  if (isMod) updateTag(appTag(gameId));
}

/**
 * Refreshes the games list right after someone starts a game (docs/games.md, slice 2), so its Workshop and app
 * home know it at once. Only that game's moderators (its starter) can trigger it; anyone else is ignored.
 */
export async function gamesChanged(gameId: string) {
  const db = await serverClient();
  if (!db) return;
  const { data: { user } } = await db.auth.getUser();
  if (!user) return;
  const { data: isMod } = await db.rpc('is_moderator', { g: gameId });
  if (isMod) { updateTag(GAMES_TAG); updateTag(appTag(gameId)); }
}
