// Units and classes, linked both ways (docs/blocks/classes.md, slice 2). Plain and tested
// (class-fit.test.ts): no React, no database.
//
// Only for games where characters switch classes and a class changes their numbers (Fire Emblem,
// Final Fantasy Tactics...): a Characters Block and a Classes Block in the same game are "kin" when
// their charts share at least three stats (Fortune's Weave: HP, Str, Mag... growths on units, the
// same nine as growth modifiers on classes). World of Warcraft-style games never pair up, so they
// never see any of this.

import type { Block, EntryContent, Page, Route, StatDef, Tint } from '../data/pages/types.ts';
import { allStatDefs, entriesOf } from './fields.ts';
import { bandOf, bandOrder, classShape } from './classes.ts';

/** One entry of the other Block, as much as a card needs to show and link it. Routes it's on (none:
 *  every route), so a card can follow the route switcher. */
export interface KinRow { id: string; name: string; icon?: string; stats: Record<string, number>; band?: string; spoiler?: boolean; routes?: Route[] }

/** What a card on this Page gets about the other side. */
export interface Kin {
  game: string;
  /** The Block on this Page whose cards show it. */
  forBlock: string;
  /** What the rows are: classes (on a unit's card) or units (on a class's card). */
  side: 'classes' | 'units';
  /** Where the rows live, for links: /g/<game>/<page>?e=<block>.<id>. */
  page: string;
  block: string;
  title: string;
  /** The other Page's color: its entries' pieces wear it, wherever they show. */
  tint: Tint;
  /** The stats both charts have, in the classes' order. */
  defs: StatDef[];
  /** The classes' bands in ladder order (on a unit's card). */
  bands: string[];
  rows: KinRow[];
}

const MIN_SHARED = 3;

/** The stats a characters chart and a classes chart both have, in the classes' order. */
export function sharedStats(units: Pick<Block, 'fields' | 'stats'>, classes: Pick<Block, 'fields' | 'stats'>): StatDef[] {
  const mine = new Set(allStatDefs(units).map((d) => d.key));
  return allStatDefs(classes).filter((d) => mine.has(d.key));
}

const statsOf = (e: Pick<EntryContent, 'stats'>, defs: StatDef[]) =>
  Object.fromEntries(defs.filter((d) => typeof e.stats?.[d.key] === 'number').map((d) => [d.key, e.stats![d.key]]));

/** For each Block on this Page, the kin Blocks anywhere in the game, with their rows (built on the server). */
export function classKin(game: string, pages: Page[], page: Page): Kin[] {
  const all = pages.flatMap((p) => p.blocks.map((b) => ({ p, b })));
  const out: Kin[] = [];
  for (const here of page.blocks) {
    const otherType = here.type === 'characters' ? 'classes' : here.type === 'classes' ? 'characters' : null;
    if (!otherType) continue;
    for (const { p, b } of all.filter((x) => x.b.type === otherType)) {
      const [units, classes] = here.type === 'characters' ? [here, b] : [b, here];
      const defs = sharedStats(units, classes);
      if (defs.length < MIN_SHARED) continue;
      const shape = classShape(classes);
      out.push({
        game, forBlock: here.id, side: here.type === 'characters' ? 'classes' : 'units', page: p.id, block: b.id, title: b.title, tint: p.tint, defs,
        bands: here.type === 'characters' ? bandOrder(classes.entries, shape.band) : [],
        rows: entriesOf(b).map((e) => ({ id: e.id, name: e.name, icon: e.icon, stats: statsOf(e, defs), spoiler: e.spoiler, routes: e.routes?.length ? e.routes : undefined,
          band: here.type === 'characters' ? bandOf(e, shape.band) || undefined : undefined }))
          .filter((r) => Object.keys(r.stats).length >= MIN_SHARED),
      });
    }
  }
  return out;
}

type Stats = Record<string, number | undefined> | undefined;
const has = (s: Stats, defs: StatDef[]) => defs.filter((d) => typeof s?.[d.key] === 'number').length >= MIN_SHARED;

/**
 * A unit's strengths: the stats they grow better than the cast's average, and by how much (a stat
 * where lower is better counts the other way). Strongest first. Nothing for a unit without numbers.
 */
export function strengths(unit: Stats, cast: Stats[], defs: StatDef[]): { def: StatDef; by: number }[] {
  if (!has(unit, defs)) return [];
  const rows = cast.filter((s) => has(s, defs));
  return defs.flatMap((d) => {
    const vals = rows.map((s) => s?.[d.key]).filter((v): v is number => typeof v === 'number');
    const v = unit?.[d.key];
    if (typeof v !== 'number' || !vals.length) return [];
    const by = (v - vals.reduce((a, b) => a + b, 0) / vals.length) * (d.better === 'low' ? -1 : 1);
    return by > 0 ? [{ def: d, by }] : [];
  }).sort((a, b) => b.by - a.by);
}

export interface Fit<R> { row: R; score: number; reason: StatDef[] }

/**
 * How well a class suits a unit, by their strengths: each stat the unit is strong in, times how
 * much the class raises it. The reason is the (up to) two stats that count most ("boosts their Spd
 * and Dex"). A class that raises none of their strengths scores 0 and gives no reason.
 */
export function strengthFit(strong: { def: StatDef; by: number }[], mods: Stats): { score: number; reason: StatDef[] } {
  const parts = strong.map((s) => ({ def: s.def, v: s.by * (mods?.[s.def.key] ?? 0) * (s.def.better === 'low' ? -1 : 1) }));
  const score = parts.reduce((a, p) => a + p.v, 0);
  const reason = parts.filter((p) => p.v > 0).sort((a, b) => b.v - a.v).slice(0, 2).map((p) => p.def);
  return { score, reason };
}

/** A unit's number in a class: their own growth plus the class's modifier. */
export const inClass = (unit: Stats, mods: Stats, key: string) =>
  typeof unit?.[key] === 'number' ? unit[key]! + (mods?.[key] ?? 0) : undefined;

/**
 * The classes for a unit, best first: by their strengths (the default), or by one stat ("stat:spd":
 * their growth in that stat once in the class). Ties go A to Z.
 */
export function classesFor<R extends { name: string; stats: Stats }>(unit: Stats, cast: Stats[], classes: R[], defs: StatDef[], by = 'strengths'): Fit<R>[] {
  const stat = by.startsWith('stat:') ? defs.find((d) => d.key === by.slice(5)) : undefined;
  const strong = stat ? [] : strengths(unit, cast, defs);
  if (!stat && !strong.length) return [];
  return classes.map((row) => {
    if (stat) {
      const v = inClass(unit, row.stats, stat.key) ?? 0;
      return { row, score: stat.better === 'low' ? -v : v, reason: [stat] };
    }
    return { row, ...strengthFit(strong, row.stats) };
  }).sort((a, b) => b.score - a.score || a.row.name.localeCompare(b.row.name));
}

/** The units a class suits most, each by their own strengths, best first; only units it actually helps. */
export function whoSuits<R extends { name: string; stats: Stats }>(mods: Stats, units: R[], defs: StatDef[], n = 5): Fit<R>[] {
  const cast = units.map((u) => u.stats);
  return units.map((row) => ({ row, ...strengthFit(strengths(row.stats, cast, defs), mods) }))
    .filter((f) => f.score > 0 && f.reason.length)
    .sort((a, b) => b.score - a.score || a.row.name.localeCompare(b.row.name)).slice(0, n);
}
