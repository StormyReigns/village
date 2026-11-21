// What each entry in a Block still needs, for the Workshop's "In the app" lists (docs/workshop.md).
// Solid pieces are entries that are filled in; split outlines are ones that still need something, the
// brand's "solid = built, split outline = not built yet". A row that needs something says what.
//
// "Every field filled" would make nothing complete: some fields are rare by nature (most items aren't
// crafted, a guide has Steps or a Write-up, not both). So a field counts when it's one of its Block
// type's core fields, or when most of the Block's entries already have it.

import type { Block, BlockType, EntryContent, FieldDef } from '../data/pages/types.ts';
import { DESCRIPTION, FROM, byFields, entriesOf, hasValue, shownFields } from './fields.ts';
import { STEPS, WRITEUP } from './guides.ts';

/** Each type's core fields. Every group is one need; any field in it meets it. Matched by key or name. */
const CORE: Partial<Record<BlockType, string[][]>> = {
  characters: [[DESCRIPTION], ['How to recruit', 'Recruit']],
  items: [['What it does'], ['Where to get it']],
  classes: [['How to unlock', 'How to get it'], ['Exam needs', 'Requirements']],
  guide: [[DESCRIPTION], [STEPS, WRITEUP]],
};

/** A field most entries have counts too, once there are enough entries to tell. */
const COMMON_SHARE = 0.6;
const ENOUGH = 5;

const fits = (f: FieldDef, name: string) => f.key.toLowerCase() === name.toLowerCase() || f.label.toLowerCase() === name.toLowerCase();
const filled = (e: EntryContent, f: FieldDef) => hasValue({ ...e, sections: e.sections ?? [], categories: e.categories ?? {} }, f);

/** A need: the fields that meet it, and what to call it ("Steps or Write-up"). */
interface Need { fields: FieldDef[]; label: string }

/** What an entry in this Block needs to count as filled in. */
export function needsFor(block: Pick<Block, 'type' | 'fields' | 'stats' | 'entries'>): Need[] {
  if (!byFields(block)) return [];
  const shown = shownFields(block).filter((f) => f.kind !== 'tier' && !f.key.startsWith(FROM));
  const needs: Need[] = [];
  for (const group of CORE[block.type] ?? []) {
    const fields = shown.filter((f) => group.some((n) => fits(f, n)));
    if (fields.length) needs.push({ fields, label: fields.map((f) => f.label).join(' or ') });
  }
  const entries = entriesOf(block);
  if (entries.length >= ENOUGH) {
    for (const f of shown) {
      if (needs.some((n) => n.fields.includes(f))) continue;
      if (entries.filter((e) => filled(e, f)).length / entries.length >= COMMON_SHARE) needs.push({ fields: [f], label: f.label });
    }
  }
  return needs;
}

/**
 * What one entry is missing, by name ([] when it's filled in). Blocks laid out by fields use their needs;
 * a Checklist or Timeline needs a description, and a Collection a description or any section.
 */
export function missingOf(block: Pick<Block, 'type' | 'fields' | 'stats' | 'entries'>, needs: Need[], e: EntryContent): string[] {
  if (byFields(block)) return needs.filter((n) => !n.fields.some((f) => filled(e, f))).map((n) => n.label);
  const described = Boolean(e.description?.trim());
  if (block.type === 'checklist' || block.type === 'timeline') return described ? [] : ['A description'];
  if (block.type === 'collection') return described || (e.sections ?? []).some((s) => s.text.trim()) ? [] : ['A description'];
  return [];
}

/** Every entry's missing fields, by entry id, and how many are filled in. Header cards aren't counted. */
export function completeness(block: Pick<Block, 'type' | 'fields' | 'stats' | 'entries'>) {
  const needs = needsFor(block);
  const missing = new Map<string, string[]>();
  let done = 0;
  const entries = entriesOf(block) as (EntryContent & { id: string })[];
  for (const e of entries) {
    const m = missingOf(block, needs, e);
    missing.set(e.id, m);
    if (!m.length) done++;
  }
  return { done, total: entries.length, missing };
}
