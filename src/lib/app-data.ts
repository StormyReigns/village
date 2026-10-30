import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import type { Block, Entry, EntryContent, Page } from '@/data/pages';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from './supabase/config';

type Row = Record<string, unknown>;

/** The cache tag for a game's app. Publishing a Draft refreshes it (see src/app/actions.ts). */
export const appTag = (gameId: string) => `app:${gameId}`;

/**
 * A game's app: its Pages, their Blocks, and each entry's Stable revision. Cached, so
 * pages stay fast and prerendered; refreshed when a moderator publishes, and hourly
 * in case anything changed another way.
 */
export async function getApp(gameId: string): Promise<Page[]> {
  'use cache';
  cacheTag(appTag(gameId));
  cacheLife('hours');
  if (!supabaseConfigured) return [];

  const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const [p, b, e] = await Promise.all([
    db.from('app_pages').select('page_key, title, short, icon, tint, blurb').eq('game_id', gameId).order('position'),
    db.from('game_blocks').select('*')
      .eq('game_id', gameId).not('page_key', 'is', null).order('position'),
    db.from('card_pointers')
      .select('card:cards!inner(id, game_id, block_key, slug, position), revision:card_revisions(id, content)')
      .eq('channel', 'stable').eq('card.game_id', gameId).limit(1000),
  ]);
  const err = p.error ?? b.error ?? e.error;
  if (err) throw new Error(`Couldn't load the ${gameId} app: ${err.message}`);

  const entries = new Map<string, (Entry & { position: number })[]>();
  for (const r of (e.data ?? []) as Row[]) {
    const card = r.card as Row, rev = r.revision as Row;
    const list = entries.get(card.block_key as string) ?? [];
    list.push({
      ...(rev.content as EntryContent),
      id: card.slug as string,
      ref: { card: card.id as string, revision: rev.id as number },
      position: card.position as number,
    });
    entries.set(card.block_key as string, list);
  }

  const blocks = new Map<string, Block[]>();
  for (const r of (b.data ?? []) as Row[]) {
    const list = blocks.get(r.page_key as string) ?? [];
    list.push({
      id: r.block_key as string,
      type: r.type as Block['type'],
      title: r.title as string,
      icon: r.icon as string,
      look: (r.look as Block['look']) ?? undefined,
      intro: (r.intro as string) ?? undefined,
      filters: (r.filters as string[])?.length ? (r.filters as string[]) : undefined,
      byRoute: Boolean(r.by_route),
      statName: (r.stat_name as string) ?? undefined,
      stats: (r.stats as Block['stats']) ?? undefined,
      symbols: (r.symbols as Block['symbols']) ?? undefined,
      fields: (r.fields as Block['fields']) ?? undefined,
      entries: (entries.get(r.block_key as string) ?? []).sort((x, y) => x.position - y.position).map((x) => { const entry: Entry & { position?: number } = { ...x }; delete entry.position; return entry; }),
    });
    blocks.set(r.page_key as string, list);
  }

  return ((p.data ?? []) as Row[]).map((r) => ({
    id: r.page_key as string,
    title: r.title as string,
    short: r.short as string,
    icon: r.icon as string,
    tint: r.tint as Page['tint'],
    blurb: r.blurb as string,
    blocks: blocks.get(r.page_key as string) ?? [],
  }));
}
