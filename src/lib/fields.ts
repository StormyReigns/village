// The fields of a Characters or Items Block: the common ones builders start from, the kinds
// a builder can add, where each value lives on an entry, and the "John Doe" sample the
// builder's preview fills in. See FieldDef in src/data/pages/types.ts.

import type { Block, BlockType, EntryContent, FieldDef, FieldKind, Route, Section, StatDef } from '@/data/pages/types';
import { STEPS, TIP, WATCH_OUT, WRITEUP } from './guides.ts';

/** Fields whose values are the entry's own description and stats, not a section. */
export const DESCRIPTION = '@description';
export const STATS = '@stats';
/** The community's tier from a Tier list, as a big letter on the portrait (docs/blocks/tier-lists.md). */
export const TIER = '@tier';

/** The kinds a builder can pick for a field of their own, with a word on each. */
export const FIELD_KINDS: { kind: FieldKind; label: string; hint: string }[] = [
  { kind: 'text', label: 'Short text', hint: 'A word or two, like a voice actor' },
  { kind: 'number', label: 'Number', hint: 'Like a level or a price' },
  { kind: 'tag', label: 'Tag', hint: 'A pill under the name, and a filter' },
  { kind: 'place', label: 'Place', hint: 'Shown under the name with a pin' },
  { kind: 'when', label: 'When', hint: 'A chapter, date or time, with a clock' },
  { kind: 'list', label: 'List', hint: 'One per line. "Name: what it does" works' },
  { kind: 'links', label: 'Other characters', hint: 'Other characters, one per line: "Name: how they know them"' },
  { kind: 'longtext', label: 'Long text', hint: 'A few sentences' },
  { kind: 'yesno', label: 'Yes or no', hint: 'Shows as a pill when it is yes' },
  { kind: 'playable', label: 'Toggle', hint: 'One of two, like Playable or NPC: a green or red pill under the name, and a filter' },
  { kind: 'chart', label: 'Chart', hint: 'Numbers like stats or growths: a web by the portrait and boxes colored against the rest' },
];

/** The kinds as an Items Block offers them: links point at other items there. */
const ITEM_KINDS = FIELD_KINDS.map((k) => (k.kind === 'links' ? { ...k, label: 'Other items', hint: 'Other items, one per line: "Iron Ore: 3" for how many' } : k));

/** The kinds as a Guides Block offers them: no charts, links point at other guides, Steps and Write-up. */
const GUIDE_KINDS = [
  ...FIELD_KINDS.filter((k) => k.kind !== 'chart').map((k) => (k.kind === 'links' ? { ...k, label: 'Other guides', hint: 'Other guides, one per line: "Name: why"' } : k)),
  { kind: 'steps' as const, label: 'Steps', hint: 'Numbered steps, one per line. Any step can be a spoiler or have a picture' },
  { kind: 'writeup' as const, label: 'Write-up', hint: 'A short article: sections with a heading, a few paragraphs and a picture. Any section can be a spoiler' },
];

export const kindsFor = (type?: BlockType) => (type === 'items' ? ITEM_KINDS : type === 'guide' ? GUIDE_KINDS : FIELD_KINDS);
export const kindLabel = (k: FieldKind, type?: BlockType) => (k === 'tier' ? 'Community tier' : kindsFor(type).find((x) => x.kind === k)?.label ?? k);

/** Blocks whose entries are laid out by their fields (Characters, Items, Guides), not a Collection's fixed parts. */
export const byFields = (block: Pick<Block, 'type'>) => block.type === 'characters' || block.type === 'items' || block.type === 'guide';

/** "Playable or NPC": one of the common fields (not one builders add), a green or red pill. */
export const PLAYABLE = { yes: 'Playable', no: 'NPC' } as const;

/** A toggle's two choices: its own, else read from a name like "Day or night", else Yes / No.
 *  The common "Playable or NPC" field gives Playable and NPC. */
export function toggleOptions(f: Pick<FieldDef, 'options' | 'label'>): [string, string] {
  if (f.options?.[0] && f.options[1]) return f.options;
  const m = f.label.match(/^(.+?)\s+or\s+(.+)$/i);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return m ? [cap(m[1].trim()), cap(m[2].trim())] : ['Yes', 'No'];
}

/** Fields kept as an entry's category (so they can be filtered on), not as a section. */
export const isCategory = (f: FieldDef) => f.kind === 'tag' || f.kind === 'playable';

