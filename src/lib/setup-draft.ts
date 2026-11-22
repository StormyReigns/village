// A Block's setup suggested as a Draft (supabase/migrations/20261127000000_setup_drafts.sql): Set up's
// fields, a Planner's setup, or a map picture, sent by any Builder for votes and published by a moderator.
// This is the Draft's content, and what it changes in plain words for its card ("Renames Kind to Type").

import type { Block, BlockMap, BlockType, FieldDef, StatDef } from '../data/pages/types.ts';
import type { PlanSetup } from './planner.ts';
import { FIELD_KINDS, FROM, fieldsOf } from './fields.ts';
import { typeName } from './block-types.ts';

/** What a setup Draft holds: the setup it suggests, and the Block's setup when it was sent. Publishing
 *  refuses if the Block's setup has changed since, rather than overwrite someone else's. */
export interface SetupContent {
  name: string;
  sections: [];
  categories: Record<string, never>;
  setup: SetupPart;
  before: SetupPart;
}
export interface SetupPart {
  fields?: FieldDef[] | null;
  stats?: StatDef[] | null;
  plan?: PlanSetup | null;
  map?: BlockMap | null;
  /** A new type for a Block with nothing in it yet (20261129000000), sent on its own. */
  type?: BlockType | null;
}
export type SetupKind = 'fields' | 'plan' | 'map' | 'type';

/** The Draft's title: "New setup for Units", or "New map for Places". The chat adds "is now in the app." */
export const setupTitle = (blockTitle: string, kind: SetupKind, type?: BlockType | null) =>
  kind === 'type' && type ? `${blockTitle} as ${typeName(type)} Block` : `New ${kind === 'map' ? 'map' : 'setup'} for ${blockTitle}`;

/** A setup Draft's content, with the Block's setup as it is now (exactly as the database has it). */
export function setupContent(block: Pick<Block, 'title' | 'fields' | 'stats' | 'planSetup' | 'map'> & Partial<Pick<Block, 'type'>>, setup: SetupPart): SetupContent {
  const kind = kindOf(setup);
  const before: SetupPart = kind === 'fields' ? { fields: block.fields ?? null, stats: block.stats ?? null }
    : kind === 'plan' ? { plan: block.planSetup ?? null } : kind === 'type' ? { type: block.type ?? null } : { map: block.map ?? null };
  return { name: setupTitle(block.title, kind, setup.type), sections: [], categories: {}, setup, before };
}

export const kindOf = (s: SetupPart): SetupKind => (s.type !== undefined ? 'type' : s.map !== undefined ? 'map' : s.plan !== undefined ? 'plan' : 'fields');

/** A Draft's content as a setup, or null when it isn't one. */
export function setupOf(content: unknown): SetupContent | null {
  const c = content as Partial<SetupContent> | null;
  if (!c || typeof c !== 'object' || !c.setup || typeof c.setup !== 'object') return null;
  const s = c.setup;
  if (!Array.isArray(s.fields) && !(s.plan && typeof s.plan === 'object') && !(s.map && typeof s.map === 'object') && typeof s.type !== 'string') return null;
  return { ...(c as SetupContent), before: c.before && typeof c.before === 'object' ? c.before : {} };
}

const kindWord = (k: FieldDef['kind']) => (FIELD_KINDS.find((x) => x.kind === k)?.label ?? k).toLowerCase();
const statNames = (s?: StatDef[] | null) => (s ?? []).map((d) => d.label).join(', ');
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * What a setup changes, one line each, in the order a Builder would read them. `block` is the Block as it
 * is now (its type decides its usual fields when it has none of its own); `name` names other Blocks.
 */
