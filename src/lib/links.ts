// Web links in chat messages (docs/chat.md): every address becomes a real link, a YouTube
// video gets a picture card, and a link to an entry on Village itself turns into that entry's
// card, the same as picking it with "#".

export type LinkPart = { text: string } | { url: string };

// An address runs until a space or a bracket-ish character; trailing punctuation is left out,
// so "see https://x.com/a." links "https://x.com/a".
const URL_RE = /\bhttps?:\/\/[^\s<>"'`]+/gi;
const TRAILING = /[.,!?;:)\]}'"]+$/;

/** A piece of text with its web addresses picked out. */
export function findLinks(text: string): LinkPart[] {
  const parts: LinkPart[] = [];
  let at = 0;
  for (const m of text.matchAll(URL_RE)) {
    const url = m[0].replace(TRAILING, '');
    if (m.index > at) parts.push({ text: text.slice(at, m.index) });
    parts.push({ url });
    at = m.index + url.length;
  }
  if (at < text.length) parts.push({ text: text.slice(at) });
  return parts;
}

export const linksIn = (text: string) => findLinks(text).flatMap((p) => ('url' in p ? [p.url] : []));

/** The video in a YouTube address, and where it starts (in seconds), or null. */
export function youTube(url: string): { id: string; start?: number } | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  const host = u.hostname.replace(/^(www|m|music)\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else {
      const m = /^\/(shorts|embed|live)\/([^/]+)/.exec(u.pathname);
      if (m) id = m[2];
    }
  }
  if (!id || !/^[\w-]{6,20}$/.test(id)) return null;
  const t = u.searchParams.get('t') ?? u.searchParams.get('start');
  const start = t ? seconds(t) : undefined;
  return start ? { id, start } : { id };
}

/** "95", "95s", "1m35s" or "1h2m3s" in seconds. */
function seconds(t: string) {
  if (/^\d+$/.test(t)) return Number(t);
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(t);
  return m ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : undefined;
}

/**
 * A link to a page on Village itself (one of `hosts`): which game, Page and item it points at,
 * from the entry addresses in src/data/pages/links.ts (/g/fortunes-weave/units-and-classes/eshmel).
 */
export function villagePath(url: string, hosts: string[]): { game: string; page: string; item: string } | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  if (!hosts.includes(u.host)) return null;
  const m = /^\/g\/([a-z0-9-]+)\/([a-z0-9-]+)\/([^/?#]+)\/?$/.exec(u.pathname);
  return m ? { game: m[1], page: m[2], item: m[3] } : null;
}

/** Where Village lives: the site itself, wherever this copy runs. */
export const VILLAGE_HOSTS = ['village-tawny-beta.vercel.app'];
