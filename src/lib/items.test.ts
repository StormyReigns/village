// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupOrder } from './items.ts';
import { ITEM_FIELDS, amountText, canTile, fieldsOf, johnDoe, tileFields, withCommon, MADE_FROM } from './fields.ts';
import { linkedFrom } from './entry-links.ts';
import type { EntryContent } from '../data/pages/types.ts';

test('letter ranks group best first (a range by its best letter), with "No rank" and the like after them', () => {
  assert.deepEqual(groupOrder(['C', 'E', 'D–C', 'C–B', 'No rank', 'B–A', 'B', 'S', 'A', 'Unlisted']),
    ['S', 'A', 'B–A', 'B', 'C–B', 'C', 'D–C', 'E', 'No rank', 'Unlisted']);
});

test('other tags keep the order they first appear in', () => {
  assert.deepEqual(groupOrder(['Key item', 'Material', 'Quest item']), ['Key item', 'Material', 'Quest item']);
});

test('an Items Block with no setup starts from the item fields', () => {
  assert.equal(fieldsOf({ type: 'items' }), ITEM_FIELDS);
  assert.deepEqual(withCommon([], 'items').map((f) => f.key), ITEM_FIELDS.map((f) => f.key));
});

test('a tile holds at most three things, and never long text or lists', () => {
  const fields = ITEM_FIELDS.map((f) => ({ ...f, off: false, tile: true }));
  const on = tileFields({ type: 'items', fields });
  assert.equal(on.length, 3);
  assert.ok(on.every(canTile));
  assert.ok(!canTile({ key: 'What it does', label: 'What it does', kind: 'longtext' }));
});

const item = (name: string, madeFrom?: string): EntryContent => ({ name, categories: {}, sections: madeFrom ? [{ label: MADE_FROM, text: madeFrom }] : [] });

test('"Used to make" is worked out from other items\' "Made from"', () => {
  const all = [item('Iron Sword', 'Iron Ore: 3\nOak Log: 1'), item('Iron Shield', 'iron ore: 2'), item('Iron Ore'), item('Oak Log')];
  assert.deepEqual(linkedFrom('Iron Ore', all, MADE_FROM), [{ name: 'Iron Sword', note: '3' }, { name: 'Iron Shield', note: '2' }]);
  assert.deepEqual(linkedFrom('Oak Log', all, MADE_FROM), [{ name: 'Iron Sword', note: '1' }]);
  assert.deepEqual(linkedFrom('Iron Sword', all, MADE_FROM), []);
});

test('a number on a link is how many', () => {
  assert.equal(amountText('3'), '× 3');
  assert.equal(amountText('from the smith'), 'from the smith');
});

test('the Items sample is an item, not John Doe', () => {
  const sample = johnDoe({ type: 'items', fields: ITEM_FIELDS, stats: [] });
  assert.equal(sample.name, 'Sample item');
  assert.equal(sample.categories.Type, 'Material');
  assert.ok(sample.sections.some((s) => s.label === MADE_FROM));
});

test('standout badges go to the one clear best at each stat, in words', async () => {
  const { standouts } = await import('./items.ts');
  const defs = [
    { key: 'might', label: 'Might', better: 'high' as const },
    { key: 'hit', label: 'Hit', better: 'high' as const },
    { key: 'weight', label: 'Weight', better: 'low' as const },
    { key: 'luck', label: 'Luck', better: 'high' as const },
  ];
  const w = (id: string, might: number, hit: number, weight: number, luck: number) => ({ id, stats: { might, hit, weight, luck } });
  const got = standouts([w('fimbulvetr', 30, 80, 28, 1), w('excalibur', 15, 100, 10, 1), w('sagittae', 13, 100, 12, 1), w('wind', 3, 100, 3, 5)], defs);
  // Three share the best Hit, so nobody gets "Most accurate".
  assert.deepEqual([...got], [['fimbulvetr', 'Strongest'], ['wind', 'Lightest']]);
  // Wind is also best at Luck, but keeps the first word it earned.
});

test('stats without a known word still get a plain one', async () => {
  const { standoutWord } = await import('./items.ts');
  assert.equal(standoutWord({ key: 'luck', label: 'Luck', better: 'high' }), 'Best luck');
  assert.equal(standoutWord({ key: 'price', label: 'Price', better: 'low' }), 'Cheapest');
  assert.equal(standoutWord({ key: 'crit', label: 'Crit', better: 'high' }), 'Best crit');
});

test('too few numbers means no badges', async () => {
  const { standouts } = await import('./items.ts');
  assert.equal(standouts([{ id: 'a', stats: { might: 3 } }, { id: 'b', stats: { might: 5 } }], [{ key: 'might', label: 'Might', better: 'high' }]).size, 0);
});

test('a section is drawn smaller the more it holds', async () => {
  const { densityFor } = await import('./items.ts');
  assert.deepEqual([1, 16, 17, 60, 61, 300].map(densityFor), ['cards', 'cards', 'tiles', 'tiles', 'rows', 'rows']);
});

test('sections under five items fold into one Other at the end', async () => {
  const { foldSmall } = await import('./items.ts');
  const g = (name: string, n: number) => ({ name, items: Array.from({ length: n }, (_, i) => `${name}${i}`) });
  const out = foldSmall([g('Quest item', 1), g('Equipment', 26), g('License', 1), g('Gift', 108), g('Spell scroll', 2), g('Other', 3)]);
  assert.deepEqual(out.map((x) => x.name), ['Equipment', 'Gift', 'Other']);
  assert.deepEqual(out[2].holds, ['Quest item', 'License', 'Spell scroll']);
  assert.deepEqual(out[2].items, ['Quest item0', 'License0', 'Spell scroll0', 'Spell scroll1', 'Other0', 'Other1', 'Other2']);
});

test('a lone small section, or a shelf of only small ones, stays as it is', async () => {
  const { foldSmall } = await import('./items.ts');
  const g = (name: string, n: number) => ({ name, items: Array.from({ length: n }, () => name) });
  assert.deepEqual(foldSmall([g('Sword', 24), g('Gauntlet', 4)]).map((x) => x.name), ['Sword', 'Gauntlet']);
  assert.deepEqual(foldSmall([g('A', 2), g('B', 3)]).map((x) => x.name), ['A', 'B']);
});
