import type { Block, Entry, Page } from './types';
import { placeText, statFacts } from '../../lib/stats.ts';
import { STEPS, TIP, WRITEUP, parseSteps, parseWriteup } from '../../lib/guides.ts';

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

/** A shared Block or entry on whichever Page it is on now, for links made before it moved. */
export function findItem(pages: Page[], item: string): { page: Page; block: Block; entry?: Entry } | null {
  for (const page of pages) {
    const hit = resolveItem(page, item);
    if (hit) return { page, ...hit };
  }
  return null;
}

/**
 * Where an old Page address leads now: the Page holding the Block an "?e=block.entry" link
 * opens, else the Page it was renamed to (a game's movedPages). Null when it leads nowhere.
 */
export function movedPagePath(gameId: string, pages: Page[], moved: Record<string, string> | undefined, pageId: string, query: Record<string, string | string[] | undefined>): string | null {
  const e = typeof query.e === "string" ? query.e : undefined;
  const byEntry = e?.includes(".") ? pages.find((p) => p.blocks.some((b) => b.id === e.split(".")[0])) : undefined;
  const to = byEntry ?? pages.find((p) => p.id === moved?.[pageId]);
  if (!to || to.id === pageId) return null;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) for (const x of Array.isArray(v) ? v : v === undefined ? [] : [v]) qs.append(k, x);
  return `/g/${gameId}/${to.id}${qs.size ? `?${qs}` : ""}`;
}

