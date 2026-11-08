// Videos on entries (docs/blocks/videos.md): reading a YouTube link, start times, YouTube's
// own addresses, and the ranking. Plain helpers, tested in videos.test.ts.
//
// Village never hosts a video. It keeps YouTube's video id and a start time; the video plays in
// YouTube's privacy-enhanced player, and the title and channel (the credit) are read from
// YouTube whenever it shows (/api/video-info/<id>).

import { sortStandouts } from './standouts.ts';

/** A YouTube video id: 11 letters, digits, - or _. */
export const isVideoId = (id: string) => /^[A-Za-z0-9_-]{11}$/.test(id);

/** The longest start time we keep (a day), matching the database. */
export const MAX_START = 86400;

/** "272", "272s", "4m32s", "1h2m3s" or "4:32" as seconds. Anything else is null. */
export function parseTime(raw: string | null | undefined): number | null {
  const t = (raw ?? '').trim().toLowerCase();
  if (!t) return null;
  let s: number | null = null;
  if (/^\d+s?$/.test(t)) s = parseInt(t, 10);
  else if (/^(\d+h)?(\d+m)?(\d+s)?$/.test(t)) {
    const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(t)!;
    s = (+(m[1] ?? 0)) * 3600 + (+(m[2] ?? 0)) * 60 + (+(m[3] ?? 0));
  } else if (/^\d+(:\d{1,2}){1,2}$/.test(t)) {
    const parts = t.split(':').map(Number);
    if (parts.slice(1).some((p) => p > 59)) return null;
    s = parts.reduce((a, p) => a * 60 + p, 0);
  }
  return s !== null && s <= MAX_START ? s : null;
}

/** Seconds as "4:32" or "1:02:03". */
export function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${two(m)}:${two(r)}` : `${m}:${two(r)}`;
}

export interface VideoLink { id: string; start: number }

const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);

/**
 * A pasted YouTube link as its video id and start time: watch links, youtu.be, shorts, live
 * and embed links, with or without https://, and a start from t= or start=. Null when it isn't
 * a link to one YouTube video.
 */
export function parseVideoLink(input: string): VideoLink | null {
  let raw = input.trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  const host = url.hostname.toLowerCase();
  let id: string | null = null;
  if (host === 'youtu.be') id = url.pathname.split('/')[1] ?? null;
  else if (HOSTS.has(host)) {
    const [, first, second] = url.pathname.split('/');
    if (first === 'watch') id = url.searchParams.get('v');
    else if (['shorts', 'live', 'embed', 'v'].includes(first ?? '')) id = second ?? null;
  }
  if (!id || !isVideoId(id)) return null;
  // A start in the address's #t=… counts too, as YouTube's own share links sometimes do.
  const hashT = new URLSearchParams(url.hash.replace(/^#/, '')).get('t');
  const start = parseTime(url.searchParams.get('t') ?? url.searchParams.get('start') ?? hashT) ?? 0;
  return { id, start };
}

/** YouTube's privacy-enhanced player, starting at the moment. Played only after a tap. */
export const embedUrl = (id: string, start = 0) =>
  `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1${start > 0 ? `&start=${start}` : ''}`;

/** The video on YouTube itself, at the moment. */
export const watchUrl = (id: string, start = 0) => `https://www.youtube.com/watch?v=${id}${start > 0 ? `&t=${start}s` : ''}`;

/** YouTube's thumbnail picture for a video (its image server sets no cookies). */
export const thumbUrl = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

/** YouTube's oEmbed address, which says a video's title and channel, with no key. */
export const oembedUrl = (id: string) =>
  `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`;

/** What YouTube says about a video: its credit, or why it can't be shown. */
export type VideoInfo =
  | { ok: true; title: string; channel: string; channelUrl: string | null }
  | { ok: false; reason: 'gone' | 'blocked' };

/** Only a link to YouTube itself is used as the channel link. */
export function channelLink(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && (u.hostname === 'www.youtube.com' || u.hostname === 'youtube.com') ? u.toString() : null;
  } catch { return null; }
}

/** oEmbed's answer as a VideoInfo. 401 or 403 means the creator doesn't allow playing it elsewhere. */
export function toVideoInfo(status: number, body: unknown): VideoInfo {
  if (status === 401 || status === 403) return { ok: false, reason: 'blocked' };
  const b = (body ?? {}) as Record<string, unknown>;
  const title = typeof b.title === 'string' ? b.title.trim().slice(0, 200) : '';
  const channel = typeof b.author_name === 'string' ? b.author_name.trim().slice(0, 100) : '';
  if (status !== 200 || !title || !channel) return { ok: false, reason: 'gone' };
  return { ok: true, title, channel, channelUrl: channelLink(b.author_url) };
}

// ---------------------------------------------------------------- Ranking

/** Totals stay hidden until this many votes, like other opinion votes. */
export const SHOW_TOTALS_AT = 5;

export interface VideoTally { id: string; helped: number; notHelped: number; createdAt: string }

/**
 * Best first, by Standouts: net "helped" votes against everyone who voted, at the believable
 * low end, with one of the top five places kept for the newest video still finding its voters.
 */
export function rankVideos<T extends VideoTally>(videos: T[]): T[] {
  const stats = videos.map((v) => ({ v, id: v.id, ups: v.helped, downs: v.notHelped, viewers: v.helped + v.notHelped, createdAt: v.createdAt }));
  return sortStandouts(stats).map((s) => s.v);
}

/** The line under a video: "Helped 23 players" once it has enough votes, else "New". */
export function tallyText(t: Pick<VideoTally, 'helped' | 'notHelped'>): string {
  const total = t.helped + t.notHelped;
  if (total < SHOW_TOTALS_AT) return 'New';
  if (t.helped === 0) return 'Hasn’t helped yet';
  return `Helped ${t.helped} ${t.helped === 1 ? 'player' : 'players'}`;
}

// ---------------------------------------------------------------- Removing

/** Whoever added a video can delete it for its first hour (Matt, 2026-11-08); after that they
 *  ask the moderators. Matches remove_video() in the database. */
export const DELETE_WINDOW_MS = 60 * 60 * 1000;

/** Whole minutes left to delete your own video, or 0 when the hour is up. */
export function deleteMinutesLeft(createdAt: string, now: number): number {
  const left = Date.parse(createdAt) + DELETE_WINDOW_MS - now;
  return left > 0 ? Math.ceil(left / 60000) : 0;
}

/** The note on a removal request, so moderators know it's from whoever added the video. */
export const REMOVAL_NOTE = 'Removal requested by whoever added it.';
