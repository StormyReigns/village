// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backOf, blockLinks, bothOf, incomingFields, linesOf, linkedFrom, mirrored, otherSides, pointsAt, withLinkMentions } from './entry-links.ts';
import { ITEM_FIELDS, CLASS_FIELDS, COMMON_FIELDS, LEADS_TO, MADE_FROM, UPGRADES_TO } from './fields.ts';
import type { Block, Entry, EntryContent, FieldDef, Page } from '../data/pages/types.ts';

const entry = (name: string, sections: Record<string, string> = {}): EntryContent =>
  ({ name, categories: {}, sections: Object.entries(sections).map(([label, text]) => ({ label, text })) });

test("today's links keep their other sides without touching Set up", () => {
  const made = ITEM_FIELDS.find((f) => f.key === MADE_FROM)!;
  assert.equal(backOf(made), 'Used to make');
  assert.equal(backOf(ITEM_FIELDS.find((f) => f.key === UPGRADES_TO)!), 'Upgrades from');
  assert.equal(backOf(CLASS_FIELDS.find((f) => f.key === LEADS_TO)!), 'Comes from');
  // Relationships has no other side (yet), and only links fields can have one.
  assert.equal(backOf(COMMON_FIELDS.find((f) => f.key === 'Relationships')!), undefined);
  assert.equal(backOf({ key: MADE_FROM, kind: 'list' }), undefined);
  // A builder's own name wins; a blank one falls back.
  assert.equal(backOf({ ...made, back: 'Goes into' }), 'Goes into');
  assert.equal(backOf({ ...made, back: '  ' }), 'Used to make');
});

test('a links field points at its own Block unless it names another', () => {
  assert.ok(pointsAt({}, 'items', 'items'));
  assert.ok(pointsAt({ to: 'places' }, 'places', 'items'));
  assert.ok(!pointsAt({ to: 'places' }, 'items', 'items'));
});

test('the other side is worked out by name, whatever the case, never the entry itself', () => {
  const all = [entry('Iron Sword', { [MADE_FROM]: 'iron ore: 3\nOak Log' }), entry('Iron Ore', { [MADE_FROM]: 'Iron Ore' })];
  assert.deepEqual(linkedFrom('Iron Ore', all, MADE_FROM), [{ name: 'Iron Sword', note: '3' }]);
  assert.deepEqual(linkedFrom('  ', all, MADE_FROM), []);
});

test('every other side an entry shows, in field order, empty ones left out', () => {
  const fields: FieldDef[] = [
    { key: 'Relationships', label: 'Relationships', kind: 'links' },
    { key: UPGRADES_TO, label: 'Upgrades to', kind: 'links' },
    { key: MADE_FROM, label: 'Made from', kind: 'links' },
    { key: 'Found in', label: 'Found in', kind: 'links', back: 'Has' },
  ];
  const all = [
    entry('Iron Sword', { [MADE_FROM]: 'Iron Ore: 3', [UPGRADES_TO]: 'Steel Sword' }),
    entry('Steel Sword', { [MADE_FROM]: 'Iron Ore: 5\nCoal' }),
  ];
  assert.deepEqual(otherSides('Iron Ore', all, fields), [{ key: MADE_FROM, label: 'Used to make', items: [{ name: 'Iron Sword', note: '3' }, { name: 'Steel Sword', note: '5' }] }]);
  assert.deepEqual(otherSides('Steel Sword', all, fields), [{ key: UPGRADES_TO, label: 'Upgrades from', items: [{ name: 'Iron Sword', note: '' }] }]);
  // A field the Block works out its own way is left out.
  assert.deepEqual(otherSides('Steel Sword', all, fields, undefined, [UPGRADES_TO]), []);
  assert.equal(linesOf([{ name: 'Iron Sword', note: '3' }, { name: 'Coal', note: '' }]), 'Iron Sword: 3\nCoal');
});

