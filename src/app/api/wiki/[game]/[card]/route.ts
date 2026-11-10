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

/** What the wiki said, or why it couldn't be asked. */
type Asked = { found: [string, PageFound][] } | { error: string };

/**
 * What the wiki says about some page names. An answer (found or missing) is kept for a day; a
 * failure (the wiki down, slow or turning us away) only for a minute, so links come back soon.
 * Failures are returned, not thrown: Next hides a thrown error's message in production.
 */
async function askWiki(api: string, article: string, titles: string[]): Promise<Asked> {
  'use cache';
  const failed = (error: string): Asked => { cacheLife({ stale: 30, revalidate: 60, expire: 120 }); return { error }; };
  const wiki = wikiOf({ name: 'wiki', api, article });
  // Only a site on our list (src/lib/wiki.ts), checked again here where the request is made.
  if (!wiki || !knownWikiHost(api)) return failed('not a wiki we ask');
  try {
    const res = await fetch(queryUrl(wiki, titles), {
      headers: { accept: 'application/json', 'user-agent': 'Village/1.0 (game companion app; wiki link check)' },
      redirect: 'error',
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return failed(`the wiki answered ${res.status}`);
    const text = await res.text();
    if (text.length > MAX_ANSWER) return failed('the wiki answered too much');
    const found = readAnswer(JSON.parse(text), titles);
    // An answer that says nothing about the names (an error page, a login wall) isn't kept as "missing".
    if (!found.size) return failed("the wiki didn't answer the question");
    cacheLife('days');
    return { found: [...found] };
  } catch (e) {
    return failed(e instanceof Error ? (e.name === 'TimeoutError' ? 'timeout' : `${e.name}: ${e.message}`.slice(0, 120)) : 'unknown');
  }
}

class WikiDown extends Error {}

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
      const asked = await askWiki(wiki.api, wiki.article, titles);
      if ('error' in asked) throw new WikiDown(asked.error);
      return choose(wiki, titles, new Map(asked.found));
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
  } catch (e) {
    // The wiki is down or slow: no link for now, asked again next time. A few words on why
    // (our own messages, or the kind of error) help tell a slow wiki from one that turns us away.
    const why = e instanceof WikiDown ? e.message : e instanceof Error ? e.name : 'unknown';
    console.error(`Wiki check failed for ${game}/${card}: ${why}`);
    return Response.json({ error: 'Couldn’t reach the wiki.', why }, { status: 502, headers: { 'cache-control': 'no-store' } });
  }
}
