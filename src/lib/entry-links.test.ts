// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backOf, linesOf, linkedFrom, otherSides, pointsAt } from './entry-links.ts';
import { ITEM_FIELDS, CLASS_FIELDS, COMMON_FIELDS, LEADS_TO, MADE_FROM, UPGRADES_TO } from './fields.ts';
import type { EntryContent, FieldDef } from '../data/pages/types.ts';

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
  assert.deepEqual(otherSides('Steel Sword', all, fields, [UPGRADES_TO]), []);
  assert.equal(linesOf([{ name: 'Iron Sword', note: '3' }, { name: 'Coal', note: '' }]), 'Iron Sword: 3\nCoal');
});
