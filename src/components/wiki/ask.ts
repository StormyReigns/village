'use client';

import { useEffect, useState } from 'react';
import { apiCandidates, askOf, choose, classify, inBatches, knownWikiHost, linksUrl, queryUrl, readAnswer, readLinks, readSiteinfo, searchUrl, siteinfoUrl, titlesFor, toTitle, wikiFixOf, wikiOf, type GameWiki, type PageFound, type WikiAnswer, type WikiAsk, type WikiCheck } from '@/lib/wiki';

// Asking a game's wiki from the browser (docs/blocks/wiki-links.md): when the wiki turns our
// server away, and in the Workshop while a builder types. Only a known wiki site (the one our
// server says the game has), at most two page names that pass the page-name check, no login and
// no referrer. Answers are remembered on the device for a day.

const DAY = 86_400_000;

function remembered(key: string): WikiAnswer | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { at, a } = JSON.parse(raw) as { at: number; a: WikiAnswer };
    return Date.now() - at < DAY && a && typeof a === 'object' ? a : null;
  } catch { return null; }
}
function remember(key: string, a: WikiAnswer) {
  try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), a })); } catch { /* private window: fine */ }
}

const inFlight = new Map<string, Promise<WikiAnswer | null>>();

/** The browser asks the wiki itself. Null when it couldn't be reached (asked again next time). */
export function askFromBrowser(raw: WikiAsk): Promise<WikiAnswer | null> {
  const ask = askOf(raw);
  if (!ask) return Promise.resolve(null);
  const key = `wiki:${ask.wiki.api}:${ask.titles.join('|')}`;
  const kept = remembered(key);
  if (kept) return Promise.resolve(kept);
  let p = inFlight.get(key);
  if (!p) {
    p = (async () => {
      try {
        const r = await fetch(queryUrl(ask.wiki, ask.titles, true), {
          credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(6000),
        });
        if (!r.ok) return null;
        const found = readAnswer(await r.json(), ask.titles);
        if (!found.size) return null;
        const a = choose(ask.wiki, ask.titles, found);
        remember(key, a);
        return a;
      } catch { return null; }
    })();
    inFlight.set(key, p);
    p.finally(() => inFlight.delete(key));
  }
  return p;
}

const wikis = new Map<string, Promise<GameWiki | null>>();

/** The game's wiki (from our server), or null if it has none. Undefined while loading. */
export function useGameWiki(gameId: string): GameWiki | null | undefined {
  const [got, setGot] = useState<{ id: string; w: GameWiki | null } | null>(null);
  useEffect(() => {
    let p = wikis.get(gameId);
    if (!p) {
      p = fetch(`/api/wiki/${encodeURIComponent(gameId)}`)
        .then(async (r) => (r.ok ? wikiOf(((await r.json()) as { wiki?: unknown }).wiki) : null))
        .catch(() => null);
      wikis.set(gameId, p);
    }
    let live = true;
    p.then((w) => { if (live) setGot({ id: gameId, w }); });
    return () => { live = false; };
  }, [gameId]);
  return got?.id === gameId ? got.w : undefined;
}

/** Where an entry's link would go, for the Workshop. */
export type WikiPage =
  | { state: 'none' }                                   // the game has no wiki (or it's loading)
  | { state: 'off'; wiki: GameWiki }                    // a builder turned it off for this entry
  | { state: 'checking'; wiki: GameWiki }
  | { state: 'found'; wiki: GameWiki; url: string; title: string }
  | { state: 'missing' | 'which' | 'unreachable'; wiki: GameWiki; search: string; asked?: string };

/** Checks an entry's name (or the builder's fix) against the game's wiki, a moment after typing stops. */
export function useWikiPage(gameId: string, name: string, rawFix: unknown): WikiPage {
  const wiki = useGameWiki(gameId);
  const fix = wikiFixOf(rawFix);
  const fixed = typeof fix === 'string' ? fix : null;
  const titles = wiki && fix !== false ? (fixed ? [fixed] : titlesFor(name, wiki)) : [];
  const key = wiki ? `${wiki.api}|${titles.join('|')}` : '';
  const [answer, setAnswer] = useState<{ key: string; a: WikiAnswer | null } | null>(null);
  useEffect(() => {
    if (!wiki || !titles.length) return;
    let live = true;
    const t = setTimeout(() => askFromBrowser({ wiki, titles }).then((a) => { if (live) setAnswer({ key, a }); }), 400);
    return () => { live = false; clearTimeout(t); };
    // The key covers the wiki and the names.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!wiki) return { state: 'none' };
  if (fix === false) return { state: 'off', wiki };
  const search = searchUrl(wiki, fixed ?? name);
  if (!titles.length) return { state: 'missing', wiki, search };
  if (answer?.key !== key) return { state: 'checking', wiki };
  const a = answer.a;
  if (!a) return { state: 'unreachable', wiki, search };
  if (a.ok) return { state: 'found', wiki, url: a.url, title: a.title };
  return { state: a.reason === 'which' ? 'which' : 'missing', wiki, search, asked: titles[titles.length - 1] };
}

// ---------------------------------------------------------------- the Workshop's wiki list

/** Every entry of a Block checked against the wiki, from the builder's browser, 50 names a question. */
export async function checkEntries(wiki: GameWiki, entries: { id: string; name: string; wiki?: unknown }[]): Promise<Map<string, WikiCheck> | null> {
  if (!knownWikiHost(wiki.api)) return null;
  const plan = entries.map((e) => {
    const fix = wikiFixOf(e.wiki);
    return { id: e.id, off: fix === false, titles: fix === false ? [] : fix ? [fix] : titlesFor(e.name, wiki) };
  });
  const found = new Map<string, PageFound>();
  try {
    for (const batch of inBatches([...new Set(plan.flatMap((p) => p.titles))])) {
      const r = await fetch(queryUrl(wiki, batch, true), { credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(8000) });
      if (!r.ok) return null;
      const got = readAnswer(await r.json(), batch);
      if (!got.size) return null; // a busy wiki said no (maxlag): try again later
      for (const [k, v] of got) found.set(k, v);
      // One question at a time, a moment apart, to go easy on the wiki.
      await new Promise((ok) => setTimeout(ok, 400));
    }
  } catch { return null; }
  return new Map(plan.map((p) => [p.id, p.off ? { kind: 'off' } : classify(wiki, p.titles, found)]));
}

/** The pages a "which one?" page lists, this game's first. */
export async function whichOptions(wiki: GameWiki, title: string): Promise<string[]> {
  if (!knownWikiHost(wiki.api) || toTitle(title) !== title) return [];
  try {
    const r = await fetch(linksUrl(wiki, title), { credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(6000) });
    return r.ok ? readLinks(await r.json(), wiki).slice(0, 12) : [];
  } catch { return []; }
}

/** A moderator's pasted page from a known wiki: the wiki behind it, read from the wiki itself. */
export async function findWiki(pasted: string): Promise<GameWiki | null> {
  for (const api of apiCandidates(pasted)) {
    try {
      const r = await fetch(siteinfoUrl(api), { credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(6000) });
      if (!r.ok) continue;
      const w = readSiteinfo(await r.json().catch(() => null), api);
      if (w) return w;
    } catch { /* try the next spot */ }
  }
  return null;
}

/** Forget what this device remembered about a game's wiki (after a moderator changes it). */
export function forgetGameWiki(gameId: string) { wikis.delete(gameId); }
