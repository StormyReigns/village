import { cacheLife, cacheTag } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { getGame } from '@/data/games';
import { appTag, getApp } from '@/lib/app-data';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from '@/lib/supabase/config';
import { choose, knownWikiHost, queryUrl, readAnswer, titlesFor, wikiOf, type GameWiki, type PageFound, type WikiAnswer } from '@/lib/wiki';

// Where an entry's wiki link goes, asked of the game's wiki itself (its free MediaWiki API, no
// key) and kept for a day (docs/blocks/wiki-links.md). The browser only names a game and an
// entry's card id: the entry's name and the wiki's address are looked up here, so nobody can
// make our server fetch another site or ask the wiki about anything else.

const CARD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Blocks whose entries get a wiki link. */
const LINKED = new Set(['characters', 'items', 'collection']);
/** A wiki's answer about a few names is a few kilobytes; anything far bigger isn't one. */
const MAX_ANSWER = 256 * 1024;

/** The game's wiki, as its moderators saved it. Refreshed with the app, or hourly. */
async function gameWiki(gameId: string): Promise<GameWiki | null> {
  'use cache';
  cacheTag(appTag(gameId));
  cacheLife('hours');
  if (!supabaseConfigured) return null;
  const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await db.from('games').select('wiki').eq('id', gameId).maybeSingle();
  // Until the wiki column exists (the SQL hasn't run), there's simply no wiki.
  if (error) return null;
  return wikiOf((data as { wiki?: unknown } | null)?.wiki);
}

/** What the wiki says about some page names. Kept for a day; a wiki that's down throws, so nothing is kept. */
async function askWiki(api: string, article: string, titles: string[]): Promise<[string, PageFound][]> {
  'use cache';
  cacheLife('days');
  const wiki = wikiOf({ name: 'wiki', api, article });
  // Only a site on our list (src/lib/wiki.ts), checked again here where the request is made.
  if (!wiki || !knownWikiHost(api)) throw new Error('Not a wiki we ask');
  const res = await fetch(queryUrl(wiki, titles), {
    headers: { accept: 'application/json', 'user-agent': 'Village/1.0 (game companion app; wiki link check)' },
    redirect: 'error',
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`The wiki answered ${res.status}`);
  const text = await res.text();
  if (text.length > MAX_ANSWER) throw new Error('The wiki answered too much');
  const found = readAnswer(JSON.parse(text), titles);
  // An answer that says nothing about the names (an error page, a login wall) isn't kept as "missing".
  if (!found.size) throw new Error("The wiki didn't answer the question");
  return [...found];
}

async function answerFor(gameId: string, cardId: string): Promise<WikiAnswer> {
  const wiki = await gameWiki(gameId);
  // A wiki on a site we don't know yet shows no links until we add the site.
  if (!wiki || !knownWikiHost(wiki.api)) return { ok: false, reason: 'no-wiki' };
  for (const page of await getApp(gameId)) {
    for (const block of page.blocks) {
      const entry = block.entries.find((e) => e.ref?.card === cardId);
      if (!entry) continue;
      if (!LINKED.has(block.type)) return { ok: false, reason: 'off' };
      const titles = titlesFor(entry.name, wiki);
      if (!titles.length) return { ok: false, reason: 'missing' };
      const found = new Map(await askWiki(wiki.api, wiki.article, titles));
      return choose(wiki, titles, found);
    }
  }
  return { ok: false, reason: 'missing' };
}

export async function GET(_req: Request, ctx: RouteContext<'/api/wiki/[game]/[card]'>) {
  const { game, card } = await ctx.params;
  if (!getGame(game) || !CARD_ID.test(card)) return Response.json({ ok: false, reason: 'missing' } satisfies WikiAnswer, { status: 400 });
  try {
    const answer = await answerFor(game, card);
    // Short at the edge, so a renamed entry or a new wiki shows within the hour; the wiki's own
    // answer is kept for a day above.
    return Response.json(answer, { headers: { 'cache-control': 'public, max-age=600, s-maxage=3600, stale-while-revalidate=86400' } });
  } catch {
    // The wiki is down or slow: no link for now, asked again next time.
    return Response.json({ error: 'Couldn’t reach the wiki.' }, { status: 502 });
  }
}
