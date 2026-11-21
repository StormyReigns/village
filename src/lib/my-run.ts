// "My run" on the Party Page (docs/blocks/planner.md, 2026-11-20): one list for the player's route,
// made of the route's last chances, grouped by the chapter of their deadline, then everything that has
// no chapter (recruiting a party member, reaching their next class), ordered by the Renown and level it
// needs (Matt: "Order by Renown, level"). Nothing here is invented: an item without a chapter is never
// given one.

import { EVERY_WEEK, NO_DEADLINE } from './deadline.ts';

/** A chapter group's name, from a deadline rank (src/lib/deadline.ts). */
export function chapterLabel(rank: number): string {
  if (rank >= EVERY_WEEK) return 'Every week';
  if (rank >= NO_DEADLINE) return 'Any time';
  if (rank >= 200) return rank >= 299 ? 'End of Part III' : `Part III, Chapter ${Math.floor(rank - 200)}`;
  if (rank >= 199) return 'End of Part II';
  if (rank >= 100) return `Part II, Chapter ${Math.floor(rank - 100)}`;
  if (rank >= 12.5) return 'End of Part I';
  if (rank < 1) return 'Prologue';
  return `Chapter ${Math.floor(rank)}`;
}

export const renownOf = (text: string | undefined) => { const m = text?.match(/\bRenown\s*(\d+)/i); return m ? Number(m[1]) : undefined; };
export const levelOf = (text: string | undefined) => { const m = text?.match(/\b(?:Level|Lv\.?)\s*(\d+)/i); return m ? Number(m[1]) : undefined; };

/**
 * `renown` overrides the Renown read from `needs` (a class step waits for its unit's recruit), and `first`
 * puts recruits ahead of class steps that need the same Renown.
 */
export interface ReadyItem { key: string; needs?: string; name: string; renown?: number; first?: boolean }

/** Things with no chapter, in the order the game lets you do them: least Renown first, then lowest level. */
export function byRenownAndLevel<T extends ReadyItem>(items: T[]): T[] {
  const r = (x: T) => x.renown ?? renownOf(x.needs) ?? Infinity;
  const l = (x: T) => levelOf(x.needs) ?? Infinity;
  return [...items].sort((a, b) => r(a) - r(b) || Number(!a.first) - Number(!b.first) || l(a) - l(b) || a.name.localeCompare(b.name));
}

/** Groups already-ordered items by a label, keeping the order of first appearance. */
export function groupInOrder<T>(items: T[], label: (x: T) => string): { label: string; items: T[] }[] {
  const out: { label: string; items: T[] }[] = [];
  for (const x of items) {
    const l = label(x);
    const last = out[out.length - 1];
    if (last && last.label === l) last.items.push(x);
    else out.push({ label: l, items: [x] });
  }
  return out;
}
