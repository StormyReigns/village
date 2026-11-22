// A game's settings suggested as a Draft (supabase/migrations/20261204000000_game_settings.sql; docs/games.md,
// slice 4): its name, short name, platform, release date, kind, look, cover and routes, as the games table keeps
// them, and what a Draft changes in plain words for its card.

import type { Shade } from './shades.ts';

/** One route: its key never changes (entries keep it), its name and note can. */
export interface RouteOptionRow { key: string; label: string; note: string }
export interface PathsRow { question: string; options: RouteOptionRow[] }

/** A game's settings, as the games table keeps them (the Draft's "before" is exactly this). */
export interface GameSettings {
  title: string;
  shortTitle: string | null;
  platform: string | null;
  releaseDate: string | null;
  genre: string | null;
  shade: Shade | null;
  /** A path in the guide-pictures bucket ("game/person/file.webp"), or a file in /public for a starter game. */
  cover: string | null;
  paths: PathsRow | null;
}
export type SettingKey = keyof GameSettings;
export const SETTING_KEYS: SettingKey[] = ['title', 'shortTitle', 'platform', 'releaseDate', 'genre', 'shade', 'cover', 'paths'];

/** A Draft's content: the settings it changes, and those settings as they were when it was sent. */
export interface GameSettingsContent {
  name: string; sections: []; categories: Record<string, never>;
  game: Partial<GameSettings>;
  before: Partial<GameSettings>;
}

/** A games row as settings. */
export function settingsOfRow(r: Record<string, unknown>): GameSettings {
  const str = (v: unknown) => (typeof v === 'string' ? v : null);
  return {
    title: str(r.title) ?? '', shortTitle: str(r.short_title), platform: str(r.platform), releaseDate: str(r.release_date),
    genre: str(r.genre), shade: str(r.shade) as Shade | null, cover: str(r.cover), paths: (r.paths as PathsRow | null) ?? null,
  };
}

/** The settings that differ, each as the Draft sends it. */
export function changedSettings(was: GameSettings, now: GameSettings): Partial<GameSettings> {
  const out: Partial<GameSettings> = {};
  for (const k of SETTING_KEYS) if (JSON.stringify(was[k] ?? null) !== JSON.stringify(now[k] ?? null)) (out as Record<string, unknown>)[k] = now[k];
  return out;
}

/** A Draft's content: what changes, and what it changes from (exactly as the row had it). */
export function settingsContent(was: GameSettings, now: GameSettings): GameSettingsContent {
  const game = changedSettings(was, now);
  const before = Object.fromEntries(Object.keys(game).map((k) => [k, was[k as SettingKey] ?? null])) as Partial<GameSettings>;
  return { name: `New settings for ${now.shortTitle || now.title}`, sections: [], categories: {}, game, before };
}

/** A Draft's content as game settings, or null when it isn't. */
export function gameSettingsOf(content: unknown): GameSettingsContent | null {
  const c = content as Partial<GameSettingsContent> | null;
  if (!c || typeof c !== 'object' || !c.game || typeof c.game !== 'object' || !Object.keys(c.game).length) return null;
  return { ...(c as GameSettingsContent), before: c.before && typeof c.before === 'object' ? c.before : {} };
}

const SHADE_WORDS: Record<string, string> = { fantasy: 'Fantasy and adventure', cozy: 'Cozy', shooter: 'Action and shooters', openworld: 'Open world', standard: 'Something else' };
const day = (d?: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '');

/** What a Draft changes, one line each. */
export function settingsChanges(before: Partial<GameSettings>, game: Partial<GameSettings>): string[] {
  const out: string[] = [];
  if ('title' in game) out.push(`Name: ${game.title}`);
  if ('shortTitle' in game) out.push(`Players call it ${game.shortTitle}`);
  if ('platform' in game) out.push(`Played on ${game.platform}`);
  if ('releaseDate' in game) out.push(`Comes out ${day(game.releaseDate)}`);
  if ('genre' in game) out.push(`Kind of game: ${game.genre}`);
  if ('shade' in game) out.push(`Look: ${SHADE_WORDS[game.shade ?? 'standard']}`);
  if ('cover' in game) out.push(game.cover ? (before.cover ? 'A new cover picture' : 'Adds a cover picture') : 'Takes the cover picture away');
  if ('paths' in game && game.paths) {
    const was = new Map((before.paths?.options ?? []).map((o) => [o.key, o]));
    if (!before.paths) out.push(`Routes: "${game.paths.question}" ${game.paths.options.map((o) => o.label).join(', ')}`);
    else {
      if (before.paths.question !== game.paths.question) out.push(`The route question: "${game.paths.question}"`);
      for (const o of game.paths.options) {
        const w = was.get(o.key);
        if (!w) out.push(`Adds the route ${o.label}`);
        else if (w.label !== o.label) out.push(`Renames the route ${w.label} to ${o.label}`);
        else if ((w.note ?? '') !== (o.note ?? '')) out.push(`A new note for ${o.label}`);
      }
    }
  }
  return out;
}

/** A new route's key, from its name: plain, and not one already there. */
export function routeKey(label: string, taken: string[]) {
  const base = label.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'route';
  let key = base, n = 2;
  while (taken.includes(key)) key = `${base.slice(0, 21)}-${n++}`;
  return key;
}
