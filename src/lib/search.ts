// Forgiving search for players. People type questions ("how do i get goliath"), half-names
// ("giant meat") and typos ("golath"), so:
//   - filler words (how, do, i, get, where...) are ignored,
//   - results are ranked by how many words matched instead of needing every word,
//   - a name can be one letter off (an extra, missing, wrong or swapped letter).

const FILLER = new Set([
  'how', 'do', 'does', 'did', 'i', 'get', 'got', 'where', 'find', 'to', 'the', 'is', 'are', 'a', 'an', 'can',
  'you', 'what', 'whats', 'of', 'in', 'for', 'my', 'me', 'on', 'with', 'and', 'who', 'when', 'which', 'it', 'at',
]);

/** Lowercase words, without accents or apostrophes ("Giant's" becomes "giants"). */
export function words(text: string) {
  return text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/['’]/g, '')
    .split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/** The words worth searching for. A search made only of filler keeps them all. */
export function searchWords(query: string) {
  const all = words(query);
  const kept = all.filter((w) => !FILLER.has(w));
  return kept.length ? kept : all;
}

/** Are two words at most one letter apart? */
function oneOff(a: string, b: string) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) {
    return a.slice(i + 1) === b.slice(i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
  }
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

/** Letters to change to turn one word into another (for "did you mean"). */
function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length];
}

export interface Searchable { name: string; text: string }

/** How well one thing fits the search words: how many matched, and a score to sort by. */
function score(q: string[], item: Searchable) {
  const nameWords = words(item.name), name = nameWords.join(' '), hay = words(item.text).join(' ');
  let matched = 0, points = 0;
  for (const w of q) {
    if (nameWords.some((n) => n.startsWith(w))) { matched++; points += 4; }
    else if (name.includes(w)) { matched++; points += 3; }
    else if (w.length >= 4 && nameWords.some((n) => oneOff(n, w))) { matched++; points += 2; }
    else if (hay.includes(w)) { matched++; points += 1; }
  }
  return { matched, points: points + (matched === q.length ? 2 : 0) };
}

/** Things that match at least one search word, best first. */
export function rank<T>(items: T[], query: string, view: (item: T) => Searchable): T[] {
  const q = searchWords(query);
  if (!q.length) return items;
  return items
    .map((item) => ({ item, ...score(q, view(item)) }))
    .filter((r) => r.matched > 0)
    .sort((a, b) => b.matched - a.matched || b.points - a.points)
    .map((r) => r.item);
}

/** Names that look like what was typed, for "Did you mean" when nothing matched. */
export function closest<T>(items: T[], query: string, view: (item: T) => Searchable, max = 3): T[] {
  const q = searchWords(query).filter((w) => w.length >= 3);
  if (!q.length) return [];
  return items
    .map((item) => {
      const nameWords = words(view(item).name);
      // How far off the closest word is, allowing more slack for longer words.
      const best = Math.min(...q.flatMap((w) => nameWords.map((n) => distance(w, n.slice(0, w.length + 2)) - Math.floor(w.length / 3))));
      return { item, best };
    })
    .filter((r) => r.best <= 0)
    .sort((a, b) => a.best - b.best)
    .slice(0, max)
    .map((r) => r.item);
}
