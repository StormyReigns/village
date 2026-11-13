// Links between Blocks (docs/blocks/entry-links.md): the one way an entry points at other entries,
// in its own Block or another one, and the other side worked out on the entries it names. Plain and
// tested (entry-links.test.ts): no React, no database.
//
// A links field holds "Name: note" lines ("Iron Ore: 3", "Nemea Cavern: in a chest"). Its `to` says
// which Block the names are in (missing: its own), its `back` what the other side is called there
// ("Used to make"). Nobody types both sides.

import type { EntryContent, FieldDef } from '../data/pages/types.ts';
import { LEADS_TO, MADE_FROM, UPGRADES_TO, listItems } from './fields.ts';

/** Other sides for the links fields that had one before `back` existed, so Blocks set up then
 *  (and the seeded ones) keep showing them without anyone touching Set up. */
const BACK_BY_KEY: Record<string, string> = { [MADE_FROM]: 'Used to make', [UPGRADES_TO]: 'Upgrades from', [LEADS_TO]: 'Comes from' };

/** What a links field's other side is called, or undefined for none (Relationships). */
export const backOf = (f: Pick<FieldDef, 'kind' | 'key' | 'back'>) =>
  f.kind === 'links' ? f.back?.trim() || BACK_BY_KEY[f.key] : undefined;

/** Whether a links field points at the Block `here` (a field with no `to` points at its own Block). */
export const pointsAt = (f: Pick<FieldDef, 'to'>, here: string | undefined, own: string | undefined) => (f.to || own) === here;

export interface Linked { name: string; note: string }

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The other side of a links field: entries whose `key` field names this one (what a material is
 *  used to make, what an item upgrades from), with the note they give. Never the entry itself. */
export function linkedFrom(name: string, entries: Pick<EntryContent, 'name' | 'sections'>[], key: string): Linked[] {
  if (!name.trim()) return [];
  return entries.flatMap((e) => {
    const hit = listItems(e.sections.find((s) => s.label === key)?.text ?? '').find((i) => same(i.name, name));
    return hit && !same(e.name, name) ? [{ name: e.name, note: hit.note }] : [];
  });
}

/** One worked-out other side on an entry: under the field it comes from, with its own heading. */
export interface OtherSide { key: string; label: string; items: Linked[] }

/**
 * Every other side an entry shows, from the links fields of a Block whose entries can name it:
 * one per field that has an other side, in the field order, leaving out empty ones.
 * Slice 1: the fields are the entry's own Block's, which all point at it. `skip` leaves out fields
 * a Block works out its own way (a class's Leads to, which also follows skill ranks).
 */
export function otherSides(name: string, entries: Pick<EntryContent, 'name' | 'sections'>[], fields: FieldDef[], skip: (string | undefined)[] = []): OtherSide[] {
  return fields.flatMap((f) => {
    const label = backOf(f);
    if (!label || skip.includes(f.key)) return [];
    const items = linkedFrom(name, entries, f.key);
    return items.length ? [{ key: f.key, label, items }] : [];
  });
}

/** Lines back as text, the way a links field keeps them: "Name: note", or the name alone. */
export const linesOf = (items: Linked[]) => items.map((i) => (i.note ? `${i.name}: ${i.note}` : i.name)).join('\n');