/** A chart's stats: the Block's own for its first chart, else the field's. */
export const chartDefs = (block: Pick<Block, 'stats'>, f: FieldDef): StatDef[] => (f.key === STATS ? block.stats ?? [] : f.stats ?? []);

/** Every stat of every chart that's switched on, in field order (for sorting and change lists). */
export const allStatDefs = (block: Pick<Block, 'fields' | 'stats'>) => shownFields(block).filter((f) => f.kind === 'chart').flatMap((f) => chartDefs(block, f));

/** The key a new stat gets in a chart: plain for the first chart, else after the field's key. */
export const statKeyFor = (f: FieldDef, slug: string) => (f.key === STATS ? slug : `${f.key}.${slug}`);

/** The common fields every new Characters Block starts with. Builders switch, rename and reorder them. */
export const COMMON_FIELDS: FieldDef[] = [
  { key: 'Playable', label: 'Playable or NPC', kind: 'playable', off: true },
  { key: TIER, label: 'Community tier', kind: 'tier' },
  { key: 'Age', label: 'Age', kind: 'text', beside: true },
  { key: 'Role or class', label: 'Role or class', kind: 'tag' },
  { key: 'Location', label: 'Location', kind: 'place' },
  { key: 'Time of arrival', label: 'Time of arrival', kind: 'when' },
  { key: STATS, label: 'Stats', kind: 'chart' },
  { key: 'Skills', label: 'Skills', kind: 'list' },
  { key: DESCRIPTION, label: 'Description', kind: 'longtext' },
  { key: 'How to recruit', label: 'How to recruit', kind: 'longtext' },
  { key: 'Relationships', label: 'Relationships', kind: 'links' },
  { key: 'Likes and gifts', label: 'Likes and gifts', kind: 'list', off: true },
];

/** Items: what they're made from and what they upgrade to, kept under these keys so the
 *  other side ("Used to make", "Upgrades from") can be worked out. */
export const MADE_FROM = 'Made from';
export const UPGRADES_TO = 'Upgrades to';

/** The common fields every new Items Block starts with. Stats show as number boxes, no web. */
export const ITEM_FIELDS: FieldDef[] = [
  { key: 'Type', label: 'Type', kind: 'tag' },
  { key: TIER, label: 'Community tier', kind: 'tier', off: true },
  { key: 'Rank', label: 'Rank or rarity', kind: 'tag', off: true, tile: true },
  { key: 'Price', label: 'Price', kind: 'number', off: true, tile: true },
  { key: 'Sell price', label: 'Sell price', kind: 'number', off: true },
  { key: STATS, label: 'Stats', kind: 'chart', off: true, tile: true, noWeb: true },
  { key: 'What it does', label: 'What it does', kind: 'longtext' },
  { key: 'Where to get it', label: 'Where to get it', kind: 'list' },
  { key: MADE_FROM, label: 'Made from', kind: 'links' },
  { key: UPGRADES_TO, label: 'Upgrades to', kind: 'links', off: true },
  { key: 'Who can use it', label: 'Who can use it', kind: 'text', off: true },
  { key: DESCRIPTION, label: 'Description', kind: 'longtext', off: true },
];

/** The common fields every Guides Block starts with (docs/blocks/guides.md). The starter order is
 *  the guide's: the answer, the warning, the body, the tip. The body is Steps or Write-up (a
 *  guide uses one; the writer picks it). The keys are the ones the guides already live use, so
 *  they keep their steps and tips. */
export const GUIDE_FIELDS: FieldDef[] = [
  { key: 'Kind', label: 'Kind', kind: 'tag', off: true },
  { key: 'Difficulty', label: 'Difficulty', kind: 'tag', off: true },
  { key: 'When', label: 'When', kind: 'when', off: true },
  { key: DESCRIPTION, label: 'In short', kind: 'longtext' },
  { key: WATCH_OUT, label: 'Watch out', kind: 'list' },
  { key: STEPS, label: 'Steps', kind: 'steps' },
  { key: WRITEUP, label: 'Write-up', kind: 'writeup' },
  { key: TIP, label: 'Tip', kind: 'longtext' },
  { key: 'What you get', label: 'What you get', kind: 'list', off: true },
];

/** The common fields for a Block type: Items and Guides have their own, Characters the set above. */
export const commonFor = (type?: BlockType) => (type === 'items' ? ITEM_FIELDS : type === 'guide' ? GUIDE_FIELDS : COMMON_FIELDS);

/** A Block's own fields plus any common field it doesn't have yet (switched off), so a Block
 *  set up before a common field existed can still switch it on. The community tier is the one
 *  exception: missing, it keeps its default (on for Characters, off for Items), as showsTier does. */
