// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupChanges, setupContent, setupOf, setupTitle } from './setup-draft.ts';
import type { FieldDef } from '../data/pages/types.ts';

const KIND: FieldDef = { key: 'Kind', label: 'Kind', kind: 'tag' };
const LEVEL: FieldDef = { key: 'Level', label: 'Level', kind: 'number' };
const block = { type: 'characters' as const, fields: [KIND, LEVEL], stats: [{ key: 'hp', label: 'HP', better: 'high' as const }] };

test('the title names the Block, and a map says map', () => {
  assert.equal(setupTitle('Units', 'fields'), 'New setup for Units');
  assert.equal(setupTitle('Places', 'map'), 'New map for Places');
});

test('the content carries the setup as the Block has it now, exactly', () => {
  const c = setupContent({ title: 'Units', ...block }, { fields: [KIND], stats: null });
  assert.deepEqual(c.before, { fields: [KIND, LEVEL], stats: block.stats });
  assert.equal(c.name, 'New setup for Units');
  assert.deepEqual(setupContent({ title: 'Party', planSetup: undefined }, { plan: { roster: 'units' } }).before, { plan: null });
  assert.deepEqual(setupContent({ title: 'Places', map: undefined }, { map: { picture: 'p', w: 1, h: 1 } }).before, { map: null });
});

test('setupOf reads a setup Draft and nothing else', () => {
  assert.ok(setupOf({ setup: { fields: [] } }));
  assert.ok(setupOf({ setup: { plan: { roster: 'u' } } }));
  assert.equal(setupOf({ name: 'Wren', sections: [] }), null);
  assert.equal(setupOf({ setup: { fields: 'x' } }), null);
  assert.equal(setupOf(null), null);
});

test('field changes read as a Builder would say them', () => {
  const changes = setupChanges(block, {
    fields: [{ ...LEVEL, off: true }, { ...KIND, label: 'Type', choices: [{ name: 'Boss' }, { name: 'Regular' }] }, { key: 'Weakness', label: 'Weakness', kind: 'list' }],
    stats: [{ key: 'hp', label: 'HP', better: 'high' }, { key: 'def', label: 'Def', better: 'high' }],
  });
  assert.deepEqual(changes, [
    'Switches off Level',
    'Renames Kind to Type',
    'Choices for Type: Boss, Regular',
    'Adds Weakness (list)',
    'Puts the fields in a new order',
    'Stats: HP, Def',
  ]);
});

test('a removed field and an unchanged setup', () => {
  assert.deepEqual(setupChanges(block, { fields: [KIND], stats: block.stats }), ['Removes Level']);
  assert.deepEqual(setupChanges(block, { fields: [KIND, LEVEL], stats: block.stats }), []);
});

test('a Block with no fields of its own starts from its usual ones', () => {
  const changes = setupChanges({ type: 'characters' }, { fields: [{ key: 'Weakness', label: 'Weakness', kind: 'list' }] });
  assert.ok(changes.includes('Adds Weakness (list)'));
  assert.ok(changes.some((c) => c.startsWith('Removes ')));
});

test('a Planner and a map', () => {
  const names = (k: string) => ({ units: 'Units', gear: 'Gear', classes: 'Classes' })[k] ?? k;
  assert.deepEqual(setupChanges({ type: 'planner', planSetup: { roster: 'units' } },
    { plan: { roster: 'units', size: 12, classes: 'classes', slots: [{ key: 'weapon', label: 'Weapon', from: 'gear' }] } }, names),
  ['A party holds 12 at most', 'Class steps come from Classes', 'Adds the gear slot Weapon (from Gear)']);
  assert.deepEqual(setupChanges({ type: 'collection' }, { map: { picture: 'a', w: 1, h: 1, credit: 'Map: Game8' } }), ['Adds a map picture', 'Credit: Map: Game8']);
  assert.deepEqual(setupChanges({ type: 'collection', map: { picture: 'a', w: 1, h: 1 } }, { map: { picture: 'b', w: 1, h: 1 } }), ['A new map picture']);
});

test('a new type: its title, what it changes, and what it started from', () => {
  assert.equal(setupTitle('Foes', 'type', 'characters'), 'Foes as a Characters Block');
  assert.equal(setupTitle('Bag', 'type', 'items'), 'Bag as an Items Block');
  const c = setupContent({ title: 'Items', type: 'collection' }, { type: 'items' });
  assert.deepEqual(c.before, { type: 'collection' });
  assert.equal(c.name, 'Items as an Items Block');
  assert.ok(setupOf({ setup: { type: 'items' } }));
  assert.deepEqual(setupChanges({ type: 'collection' }, { type: 'items' }), ["Makes it an Items Block (it was a Collection). Set it up once it's in"]);
});
