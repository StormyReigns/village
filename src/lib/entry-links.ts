// Links between Blocks (docs/blocks/entry-links.md): the one way an entry points at other entries,
// in its own Block or another one, and the other side worked out on the entries it names. Plain and
// tested (entry-links.test.ts): no React, no database.
//
// A links field holds "Name: note" lines ("Iron Ore: 3", "Nemea Cavern: in a chest"). Its `to` says
// which Block the names are in (missing: its own), its `back` what the other side is called there
// ("Used to make"). Nobody types both sides.

import type { Block, Entry, EntryContent, FieldDef, Page, Route, Tint } from '../data/pages/types.ts';
import { FROM, LEADS_TO, MADE_FROM, UPGRADES_TO, entriesOf, listItems, shownFields, spotOf } from './fields.ts';

type BlockEntry = Entry;

/** Other sides for the links fields that had one before `back` existed, so Blocks set up then
 *  (and the seeded ones) keep showing them without anyone touching Set up. */
const BACK_BY_KEY: Record<string, string> = { [MADE_FROM]: 'Used to make', [UPGRADES_TO]: 'Upgrades from', [LEADS_TO]: 'Comes from' };

/** Whether a links field inside its own Block shows both ways under its own name: as set up, else on
 *  for Relationships (who knows whom goes both ways). Never for a field pointing at another Block. */
export const bothOf = (f: Pick<FieldDef, 'kind' | 'key' | 'to' | 'both'>, own?: string) =>
  f.kind === 'links' && (!f.to || f.to === own) && (f.both ?? f.key === 'Relationships');

/** Whether a field links to entries: a links field (several, as pieces), or a place pointing at a
 *  Block (one, under the name with a pin: a character's Location, a foe's Where). */
export const isLinkField = (f: Pick<FieldDef, 'kind' | 'to'>) => f.kind === 'links' || (f.kind === 'place' && !!f.to);

/** What a link field's other side is called, or undefined for none (Relationships, which shows both ways instead). */
export const backOf = (f: Pick<FieldDef, 'kind' | 'key' | 'back' | 'to' | 'both'>, own?: string) =>
  f.kind === 'links' && !bothOf(f, own) ? f.back?.trim() || BACK_BY_KEY[f.key]
    : f.kind === 'place' && f.to ? f.back?.trim() || undefined : undefined;

/** Whether a link field points at the Block `here` (a field with no `to` points at its own Block). */
export const pointsAt = (f: Pick<FieldDef, 'to'>, here: string | undefined, own: string | undefined) => (f.to || own) === here;