export const withCommon = (fields: FieldDef[], type?: BlockType) => [...fields, ...commonFor(type).filter((c) => !fields.some((f) => sameField(f, c))).map((c) => ({ ...c, off: c.key === TIER ? c.off : true }))];

/** Whether the Block's cards show the community tier: as set up, else on for Characters and off for Items. */
export function showsTier(block: Pick<Block, 'fields'> & Partial<Pick<Block, 'type'>>) {
  const f = fieldsOf(block).find((x) => x.key === TIER);
  return f ? !f.off : block.type === 'characters';
}

/** The same common field, even if a Block keeps it under another key ('Recruit' for How to recruit). */
const sameField = (f: FieldDef, c: FieldDef) => f.key === c.key || f.label.toLowerCase() === c.label.toLowerCase();

/** A Block's fields, or the common ones for its type if it hasn't set any. */
export const fieldsOf = (block: Pick<Block, 'fields'> & Partial<Pick<Block, 'type'>>) => block.fields?.length ? block.fields : commonFor(block.type);

/** Fields that are switched on. */
export const shownFields = (block: Pick<Block, 'fields'> & Partial<Pick<Block, 'type'>>) => fieldsOf(block).filter((f) => !f.off);

/** The most a tile holds, so tiles stay small and even. */
export const TILE_MAX = 3;
/** Kinds that fit on a tile: long text, lists and links don't. */
export const canTile = (f: FieldDef) => !['longtext', 'list', 'links', 'steps', 'writeup', 'tier'].includes(f.kind) && f.key !== DESCRIPTION;
/** What an item's tile shows, in the builders' order. */
export const tileFields = (block: Pick<Block, 'fields'> & Partial<Pick<Block, 'type'>>) => shownFields(block).filter((f) => f.tile && canTile(f)).slice(0, TILE_MAX);

/** The other side of a links field: entries whose `key` field names this one (what a
 *  material is used to make, what an item upgrades from), with the note they give. */
export function linkedFrom(name: string, entries: EntryContent[], key: string) {
  const me = name.trim().toLowerCase();
  if (!me) return [];
  return entries.flatMap((e) => {
    const hit = listItems(e.sections.find((s) => s.label === key)?.text ?? '').find((i) => i.name.toLowerCase() === me);
    return hit && e.name.trim().toLowerCase() !== me ? [{ name: e.name, note: hit.note }] : [];
  });
}

/** A links note that's just a number is an amount: "3" reads "× 3". */
export const amountText = (note: string) => (/^\d+$/.test(note.trim()) ? `× ${note.trim()}` : note);

/** Where on the card a field goes. */
export type Spot = 'beside' | 'tags' | 'meta' | 'chart' | 'body' | 'section' | 'portrait';
export function spotOf(f: FieldDef): Spot {
  // Short text and numbers sit small beside the name, like Age.
  if (f.beside || f.kind === 'text' || f.kind === 'number') return 'beside';
  if (f.key === DESCRIPTION) return 'body';
  // The community tier sits on the portrait, drawn by the card itself (no value on the entry).
  if (f.kind === 'tier') return 'portrait';
  return ({ tag: 'tags', yesno: 'tags', playable: 'tags', place: 'meta', when: 'meta', chart: 'chart' } as Partial<Record<FieldKind, Spot>>)[f.kind] ?? 'section';
}

/** A value beside the name: "Age 34" for ages and numbers, else just the value. */
export const besideText = (f: FieldDef, v: string) => (/\bage\b/i.test(f.label) || f.kind === 'number' ? `${f.label} ${v}` : v);

/** A field's value on an entry: its text everywhere, and any route-specific texts. */
export interface FieldValue { text?: string; byRoute: [Route, string][] }

export function valueOf(entry: EntryContent, f: FieldDef): FieldValue {
  if (f.key === DESCRIPTION) return { text: entry.description?.trim() || undefined, byRoute: [] };
  if (isCategory(f)) return { text: entry.categories[f.key]?.trim() || undefined, byRoute: [] };
  const text = entry.sections.find((s) => s.label === f.key)?.text.trim() || undefined;
  const byRoute = Object.entries(entry.perRoute ?? {}).flatMap(([r, ss]) => {
    const t = (ss as Section[]).find((s) => s.label === f.key)?.text.trim();
    return t ? [[r as Route, t] as [Route, string]] : [];
  });
  return { text, byRoute };
}

