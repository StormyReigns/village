// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_TIERS, EMPTY_LIST, communityText, communityTier, countsByCard, fromCommunity, fromPlacements, inLimits,
  place, placedCount, readList, setReason, tidy, tierOf, tiersOf, titleOf, toPieces,
} from './tiers.ts';

const T = DEFAULT_TIERS;

test('MVP unless the builders named it', () => {
  assert.equal(titleOf(null), 'MVP');
  assert.equal(titleOf({ title: '  ' }), 'MVP');
  assert.equal(titleOf({ title: 'Hottest' }), 'Hottest');
});

test('S to D unless the builders named their own', () => {
  assert.deepEqual(tiersOf(null).map((t) => t.label), ['S', 'A', 'B', 'C', 'D']);
  assert.deepEqual(tiersOf({ tiers: [{ key: 'must', label: 'Must use' }] }).map((t) => t.key), ['must']);
});

test('the community tier is the median, so a few joke lists cannot drag it down', () => {
  assert.deepEqual(communityTier({ a: 6, d: 2 }, T), { tier: 'a', lists: 8, settled: true });
  assert.equal(communityTier({ s: 4, a: 12, b: 6, c: 1 }, T).tier, 'a');
  // More than half must put it there or higher: an even split lands on the lower tier.
  assert.equal(communityTier({ s: 1, a: 1 }, T).tier, 'a');
  assert.equal(communityTier({ s: 3, d: 2 }, T).tier, 's');
});

test('nothing until someone places it; leaning until 5 lists', () => {
  assert.deepEqual(communityTier({}, T), { tier: null, lists: 0, settled: false });
  assert.deepEqual(communityTier(undefined, T), { tier: null, lists: 0, settled: false });
  const early = communityTier({ b: 3 }, T);
  assert.equal(early.settled, false);
  assert.equal(communityText(early, T), 'Leaning B');
  assert.equal(communityText(communityTier({ b: 5 }, T), T), 'B');
  assert.equal(communityText(communityTier({}, T), T), null);
});

test('counts for a tier that no longer exists are left out', () => {
  assert.deepEqual(communityTier({ s: 2, gone: 9 }, T), { tier: 's', lists: 2, settled: false });
});

test('tallies from the database become counts per card', () => {
  const m = countsByCard([{ card_id: 'x', tier_key: 's', lists: 2 }, { card_id: 'x', tier_key: 'a', lists: 1 }, { card_id: 'y', tier_key: 'b', lists: 4 }]);
  assert.deepEqual(m.get('x'), { s: 2, a: 1 });
  assert.deepEqual(m.get('y'), { b: 4 });
});

test('placing, moving and taking back pieces', () => {
  let l = place(EMPTY_LIST, 'cai', 's');
  l = place(l, 'long', 's');
  l = place(l, 'fabio', 's', 0);
  assert.deepEqual(l.rows.s, ['fabio', 'cai', 'long']);
  l = place(l, 'cai', 'b');
  assert.deepEqual(l.rows, { s: ['fabio', 'long'], b: ['cai'] });
  assert.equal(tierOf(l, 'cai'), 'b');
  l = setReason(l, 'cai', '  Great   early ');
  assert.equal(l.reasons.cai, ' Great early ');
  l = place(l, 'cai', 'a');
  assert.equal(l.reasons.cai, ' Great early ', 'a reason moves with its piece');
  l = place(l, 'cai', null);
  assert.equal(tierOf(l, 'cai'), null);
  assert.equal(l.reasons.cai, undefined, 'back in the tray, the reason goes');
  assert.equal(placedCount(l), 2);
});

test('a reason needs a placed piece and stays one short line', () => {
  assert.deepEqual(setReason(EMPTY_LIST, 'x', 'Why').reasons, {});
  const l = setReason(place(EMPTY_LIST, 'x', 'a'), 'x', 'y'.repeat(300));
  assert.equal(l.reasons.x.length, 140);
  assert.deepEqual(setReason(l, 'x', '   ').reasons, {});
});

test('tidying drops removed entries and tiers', () => {
  const l = setReason(place(place(place(EMPTY_LIST, 'a', 's'), 'b', 'old'), 'c', 's'), 'c', 'Why');
  assert.deepEqual(tidy(l, new Set(['a', 'b']), T), { rows: { s: ['a'] }, reasons: {} });
});

test('a list starts from the community tiers', () => {
  const l = fromCommunity(['a', 'b', 'c'], (id) => ({ a: 's', c: 'b' } as Record<string, string>)[id] ?? null);
  assert.deepEqual(l.rows, { s: ['a'], b: ['c'] });
});

test('saving and loading a list round-trips through cards', () => {
  const l = setReason(place(place(place(EMPTY_LIST, 'cai', 'a'), 'long', 's'), 'fabio', 'a'), 'fabio', 'Tanky');
  const cards: Record<string, string> = { cai: 'c1', long: 'c2', fabio: 'c3' };
  const pieces = toPieces(l, T, (id) => cards[id]);
  assert.deepEqual(pieces, [{ card: 'c2', tier: 's' }, { card: 'c1', tier: 'a' }, { card: 'c3', tier: 'a', reason: 'Tanky' }]);
  const ids = Object.fromEntries(Object.entries(cards).map(([k, v]) => [v, k]));
  const back = fromPlacements(pieces.map((p, i) => ({ card_id: p.card, tier_key: p.tier, position: i, reason: 'reason' in p ? p.reason! : null })), (c) => ids[c]);
  assert.deepEqual(back, l);
  assert.deepEqual(toPieces(l, T, () => undefined), [], 'pieces with no card yet are left out');
});

test('a list kept on the device survives bad data', () => {
  assert.deepEqual(readList(null), EMPTY_LIST);
  assert.deepEqual(readList('nonsense'), EMPTY_LIST);
  assert.deepEqual(readList('{"rows":{"s":["a",3]},"reasons":{"a":"ok","b":4}}'), { rows: { s: ['a'] }, reasons: { a: 'ok' } });
});

test('route and group limits are optional', () => {
  const e = { routes: ['cai'], categories: { Group: 'Fiery Mane' } };
  assert.equal(inLimits(e, null), true);
  assert.equal(inLimits(e, { routes: ['cai', 'leda'] }), true);
  assert.equal(inLimits(e, { routes: ['leda'] }), false);
  assert.equal(inLimits({ categories: {} }, { routes: ['leda'] }), true, 'an entry on every route is on every route');
  assert.equal(inLimits(e, { tag: { key: 'Group', values: ['Fiery Mane'] } }), true);
  assert.equal(inLimits(e, { tag: { key: 'Group', values: ['Lions'] } }), false);
});
