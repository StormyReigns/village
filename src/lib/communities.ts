// Communities, the plain parts (docs/blocks/discord.md, part 2): reading a pasted Discord invite
// or link, what Discord says about an invite, and the order listings show in. The database checks
// links again (public.community_link_ok) and decides who can list, vote and approve.

import { wilsonLower } from './standouts.ts';

// ---------------------------------------------------------------------------- reading a paste

const INVITE_CODE = /^[A-Za-z0-9-]{2,32}$/;
const INVITE_HOSTS = ['discord.gg', 'discord.com', 'www.discord.com', 'discordapp.com', 'www.discordapp.com', 'ptb.discord.com', 'canary.discord.com'];
/** Mirrors the list in public.community_link_ok. */
const SHORTENERS = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly', 'cutt.ly', 'rebrand.ly', 'tiny.cc', 'shorturl.at', 'rb.gy', 'linktr.ee'];

export type Pasted =
  | { kind: 'discord'; invite: string }
  | { kind: 'link'; url: string; host: string }
  | { kind: 'bad'; reason: string };

/** Reads what a player pasted: a Discord invite (any of its link shapes) or a plain web link. */
export function readPaste(raw: string): Pasted {
  const text = raw.trim();
  if (!text) return { kind: 'bad', reason: 'Paste a Discord invite or a link.' };
  let u: URL;
  try { u = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`); }
  catch { return { kind: 'bad', reason: 'That isn’t a link.' }; }
  const host = u.hostname.toLowerCase();
  if (INVITE_HOSTS.includes(host)) {
    const parts = u.pathname.split('/').filter(Boolean);
    const code = host === 'discord.gg' ? parts[0] : parts[0] === 'invite' ? parts[1] : undefined;
    if (code && INVITE_CODE.test(code)) return { kind: 'discord', invite: code };
    return { kind: 'bad', reason: 'That’s a Discord link, but not an invite. In Discord: Invite People → Copy.' };
  }
  if (!/^https?:\/\//i.test(text)) return { kind: 'bad', reason: 'Paste the whole link, starting with https://' };
  if (u.protocol !== 'https:') return { kind: 'bad', reason: 'Only secure links (https://) can be listed.' };
  if (SHORTENERS.includes(host)) return { kind: 'bad', reason: 'Paste the real address, not a shortened link.' };
  if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(host)) return { kind: 'bad', reason: 'That address doesn’t look right.' };
  if (u.username || u.password) return { kind: 'bad', reason: 'That address doesn’t look right.' };
  const url = u.toString().replace(/\/$/, '');
  if (url.length > 300) return { kind: 'bad', reason: 'That link is too long.' };
  return { kind: 'link', url, host };
}

/** "reddit.com/r/FortunesWeave": a link's address without https:// or www, cut short. */
export function shortAddress(url: string): string {
  const s = url.replace(/^https:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
  return s.length > 40 ? `${s.slice(0, 39)}…` : s;
}

export const inviteUrl = (code: string) => `https://discord.gg/${code}`;

// ------------------------------------------------------------------- what Discord says

/** Discord's public invite address. No key needed. */
export const inviteApi = (code: string) => `https://discord.com/api/v10/invites/${encodeURIComponent(code)}?with_counts=true&with_expiration=true`;

export type InviteInfo =
  | { ok: true; guildId: string; name: string; icon: string | null; members: number | null; online: number | null; verified: boolean }
  | { ok: false; reason: 'gone' | 'expires' | 'adult' | 'not_server' };

/** Plain words for why an invite can't be listed. */
export const INVITE_REASONS: Record<Exclude<InviteInfo, { ok: true }>['reason'], string> = {
  gone: 'Discord says this invite doesn’t work. Make a new one and paste that.',
  expires: 'This invite runs out. In Discord: Invite People → Edit invite link → Expire after: Never.',
  adult: 'Discord marks this server as age-restricted, so it can’t be listed here.',
  not_server: 'That invite isn’t to a server.',
};

/** Turns Discord's answer into what the app shows. Only servers with invites that never run out pass. */
export function toInviteInfo(status: number, body: unknown): InviteInfo {
  if (status === 404 || status === 400) return { ok: false, reason: 'gone' };
  const b = (body ?? {}) as Record<string, unknown>;
  const g = b.guild as Record<string, unknown> | undefined;
  if (!g || typeof g.id !== 'string' || typeof g.name !== 'string') return { ok: false, reason: status === 200 ? 'not_server' : 'gone' };
  if (b.expires_at) return { ok: false, reason: 'expires' };
  // Discord's NSFW levels: 1 explicit, 3 age-restricted.
  if (g.nsfw === true || g.nsfw_level === 1 || g.nsfw_level === 3) return { ok: false, reason: 'adult' };
  const features = Array.isArray(g.features) ? (g.features as string[]) : [];
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  return {
    ok: true, guildId: g.id, name: g.name.slice(0, 100),
    icon: typeof g.icon === 'string' && /^(a_)?[0-9a-f]{32}$/.test(g.icon) ? g.icon : null,
    members: num(b.approximate_member_count), online: num(b.approximate_presence_count),
    verified: features.includes('VERIFIED'),
  };
}

/** A server's icon from Discord's image server, or null for the initials fallback. */
export function iconUrl(info: { guildId: string; icon: string | null }, size = 96): string | null {
  return info.icon ? `https://cdn.discordapp.com/icons/${info.guildId}/${info.icon}.webp?size=${size}` : null;
}

/** "1,204 members · 230 online". */
export function countsText(members: number | null, online: number | null): string {
  const n = (x: number) => x.toLocaleString('en-US');
  const parts = [];
  if (members !== null) parts.push(`${n(members)} ${members === 1 ? 'member' : 'members'}`);
  if (online !== null) parts.push(`${n(online)} online`);
  return parts.join(' · ');
}

/** Up to two letters for a server with no icon: "Fortune's Weave Fans" → "FW". */
export function initials(name: string): string {
  const words = name.replace(/['’]/g, '').replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2)).toUpperCase();
}

// ------------------------------------------------------------------------ order

export interface Ranked { id: string; ups: number; downs: number; createdAt: string }

/** Totals stay hidden until this many votes ("leaning yes" before that). */
export const SHOW_TOTALS_AT = 5;

/**
 * Best first: net recommendations against everyone who voted, at the believable low end (the
 * Standouts maths), newest first on a tie, so a new listing isn't buried under an old one with
 * no votes either.
 */
export function rankCommunities<T extends Ranked>(list: T[]): T[] {
  const score = (c: T) => wilsonLower(Math.max(c.ups - c.downs, 0), c.ups + c.downs);
  return [...list].sort((a, b) => score(b) - score(a) || b.createdAt.localeCompare(a.createdAt));
}

/** What a listing says about its votes: nothing below 5, then "Recommended by 12". */
export function voteText(ups: number, downs: number): string | null {
  if (ups + downs < SHOW_TOTALS_AT) return null;
  return ups > downs ? `Recommended by ${ups}` : 'Mixed reviews';
}
