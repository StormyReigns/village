// The letters inside an entry's piece when it has no picture or symbol: the first letters of its first
// two words that matter. Small joining words don't ("Inside the Deku Tree" is DT, "Temple of Time" TT),
// unless the name is nothing but small words.

const SMALL = new Set([
  'a', 'an', 'the', 'of', 'and', 'or', 'to', 'in', 'into', 'inside', 'on', 'onto', 'at', 'by', 'for', 'from',
  'with', 'within', 'over', 'under', 'beneath', 'below', 'above', 'through', 'near', 'von', 'van', 'de', 'du', 'der',
]);

export function initials(name: string) {
  const words = name.replace(/[^\p{L}\p{N}\s'-]/gu, '').split(/\s+/).filter(Boolean);
  const big = words.filter((w) => !SMALL.has(w.toLowerCase()));
  return (big.length ? big : words).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}
