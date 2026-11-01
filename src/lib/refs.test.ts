// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeRefs, insertPick, plainRefs, refsIn, splitRefs, typedHash } from './refs.ts';

const eshmel = { game: 'fortunes-weave', key: 'card:1b2c' };

test('typing #esh is noticed only right before the cursor', () => {
  assert.deepEqual(typedHash('ask #esh', 8), { start: 4, query: 'esh' });
  assert.deepEqual(typedHash('#', 1), { start: 0, query: '' });
  assert.equal(typedHash('ask #esh about it', 17), null);
  assert.equal(typedHash('issue#3', 7), null);
});

test('picking Eshmel writes his name, and sending writes his code', () => {
  const picked = insertPick('ask #esh', 4, 8, 'Eshmel');
  assert.deepEqual(picked, { text: 'ask #Eshmel ', caret: 12 });
  const sent = encodeRefs('ask #Eshmel about #Eshmel', [{ label: 'Eshmel', ref: eshmel }]);
  assert.equal(sent, 'ask <#fortunes-weave:card:1b2c> about <#fortunes-weave:card:1b2c>');
});

test('a message reads back with its references', () => {
  const body = 'see <#fortunes-weave:card:1b2c>, thanks';
  assert.deepEqual(splitRefs(body), [{ text: 'see ' }, { ref: eshmel }, { text: ', thanks' }]);
  assert.deepEqual(refsIn(body), [eshmel]);
  assert.equal(plainRefs(body, () => 'Eshmel'), 'see #Eshmel, thanks');
  assert.deepEqual(splitRefs('no codes, <#nope>'), [{ text: 'no codes, <#nope>' }]);
});