/** A short plain-words summary of an entry, for link previews. Spoilers stay hidden. */
export function summarize(block: Block, entry: Entry, routeNames: Record<string, string> = {}): { label: string; text: string }[] {
  if (entry.spoiler) return [{ label: 'Spoiler', text: 'Open it in the app to read.' }];
  const facts: { label: string; text: string }[] = [];
  if (entry.stat) facts.push({ label: block.statName ?? 'Key fact', text: entry.stat });
  for (const d of block.stats ?? []) {
    const f = statFacts(d, entry, block.entries);
    if (f) facts.push({ label: d.label, text: [f.value, placeText(f)].filter(Boolean).join(' · ') });
  }
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

export interface ShareAnswer {
  /** Short answers for the picture's white boxes. */
  facts: { label: string; text: string }[];
  /** A guide's numbered steps. */
  steps: string[];
  tip?: string;
  /** Text-first entries (questions) that need the whole width instead of an icon tile. */
  wide?: boolean;
  /** The answer in words, for the text Discord shows above the picture. */
  text: string;
}

/**
 * What a shared entry should tell people without them clicking: a guide's steps, an
 * item's where-and-what, or else its description. Spoilers stay hidden.
 */
export function shareAnswer(block: Block, entry: Entry, routeNames: Record<string, string> = {}): ShareAnswer {
  const flat = (s: string) => s.replace(/\s*\n\s*/g, ' ').trim();
  if (entry.spoiler) {
    return { facts: [{ label: 'Spoiler', text: 'Open it in the app to read.' }], steps: [], text: 'Spoiler: open it in the app to read.' };
  }
  const stepList = block.type === 'guide' ? entry.sections.find((s) => s.label === STEPS) : undefined;
  if (stepList) {
    // A spoiler step stays covered in a share card too, and picture marks never show as text.
    const steps = parseSteps(stepList.text).map((x) => (x.spoiler ? 'A spoiler: open it in the app to read' : x.text || 'See the picture in the app'));
    const tip = entry.sections.find((s) => s.label === TIP)?.text;
    const text = [entry.description && flat(entry.description), steps.map((s, i) => `${i + 1}. ${s.replace(/[.!]$/, '')}.`).join(' '), tip && `Tip: ${flat(tip)}`];
    return { facts: [], steps, tip, text: clip(text.filter(Boolean).join(' '), 300) };
  }
  const writeup = block.type === 'guide' ? entry.sections.find((s) => s.label === WRITEUP) : undefined;
  if (writeup) {
    // A write-up: its sections as facts, a spoiler section covered (heading, words and picture).
    const facts = parseWriteup(writeup.text).slice(0, 4).map((s) => (s.spoiler
      ? { label: 'Spoiler', text: 'Open it in the app to read.' }
      : { label: s.heading || 'Guide', text: flat(s.text) || 'See the picture in the app.' }));
    const tip = entry.sections.find((s) => s.label === TIP)?.text;
    const text = [entry.description && flat(entry.description), ...facts.map((f) => (f.label === 'Guide' ? f.text : `${f.label}: ${f.text}`)), tip && `Tip: ${flat(tip)}`];
    return { facts, steps: [], tip, wide: true, text: clip(text.filter(Boolean).join(' '), 300) };
  }
  const all = summarize(block, entry, routeNames);
  const types = Object.values(entry.categories);
  // The entry's type already shows at the top, and an unnamed key fact that only repeats
  // it (a Mystery's "Theory") says nothing new. The answers are everything else.
  const answers = all.filter((f) => !(f.label in entry.categories) && !(f.label === 'Key fact' && types.includes(f.text)));
  const about = entry.description ? flat(entry.description) : '';
  const question = entry.name.trim().endsWith('?');
  if (about && (question || !answers.length)) {
    // Its own words are the content: what's known about a Mystery, who a unit is.
    // Questions get the whole width, like guides.
    const text = [about, ...answers.map((f) => `${f.label}: ${flat(f.text)}`)].join(' · ');
    return { facts: [{ label: question ? 'What we know so far' : 'About', text: about }], steps: [], wide: question, text: clip(text, 300) };
  }
  const facts = answers.length ? answers : all;
  const text = [answers.length && entry.description ? flat(entry.description) : '', ...facts.map((f) => `${f.label}: ${flat(f.text)}`)];
  return { facts, steps: [], text: clip(text.filter(Boolean).join(' · '), 300) };
}

/** Every entry a player can see, as a name and a link, for linking names inside entry text. */
export function entryLinks(gameId: string, pages: Page[]) {
  return pages.flatMap((p) => p.blocks.flatMap((b) => b.entries.filter((e) => !e.spoiler).map((e) => ({ name: e.name, href: sharePath(gameId, p, b, e) }))));
}

export interface Mention { name: string; where: string; href: string }

/**
 * For map Blocks on this Page: the other entries that mention a region or place by name
 * (an item "in Saveilon", a unit recruited "at Dagsion"), keyed by the lowercase name.
 * This is "What's here" when a player opens a region or a place. Spoilers stay out.
 */
export function mapMentions(gameId: string, pages: Page[], page: Page): Record<string, Mention[]> {
  const names = new Set<string>();
  for (const b of page.blocks) {
    if (b.look !== 'map') continue;
    const by = b.filters?.[0];
    for (const e of b.entries) { names.add(e.name); if (by && e.categories[by]) names.add(e.categories[by]); }
  }
  if (!names.size) return {};
  const all = pages.flatMap((p) => p.blocks.flatMap((b) => b.entries.filter((e) => !e.spoiler).map((e) => ({ p, b, e }))));
  const text = (e: Entry) => [e.description, ...e.sections.map((s) => s.text), ...Object.values(e.perRoute ?? {}).flat().map((s) => s.text)].join(' ');
  const out: Record<string, Mention[]> = {};
  for (const n of names) {
    if (n.length < 4) continue;
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'iu');
    const hits = all.filter(({ e }) => e.name !== n && re.test(text(e)));
    if (hits.length) {
      out[n.toLowerCase()] = hits.slice(0, 12).map(({ p, b, e }) => ({
        name: e.name, where: p.title === b.title ? p.title : `${p.title} · ${b.title}`, href: sharePath(gameId, p, b, e),
      }));
    }
  }
  return out;
}
