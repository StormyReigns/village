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
