// Helpers for the Classes Block (docs/blocks/classes.md, src/components/app/Classes.tsx).
// Plain and tested (classes.test.ts): no React, no database.
//
// Nothing here knows a game. A Classes Block's shape comes from its own setup:
//   * the bands: its first tag (Tier in Fire Emblem, Role in World of Warcraft, the starting
//     class in Final Fantasy XIV), ordered by the bands' header cards;
//   * the path: "Leads to" (promotions, jobs, specs, subclasses), typed by builders, with
//     "Comes from" worked out on the other side;
//   * skill ranks, when a list field holds "Swords: B" lines (Fire Emblem's exams): then the path
//     also follows the skills, a tier at a time, so nobody has to type it.

import type { Block, EntryContent, FieldDef } from '../data/pages/types.ts';
import { LEADS_TO, isCategory, listItems, shownFields } from './fields.ts';

/** Skill ranks, lowest first, as games like Fire Emblem write them. */
const RANKS = ['E', 'E+', 'D', 'D+', 'C', 'C+', 'B', 'B+', 'A', 'A+', 'S', 'S+'];
export const rankAt = (r: string) => RANKS.indexOf(r.trim().toUpperCase());

export interface Need { skill: string; rank: string }

/** "Swords: B" lines as skills and ranks; lines that don't read that way are left out. */
export function needsOf(text: string | undefined): Need[] {
  if (!text) return [];
  return text.split('\n').map((l) => /^\s*(.+?)\s*:\s*([A-Za-z]\+?)\s*$/.exec(l)).filter((m): m is RegExpExecArray => !!m && rankAt(m[2]) >= 0)
    .map((m) => ({ skill: m[1], rank: m[2].toUpperCase() }));
}

/** Where a Classes Block keeps what its ladder and paths read: the band tag, the list of skill
 *  ranks (if it has one), and the "Leads to" links (if switched on). */
export interface ClassShape { band?: string; ranks?: string; leads?: string }

type ShapeBlock = Pick<Block, 'fields' | 'filters'> & Partial<Pick<Block, 'type'>> & { entries: Pick<EntryContent, 'sections' | 'header'>[] };

/** A list field reads as skill ranks when nearly every class that fills it writes only "Skill: Rank" lines. */
function isRanks(f: FieldDef, entries: Pick<EntryContent, 'sections' | 'header'>[]) {
  if (f.kind !== 'list') return false;
  const texts = entries.filter((e) => !e.header).map((e) => e.sections.find((s) => s.label === f.key)?.text?.trim()).filter((t): t is string => !!t);
  if (texts.length < 3) return false;
  const whole = texts.filter((t) => needsOf(t).length === t.split('\n').filter((l) => l.trim()).length);
  return whole.length >= texts.length * 0.8;
}

export function classShape(block: ShapeBlock): ClassShape {
  const fields = shownFields(block);
  const tags = fields.filter((f) => isCategory(f) && f.kind === 'tag');
  return {
    band: tags.find((f) => f.key === block.filters?.[0])?.key ?? tags[0]?.key,
    ranks: fields.find((f) => isRanks(f, block.entries))?.key,
    leads: fields.find((f) => f.kind === 'links' && f.key === LEADS_TO)?.key,
  };
}

export const bandOf = (e: Pick<EntryContent, 'categories'>, band?: string) => (band ? e.categories[band] ?? '' : '');
export const ranksOf = (e: Pick<EntryContent, 'sections'>, ranks?: string) => (ranks ? needsOf(e.sections.find((s) => s.label === ranks)?.text) : []);

/** The ranks in one short line: "Swords B · Bows B". */
export const rankLine = (e: Pick<EntryContent, 'sections'>, ranks?: string) => ranksOf(e, ranks).map((n) => `${n.skill} ${n.rank}`).join(' · ');

/**
 * The bands in order: the order of their header cards (a header is a band's own card, saying
 * what the tier takes or what the role does), then any band with no header, in the order its
 * classes come.
 */
