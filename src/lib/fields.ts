// The fields of a Characters Block: the common ones builders start from, the kinds a
// builder can add, where each value lives on an entry, and the "John Doe" sample the
// builder's preview fills in. See FieldDef in src/data/pages/types.ts.

import type { Block, EntryContent, FieldDef, FieldKind, Route, Section, StatDef } from '@/data/pages/types';

/** Fields whose values are the entry's own description and stats, not a section. */
export const DESCRIPTION = '@description';
export const STATS = '@stats';

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
  { kind: 'chart', label: 'Chart', hint: 'Numbers like stats or growths: a web by the portrait and boxes colored against the rest' },
];

export const kindLabel = (k: FieldKind) => FIELD_KINDS.find((x) => x.kind === k)?.label ?? k;

/** A chart's stats: the Block's own for its first chart, else the field's. */
export const chartDefs = (block: Pick<Block, 'stats'>, f: FieldDef): StatDef[] => (f.key === STATS ? block.stats ?? [] : f.stats ?? []);

/** Every stat of every chart that's switched on, in field order (for sorting and change lists). */
export const allStatDefs = (block: Pick<Block, 'fields' | 'stats'>) => shownFields(block).filter((f) => f.kind === 'chart').flatMap((f) => chartDefs(block, f));

/** The key a new stat gets in a chart: plain for the first chart, else after the field's key. */
export const statKeyFor = (f: FieldDef, slug: string) => (f.key === STATS ? slug : `${f.key}.${slug}`);

/** The common fields every new Characters Block starts with. Builders switch, rename and reorder them. */
export const COMMON_FIELDS: FieldDef[] = [
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

/** A Block's fields, or the common ones if it hasn't set any. */
export const fieldsOf = (block: Pick<Block, 'fields'>) => block.fields?.length ? block.fields : COMMON_FIELDS;

/** Fields that are switched on. */
export const shownFields = (block: Pick<Block, 'fields'>) => fieldsOf(block).filter((f) => !f.off);

/** Where on the card a field goes. */
export type Spot = 'beside' | 'tags' | 'meta' | 'chart' | 'body' | 'section';
export function spotOf(f: FieldDef): Spot {
  if (f.beside) return 'beside';
  if (f.key === DESCRIPTION) return 'body';
  return ({ tag: 'tags', yesno: 'tags', place: 'meta', when: 'meta', chart: 'chart' } as Partial<Record<FieldKind, Spot>>)[f.kind] ?? 'section';
}

/** A value beside the name: "Age 34" for ages and numbers, else just the value. */
export const besideText = (f: FieldDef, v: string) => (/\bage\b/i.test(f.label) || f.kind === 'number' ? `${f.label} ${v}` : v);

/** A field's value on an entry: its text everywhere, and any route-specific texts. */
export interface FieldValue { text?: string; byRoute: [Route, string][] }

export function valueOf(entry: EntryContent, f: FieldDef): FieldValue {
  if (f.key === DESCRIPTION) return { text: entry.description?.trim() || undefined, byRoute: [] };
  if (f.kind === 'tag') return { text: entry.categories[f.key]?.trim() || undefined, byRoute: [] };
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

/** Made-up values for the builder's preview, one per kind. */
const SAMPLE: Record<FieldKind, string> = {
  text: 'Sample', number: '12', tag: 'Tag', place: 'Some town', when: 'Chapter 3', chart: '',
  list: 'Skill name: What it does.', links: 'Jane Doe: Friend', longtext: 'A sentence or two goes here.', yesno: 'Yes',
};

/**
 * "John Doe": a sample character with every switched-on field filled in, so builders see
 * the card their choices make before anyone adds a real one.
 */
export function johnDoe(block: Pick<Block, 'fields' | 'stats'>): EntryContent {
  const sections: Section[] = [];
  const categories: Record<string, string> = {};
  let description: string | undefined;
  for (const f of shownFields(block)) {
    if (f.kind === 'chart') continue;
    if (f.key === DESCRIPTION) { description = 'A few lines about who they are and why you would bring them along go here.'; continue; }
    const v = /\bage\b/i.test(f.label) ? '30' : f.kind === 'tag' ? f.label : SAMPLE[f.kind];
    if (f.kind === 'tag') categories[f.key] = v;
    else sections.push({ label: f.key, text: v });
  }
  const defs = shownFields(block).filter((f) => f.kind === 'chart').flatMap((f) => chartDefs(block, f));
  const stats = defs.length ? Object.fromEntries(defs.map((d, i) => [d.key, 8 + ((i * 7) % 13)])) : undefined;
  return { name: 'John Doe', description, sections, categories, stats };
}