/** Whether a link field points at a Block other than its own. */
export const pointsAway = (f: Pick<FieldDef, 'kind' | 'to'>, own: string | undefined) => isLinkField(f) && !!f.to && f.to !== own;

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
 * Every other side an entry shows from the links fields of its own Block: one per field that points
 * at this Block and has an other side, in the field order, leaving out empty ones. `skip` leaves out
 * fields a Block works out its own way (a class's Leads to, which also follows skill ranks).
 */
export function otherSides(name: string, entries: Pick<EntryContent, 'name' | 'sections'>[], fields: FieldDef[], own?: string, skip: (string | undefined)[] = []): OtherSide[] {
  return fields.flatMap((f) => {
    const label = pointsAway(f, own) ? undefined : backOf(f, own);
    if (!label || skip.includes(f.key)) return [];
    const items = linkedFrom(name, entries, f.key);
    return items.length ? [{ key: f.key, label, items }] : [];
  });
}

/** A both-ways field's names from the other side: entries that list this one and that it doesn't
 *  list itself. Without their notes, which describe the link from the other side ("Sister"). */
export function mirrored(name: string, typed: string, entries: Pick<EntryContent, 'name' | 'sections'>[], key: string): Linked[] {
  const mine = listItems(typed).map((i) => i.name);
  return linkedFrom(name, entries, key).filter((x) => !mine.some((m) => same(m, x.name))).map((x) => ({ name: x.name, note: '' }));
}

/** Lines back as text, the way a links field keeps them: "Name: note", or the name alone. */
export const linesOf = (items: Linked[]) => items.map((i) => (i.note ? `${i.name}: ${i.note}` : i.name)).join('\n');

// ---- Across Blocks and Pages (worked out on the server, handed to the cards) ----

/** One entry of another Block, as much as a card needs to show and open it. */
export interface LinkRow { name: string; href: string; icon?: string; routes?: Route[] }

/** A Block that links on this Page point at, with its entries (spoilers and band headers left out). */
export interface LinkTarget { title: string; tint: Tint; rows: LinkRow[] }

/** An other side shown on a Block here, from a links field of a Block elsewhere. */
export interface Incoming {
  /** `<block>.<field key>` of the field it comes from. */
  key: string;
  label: string;
  /** Where the field lives, for the Set up list and map places: "Items" or "World · Foes". */
  where: string;
  /** The color of the Page it comes from: its entries wear it. */
  tint: Tint;
  /** For each entry here (by its name in lowercase), the entries naming it, with their notes. */
  byName: Record<string, (LinkRow & { note: string })[]>;
}

export interface BlockLinks {
  /** By Block id: the Blocks this Page's links fields point at. */
  targets: Record<string, LinkTarget>;
  /** By the id of a Block on this Page: the other sides it shows from other Blocks. */
  incoming: Record<string, Incoming[]>;
}

type Placed = { p: Page; b: Block };
const whereOf = ({ p, b }: Placed) => (p.title === b.title ? p.title : `${p.title} · ${b.title}`);

/** Every links field anywhere in the game that points at another Block, with where it lives. */
function awayFields(pages: Page[]): (Placed & { f: FieldDef })[] {
  return pages.flatMap((p) => p.blocks.flatMap((b) => shownFields(b).filter((f) => pointsAway(f, b.id)).map((f) => ({ p, b, f }))));
}

/**
 * What a Page's cards need about links across Blocks: the entries their fields point at, and the
 * other sides they show from fields elsewhere. `href` makes an entry's address (sharePath).
 */
export function blockLinks(pages: Page[], page: Page, href: (p: Page, b: Block, e: BlockEntry) => string): BlockLinks {
  const all = pages.flatMap((p) => p.blocks.map((b) => ({ p, b })));
  const rowOf = (x: Placed, e: BlockEntry): LinkRow => ({ name: e.name, href: href(x.p, x.b, e), ...(e.icon ? { icon: e.icon } : {}), ...(e.routes?.length ? { routes: e.routes } : {}) });
  const seen = (b: Block) => entriesOf(b).filter((e) => !e.spoiler);
  const away = awayFields(pages);

  const targets: Record<string, LinkTarget> = {};
  for (const { f } of away.filter((x) => x.p.id === page.id)) {
    const t = all.find((x) => x.b.id === f.to);
    if (t && !targets[t.b.id]) targets[t.b.id] = { title: t.b.title, tint: t.p.tint, rows: seen(t.b).map((e) => rowOf(t, e)) };
  }

  const incoming: Record<string, Incoming[]> = {};
  for (const here of page.blocks) {
    const names = new Set(entriesOf(here).map((e) => e.name.trim().toLowerCase()));
    for (const src of away.filter((x) => x.f.to === here.id)) {
      const label = backOf(src.f, src.b.id);
      if (!label) continue;
      const byName: Incoming['byName'] = {};
      for (const e of seen(src.b)) {
        for (const i of listItems(e.sections.find((s) => s.label === src.f.key)?.text ?? '')) {
          const k = i.name.toLowerCase();
          if (!names.has(k) || byName[k]?.some((r) => r.name === e.name)) continue;
          (byName[k] ??= []).push({ ...rowOf(src, e), note: i.note });
        }
      }
      if (Object.keys(byName).length) (incoming[here.id] ??= []).push({ key: `${src.b.id}.${src.f.key}`, label, where: whereOf(src), tint: src.p.tint, byName });
    }
  }
  return { targets, incoming };
}



/** A map Block's places get typed links in their "What's here", first, beside the names found in
 *  text (mapMentions in src/data/pages/links.ts). Keyed by the place's name in lowercase. */
export function withLinkMentions<M extends { name: string; where: string; href: string }>(mentions: Record<string, M[]>, links: BlockLinks, page: Page): Record<string, M[]> {
  const out: Record<string, M[]> = { ...mentions };
  for (const b of page.blocks.filter((x) => x.look === 'map')) {
    for (const inc of links.incoming[b.id] ?? []) {
      for (const [k, rows] of Object.entries(inc.byName)) {
        const typed = rows.map((r) => ({ name: r.name, where: inc.where, href: r.href }) as M);
        const rest = (out[k] ?? []).filter((m) => !typed.some((t) => t.href === m.href));
        out[k] = [...typed, ...rest];
      }
    }
  }
  return out;
}

/** For Set up: the other sides a Block shows from links fields in other Blocks, by name and source. */
export function incomingFields(blocks: (Pick<Block, 'id' | 'title' | 'fields' | 'type'> & { page: Pick<Page, 'title'> })[], here: string) {
  return blocks.flatMap((b) => shownFields(b).filter((f) => pointsAway(f, b.id) && f.to === here && backOf(f, b.id))
    .map((f) => ({ key: `${b.id}.${f.key}`, label: backOf(f, b.id)!, field: f.label, where: b.page.title === b.title ? b.title : `${b.page.title} · ${b.title}` })));
}

// ---- Placing other sides (Set up of the Block they show on) ----

/** The Set up row that places an other side, by the other side's `<block>.<field key>`. */
export const fromRowKey = (key: string) => `${FROM}${key}`;

/**
 * Where a Block's builders put each other side from elsewhere, read from its fields' order: after the
 * nearest switched-on field before it that shows in the card's body (null: before them all), or off.
 * Other sides it has no row for show after the card's own fields.
 */
export function placedFrom(fields: FieldDef[] | undefined): Record<string, { after: string | null; off: boolean }> {
  const out: Record<string, { after: string | null; off: boolean }> = {};
  let after: string | null = null;
  for (const f of fields ?? []) {
    if (f.key.startsWith(FROM)) out[f.key.slice(FROM.length)] = { after, off: Boolean(f.off) };
    else if (!f.off && ['body', 'section'].includes(spotOf(f))) after = f.key;
  }
  return out;
}

/**
 * Set up's list: the Block's own fields with a row for each other side shown on its cards, where its
 * builders put it, new ones at the end. Rows for other sides that no longer come here are dropped.
 */
export function withFromRows(own: FieldDef[], raw: FieldDef[] | undefined, incoming: { key: string; label: string }[]): FieldDef[] {
  const live = new Set(incoming.map((x) => fromRowKey(x.key)));
  const out: FieldDef[] = [];
  const rows = (raw ?? []).filter((f) => f.key.startsWith(FROM) && live.has(f.key));
  // Each placed row goes right after the field it followed in the saved order.
  const before = new Map<string, FieldDef[]>();
  let prev = '';
  for (const f of raw ?? []) {
    if (f.key.startsWith(FROM)) { if (live.has(f.key)) before.set(prev, [...(before.get(prev) ?? []), f]); } else prev = f.key;
  }
  out.push(...(before.get('') ?? []));
  for (const f of own) { out.push(f); out.push(...(before.get(f.key) ?? [])); }
  // Rows whose field is gone, then other sides never placed.
  for (const r of rows) if (!out.includes(r)) out.push(r);
  for (const x of incoming) if (!out.some((f) => f.key === fromRowKey(x.key))) out.push({ key: fromRowKey(x.key), label: x.label, kind: 'links' });
  return out;
}

// ---- Renames ----

/** The entries anywhere in the game whose link fields name `name` in the Block `blockId`. */
export function referrers(pages: Page[], blockId: string, name: string, skip?: { block: string; entry: string }) {
  return pages.flatMap((p) => p.blocks.flatMap((b) => shownFields(b).filter((f) => isLinkField(f) && pointsAt(f, blockId, b.id))
    .flatMap((f) => b.entries.filter((e) => !(skip && b.id === skip.block && e.id === skip.entry)
      && listItems(e.sections.find((s) => s.label === f.key)?.text ?? '').some((i) => same(i.name, name)))
      .map((e) => ({ page: p, block: b, entry: e, field: f })))));
}

/** A link field's lines with one name changed, notes kept ("Old Mine: 3" to "Deep Mine: 3"). */
export function renameIn(text: string, from: string, to: string) {
  return text.split('\n').map((l) => {
    const at = l.indexOf(':');
    const name = (at > 0 ? l.slice(0, at) : l).trim();
    return same(name, from) ? (at > 0 ? `${to}:${l.slice(at + 1)}` : to) : l;
  }).join('\n');
}
