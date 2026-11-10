import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { appTag } from '@/lib/app-data';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from '@/lib/supabase/config';
import { knownWikiHost, wikiOf, type GameWiki } from '@/lib/wiki';

// The game's wiki, as its moderators saved it (games.wiki, docs/blocks/wiki-links.md), and only
// when it's on a wiki site we know. Refreshed with the app, or hourly.
export async function gameWiki(gameId: string): Promise<GameWiki | null> {
  'use cache';
  cacheTag(appTag(gameId));
  cacheLife('hours');
  if (!supabaseConfigured) return null;
  const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await db.from('games').select('wiki').eq('id', gameId).maybeSingle();
  // Until the wiki column exists (the SQL hasn't run), there's simply no wiki.
  if (error) return null;
  const wiki = wikiOf((data as { wiki?: unknown } | null)?.wiki);
  // A wiki on a site we don't know yet shows no links until we add the site.
  return wiki && knownWikiHost(wiki.api) ? wiki : null;
}
