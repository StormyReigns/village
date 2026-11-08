import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import type { Block, Entry, Page } from '@/data/pages';
import { getApp } from './app-data';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from './supabase/config';
import { fromPlacements, inLimits, tiersOf, titleOf, type MyList, type Tier } from './tiers';

// A shared tier list (docs/blocks/tier-lists.md), read for its page and its share picture. Only a
// list its maker shared can be read (row-level security), so a private list is simply not found.

export interface SharedList {
  page: Page;
  block: Block;
  ranked: Block;
  tiers: Tier[];
  list: MyList;
  /** Entries by id, for the pieces. */
  entries: Map<string, Entry>;
  maker: string;
  /** The list's title: a unique list's own, else the Block's reason ("MVP"). */
  title: string;
  updatedAt: string;
}

/** The made-up list the build uses for the page's shell: never a real list. */
export const NO_LIST = '00000000-0000-0000-0000-000000000000';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getSharedList(gameId: string, listId: string): Promise<SharedList | null> {
  'use cache';
  cacheTag(`tier-list:${listId}`);
  cacheLife('minutes');
  if (!supabaseConfigured || !UUID.test(listId) || listId === NO_LIST) return null;
  const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const head = await db.from('tier_lists').select('id, block_key, profile_id, updated_at, title').eq('id', listId).eq('game_id', gameId).maybeSingle();
  if (head.error || !head.data) return null;
  const blockId = head.data.block_key as string;
  const page = (await getApp(gameId)).find((p) => p.blocks.some((b) => b.id === blockId && b.type === 'tierlist'));
  const block = page?.blocks.find((b) => b.id === blockId);
  const ranked = page?.blocks.find((b) => b.id === block?.tierSetup?.ranks);
  if (!page || !block || !ranked) return null;
  const [p, who] = await Promise.all([
    db.from('tier_placements').select('card_id, tier_key, position, reason').eq('list_id', listId),
    db.from('profiles').select('display_name, username').eq('id', head.data.profile_id as string).maybeSingle(),
  ]);
  const shown = ranked.entries.filter((e) => !e.spoiler && inLimits(e, block.tierSetup));
  const idOf = new Map(shown.flatMap((e) => (e.ref ? [[e.ref.card, e.id] as const] : [])));
  const list = fromPlacements((p.data ?? []) as { card_id: string; tier_key: string; position: number; reason: string | null }[], (c) => idOf.get(c));
  const name = (who.data?.display_name as string | undefined)?.trim() || (who.data?.username as string | undefined) || 'A villager';
  return {
    page, block, ranked, tiers: tiersOf(block.tierSetup), list,
    entries: new Map(shown.map((e) => [e.id, e])), maker: name, title: (head.data.title as string | null) ?? titleOf(block.tierSetup), updatedAt: head.data.updated_at as string,
  };
}
