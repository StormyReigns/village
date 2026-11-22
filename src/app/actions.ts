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

/**
 * After a vote or a moderator's "Launch now" / "Take it down" (docs/games.md, slice 3): if the game is no longer
 * waiting to launch, refresh the games list so the front page shows it (or stops showing it). Anyone can ask; it
 * only refreshes when the game really has changed.
 */
export async function gameLaunchCheck(gameId: string) {
  const db = await serverClient();
  if (!db || !/^[a-z0-9-]{2,48}$/.test(gameId)) return;
  const { data } = await db.from('games').select('status').eq('id', gameId).maybeSingle();
  if (!data || data.status !== 'draft') { updateTag(GAMES_TAG); updateTag(appTag(gameId)); }
}
