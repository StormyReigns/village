// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findReactions, MORE, QUICK } from './reactions.ts';

test('the quick row has thumbs down, and every reaction fits the database (16 characters)', () => {
  assert.ok(QUICK.includes('👎'));
  for (const e of [...QUICK, ...MORE.flatMap((g) => g.items.map(([x]) => x))]) assert.ok(e.length <= 16, e);
});

test('More can be searched by plain words', () => {
  assert.ok(findReactions('heart').includes('❤️'));
  assert.ok(findReactions('yes').includes('👍'));
  assert.deepEqual(findReactions('zzzz-nothing'), []);
  assert.equal(findReactions('').length, MORE.reduce((n, g) => n + g.items.length, 0));
});
