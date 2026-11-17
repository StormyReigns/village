// Small helpers for the Items Block (src/components/app/Items.tsx).

/** Letter ranks as games use them, best first: S, then A down to F. A range ("B–A") sits
 *  with its best letter, after the plain rank. */
const LETTERS = ['SSS', 'SS', 'S', 'A', 'B', 'C', 'D', 'E', 'F'];
const letterOf = (v: string) => /^(S{1,3}|[A-F])(?:\s*[–-]\s*(S{1,3}|[A-F]))?\+?$/.exec(v.trim());
const bestLetter = (v: string) => {
  const m = letterOf(v);
  if (!m) return -1;
  return Math.min(...[m[1], m[2]].filter(Boolean).map((l) => LETTERS.indexOf(l)));
};

/**
 * The order a tag's groups show in: letter ranks best first (S, A, B... with "No rank" and
 * the like after them) when most values are letters; otherwise as they first appear, which
 * is the builders' order.
 */
export function groupOrder(values: string[]): string[] {
  const letters = values.filter((v) => letterOf(v));
  if (letters.length < Math.max(2, values.length / 2)) return values;
  const at = (v: string) => (letterOf(v) ? bestLetter(v) : LETTERS.length);
  // Within a letter, the plain rank first ("A" before "B–A").
  return [...values].sort((a, b) => at(a) - at(b) || Number(a.length > 1) - Number(b.length > 1) || values.indexOf(a) - values.indexOf(b));
}

/** A number on an entry, for the standout badges (kept loose so tests need no full Entry). */
interface Numbered { id: string; stats?: Record<string, number> }
interface Stat { key: string; label: string; better: 'high' | 'low' }

/** The word for being best at a stat: "Strongest" for Might, "Lightest" for Weight... */
export function standoutWord(d: Stat): string {
  const l = d.label.toLowerCase();
  const words: [RegExp, string, string][] = [
    [/might|attack|\batk\b|\bstr\b|strength|power|damage|\bdmg\b/, 'Strongest', 'Weakest'],
    [/\bhit\b|accura|\bacc\b/, 'Most accurate', 'Least accurate'],
    [/weight|\bwt\b/, 'Heaviest', 'Lightest'],
    [/crit/, 'Best crit', 'Lowest crit'],
    [/def|armou?r|protect/, 'Toughest', 'Least armor'],
    [/speed|\bspd\b|agility/, 'Fastest', 'Slowest'],
    [/range|reach/, 'Longest reach', 'Shortest reach'],
    [/uses|durab/, 'Lasts longest', 'Fewest uses'],
    [/price|cost/, 'Priciest', 'Cheapest'],
  ];
  const hit = words.find(([re]) => re.test(l));
  if (hit) return d.better === 'high' ? hit[1] : hit[2];
  return d.better === 'high' ? `Best ${l}` : `Lowest ${l}`;
}

/**
 * Standout badges: the one entry best at each stat (higher or lower, as the stat says) gets
 * that stat's word. Only a clear winner counts (no ties), only once at least three entries
 * have the number, and an entry keeps the first word it earns, in the stats' order.
 */
export function standouts(entries: Numbered[], defs: Stat[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const d of defs) {
    const have = entries.filter((e) => typeof e.stats?.[d.key] === 'number');
    if (have.length < 3) continue;
    const val = (e: Numbered) => e.stats![d.key] * (d.better === 'high' ? 1 : -1);
    const best = Math.max(...have.map(val));
    const top = have.filter((e) => val(e) === best);
    if (top.length === 1 && !out.has(top[0].id)) out.set(top[0].id, standoutWord(d));
  }
  return out;
}

/** How a section of items is drawn: up to 16 as cards, up to 60 as small icon tiles, more as
 *  icon rows (Matt, 2026-11-15: a big shelf of cards falls apart; 2026-11-16: cards for 16 or
 *  fewer, the rest scaled from there). Tiles and rows scroll sideways rather than fold. */
export type Density = 'cards' | 'tiles' | 'rows';
export const CARDS_UP_TO = 16;
export const TILES_UP_TO = 60;
export const densityFor = (count: number): Density => (count <= CARDS_UP_TO ? 'cards' : count <= TILES_UP_TO ? 'tiles' : 'rows');

/** Sections with fewer items than this fold into one "Other" section (Matt, 2026-11-16). */
export const SMALL_SECTION = 5;

/**
 * Folds the small sections (and any untagged "Other") into one "Other" at the end, keeping
 * their order inside it and naming the types it holds. Left alone when only one section is
 * small (an "Other" of one type would just rename it) or when every section is small.
 */
export function foldSmall<T>(groups: { name: string; items: T[] }[], min = SMALL_SECTION, other = 'Other'): { name: string; items: T[]; holds?: string[] }[] {
  const small = groups.filter((g) => g.items.length < min || g.name === other);
  const big = groups.filter((g) => !small.includes(g));
  if (small.length < 2 || !big.length) return groups;
  return [...big, { name: other, items: small.flatMap((g) => g.items), holds: small.map((g) => g.name).filter((n) => n !== other) }];
}
