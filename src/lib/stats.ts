// Entry stats (a weapon's Might, Hit...) compared across a Block: how good each number is,
// its place in the Block, and the heatmap color for it. Used by the "table" look, the
// entry panel and share pictures, so they all agree.

import type { Entry, StatDef } from '@/data/pages/types';

export interface Range { min: number; max: number }

/** The lowest and highest value of a stat among these entries, or null if none have it. */
export function rangeOf(entries: Entry[], key: string): Range | null {
  const n = entries.map((e) => e.stats?.[key]).filter((v): v is number => typeof v === 'number');
  return n.length ? { min: Math.min(...n), max: Math.max(...n) } : null;
}

/** How good a value is next to the others: 0 the worst, 1 the best, 0.5 when they're all the same. */
export function goodness(def: StatDef, v: number, r: Range): number {
  if (r.max === r.min) return 0.5;
  const t = (v - r.min) / (r.max - r.min);
  return def.better === 'high' ? t : 1 - t;
}

/** Its place among the entries that have the stat: 1 is the best. Ties share a place. */
export function placeOf(def: StatDef, v: number, entries: Entry[]): { place: number; of: number; tied: boolean } {
  const n = entries.map((e) => e.stats?.[def.key]).filter((x): x is number => typeof x === 'number');
  const beats = (x: number) => (def.better === 'high' ? x > v : x < v);
  return { place: n.filter(beats).length + 1, of: n.length, tied: n.filter((x) => x === v).length > 1 };
}

export function ordinal(n: number) {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
  return `${n}${s}`;
}

/** "Best of 30", "3rd of 30", "Tied 12th of 30", "Worst of 30". 1st is always the best, even for Weight. */
export function placeText(p: { place: number; of: number; tied: boolean }) {
  if (p.of < 2) return '';
  if (p.place === 1) return p.tied ? `Tied best of ${p.of}` : `Best of ${p.of}`;
  if (p.place === p.of && !p.tied) return `Worst of ${p.of}`;
  return `${p.tied ? 'Tied ' : ''}${ordinal(p.place)} of ${p.of}`;
}

// Heatmap colors: orange (worse) through a neutral gray to teal (better), as soft tints that
// keep ink text readable. Red and green tints look alike to many colorblind players; orange
// and teal stay apart (checked with the dataviz palette validator), and every cell shows its number.
const BAD = [230, 140, 40];   // a warm orange
const MID = [241, 242, 245];  // --card-2
const GOOD = [12, 116, 120];  // --teal
const WHITE = [255, 255, 255];

const mix = (a: number[], b: number[], t: number) => a.map((x, i) => Math.round(x + (b[i] - x) * t));
const hex = (c: number[]) => '#' + c.map((x) => x.toString(16).padStart(2, '0')).join('');

/** The cell color for a goodness from 0 to 1. */
export function heatColor(g: number): string {
  const d = Math.min(1, Math.abs(g - 0.5) * 2);
  if (d < 0.08) return hex(MID);
  const pole = mix(WHITE, g > 0.5 ? GOOD : BAD, g > 0.5 ? 0.55 : 0.35);
  return hex(mix(MID, pole, d));
}

/** A stat's value, goodness and place within the given entries, or null if the entry lacks it. */
export function statFacts(def: StatDef, entry: Entry, among: Entry[]) {
  const v = entry.stats?.[def.key];
  const r = rangeOf(among, def.key);
  if (typeof v !== 'number' || !r) return null;
  const g = goodness(def, v, r);
  return { value: v, goodness: g, color: heatColor(g), ...placeOf(def, v, among) };
}

/** Orders entries by a stat, best first (or worst first). Entries without it go last. */
export function byStat(def: StatDef, worst = false) {
  return (a: Entry, b: Entry) => {
    const x = a.stats?.[def.key], y = b.stats?.[def.key];
    if (x === undefined || y === undefined) return x === y ? 0 : x === undefined ? 1 : -1;
    const d = def.better === 'high' ? y - x : x - y;
    return worst ? -d : d;
  };
}