export function setupChanges(block: Pick<Block, 'type' | 'fields' | 'stats' | 'planSetup' | 'map'>, setup: SetupPart, name: (blockKey: string) => string = (k) => k): string[] {
  const out: string[] = [];
  if (setup.type) out.push(`Makes it ${typeName(setup.type)} Block${block.type && block.type !== setup.type ? ` (it was ${typeName(block.type)})` : ''}. Set it up once it's in`);
  if (Array.isArray(setup.fields)) {
    const was = fieldsOf(block);
    const now = setup.fields.filter((f) => !f.key.startsWith(FROM));
    const byKey = new Map(was.map((f) => [f.key, f]));
    for (const f of now) {
      const b = byKey.get(f.key);
      if (!b) { out.push(`Adds ${f.label} (${kindWord(f.kind)})${f.off ? ', switched off' : ''}`); continue; }
      if (b.label !== f.label) out.push(`Renames ${b.label} to ${f.label}`);
      if (b.kind !== f.kind) out.push(`${f.label} becomes ${kindWord(f.kind)}`);
      if (Boolean(b.off) !== Boolean(f.off)) out.push(`${f.off ? 'Switches off' : 'Switches on'} ${f.label}`);
      if (Boolean(b.spoiler) !== Boolean(f.spoiler)) out.push(f.spoiler ? `${f.label} is now a spoiler` : `${f.label} is no longer a spoiler`);
      if (Boolean(b.tile) !== Boolean(f.tile)) out.push(f.tile ? `Shows ${f.label} on tiles` : `Takes ${f.label} off tiles`);
      if (Boolean(b.beside) !== Boolean(f.beside)) out.push(f.beside ? `Moves ${f.label} beside the name` : `Moves ${f.label} back from beside the name`);
      if (!same(b.choices, f.choices)) out.push(f.choices?.length ? `Choices for ${f.label}: ${f.choices.map((c) => c.name).join(', ')}` : `Removes the list of choices for ${f.label}`);
      if (!same(b.to, f.to) && f.to) out.push(`${f.label} links to ${name(f.to)}`);
      if (f.kind === 'chart' && f.key !== '@stats' && statNames(b.stats) !== statNames(f.stats)) out.push(`${f.label}: ${statNames(f.stats) || 'no stats'}`);
      if (!same(b.options, f.options) && f.options) out.push(`${f.label}: ${f.options[0]} or ${f.options[1]}`);
    }
    for (const b of was) if (!now.some((f) => f.key === b.key)) out.push(`Removes ${b.label}`);
    const order = (list: FieldDef[], keep: Set<string>) => list.filter((f) => keep.has(f.key)).map((f) => f.key).join('\n');
    const both = new Set(now.filter((f) => byKey.has(f.key)).map((f) => f.key));
    if (order(was, both) !== order(now, both)) out.push('Puts the fields in a new order');
    if (statNames(block.stats) !== statNames(setup.stats)) out.push(`Stats: ${statNames(setup.stats) || 'none'}`);
  }
  if (setup.plan) {
    const b: Partial<PlanSetup> = block.planSetup ?? {};
    const p = setup.plan;
    if (b.roster !== p.roster) out.push(`The party comes from ${name(p.roster)}`);
    if ((b.size ?? 0) !== (p.size ?? 0)) out.push(p.size ? `A party holds ${p.size} at most` : 'No limit on party size');
    if ((b.classes ?? '') !== (p.classes ?? '')) out.push(p.classes ? `Class steps come from ${name(p.classes)}` : 'No class steps');
    if (!same(b.unlock ?? [], p.unlock ?? [])) out.push('Changes which fields say how to get a unit');
    const slots = (s?: PlanSetup['slots']) => new Map((s ?? []).map((x) => [x.key, x]));
    const was = slots(b.slots), now = slots(p.slots);
    for (const [k, x] of now) {
      const w = was.get(k);
      if (!w) out.push(`Adds the gear slot ${x.label} (from ${name(x.from)})`);
      else if (!same(w, x)) out.push(`Changes the gear slot ${x.label}`);
    }
    for (const [k, w] of was) if (!now.has(k)) out.push(`Removes the gear slot ${w.label}`);
  }
  if (setup.map) {
    if (block.map?.picture !== setup.map.picture) out.push(block.map ? 'A new map picture' : 'Adds a map picture');
    if ((block.map?.credit ?? '') !== (setup.map.credit ?? '')) out.push(setup.map.credit ? `Credit: ${setup.map.credit}` : 'No credit');
  }
  return out;
}
