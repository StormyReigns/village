// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeRefs, insertPick, mentionsIn, mentionToken, plainRefs, refsIn, refToken, splitRefs, typedMark } from './refs.ts';

const eshmel = { game: 'fortunes-weave', key: 'card:1b2c' };
const ana = '5f3a0000-0000-4000-8000-000000000001';

test('typing #esh or @an is noticed only right before the cursor', () => {
  assert.deepEqual(typedMark('ask #esh', 8), { mark: '#', start: 4, query: 'esh' });
  assert.deepEqual(typedMark('#', 1), { mark: '#', start: 0, query: '' });
  assert.deepEqual(typedMark('hey @an', 7), { mark: '@', start: 4, query: 'an' });
  assert.equal(typedMark('ask #esh about it', 17), null);
  assert.equal(typedMark('issue#3', 7), null);
  assert.equal(typedMark('mail me@home', 12), null);
});

test('picking writes the name, and sending writes the code', () => {
  assert.deepEqual(insertPick('ask #esh', 4, 8, 'Eshmel'), { text: 'ask #Eshmel ', caret: 12 });
  assert.deepEqual(insertPick('hey @an', 4, 7, 'Ana', '@'), { text: 'hey @Ana ', caret: 9 });
  const sent = encodeRefs('@Ana see #Eshmel', [{ label: 'Eshmel', mark: '#', token: refToken(eshmel) }, { label: 'Ana', mark: '@', token: mentionToken(ana) }]);
  assert.equal(sent, `<@${ana}> see <#fortunes-weave:card:1b2c>`);
});

test('a message reads back with its references and mentions', () => {
  const body = `see <#fortunes-weave:card:1b2c>, <@${ana}>`;
  assert.deepEqual(splitRefs(body), [{ text: 'see ' }, { ref: eshmel }, { text: ', ' }, { mention: ana }]);
  assert.deepEqual(refsIn(body), [eshmel]);
  assert.deepEqual(mentionsIn(body), [ana]);
  assert.equal(plainRefs(body, () => 'Eshmel', () => 'Ana'), 'see #Eshmel, @Ana');
  assert.deepEqual(splitRefs('no codes, <#nope> <@nope>'), [{ text: 'no codes, <#nope> <@nope>' }]);
});
