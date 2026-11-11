// Helpers for the Classes Block (docs/blocks/classes.md, src/components/app/Classes.tsx).
// Plain and tested (classes.test.ts): no React, no database.

import type { EntryContent } from '../data/pages/types.ts';
import { CLASS_TIER, EXAM_NEEDS } from './fields.ts';

/** Where a class keeps its tier (a tag) and its exam's skill ranks (a list, "Swords: B"). */
export const TIER_KEY = CLASS_TIER;
export const EXAM_KEY = EXAM_NEEDS;

/** Skill ranks, lowest first, as Fire Emblem games write them. */
const RANKS = ['E', 'E+', 'D', 'D+', 'C', 'C+', 'B', 'B+', 'A', 'A+', 'S', 'S+'];
export const rankAt = (r: string) => RANKS.indexOf(r.trim().toUpperCase());

export interface Need { skill: string; rank: string }

/** "Swords: B" lines as skills and ranks; lines that don't read that way are left out. */
export function needsOf(text: string | undefined): Need[] {
  if (!text) return [];
  return text.split('\n').map((l) => /^\s*(.+?)\s*:\s*([A-Za-z]\+?)\s*$/.exec(l)).filter((m): m is RegExpExecArray => !!m && rankAt(m[2]) >= 0)
    .map((m) => ({ skill: m[1], rank: m[2].toUpperCase() }));
}

export const examOf = (e: Pick<EntryContent, 'sections'>) => needsOf(e.sections.find((s) => s.label === EXAM_KEY)?.text);
export const tierOf = (e: Pick<EntryContent, 'categories'>) => e.categories[TIER_KEY] ?? '';

/** The exam in one short line: "Swords B · Bows B". */
export const examLine = (e: Pick<EntryContent, 'sections'>) => examOf(e).map((n) => `${n.skill} ${n.rank}`).join(' · ');

/**
 * The tiers in ladder order: the order of their header cards (a header is a tier's own card,
 * holding what the tier takes), then any tier with no header, in the order its classes come.
 */
export function tierOrder(entries: Pick<EntryContent, 'categories' | 'header' | 'order'>[]): string[] {
  const headed = entries.filter((e) => e.header && tierOf(e)).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(tierOf);
  const rest = entries.filter((e) => !e.header).map(tierOf).filter(Boolean);
  return [...new Set([...headed, ...rest])];
}

/** How alike two exams are: skills in common over skills in either (1 is the same skills). */
function alike(a: Need[], b: Need[]) {
  const x = new Set(a.map((n) => n.skill.toLowerCase()));
  const y = new Set(b.map((n) => n.skill.toLowerCase()));
  const both = [...x].filter((s) => y.has(s)).length;
  return both ? both / new Set([...x, ...y]).size : 0;
}

/**
 * The classes a step down the ladder (before) and up it (next) that train the same skills.
 * Fortune's Weave has no fixed tree: any unit can take any exam it has the ranks for. So the
 * path is the skills: a class's "steps before" are the previous tier's classes whose exams are
 * most like its own (Myrmidon, Swords, before Shido, Swords), plus any whose skills its exam
 * all asks for (Archer, Bows, before Dancer, Bows and Swords). Its "next steps" are the classes
 * that count it as a step before. Worked out from the exams, so nobody types it twice.
 */
export function stepsAround<E extends Pick<EntryContent, 'name' | 'categories' | 'sections' | 'header' | 'order'>>(entry: E, entries: E[]): { before: E[]; next: E[] } {
  const tiers = tierOrder(entries);
  const classes = entries.filter((e) => !e.header);
  const beforeOf = (c: E): E[] => {
    const at = tiers.indexOf(tierOf(c));
    const mine = examOf(c);
    if (at <= 0 || !mine.length) return [];
    const skills = new Set(mine.map((n) => n.skill.toLowerCase()));
    const scored = classes.filter((o) => tierOf(o) === tiers[at - 1]).map((o) => {
      const theirs = examOf(o);
      // Builds on it: this exam asks for every skill the other one trains (Pugilist, Gauntlets, before Warrior).
      const within = theirs.length > 0 && theirs.every((n) => skills.has(n.skill.toLowerCase()));
      return { o, s: alike(mine, theirs), within };
    }).filter((x) => x.s > 0);
    const best = Math.max(0, ...scored.map((x) => x.s));
    // The most alike first, then the others it builds on, by name.
    return [...scored.filter((x) => x.s === best), ...scored.filter((x) => x.s < best && x.within).sort((a, b) => a.o.name.localeCompare(b.o.name))].map((x) => x.o);
  };
  const same = (a: E, b: E) => a.name === b.name;
  return {
    before: beforeOf(entry),
    next: classes.filter((c) => !same(c, entry) && beforeOf(c).some((b) => same(b, entry))),
  };
}