/** Whether an entry has anything for this field (the chart counts its numbers). */
export function hasValue(entry: EntryContent, f: FieldDef) {
  if (f.kind === 'chart') {
    // The first chart's stats have plain keys; another chart's start with its key and a dot.
    const mine = (k: string) => (f.key === STATS ? !k.includes('.') : k.startsWith(`${f.key}.`));
    return Object.keys(entry.stats ?? {}).some(mine);
  }
  const v = valueOf(entry, f);
  return Boolean(v.text || v.byRoute.length);
}

/** "Name: what it does" lines, split for showing. Lines without a colon are just a name. */
export function listItems(text: string) {
  return text.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const at = l.indexOf(':');
    return at > 0 ? { name: l.slice(0, at).trim(), note: l.slice(at + 1).trim() } : { name: l, note: '' };
  });
}

/** Made-up values for an Items Block's sample, for its common fields. */
const ITEM_SAMPLE: Partial<Record<string, string>> = {
  Type: 'Material', Rank: 'B', Price: '1200', 'Sell price': '600', 'What it does': 'What the item does, in a sentence or two.',
  'Where to get it': 'Some town: Sold at the market\nOld mine: In a chest', [MADE_FROM]: 'Iron Ore: 3\nOak Log: 1', [UPGRADES_TO]: 'Sample item +1', 'Who can use it': 'Anyone',
};

/** Made-up values for the builder's preview, one per kind. */
const SAMPLE: Record<FieldKind, string> = {
  text: 'Sample', number: '12', tag: 'Tag', place: 'Some town', when: 'Chapter 3', chart: '',
  list: 'Skill name: What it does.', links: 'Jane Doe: Friend', longtext: 'A sentence or two goes here.', yesno: 'Yes', playable: PLAYABLE.yes,
  steps: 'The first thing to do\nThe next thing to do\n||A step that gives something away||',
  tier: '',
  writeup: 'A few words to start.\n## A heading\nA paragraph or two under it.\n## Late game\n[spoiler]\nA part that gives something away.',
};

/** Made-up values for a Guides Block's sample, for its common fields. */
const GUIDE_SAMPLE: Partial<Record<string, string>> = {
  Kind: 'Beat a fight', Difficulty: 'Hard', When: 'Chapter 3', [WATCH_OUT]: "Keep your healer out of the archers' reach",
  [STEPS]: 'Move your fastest unit to the bridge\nKill the two archers on the walls first\n||The boss never leaves the throne, so heal up before you attack||',
  [TIP]: 'A tip that helps, in a sentence or two.', 'What you get': 'Silver Sword\n500 gold',
  // A guide has one body; the sample shows Steps, and the Write-up example shows the other.
  [WRITEUP]: '',
};

/**
 * "John Doe": a sample character with every switched-on field filled in, so builders see
 * the card their choices make before anyone adds a real one.
 */
export function johnDoe(block: Pick<Block, 'fields' | 'stats'> & Partial<Pick<Block, 'type'>>): EntryContent {
  const sections: Section[] = [];
  const categories: Record<string, string> = {};
  let description: string | undefined;
  // An Items Block's sample is an item, with item-like values for its common fields.
  const item = block.type === 'items';
  // A Guides Block's sample is a guide.
  const guide = block.type === 'guide';
  for (const f of shownFields(block)) {
    if (f.kind === 'chart' || f.kind === 'tier') continue;
    if (f.key === DESCRIPTION) {
      description = guide ? 'Bring two archers and take out the healers first. The boss never moves, so you can rest before the last push.'
        : item ? 'A line or two of flavor or extra notes goes here.' : 'A few lines about who they are and why you would bring them along go here.';
      continue;
    }
    const v = (item ? ITEM_SAMPLE[f.key] : guide ? GUIDE_SAMPLE[f.key] : undefined) ?? (/\bage\b/i.test(f.label) ? '30' : f.kind === 'tag' ? f.label : f.kind === 'playable' ? toggleOptions(f)[0]
      : item && f.kind === 'links' ? 'Sample part: 2' : SAMPLE[f.kind]);
    if (isCategory(f)) categories[f.key] = v;
    else sections.push({ label: f.key, text: v });
  }
  const defs = shownFields(block).filter((f) => f.kind === 'chart').flatMap((f) => chartDefs(block, f));
  const stats = defs.length ? Object.fromEntries(defs.map((d, i) => [d.key, 8 + ((i * 7) % 13)])) : undefined;
  return { name: item ? 'Sample item' : guide ? 'Beat the bridge fort' : 'John Doe', description, sections, categories, stats };
}
