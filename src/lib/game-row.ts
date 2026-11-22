// A game's database row as a Game (docs/games.md, slice 1): each value checked, and anything missing or not ours
// taken from the starter game in src/data/games.ts, if there is one. Kept apart from the loader so it can be tested.

import type { Game, GameStatus } from '../data/games.ts';
import type { Shade } from './shades.ts';
import type { Route } from '../data/content/types.ts';

type Row = Record<string, unknown>;

const STATUSES: GameStatus[] = ['prelaunch', 'launch', 'live'];
const SHADES: Shade[] = ['standard', 'cozy', 'fantasy', 'shooter', 'openworld'];
const HUES: Game['hue'][] = ['berry', 'sky', 'leaf', 'sun'];

const text = (v: unknown, max = 200) => (typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : undefined);
const one = <T extends string>(v: unknown, list: T[]) => (typeof v === 'string' && (list as string[]).includes(v) ? (v as T) : undefined);

function pathsOf(v: unknown): Game['paths'] | undefined {
  const p = v as { question?: unknown; options?: unknown } | null;
  if (!p || typeof p !== 'object' || !text(p.question, 120) || !Array.isArray(p.options) || p.options.length < 2) return undefined;
  const options = p.options.flatMap((o) => {
    const x = o as { key?: unknown; label?: unknown; note?: unknown };
    return typeof x?.key === 'string' && /^[a-z0-9-]{1,30}$/.test(x.key) && text(x.label, 40)
      ? [{ key: x.key as Route, label: text(x.label, 40)!, note: text(x.note, 80) ?? '' }] : [];
  });
  return options.length >= 2 ? { question: text(p.question, 120)!, options } as Game['paths'] : undefined;
}

function movesOf(v: unknown): Record<string, string> | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const out = Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([k, to]) => /^[a-z0-9-]{1,48}$/.test(k) && typeof to === 'string' && /^[a-z0-9-]{1,48}$/.test(to)));
  return Object.keys(out).length ? (out as Record<string, string>) : undefined;
}

/** A row as a Game, or null when it can't be shown (archived, or no title at all). A game being built (the table's
 *  'draft') is 'building': its Workshop and app work by their address, and it isn't listed (`listed` in games.ts). */
export function gameFromRow(r: Row, starter?: Game): Game | null {
  const status: GameStatus | undefined = r.status === 'draft' ? 'building'
    : one(r.status, STATUSES) ?? (r.status === 'archived' ? undefined : starter?.status);
  if (!status) return null;
  const title = text(r.title, 120) ?? starter?.title;
  if (!title) return null;
  const cover = text(r.cover, 300);
  return {
    id: r.id as string,
    title,
    shortTitle: text(r.short_title, 40) ?? starter?.shortTitle ?? title,
    platform: text(r.platform, 80) ?? starter?.platform ?? '',
    releaseDate: text(r.release_date, 10) ?? starter?.releaseDate ?? '',
    status,
    next: text(r.next, 120) ?? starter?.next,
    hue: one(r.hue, HUES) ?? starter?.hue ?? 'leaf',
    genre: text(r.genre, 40) ?? starter?.genre ?? '',
    shade: one(r.shade, SHADES) ?? starter?.shade,
    // Never a web address from elsewhere: a path in /public, or a picture we host.
    cover: cover && !/^[a-z]+:/i.test(cover) ? cover : starter?.cover,
    popularity: typeof r.popularity === 'number' ? r.popularity : starter?.popularity ?? 100,
    paths: pathsOf(r.paths) ?? starter?.paths,
    movedPages: movesOf(r.moved_pages) ?? starter?.movedPages,
    ...(typeof r.created_by === 'string' ? { createdBy: r.created_by } : {}),
  };
}