test('Relationships go both ways by default; a mirrored name comes without its note', () => {
  const rel: FieldDef = { key: 'Relationships', label: 'Relationships', kind: 'links' };
  assert.ok(bothOf(rel));
  assert.ok(!bothOf({ ...rel, both: false }));
  assert.ok(!bothOf({ ...rel, to: 'places' }, 'units'), 'never to another Block');
  assert.ok(bothOf({ key: 'Family', kind: 'links', both: true }));
  const all = [entry('Ash', { Relationships: 'Bob: Brother\nCai: Friend' }), entry('Bob', { Relationships: 'Cai' })];
  assert.deepEqual(mirrored('Bob', 'Cai', all, 'Relationships'), [{ name: 'Ash', note: '' }]);
  assert.deepEqual(mirrored('Bob', 'ash: Sister', all, 'Relationships'), [], 'already listed');
});

const e = (id: string, name: string, sections: Record<string, string> = {}, extra: Partial<Entry> = {}): Entry =>
  ({ id, ...entry(name, sections), ...extra });
const blk = (id: string, type: Block['type'], title: string, entries: Entry[], fields?: FieldDef[]): Block => ({ id, type, title, icon: 'Box', entries, fields });
const pg = (id: string, title: string, tint: Page['tint'], blocks: Block[]): Page => ({ id, title, short: title, icon: 'Box', tint, blurb: '', blocks });

const WHERE: FieldDef = { key: 'Where to get it', label: 'Where to get it', kind: 'links', to: 'places', back: 'Items here' };
const pages = [
  pg('items', 'Items', 'sun', [blk('items', 'items', 'Items', [
    e('fire-gem', 'Fire Gem', { 'Where to get it': 'Nemea Cavern: in a chest\nNowhere Town' }),
    e('ice-gem', 'Ice Gem', { 'Where to get it': 'nemea cavern' }),
    e('secret', 'Secret Blade', { 'Where to get it': 'Nemea Cavern' }, { spoiler: true }),
  ], [WHERE])]),
  pg('world', 'World', 'teal', [blk('places', 'collection', 'Places', [e('nemea', 'Nemea Cavern', {}, { routes: ['leda'] }), e('hidden', 'Hidden Vale', {}, { spoiler: true })])]),
];
const href = (p: Page, b: Block, x: Entry) => `/g/test/${p.id}/${x.id}`;

test('links across Blocks: the entries a field points at, and the other side worked out there', () => {
  const onItems = blockLinks(pages, pages[0], href);
  assert.deepEqual(onItems.targets, { places: { title: 'Places', tint: 'teal', rows: [{ name: 'Nemea Cavern', href: '/g/test/world/nemea', routes: ['leda'] }] } }, 'spoiler places left out');
  assert.deepEqual(onItems.incoming, {});
  const onWorld = blockLinks(pages, pages[1], href);
  assert.deepEqual(onWorld.targets, {});
  assert.deepEqual(onWorld.incoming.places, [{
    key: 'items.Where to get it', label: 'Items here', where: 'Items', tint: 'sun',
    byName: { 'nemea cavern': [{ name: 'Fire Gem', href: '/g/test/items/fire-gem', note: 'in a chest' }, { name: 'Ice Gem', href: '/g/test/items/ice-gem', note: '' }] },
  }], 'spoiler items stay out, names match whatever their case, a name that is no place is skipped');
});

test("a map's places get typed links first in What's here, without doubles", () => {
  const map = { ...pages[1], blocks: [{ ...pages[1].blocks[0], look: 'map' as const }] };
  const links = blockLinks(pages, map, href);
  const found = { 'nemea cavern': [{ name: 'Ice Gem', where: 'Items', href: '/g/test/items/ice-gem' }, { name: 'Ash', where: 'Units', href: '/g/test/units/ash' }] };
  assert.deepEqual(withLinkMentions(found, links, map)['nemea cavern'].map((m) => m.name), ['Fire Gem', 'Ice Gem', 'Ash']);
  assert.deepEqual(withLinkMentions(found, links, pages[1]), found, 'not a map: unchanged');
});

test("Set up lists the other sides a Block gets from elsewhere", () => {
  const blocks = pages.flatMap((p) => p.blocks.map((b) => ({ ...b, page: p })));
  assert.deepEqual(incomingFields(blocks, 'places'), [{ label: 'Items here', field: 'Where to get it', where: 'Items' }]);
  assert.deepEqual(incomingFields(blocks, 'items'), []);
});
