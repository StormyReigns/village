// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wilsonLower, sortStandouts, type DraftStats } from './standouts.ts';

test('wilson lower bound matches the worked examples', () => {
  assert.equal(wilsonLower(3, 6).toFixed(3), '0.188');
  assert.equal(wilsonLower(10, 50).toFixed(3), '0.112');
  assert.equal(wilsonLower(0, 0), 0);
});

test('a Draft most viewers back beats an old one few backed', () => {
  const old: DraftStats = { id: 'old', ups: 10, downs: 0, viewers: 50, createdAt: '2026-10-01' };
  const loved: DraftStats = { id: 'loved', ups: 3, downs: 0, viewers: 6, createdAt: '2026-10-10' };
  assert.deepEqual(sortStandouts([old, loved]).map((d) => d.id), ['loved', 'old']);
});

test('two votes from two viewers do not run away', () => {
  const lucky: DraftStats = { id: 'lucky', ups: 2, downs: 0, viewers: 2, createdAt: '2026-10-10' };
  const steady: DraftStats = { id: 'steady', ups: 30, downs: 2, viewers: 60, createdAt: '2026-10-01' };
  assert.equal(sortStandouts([lucky, steady])[0].id, 'steady');
});

test('the newest unseen Draft keeps a top-five place', () => {
  const seen = Array.from({ length: 8 }, (_, i): DraftStats => ({ id: 's' + i, ups: 20 - i, downs: 0, viewers: 40, createdAt: '2026-10-0' + (i + 1) }));
  const fresh: DraftStats = { id: 'fresh', ups: 0, downs: 0, viewers: 0, createdAt: '2026-10-19' };
  const order = sortStandouts([...seen, fresh]).map((d) => d.id);
  assert.ok(order.indexOf('fresh') <= 4, 'fresh Draft is in the top five: ' + order.join(','));
});
