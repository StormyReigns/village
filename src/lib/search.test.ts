// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rank, closest, searchWords } from './search.ts';

const items = [
  { name: 'Goliath', text: 'Unit. Joins on Cai\'s route after the Giant\'s Meat request.' },
  { name: "Giant's Meat", text: 'Material. Where to get it: Valhalla Mine hunting grounds.' },
  { name: 'Hingosh', text: 'Quest item. Where to get it: Baina Oasis.' },
  { name: 'Glirmosa', text: 'Material. Used for: crafting.' },
];
const view = (i: { name: string; text: string }) => i;
const names = (q: string) => rank(items, q, view).map((i) => i.name);

test('questions drop their filler words', () => {
  assert.deepEqual(searchWords('how do i get goliath'), ['goliath']);
  assert.equal(names('how do i get goliath')[0], 'Goliath');
});

test('half names and missing apostrophes still find the entry', () => {
  assert.equal(names('where to find giant meat')[0], "Giant's Meat");
});

test('a name one letter off still matches', () => {
  assert.equal(names('golath')[0], 'Goliath');
  assert.equal(names('hignosh')[0], 'Hingosh');
});

test('results need only some words, ranked by how many matched', () => {
  assert.deepEqual(names('giant meat oasis').slice(0, 2), ["Giant's Meat", 'Goliath']);
});

test('nothing found still suggests close names', () => {
  assert.deepEqual(names('glimrosaa'), []);
  assert.equal(closest(items, 'glimrosaa', view)[0]?.name, 'Glirmosa');
});
