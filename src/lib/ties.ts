import type { Entry, Route } from '@/data/pages';

// What a party member's plan hangs on that's tracked somewhere else (docs/blocks/planner.md, 2026-11-22): a last
// chance their recruiting needs (Buccar: "clear Leda's Paralogue"), an item it asks for (Goliath: Giant's Meat), or
// what a planned class's unlock names. Found by name, both ways, like the app's text links, so builders set nothing
// up; the tick is the same one as on Last chances or the item's card. Plain and tested (ties.test.ts).

/** Something with its own tick elsewhere: a checklist entry (ticked "block.entry") or an item ("got:block.entry"). */
export interface TieCandidate {
  kind: 'deadline' | 'item';
  /** Its tick in the shared store. */
  key: string;
  name: string;
  /** Its own words (description and sections), where it may name the unit it's for. */
  text: string;
  /** Opens it: /g/<game>/<page>?e=<block>.<entry>. */
  href: string;
  routes?: Route[];
  spoiler?: boolean;
}

/** An entry's words, for matching: its description and every section, on every route. */
export function wordsOf(e: Pick<Entry, 'description' | 'sections' | 'perRoute'>): string {
  const per = Object.values(e.perRoute ?? {}).flatMap((ss) => (ss ?? []).map((s) => s.text));
  return [e.description ?? '', ...e.sections.map((s) => s.text), ...per].join('\n');
}

/** The parts of a name worth matching on: the whole name, and each side of a colon when long enough
 *  ("Leda's Paralogue: Diversionary Tactics" is named either way in guides). */
function namesOf(name: string): string[] {
  const parts = name.split(':').map((p) => p.trim()).filter((p) => p.length >= 6);
  return [...new Set([name.trim(), ...parts])].filter((p) => p.length >= 3);
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const mentions = (text: string, name: string, caseSensitive = false) =>
  new RegExp(`(^|[^\\p{L}\\p{N}])${escape(name)}($|[^\\p{L}\\p{N}])`, caseSensitive ? 'u' : 'iu').test(text);

/**
 * What a unit (or a class) is tied to, among the candidates: one its own words name (forward), one that names it in
 * its words, as a whole word with its capitals (reverse: "Unlocks Diego", "Recruits Goliath"), or one that is simply
 * named after it (the "Creek" last chance). Each candidate once, in the candidates' order. `reverse: false` keeps only
 * what its own words name (a class's unlock).
 */
export function tiesFor(name: string, ownWords: string, candidates: TieCandidate[], { reverse = true } = {}): TieCandidate[] {
  return candidates.filter((c) =>
    (reverse && c.name.trim().toLowerCase() === name.trim().toLowerCase())
    || namesOf(c.name).some((n) => mentions(ownWords, n))
    || (reverse && name.trim().length >= 2 && namesForJoining(c.text, name.trim())));
}

/** Whether a text names the unit in a sentence about getting them ("Recruits Goliath", "Unlocks Diego", "Creek never
 *  joins"), so a gift "liked by Goliath" doesn't count as something Goliath needs. */
const JOINING = /\b(recruit|recruits|recruiting|unlock|unlocks|join|joins|joining)\b/i;
function namesForJoining(text: string, name: string): boolean {
  return text.split(/[.;!?\n]+/).some((s) => JOINING.test(s) && mentions(s, name, true));
}
