// Wiki links (docs/blocks/wiki-links.md): from an entry's name to its page on the game's wiki.
// Plain and tested; the server asks the wiki (src/app/api/wiki/[game]/[card]/route.ts).

/** A game's wiki, as a moderator saved it (games.wiki). */
export interface GameWiki {
  /** What players see: "Fire Emblem Wiki". */
  name: string;
  /** The wiki's MediaWiki API: https, ends in api.php. Our server only ever asks this. */
  api: string;
  /** The wiki's page address with $1 for the page name: "https://fireemblemwiki.org/wiki/$1". */
  article: string;
  /** The word the wiki adds when a name is taken: "Theodora (Fortune's Weave)". */
  bracket?: string;
}

/** What the check says about one entry. */
export type WikiAnswer =
  | { ok: true; name: string; url: string; title: string }
  | { ok: false; reason: 'no-wiki' | 'off' | 'missing' | 'which' }
  /** The wiki turned our server away (some block whole server companies), so the player's browser
   *  asks it: the saved wiki and the page names our server worked out, nothing else. */
  | { ok: false; reason: 'ask'; ask: WikiAsk };

/** What a browser asks the wiki when our server can't: the game's wiki and the names to try, in order. */
export interface WikiAsk { wiki: GameWiki; titles: string[] }