export function bandOrder(entries: Pick<EntryContent, 'categories' | 'header' | 'order'>[], band?: string): string[] {
  if (!band) return [];
  const headed = entries.filter((e) => e.header && bandOf(e, band)).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((e) => bandOf(e, band));
  const rest = entries.filter((e) => !e.header).map((e) => bandOf(e, band)).filter(Boolean);
  return [...new Set([...headed, ...rest])];
}

/** How alike two sets of ranks are: skills in common over skills in either (1 is the same skills). */
function alike(a: Need[], b: Need[]) {
  const x = new Set(a.map((n) => n.skill.toLowerCase()));
  const y = new Set(b.map((n) => n.skill.toLowerCase()));
  const both = [...x].filter((s) => y.has(s)).length;
  return both ? both / new Set([...x, ...y]).size : 0;
}

type PathEntry = Pick<EntryContent, 'name' | 'categories' | 'sections' | 'header' | 'order'>;

/**
 * The classes a class leads to and comes from.
 *   * Typed: its "Leads to" (Squire leads to Knight; Warrior to Arms, Fury and Protection), and
 *     on the other side every class whose "Leads to" names it.
 *   * Worked out, when the Block has skill ranks and bands: games like Fire Emblem: Fortune's
 *     Weave have no fixed tree, and any unit can take any exam it has the ranks for. So the path
 *     follows the skills: a class comes from the previous band's classes whose ranks are most
 *     like its own (Myrmidon, Swords, before Shido, Swords), plus any whose skills it all asks
 *     for (Archer, Bows, before Dancer, Bows and Swords), and leads to the classes that count it
 *     that way.
 * Typed ones come first; nobody types either side twice.
 */
export function pathAround<E extends PathEntry>(entry: E, entries: E[], shape: ClassShape): { next: E[]; before: E[] } {
  // A band's header card is no class: it has no path.
  if (entry.header) return { next: [], before: [] };
  const classes = entries.filter((e) => !e.header);
  const same = (a: { name: string }, b: { name: string }) => a.name.trim().toLowerCase() === b.name.trim().toLowerCase();
  const named = (e: E) => (shape.leads ? listItems(e.sections.find((s) => s.label === shape.leads)?.text ?? '') : []);
  const typedNext = named(entry).flatMap((i) => classes.filter((c) => same(c, i) && !same(c, entry)));
  const typedBefore = classes.filter((c) => !same(c, entry) && named(c).some((i) => same(i, entry)));

  const bands = bandOrder(entries, shape.band);
  const beforeOf = (c: E): E[] => {
    const at = bands.indexOf(bandOf(c, shape.band));
    const mine = ranksOf(c, shape.ranks);
    if (!shape.ranks || at <= 0 || !mine.length) return [];
    const skills = new Set(mine.map((n) => n.skill.toLowerCase()));
    const scored = classes.filter((o) => bandOf(o, shape.band) === bands[at - 1]).map((o) => {
      const theirs = ranksOf(o, shape.ranks);
      // Builds on it: this class asks for every skill the other one trains (Pugilist, Gauntlets, before Warrior).
      const within = theirs.length > 0 && theirs.every((n) => skills.has(n.skill.toLowerCase()));
      return { o, s: alike(mine, theirs), within };
    }).filter((x) => x.s > 0);
    const best = Math.max(0, ...scored.map((x) => x.s));
    // The most alike first, then the others it builds on, by name.
    return [...scored.filter((x) => x.s === best), ...scored.filter((x) => x.s < best && x.within).sort((a, b) => a.o.name.localeCompare(b.o.name))].map((x) => x.o);
  };
  const rankedNext = classes.filter((c) => !same(c, entry) && beforeOf(c).some((b) => same(b, entry)));
  const unique = (es: E[]) => es.filter((e, i) => es.findIndex((x) => same(x, e)) === i);
  return { next: unique([...typedNext, ...rankedNext]), before: unique([...typedBefore, ...beforeOf(entry)]) };
}
