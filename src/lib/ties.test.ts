// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tiesFor, wordsOf, type TieCandidate } from './ties.ts';

const deadline = (name: string, text: string): TieCandidate => ({ kind: 'deadline', key: `last-chances.${name}`, name, text, href: '#' });
const item = (name: string, text: string): TieCandidate => ({ kind: 'item', key: `got:items.${name}`, name, text, href: '#' });
const all = [
  deadline("Leda's Paralogue: Diversionary Tactics", 'Pays 20,000G, 150 Renown and the Rapier.'),
  deadline("Orchel's Paralogue: Orchel's Regret", 'Starts at Fort Galcar. Unlocks Diego. The only one open on every route.'),
  deadline('Creek', 'Finish "My Late Sister\'s Accessory". Without it, Creek never joins in Part II.'),
  deadline('Weekly activities', 'Gifts, Arena training, meals, and a long list of things reset on Sunday.'),
  item("Giant's Meat", 'Recruits Goliath (deliver 3).'),
  item('Paradise Fish', 'Recruits Ninae (deliver 1).'),
];
const names = (ts: TieCandidate[]) => ts.map((t) => t.name);

test("a unit's own words name what it needs (either side of a colon)", () => {
  assert.deepEqual(names(tiesFor('Buccar', "Support 3, Renown 8 · Off-route: clear Leda's Paralogue.", all)), ["Leda's Paralogue: Diversionary Tactics"]);
  assert.deepEqual(names(tiesFor('Diego', "Clear Orchel's Regret, the only paralogue open on all four routes.", all)), ["Orchel's Paralogue: Orchel's Regret"]);
});

test('or the other side names the unit, capitalized as a whole word', () => {
  assert.deepEqual(names(tiesFor('Goliath', 'Support 3, Renown 9', all)), ["Giant's Meat"]);
  assert.deepEqual(names(tiesFor('Ninae', "Deliver 1 Paradise Fish. Easiest at Lake Brontes.", all)), ['Paradise Fish']);
  assert.deepEqual(names(tiesFor('Long', 'How to get Long is not known.', all)), [], '"a long list" is not Long');
});

test('a last chance named after the unit is theirs', () => {
  assert.deepEqual(names(tiesFor('Creek', 'Joins in Part II.', all)), ['Creek']);
});

test('nothing for a unit nobody names', () => {
  assert.deepEqual(tiesFor('Dante', 'Pay 8,000G.', all), []);
});

test("an entry's words: description, sections and every route", () => {
  assert.equal(wordsOf({ description: 'A', sections: [{ label: 'x', text: 'B' }], perRoute: { leda: [{ label: 'y', text: 'C' }] } }), 'A\nB\nC');
});

test("a class's unlock ties only what its own words name", () => {
  const extra = [...all, item('Hingosh', 'Wanted for the Dancer class.')];
  assert.deepEqual(names(tiesFor('Dancer', 'Leda: Ch 9: deliver a Hingosh from Baina Oasis.', extra, { reverse: false })), ['Hingosh']);
  assert.deepEqual(tiesFor('Dancer', 'Swords B', extra, { reverse: false }), []);
});

test('a gift someone likes is not something they need', () => {
  const gifts = [...all, item('Jade Ghosh', 'A gift. Liked by Goliath, Ninae and Dante.')];
  assert.deepEqual(names(tiesFor('Goliath', 'Support 3, Renown 9', gifts)), ["Giant's Meat"]);
});