const HOST = /^https:\/\/((?:[a-z0-9-]+\.)+[a-z]{2,})(?=\/)/i;
const API = /^https:\/\/(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[a-z0-9._~-]+)*\/api\.php$/i;
const ARTICLE = /^https:\/\/(?:[a-z0-9-]+\.)+[a-z]{2,}\/[^\s?#]*\$1$/i;
/** Characters a wiki page name can't have. */
const BAD_TITLE = /[#<>[\]|{}\u0000-\u001f\u007f]/;

/** A saved wiki, checked the same way the database checks it (public.game_wiki_ok). */
export function wikiOf(raw: unknown): GameWiki | null {
  if (!raw || typeof raw !== 'object') return null;
  const w = raw as Record<string, unknown>;
  const { name, api, article, bracket } = w;
  if (typeof name !== 'string' || name.trim().length < 2 || name.length > 60) return null;
  if (typeof api !== 'string' || !API.test(api)) return null;
  if (typeof article !== 'string' || !ARTICLE.test(article)) return null;
  if (api.match(HOST)?.[1].toLowerCase() !== article.match(HOST)?.[1].toLowerCase()) return null;
  if (bracket !== undefined && bracket !== null && (typeof bracket !== 'string' || !bracket.trim() || bracket.length > 60 || BAD_TITLE.test(bracket))) return null;
  return { name: name.trim(), api, article, ...(typeof bracket === 'string' ? { bracket: bracket.trim() } : {}) };
}

/**
 * A name as a wiki page name, the way MediaWiki tidies it: spaces (and underscores) squeezed to
 * one space, the first letter a capital. Null if no wiki could have such a page.
 */
export function toTitle(name: string): string | null {
  const t = name.replace(/[\s_]+/g, ' ').trim();
  if (!t || BAD_TITLE.test(t) || new TextEncoder().encode(t).length > 255) return null;
  if (t.startsWith(':') || t === '.' || t === '..' || t.includes('~~~')) return null;
  return t[0].toUpperCase() + t.slice(1);
}

/**
 * An entry's stored fix (entry.wiki), checked wherever it's read: Draft content isn't checked by
 * the database. A page name a wiki allows (1 to 255 characters), or false for no link; anything
 * else counts as not set, so the usual page is used.
 */
export function wikiFixOf(raw: unknown): string | false | undefined {
  if (raw === false) return false;
  if (typeof raw !== 'string' || raw.length < 1 || raw.length > 255) return undefined;
  return toTitle(raw) ?? undefined;
}

/** "Theodora" and "Fortune's Weave" make "Theodora (Fortune's Weave)". */
export function withBracket(title: string, bracket: string): string {
  return `${title} (${bracket})`;
}

/**
 * Wiki sites our server is willing to ask (the hub, 2026-11-10). The database only checks an
 * address's shape; a name that looks fine could still point somewhere it shouldn't, and
 * moderators will be community members. A game whose wiki isn't here shows no links until we
 * add its site. Exact hosts, or "*." for any address on that site.
 */
export const KNOWN_WIKI_HOSTS = [
  'fireemblemwiki.org', 'zeldawiki.wiki', 'bulbapedia.bulbagarden.net',
  '*.fandom.com', '*.wiki.gg', '*.fextralife.com', '*.miraheze.org',
];

/** The wiki's site is one we know (see KNOWN_WIKI_HOSTS). */
export function knownWikiHost(api: string): boolean {
  const host = api.match(HOST)?.[1].toLowerCase();
  if (!host) return false;
  return KNOWN_WIKI_HOSTS.some((h) => (h.startsWith('*.') ? host.endsWith(h.slice(1)) && host.length > h.length - 1 : host === h));
}

/** A page name in an address, the way MediaWiki writes its own links: Theodora_(Fortune's_Weave). */
export function encodeTitle(title: string): string {
  return encodeURIComponent(title.replace(/ /g, '_')).replace(/%(3A|2F|28|29|2C|21|3B|40|24|2A|7E)/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
}

export function pageUrl(wiki: GameWiki, title: string): string {
  return wiki.article.replace('$1', encodeTitle(title));
}

/**
 * A page name from an address pasted from the game's wiki, or null when it's from anywhere else.
 * Reads the wiki's page pattern (".../wiki/Maria_(Fortune's_Weave)", with or without "#part")
 * and its index.php form ("...?title=Maria"). Never used to build a request: only the page name
 * is kept, so a fix can't point at another site.
 */
export function titleFromUrl(wiki: GameWiki, pasted: string): string | null {
  let u: URL;
  try { u = new URL(pasted.trim()); } catch { return null; }
  const home = new URL(wiki.article.replace('$1', ''));
  if (u.protocol !== 'https:' || u.host.toLowerCase() !== home.host.toLowerCase() || u.username || u.password) return null;
  let raw: string | null = null;
  if (u.pathname.startsWith(home.pathname) && u.pathname.length > home.pathname.length) raw = u.pathname.slice(home.pathname.length);
  else if (/\/index\.php$/.test(u.pathname)) raw = u.searchParams.get('title');
  if (!raw) return null;
  let decoded: string;
  try { decoded = u.pathname.includes(raw) ? decodeURIComponent(raw) : raw; } catch { return null; }
  return toTitle(decoded.replace(/_/g, ' '));
}

/** The wiki's own search for a name, for builders when there's no page (slice 2). */
export function searchUrl(wiki: GameWiki, name: string): string {
  return `${wiki.api.replace(/api\.php$/, 'index.php')}?search=${encodeURIComponent(name)}`;
}

/** Up to 50 names in one question (MediaWiki's limit for everyone). */
export const TITLES_PER_ASK = 50;

/** The question for the wiki: do these pages exist, where do they redirect, which are "which one?" pages. */
export function queryUrl(wiki: GameWiki, titles: string[], fromBrowser = false): string {
  const q = new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2', redirects: '1',
    prop: 'pageprops', ppprop: 'disambiguation', titles: titles.slice(0, TITLES_PER_ASK).join('|'),
    // From a browser, MediaWiki answers another site's page only when asked without a login.
    ...(fromBrowser ? { origin: '*' } : {}),
  });
  return `${wiki.api}?${q}`;
}

/** What the wiki said about one page name we asked about. */
export interface PageFound {
  /** The page there is, after the wiki tidied the name and followed redirects. */
  title: string;
  exists: boolean;
  /** A "which one did you mean?" page. */
  which: boolean;
  /** Reached by a redirect to a page with another name. */
  redirected: boolean;
}

/** Reads the wiki's answer (formatversion 2) into what it said about each name we asked about. */
export function readAnswer(body: unknown, asked: string[]): Map<string, PageFound> {
  const out = new Map<string, PageFound>();
  const q = (body && typeof body === 'object' ? (body as { query?: unknown }).query : undefined) as
    | { normalized?: { from: string; to: string }[]; redirects?: { from: string; to: string }[]; pages?: { title?: string; missing?: boolean; invalid?: boolean; pageprops?: Record<string, unknown> }[] }
    | undefined;
  if (!q || !Array.isArray(q.pages)) return out;
  const step = (list: { from: string; to: string }[] | undefined) => new Map((Array.isArray(list) ? list : []).filter((x) => typeof x?.from === 'string' && typeof x?.to === 'string').map((x) => [x.from, x.to]));
  const normalized = step(q.normalized), redirects = step(q.redirects);
  const pages = new Map(q.pages.filter((p) => typeof p?.title === 'string').map((p) => [p.title as string, p]));
  for (const a of asked) {
    const tidy = normalized.get(a) ?? a;
    let title = tidy;
    // Follow at most a couple of redirects (the wiki already resolved them; this just reads the chain).
    for (let i = 0; i < 3 && redirects.has(title); i++) title = redirects.get(title)!;
    const p = pages.get(title);
    if (!p) continue;
    const exists = !p.missing && !p.invalid;
    out.set(a, {
      title,
      exists,
      which: exists && (Boolean(p.pageprops && 'disambiguation' in p.pageprops) || /\(disambiguation\)$/i.test(title)),
      redirected: title !== tidy,
    });
  }
  return out;
}

/** The page names to ask about for an entry: the game's own page first, then the plain name. */
export function titlesFor(name: string, wiki: GameWiki): string[] {
  const t = toTitle(name);
  if (!t) return [];
  const own = wiki.bracket && !t.endsWith(`(${wiki.bracket})`) ? toTitle(withBracket(t, wiki.bracket)) : null;
  return own ? [own, t] : [t];
}

/**
 * Which page an entry links to. A page named for this game ("Maria (Fortune's Weave)") wins
 * over the plain name, which on a wiki covering a whole series may be someone else from another
 * game. A "which one?" page is no link: it goes on the builders' list.
 */
export function choose(wiki: GameWiki, titles: string[], found: Map<string, PageFound>): WikiAnswer {
  if (!titles.length) return { ok: false, reason: 'missing' };
  let which = false;
  for (const t of titles) {
    const f = found.get(t);
    if (!f?.exists) continue;
    if (f.which) { which = true; continue; }
    return { ok: true, name: wiki.name, url: pageUrl(wiki, f.title), title: f.title };
  }
  return { ok: false, reason: which ? 'which' : 'missing' };
}

/** A browser's question is only ever for a known wiki site, about page names a wiki allows. */
export function askOf(raw: unknown): WikiAsk | null {
  if (!raw || typeof raw !== 'object') return null;
  const { wiki: w, titles } = raw as { wiki?: unknown; titles?: unknown };
  const wiki = wikiOf(w);
  if (!wiki || !knownWikiHost(wiki.api)) return null;
  if (!Array.isArray(titles) || !titles.length || titles.length > 2) return null;
  if (!titles.every((t) => typeof t === 'string' && toTitle(t) === t)) return null;
  return { wiki, titles };
}
