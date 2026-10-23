import type { Block, Entry, Page, Tint } from './types';

// Clean, shareable addresses for a Block or an entry:
//   /g/fortunes-weave/items/items           the Items Block
//   /g/fortunes-weave/items/paradise-fish   an entry
// An entry uses its own name, unless another Block on the Page has the same one (or a
// Block is called that), then it's "block.entry" so the address stays unambiguous.

export function itemParam(page: Page, block: Block, entry?: Entry): string {
  if (!entry) return block.id;
  const clash = page.blocks.some((b) => b.id === entry.id || (b.id !== block.id && b.entries.some((e) => e.id === entry.id)));
  return clash ? `${block.id}.${entry.id}` : entry.id;
}

export function sharePath(gameId: string, page: Page, block: Block, entry?: Entry) {
  return `/g/${gameId}/${page.id}/${itemParam(page, block, entry)}`;
}

/** What a share address points at: a Block, or an entry inside one. */
export function resolveItem(page: Page, item: string): { block: Block; entry?: Entry } | null {
  const decoded = decodeURIComponent(item);
  const [b, e] = decoded.includes('.') ? decoded.split('.') : [null, decoded];
  if (b) {
    const block = page.blocks.find((x) => x.id === b);
    const entry = block?.entries.find((x) => x.id === e);
    return block && entry ? { block, entry } : null;
  }
  const block = page.blocks.find((x) => x.id === decoded);
  if (block) return { block };
  for (const x of page.blocks) {
    const entry = x.entries.find((y) => y.id === decoded);
    if (entry) return { block: x, entry };
  }
  return null;
}

/** The Pages' colors as plain hex, for places CSS variables can't reach (previews, Discord). */
export const TINT_HEX: Record<Tint, string> = {
  leaf: '#3f9a4e', sky: '#2f86c9', berry: '#d9506d', sun: '#d48a10', plum: '#8a5bc4', teal: '#1b8f8a',
};

/** A short plain-words summary of an entry, for link previews. Spoilers stay hidden. */
export function summarize(block: Block, entry: Entry, routeNames: Record<string, string> = {}): { label: string; text: string }[] {
  if (entry.spoiler) return [{ label: 'Spoiler', text: 'Open it in the app to read.' }];
  const facts: { label: string; text: string }[] = [];
  if (entry.stat) facts.push({ label: block.statName ?? 'Key fact', text: entry.stat });
  for (const [k, v] of Object.entries(entry.categories)) facts.push({ label: k, text: v });
  if (entry.perRoute) {
    for (const [r, ss] of Object.entries(entry.perRoute)) {
      const s = ss?.[0];
      if (s) facts.push({ label: `${s.label} as ${routeNames[r] ?? r}`, text: s.text });
    }
  }
  for (const s of entry.sections) facts.push({ label: s.label, text: s.text.split('\n')[0] });
  return facts;
}

export const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
