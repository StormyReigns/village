import { cacheLife } from 'next/cache';
import { getGame } from '@/data/games';
import { getApp } from '@/lib/app-data';
import { gameWiki } from '@/lib/wiki-server';
import { choose, knownWikiHost, queryUrl, readAnswer, titlesFor, wikiFixOf, wikiOf, type PageFound, type WikiAnswer } from '@/lib/wiki';

// Where an entry's wiki link goes, asked of the game's wiki itself (its free MediaWiki API, no
// key) and kept for a day (docs/blocks/wiki-links.md). The browser only names a game and an
// entry's card id: the entry's name and the wiki's address are looked up here, so nobody can
// make our server fetch another site or ask the wiki about anything else.

const CARD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Blocks whose entries get a wiki link. */
const LINKED = new Set(['characters', 'items', 'classes', 'collection']);
/** A wiki's answer about a few names is a few kilobytes; anything far bigger isn't one. */
const MAX_ANSWER = 256 * 1024;

/** What the wiki said, or why it couldn't be asked. */
type Asked = { found: [string, PageFound][] } | { error: string };

/**
 * What the wiki says about some page names. An answer (found or missing) is kept for a day; a
 * failure only briefly: a minute when the wiki is down or slow, an hour when it turns our server
 * away (fireemblemwiki.org's Cloudflare blocks server companies like Vercel), since that rarely changes.
 * Failures are returned, not thrown: Next hides a thrown error's message in production.
 */
async function askWiki(api: string, article: string, titles: string[]): Promise<Asked> {
  'use cache';
  const failed = (error: string, blocked = false): Asked => {
    cacheLife(blocked ? { stale: 300, revalidate: 3600, expire: 7200 } : { stale: 30, revalidate: 60, expire: 120 });
    return { error };
  };
  const wiki = wikiOf({ name: 'wiki', api, article });
  // Only a site on our list (src/lib/wiki.ts), checked again here where the request is made.
  if (!wiki || !knownWikiHost(api)) return failed('not a wiki we ask');
  try {
    const res = await fetch(queryUrl(wiki, titles), {
      headers: { accept: 'application/json', 'user-agent': 'Village/1.0 (game companion app; wiki link check)' },
      redirect: 'error',
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return failed(`the wiki answered ${res.status}`, res.status === 403 || res.status === 429);
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

async function answerFor(gameId: string, cardId: string): Promise<WikiAnswer> {
  const wiki = await gameWiki(gameId);
  if (!wiki) return { ok: false, reason: 'no-wiki' };
  for (const page of await getApp(gameId)) {
    for (const block of page.blocks) {
      const entry = block.entries.find((e) => e.ref?.card === cardId);
      if (!entry) continue;
      // A Classes tier's header card isn't a page on the wiki.
      if (!LINKED.has(block.type) || entry.header) return { ok: false, reason: 'off' };
      // A builder's fix for this entry (a Draft): no link, or a page named differently. Checked
      // here, since Draft content isn't checked by the database; anything odd means the usual page.
      const fix = wikiFixOf((entry as { wiki?: unknown }).wiki);
      if (fix === false) return { ok: false, reason: 'off' };
      const titles = fix ? [fix] : titlesFor(entry.name, wiki);
      if (!titles.length) return { ok: false, reason: 'missing' };
      const asked = await askWiki(wiki.api, wiki.article, titles);
      // Turned away or down: the player's browser asks the same wiki the same names (WikiLink.tsx).
      if ('error' in asked) return { ok: false, reason: 'ask', ask: { wiki, titles } };
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
    // (By wiki address, so a moderator's new wiki is asked afresh; this edge copy lasts minutes.)
    return Response.json(answer, { headers: { 'cache-control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=3600' } });
  } catch (e) {
    // Our own side failed (the app's data couldn't load): no link for now, asked again next time.
    const why = e instanceof Error ? e.name : 'unknown';
    console.error(`Wiki check failed for ${game}/${card}: ${why}`);
    return Response.json({ error: 'Couldn’t check the wiki link.', why }, { status: 502, headers: { 'cache-control': 'no-store' } });
  }
}
