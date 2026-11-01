// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStream, draftThread, entryThread, threadOf } from './threads.ts';

const drafts = new Map([
  ['d-new', { id: 'd-new', cardId: null }],
  ['d-fix', { id: 'd-fix', cardId: 'c-eshmel' }],
  ['d-shipped', { id: 'd-shipped', cardId: 'c-rosado' }],
]);
const msg = (id: number, at: string, threadKey: string | null = null, draftId: string | null = null) =>
  ({ id, createdAt: `2026-11-01T10:${at}:00Z`, threadKey, draftId });

test('threads are named by the thing, not its name', () => {
  assert.equal(entryThread('characters', { id: 'eshmel', ref: { card: 'c-eshmel' } }), 'card:c-eshmel');
  assert.equal(entryThread('characters', { id: 'eshmel' }), 'entry:characters.eshmel');
  assert.equal(draftThread({ id: 'd-new', cardId: null }), 'draft:d-new');
});

test("a fix's Discuss messages join the entry's thread, and a published Draft's move to its card", () => {
  assert.equal(threadOf(msg(1, '00', null, 'd-fix'), drafts), 'card:c-eshmel');
  assert.equal(threadOf(msg(2, '00', 'draft:d-shipped'), drafts), 'card:c-rosado');
  assert.equal(threadOf(msg(3, '00', 'draft:d-new'), drafts), 'draft:d-new');
  assert.equal(threadOf(msg(4, '00'), drafts), null);
});

test('one card per thread, at its newest message', () => {
  const stream = buildStream([
    msg(1, '01'), msg(2, '02', 'card:c-eshmel'), msg(3, '03'), msg(4, '04', null, 'd-fix'), msg(5, '05'),
  ], drafts);
  assert.deepEqual(stream.map((x) => (x.kind === 'message' ? x.m.id : x.key)), [1, 3, 'card:c-eshmel', 5]);
  const card = stream[2];
  assert.equal(card.kind === 'thread' && card.messages.length, 2);
});
