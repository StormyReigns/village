// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { goodness, heatFill, placeOf, placeText, rangeOf } from './stats.ts';
import type { Entry, StatDef } from '../data/pages/types.ts';

const e = (name: string, stats: Record<string, number>): Entry => ({ id: name, name, sections: [], categories: {}, stats });
const list = [e('Fire', { might: 3, weight: 5 }), e('Thoron', { might: 20, weight: 25 }), e('Wind', { might: 3, weight: 3 }), e('Blank', {})];
const might: StatDef = { key: 'might', label: 'Might', better: 'high' };
const weight: StatDef = { key: 'weight', label: 'Weight', better: 'low' };

test('ranges skip entries without the stat', () => {
  assert.deepEqual(rangeOf(list, 'might'), { min: 3, max: 20 });
  assert.equal(rangeOf(list, 'crit'), null);
});

test('lower is better flips goodness', () => {
  assert.equal(goodness(might, 20, { min: 3, max: 20 }), 1);
  assert.equal(goodness(weight, 25, { min: 3, max: 25 }), 0);
  assert.equal(goodness(weight, 3, { min: 3, max: 25 }), 1);
  assert.equal(goodness(might, 4, { min: 4, max: 4 }), 0.5);
});

test('places count ties and say it plainly', () => {
  assert.deepEqual(placeOf(might, 20, list), { place: 1, of: 3, tied: false });
  assert.deepEqual(placeOf(might, 3, list), { place: 2, of: 3, tied: true });
  assert.equal(placeText(placeOf(might, 20, list)), 'Best of 3');
  assert.equal(placeText(placeOf(might, 3, list)), 'Tied 2nd of 3');
  assert.equal(placeText(placeOf(weight, 25, list)), 'Worst of 3');
  assert.equal(placeText({ place: 12, of: 30, tied: false }), '12th of 30');
});

test('worst is plain gray and best is the most Page color', () => {
  assert.equal(heatFill(0, 'var(--sun)'), 'color-mix(in srgb, var(--sun) 0%, var(--card-2))');
  assert.equal(heatFill(1, 'var(--sun)'), 'color-mix(in srgb, var(--sun) 55%, var(--card-2))');
  assert.equal(heatFill(2, 'red'), heatFill(1, 'red'));
});
